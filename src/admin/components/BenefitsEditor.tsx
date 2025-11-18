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
  PktSelect,
  PktTextinput,
} from "@oslokommune/punkt-react";
import type { AdminBenefitDictionaryEntry } from "../types";
import { useAdminDictionary } from "../context/AdminDictionaryContext";
import {
  deleteDictionaryEntry,
  upsertDictionaryEntry,
} from "../api/adminApiClient";
import iconNames from "../data/punktIcons.json";
import "./BenefitsEditor.css";
import { LEGACY_BENEFIT_ICONS } from "./legacyBenefitIcons";

type DraftState = {
  id: string;
  title: string;
  icon: string;
};

type FormMode = "create" | "edit";

export type BenefitsEditorHandle = {
  openCreateModal: () => void;
};

const DEFAULT_MAX_TITLE_LENGTH = 80;
const CARD_MIN_WIDTH = 320;

export const BenefitsEditor = forwardRef<BenefitsEditorHandle>(
  function BenefitsEditor(_, ref) {
    const { dictionary, generation, status, error, reload } =
      useAdminDictionary();
    const benefits = useMemo(
      () =>
        [...(dictionary?.benefits ?? [])].sort((a, b) =>
          a.title.localeCompare(b.title, "nb-NO")
        ),
      [dictionary?.benefits]
    );
    const maxTitleLength = useMemo(() => {
      const longest = benefits.reduce(
        (max, entry) => Math.max(max, entry.title.trim().length),
        0
      );
      return longest > 0 ? longest : DEFAULT_MAX_TITLE_LENGTH;
    }, [benefits]);

    const [formMode, setFormMode] = useState<FormMode | null>(null);
    const [draft, setDraft] = useState<DraftState>({
      id: "",
      title: "",
      icon: "",
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
      return benefits.find((entry) => entry.id === draft.id) ?? null;
    }, [benefits, draft.id, formMode]);

    const openCreate = () => {
      setFormMode("create");
      setDraft({ id: "", title: "", icon: "" });
      setFormError(null);
    };

    const openEdit = (entry: AdminBenefitDictionaryEntry) => {
      setFormMode("edit");
      setDraft({
        id: entry.id,
        title: entry.title,
        icon: entry.icon ?? "",
      });
      setFormError(null);
    };

    useImperativeHandle(ref, () => ({
      openCreateModal: () => {
        openCreate();
        if (typeof document !== "undefined") {
          document
            .querySelector(".benefits-editor__form")
            ?.scrollIntoView({ behavior: "smooth" });
        }
      },
    }));

    const handleDraftChange = (field: keyof DraftState, value: string) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
    };

    const handleCancel = () => {
      setFormMode(null);
      setDraft({ id: "", title: "", icon: "" });
      setFormError(null);
    };

    const handleSave = async () => {
      const trimmedTitle = draft.title.trim();
      if (!trimmedTitle) {
        setFormError("Skriv en kort tekst for fordelen.");
        return;
      }

      if (trimmedTitle.length > maxTitleLength) {
        setFormError(
          `Teksten kan maks være ${maxTitleLength} tegn (lengste eksisterende fordel).`
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
          : slugify(trimmedTitle) || `ny-fordel-${benefits.length + 1}`;

      const entry: AdminBenefitDictionaryEntry = {
        id,
        title: trimmedTitle,
        description:
          existingEntry?.description ??
          benefits.find((benefit) => benefit.id === id)?.description ??
          trimmedTitle,
        icon: draft.icon.trim() || undefined,
        tags:
          existingEntry?.tags ??
          benefits.find((benefit) => benefit.id === id)?.tags ??
          [],
      };

      const mode: "create" | "update" = formMode === "create" ? "create" : "update";

      setIsSaving(true);
      setFormError(null);
      try {
        await upsertDictionaryEntry(
          { entry, generation },
          mode
        );
        setStatusMessage(
          mode === "create"
            ? `Fordelen «${entry.title}» er opprettet.`
            : `Fordelen «${entry.title}» er oppdatert.`
        );
        handleCancel();
        await reload();
      } catch (saveError) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "Kunne ikke lagre fordelen.";
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
        await deleteDictionaryEntry(draft.id, generation);
        setStatusMessage(`Fordelen «${draft.title}» er slettet.`);
        handleCancel();
        await reload();
      } catch (deleteError) {
        const message =
          deleteError instanceof Error
            ? deleteError.message
            : "Kunne ikke slette fordelen.";
        setFormError(message);
      } finally {
        setIsSaving(false);
      }
    };

    const editingIndex =
      formMode === "edit"
        ? benefits.findIndex((entry) => entry.id === draft.id)
        : -1;
    const editingRowEndIndex =
      editingIndex >= 0
        ? Math.min(
            benefits.length - 1,
            (Math.floor(editingIndex / gridColumns) + 1) * gridColumns - 1
          )
        : null;
    const isEditingLastRow =
      editingRowEndIndex !== null &&
      editingRowEndIndex >= Math.max(benefits.length - 1, 0);
    const shouldRenderInlineForm =
      formMode === "edit" &&
      editingRowEndIndex !== null &&
      !isEditingLastRow;

    const formSection = (
      <section className="benefits-editor__form" aria-live="polite">
        <header>
          <p className="admin-content__eyebrow">
            {formMode
              ? formMode === "create"
                ? "Ny fordel"
                : "Rediger fordel"
              : "Velg en fordel for å starte redigering"}
          </p>
          <h4>
            {formMode === "edit" && draft.title
              ? `Rediger «${draft.title}»`
              : "Opprett eller rediger fordel"}
          </h4>
        </header>
        {formError && (
          <PktAlert skin="error" ariaLive="assertive">
            {formError}
          </PktAlert>
        )}
        <div className="benefits-editor__input-row">
          <div className="benefits-editor__title-field">
            <PktTextinput
              id="benefit-title"
              label="Tekst i fordelsboksen"
              placeholder="F.eks. Mindre trekk"
              value={draft.title}
              onChange={(event) => handleDraftChange("title", event.target.value)}
              maxLength={maxTitleLength}
              helptext={`Maks ${maxTitleLength} tegn (lengste eksisterende fordel).`}
              fullwidth
            />
          </div>
          <div className="benefits-editor__icon-picker">
            <PktSelect
              id="benefit-icon"
              label="Punkt-ikon"
              value={draft.icon}
              onChange={(event) => handleDraftChange("icon", event.target.value)}
            >
              <option value="">Velg ikon (valgfritt)</option>
              {iconNames.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </PktSelect>
            {!draft.icon && LEGACY_BENEFIT_ICONS[draft.id] && (
              <p className="benefits-editor__legacy-note">
                Denne fordelen bruker et eldre ikon. Velg et Punkt-ikon for å erstatte det.
              </p>
            )}
          </div>
          <div className="benefits-editor__icon-preview" aria-hidden="true">
            {draft.icon ? (
              <pkt-icon name={draft.icon} aria-hidden="true" />
            ) : LEGACY_BENEFIT_ICONS[draft.id] ? (
              <span className="benefits-editor__legacy-icon">
                {LEGACY_BENEFIT_ICONS[draft.id]}
              </span>
            ) : (
              <span>Ingen ikon valgt</span>
            )}
          </div>
        </div>
        <div className="benefits-editor__form-actions">
          <PktButton
            className="benefits-editor__save-button"
            skin="primary"
            onClick={handleSave}
            disabled={isSaving || !formMode}
          >
            {isSaving ? "Lagrer …" : "Lagre fordel"}
          </PktButton>
          <div className="benefits-editor__form-actions-secondary">
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
                Slett fordel
              </PktButton>
            )}
          </div>
        </div>
      </section>
    );

    const renderInlineFormAfterIndex = (index: number) =>
      shouldRenderInlineForm && editingRowEndIndex === index;

    return (
      <div className="benefits-editor">
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
            Henter fordeler fra dictionary …
          </PktAlert>
        )}

        <div className="benefits-editor__grid" ref={gridRef}>
          {benefits.map((entry, index) => {
            const legacyIcon = LEGACY_BENEFIT_ICONS[entry.id];
            const hasPunktIcon = Boolean(entry.icon?.trim());
            return (
              <Fragment key={entry.id}>
                <PktCard className="admin-content__card" skin="outlined">
                  <div className="benefits-editor__card">
                    <div className="benefits-editor__preview-card">
                      <div className="benefits-editor__preview-icon" aria-hidden="true">
                        {hasPunktIcon ? (
                          <pkt-icon name={entry.icon} aria-hidden="true" />
                        ) : legacyIcon ? (
                          <span className="benefits-editor__legacy-icon">{legacyIcon}</span>
                        ) : (
                          <span className="benefits-editor__icon-placeholder">Aa</span>
                        )}
                      </div>
                      <p className="benefits-editor__preview-title">{entry.title}</p>
                    </div>
                    <div className="benefits-editor__card-footer">
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
                  <div className="benefits-editor__form-wrapper benefits-editor__form-wrapper--inline">
                    {formSection}
                  </div>
                )}
              </Fragment>
            );
          })}
          {benefits.length === 0 && status !== "loading" && (
            <PktAlert skin="info" ariaLive="polite" className="benefits-editor__empty">
              Ingen fordeler i dictionary ennå. Bruk «Opprett fordel»-knappen for å starte.
            </PktAlert>
          )}
        </div>

        {(!shouldRenderInlineForm || formMode !== "edit") && (
          <div className="benefits-editor__form-wrapper">
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
