import React, { useMemo, useState, useCallback } from 'react';
import {
  PktButton,
  PktAccordion,
  PktAccordionItem,
  PktIcon,
} from '@oslokommune/punkt-react';
import { useTiltakContent, useContentDictionary } from '../../hooks/contentHooks';
import { applyTiltakVariant, normaliseBuildingTypeKey } from '../../utils/tiltakContent';
import type { ContentAudience } from '../../../content/schema-helpers';
import type { TiltakTabsSection } from '../../../content/tiltak/schema';
import type { ContentDictionary, BenefitDictionaryEntry } from '../../../content/dictionaries/schema';
import { useGrantAwareStotteordninger } from '../FigmaBlokk/components/Tiltak/useGrantAwareStotteordninger';
import { getOverskriftColor, openExternalLink } from '../FigmaBlokk/components/Tiltak/shared';
import { OsloLogo } from '../FigmaBlokk/components/OsloLogo';
import './MobileTiltakDetail.css';

/**
 * pkt-icon web component wrapper (identisk med desktop)
 * Bruker React.createElement for å unngå TypeScript-feil med custom elements
 */
type PunktIconProps = React.HTMLAttributes<HTMLElement> & {
  name?: string;
};
const PunktIcon: React.FC<PunktIconProps> = (props) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pkt-icon er et webcomponent uten typings
  React.createElement('pkt-icon' as any, props);

/**
 * Slå opp en fordel fra den sentrale ordboken basert på id
 */
function getBenefitFromDictionary(
  benefitId: string,
  dictionary?: ContentDictionary
): BenefitDictionaryEntry | null {
  if (!dictionary?.benefits) return null;
  return dictionary.benefits.find((b) => b.id === benefitId) ?? null;
}

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
 * Hent overskrift-etikett for støtteordninger
 */
const getOverskriftLabel = (overskrift?: string | null): string => {
  if (!overskrift) return 'Støtte';
  if (overskrift === 'Klima- og energifondet') return 'Oslo kommune';
  return overskrift;
};

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

  // Berik fordeler fra den sentrale ordboken
  // Tiltakets benefits-array inneholder id-referanser til ordboken
  const enrichedBenefits = useMemo(() => {
    const rawBenefits = resolvedContent?.benefits ?? [];
    return rawBenefits.map((benefit) => {
      // Slå opp i ordboken basert på id
      const dictionaryBenefit = getBenefitFromDictionary(benefit.id, dictionary);
      if (dictionaryBenefit) {
        // Bruk data fra ordboken, men la tiltaket overstyre hvis det har egne verdier
        return {
          id: benefit.id,
          title: benefit.title || dictionaryBenefit.title,
          description: benefit.description || dictionaryBenefit.description,
          icon: dictionaryBenefit.icon, // Ikon kommer alltid fra ordboken
        };
      }
      // Fallback til tiltakets egen data hvis ikke funnet i ordbok
      return {
        id: benefit.id,
        title: benefit.title,
        description: benefit.description,
        icon: undefined,
      };
    });
  }, [resolvedContent?.benefits, dictionary]);

  // Hent bygningsspesifikke paragrafer
  const buildingTypeParagraphs = useMemo(() => {
    if (!resolvedContent?.buildingTypeParagraphs) return [];
    return (
      resolvedContent.buildingTypeParagraphs[normalizedBuildingType] ??
      resolvedContent.buildingTypeParagraphs.default ??
      []
    );
  }, [resolvedContent?.buildingTypeParagraphs, normalizedBuildingType]);

  // Beregn årlig besparelse i kr
  const annualSavingsNok = useMemo(() => {
    if (!annualSavingsKwh) return null;
    return annualSavingsKwh * energyPricePerKwh;
  }, [annualSavingsKwh, energyPricePerKwh]);

  // Separer søknadsplikt fra generell accordion
  const { permitItem, generalAccordion } = useMemo(() => {
    const baseAccordion = resolvedContent?.accordion ?? [];
    const permit = baseAccordion.find((item) => item.id === 'soknadsplikt');
    if (!permit) {
      return { permitItem: null, generalAccordion: baseAccordion };
    }
    return {
      permitItem: permit,
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

  // Hent støtteordninger
  const { stotteordninger, isLoading: grantsLoading } = useGrantAwareStotteordninger({
    grantIds: resolvedContent?.grants ?? [],
    legacyTiltakSlug: tiltakId,
    buildingType,
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
          {/* Fordels-chips - identisk struktur som desktop */}
          {enrichedBenefits.length > 0 && (
            <div className="mobile-tiltak-detail__benefit-chips">
              {enrichedBenefits.slice(0, 4).map((benefit) => (
                <div
                  key={`benefit-chip-${benefit.id}`}
                  className="mobile-tiltak-detail__benefit-chip"
                  title={benefit.description ?? undefined}
                >
                  {benefit.icon && (
                    <span className="mobile-tiltak-detail__benefit-chip-icon" aria-hidden="true">
                      <PunktIcon name={benefit.icon} />
                    </span>
                  )}
                  <span className="mobile-tiltak-detail__benefit-chip-title">
                    {benefit.title}
                  </span>
                </div>
              ))}
            </div>
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
                  Estimatet er basert på byggets energiforbruk og generelle antakelser om
                  besparelse for denne typen tiltak. Faktisk besparelse kan variere avhengig
                  av boligens tilstand, bruksmønster og strømpriser.
                </p>
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
                          style={{ backgroundColor: getOverskriftColor(entry.overskrift) }}
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
              title="Sjekk om du må søke for å gjennomføre tiltaket"
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
                  {/* Generisk "Søknadsplikt er ikke en stopper"-boks */}
                  <div className="mobile-tiltak-detail__permit-highlight">
                    <h4>Søknadsplikt er ikke en stopper, men en støtte</h4>
                    <p>
                      Er tiltaket ditt søknadspliktig, betyr ikke det at du får avslag. Tvert imot!
                      Søknadsplikten skal sikre at arbeidet planlegges og gjennomføres med god kvalitet
                      – både i papirene og på bygget. Målet er at du som tiltakshaver får det resultatet
                      du ønsker deg, på en trygg og effektiv måte.
                    </p>
                  </div>
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
