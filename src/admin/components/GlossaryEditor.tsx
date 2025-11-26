import {
  Fragment,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PktAlert,
  PktButton,
  PktCard,
  PktTextarea,
  PktTextinput,
} from "@oslokommune/punkt-react";
import type { AdminGlossaryTermDictionaryEntry, AdminGlossaryLink } from "../types";
import { useAdminDictionary } from "../context/AdminDictionaryContext";
import {
  deleteGlossaryTerm,
  upsertGlossaryTerm,
} from "../api/adminApiClient";
import "./GlossaryEditor.css";

type DraftState = {
  id: string;
  term: string;
  definition: string;
  linkLabel: string;
  linkUrl: string;
};

type FormMode = "create" | "edit";

export type GlossaryEditorHandle = {
  openCreateModal: () => void;
};

const DEFAULT_MAX_TERM_LENGTH = 50;
const CARD_MIN_WIDTH = 320;

export const GlossaryEditor = forwardRef<GlossaryEditorHandle>(
  function GlossaryEditor(_, ref) {
    const { dictionary, generation, status, error, reload } =
      useAdminDictionary();
    const glossaryTerms = useMemo(
      () =>
        [...(dictionary?.glossaryTerms ?? [])].sort((a, b) =>
          a.term.localeCompare(b.term, "nb-NO")
        ),
      [dictionary?.glossaryTerms]
    );
    const maxTermLength = useMemo(() => {
      const longest = glossaryTerms.reduce(
        (max, entry) => Math.max(max, entry.term.trim().length),
        0
      );
      return longest > 0 ? Math.max(longest, DEFAULT_MAX_TERM_LENGTH) : DEFAULT_MAX_TERM_LENGTH;
    }, [glossaryTerms]);

    const [formMode, setFormMode] = useState<FormMode | null>(null);
    const [draft, setDraft] = useState<DraftState>({
      id: "",
      term: "",
      definition: "",
      linkLabel: "",
      linkUrl: "",
    });
    const [formError, setFormError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [gridColumns, setGridColumns] = useState(1);
    const gridRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const gridNode = gridRef.current;
      if (!gridNode) {
        return;
      }

      const updateColumns = (width: number) => {
        const nextColumns = Math.max(1, Math.floor(width / CARD_MIN_WIDTH));
        setGridColumns((prev) => (prev === nextColumns ? prev : nextColumns));
      };

      updateColumns(gridNode.clientWidth);

      if (typeof ResizeObserver === "undefined") {
        return;
      }

      const observer = new ResizeObserver((entries) => {
        if (!entries.length) {
          return;
        }
        updateColumns(entries[0].contentRect.width);
      });
      observer.observe(gridNode);

      return () => observer.disconnect();
    }, []);

    const existingEntry = useMemo(() => {
      if (formMode !== "edit" || !draft.id) {
        return null;
      }
      return glossaryTerms.find((entry) => entry.id === draft.id) ?? null;
    }, [glossaryTerms, draft.id, formMode]);

    const openCreate = () => {
      setFormMode("create");
      setDraft({ id: "", term: "", definition: "", linkLabel: "", linkUrl: "" });
      setFormError(null);
    };

    const openEdit = (entry: AdminGlossaryTermDictionaryEntry) => {
      setFormMode("edit");
      const firstLink = entry.links?.[0];
      setDraft({
        id: entry.id,
        term: entry.term,
        definition: entry.definition.join("\n\n"),
        linkLabel: firstLink?.label ?? "",
        linkUrl: firstLink?.url ?? "",
      });
      setFormError(null);
    };

    useImperativeHandle(ref, () => ({
      openCreateModal: () => {
        openCreate();
        if (typeof document !== "undefined") {
          document
            .querySelector(".glossary-editor__form")
            ?.scrollIntoView({ behavior: "smooth" });
        }
      },
    }));

    const handleDraftChange = (field: keyof DraftState, value: string) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
    };

    const handleCancel = () => {
      setFormMode(null);
      setDraft({ id: "", term: "", definition: "", linkLabel: "", linkUrl: "" });
      setFormError(null);
    };

    const handleSave = async () => {
      const trimmedTerm = draft.term.trim();
      const trimmedDefinition = draft.definition.trim();

      if (!trimmedTerm) {
        setFormError("Skriv begrepet som skal forklares.");
        return;
      }

      if (!trimmedDefinition) {
        setFormError("Skriv en forklaring av begrepet.");
        return;
      }

      if (trimmedTerm.length > maxTermLength) {
        setFormError(
          `Begrepet kan maks være ${maxTermLength} tegn.`
        );
        return;
      }

      if (!generation) {
        setFormError(
          "Dictionary er ikke klar ennå. Oppdater siden og prøv igjen."
        );
        return;
      }

      const id =
        formMode === "edit"
          ? draft.id
          : slugify(trimmedTerm) || `nytt-begrep-${glossaryTerms.length + 1}`;

      // Build links array
      const links: AdminGlossaryLink[] = [];
      if (draft.linkLabel.trim() && draft.linkUrl.trim()) {
        links.push({
          label: draft.linkLabel.trim(),
          url: draft.linkUrl.trim(),
        });
      }
      // Preserve additional links from existing entry
      if (existingEntry?.links && existingEntry.links.length > 1) {
        links.push(...existingEntry.links.slice(1));
      }

      const entry: AdminGlossaryTermDictionaryEntry = {
        id,
        term: trimmedTerm,
        definition: trimmedDefinition.split(/\n\n+/).map(p => p.trim()).filter(Boolean),
        links,
      };

      const mode: "create" | "update" = formMode === "create" ? "create" : "update";

      setIsSaving(true);
      setFormError(null);
      try {
        await upsertGlossaryTerm(
          { entry, generation },
          mode
        );
        setStatusMessage(
          mode === "create"
            ? `Begrepet «${entry.term}» er opprettet.`
            : `Begrepet «${entry.term}» er oppdatert.`
        );
        handleCancel();
        await reload();
      } catch (saveError) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "Kunne ikke lagre begrepet.";
        setFormError(message);
      } finally {
        setIsSaving(false);
      }
    };

    const handleDelete = async () => {
      if (formMode !== "edit" || !draft.id) {
        return;
      }
      if (!generation) {
        setFormError("Dictionary er ikke klar ennå. Prøv igjen senere.");
        return;
      }

      setIsSaving(true);
      setFormError(null);
      try {
        await deleteGlossaryTerm(draft.id, generation);
        setStatusMessage(`Begrepet «${draft.term}» er slettet.`);
        handleCancel();
        await reload();
      } catch (deleteError) {
        const message =
          deleteError instanceof Error
            ? deleteError.message
            : "Kunne ikke slette begrepet.";
        setFormError(message);
      } finally {
        setIsSaving(false);
      }
    };

    const editingIndex =
      formMode === "edit"
        ? glossaryTerms.findIndex((entry) => entry.id === draft.id)
        : -1;
    const editingRowEndIndex =
      editingIndex >= 0
        ? Math.min(
            glossaryTerms.length - 1,
            (Math.floor(editingIndex / gridColumns) + 1) * gridColumns - 1
          )
        : null;
    const isEditingLastRow =
      editingRowEndIndex !== null &&
      editingRowEndIndex >= Math.max(glossaryTerms.length - 1, 0);
    const shouldRenderInlineForm =
      formMode === "edit" &&
      editingRowEndIndex !== null &&
      !isEditingLastRow;

    const formSection = (
      <section className="glossary-editor__form" aria-live="polite">
        <header>
          <p className="admin-content__eyebrow">
            {formMode
              ? formMode === "create"
                ? "Nytt begrep"
                : "Rediger begrep"
              : "Velg et begrep for å starte redigering"}
          </p>
          <h4>
            {formMode === "edit" && draft.term
              ? `Rediger «${draft.term}»`
              : "Opprett eller rediger begrep"}
          </h4>
        </header>
        {formError && (
          <PktAlert skin="error" ariaLive="assertive">
            {formError}
          </PktAlert>
        )}
        <div className="glossary-editor__input-row">
          <div className="glossary-editor__term-field">
            <PktTextinput
              id="glossary-term"
              label="Begrep"
              placeholder="F.eks. søknadspliktig"
              value={draft.term}
              onChange={(event) => handleDraftChange("term", event.target.value)}
              maxLength={maxTermLength}
              helptext={`Ordet som markeres i teksten. Maks ${maxTermLength} tegn.`}
              fullwidth
            />
          </div>
        </div>
        <div className="glossary-editor__definition-row">
          <PktTextarea
            id="glossary-definition"
            label="Forklaring"
            placeholder="Skriv en kort og tydelig forklaring av begrepet..."
            value={draft.definition}
            onChange={(event) => handleDraftChange("definition", event.target.value)}
            helptext="Forklaringen som vises i tooltip. Bruk dobbelt linjeskift for flere avsnitt."
            rows={4}
          />
        </div>
        <div className="glossary-editor__link-row">
          <div className="glossary-editor__link-label-field">
            <PktTextinput
              id="glossary-link-label"
              label="Lenketekst (valgfritt)"
              placeholder="Les mer hos DiBK"
              value={draft.linkLabel}
              onChange={(event) => handleDraftChange("linkLabel", event.target.value)}
              fullwidth
            />
          </div>
          <div className="glossary-editor__link-url-field">
            <PktTextinput
              id="glossary-link-url"
              label="Lenke-URL"
              placeholder="https://www.dibk.no/..."
              value={draft.linkUrl}
              onChange={(event) => handleDraftChange("linkUrl", event.target.value)}
              fullwidth
            />
          </div>
        </div>
        <div className="glossary-editor__form-actions">
          <PktButton
            className="glossary-editor__save-button"
            skin="primary"
            onClick={handleSave}
            disabled={isSaving || !formMode}
          >
            {isSaving ? "Lagrer …" : "Lagre begrep"}
          </PktButton>
          <div className="glossary-editor__form-actions-secondary">
            {formMode && (
              <PktButton
                skin="secondary"
                variant="label-only"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Avbryt
              </PktButton>
            )}
            {formMode === "edit" && (
              <PktButton
                skin="primary"
                color="red"
                variant="label-only"
                onClick={handleDelete}
                disabled={isSaving}
              >
                Slett begrep
              </PktButton>
            )}
          </div>
        </div>
      </section>
    );

    const renderInlineFormAfterIndex = (index: number) =>
      shouldRenderInlineForm && editingRowEndIndex === index;

    return (
      <div className="glossary-editor">
        {statusMessage && (
          <PktAlert skin="info" ariaLive="polite">
            {statusMessage}
          </PktAlert>
        )}

        {status === "error" && (
          <PktAlert skin="error" ariaLive="assertive">
            {error ?? "Kunne ikke hente dictionary."}
          </PktAlert>
        )}

        {status === "loading" && (
          <PktAlert skin="info" ariaLive="polite">
            Henter ordliste fra dictionary …
          </PktAlert>
        )}

        <div className="glossary-editor__grid" ref={gridRef}>
          {glossaryTerms.map((entry, index) => (
            <Fragment key={entry.id}>
              <PktCard className="admin-content__card" skin="outlined">
                <div className="glossary-editor__card">
                  <div className="glossary-editor__preview-card">
                    <p className="glossary-editor__preview-term">{entry.term}</p>
                    <p className="glossary-editor__preview-definition">
                      {entry.definition[0]}
                    </p>
                    {entry.links.length > 0 && (
                      <p className="glossary-editor__preview-link">
                        {entry.links[0].label}
                      </p>
                    )}
                  </div>
                  <div className="glossary-editor__card-footer">
                    <PktButton
                      size="small"
                      skin="secondary"
                      variant="label-only"
                      onClick={() => openEdit(entry)}
                    >
                      Rediger
                    </PktButton>
                  </div>
                </div>
              </PktCard>
              {renderInlineFormAfterIndex(index) && (
                <div className="glossary-editor__form-wrapper glossary-editor__form-wrapper--inline">
                  {formSection}
                </div>
              )}
            </Fragment>
          ))}
          {glossaryTerms.length === 0 && status !== "loading" && (
            <PktAlert skin="info" ariaLive="polite" className="glossary-editor__empty">
              Ingen begreper i ordlisten ennå. Bruk «Opprett begrep»-knappen for å starte.
            </PktAlert>
          )}
        </div>

        {(!shouldRenderInlineForm || formMode !== "edit") && (
          <div className="glossary-editor__form-wrapper">
            {formSection}
          </div>
        )}
      </div>
    );
  }
);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9æøåäöü]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}
