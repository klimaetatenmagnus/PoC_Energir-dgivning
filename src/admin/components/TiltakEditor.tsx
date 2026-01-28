import { useCallback, useMemo, useState } from "react";
import {
  PktAlert,
  PktButton,
  PktCheckbox,
  PktRadioButton,
  PktSelect,
  PktTextarea,
  PktTextinput,
  PktInputWrapper,
  PktTabs,
} from "@oslokommune/punkt-react";
import type { TiltakContent, TiltakAccordionItem, TiltakLink, TiltakTabsSection } from "../../../content/tiltak/schema";
import type { ContentAudience } from "../../../content/schema-helpers";
import { useAdminDictionary } from "../context/AdminDictionaryContext";
import { useTilskuddCatalog } from "../../hooks/contentHooks";
import "./TiltakEditor.css";

export interface TiltakEditorProps {
  tiltak: TiltakContent;
  onSave: (updated: TiltakContent) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  mode?: "edit" | "create";
}

/**
 * Genererer en slug fra en tittel.
 * Konverterer til lowercase, fjerner diakritiske tegn, og erstatter spesialtegn med bindestreker.
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Fjern diakritiske tegn
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-") // Erstatt ikke-alfanumeriske med bindestrek
    .replace(/^-|-$/g, "") // Fjern ledende/etterfølgende bindestreker
    .slice(0, 50); // Maks 50 tegn
}

/**
 * Validerer at en streng er en gyldig slug.
 */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3;
}

type BuildingTypeKey = string;

/**
 * Henter riktig verdi basert på audience og byggtype.
 * For gulliste: sjekk variant først, fall tilbake til base.
 * For standard: bruk base direkte.
 */
function getAudienceValue<T>(
  base: T,
  variant: T | undefined,
  audience: ContentAudience
): T {
  if (audience === "gulliste" && variant !== undefined) {
    return variant;
  }
  return base;
}

/**
 * Henter byggtype-spesifikk tekst fra et buildingTypeParagraphs-objekt.
 */
function getBuildingTypeText(
  paragraphs: Record<string, string[]> | undefined,
  buildingType: BuildingTypeKey
): string {
  if (!paragraphs) return "";
  const text = paragraphs[buildingType] ?? paragraphs["default"] ?? [];
  return text.join("\n\n");
}

export function TiltakEditor({
  tiltak,
  onSave,
  onCancel,
  isSaving = false,
  mode = "edit",
}: TiltakEditorProps) {
  const { dictionary } = useAdminDictionary();

  // Kontekst-velgere
  const [selectedAudience, setSelectedAudience] = useState<ContentAudience>("standard");
  const [selectedBuildingType, setSelectedBuildingType] = useState<BuildingTypeKey>("default");

  // Redigerbar tilstand - sporer endringer per audience/byggtype
  const [editedTiltak, setEditedTiltak] = useState<TiltakContent>(() =>
    JSON.parse(JSON.stringify(tiltak))
  );

  // UI-tilstand
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(mode === "create"); // I create-modus starter vi som dirty
  const [hasMinBuildingYearError, setMinBuildingYearError] = useState(false);
  const [manualIdOverride, setManualIdOverride] = useState(false); // Om bruker har manuelt endret ID

  // Tilgjengelige audiences fra tiltaket
  // Sjekk både audiences-arrayen OG om det finnes en gulliste-variant
  const availableAudiences = useMemo(() => tiltak.audiences, [tiltak.audiences]);
  const hasGullisteVariant = useMemo(
    () => tiltak.variants.some((v) => v.audience === "gulliste"),
    [tiltak.variants]
  );
  const hasGulliste = availableAudiences.includes("gulliste") || hasGullisteVariant;

  // Finn gulliste-variant hvis den finnes
  const gullisteVariant = useMemo(
    () => editedTiltak.variants.find((v) => v.audience === "gulliste"),
    [editedTiltak.variants]
  );

  // Byggtyper fra dictionary (ekskluder internalOnly for selector)
  const buildingTypes = useMemo(() => {
    const types = dictionary?.buildingTypes ?? [];
    // Inkluder 'default' som første valg, deretter de synlige typene
    const visible = types.filter((t) => !t.internalOnly || t.id === "default");
    return visible;
  }, [dictionary?.buildingTypes]);

  // Fordeler fra dictionary
  const availableBenefits = useMemo(
    () => dictionary?.benefits ?? [],
    [dictionary?.benefits]
  );

  // Hent tilskuddskatalog for grants-velgeren
  const { data: tilskuddCatalog, isLoading: tilskuddLoading } = useTilskuddCatalog({
    includeDrafts: true,
  });

  // Alle tilskudd som er relevante for dette tiltaket (basert på appliesToTiltak)
  const relevantTilskudd = useMemo(() => {
    if (!tilskuddCatalog?.items) return [];
    return tilskuddCatalog.items.filter(
      (t) => t.appliesToTiltak.includes(tiltak.id)
    );
  }, [tilskuddCatalog?.items, tiltak.id]);

  // Filtrer tilskudd basert på valgt audience og byggtype
  const filteredTilskudd = useMemo(() => {
    return relevantTilskudd.filter((t) => {
      // Sjekk audience-match
      const audienceMatch = t.audiences.includes(selectedAudience);

      // Sjekk byggtype-match (hvis "default" er valgt, vis alle)
      const buildingTypeMatch =
        selectedBuildingType === "default" ||
        t.buildingTypes.includes(selectedBuildingType);

      return audienceMatch && buildingTypeMatch;
    });
  }, [relevantTilskudd, selectedAudience, selectedBuildingType]);

  // Tilskudd som er tilgjengelige men ikke matcher valgt kombinasjon
  const otherAvailableTilskudd = useMemo(() => {
    const filteredIds = new Set(filteredTilskudd.map((t) => t.id));
    return relevantTilskudd.filter((t) => !filteredIds.has(t.id));
  }, [relevantTilskudd, filteredTilskudd]);

  // Beregn gjeldende verdier basert på valgt audience
  const currentIntroParagraphs = useMemo(() => {
    const base = editedTiltak.introParagraphs;
    const variantIntro = gullisteVariant?.introParagraphs;
    return getAudienceValue(base, variantIntro, selectedAudience);
  }, [editedTiltak.introParagraphs, gullisteVariant?.introParagraphs, selectedAudience]);

  const currentBuildingTypeParagraphs = useMemo(() => {
    const base = editedTiltak.buildingTypeParagraphs;
    const variantParagraphs = gullisteVariant?.buildingTypeParagraphs;
    if (selectedAudience === "gulliste" && variantParagraphs) {
      // Merge: variant overstyrer base for de nøklene som finnes
      return { ...base, ...variantParagraphs };
    }
    return base;
  }, [editedTiltak.buildingTypeParagraphs, gullisteVariant?.buildingTypeParagraphs, selectedAudience]);

  const currentReadMore = useMemo(() => {
    const base = editedTiltak.readMore;
    const variantReadMore = gullisteVariant?.readMore;
    return getAudienceValue(base, variantReadMore, selectedAudience);
  }, [editedTiltak.readMore, gullisteVariant?.readMore, selectedAudience]);

  const currentAccordion = useMemo(() => {
    const base = editedTiltak.accordion;
    const variantAccordion = gullisteVariant?.accordion;
    return getAudienceValue(base, variantAccordion, selectedAudience);
  }, [editedTiltak.accordion, gullisteVariant?.accordion, selectedAudience]);

  const currentGrants = useMemo(() => {
    const base = editedTiltak.grants;
    const variantGrants = gullisteVariant?.grants;
    return getAudienceValue(base, variantGrants, selectedAudience);
  }, [editedTiltak.grants, gullisteVariant?.grants, selectedAudience]);

  const currentBenefitRefs = useMemo(() => {
    // Sjekk benefitRefs først, fall tilbake til benefits[].id hvis benefitRefs er tomt
    const baseRefs = editedTiltak.benefitRefs ?? [];
    const baseBenefitIds = (editedTiltak.benefits ?? []).map((b) => b.id);
    const base = baseRefs.length > 0 ? baseRefs : baseBenefitIds;

    const variantRefs = gullisteVariant?.benefitRefs ?? [];
    const variantBenefitIds = (gullisteVariant?.benefits ?? []).map((b) => b.id);
    const variant = variantRefs.length > 0 ? variantRefs : (variantBenefitIds.length > 0 ? variantBenefitIds : undefined);

    return getAudienceValue(base, variant, selectedAudience);
  }, [editedTiltak.benefitRefs, editedTiltak.benefits, gullisteVariant?.benefitRefs, gullisteVariant?.benefits, selectedAudience]);

  // Tabs - hent riktig tabs-array basert på audience
  const currentTabs = useMemo(() => {
    const base = editedTiltak.tabs ?? [];
    const variantTabs = gullisteVariant?.tabs;
    return getAudienceValue(base, variantTabs, selectedAudience);
  }, [editedTiltak.tabs, gullisteVariant?.tabs, selectedAudience]);

  // State for hvilken tab som er valgt for redigering (innhold-tabs)
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  // State for hovedfane (Tiltaksinformasjon vs Synlighet)
  const [mainTab, setMainTab] = useState<"info" | "visibility">("info");

  // Har dette tiltaket tabs?
  const hasTabs = currentTabs.length > 0 && currentTabs[0]?.tabs?.length > 0;

  // Synlighet-felt
  const visibleForBuildingTypes = useMemo(
    () => editedTiltak.visibleForBuildingTypes ?? [],
    [editedTiltak.visibleForBuildingTypes]
  );

  const minBuildingYear = useMemo(
    () => editedTiltak.minBuildingYear,
    [editedTiltak.minBuildingYear]
  );

  // Første tabs-seksjon (de fleste tiltak har bare én)
  const tabsSection = currentTabs[0] as TiltakTabsSection | undefined;
  const tabItems = tabsSection?.tabs ?? [];

  // Oppdater en verdi - håndterer både base og variant
  const updateValue = useCallback(
    <K extends keyof TiltakContent>(
      field: K,
      value: TiltakContent[K],
      forAudience: ContentAudience = selectedAudience
    ) => {
      setEditedTiltak((prev) => {
        const updated = { ...prev };

        if (forAudience === "standard") {
          // Oppdater base
          (updated as Record<string, unknown>)[field] = value;
        } else {
          // Oppdater eller opprett gulliste-variant
          const variantIndex = updated.variants.findIndex((v) => v.audience === "gulliste");
          if (variantIndex >= 0) {
            updated.variants = [...updated.variants];
            updated.variants[variantIndex] = {
              ...updated.variants[variantIndex],
              [field]: value,
            };
          } else {
            // Opprett ny variant med påkrevde felter
            updated.variants = [
              ...updated.variants,
              {
                audience: "gulliste",
                benefitRefs: [],
                [field]: value,
              },
            ];
          }
        }

        return updated;
      });
      setIsDirty(true);
      setError(null);
    },
    [selectedAudience]
  );

  // Oppdater byggtype-avsnitt
  const updateBuildingTypeParagraph = useCallback(
    (buildingType: BuildingTypeKey, text: string) => {
      const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

      setEditedTiltak((prev) => {
        const updated = { ...prev };

        if (selectedAudience === "standard") {
          updated.buildingTypeParagraphs = {
            ...updated.buildingTypeParagraphs,
            [buildingType]: paragraphs,
          };
        } else {
          // Oppdater gulliste-variant
          const variantIndex = updated.variants.findIndex((v) => v.audience === "gulliste");
          if (variantIndex >= 0) {
            updated.variants = [...updated.variants];
            const existingParagraphs = updated.variants[variantIndex].buildingTypeParagraphs ?? {};
            updated.variants[variantIndex] = {
              ...updated.variants[variantIndex],
              buildingTypeParagraphs: {
                ...existingParagraphs,
                [buildingType]: paragraphs,
              },
            };
          } else {
            updated.variants = [
              ...updated.variants,
              {
                audience: "gulliste",
                benefitRefs: [],
                buildingTypeParagraphs: { [buildingType]: paragraphs },
              },
            ];
          }
        }

        return updated;
      });
      setIsDirty(true);
      setError(null);
    },
    [selectedAudience]
  );

  // Oppdater intro-tekst
  const handleIntroChange = useCallback(
    (text: string) => {
      const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
      if (paragraphs.length === 0) {
        paragraphs.push(""); // Schema krever minst ett element
      }
      updateValue("introParagraphs", paragraphs);
    },
    [updateValue]
  );

  // Oppdater Les mer-lenker
  const updateReadMoreLink = useCallback(
    (index: number, field: keyof TiltakLink, value: string) => {
      const links = [...currentReadMore];
      if (index < links.length) {
        links[index] = { ...links[index], [field]: value };
        updateValue("readMore", links);
      }
    },
    [currentReadMore, updateValue]
  );

  const addReadMoreLink = useCallback(() => {
    const newLink: TiltakLink = {
      id: `link-${Date.now()}`,
      label: "",
      url: "",
    };
    updateValue("readMore", [...currentReadMore, newLink]);
  }, [currentReadMore, updateValue]);

  const removeReadMoreLink = useCallback(
    (index: number) => {
      const links = currentReadMore.filter((_, i) => i !== index);
      updateValue("readMore", links);
    },
    [currentReadMore, updateValue]
  );

  // Oppdater accordion (søknadsplikt-seksjonen)
  const updateAccordionItem = useCallback(
    (itemId: string, field: keyof TiltakAccordionItem, value: unknown) => {
      const items = currentAccordion.map((item) => {
        if (item.id === itemId) {
          return { ...item, [field]: value };
        }
        return item;
      });
      updateValue("accordion", items);
    },
    [currentAccordion, updateValue]
  );

  // Oppdater fordel-referanser (og synkroniser benefits for preview)
  const toggleBenefitRef = useCallback(
    (benefitId: string) => {
      const refs = [...currentBenefitRefs];
      const index = refs.indexOf(benefitId);
      if (index >= 0) {
        refs.splice(index, 1);
      } else if (refs.length < 4) {
        refs.push(benefitId);
      }

      // Oppdater benefitRefs
      updateValue("benefitRefs", refs);

      // Synkroniser benefits-array basert på dictionary (for lokal preview)
      const updatedBenefits = refs
        .map((refId) => {
          const dictEntry = availableBenefits.find((b) => b.id === refId);
          if (dictEntry) {
            return {
              id: dictEntry.id,
              title: dictEntry.title,
              description: dictEntry.description ?? "",
              icon: dictEntry.icon,
            };
          }
          return null;
        })
        .filter((b): b is NonNullable<typeof b> => b !== null);

      updateValue("benefits", updatedBenefits);
    },
    [currentBenefitRefs, updateValue, availableBenefits]
  );

  // Toggle en grant (støtteordning) for valgt audience
  const toggleGrant = useCallback(
    (grantId: string) => {
      const grants = [...currentGrants];
      const index = grants.indexOf(grantId);
      if (index >= 0) {
        grants.splice(index, 1);
      } else {
        grants.push(grantId);
      }
      updateValue("grants", grants);
    },
    [currentGrants, updateValue]
  );

  // ========== SYNLIGHET-CALLBACKS ==========

  // Toggle en enkelt byggtype for synlighet
  const toggleBuildingTypeVisibility = useCallback(
    (buildingTypeId: string) => {
      const current = editedTiltak.visibleForBuildingTypes ?? [];
      const updated = current.includes(buildingTypeId)
        ? current.filter((bt) => bt !== buildingTypeId)
        : [...current, buildingTypeId];

      setEditedTiltak((prev) => ({
        ...prev,
        visibleForBuildingTypes: updated,
      }));
      setIsDirty(true);
    },
    [editedTiltak.visibleForBuildingTypes]
  );

  // Velg alle byggtyper for synlighet
  const selectAllBuildingTypesVisibility = useCallback(() => {
    const allIds = buildingTypes.filter((bt) => bt.id !== "default").map((bt) => bt.id);
    setEditedTiltak((prev) => ({
      ...prev,
      visibleForBuildingTypes: allIds,
    }));
    setIsDirty(true);
  }, [buildingTypes]);

  // Fjern alle byggtyper (skjul for alle)
  const clearAllBuildingTypesVisibility = useCallback(() => {
    setEditedTiltak((prev) => ({
      ...prev,
      visibleForBuildingTypes: [],
    }));
    setIsDirty(true);
  }, []);

  // Håndter endring av byggår-filter
  const handleMinBuildingYearChange = useCallback((value: string) => {
    const trimmed = value.trim();

    if (trimmed === "") {
      setEditedTiltak((prev) => ({
        ...prev,
        minBuildingYear: undefined,
      }));
      setMinBuildingYearError(false);
      setIsDirty(true);
      return;
    }

    const parsed = parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      setEditedTiltak((prev) => ({
        ...prev,
        minBuildingYear: parsed,
      }));
      setIsDirty(true);
    }
  }, []);

  // Valider byggår-filter ved blur
  const validateMinBuildingYear = useCallback((value: string) => {
    const trimmed = value.trim();

    if (trimmed === "") {
      setMinBuildingYearError(false);
      return;
    }

    const parsed = parseInt(trimmed, 10);
    const isValid = !Number.isNaN(parsed) && parsed >= 1800 && parsed <= 2100;
    setMinBuildingYearError(!isValid);
  }, []);

  // Håndter tittelendring (create-modus)
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setEditedTiltak((prev) => ({
        ...prev,
        title: newTitle,
        // I create-modus: generer slug fra tittel automatisk hvis ikke manuelt overstyrt
        ...(mode === "create" && !manualIdOverride
          ? { id: generateSlug(newTitle) }
          : {}),
      }));
      setIsDirty(true);
      setError(null);
    },
    [mode, manualIdOverride]
  );

  // Håndter ID-endring (create-modus)
  const handleIdChange = useCallback((newId: string) => {
    setManualIdOverride(true);
    setEditedTiltak((prev) => ({
      ...prev,
      id: newId.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    }));
    setIsDirty(true);
    setError(null);
  }, []);

  // Valideringer
  const titleError = editedTiltak.title.trim().length < 3;
  const idError = mode === "create" && !isValidSlug(editedTiltak.id);

  // Validering av påkrevde tekstfelter (intro og default byggtype-tekst)
  const introText = editedTiltak.introParagraphs.filter((p) => p.trim()).join("");
  const introError = mode === "create" && introText.length === 0;

  const defaultBuildingTypeText = (editedTiltak.buildingTypeParagraphs?.default ?? [])
    .filter((p) => p.trim())
    .join("");
  const buildingTypeError = mode === "create" && defaultBuildingTypeText.length === 0;

  // Oppdater tab-innhold (body-tekst for en spesifikk tab)
  const updateTabBody = useCallback(
    (tabIndex: number, text: string) => {
      if (!tabsSection) return;

      const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
      if (paragraphs.length === 0) {
        paragraphs.push("");
      }

      // Oppdater tabs-arrayet
      const updatedTabItems = tabsSection.tabs.map((tab, idx) =>
        idx === tabIndex ? { ...tab, body: paragraphs } : tab
      );

      const updatedTabsSection: TiltakTabsSection = {
        ...tabsSection,
        tabs: updatedTabItems,
      };

      // Oppdater hele tabs-arrayet (vi antar bare én TabsSection)
      const updatedTabs = [updatedTabsSection];

      setEditedTiltak((prev) => {
        const updated = { ...prev };

        if (selectedAudience === "standard") {
          updated.tabs = updatedTabs;
        } else {
          // Oppdater gulliste-variant
          const variantIndex = updated.variants.findIndex((v) => v.audience === "gulliste");
          if (variantIndex >= 0) {
            updated.variants = [...updated.variants];
            updated.variants[variantIndex] = {
              ...updated.variants[variantIndex],
              tabs: updatedTabs,
            };
          } else {
            updated.variants = [
              ...updated.variants,
              {
                audience: "gulliste",
                benefitRefs: [],
                tabs: updatedTabs,
              },
            ];
          }
        }

        return updated;
      });
      setIsDirty(true);
      setError(null);
    },
    [tabsSection, selectedAudience]
  );

  // Lagre
  const handleSave = async () => {
    try {
      // Oppdater metadata
      const now = new Date().toISOString();
      const updatedTiltak: TiltakContent = {
        ...editedTiltak,
        metadata: {
          ...editedTiltak.metadata,
          updatedAt: now,
          changeSummary: `Redigert via admin-UI`,
        },
      };
      await onSave(updatedTiltak);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre endringene");
    }
  };

  // Søknadsplikt-accordion (første accordion-item med id 'soknadsplikt')
  const soknadspliktItem = useMemo(
    () => currentAccordion.find((item) => item.id === "soknadsplikt"),
    [currentAccordion]
  );

  // Sjekk om vi kan lagre (create-modus krever gyldig tittel, ID, intro og byggtype-tekst)
  const canSave = mode === "create"
    ? isDirty && !titleError && !idError && !introError && !buildingTypeError && !hasMinBuildingYearError
    : isDirty && !titleError && !hasMinBuildingYearError;

  return (
    <div className="tiltak-editor">
      <header className="tiltak-editor__header">
        <h2 className="tiltak-editor__title">
          {mode === "create" ? "Opprett nytt tiltak" : `Rediger: ${tiltak.title}`}
        </h2>
        <p className="tiltak-editor__subtitle">
          {mode === "create"
            ? "Fyll inn informasjon for det nye tiltaket."
            : "Bruk fanene for å redigere innhold eller styre synlighet."}
        </p>
      </header>

      {error && (
        <PktAlert skin="error" className="tiltak-editor__error">
          {error}
        </PktAlert>
      )}

      {/* Hovedfaner */}
      <div className="tiltak-editor__main-tabs">
        <PktTabs
          tabs={[
            {
              text: mode === "create" ? "Tiltaksinformasjon" : "Endre tiltaksinformasjon",
              active: mainTab === "info",
              action: () => setMainTab("info"),
            },
            {
              text: mode === "create" ? "Synlighet" : "Endre synlighet",
              active: mainTab === "visibility",
              action: () => setMainTab("visibility"),
            },
          ]}
          onTabSelected={(index) => setMainTab(index === 0 ? "info" : "visibility")}
        />
      </div>

      {/* ========== FANE: TILTAKSINFORMASJON ========== */}
      {mainTab === "info" && (
        <>
          {/* Grunnleggende informasjon (tittel og ID) */}
          <section className="tiltak-editor__section tiltak-editor__section--identity">
            <h3 className="tiltak-editor__section-title">Grunnleggende informasjon</h3>
            <PktTextinput
              id="tiltak-title"
              label="Tiltakstittel"
              helptext="Tittelen som vises i tiltakslisten og på tiltakskortet"
              value={editedTiltak.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleTitleChange(e.target.value)
              }
              hasError={titleError}
              errorMessage="Tittel er påkrevd (minst 3 tegn)"
            />

            {/* ID-felt vises kun i create-modus */}
            {mode === "create" && (
              <PktTextinput
                id="tiltak-id"
                label="Tiltak-ID (slug)"
                helptext="Unik identifikator. Genereres automatisk fra tittelen, men kan overstyres. Brukes i URL-er og filnavn."
                value={editedTiltak.id}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleIdChange(e.target.value)
                }
                hasError={idError}
                errorMessage="ID må være lowercase med kun bokstaver, tall og bindestreker (minst 3 tegn)"
              />
            )}

            {/* Vis ID som readonly i edit-modus */}
            {mode === "edit" && (
              <div className="tiltak-editor__readonly-field">
                <span className="tiltak-editor__readonly-label">Tiltak-ID (slug)</span>
                <span className="tiltak-editor__readonly-value">{editedTiltak.id}</span>
              </div>
            )}
          </section>

          {/* Kontekst-velgere */}
          <section className="tiltak-editor__context">
        <div className="tiltak-editor__context-row">
          {/* Audience-velger */}
          <PktInputWrapper
            label="Målgruppe"
            helptext="Velg om du redigerer innhold for standard boliger eller gul-listede bygg"
            forId="audience-selector"
            hasFieldset
          >
            <div className="tiltak-editor__radio-group">
              <PktRadioButton
                id="audience-standard"
                name="audience"
                label="Standard"
                value="standard"
                checked={selectedAudience === "standard"}
                onChange={() => setSelectedAudience("standard")}
              />
              {hasGulliste && (
                <PktRadioButton
                  id="audience-gulliste"
                  name="audience"
                  label="Gul liste (vernede bygg)"
                  value="gulliste"
                  checked={selectedAudience === "gulliste"}
                  onChange={() => setSelectedAudience("gulliste")}
                />
              )}
            </div>
          </PktInputWrapper>

          {/* Byggtype-velger */}
          <PktSelect
            id="buildingtype-selector"
            label="Byggtype"
            helptext="Velg byggtype for å se og redigere byggtype-spesifikk tekst"
            value={selectedBuildingType}
            onChange={(e) => setSelectedBuildingType(e.target.value)}
          >
            {buildingTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {bt.label}
              </option>
            ))}
          </PktSelect>
        </div>
      </section>

      {/* Intro-tekst */}
      <section className="tiltak-editor__section">
        <h3 className="tiltak-editor__section-title">
          Introduksjonstekst
          {mode === "create" && <span className="tiltak-editor__required">*</span>}
        </h3>
        <PktTextarea
          id="intro-paragraphs"
          label={`Intro for ${selectedAudience === "gulliste" ? "gul liste" : "standard"}`}
          helptext="Skriv ett eller flere avsnitt. Skill avsnitt med tom linje."
          value={currentIntroParagraphs.join("\n\n")}
          onChange={(e) => handleIntroChange(e.target.value)}
          rows={6}
          hasError={introError && selectedAudience === "standard"}
          errorMessage="Introduksjonstekst er påkrevd"
        />
      </section>

      {/* Byggtype-spesifikk tekst */}
      <section className="tiltak-editor__section">
        <h3 className="tiltak-editor__section-title">
          Byggtype-tekst: {buildingTypes.find((b) => b.id === selectedBuildingType)?.label ?? selectedBuildingType}
          {mode === "create" && selectedBuildingType === "default" && (
            <span className="tiltak-editor__required">*</span>
          )}
        </h3>
        <PktTextarea
          id="buildingtype-paragraphs"
          label={`Tekst for ${selectedBuildingType} (${selectedAudience})`}
          helptext="Spesifikk tekst som vises for denne byggtypen. Skill avsnitt med tom linje."
          value={getBuildingTypeText(currentBuildingTypeParagraphs, selectedBuildingType)}
          onChange={(e) => updateBuildingTypeParagraph(selectedBuildingType, e.target.value)}
          rows={5}
          hasError={buildingTypeError && selectedBuildingType === "default" && selectedAudience === "standard"}
          errorMessage="Standard byggtype-tekst er påkrevd"
        />
      </section>

      {/* Tabs-redigering - vises bare hvis tiltaket har tabs */}
      {hasTabs && tabsSection && (
        <section className="tiltak-editor__section">
          <h3 className="tiltak-editor__section-title">
            {tabsSection.title ?? "Tabs"}
          </h3>
          <p className="tiltak-editor__section-helptext">
            Velg en fane for å redigere innholdet.
          </p>

          {/* Tab-navigasjon */}
          <PktTabs
            tabs={tabItems.map((tab, index) => ({
              text: tab.title,
              active: index === selectedTabIndex,
              action: () => setSelectedTabIndex(index),
            }))}
            onTabSelected={(index) => setSelectedTabIndex(index)}
          />

          {/* Innhold for valgt tab */}
          {tabItems[selectedTabIndex] && (
            <div className="tiltak-editor__tab-content">
              <PktTextarea
                id={`tab-body-${selectedTabIndex}`}
                label={`Innhold for "${tabItems[selectedTabIndex].title}"`}
                helptext="Tekst som vises når denne fanen er valgt. Skill avsnitt med tom linje."
                value={tabItems[selectedTabIndex].body.join("\n\n")}
                onChange={(e) => updateTabBody(selectedTabIndex, e.target.value)}
                rows={6}
              />
            </div>
          )}
        </section>
      )}

      {/* Søknadsplikt-seksjon */}
      {soknadspliktItem && (
        <section className="tiltak-editor__section">
          <h3 className="tiltak-editor__section-title">Søknadsplikt og veiledning</h3>
          <PktTextarea
            id="soknadsplikt-body"
            label="Tekst om søknadsplikt"
            helptext="Informasjon om søknadsplikt for dette tiltaket. Skill avsnitt med tom linje."
            value={soknadspliktItem.body.join("\n\n")}
            onChange={(e) => {
              const paragraphs = e.target.value.split(/\n\n+/).filter((p) => p.trim());
              updateAccordionItem("soknadsplikt", "body", paragraphs.length ? paragraphs : [""]);
            }}
            rows={4}
          />

          {/* Søknadsplikt-lenker */}
          <div className="tiltak-editor__links-section">
            <h4 className="tiltak-editor__subsection-title">Lenker i søknadsplikt-seksjonen</h4>
            {soknadspliktItem.links.map((link, index) => (
              <div key={link.id ?? index} className="tiltak-editor__link-row">
                <PktTextinput
                  id={`soknadsplikt-link-label-${index}`}
                  label="Lenketekst"
                  value={link.label}
                  onChange={(e) => {
                    const links = [...soknadspliktItem.links];
                    links[index] = { ...links[index], label: e.target.value };
                    updateAccordionItem("soknadsplikt", "links", links);
                  }}
                />
                <PktTextinput
                  id={`soknadsplikt-link-url-${index}`}
                  label="URL"
                  value={link.url}
                  onChange={(e) => {
                    const links = [...soknadspliktItem.links];
                    links[index] = { ...links[index], url: e.target.value };
                    updateAccordionItem("soknadsplikt", "links", links);
                  }}
                />
                <PktButton
                  skin="tertiary"
                  size="small"
                  onClick={() => {
                    const links = soknadspliktItem.links.filter((_, i) => i !== index);
                    updateAccordionItem("soknadsplikt", "links", links);
                  }}
                >
                  Fjern
                </PktButton>
              </div>
            ))}
            <PktButton
              skin="secondary"
              size="small"
              onClick={() => {
                const newLink: TiltakLink = {
                  id: `soknadsplikt-link-${Date.now()}`,
                  label: "",
                  url: "",
                };
                updateAccordionItem("soknadsplikt", "links", [...soknadspliktItem.links, newLink]);
              }}
            >
              + Legg til lenke
            </PktButton>
          </div>
        </section>
      )}

      {/* Kilde for energiberegning - vises kun hvis tiltaket har energySourceDescription */}
      {(editedTiltak.energySourceDescription !== undefined ||
        ['solenergi', 'vinduer', 'etterisolering-yttervegg', 'etterisolering-kjeller-loft'].includes(editedTiltak.id)) && (
        <section className="tiltak-editor__section">
          <h3 className="tiltak-editor__section-title">Kilde for energiberegning</h3>
          <p className="tiltak-editor__section-helptext">
            Forklaringstekst som vises i infoboksen om energibesparelse (ved spørsmålstegn-ikonet).
          </p>
          <PktTextarea
            id="energy-source-description"
            label="Kildetekst"
            helptext="Forklaring på hvordan energibesparelser er beregnet, kilder og forutsetninger."
            value={editedTiltak.energySourceDescription ?? ""}
            onChange={(e) => {
              setEditedTiltak((prev) => ({
                ...prev,
                energySourceDescription: e.target.value || undefined,
              }));
              setIsDirty(true);
              setError(null);
            }}
            rows={4}
          />
        </section>
      )}

      {/* Les mer-lenker */}
      <section className="tiltak-editor__section">
        <h3 className="tiltak-editor__section-title">Les mer-lenker</h3>
        <p className="tiltak-editor__section-helptext">
          Eksterne lenker som vises i tiltakskortet.
        </p>
        {currentReadMore.map((link, index) => (
          <div key={link.id ?? index} className="tiltak-editor__link-row">
            <PktTextinput
              id={`readmore-label-${index}`}
              label="Lenketekst"
              value={link.label}
              onChange={(e) => updateReadMoreLink(index, "label", e.target.value)}
            />
            <PktTextinput
              id={`readmore-url-${index}`}
              label="URL"
              value={link.url}
              onChange={(e) => updateReadMoreLink(index, "url", e.target.value)}
            />
            <PktButton
              skin="tertiary"
              size="small"
              onClick={() => removeReadMoreLink(index)}
            >
              Fjern
            </PktButton>
          </div>
        ))}
        <PktButton skin="secondary" size="small" onClick={addReadMoreLink}>
          + Legg til lenke
        </PktButton>
      </section>

      {/* Fordeler */}
      <section className="tiltak-editor__section">
        <h3 className="tiltak-editor__section-title">
          Fordeler
          <span className="tiltak-editor__benefit-counter">
            {currentBenefitRefs.length}/4
          </span>
        </h3>
        <p className="tiltak-editor__section-helptext">
          Klikk på en fordel for å aktivere eller deaktivere den. Maks 4 fordeler kan være aktive.
        </p>
        <div className="tiltak-editor__benefits-grid">
          {availableBenefits.map((benefit) => {
            const isActive = currentBenefitRefs.includes(benefit.id);
            const canSelect = isActive || currentBenefitRefs.length < 4;
            return (
              <button
                key={benefit.id}
                type="button"
                className={`tiltak-editor__benefit-chip ${isActive ? "tiltak-editor__benefit-chip--active" : "tiltak-editor__benefit-chip--inactive"}`}
                onClick={() => canSelect && toggleBenefitRef(benefit.id)}
                disabled={!canSelect}
                title={benefit.description}
              >
                {benefit.icon && (
                  <pkt-icon name={benefit.icon} className="tiltak-editor__benefit-icon" />
                )}
                <span className="tiltak-editor__benefit-title">{benefit.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Tilskudd/grants-velger */}
      <section className="tiltak-editor__section">
        <h3 className="tiltak-editor__section-title">
          Støtteordninger
          <span className="tiltak-editor__grants-counter">
            {currentGrants.length} valgt
          </span>
        </h3>
        <p className="tiltak-editor__section-helptext">
          Velg hvilke støtteordninger som skal vises for{" "}
          <strong>{selectedAudience === "gulliste" ? "gul liste" : "standard"}</strong>
          {selectedBuildingType !== "default" && (
            <> og <strong>{buildingTypes.find((b) => b.id === selectedBuildingType)?.label ?? selectedBuildingType}</strong></>
          )}
          . Klikk på en ordning for å aktivere eller deaktivere den.
        </p>

        {tilskuddLoading ? (
          <p className="tiltak-editor__loading">Laster tilskudd...</p>
        ) : (
          <>
            {/* Tilskudd som matcher valgt kombinasjon */}
            {filteredTilskudd.length > 0 ? (
              <div className="tiltak-editor__grants-grid">
                {filteredTilskudd.map((tilskudd) => {
                  const isActive = currentGrants.includes(tilskudd.id);
                  return (
                    <button
                      key={tilskudd.id}
                      type="button"
                      className={`tiltak-editor__grant-chip ${isActive ? "tiltak-editor__grant-chip--active" : "tiltak-editor__grant-chip--inactive"}`}
                      onClick={() => toggleGrant(tilskudd.id)}
                      title={tilskudd.summary ?? tilskudd.title}
                    >
                      <span className="tiltak-editor__grant-title">{tilskudd.title}</span>
                      <span className="tiltak-editor__grant-audiences">
                        {tilskudd.audiences.map((a) => (
                          <span key={a} className={`tiltak-editor__grant-audience-tag tiltak-editor__grant-audience-tag--${a}`}>
                            {a === "gulliste" ? "Gul liste" : "Standard"}
                          </span>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="tiltak-editor__empty-message">
                Ingen tilskudd matcher valgt kombinasjon ({selectedAudience}
                {selectedBuildingType !== "default" ? ` + ${selectedBuildingType}` : ""}).
              </p>
            )}

            {/* Andre tilskudd som er relevante for tiltaket, men ikke matcher valgt kombinasjon */}
            {otherAvailableTilskudd.length > 0 && (
              <div className="tiltak-editor__grants-other">
                <h4 className="tiltak-editor__subsection-title">
                  Andre tilskudd for dette tiltaket (matcher ikke valgt kombinasjon)
                </h4>
                <div className="tiltak-editor__grants-grid tiltak-editor__grants-grid--disabled">
                  {otherAvailableTilskudd.map((tilskudd) => (
                    <div
                      key={tilskudd.id}
                      className="tiltak-editor__grant-chip tiltak-editor__grant-chip--disabled"
                      title={`Gjelder: ${tilskudd.audiences.join(", ")} / ${tilskudd.buildingTypes.join(", ")}`}
                    >
                      <span className="tiltak-editor__grant-title">{tilskudd.title}</span>
                      <span className="tiltak-editor__grant-meta">
                        {tilskudd.audiences.includes("gulliste") ? "Gul liste" : "Standard"}
                        {" · "}
                        {tilskudd.buildingTypes.length === 4 ? "Alle byggtyper" : tilskudd.buildingTypes.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vise valgte grants som ikke lenger finnes i katalogen (legacy/orphaned) */}
            {currentGrants.filter((g) => !relevantTilskudd.some((t) => t.id === g)).length > 0 && (
              <div className="tiltak-editor__grants-orphaned">
                <h4 className="tiltak-editor__subsection-title">
                  Ukjente støtteordninger (finnes ikke i katalogen)
                </h4>
                <div className="tiltak-editor__grants-grid">
                  {currentGrants
                    .filter((g) => !relevantTilskudd.some((t) => t.id === g))
                    .map((grantId) => (
                      <button
                        key={grantId}
                        type="button"
                        className="tiltak-editor__grant-chip tiltak-editor__grant-chip--orphaned"
                        onClick={() => toggleGrant(grantId)}
                        title="Klikk for å fjerne"
                      >
                        <span className="tiltak-editor__grant-title">{grantId}</span>
                        <span className="tiltak-editor__grant-remove">✕</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
        </>
      )}

      {/* ========== FANE: SYNLIGHET ========== */}
      {mainTab === "visibility" && (
        <section className="tiltak-editor__section tiltak-editor__section--visibility">
          <h3 className="tiltak-editor__section-title">Synlighet i tjenesten</h3>
          <p className="tiltak-editor__section-helptext">
            Styr hvilke bygg tiltaket skal vises for basert på byggtype og byggeår.
          </p>

          {/* Byggtype-synlighet */}
          <PktInputWrapper
            label="Vis for byggtyper"
            helptext="Velg hvilke byggtyper dette tiltaket skal vises for. Hvis ingen er valgt, vises ikke tiltaket for noen byggtyper."
            forId="buildingtype-visibility-group"
            hasFieldset
          >
            <div className="tiltak-editor__checkbox-row">
              <PktButton
                skin="tertiary"
                size="small"
                onClick={selectAllBuildingTypesVisibility}
              >
                Velg alle
              </PktButton>
              <PktButton
                skin="tertiary"
                size="small"
                onClick={clearAllBuildingTypesVisibility}
              >
                Fjern alle (skjul for alle)
              </PktButton>
            </div>

            <div className="tiltak-editor__checkbox-grid">
              {buildingTypes
                .filter((bt) => bt.id !== "default")
                .map((bt) => (
                  <PktCheckbox
                    key={bt.id}
                    id={`visibility-${bt.id}`}
                    label={bt.label}
                    checked={visibleForBuildingTypes.includes(bt.id)}
                    onChange={() => toggleBuildingTypeVisibility(bt.id)}
                  />
                ))}
            </div>

            {visibleForBuildingTypes.length === 0 && (
              <p className="tiltak-editor__hint">
                <em>Ingen byggtyper valgt – tiltaket vises ikke for noen byggtyper.</em>
              </p>
            )}
          </PktInputWrapper>

          {/* Byggår-filter */}
          <div className="tiltak-editor__field-group">
            <PktTextinput
              id="min-building-year"
              label="Vis kun for bygg eldre enn år"
              helptext="Tiltaket vises kun for bygg bygget før dette årstallet. La feltet stå tomt for å vise for alle bygg."
              type="number"
              placeholder="f.eks. 1970"
              value={minBuildingYear?.toString() ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleMinBuildingYearChange(e.target.value)
              }
              onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                validateMinBuildingYear(e.target.value)
              }
              hasError={hasMinBuildingYearError}
              errorMessage="Årstallet må være et heltall mellom 1800 og 2100"
            />

            {minBuildingYear && !hasMinBuildingYearError && (
              <p className="tiltak-editor__hint">
                <em>
                  Tiltaket vises kun for bygg bygget før {minBuildingYear}.
                </em>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Handlingsknapper */}
      <footer className="tiltak-editor__footer">
        <PktButton skin="secondary" onClick={onCancel} disabled={isSaving}>
          Avbryt
        </PktButton>
        <PktButton
          skin="primary"
          onClick={handleSave}
          disabled={!canSave || isSaving}
        >
          {isSaving
            ? "Lagrer..."
            : mode === "create"
              ? "Opprett tiltak"
              : "Lagre endringer"}
        </PktButton>
      </footer>
    </div>
  );
}
