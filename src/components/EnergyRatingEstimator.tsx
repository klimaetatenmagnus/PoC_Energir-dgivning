import React, { useState } from 'react';
import '../styles/components.css';

interface BuildingData {
  bruksarealM2?: number;
  bygningstypeKode?: string;
  bygningstype?: string;
  byggeaar?: number;
  energiattest?: {
    energikarakter?: string;
    oppvarmingskarakter?: string;
    utstedelsesdato?: string;
    attestnummer?: string;
    attestUrl?: string;
    registering?: {
      beregnetLevertEnergiTotaltkWh?: number;
      beregnetLevertEnergiTotaltkWhm2?: number;
    };
  };
  filteredSolarEnergy?: number;
}

interface EnergyRatingEstimatorProps {
  buildingData: BuildingData;
}

// Energy savings data structure
const ENERGY_SAVINGS_DATA: Record<string | number, any> = {
  "eldre": {
    "blokk": {
      0.75: 38.9,
      1.2: 32.1,
      "etteriso_yttervegg": 81.7,
      "etteriso_takloft": 24.4
    },
    "småhus": {
      0.75: 42.2,
      1.2: 34.3,
      "etteriso_yttervegg": 94.1,
      "etteriso_takloft": 41.2
    }
  },
  49: {
    "blokk": {
      0.75: 38.9,
      1.2: 32.1,
      "etteriso_yttervegg": 81.7,
      "etteriso_takloft": 24.4
    },
    "småhus": {
      0.75: 42.2,
      1.2: 34.3,
      "etteriso_yttervegg": 94.1,
      "etteriso_takloft": 41.2
    }
  },
  69: {
    "blokk": {
      0.75: 38.3,
      1.2: 31.3,
      "etteriso_yttervegg": 39.7,
      "etteriso_takloft": 8.4
    },
    "småhus": {
      0.75: 41.7,
      1.2: 33.7,
      "etteriso_yttervegg": 27.7,
      "etteriso_takloft": 11.4
    }
  },
  87: {
    "blokk": {
      0.75: 28.1,
      1.2: 21.0,
      "etteriso_yttervegg": 9.7,
      "etteriso_takloft": 2.8
    },
    "småhus": {
      0.75: 31.4,
      1.2: 23.4,
      "etteriso_yttervegg": 15.0,
      "etteriso_takloft": 4.7
    }
  },
  97: {
    "blokk": {
      0.75: 12.1,
      1.2: 5.0,
      "etteriso_yttervegg": 7.3,
      "etteriso_takloft": 0.4
    },
    "småhus": {
      0.75: 14.2,
      1.2: 6.1,
      "etteriso_yttervegg": 3.7,
      "etteriso_takloft": 0.6
    }
  },
  7: {
    "blokk": {
      0.75: 7.2,
      1.2: 0,
      "etteriso_yttervegg": 1.3,
      "etteriso_takloft": 0.4
    },
    "småhus": {
      0.75: 8.2,
      1.2: 0,
      "etteriso_yttervegg": 0,
      "etteriso_takloft": 0
    }
  }
} as const;

export const EnergyRatingEstimator: React.FC<EnergyRatingEstimatorProps> = ({ buildingData }) => {
  const [yearlyConsumption, setYearlyConsumption] = useState<string>('');
  const [estimatedRating, setEstimatedRating] = useState<string | null>(null);
  const [energyIntensity, setEnergyIntensity] = useState<number | null>(null);
  const [showSimulation, setShowSimulation] = useState<string | null>(null);
  const [selectedMeasures, setSelectedMeasures] = useState<Set<string>>(new Set());

  // Helper function to compare energy ratings (A is better than G)
  const isRatingBetter = (rating1: string, rating2: string): boolean => {
    const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const index1 = order.indexOf(rating1.toUpperCase());
    const index2 = order.indexOf(rating2.toUpperCase());
    return index1 < index2;
  };

  // TEK calculation function
  const calculateTEK = (byggeaar: number): string => {
    const terskel = 2; // lag i år i forhold til tek
    
    // TEK years with threshold applied
    if (byggeaar >= 2007 + terskel) return "TEK7";      // 2009 and newer
    if (byggeaar >= 1997 + terskel) return "TEK97";     // 1999-2008
    if (byggeaar >= 1987 + terskel) return "TEK87";     // 1989-1998
    if (byggeaar >= 1969 + terskel) return "TEK69";     // 1971-1988
    if (byggeaar >= 1949 + terskel) return "TEK49";     // 1951-1970
    
    // Older than 1951
    return "eldre";
  };

  // Calculate savings for a measure
  const calculateSavings = (measure: string): { percentage: number; kWh: number } | null => {
    if (!buildingData.byggeaar || !yearlyConsumption) {
      console.log('Missing data:', { byggeaar: buildingData.byggeaar, yearlyConsumption });
      return null;
    }
    
    const tek = calculateTEK(buildingData.byggeaar);
    
    // Determine building category from either code or type string
    let buildingCategory: 'småhus' | 'blokk' | null = null;
    
    if (buildingData.bygningstypeKode) {
      const buildingTypeCode = buildingData.bygningstypeKode.substring(0, 2);
      const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode);
      const isBlokk = ['14', '15', '16', '17'].includes(buildingTypeCode);
      buildingCategory = isSmåhus ? 'småhus' : isBlokk ? 'blokk' : null;
    } else if (buildingData.bygningstype) {
      // Fallback to string matching when code is not available
      const typeString = buildingData.bygningstype.toLowerCase();
      if (typeString.includes('enebolig') || typeString.includes('tomannsbolig') || typeString.includes('rekkehus') || typeString.includes('kjedehus')) {
        buildingCategory = 'småhus';
      } else if (typeString.includes('blokk') || typeString.includes('leilighet') || typeString.includes('boligbygg')) {
        buildingCategory = 'blokk';
      }
    }
    
    if (!buildingCategory) {
      console.log('Building type not recognized:', buildingData.bygningstype, 'Code:', buildingData.bygningstypeKode);
      return null;
    }
    
    // Get TEK key for the data structure
    let tekKey: string | number = tek;
    if (tek.startsWith('TEK')) {
      const tekNumber = parseInt(tek.substring(3));
      tekKey = tekNumber;
    }
    
    const savingsData = ENERGY_SAVINGS_DATA[tekKey];
    if (!savingsData) {
      console.log('No savings data found for TEK key:', tekKey, 'Original TEK:', tek);
      return null;
    }
    
    let savingsPerBRA = 0; // kWh/m² saved
    
    if (measure === 'vindu') {
      // For windows, we'll use U-value 0.75 as default
      savingsPerBRA = savingsData[buildingCategory][0.75] || 0;
    } else if (measure === 'etterisolering') {
      savingsPerBRA = savingsData[buildingCategory]['etteriso_yttervegg'] || 0;
    } else if (measure === 'etterisolering-tak') {
      savingsPerBRA = savingsData[buildingCategory]['etteriso_takloft'] || 0;
    } else if (measure === 'varmepumpe') {
      // For heat pump, we'll estimate 30% savings as a default
      // This is already a percentage, so we need to convert it differently
      const consumptionNum = parseFloat(yearlyConsumption);
      const kWhSaved = (consumptionNum * 30) / 100;
      return {
        percentage: 30,
        kWh: Math.round(kWhSaved)
      };
    } else if (measure === 'solcellepanel') {
      // For solar panels, use the calculated filtered solar energy
      const solarEnergy = buildingData.filteredSolarEnergy || 0;
      const consumptionNum = parseFloat(yearlyConsumption);
      const savingsPercentage = consumptionNum > 0 && solarEnergy > 0 ? (solarEnergy / consumptionNum) * 100 : 0;
      return {
        percentage: Math.round(savingsPercentage * 10) / 10,
        kWh: Math.round(solarEnergy)
      };
    }
    
    // Calculate total kWh saved = savings per m² * total m²
    const kWhSaved = savingsPerBRA * (buildingData.bruksarealM2 || 0);
    
    // Calculate percentage of total consumption
    const consumptionNum = parseFloat(yearlyConsumption);
    const savingsPercentage = consumptionNum > 0 ? (kWhSaved / consumptionNum) * 100 : 0;
    
    return {
      percentage: Math.round(savingsPercentage * 10) / 10, // Round to 1 decimal
      kWh: Math.round(kWhSaved)
    };
  };

  const calculateEnergyRating = (consumption: string) => {
    const consumptionNum = parseFloat(consumption);
    if (isNaN(consumptionNum) || consumptionNum <= 0 || !buildingData.bruksarealM2) {
      setEstimatedRating(null);
      setEnergyIntensity(null);
      return;
    }

    // Calculate energy intensity (kWh/m²/year)
    const intensity = consumptionNum / buildingData.bruksarealM2;
    setEnergyIntensity(intensity);
    
    const bra = buildingData.bruksarealM2;

    // Determine building type based on code
    const buildingTypeCode = buildingData.bygningstypeKode?.substring(0, 2);
    const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode || '');
    const isBlokk = ['14', '15', '16', '17'].includes(buildingTypeCode || '');

    // Use appropriate thresholds based on building type with BRA-dependent formulas
    let rating = 'G';
    if (isSmåhus) {
      // Småhus thresholds with BRA-dependent formulas
      if (intensity <= 95 + 800/bra) rating = 'A';
      else if (intensity <= 120 + 1600/bra) rating = 'B';
      else if (intensity <= 145 + 2500/bra) rating = 'C';
      else if (intensity <= 175 + 4100/bra) rating = 'D';
      else if (intensity <= 205 + 5800/bra) rating = 'E';
      else if (intensity <= 250 + 8000/bra) rating = 'F';
    } else if (isBlokk) {
      // Blokk thresholds with BRA-dependent formulas
      if (intensity <= 85 + 600/bra) rating = 'A';
      else if (intensity <= 95 + 1000/bra) rating = 'B';
      else if (intensity <= 100 + 1500/bra) rating = 'C';
      else if (intensity <= 135 + 2200/bra) rating = 'D';
      else if (intensity <= 160 + 3000/bra) rating = 'E';
      else if (intensity <= 200 + 4000/bra) rating = 'F';
    } else {
      // Default thresholds for other building types (using average of småhus/blokk)
      if (intensity <= 90 + 700/bra) rating = 'A';
      else if (intensity <= 107.5 + 1300/bra) rating = 'B';
      else if (intensity <= 122.5 + 2000/bra) rating = 'C';
      else if (intensity <= 155 + 3150/bra) rating = 'D';
      else if (intensity <= 182.5 + 4400/bra) rating = 'E';
      else if (intensity <= 225 + 6000/bra) rating = 'F';
    }

    setEstimatedRating(rating);
  };

  const getEnergyBadgeClass = (karakter?: string): string => {
    if (!karakter) return '';
    return `energy-rating-estimator__badge energy-rating-estimator__badge--${karakter.toUpperCase()}`;
  };

  const handleMeasureToggle = (measure: string) => {
    const newSelected = new Set(selectedMeasures);
    if (newSelected.has(measure)) {
      newSelected.delete(measure);
    } else {
      newSelected.add(measure);
    }
    setSelectedMeasures(newSelected);
  };

  const calculateTotalSavings = (): number => {
    let totalSavings = 0;
    
    selectedMeasures.forEach(measure => {
      const savings = calculateSavings(measure);
      if (savings) {
        totalSavings += savings.kWh;
      }
    });
    
    return totalSavings;
  };

  const calculateNewEnergyRating = (): string | null => {
    if (!buildingData.bruksarealM2 || !yearlyConsumption) return null;
    
    const totalSavings = calculateTotalSavings();
    const newConsumption = Math.max(0, parseInt(yearlyConsumption) - totalSavings);
    
    // Calculate new energy intensity (kWh/m²/year)
    const newIntensity = newConsumption / buildingData.bruksarealM2;
    const bra = buildingData.bruksarealM2;

    // Determine building type based on code - EXACT SAME LOGIC AS calculateEnergyRating
    const buildingTypeCode = buildingData.bygningstypeKode?.substring(0, 2);
    const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode || '');
    const isBlokk = ['14', '15', '16', '17'].includes(buildingTypeCode || '');

    // Use appropriate thresholds based on building type with BRA-dependent formulas
    let rating = 'G';
    if (isSmåhus) {
      // Småhus thresholds with BRA-dependent formulas
      if (newIntensity <= 95 + 800/bra) rating = 'A';
      else if (newIntensity <= 120 + 1600/bra) rating = 'B';
      else if (newIntensity <= 145 + 2500/bra) rating = 'C';
      else if (newIntensity <= 175 + 4100/bra) rating = 'D';
      else if (newIntensity <= 205 + 5800/bra) rating = 'E';
      else if (newIntensity <= 250 + 8000/bra) rating = 'F';
    } else if (isBlokk) {
      // Blokk thresholds with BRA-dependent formulas
      if (newIntensity <= 85 + 600/bra) rating = 'A';
      else if (newIntensity <= 95 + 1000/bra) rating = 'B';
      else if (newIntensity <= 100 + 1500/bra) rating = 'C';
      else if (newIntensity <= 135 + 2200/bra) rating = 'D';
      else if (newIntensity <= 160 + 3000/bra) rating = 'E';
      else if (newIntensity <= 200 + 4000/bra) rating = 'F';
    } else {
      // Default thresholds for other building types (using average of småhus/blokk)
      if (newIntensity <= 90 + 700/bra) rating = 'A';
      else if (newIntensity <= 107.5 + 1300/bra) rating = 'B';
      else if (newIntensity <= 122.5 + 2000/bra) rating = 'C';
      else if (newIntensity <= 155 + 3150/bra) rating = 'D';
      else if (newIntensity <= 182.5 + 4400/bra) rating = 'E';
      else if (newIntensity <= 225 + 6000/bra) rating = 'F';
    }

    return rating;
  };

  if (!buildingData.bruksarealM2) {
    return null;
  }

  // Check if we have official Enova certificate
  const hasEnovaAttest = buildingData.energiattest?.energikarakter;
  const enovaConsumption = buildingData.energiattest?.registering?.beregnetLevertEnergiTotaltkWh;

  // If we have Enova data, auto-populate consumption
  React.useEffect(() => {
    if (hasEnovaAttest && enovaConsumption && !yearlyConsumption) {
      const consumptionStr = Math.round(enovaConsumption).toString();
      setYearlyConsumption(consumptionStr);
      calculateEnergyRating(consumptionStr);
    }
  }, [hasEnovaAttest, enovaConsumption]);

  return (
    <div className="energy-rating-estimator">
      <h2 className="energy-rating-estimator__title">
        {hasEnovaAttest ? 'Energimerking fra Enova' : 'Estimering av energimerking'}
      </h2>
      
      {hasEnovaAttest && (
        <div className="energy-rating-estimator__enova-badge">
          <div className={getEnergyBadgeClass(buildingData.energiattest?.energikarakter?.toUpperCase())}>
            {buildingData.energiattest?.energikarakter?.toUpperCase()}
          </div>
          <p className="energy-rating-estimator__enova-text">
            Offisiell energikarakter fra Enova
          </p>
          {buildingData.energiattest?.utstedelsesdato && (
            <p className="energy-rating-estimator__enova-date">
              Utstedt: {new Date(buildingData.energiattest.utstedelsesdato).toLocaleDateString('nb-NO')}
            </p>
          )}
        </div>
      )}
      
      <div className="energy-rating-estimator__info">
        <p>Bygningstype: <strong>{buildingData.bygningstype || 'Ukjent'}</strong></p>
        <p>Bruksareal: <strong>{buildingData.bruksarealM2} m²</strong></p>
        {buildingData.byggeaar && (
          <p>Estimert TEK: <strong>{calculateTEK(buildingData.byggeaar)}</strong></p>
        )}
      </div>

      <div className="energy-rating-estimator__input-section">
        <label htmlFor="yearly-consumption" className="energy-rating-estimator__label">
          Årlig energiforbruk {hasEnovaAttest && '(fra Enova)'}
        </label>
        <div className="energy-rating-estimator__input-wrapper">
          <input
            id="yearly-consumption"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={hasEnovaAttest ? "Hentet fra Enova" : "Oppgi årlig forbruk"}
            value={yearlyConsumption}
            onChange={(e) => {
              // Only allow numeric input
              const value = e.target.value.replace(/[^0-9]/g, '');
              setYearlyConsumption(value);
              calculateEnergyRating(value);
            }}
            className="energy-rating-estimator__input"
            readOnly={hasEnovaAttest}
          />
          <span className="energy-rating-estimator__unit">kWh</span>
          <span className="energy-rating-estimator__helper-text">
            (elektrisitet, fjernvarme osv)
          </span>
        </div>
      </div>

      {estimatedRating && (
        <div className="energy-rating-estimator__measures">
          <h3 className="energy-rating-estimator__measures-title">Simulering av tiltak</h3>
          <div className="energy-rating-estimator__measures-list">
            <div className="energy-rating-estimator__measure-item">
              <input
                type="checkbox"
                id="measure-vindu"
                className="energy-rating-estimator__checkbox"
                checked={selectedMeasures.has('vindu')}
                onChange={() => handleMeasureToggle('vindu')}
              />
              <label htmlFor="measure-vindu" className="energy-rating-estimator__measure-name">
                Utskiftning av vindu
              </label>
              <button className="energy-rating-estimator__info-button" onClick={() => setShowSimulation('vindu')}>
                Info
              </button>
            </div>
            <div className="energy-rating-estimator__measure-item">
              <input
                type="checkbox"
                id="measure-etterisolering"
                className="energy-rating-estimator__checkbox"
                checked={selectedMeasures.has('etterisolering')}
                onChange={() => handleMeasureToggle('etterisolering')}
              />
              <label htmlFor="measure-etterisolering" className="energy-rating-estimator__measure-name">
                Etterisolering yttervegg
              </label>
              <button className="energy-rating-estimator__info-button" onClick={() => setShowSimulation('etterisolering')}>
                Info
              </button>
            </div>
            <div className="energy-rating-estimator__measure-item">
              <input
                type="checkbox"
                id="measure-etterisolering-tak"
                className="energy-rating-estimator__checkbox"
                checked={selectedMeasures.has('etterisolering-tak')}
                onChange={() => handleMeasureToggle('etterisolering-tak')}
              />
              <label htmlFor="measure-etterisolering-tak" className="energy-rating-estimator__measure-name">
                Etterisolering tak/loft
              </label>
              <button className="energy-rating-estimator__info-button" onClick={() => setShowSimulation('etterisolering-tak')}>
                Info
              </button>
            </div>
            <div className="energy-rating-estimator__measure-item">
              <input
                type="checkbox"
                id="measure-varmepumpe"
                className="energy-rating-estimator__checkbox"
                checked={selectedMeasures.has('varmepumpe')}
                onChange={() => handleMeasureToggle('varmepumpe')}
              />
              <label htmlFor="measure-varmepumpe" className="energy-rating-estimator__measure-name">
                Varmepumpe
              </label>
              <button className="energy-rating-estimator__info-button" onClick={() => setShowSimulation('varmepumpe')}>
                Info
              </button>
            </div>
            {buildingData.filteredSolarEnergy !== undefined && (
              <div className="energy-rating-estimator__measure-item">
                <input
                  type="checkbox"
                  id="measure-solcellepanel"
                  className="energy-rating-estimator__checkbox"
                  checked={selectedMeasures.has('solcellepanel')}
                  onChange={() => handleMeasureToggle('solcellepanel')}
                />
                <label htmlFor="measure-solcellepanel" className="energy-rating-estimator__measure-name">
                  Solcellepanel
                </label>
                <button className="energy-rating-estimator__info-button" onClick={() => setShowSimulation('solcellepanel')}>
                  Info
                </button>
              </div>
            )}
          </div>
          
          {selectedMeasures.size > 0 && yearlyConsumption && (
            <div className="energy-rating-estimator__new-consumption">
              <h4 className="energy-rating-estimator__new-consumption-title">
                Nytt energiforbruk med valgte tiltak {buildingData.byggeaar && `(basert på ${calculateTEK(buildingData.byggeaar)})`}
              </h4>
              <div className="energy-rating-estimator__new-consumption-content">
                <div className="energy-rating-estimator__consumption-details">
                  <p>
                    <span className="energy-rating-estimator__label">Opprinnelig forbruk:</span>
                    <span className="energy-rating-estimator__value">{parseInt(yearlyConsumption).toLocaleString()} kWh/år</span>
                  </p>
                  <p>
                    <span className="energy-rating-estimator__label">Total besparelse:</span>
                    <span className="energy-rating-estimator__value energy-rating-estimator__value--savings">
                      -{calculateTotalSavings().toLocaleString()} kWh/år
                    </span>
                  </p>
                  <hr className="energy-rating-estimator__divider" />
                  <p className="energy-rating-estimator__new-total">
                    <span className="energy-rating-estimator__label">Nytt forbruk:</span>
                    <span className="energy-rating-estimator__value energy-rating-estimator__value--highlight">
                      {Math.max(0, parseInt(yearlyConsumption) - calculateTotalSavings()).toLocaleString()} kWh/år
                    </span>
                  </p>
                </div>
                {(() => {
                  const newRating = calculateNewEnergyRating();
                  const newConsumption = Math.max(0, parseInt(yearlyConsumption) - calculateTotalSavings());
                  const newIntensity = buildingData.bruksarealM2 ? newConsumption / buildingData.bruksarealM2 : 0;
                  
                  // Use Enova rating as "Before" if available, otherwise use estimated rating
                  const beforeRating = buildingData.energiattest?.energikarakter?.toUpperCase() || estimatedRating;
                  
                  if (newRating && beforeRating) {
                    // Ensure the "After" rating is never worse than "Before"
                    let finalNewRating = newRating;
                    if (!isRatingBetter(newRating, beforeRating)) {
                      finalNewRating = beforeRating;
                    }
                    
                    return (
                      <div className="energy-rating-estimator__new-rating">
                        <p className="energy-rating-estimator__new-rating-text">
                          Nytt estimert energimerke:
                        </p>
                        <div className="energy-rating-estimator__rating-comparison">
                          <div className="energy-rating-estimator__rating-item">
                            <span className={`${getEnergyBadgeClass(beforeRating)} energy-rating-estimator__badge--small`}>
                              {beforeRating}
                            </span>
                            <span className="energy-rating-estimator__rating-label">Før</span>
                            <span className="energy-rating-estimator__intensity-value">
                              {energyIntensity ? `${Math.round(energyIntensity)} kWh/m²/år` : ''}
                            </span>
                          </div>
                          <span className="energy-rating-estimator__arrow">→</span>
                          <div className="energy-rating-estimator__rating-item">
                            <span className={`${getEnergyBadgeClass(finalNewRating)} energy-rating-estimator__badge--small`}>
                              {finalNewRating}
                            </span>
                            <span className="energy-rating-estimator__rating-label">Etter</span>
                            <span className="energy-rating-estimator__intensity-value">
                              {Math.round(newIntensity)} kWh/m²/år
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {showSimulation && (
        <div className="energy-rating-estimator__modal-overlay" onClick={() => setShowSimulation(null)}>
          <div className="energy-rating-estimator__modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="energy-rating-estimator__modal-close" 
              onClick={() => setShowSimulation(null)}
            >
              ×
            </button>
            <h3 className="energy-rating-estimator__modal-title">
              Simulering av {
                showSimulation === 'vindu' ? 'utskiftning av vindu' :
                showSimulation === 'etterisolering' ? 'etterisolering yttervegg' :
                showSimulation === 'etterisolering-tak' ? 'etterisolering tak/loft' :
                showSimulation === 'varmepumpe' ? 'varmepumpe' :
                'solcellepanel'
              }
              {(() => {
                if (!buildingData.byggeaar) return '';
                
                const tek = calculateTEK(buildingData.byggeaar);
                let tekKey: string | number = tek;
                if (tek.startsWith('TEK')) {
                  tekKey = parseInt(tek.substring(3));
                }
                
                
                // Determine building category
                let buildingCategory: string | null = null;
                if (buildingData.bygningstypeKode) {
                  const code = buildingData.bygningstypeKode.substring(0, 2);
                  buildingCategory = ['11', '12', '13'].includes(code) ? 'småhus' : 
                                   ['14', '15', '16', '17'].includes(code) ? 'blokk' : null;
                } else if (buildingData.bygningstype) {
                  const typeString = buildingData.bygningstype.toLowerCase();
                  if (typeString.includes('enebolig') || typeString.includes('tomannsbolig') || 
                      typeString.includes('rekkehus') || typeString.includes('kjedehus')) {
                    buildingCategory = 'småhus';
                  } else if (typeString.includes('blokk') || typeString.includes('leilighet') || 
                             typeString.includes('boligbygg')) {
                    buildingCategory = 'blokk';
                  }
                }
                
                if (!buildingCategory) return '';
                
                const data = ENERGY_SAVINGS_DATA[tekKey];
                if (!data || !data[buildingCategory]) return '';
                
                let value = null;
                if (showSimulation === 'vindu') {
                  value = data[buildingCategory][0.75];
                } else if (showSimulation === 'etterisolering') {
                  value = data[buildingCategory]['etteriso_yttervegg'];
                } else if (showSimulation === 'etterisolering-tak') {
                  value = data[buildingCategory]['etteriso_takloft'];
                } else if (showSimulation === 'varmepumpe') {
                  value = 30; // hardcoded value
                } else if (showSimulation === 'solcellepanel') {
                  // For solar panels, show the actual calculated percentage
                  const savings = calculateSavings('solcellepanel');
                  value = savings ? savings.percentage : null;
                }
                
                return value !== null ? ` (${value})` : '';
              })()}
            </h3>
            {(() => {
              const savings = calculateSavings(showSimulation);
              const tek = buildingData.byggeaar ? calculateTEK(buildingData.byggeaar) : null;
              
              // Special handling for solar panels with no suitable roof area
              if (showSimulation === 'solcellepanel' && savings && savings.kWh === 0) {
                return (
                  <div className="energy-rating-estimator__modal-content">
                    <p className="energy-rating-estimator__modal-message">
                      <strong>Ikke egnet for solenergi</strong>
                    </p>
                    <p className="energy-rating-estimator__modal-note">
                      Denne bygningen har ingen takflater med tilstrekkelig solinnstråling 
                      (over 800 kWh/m²·år) for effektiv solcelleproduksjon.
                    </p>
                    <div className="energy-rating-estimator__savings-display">
                      <div className="energy-rating-estimator__savings-percentage">
                        <span className="energy-rating-estimator__savings-value">0%</span>
                        <span className="energy-rating-estimator__savings-label">besparelse</span>
                      </div>
                      <div className="energy-rating-estimator__savings-kwh">
                        <span className="energy-rating-estimator__savings-value">0</span>
                        <span className="energy-rating-estimator__savings-label">kWh/år</span>
                      </div>
                    </div>
                  </div>
                );
              }
              
              if (!savings) {
                if (tek === 'TEK7') {
                  return (
                    <p className="energy-rating-estimator__modal-message">
                      Bygninger med TEK7 standard har allerede høy energieffektivitet. 
                      Tiltak vil gi begrenset effekt.
                    </p>
                  );
                }
                return (
                  <p className="energy-rating-estimator__modal-message">
                    Kunne ikke beregne besparelse. Sjekk at årlig forbruk er oppgitt.
                  </p>
                );
              }
              
              return (
                <div className="energy-rating-estimator__modal-content">
                  <div className="energy-rating-estimator__savings-display">
                    <div className="energy-rating-estimator__savings-percentage">
                      <span className="energy-rating-estimator__savings-value">{savings.percentage}%</span>
                      <span className="energy-rating-estimator__savings-label">besparelse</span>
                    </div>
                    <div className="energy-rating-estimator__savings-kwh">
                      <span className="energy-rating-estimator__savings-value">{savings.kWh.toLocaleString()}</span>
                      <span className="energy-rating-estimator__savings-label">kWh/år</span>
                    </div>
                  </div>
                  <p className="energy-rating-estimator__modal-note">
                    {showSimulation === 'solcellepanel' ? (
                      <>Basert på takflater med innstråling over 800 kWh/m²·år og 20% virkningsgrad.</>
                    ) : (
                      <>Basert på {tek} standard og {
                        ['11', '12', '13'].includes(buildingData.bygningstypeKode?.substring(0, 2) || '') ? 'småhus' : 'boligblokk'
                      } type bygning.</>
                    )}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};