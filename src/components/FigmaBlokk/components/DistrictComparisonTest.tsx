/**
 * Test-komponent for DistrictComparison
 * Bruk denne for å verifisere at bydelssammenligning fungerer før integrasjon i WhiteInfoBox
 *
 * For å teste: Legg til denne komponenten midlertidig i FigmaMainScript eller opprett en test-rute
 */

import React, { useState, useEffect, useMemo } from 'react';
import { DistrictComparison } from './DistrictComparison';
import {
  getDistrictStatisticsSync,
  getStatsForDistrict,
  mapBuildingTypeToCategory,
} from '../../../services/districtStatisticsService';
import type { DistrictStats } from '../../../types/districtStatistics';

interface DistrictComparisonTestProps {
  /** Bydelsnavn (f.eks. "Nordre Aker") */
  districtName: string;
  /** Bygningstype-navn (f.eks. "Enebolig", "Blokk") */
  buildingTypeName: string;
  /** Estimert energiforbruk (kWh/år) */
  energyConsumption: number;
  /** Bruksareal (m²) */
  bruksareal: number;
  /** Totale besparelser fra valgte tiltak (kWh/år) */
  totalEnergySavings?: number;
}

/**
 * Wrapper-komponent for testing av DistrictComparison
 * Henter statistikk automatisk basert på bydel og bygningstype
 */
export const DistrictComparisonTest: React.FC<DistrictComparisonTestProps> = ({
  districtName,
  buildingTypeName,
  energyConsumption,
  bruksareal,
  totalEnergySavings = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [districtStats, setDistrictStats] = useState<DistrictStats | null>(null);

  // Hent statistikk ved mount
  useEffect(() => {
    const data = getDistrictStatisticsSync();
    if (data) {
      const buildingType = mapBuildingTypeToCategory(buildingTypeName);
      const stats = getStatsForDistrict(data, districtName, buildingType);
      setDistrictStats(stats);
    }
  }, [districtName, buildingTypeName]);

  // Beregn kWh/m²
  const currentKwhPerM2 = useMemo(() => {
    if (bruksareal <= 0) return 0;
    return energyConsumption / bruksareal;
  }, [energyConsumption, bruksareal]);

  if (!districtStats) {
    return (
      <div style={{ padding: '16px', color: '#666' }}>
        Laster bydelsstatistikk for {districtName}...
      </div>
    );
  }

  return (
    <div
      style={{
        width: '328px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
      }}
    >
      <DistrictComparison
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        currentKwhPerM2={currentKwhPerM2}
        totalEnergySavings={totalEnergySavings}
        bruksareal={bruksareal}
        districtName={districtName}
        districtStats={districtStats}
      />
    </div>
  );
};

/**
 * Demo-side med flere test-scenarier
 */
export const DistrictComparisonDemo: React.FC = () => {
  return (
    <div
      style={{
        padding: '32px',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
        fontFamily: 'Oslo Sans, sans-serif',
      }}
    >
      <h1 style={{ marginBottom: '24px', color: '#2a2859' }}>
        Bydelssammenligning - Test
      </h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
        {/* Scenario 1: Energieffektiv bolig */}
        <div>
          <h3 style={{ marginBottom: '8px', color: '#2a2859' }}>
            Scenario 1: Energieffektiv småhus i Nordre Aker
          </h3>
          <DistrictComparisonTest
            districtName="Nordre Aker"
            buildingTypeName="Enebolig"
            energyConsumption={12000}
            bruksareal={120}
            totalEnergySavings={0}
          />
        </div>

        {/* Scenario 2: Gjennomsnittlig bolig med tiltak */}
        <div>
          <h3 style={{ marginBottom: '8px', color: '#2a2859' }}>
            Scenario 2: Blokk i Frogner med tiltak
          </h3>
          <DistrictComparisonTest
            districtName="Frogner"
            buildingTypeName="Blokk"
            energyConsumption={13000}
            bruksareal={80}
            totalEnergySavings={3000}
          />
        </div>

        {/* Scenario 3: Høyt forbruk */}
        <div>
          <h3 style={{ marginBottom: '8px', color: '#2a2859' }}>
            Scenario 3: Eldre småhus i Gamle Oslo
          </h3>
          <DistrictComparisonTest
            districtName="Gamle Oslo"
            buildingTypeName="Tomannsbolig"
            energyConsumption={25000}
            bruksareal={140}
            totalEnergySavings={0}
          />
        </div>

        {/* Scenario 4: Vestre Aker - mest energieffektive bydel */}
        <div>
          <h3 style={{ marginBottom: '8px', color: '#2a2859' }}>
            Scenario 4: Vestre Aker med store besparelser
          </h3>
          <DistrictComparisonTest
            districtName="Vestre Aker"
            buildingTypeName="Enebolig"
            energyConsumption={20000}
            bruksareal={150}
            totalEnergySavings={8000}
          />
        </div>
      </div>

      <div style={{ marginTop: '32px', color: '#666', fontSize: '14px' }}>
        <p>
          <strong>Bruk:</strong> Denne demoen viser DistrictComparison-komponenten
          med forskjellige test-scenarier. Klikk på &quot;Sammenlign med naboene&quot; for å
          utvide sammenligningen.
        </p>
        <p style={{ marginTop: '8px' }}>
          <strong>Integrasjon:</strong> Når verifisert, integrer DistrictComparison
          i WhiteInfoBox.tsx mellom besparelseskortet og kartet.
        </p>
      </div>
    </div>
  );
};

export default DistrictComparisonTest;
