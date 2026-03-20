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
} from "@oslokommune/punkt-react";
import type { AdminFunFactDictionaryEntry } from "../types";
import { useAdminDictionary } from "../context/AdminDictionaryContext";
import {
  deleteFunFact,
  upsertFunFact,
} from "../api/adminApiClient";
import "./FunFactsEditor.css";

type DraftState = {
  id: string;
  text: string;
};

type FormMode = "create" | "edit";

export type FunFactsEditorHandle = {
  openCreateModal: () => void;
};

const MAX_TEXT_LENGTH = 160;
const CARD_MIN_WIDTH = 320;

export const FunFactsEditor = forwardRef<FunFactsEditorHandle>(
  function FunFactsEditor(_, ref) {
    const { dictionary, generation, status, error, reload } =
      useAdminDictionary();
    const funFacts = useMemo(
      () => [...(dictionary?.funFacts ?? [])],
      [dictionary?.funFacts]
    );

    const [formMode, setFormMode] = useState<FormMode | null>(null);
    const [draft, setDraft] = useState<DraftState>({
      id: "",
      text: "",
    });
    const [formError, setFormError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const openCreate = () => {
      setFormMode("create");
      setDraft({ id: "", text: "" });
      setFormError(null);
    };

    const openEdit = (entry: AdminFunFactDictionaryEntry) => {
      setFormMode("edit");
      setDraft({
        id: entry.id,
        text: entry.text,
      });
      setFormError(null);
    };

    useImperativeHandle(ref, () => ({
      openCreateModal: () => {
        openCreate();
      },
    }));

    const handleCancel = () => {
      setFormMode(null);
      setDraft({ id: "", text: "" });
      setFormError(null);
    };

    const handleSave = async () => {
      const trimmedText = draft.text.trim();

      if (!trimmedText) {
        setFormError("Skriv inn en tekst for fun fact.");
        return;
      }

      if (trimmedText.length > MAX_TEXT_LENGTH) {
        setFormError(
          `Teksten kan maks være ${MAX_TEXT_LENGTH} tegn.`
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
          : slugify(trimmedText) || `fun-fact-${funFacts.length + 1}`;

      const entry: AdminFunFactDictionaryEntry = {
        id,
        text: trimmedText,
      };

      const mode: "create" | "update" = formMode === "create" ? "create" : "update";

      setIsSaving(true);
      setFormError(null);
      try {
        await upsertFunFact(
          { entry, generation },
          mode
        );
        setStatusMessage(
          mode === "create"
            ? "Fun fact er opprettet."
            : "Fun fact er oppdatert."
        );
        handleCancel();
        await reload();
      } catch (saveError) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "Kunne ikke lagre fun fact.";
        setFormError(message);
      } finally {
        setIsSaving(false);
      }
    };

    const handleDeleteInline = async (entry: AdminFunFactDictionaryEntry) => {
      if (!generation) {
        setStatusMessage("Dictionary er ikke klar ennå. Prøv igjen senere.");
        return;
      }

      setDeletingId(entry.id);
      try {
        await deleteFunFact(entry.id, generation);
        setStatusMessage("Fun fact er slettet.");
        if (formMode === "edit" && draft.id === entry.id) {
          handleCancel();
        }
        await reload();
      } catch (deleteError) {
        const message =
          deleteError instanceof Error
            ? deleteError.message
            : "Kunne ikke slette fun fact.";
        setStatusMessage(message);
      } finally {
        setDeletingId(null);
      }
    };

    const editingIndex =
      formMode === "edit"
        ? funFacts.findIndex((entry) => entry.id === draft.id)
        : -1;
    const editingRowEndIndex =
      editingIndex >= 0
        ? Math.min(
            funFacts.length - 1,
            (Math.floor(editingIndex / gridColumns) + 1) * gridColumns - 1
          )
        : null;
    const isEditingLastRow =
      editingRowEndIndex !== null &&
      editingRowEndIndex >= Math.max(funFacts.length - 1, 0);
    const shouldRenderInlineForm =
      formMode === "edit" &&
      editingRowEndIndex !== null &&
      !isEditingLastRow;

    const formSection = (
      <section className="funfacts-editor__form" aria-live="polite">
        <header>
          <p className="admin-content__eyebrow">
            {formMode === "create" ? "Ny fun fact" : "Rediger fun fact"}
          </p>
        </header>
        {formError && (
          <PktAlert skin="error" ariaLive="assertive">
            {formError}
          </PktAlert>
        )}
        <div className="funfacts-editor__text-row">
          <PktTextarea
            id="funfact-text"
            label="Tekst"
            placeholder="F.eks. Visste du at vinduer står for 40 % av varmetapet i en gjennomsnittsbolig?"
            value={draft.text}
            onChange={(event) => setDraft((prev) => ({ ...prev, text: event.target.value }))}
            helptext={`Kort tekst som vises under lasting. Maks ${MAX_TEXT_LENGTH} tegn.`}
            rows={3}
          />
          <p className="funfacts-editor__char-count">
            {draft.text.length} / {MAX_TEXT_LENGTH} tegn
          </p>
        </div>
        <div className="funfacts-editor__form-actions">
          <PktButton
            className="funfacts-editor__save-button"
            skin="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Lagrer …" : "Lagre"}
          </PktButton>
          <PktButton
            skin="secondary"
            variant="label-only"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Avbryt
          </PktButton>
        </div>
      </section>
    );

    const renderInlineFormAfterIndex = (index: number) =>
      shouldRenderInlineForm && editingRowEndIndex === index;

    return (
      <div className="funfacts-editor">
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
            Henter fun facts fra dictionary …
          </PktAlert>
        )}

        {/* Skjemaet vises over listen */}
        {formMode && (!shouldRenderInlineForm || formMode !== "edit") && (
          <div className="funfacts-editor__form-wrapper">
            {formSection}
          </div>
        )}

        <div className="funfacts-editor__grid" ref={gridRef}>
          {funFacts.map((entry, index) => (
            <Fragment key={entry.id}>
              <PktCard className="admin-content__card" skin="outlined">
                <div className="funfacts-editor__card">
                  <p className="funfacts-editor__preview-text">{entry.text}</p>
                  <div className="funfacts-editor__card-actions">
                    <PktButton
                      size="small"
                      skin="tertiary"
                      variant="icon-only"
                      iconName="edit"
                      onClick={() => openEdit(entry)}
                      aria-label="Rediger"
                      title="Rediger"
                    />
                    <PktButton
                      size="small"
                      skin="tertiary"
                      variant="icon-only"
                      iconName="trash-can"
                      onClick={() => handleDeleteInline(entry)}
                      disabled={deletingId === entry.id}
                      aria-label="Slett"
                      title="Slett"
                    />
                  </div>
                </div>
              </PktCard>
              {renderInlineFormAfterIndex(index) && (
                <div className="funfacts-editor__form-wrapper funfacts-editor__form-wrapper--inline">
                  {formSection}
                </div>
              )}
            </Fragment>
          ))}
          {funFacts.length === 0 && status !== "loading" && (
            <PktAlert skin="info" ariaLive="polite" className="funfacts-editor__empty">
              Ingen fun facts ennå. Bruk «Opprett fun fact»-knappen for å starte.
            </PktAlert>
          )}
        </div>
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
