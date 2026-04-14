import React, { useState, useMemo, useCallback } from 'react';
import { PktButton } from '@oslokommune/punkt-react';
import { useTiltakContent, useContentDictionary } from '../../../../../hooks/contentHooks';
import { applyTiltakVariant, getBuildingParagraphs } from '../../../../../utils/tiltakContent';
import { resolveTiltakBenefits } from '../../../../../utils/benefitUtils';
import { dictionaryTermsToGlossary } from '../glossaryHelpers';
import { useGrantAwareStotteordninger } from '../useGrantAwareStotteordninger';
import {
  resolveBuildingCategory,
  calculateTekPeriod,
  parseNumericValue
} from '../shared';
import { calculateAnnualEnergyConsumption } from '../../../../../utils/tekEnergyCalculations';
import type { BuildingType } from '../../../../../utils/tekEnergyCalculations';
import { calculateCombinedSavings, getRateForTiltakId } from '../../../../../utils/energySavingsData';
import type { TiltakSavingsInfo, Boligtype } from '../../../../../utils/energySavingsData';
import { computeTiltakSavings } from '../../../../../utils/tiltakSavings';
import { TiltakTabs } from './TiltakTabs';
import { TiltakContent } from './TiltakContent';
import { TiltakBenefits } from './TiltakBenefits';
import { TiltakSavings } from './TiltakSavings';
import { TiltakGrants } from './TiltakGrants';
import { TiltakPermit } from './TiltakPermit';
import { TiltakReadMore } from './TiltakReadMore';
import type { DesktopTiltakCardProps } from './types';
import './DesktopTiltakCard.css';

export const DesktopTiltakCard: React.FC<DesktopTiltakCardProps> = ({
  tiltakId,
  buildingType,
  buildingData,
  audience = 'standard',
  onBack,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<string>('generelt');
  const [hoveredGlossaryTerm, setHoveredGlossaryTerm] = useState<string | null>(null);

  // Hent data
  const { data: tiltakContent, isLoading: tiltakLoading } = useTiltakContent(tiltakId);
  const { data: dictionary } = useContentDictionary();

  // Applikasjonslogikk
  const resolvedContent = useMemo(
    () => applyTiltakVariant(tiltakContent, audience),
    [tiltakContent, audience]
  );

  const glossary = useMemo(
    () => dictionaryTermsToGlossary(dictionary?.glossaryTerms ?? []),
    [dictionary?.glossaryTerms]
  );

  const enrichedBenefits = useMemo(
    () => resolveTiltakBenefits(resolvedContent, dictionary, 4),
    [resolvedContent, dictionary]
  );

  const buildingParagraphs = useMemo(
    () => resolvedContent ? getBuildingParagraphs(resolvedContent, buildingType) : [],
    [resolvedContent, buildingType]
  );

  const { stotteordninger, isLoading: grantsLoading } = useGrantAwareStotteordninger({
    tiltakId,
    buildingType,
    audience
  });

  // Beregn besparelse
  const annualSavingsKwh = useMemo(() => {
    if (!buildingData) return 0;

    // For solenergi: bruk filteredSolarEnergy fra solar service
    if (tiltakId === 'solenergi') {
      return buildingData.filteredSolarEnergy ?? 0;
    }

    // For andre tiltak: bruk CSV-baserte beregninger
    const byggeaar = parseNumericValue(
      buildingData.byggeaar ?? buildingData.csvData?.byggeaar
    );
    const bruksareal = parseNumericValue(
      buildingData.bruksarealM2 ?? buildingData.csvData?.bruksareal_totalt
    );

    if (!bruksareal) return 0;

    const buildingCategory = resolveBuildingCategory(buildingType);
    // calculateTekPeriod håndterer ugyldig/manglende byggeår (gir TEK49)
    const tekPeriod = calculateTekPeriod(byggeaar || 0);
    // Map BuildingCategory til BuildingType for beregning
    const buildingTypeForCalc: BuildingType = buildingCategory === 'blokk' ? 'blokk' : 'småhus';
    const originalConsumption = calculateAnnualEnergyConsumption(
      byggeaar,
      bruksareal,
      buildingTypeForCalc
    );

    const energyBuildingCategory: Boligtype = buildingCategory === 'blokk' ? 'blokk' : 'småhus';

    // Bruk tiltakId direkte for oppslag - uavhengig av visningsnavn
    const rates = getRateForTiltakId(tiltakId, tekPeriod, energyBuildingCategory, {
      varmepumpeTab: tiltakId === 'varmepumpe' ? activeTab : undefined,
    });

    if (!rates) return 0;

    const tiltakInfo: TiltakSavingsInfo[] = [{
      title: tiltakId,
      rates: rates
    }];

    const savings = calculateCombinedSavings(
      originalConsumption,
      tiltakInfo,
      tekPeriod,
      energyBuildingCategory,
      bruksareal
    );

    return savings;
  }, [buildingData, buildingType, tiltakId, activeTab]);

  // Finn søknadsplikt-accordion
  const permitContent = useMemo(() => {
    return resolvedContent?.accordion?.find(
      (item) => item.id === 'soknadsplikt' || item.title?.toLowerCase().includes('søknadsplikt')
    );
  }, [resolvedContent?.accordion]);

  // Tabs fra innhold
  const tabs = useMemo(() => {
    if (!resolvedContent?.tabs?.length) return [];
    // Finn første tabs-seksjon
    const tabsSection = resolvedContent.tabs[0];
    if (tabsSection?.type === 'tabs' && tabsSection.tabs) {
      return tabsSection.tabs;
    }
    return [];
  }, [resolvedContent?.tabs]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);

  if (tiltakLoading || !resolvedContent) {
    return (
      <div className={`desktop-tiltak-card desktop-tiltak-card--loading ${className}`.trim()}>
        <div className="desktop-tiltak-card__loader">Laster...</div>
      </div>
    );
  }

  // Les mer-lenker fra innhold
  const readMoreLinks = resolvedContent.readMore ?? [];

  return (
    <div className={`desktop-tiltak-card ${className}`.trim()}>
      <header className="desktop-tiltak-card__header">
        <h1 className="desktop-tiltak-card__title">{resolvedContent.title}</h1>
        <PktButton
          skin="primary"
          size="medium"
          variant="icon-only"
          iconName="arrow-return"
          onClick={handleBack}
          aria-label="Tilbake til tiltak-listen"
          className="desktop-tiltak-card__back-button"
        />
      </header>

      {tabs.length > 0 && (
        <TiltakTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}

      <div className="desktop-tiltak-card__body">
        <main className="desktop-tiltak-card__main">
          <TiltakContent
            introParagraphs={resolvedContent.introParagraphs ?? []}
            buildingTypeParagraphs={buildingParagraphs}
            tabs={tabs}
            activeTab={activeTab}
            glossary={glossary}
            hoveredTerm={hoveredGlossaryTerm}
            setHoveredTerm={setHoveredGlossaryTerm}
          />
        </main>

        <aside className="desktop-tiltak-card__sidebar">
          <TiltakBenefits benefits={enrichedBenefits} />
          {(() => {
            const energyBoligtype: Boligtype =
              resolveBuildingCategory(buildingType) === 'blokk' ? 'blokk' : 'småhus';
            const { kwh: savingsKwh, nok: savingsNok } = computeTiltakSavings({
              tiltakId,
              kwhSaved: annualSavingsKwh,
              boligtype: energyBoligtype,
            });
            const economicsNote =
              tiltakId === 'solenergi' && energyBoligtype === 'småhus'
                ? resolvedContent?.savingsEconomicsNote?.smaahus
                : undefined;
            const sourceDescription =
              tiltakId === 'solenergi'
                ? resolvedContent?.energySourceDescription ??
                  'Basert på solinnstråling og takflater for bygningen'
                : 'Basert på bygningens alder og størrelse';
            return (
              <TiltakSavings
                annualSavingsKwh={savingsKwh}
                annualSavingsNok={savingsNok}
                sourceDescription={sourceDescription}
                economicsNote={economicsNote}
              />
            );
          })()}
        </aside>
      </div>

      <footer className="desktop-tiltak-card__footer">
        <div className="desktop-tiltak-card__footer-content">
          <TiltakReadMore links={readMoreLinks} maxLinks={3} />
          <div className="desktop-tiltak-card__footer-main">
            <TiltakGrants
              stotteordninger={stotteordninger}
              isLoading={grantsLoading}
            />
            <TiltakPermit
              permitContent={permitContent}
              glossary={glossary}
              hoveredTerm={hoveredGlossaryTerm}
              setHoveredTerm={setHoveredGlossaryTerm}
            />
          </div>
        </div>
      </footer>
    </div>
  );
};

export type { DesktopTiltakCardProps };
