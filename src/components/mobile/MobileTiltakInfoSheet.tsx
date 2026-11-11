import React, { useMemo, useState } from 'react';
import { useTiltakContent, useContentDictionary } from '../../hooks/contentHooks';
import { applyTiltakVariant, normaliseBuildingTypeKey } from '../../utils/tiltakContent';
import { resolveTiltakBenefits } from '../../utils/benefitUtils';
import type { ContentAudience } from '../../../content/schema-helpers';
import { useGrantAwareStotteordninger } from '../FigmaBlokk/components/Tiltak/useGrantAwareStotteordninger';
import { useProviderColors, getOverskriftLabel } from '../FigmaBlokk/components/Tiltak/shared';
import { trackExternalLinkClick } from '../../analytics';
import { BenefitChipList } from '../common/BenefitChip';
import { MobileSheet, MobileSheetCloseButton } from './MobileSheet';
import { TiltakIcon } from './TiltakIcon';
import './MobileTiltakInfoSheet.css';

interface MobileTiltakInfoSheetProps {
  tiltakId: string;
  /** Tittel fra flisa (inkluderer valgt type). Faller tilbake til tittelen i innholdet. */
  title?: string;
  buildingType?: string;
  /** Bygningstypen slik den vises for brukeren, f.eks. «småhus» */
  buildingTypeLabel?: string;
  audience?: ContentAudience;
  /** F.eks. «Estimert besparelse ~9 000 kr/år» eller «Gjort fra før» */
  savingsLabel?: string | null;
  doneLabel: string;
  toggleLabel: string;
  onToggleDone: () => void;
  onToggle: () => void;
  onClose: () => void;
}

const DEFAULT_SOURCE_DESCRIPTION =
  'Estimatet er basert på byggets energiforbruk og generelle antakelser om besparelse for denne typen tiltak. Faktisk besparelse kan variere avhengig av boligens tilstand, bruksmønster og strømpriser.';

const ExternalArrow: React.FC = () => (
  <svg className="mobile-info-sheet__external" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M8 5 H19 V16 M19 5 L5 19" />
  </svg>
);

const ExternalLink: React.FC<{ url: string; label: string }> = ({ url, label }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="mobile-info-sheet__text-link"
    onClick={() => trackExternalLinkClick(url, 'mobil-tiltak')}
  >
    {label}
  </a>
);

/**
 * Infoark for ett tiltak. Tilskuddsordningene ligger øverst, deretter
 * «Om tiltaket» med fordels-chips, brødtekst og utvidbare rader for resten
 * av tiltakskortet. Valgknappene ligger fast i bunnen.
 */
export const MobileTiltakInfoSheet: React.FC<MobileTiltakInfoSheetProps> = ({
  tiltakId,
  title,
  buildingType,
  buildingTypeLabel,
  audience = 'standard',
  savingsLabel,
  doneLabel,
  toggleLabel,
  onToggleDone,
  onToggle,
  onClose,
}) => {
  const { data, isLoading, error } = useTiltakContent(tiltakId);
  const { data: dictionary } = useContentDictionary();
  const getProviderColor = useProviderColors();

  const resolvedContent = useMemo(() => applyTiltakVariant(data, audience), [data, audience]);
  const normalizedBuildingType = useMemo(() => normaliseBuildingTypeKey(buildingType), [buildingType]);

  // Én rad åpen om gangen
  const [openRow, setOpenRow] = useState<string | null>(null);
  // Aktiv fane per faneseksjon
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});

  // Fordeler slås opp i dictionary, med samme regler som resten av appen
  const benefits = useMemo(
    () => resolveTiltakBenefits(resolvedContent, dictionary, 4),
    [resolvedContent, dictionary],
  );

  // Tilskudd filtreres på tiltak, bygningstype og gul liste (som i dag)
  const { stotteordninger, isLoading: grantsLoading } = useGrantAwareStotteordninger({
    tiltakId,
    buildingType,
    audience,
  });

  const introParagraphs = resolvedContent?.introParagraphs ?? [];
  const buildingTypeParagraphs = useMemo(() => {
    if (!resolvedContent?.buildingTypeParagraphs) return [];
    return (
      resolvedContent.buildingTypeParagraphs[normalizedBuildingType] ??
      resolvedContent.buildingTypeParagraphs.default ??
      []
    );
  }, [resolvedContent?.buildingTypeParagraphs, normalizedBuildingType]);

  const tabSections = useMemo(
    () => (resolvedContent?.tabs ?? []).filter((section) => section.tabs && section.tabs.length > 0),
    [resolvedContent],
  );

  // Søknadsplikt skilles ut fra øvrige spørsmål og svar
  const { permitItem, generalAccordion } = useMemo(() => {
    const accordion = resolvedContent?.accordion ?? [];
    const permit = accordion.find((item) => item.id === 'soknadsplikt') ?? null;
    return {
      permitItem: permit,
      generalAccordion: permit ? accordion.filter((item) => item !== permit) : accordion,
    };
  }, [resolvedContent?.accordion]);
  const permitHighlight = permitItem?.glossary?.[0] ?? null;

  const readMore = resolvedContent?.readMore ?? [];
  const callsToAction = resolvedContent?.callsToAction ?? [];

  const savingsEconomicsNote =
    tiltakId === 'solenergi' && normalizedBuildingType !== 'blokk'
      ? resolvedContent?.savingsEconomicsNote?.smaahus
      : undefined;

  const sheetTitle = title ?? resolvedContent?.title ?? 'Tiltak';

  const renderRow = (key: string, rowTitle: string, content: React.ReactNode) => {
    const isOpen = openRow === key;
    return (
      <li key={key} className="mobile-info-sheet__row">
        <button
          type="button"
          className="mobile-info-sheet__row-button"
          aria-expanded={isOpen}
          onClick={() => setOpenRow(isOpen ? null : key)}
        >
          <span>{rowTitle}</span>
          <svg
            className={`mobile-info-sheet__row-chevron${isOpen ? ' mobile-info-sheet__row-chevron--open' : ''}`}
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <path d="M4 9 L12 16 L20 9" />
          </svg>
        </button>
        {isOpen && <div className="mobile-info-sheet__row-body">{content}</div>}
      </li>
    );
  };

  const grantsHeadingCount = grantsLoading
    ? ''
    : `${stotteordninger.length} ${stotteordninger.length === 1 ? 'ordning' : 'ordninger'}`;

  return (
    <MobileSheet label={sheetTitle} onClose={onClose} size="full" className="mobile-info-sheet">
      <div className="mobile-info-sheet__header">
        <div className="mobile-info-sheet__header-main">
          <TiltakIcon tiltakId={tiltakId} size={32} strokeWidth={1.4} />
          <div className="mobile-info-sheet__header-text">
            <h2 className="mobile-info-sheet__title">{sheetTitle}</h2>
            {savingsLabel && <span className="mobile-info-sheet__savings">{savingsLabel}</span>}
          </div>
        </div>
        <MobileSheetCloseButton onClick={onClose} />
      </div>

      <div className="mobile-info-sheet__scroll">
        {/* Tilskudd – det viktigste, derfor øverst */}
        <div className="mobile-info-sheet__section-head">
          <h3 className="mobile-info-sheet__section-title">Tilskudd du kan søke på</h3>
          {stotteordninger.length > 0 && (
            <span className="mobile-info-sheet__count">{grantsHeadingCount}</span>
          )}
        </div>
        {stotteordninger.length > 0 ? (
          <>
            <ul className="mobile-info-sheet__grants">
              {stotteordninger.map((grant, index) => {
                const cardContent = (
                  <>
                    <span className="mobile-info-sheet__grant-text">
                      {grant.overskrift && (
                        <span className="mobile-info-sheet__grant-provider">
                          {getOverskriftLabel(grant.overskrift)}
                        </span>
                      )}
                      <span className="mobile-info-sheet__grant-title">{grant.ordning}</span>
                      {grant.belop && (
                        <span className="mobile-info-sheet__grant-amount">{grant.belop}</span>
                      )}
                    </span>
                    {grant.lenke && <ExternalArrow />}
                  </>
                );
                const style = { backgroundColor: getProviderColor(grant.overskrift) };
                return (
                  <li key={`${grant.ordning}-${index}`}>
                    {grant.lenke ? (
                      <a
                        href={grant.lenke}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mobile-info-sheet__grant"
                        style={style}
                        onClick={() => trackExternalLinkClick(grant.lenke ?? '', 'mobil-tilskudd')}
                      >
                        {cardContent}
                      </a>
                    ) : (
                      <div className="mobile-info-sheet__grant" style={style}>
                        {cardContent}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mobile-info-sheet__muted">
              {buildingTypeLabel ? `Viser ordninger som gjelder ${buildingTypeLabel}. ` : ''}
              Trykk på en ordning for å gå til søknaden.
            </p>
          </>
        ) : (
          <p className="mobile-info-sheet__muted">
            {grantsLoading ? 'Henter tilskuddsordninger …' : 'Ingen registrerte tilskuddsordninger for dette tiltaket ennå.'}
          </p>
        )}

        {/* Om tiltaket – fordels-chips rett under overskriften, før brødteksten */}
        <h3 className="mobile-info-sheet__section-title mobile-info-sheet__section-title--spaced">
          Om tiltaket
        </h3>
        {isLoading && <p className="mobile-info-sheet__muted">Laster innhold …</p>}
        {!isLoading && (error || !resolvedContent) && (
          <p className="mobile-info-sheet__muted">
            Kunne ikke hente innhold om tiltaket.
            {error instanceof Error ? ` ${error.message}` : ''}
          </p>
        )}
        {resolvedContent && (
          <>
            {benefits.length > 0 && <BenefitChipList benefits={benefits} maxItems={4} />}
            {[...introParagraphs, ...buildingTypeParagraphs].map((paragraph, index) => (
              <p key={`intro-${index}`} className="mobile-info-sheet__paragraph">
                {paragraph}
              </p>
            ))}

            <ul className="mobile-info-sheet__rows">
              {tabSections.map((section, sectionIndex) => {
                const sectionKey = `tabs-${sectionIndex}`;
                const activeId = activeTabs[sectionKey] ?? section.tabs[0]?.id;
                const activeTab = section.tabs.find((tab) => tab.id === activeId) ?? section.tabs[0];
                const tabBuildingParagraphs =
                  activeTab?.buildingTypeBody &&
                  (activeTab.buildingTypeBody[normalizedBuildingType] ??
                    activeTab.buildingTypeBody.default ??
                    null);
                return renderRow(
                  sectionKey,
                  section.title ?? 'Detaljer',
                  <>
                    {section.description && <p>{section.description}</p>}
                    <div className="mobile-info-sheet__tabs" role="tablist">
                      {section.tabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={tab.id === activeTab?.id}
                          className={`mobile-info-sheet__tab${tab.id === activeTab?.id ? ' mobile-info-sheet__tab--active' : ''}`}
                          onClick={() =>
                            setActiveTabs((current) => ({ ...current, [sectionKey]: tab.id }))
                          }
                        >
                          {tab.title}
                        </button>
                      ))}
                    </div>
                    {activeTab && (
                      <div role="tabpanel" className="mobile-info-sheet__stack">
                        {activeTab.summary && (
                          <p className="mobile-info-sheet__muted">{activeTab.summary}</p>
                        )}
                        {activeTab.body.map((paragraph, index) => (
                          <p key={`${activeTab.id}-${index}`}>{paragraph}</p>
                        ))}
                        {tabBuildingParagraphs?.map((paragraph, index) => (
                          <p key={`${activeTab.id}-building-${index}`}>{paragraph}</p>
                        ))}
                        {activeTab.readMore && activeTab.readMore.length > 0 && (
                          <ul className="mobile-info-sheet__links">
                            {activeTab.readMore.map((link) => (
                              <li key={link.id ?? link.url}>
                                <ExternalLink url={link.url} label={link.label} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>,
                );
              })}

              {generalAccordion.map((item) =>
                renderRow(
                  `accordion-${item.id}`,
                  item.title,
                  <div className="mobile-info-sheet__stack">
                    {item.body.map((paragraph, index) => (
                      <p key={`${item.id}-${index}`}>{paragraph}</p>
                    ))}
                    {item.links && item.links.length > 0 && (
                      <ul className="mobile-info-sheet__links">
                        {item.links.map((link) => (
                          <li key={link.id ?? link.url}>
                            <ExternalLink url={link.url} label={link.label} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>,
                ),
              )}

              {permitItem &&
                renderRow(
                  'permit',
                  permitItem.title,
                  <div className="mobile-info-sheet__stack">
                    {permitItem.body.map((paragraph, index) => (
                      <p key={`permit-${index}`}>{paragraph}</p>
                    ))}
                    {permitItem.links && permitItem.links.length > 0 && (
                      <ul className="mobile-info-sheet__links">
                        {permitItem.links.map((link) => (
                          <li key={link.id ?? link.url}>
                            <ExternalLink url={link.url} label={link.label} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {permitHighlight && (
                      <div className="mobile-info-sheet__highlight">
                        <h4>{permitHighlight.term}</h4>
                        {permitHighlight.definition.map((paragraph, index) => (
                          <p key={`permit-highlight-${index}`}>{paragraph}</p>
                        ))}
                      </div>
                    )}
                  </div>,
                )}

              {(readMore.length > 0 || callsToAction.length > 0) &&
                renderRow(
                  'read-more',
                  'Les mer',
                  <ul className="mobile-info-sheet__links">
                    {readMore.map((link) => (
                      <li key={link.id ?? link.url}>
                        <ExternalLink url={link.url} label={link.label} />
                      </li>
                    ))}
                    {callsToAction.map((cta) => (
                      <li key={cta.id ?? cta.url}>
                        <ExternalLink url={cta.url} label={cta.label} />
                      </li>
                    ))}
                  </ul>,
                )}

              {renderRow(
                'source',
                'Slik er besparelsen beregnet',
                <div className="mobile-info-sheet__stack">
                  <p>{resolvedContent.energySourceDescription ?? DEFAULT_SOURCE_DESCRIPTION}</p>
                  {savingsEconomicsNote && <p>{savingsEconomicsNote}</p>}
                </div>,
              )}
            </ul>
          </>
        )}
      </div>

      <div className="mobile-info-sheet__footer">
        <button type="button" className="mobile-info-sheet__button" onClick={onToggleDone}>
          {doneLabel}
        </button>
        <button
          type="button"
          className="mobile-info-sheet__button mobile-info-sheet__button--primary"
          onClick={onToggle}
        >
          {toggleLabel}
        </button>
      </div>
    </MobileSheet>
  );
};
