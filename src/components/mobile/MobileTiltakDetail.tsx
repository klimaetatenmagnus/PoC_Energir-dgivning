import React, { useMemo, useState, useCallback } from 'react';
import {
  PktButton,
  PktAccordion,
  PktAccordionItem,
  PktIcon,
} from '@oslokommune/punkt-react';
import { useTiltakContent, useContentDictionary } from '../../hooks/contentHooks';
import { applyTiltakVariant, normaliseBuildingTypeKey } from '../../utils/tiltakContent';
import { resolveTiltakBenefits } from '../../utils/benefitUtils';
import type { ContentAudience } from '../../../content/schema-helpers';
import type { TiltakTabsSection } from '../../../content/tiltak/schema';
import { useGrantAwareStotteordninger } from '../FigmaBlokk/components/Tiltak/useGrantAwareStotteordninger';
import { useProviderColors, getOverskriftLabel, openExternalLink, resolveBuildingCategory } from '../FigmaBlokk/components/Tiltak/shared';
import type { Boligtype } from '../../utils/energySavingsData';
import { computeTiltakSavings } from '../../utils/tiltakSavings';
import { OsloLogo } from '../FigmaBlokk/components/OsloLogo';
import { BenefitChipList } from '../common/BenefitChip';
import './MobileTiltakDetail.css';


interface MobileTiltakDetailProps {
  tiltakId: string;
  buildingType?: string;
  audience?: ContentAudience;
  onBack: () => void;
  /** Årlig besparelse i kWh (valgfritt, vises hvis tilgjengelig) */
  annualSavingsKwh?: number;
  /** Strømpris per kWh for beregning av kr-besparelse */
  energyPricePerKwh?: number;
}

type TabState = Record<string, string | null>;


/**
 * Hent byggtype-etikett (ikke lenger brukt for tags, men beholdt for evt. fremtidig bruk)
 */
const getBuildingLabel = (buildingType?: string | null): string => {
  if (!buildingType || buildingType === 'default') return 'Alle byggtyper';
  return buildingType;
};

/**
 * Formater tall med mellomrom (f.eks. 15000 -> "15 000")
 */
const formatNumberWithSpaces = (num: number): string => {
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

/**
 * Generer unik nøkkel for tab-seksjon
 */
const getTabSectionKey = (section: TiltakTabsSection, index: number): string => {
  return `${section.title ?? 'tabs'}-${index}`;
};

/**
 * MobileTiltakDetail - Full-skjerm visning av tiltaksdetaljer for mobil
 *
 * Designprinsipper:
 * - Full-skjerm layout med sticky header
 * - Scrollbart innhold
 * - Touch-friendly knapper og lenker (min 44×44px)
 * - Punkt designsystem komponenter
 * - Responsive tabs med horisontal scroll
 */
export const MobileTiltakDetail: React.FC<MobileTiltakDetailProps> = ({
  tiltakId,
  buildingType,
  audience = 'standard',
  onBack,
  annualSavingsKwh,
  energyPricePerKwh = 1.1,
}) => {
  const { data, isLoading, error } = useTiltakContent(tiltakId);
  const { data: dictionary } = useContentDictionary();

  // Provider-farger fra dictionary
  const getProviderColor = useProviderColors();

  // State for kilde-tooltip
  const [showSourceTooltip, setShowSourceTooltip] = useState(false);

  // Anvend variant (standard/gulliste)
  const resolvedContent = useMemo(
    () => applyTiltakVariant(data, audience),
    [data, audience]
  );

  const normalizedBuildingType = useMemo(
    () => normaliseBuildingTypeKey(buildingType),
    [buildingType]
  );

  // Tab-state for faner
  const [tabState, setTabState] = useState<TabState>({});

  // Ekstraher innhold
  const introParagraphs = resolvedContent?.introParagraphs ?? [];
  const readMore = resolvedContent?.readMore ?? [];
  const callsToAction = resolvedContent?.callsToAction ?? [];

  // Berik fordeler fra dictionary via felles utility
  // Prioriterer benefitRefs og slår opp i dictionary, med fallback til benefits-array
  const enrichedBenefits = useMemo(
    () => resolveTiltakBenefits(resolvedContent, dictionary, 4),
    [resolvedContent, dictionary]
  );

  // Hent bygningsspesifikke paragrafer
  const buildingTypeParagraphs = useMemo(() => {
    if (!resolvedContent?.buildingTypeParagraphs) return [];
    return (
      resolvedContent.buildingTypeParagraphs[normalizedBuildingType] ??
      resolvedContent.buildingTypeParagraphs.default ??
      []
    );
  }, [resolvedContent?.buildingTypeParagraphs, normalizedBuildingType]);

  // Sentralt beregnet kr-besparelse (anvender bl.a. solenergi-prisjustering for småhus).
  const energyBoligtype: Boligtype = useMemo(
    () => (resolveBuildingCategory(buildingType) === 'blokk' ? 'blokk' : 'småhus'),
    [buildingType]
  );

  const annualSavingsNok = useMemo(() => {
    if (!annualSavingsKwh) return null;
    const { nok } = computeTiltakSavings({
      tiltakId,
      kwhSaved: annualSavingsKwh,
      boligtype: energyBoligtype,
      energyPricePerKwh,
    });
    return nok;
  }, [annualSavingsKwh, energyPricePerKwh, tiltakId, energyBoligtype]);

  const savingsEconomicsNote = useMemo(() => {
    if (tiltakId !== 'solenergi') return undefined;
    if (energyBoligtype !== 'småhus') return undefined;
    return resolvedContent?.savingsEconomicsNote?.smaahus;
  }, [tiltakId, energyBoligtype, resolvedContent?.savingsEconomicsNote]);

  // Separer søknadsplikt fra generell accordion og hent highlight-entry
  const { permitItem, permitHighlightEntry, generalAccordion } = useMemo(() => {
    const baseAccordion = resolvedContent?.accordion ?? [];
    const permit = baseAccordion.find((item) => item.id === 'soknadsplikt');
    if (!permit) {
      return { permitItem: null, permitHighlightEntry: null, generalAccordion: baseAccordion };
    }
    // Hent første glossary-entry som highlight (samme logikk som desktop)
    const highlight = permit.glossary && permit.glossary.length > 0 ? permit.glossary[0] : null;
    return {
      permitItem: permit,
      permitHighlightEntry: highlight,
      generalAccordion: baseAccordion.filter((item) => item !== permit),
    };
  }, [resolvedContent?.accordion]);

  // Filtrer tab-seksjoner med innhold
  const tabSections = useMemo(
    () =>
      (resolvedContent?.tabs ?? []).filter(
        (section) => section.tabs && section.tabs.length > 0
      ),
    [resolvedContent]
  );

  // Hent støtteordninger basert på tiltakId
  // Tilskudd slås opp via appliesToTiltak-feltet (satt i admin-verktøyet)
  // buildingType filtrerer ut tilskudd som ikke gjelder for denne bygningstypen
  // audience filtrerer ut tilskudd som ikke gjelder for standard/gulliste-bygg
  const { stotteordninger, isLoading: grantsLoading } = useGrantAwareStotteordninger({
    tiltakId,
    buildingType,
    audience
  });

  const hasRegisteredGrants = stotteordninger.length > 0;
  const displayedGrants = hasRegisteredGrants
    ? stotteordninger
    : [
        {
          ordning: grantsLoading
            ? 'Henter støtteordninger …'
            : 'Ingen registrerte støtteordninger ennå',
          lenke: null,
          belop: null,
          overskrift: null,
        },
      ];

  // Håndter tab-valg
  const handleTabSelect = useCallback((sectionKey: string, tabId: string) => {
    setTabState((current) => ({
      ...current,
      [sectionKey]: tabId,
    }));
  }, []);

  const buildingLabel = getBuildingLabel(buildingType);

  // Laster-tilstand
  if (isLoading) {
    return (
      <div className="mobile-tiltak-detail">
        <header className="mobile-tiltak-detail__header">
          <PktButton
            skin="secondary"
            size="small"
            variant="icon-left"
            iconName="arrow-return"
            onClick={onBack}
          >
            Tilbake
          </PktButton>
        </header>
        <main className="mobile-tiltak-detail__main">
          <div className="mobile-tiltak-detail__loading">
            <p>Laster innhold …</p>
          </div>
        </main>
      </div>
    );
  }

  // Feil-tilstand
  if (error || !resolvedContent) {
    return (
      <div className="mobile-tiltak-detail">
        <header className="mobile-tiltak-detail__header">
          <PktButton
            skin="secondary"
            size="small"
            variant="icon-left"
            iconName="arrow-return"
            onClick={onBack}
          >
            Tilbake
          </PktButton>
        </header>
        <main className="mobile-tiltak-detail__main">
          <div className="mobile-tiltak-detail__error">
            <h2>Kunne ikke hente innhold</h2>
            <p>
              {error instanceof Error
                ? error.message
                : 'Ingen innhold funnet for tiltaket.'}
            </p>
            <PktButton skin="primary" onClick={onBack}>
              Gå tilbake
            </PktButton>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mobile-tiltak-detail">
      {/* Sticky header med tilbake-knapp */}
      <header className="mobile-tiltak-detail__header">
        <div className="mobile-tiltak-detail__header-content">
          <OsloLogo className="mobile-tiltak-detail__logo" />
          <span className="mobile-tiltak-detail__header-title">Energinøkkelen</span>
        </div>
        <PktButton
          skin="secondary"
          size="small"
          variant="icon-left"
          iconName="arrow-return"
          onClick={onBack}
          className="mobile-tiltak-detail__back-button"
        >
          <span>Tilbake</span>
        </PktButton>
      </header>

      {/* Scrollbart hovedinnhold */}
      <main className="mobile-tiltak-detail__main">
        {/* Tittel og fordels-chips */}
        <section className="mobile-tiltak-detail__hero">
          <span className="mobile-tiltak-detail__eyebrow">Tiltak</span>
          <h1 className="mobile-tiltak-detail__title">{resolvedContent.title}</h1>
          {/* Fordels-chips - bruker felles BenefitChipList-komponent */}
          {enrichedBenefits.length > 0 && (
            <BenefitChipList
              benefits={enrichedBenefits}
              maxItems={4}
              className="mobile-tiltak-detail__benefit-chips"
            />
          )}
        </section>

        {/* Intro-tekst og bygningsspesifikke paragrafer */}
        {(introParagraphs.length > 0 || buildingTypeParagraphs.length > 0) && (
          <section className="mobile-tiltak-detail__section">
            <div className="mobile-tiltak-detail__intro">
              {introParagraphs.map((paragraph, index) => (
                <p key={`intro-${index}`}>{paragraph}</p>
              ))}
              {/* Bygningsspesifikke paragrafer */}
              {buildingTypeParagraphs.map((paragraph, index) => (
                <p key={`building-${index}`}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

        {/* Tabs (f.eks. varmepumpe-typer) */}
        {tabSections.map((section, sectionIndex) => {
          const sectionKey = getTabSectionKey(section, sectionIndex);
          const activeId = tabState[sectionKey] ?? section.tabs[0]?.id ?? null;
          const activeTab =
            section.tabs.find((tab) => tab.id === activeId) ?? section.tabs[0];

          // Bygningstypetilpasset innhold
          const tabBuildingParagraphs =
            activeTab?.buildingTypeBody &&
            (activeTab.buildingTypeBody[normalizedBuildingType] ??
              activeTab.buildingTypeBody.default ??
              null);

          return (
            <section key={sectionKey} className="mobile-tiltak-detail__section">
              <h2 className="mobile-tiltak-detail__section-title">
                {section.title ?? 'Detaljer'}
              </h2>
              {section.description && (
                <p className="mobile-tiltak-detail__section-description">
                  {section.description}
                </p>
              )}

              {/* Horisontalt scrollbare tabs */}
              <div className="mobile-tiltak-detail__tabs" role="tablist">
                {section.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`mobile-tiltak-detail__tab ${
                      tab.id === activeId ? 'mobile-tiltak-detail__tab--active' : ''
                    }`}
                    role="tab"
                    aria-selected={tab.id === activeId}
                    onClick={() => handleTabSelect(sectionKey, tab.id)}
                  >
                    {tab.title}
                  </button>
                ))}
              </div>

              {/* Tab-innhold */}
              {activeTab && (
                <div
                  className="mobile-tiltak-detail__tab-panel"
                  role="tabpanel"
                  id={`tab-${sectionKey}-${activeTab.id}`}
                >
                  {activeTab.summary && (
                    <p className="mobile-tiltak-detail__muted">{activeTab.summary}</p>
                  )}
                  <div className="mobile-tiltak-detail__text-stack">
                    {activeTab.body.map((paragraph, index) => (
                      <p key={`${activeTab.id}-body-${index}`}>{paragraph}</p>
                    ))}
                  </div>

                  {/* Bygningstypetilpasset innhold */}
                  {tabBuildingParagraphs && tabBuildingParagraphs.length > 0 && (
                    <div className="mobile-tiltak-detail__text-stack mobile-tiltak-detail__text-stack--secondary">
                      <p className="mobile-tiltak-detail__muted">
                        Tilpasset {buildingLabel.toLowerCase()}
                      </p>
                      {tabBuildingParagraphs.map((paragraph, index) => (
                        <p key={`${activeTab.id}-building-${index}`}>{paragraph}</p>
                      ))}
                    </div>
                  )}

                  {/* Les mer-lenker for tab */}
                  {activeTab.readMore && activeTab.readMore.length > 0 && (
                    <div className="mobile-tiltak-detail__links">
                      <span className="mobile-tiltak-detail__links-label">Les mer</span>
                      <ul>
                        {activeTab.readMore.map((link) => (
                          <li key={link.id ?? link.url}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mobile-tiltak-detail__link"
                            >
                              {link.label}
                              <PktIcon name="external-link" className="pkt-icon--small" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* Estimert besparelse - kun vis hvis det er en positiv besparelse */}
        {annualSavingsKwh && annualSavingsKwh > 0 && annualSavingsNok && annualSavingsNok > 0 && (
          <section className="mobile-tiltak-detail__section mobile-tiltak-detail__section--savings">
            <div className="mobile-tiltak-detail__savings">
              <span className="mobile-tiltak-detail__savings-label">Estimert besparelse:</span>
              <span className="mobile-tiltak-detail__savings-value">
                ~{formatNumberWithSpaces(annualSavingsNok)} kr / {formatNumberWithSpaces(annualSavingsKwh)} kWh
              </span>
              <button
                type="button"
                className="mobile-tiltak-detail__savings-info"
                onClick={() => setShowSourceTooltip(!showSourceTooltip)}
                aria-label="Vis kilde for beregning"
              >
                ?
              </button>
            </div>
            {showSourceTooltip && (
              <div className="mobile-tiltak-detail__savings-tooltip">
                <div className="mobile-tiltak-detail__savings-tooltip-header">
                  <strong>Kilde</strong>
                  <button
                    type="button"
                    className="mobile-tiltak-detail__savings-tooltip-close"
                    onClick={() => setShowSourceTooltip(false)}
                    aria-label="Lukk"
                  >
                    ×
                  </button>
                </div>
                <p>
                  {resolvedContent?.energySourceDescription ??
                    'Estimatet er basert på byggets energiforbruk og generelle antakelser om besparelse for denne typen tiltak. Faktisk besparelse kan variere avhengig av boligens tilstand, bruksmønster og strømpriser.'}
                </p>
                {savingsEconomicsNote && (
                  <>
                    <div className="mobile-tiltak-detail__savings-tooltip-subheader">
                      <strong>Om besparelsen</strong>
                    </div>
                    <p>{savingsEconomicsNote}</p>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* Spørsmål og svar (accordion) */}
        {generalAccordion.length > 0 && (
          <section className="mobile-tiltak-detail__section">
            <h2 className="mobile-tiltak-detail__section-title">Spørsmål og svar</h2>
            <PktAccordion className="mobile-tiltak-detail__accordion" name={`accordion-${tiltakId}`}>
              {generalAccordion.map((item) => (
                <PktAccordionItem
                  key={item.id}
                  id={`${tiltakId}-${item.id}`}
                  name={`accordion-${tiltakId}`}
                  title={item.title}
                  defaultOpen={false}
                >
                  <div className="mobile-tiltak-detail__text-stack">
                    {item.body.map((paragraph, index) => (
                      <p key={`${item.id}-body-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                  {item.links && item.links.length > 0 && (
                    <ul className="mobile-tiltak-detail__accordion-links">
                      {item.links.map((link) => (
                        <li key={link.id ?? link.url}>
                          <a href={link.url} target="_blank" rel="noreferrer">
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </PktAccordionItem>
              ))}
            </PktAccordion>
          </section>
        )}

        {/* Støtteordninger (accordion) */}
        <PktAccordion name="grants-accordion">
          <PktAccordionItem
            id="grants"
            name="grants-accordion"
            title="Støtteordninger"
            defaultOpen={false}
          >
            <p className="mobile-tiltak-detail__muted">
              Viser ordninger tilknyttet {resolvedContent.title}
            </p>
            <div className="mobile-tiltak-detail__grants">
              {displayedGrants.map((entry, index) => {
                const hasOverskrift = Boolean(entry.overskrift);
                const hasLink = Boolean(entry.lenke);
                return (
                  <div
                    key={`${entry.ordning}-${index}`}
                    className="mobile-tiltak-detail__grant"
                  >
                    <div className="mobile-tiltak-detail__grant-main">
                      <span className="mobile-tiltak-detail__grant-title">
                        {entry.ordning}
                      </span>
                    </div>
                    <div className="mobile-tiltak-detail__grant-meta">
                      {hasOverskrift && (
                        <span
                          className="mobile-tiltak-detail__grant-provider"
                          style={{ backgroundColor: getProviderColor(entry.overskrift) }}
                        >
                          {getOverskriftLabel(entry.overskrift)}
                        </span>
                      )}
                      {hasLink && (
                        <button
                          type="button"
                          className="mobile-tiltak-detail__grant-link"
                          onClick={() => openExternalLink(entry.lenke ?? undefined)}
                        >
                          Les mer
                          <PktIcon name="external-link" className="pkt-icon--small" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </PktAccordionItem>
        </PktAccordion>

        {/* Søknadsplikt (ekspandérbar seksjon - kun hvis tiltaket har søknadsplikt-data) */}
        {permitItem && (
          <PktAccordion name="permit-accordion">
            <PktAccordionItem
              id="permit-check"
              name="permit-accordion"
              title={permitItem.title}
              defaultOpen={false}
            >
                <div className="mobile-tiltak-detail__permit-content">
                  {/* Tiltaksspesifikk tekst */}
                  <div className="mobile-tiltak-detail__text-stack">
                    {permitItem.body.map((paragraph, index) => (
                      <p key={`permit-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                  {/* Tiltaksspesifikke lenker */}
                  {permitItem.links && permitItem.links.length > 0 && (
                    <div className="mobile-tiltak-detail__permit-links">
                      {permitItem.links.map((link) => (
                        <a
                          key={link.id ?? link.url}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mobile-tiltak-detail__permit-link"
                        >
                          {link.label}
                          <PktIcon name="external-link" className="pkt-icon--small" />
                        </a>
                      ))}
                    </div>
                  )}
                  {/* Highlight-boks fra glossary (hvis tilgjengelig) */}
                  {permitHighlightEntry && (
                    <div className="mobile-tiltak-detail__permit-highlight">
                      <h4>{permitHighlightEntry.term}</h4>
                      {permitHighlightEntry.definition.map((paragraph, index) => (
                        <p key={`permit-highlight-${index}`}>{paragraph}</p>
                      ))}
                    </div>
                  )}
                </div>
            </PktAccordionItem>
          </PktAccordion>
        )}

        {/* Les mer (generelle lenker) - nederst før CTA */}
        {readMore.length > 0 && (
          <section className="mobile-tiltak-detail__section">
            <h2 className="mobile-tiltak-detail__section-title">Les mer</h2>
            <ul className="mobile-tiltak-detail__link-list">
              {readMore.map((link) => (
                <li key={link.id ?? link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mobile-tiltak-detail__link"
                  >
                    {link.label}
                    <PktIcon name="external-link" className="pkt-icon--small" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA-knapper */}
        {callsToAction.length > 0 && (
          <section className="mobile-tiltak-detail__section mobile-tiltak-detail__section--cta">
            <div className="mobile-tiltak-detail__cta-group">
              {callsToAction.map((cta) => (
                <PktButton
                  key={cta.id ?? cta.url}
                  skin={cta.style === 'secondary' ? 'secondary' : 'primary'}
                  onClick={() => openExternalLink(cta.url)}
                  className="mobile-tiltak-detail__cta-button"
                >
                  {cta.label}
                </PktButton>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
