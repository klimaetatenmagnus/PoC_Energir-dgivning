import React, { useEffect, useMemo, useState } from "react";
import {
  PktAccordion,
  PktAccordionItem,
  PktAlert,
  PktButton,
  PktTag,
} from "@oslokommune/punkt-react";
import type { ContentAudience } from "../../../../../content/schema-helpers";
import type {
  TiltakCallToAction,
  TiltakContent,
  TiltakTabsSection,
} from "../../../../../content/tiltak/schema";
import { useTiltakContent, useContentDictionary } from "../../../../hooks/contentHooks";
import {
  applyTiltakVariant,
  normaliseBuildingTypeKey,
} from "../../../../utils/tiltakContent";
import type { TiltakComponentProps } from "./shared";
import { getOverskriftColor, openExternalLink } from "./shared";
import { renderParagraphWithGlossary, dictionaryTermsToGlossary, type GlossaryEntry } from "./glossaryHelpers";
import { useGrantAwareStotteordninger } from "./useGrantAwareStotteordninger";
import "./TiltakCardRenderer.css";

type TiltakCardRendererProps = TiltakComponentProps & {
  slug: string;
  audience?: ContentAudience;
  className?: string;
};

type BenefitEntry = {
  title: string;
  description?: string;
  icon?: string;
};

type TabState = Record<string, string | null>;

type ParagraphRenderOptions = {
  className?: string;
  keyPrefix?: string;
  glossary?: GlossaryEntry[];
  hoveredTerm?: string | null;
  setHoveredTerm?: (term: string | null) => void;
};

type CtaVariant =
  | "label-only"
  | "icon-left"
  | "icon-right"
  | "icon-only"
  | "icons-right-and-left";

type CtaStyleProps = {
  skin?: "primary" | "secondary";
  variant?: CtaVariant;
};

type PunktIconProps = React.HTMLAttributes<HTMLElement> & {
  name?: string;
  size?: string;
  skin?: string;
};

const PunktIcon: React.FC<PunktIconProps> = (props) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pkt-icon er et webcomponent uten typings
  React.createElement("pkt-icon" as any, props);

const ExternalLinkGlyph: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path
      d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z"
      fill="#2A2859"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z"
      fill="#2A2859"
    />
  </svg>
);

const AUDIENCE_LABELS: Record<ContentAudience, string> = {
  standard: "Standard",
  gulliste: "Gulliste",
};

const CTA_STYLE_TO_PROPS: Record<TiltakCallToAction["style"], CtaStyleProps> = {
  primary: { skin: "primary" },
  secondary: { skin: "secondary" },
  link: { skin: "primary", variant: "label-only" },
};

function resolveBenefits(content?: TiltakContent): BenefitEntry[] {
  if (!content) {
    return [];
  }
  return content.benefits.map(({ title, description, icon }) => ({
    title,
    description,
    icon,
  }));
}

function renderParagraphs(
  paragraphs: string[],
  options: ParagraphRenderOptions = {}
) {
  const {
    className,
    keyPrefix,
    glossary,
    hoveredTerm,
    setHoveredTerm,
  } = options;
  const hasGlossary = Boolean(glossary?.length && setHoveredTerm);

  return paragraphs.map((paragraph, index) => {
    const content = hasGlossary
      ? renderParagraphWithGlossary({
          paragraph,
          glossary: glossary ?? [],
          hoveredTerm: hoveredTerm ?? null,
          setHoveredTerm: setHoveredTerm!,
        })
      : paragraph;

    return (
      <p
        key={`${keyPrefix ?? "paragraph"}-${index}`}
        className={className ?? "tiltak-card__paragraph"}
      >
        {content}
      </p>
    );
  });
}

function getTabSectionKey(section: TiltakTabsSection, index: number): string {
  return `${section.title ?? "tabs"}-${index}`;
}

function getBuildingLabel(buildingType?: string | null): string {
  if (!buildingType || buildingType === "default") {
    return "Alle byggtyper";
  }
  return buildingType;
}

function getOverskriftLabel(overskrift?: string | null): string {
  if (!overskrift) {
    return "Støtte";
  }
  if (overskrift === "Klima- og energifondet") {
    return "Oslo kommune";
  }
  return overskrift;
}

export const TiltakCardRenderer: React.FC<TiltakCardRendererProps> = ({
  slug,
  audience = "standard",
  buildingType,
  onBack,
  className,
}) => {
  const { data, isLoading, error } = useTiltakContent(slug);
  const { data: dictionary } = useContentDictionary();
  const resolvedContent = useMemo(
    () => applyTiltakVariant(data, audience),
    [data, audience]
  );

  const glossaryEntries = useMemo(
    () => dictionaryTermsToGlossary(dictionary?.glossaryTerms ?? []),
    [dictionary?.glossaryTerms]
  );

  const introParagraphs = resolvedContent?.introParagraphs ?? [];
  const benefits = resolveBenefits(resolvedContent);
  const readMore = resolvedContent?.readMore ?? [];
  const callsToAction = resolvedContent?.callsToAction ?? [];
  const { permitItem, generalAccordion } = useMemo(() => {
    const baseAccordion = resolvedContent?.accordion ?? [];
    const permit = baseAccordion.find((item) => item.id === "soknadsplikt");
    if (!permit) {
      return { permitItem: null, generalAccordion: baseAccordion };
    }
    return {
      permitItem: permit,
      generalAccordion: baseAccordion.filter((item) => item !== permit),
    };
  }, [resolvedContent?.accordion]);
  const permitHighlightEntry =
    glossaryEntries.length > 0 ? glossaryEntries[0] : null;
  const stats = resolvedContent?.stats ?? [];
  const customSections = resolvedContent?.customSections ?? [];
  const supportTags = resolvedContent?.supportTags ?? [];
  const tabSections = useMemo(
    () =>
      (resolvedContent?.tabs ?? []).filter(
        (section) => section.tabs && section.tabs.length > 0
      ),
    [resolvedContent]
  );

  const [tabState, setTabState] = useState<TabState>({});
  const [hoveredGlossaryTerm, setHoveredGlossaryTerm] = useState<
    string | null
  >(null);
  const [isPermitOpen, setIsPermitOpen] = useState(false);
  useEffect(() => {
    setTabState((previous) => {
      const next: TabState = {};
      tabSections.forEach((section, index) => {
        const key = getTabSectionKey(section, index);
        const fallback = section.tabs[0]?.id ?? null;
        const previousValue = previous[key];
        next[key] =
          previousValue &&
          section.tabs.some((entry) => entry.id === previousValue)
            ? previousValue
            : fallback;
      });
      return next;
    });
  }, [tabSections]);

  const normalizedBuildingType = useMemo(
    () => normaliseBuildingTypeKey(buildingType),
    [buildingType]
  );

  const { stotteordninger, isLoading: grantsLoading, intendedSource } =
    useGrantAwareStotteordninger({
      grantIds: resolvedContent?.grants ?? [],
      legacyTiltakSlug: slug,
      buildingType,
    });

  const hasRegisteredGrants = stotteordninger.length > 0;
  const displayedGrants = hasRegisteredGrants
    ? stotteordninger
    : [
        {
          ordning: grantsLoading
            ? "Henter støtteordninger …"
            : "Ingen registrerte støtteordninger ennå",
          lenke: null,
          belop: null,
          overskrift: null,
        },
      ];
  const shouldScrollGrants = displayedGrants.length > 4;
  const primaryReadMoreLinks = readMore.slice(0, 3);
  const showReadMoreRing = primaryReadMoreLinks.length > 0;

  if (isLoading) {
    return (
      <div className="tiltak-card__shell">
        <PktAlert skin="info" title="Laster innhold …" ariaLive="polite">
          Henter tiltaket {slug} fra content-endepunktet.
        </PktAlert>
      </div>
    );
  }

  if (error || !resolvedContent) {
    return (
      <div className="tiltak-card__shell">
        <PktAlert
          skin="error"
          title="Kunne ikke hente innhold"
          ariaLive="assertive"
        >
          {error instanceof Error
            ? error.message
            : "Ingen innhold funnet for tiltaket."}
        </PktAlert>
      </div>
    );
  }

  const [highlightStat, ...secondaryStats] = stats;
  const showAside = benefits.length > 0 || Boolean(highlightStat);
  const buildingLabel = getBuildingLabel(buildingType);
  const heroClassName = [
    "tiltak-card__hero",
    showAside ? "" : "tiltak-card__hero--single",
  ]
    .filter(Boolean)
    .join(" ");
  const articleClassName = ["tiltak-card", className].filter(Boolean).join(" ");
  const grantTableBodyClassName = [
    "tiltak-card__grants-table-body",
    shouldScrollGrants ? "has-scroll" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleTabSelect = (sectionKey: string, tabId: string) => {
    setTabState((current) => ({
      ...current,
      [sectionKey]: tabId,
    }));
  };

  return (
    <div className="tiltak-card__frame">
      <article className={articleClassName}>
      <header className="tiltak-card__header">
        <div>
          <p className="tiltak-card__eyebrow">Tiltak</p>
          <h2 className="tiltak-card__title">{resolvedContent.title}</h2>
          <div className="tiltak-card__tag-row">
            <PktTag skin={audience === "gulliste" ? "yellow" : "blue"}>
              {AUDIENCE_LABELS[audience] ?? audience}
            </PktTag>
            <PktTag skin="gray">
              {buildingLabel}
            </PktTag>
            {supportTags.map((tag) => (
              <PktTag key={tag} skin="gray">
                {tag}
              </PktTag>
            ))}
          </div>
        </div>
        {(onBack || callsToAction.length > 0) && (
          <div className="tiltak-card__header-actions">
            {onBack && (
              <button
                type="button"
                className="tiltak-card__back-button"
                onClick={onBack}
                aria-label="Tilbake til liste"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M13.707 16l6.147-6.146-1.414-1.414L10.879 16l7.561 7.56 1.414-1.414L13.707 16z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            )}
            {callsToAction.length > 0 && (
              <div className="tiltak-card__cta-group">
                {callsToAction.map((cta) => {
                  const props =
                    CTA_STYLE_TO_PROPS[cta.style ?? "primary"] ??
                    CTA_STYLE_TO_PROPS.primary;
                  return (
                    <PktButton
                      key={cta.id ?? cta.url}
                      size="small"
                      skin={props.skin}
                      variant={props.variant}
                      onClick={() => openExternalLink(cta.url)}
                    >
                      {cta.label}
                    </PktButton>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </header>

      <div className={heroClassName}>
        <div className="tiltak-card__hero-main">
          <div className="tiltak-card__text-stack tiltak-card__text-stack--hero">
            {renderParagraphs(introParagraphs, { keyPrefix: "intro" })}
          </div>
          {showReadMoreRing && (
            <div className="tiltak-card__readmore-ring">
              <p className="tiltak-card__readmore-heading">Les mer</p>
              <ul>
                {primaryReadMoreLinks.map((link) => (
                  <li key={link.id ?? link.url}>
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {showAside && (
          <aside className="tiltak-card__hero-aside">
            {benefits.length > 0 && (
              <div className="tiltak-card__benefits">
                <p className="tiltak-card__benefit-heading">Fordeler</p>
                <div className="tiltak-card__benefit-list">
                  {benefits.map((benefit, index) => (
                    <div
                      key={`${benefit.title}-${index}`}
                      className="tiltak-card__benefit-chip"
                      title={benefit.description ?? undefined}
                    >
                      {benefit.icon && (
                        <span
                          className="tiltak-card__benefit-icon"
                          aria-hidden="true"
                        >
                          <PunktIcon name={benefit.icon} aria-hidden="true" />
                        </span>
                      )}
                      <span className="tiltak-card__benefit-chip-title">
                        {benefit.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {highlightStat && (
              <div className="tiltak-card__stat-card">
                <p className="tiltak-card__stat-card-label">
                  {highlightStat.title}
                </p>
                {highlightStat.description &&
                  renderParagraphs(highlightStat.description, {
                    className: "tiltak-card__stat-card-text",
                    keyPrefix: `${highlightStat.id}-description`,
                  })}
                <div className="tiltak-card__stat-data">
                  {highlightStat.dataPoints.map((dataPoint, index) => (
                    <div
                      key={`${highlightStat.id}-${dataPoint.label}-${index}`}
                      className="tiltak-card__stat-data-row"
                    >
                      <span>{dataPoint.label}</span>
                      <span>
                        {dataPoint.value}
                        {dataPoint.unit ? ` ${dataPoint.unit}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {tabSections.length > 0 && (
        <section className="tiltak-card__section">
          {tabSections.map((section, index) => {
            const sectionKey = getTabSectionKey(section, index);
            const activeId =
              tabState[sectionKey] ?? section.tabs[0]?.id ?? null;
            const activeTab =
              section.tabs.find((tab) => tab.id === activeId) ??
              section.tabs[0];
            const tabBuildingParagraphs =
              activeTab?.buildingTypeBody &&
              (activeTab.buildingTypeBody[normalizedBuildingType] ??
                activeTab.buildingTypeBody.default ??
                null);
            return (
              <div key={sectionKey} className="tiltak-card__tab-section">
                <div className="tiltak-card__section-heading">
                  <div>
                    <h3>{section.title ?? "Detaljer"}</h3>
                    {section.description && (
                      <p className="tiltak-card__muted">
                        {section.description}
                      </p>
                    )}
                  </div>
                  <div
                    className="tiltak-card__tablist"
                    role="tablist"
                    aria-label={section.title ?? "Detaljer"}
                  >
                    {section.tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`tiltak-card__tab-trigger${
                          tab.id === activeId ? " is-active" : ""
                        }`}
                        role="tab"
                        aria-selected={tab.id === activeId}
                        onClick={() => handleTabSelect(sectionKey, tab.id)}
                      >
                        {tab.title}
                      </button>
                    ))}
                  </div>
                </div>
                {activeTab && (
                  <div
                    className="tiltak-card__tabpanel"
                    role="tabpanel"
                    id={`tab-${sectionKey}-${activeTab.id}`}
                  >
                    {activeTab.summary && (
                      <p className="tiltak-card__muted">{activeTab.summary}</p>
                    )}
                    <div className="tiltak-card__text-stack">
                      {renderParagraphs(activeTab.body, {
                        keyPrefix: `${activeTab.id}-body`,
                      })}
                    </div>
                    {tabBuildingParagraphs && tabBuildingParagraphs.length > 0 && (
                      <div className="tiltak-card__text-stack tiltak-card__text-stack--secondary">
                        <p className="tiltak-card__muted">
                          Tilpasset {buildingLabel.toLowerCase()}
                        </p>
                        {renderParagraphs(tabBuildingParagraphs, {
                          keyPrefix: `${activeTab.id}-building`,
                        })}
                      </div>
                    )}
                    {activeTab.readMore.length > 0 && (
                      <div className="tiltak-card__link-list">
                        <p className="tiltak-card__eyebrow">Les mer</p>
                        <ul>
                          {activeTab.readMore.map((link) => (
                            <li key={link.id ?? link.url}>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {link.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {secondaryStats.length > 0 && (
        <section className="tiltak-card__section">
          <h3>Nøkkeltall</h3>
          <div className="tiltak-card__stats-grid">
            {secondaryStats.map((stat) => (
              <div key={stat.id} className="tiltak-card__stat">
                <p className="tiltak-card__stat-title">{stat.title}</p>
                {stat.description &&
                  renderParagraphs(stat.description, {
                    keyPrefix: `${stat.id}-description`,
                  })}
                <div className="tiltak-card__stat-points">
                  {stat.dataPoints.map((point, index) => (
                    <div
                      key={`${stat.id}-${point.label}-${index}`}
                      className="tiltak-card__datapoint"
                    >
                      <dt>{point.label}</dt>
                      <dd>
                        {point.value}
                        {point.unit ? ` ${point.unit}` : ""}
                      </dd>
                      {point.helpText && (
                        <p className="tiltak-card__muted">{point.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {generalAccordion.length > 0 && (
        <section className="tiltak-card__section">
          <h3>Spørsmål og svar</h3>
          <PktAccordion className="tiltak-card__accordion" name={`accordion-${slug}`}>
            {generalAccordion.map((item) => (
              <PktAccordionItem
                key={item.id}
                id={`${slug}-${item.id}`}
                name={`accordion-${slug}`}
                title={item.title}
                defaultOpen={false}
              >
                <div className="tiltak-card__text-stack">
                  {renderParagraphs(item.body, {
                    keyPrefix: `${item.id}-body`,
                    glossary: item.glossary,
                    hoveredTerm: hoveredGlossaryTerm,
                    setHoveredTerm: setHoveredGlossaryTerm,
                  })}
                </div>
                {item.links.length > 0 && (
                  <ul className="tiltak-card__list">
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

      {customSections.length > 0 && (
        <section className="tiltak-card__section">
          <h3>Flere detaljer</h3>
          <div className="tiltak-card__custom-grid">
            {customSections.map((section) => (
              <article key={section.id} className="tiltak-card__custom-card">
                <div className="tiltak-card__custom-card-head">
                  <h4>{section.title}</h4>
                  {section.description && (
                    <p className="tiltak-card__muted">{section.description}</p>
                  )}
                </div>
                <div className="tiltak-card__custom-blocks">
                  {section.blocks.map((block, index) => (
                    <div
                      key={`${section.id}-${block.id ?? index}`}
                      className="tiltak-card__custom-block"
                    >
                      {block.icon && (
                        <span className="tiltak-card__block-icon">
                          {block.icon}
                        </span>
                      )}
                      {block.title && <h5>{block.title}</h5>}
                      <div className="tiltak-card__text-stack">
                        {renderParagraphs(block.body, {
                          keyPrefix: `${section.id}-${block.id ?? index}`,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="tiltak-card__section">
        <div className="tiltak-card__section-heading">
          <div>
            <h3>Støtteordninger</h3>
            <p className="tiltak-card__muted">
              Viser ordninger tilknyttet {resolvedContent.title}
            </p>
          </div>
          <PktTag skin="gray">
            {grantsLoading
              ? "Laster …"
              : intendedSource === "grants"
              ? "Fra grants[]"
              : "Fra legacy"}
          </PktTag>
        </div>
        <div className="tiltak-card__grants-table">
          <div className="tiltak-card__grants-table-head">
            <span>Relevante støtteordninger</span>
            <span>Søk til</span>
            <span>Les mer</span>
          </div>
          <div className={grantTableBodyClassName} role="list">
            {displayedGrants.map((entry, index) => {
              const hasOverskrift = Boolean(entry.overskrift);
              const hasLink = Boolean(entry.lenke);
              return (
                <div
                  key={`${entry.ordning}-${index}`}
                  className="tiltak-card__grant-row"
                  role="listitem"
                >
                  <div className="tiltak-card__grant-cell tiltak-card__grant-cell--title">
                    <span className="tiltak-card__grant-title-text">
                      {entry.ordning}
                    </span>
                    {entry.belop && (
                      <span className="tiltak-card__grant-amount">
                        {entry.belop}
                      </span>
                    )}
                  </div>
                  <div className="tiltak-card__grant-cell tiltak-card__grant-cell--provider">
                    {hasOverskrift ? (
                      <span
                        className="tiltak-card__grant-provider-badge"
                        style={{
                          backgroundColor: getOverskriftColor(entry.overskrift),
                        }}
                      >
                        {getOverskriftLabel(entry.overskrift)}
                      </span>
                    ) : (
                      <span className="tiltak-card__grant-provider-badge is-empty">
                        —
                      </span>
                    )}
                  </div>
                  <div className="tiltak-card__grant-cell tiltak-card__grant-cell--link">
                    {hasLink ? (
                      <button
                        type="button"
                        className="tiltak-card__grant-link"
                        onClick={() => openExternalLink(entry.lenke ?? undefined)}
                      >
                        Lenke
                      </button>
                    ) : (
                      <span className="tiltak-card__grant-link is-disabled">
                        Ingen lenke
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {permitItem && (
        <section className="tiltak-card__permit-section">
          <button
            type="button"
            className={`tiltak-card__permit-trigger${
              isPermitOpen ? " is-open" : ""
            }`}
            onClick={() => setIsPermitOpen((previous) => !previous)}
            aria-expanded={isPermitOpen}
          >
            Sjekk om du må søke for å gjennomføre tiltaket
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M10 12.5L5.5 8l1.06-1.06L10 10.38l3.44-3.44L14.5 8z"
                fill="currentColor"
              />
            </svg>
          </button>
          <div
            className={`tiltak-card__permit-panel${
              isPermitOpen ? " is-open" : ""
            }`}
          >
            <div className="tiltak-card__permit-content">
              {renderParagraphs(permitItem.body, {
                keyPrefix: `${permitItem.id}-permit`,
                glossary: permitItem.glossary,
                hoveredTerm: hoveredGlossaryTerm,
                setHoveredTerm: setHoveredGlossaryTerm,
              })}
              {permitItem.links.length > 0 && (
                <div className="tiltak-card__permit-links">
                  {permitItem.links.map((link) => (
                    <a
                      key={link.id ?? link.url}
                      className="tiltak-card__permit-link"
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.label}
                      <ExternalLinkGlyph />
                    </a>
                  ))}
                </div>
              )}
              {permitHighlightEntry && (
                <div className="tiltak-card__permit-highlight">
                  <h4>{permitHighlightEntry.term}</h4>
                  {renderParagraphs(permitHighlightEntry.definition, {
                    keyPrefix: `${permitItem.id}-highlight`,
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </article>
    </div>
  );
};
