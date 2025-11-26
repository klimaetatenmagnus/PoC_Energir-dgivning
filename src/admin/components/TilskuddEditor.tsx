import { useCallback, useMemo, useState } from "react";
import {
  PktAlert,
  PktButton,
  PktCheckbox,
  PktInputWrapper,
  PktSelect,
  PktTextarea,
  PktTextinput,
} from "@oslokommune/punkt-react";
import type { TilskuddContent } from "../../../content/tilskudd/schema";
import type { ContentAudience } from "../../../content/schema-helpers";
import { useAdminDictionary } from "../context/AdminDictionaryContext";
import { useTiltakCatalog } from "../../hooks/contentHooks";
import "./TilskuddEditor.css";

export interface TilskuddEditorProps {
  tilskudd: TilskuddContent;
  onSave: (updated: TilskuddContent) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

// Kjente providers basert på eksisterende data
const KNOWN_PROVIDERS = [
  { id: "enova", name: "Enova", url: "https://www.enova.no" },
  { id: "klimaoslo", name: "Klima- og energifondet (Oslo kommune)", url: "https://www.klimaoslo.no/tilskudd/" },
  { id: "byantikvaren", name: "Byantikvaren i Oslo", url: "https://www.oslo.kommune.no/byantikvaren/" },
] as const;

export function TilskuddEditor({
  tilskudd,
  onSave,
  onCancel,
  isSaving = false,
}: TilskuddEditorProps) {
  const { dictionary } = useAdminDictionary();
  const { data: tiltakCatalog } = useTiltakCatalog({ includeDrafts: true });

  // Redigerbar tilstand
  const [editedTilskudd, setEditedTilskudd] = useState<TilskuddContent>(() =>
    JSON.parse(JSON.stringify(tilskudd))
  );

  // UI-tilstand
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Byggtyper fra dictionary
  const buildingTypes = useMemo(() => {
    const types = dictionary?.buildingTypes ?? [];
    return types.filter((t) => !t.internalOnly);
  }, [dictionary?.buildingTypes]);

  // Alle tiltak fra katalogen
  const allTiltak = useMemo(() => {
    return tiltakCatalog?.items ?? [];
  }, [tiltakCatalog?.items]);

  // Generisk oppdateringsfunksjon
  const updateField = useCallback(
    <K extends keyof TilskuddContent>(field: K, value: TilskuddContent[K]) => {
      setEditedTilskudd((prev) => ({
        ...prev,
        [field]: value,
      }));
      setIsDirty(true);
      setError(null);
    },
    []
  );

  // Provider-håndtering
  const handleProviderChange = useCallback(
    (providerId: string) => {
      const known = KNOWN_PROVIDERS.find((p) => p.id === providerId);
      if (known) {
        updateField("provider", {
          ...editedTilskudd.provider,
          name: known.name,
          url: known.url,
        });
      }
    },
    [editedTilskudd.provider, updateField]
  );

  // Audience-håndtering (checkbox-basert)
  const toggleAudience = useCallback(
    (audience: ContentAudience) => {
      const current = editedTilskudd.audiences;
      const updated = current.includes(audience)
        ? current.filter((a) => a !== audience)
        : [...current, audience];
      // Må ha minst én audience
      if (updated.length > 0) {
        updateField("audiences", updated as [ContentAudience, ...ContentAudience[]]);
      }
    },
    [editedTilskudd.audiences, updateField]
  );

  // Byggtype-håndtering (checkbox-basert)
  const toggleBuildingType = useCallback(
    (buildingTypeId: string) => {
      const current = editedTilskudd.buildingTypes;
      const updated = current.includes(buildingTypeId)
        ? current.filter((bt) => bt !== buildingTypeId)
        : [...current, buildingTypeId];
      // Må ha minst én byggtype
      if (updated.length > 0) {
        updateField("buildingTypes", updated as [string, ...string[]]);
      }
    },
    [editedTilskudd.buildingTypes, updateField]
  );

  // Velg alle byggtyper
  const selectAllBuildingTypes = useCallback(() => {
    const allIds = buildingTypes.map((bt) => bt.id);
    updateField("buildingTypes", allIds as [string, ...string[]]);
  }, [buildingTypes, updateField]);

  // Tiltak-håndtering (checkbox-basert)
  const toggleTiltak = useCallback(
    (tiltakId: string) => {
      const current = editedTilskudd.appliesToTiltak;
      const updated = current.includes(tiltakId)
        ? current.filter((t) => t !== tiltakId)
        : [...current, tiltakId];
      updateField("appliesToTiltak", updated);
    },
    [editedTilskudd.appliesToTiltak, updateField]
  );

  // Lenke-håndtering
  const updateApplicationUrl = useCallback(
    (url: string) => {
      updateField("application", {
        ...editedTilskudd.application,
        url,
      });
    },
    [editedTilskudd.application, updateField]
  );

  // Lagre
  const handleSave = async () => {
    try {
      // Valider påkrevde felter
      if (!editedTilskudd.application.url?.trim()) {
        setError("Søknads-URL må fylles ut");
        return;
      }
      if (editedTilskudd.audiences.length === 0) {
        setError("Minst én liste-status må velges");
        return;
      }
      if (editedTilskudd.buildingTypes.length === 0) {
        setError("Minst én byggtype må velges");
        return;
      }

      // Oppdater metadata
      const now = new Date().toISOString();
      const updatedTilskudd: TilskuddContent = {
        ...editedTilskudd,
        metadata: {
          ...editedTilskudd.metadata,
          updatedAt: now,
          changeSummary: "Redigert via admin-UI",
        },
      };
      await onSave(updatedTilskudd);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre endringene");
    }
  };

  // Finn hvilken kjent provider som matcher (for select-boksen)
  const matchedProviderId = useMemo(() => {
    const found = KNOWN_PROVIDERS.find(
      (p) => p.name === editedTilskudd.provider.name
    );
    return found?.id ?? "custom";
  }, [editedTilskudd.provider.name]);

  return (
    <div className="tilskudd-editor">
      <header className="tilskudd-editor__header">
        <h2 className="tilskudd-editor__title">Rediger: {tilskudd.title}</h2>
        <p className="tilskudd-editor__subtitle">
          Rediger tilskuddsordningen og velg hvem den gjelder for.
        </p>
      </header>

      {error && (
        <PktAlert skin="error" className="tilskudd-editor__error">
          {error}
        </PktAlert>
      )}

      {/* Grunnleggende informasjon */}
      <section className="tilskudd-editor__section">
        <h3 className="tilskudd-editor__section-title">Grunnleggende informasjon</h3>

        <PktTextinput
          id="tilskudd-title"
          label="Tittel"
          helptext="Kort, beskrivende tittel for ordningen"
          value={editedTilskudd.title}
          onChange={(e) => updateField("title", e.target.value)}
        />

        <PktTextarea
          id="tilskudd-summary"
          label="Sammendrag"
          helptext="Kort oppsummering (maks 280 tegn) som vises i kortvisning"
          value={editedTilskudd.summary ?? ""}
          onChange={(e) => updateField("summary", e.target.value || undefined)}
          rows={2}
        />
      </section>

      {/* Tilbyder */}
      <section className="tilskudd-editor__section">
        <h3 className="tilskudd-editor__section-title">Tilbyder</h3>
        <p className="tilskudd-editor__section-helptext">
          Hvem står bak denne støtteordningen?
        </p>

        <PktSelect
          id="tilskudd-provider-select"
          label="Velg tilbyder"
          value={matchedProviderId}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          {KNOWN_PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </PktSelect>
      </section>

      {/* Søknadslenke */}
      <section className="tilskudd-editor__section">
        <h3 className="tilskudd-editor__section-title">Søknad</h3>

        <PktTextinput
          id="tilskudd-application-url"
          label="Søknads-URL"
          helptext="Lenke til søknadsskjema eller informasjonsside"
          value={editedTilskudd.application.url}
          onChange={(e) => updateApplicationUrl(e.target.value)}
        />
      </section>

      {/* Liste-status (audiences) */}
      <section className="tilskudd-editor__section">
        <h3 className="tilskudd-editor__section-title">Liste-status</h3>
        <p className="tilskudd-editor__section-helptext">
          Velg hvilke listestatuser tilskuddsordningen skal vises for.
        </p>

        <PktInputWrapper
          label="Aktuelle listestatuser"
          forId="audience-checkboxes"
          hasFieldset
        >
          <div className="tilskudd-editor__checkbox-group">
            <PktCheckbox
              id="audience-standard"
              label="Standard"
              checked={editedTilskudd.audiences.includes("standard")}
              onChange={() => toggleAudience("standard")}
            />
            <PktCheckbox
              id="audience-gulliste"
              label="Gul liste (vernede/bevaringsverdige bygg)"
              checked={editedTilskudd.audiences.includes("gulliste")}
              onChange={() => toggleAudience("gulliste")}
            />
          </div>
        </PktInputWrapper>
      </section>

      {/* Byggtyper */}
      <section className="tilskudd-editor__section">
        <h3 className="tilskudd-editor__section-title">
          Byggtyper
          <span className="tilskudd-editor__counter">
            {editedTilskudd.buildingTypes.length}/{buildingTypes.length}
          </span>
        </h3>
        <p className="tilskudd-editor__section-helptext">
          Velg hvilke byggtyper ordningen gjelder for.
        </p>

        <div className="tilskudd-editor__select-all">
          <PktButton
            skin="tertiary"
            size="small"
            onClick={selectAllBuildingTypes}
            disabled={editedTilskudd.buildingTypes.length === buildingTypes.length}
          >
            Velg alle
          </PktButton>
        </div>

        <PktInputWrapper
          label="Aktuelle byggtyper"
          forId="buildingtype-checkboxes"
          hasFieldset
        >
          <div className="tilskudd-editor__checkbox-grid">
            {buildingTypes.map((bt) => (
              <PktCheckbox
                key={bt.id}
                id={`buildingtype-${bt.id}`}
                label={bt.label}
                checked={editedTilskudd.buildingTypes.includes(bt.id)}
                onChange={() => toggleBuildingType(bt.id)}
              />
            ))}
          </div>
        </PktInputWrapper>
      </section>

      {/* Tilknyttede tiltak */}
      <section className="tilskudd-editor__section">
        <h3 className="tilskudd-editor__section-title">
          Tilknyttede tiltak
          <span className="tilskudd-editor__counter">{editedTilskudd.appliesToTiltak.length}</span>
        </h3>
        <p className="tilskudd-editor__section-helptext">
          Velg hvilke tiltak denne ordningen skal vises sammen med. Ordningen vises kun i tiltakskort der den er valgt her.
        </p>

        <PktInputWrapper
          label="Velg tiltak"
          forId="tiltak-checkboxes"
          hasFieldset
        >
          <div className="tilskudd-editor__checkbox-grid">
            {allTiltak.map((t) => (
              <PktCheckbox
                key={t.id}
                id={`tiltak-${t.id}`}
                label={t.title}
                checked={editedTilskudd.appliesToTiltak.includes(t.id)}
                onChange={() => toggleTiltak(t.id)}
              />
            ))}
          </div>
        </PktInputWrapper>

        {editedTilskudd.appliesToTiltak.length === 0 && (
          <PktAlert skin="warning" compact>
            Ingen tiltak er valgt. Ordningen vil ikke vises i noen tiltakskort.
          </PktAlert>
        )}
      </section>

      {/* Handlingsknapper */}
      <footer className="tilskudd-editor__footer">
        <PktButton skin="secondary" onClick={onCancel} disabled={isSaving}>
          Avbryt
        </PktButton>
        <PktButton
          skin="primary"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? "Lagrer..." : "Lagre endringer"}
        </PktButton>
      </footer>
    </div>
  );
}
