import React from 'react';
import '../styles/components.css';
import { useEnergyRatingEstimator } from '../hooks/useEnergyRatingEstimator';
import type { EnergyEstimatorBuildingData } from '../types/energy';

interface EnergyRatingEstimatorProps {
  buildingData: EnergyEstimatorBuildingData;
}

export const EnergyRatingEstimator: React.FC<EnergyRatingEstimatorProps> = ({ buildingData }) => {
  const {
    yearlyConsumption,
    handleConsumptionChange,
    estimatedRating,
    energyIntensity,
    showSimulation,
    openSimulation,
    closeSimulation,
    selectedMeasures,
    toggleMeasure,
    totalSavings,
    newRating,
    getSavings,
    getBaselineValue,
    tekLabel,
    buildingCategory,
    hasEnovaAttest,
  } = useEnergyRatingEstimator(buildingData);

  const isRatingBetter = (rating1: string, rating2: string): boolean => {
    const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const index1 = order.indexOf(rating1.toUpperCase());
    const index2 = order.indexOf(rating2.toUpperCase());
    return index1 < index2;
  };

  const getEnergyBadgeClass = (karakter?: string): string => {
    if (!karakter) return '';
    return `energy-rating-estimator__badge energy-rating-estimator__badge--${karakter.toUpperCase()}`;
  };

  const consumptionValue = Number.parseInt(yearlyConsumption, 10) || 0;
  const adjustedConsumption = Math.max(0, consumptionValue - totalSavings);
  const modalSavings = getSavings(showSimulation);
  const tekDisplay = tekLabel ?? null;
  const buildingCategoryLabel = buildingCategory === 'småhus'
    ? 'småhus'
    : buildingCategory === 'blokk'
      ? 'boligblokk'
      : 'bygning';



  if (!buildingData.bruksarealM2) {
    return null;
  }

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
        {tekDisplay && (
          <p>Estimert TEK: <strong>{tekDisplay}</strong></p>
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
            onChange={(e) => handleConsumptionChange(e.target.value)}
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
                onChange={() => toggleMeasure('vindu')}
              />
              <label htmlFor="measure-vindu" className="energy-rating-estimator__measure-name">
                Utskiftning av vindu
              </label>
              <button className="energy-rating-estimator__info-button" onClick={() => openSimulation('vindu')}>
                Info
              </button>
            </div>
            <div className="energy-rating-estimator__measure-item">
              <input
                type="checkbox"
                id="measure-etterisolering"
                className="energy-rating-estimator__checkbox"
                checked={selectedMeasures.has('etterisolering')}
                onChange={() => toggleMeasure('etterisolering')}
              />
              <label htmlFor="measure-etterisolering" className="energy-rating-estimator__measure-name">
                Etterisolering yttervegg
              </label>
              <button className="energy-rating-estimator__info-button" onClick={() => openSimulation('etterisolering')}>
                Info
              </button>
            </div>
            <div className="energy-rating-estimator__measure-item">
              <input
                type="checkbox"
                id="measure-etterisolering-tak"
                className="energy-rating-estimator__checkbox"
                checked={selectedMeasures.has('etterisolering-tak')}
                onChange={() => toggleMeasure('etterisolering-tak')}
              />
              <label htmlFor="measure-etterisolering-tak" className="energy-rating-estimator__measure-name">
                Etterisolering tak/loft
              </label>
              <button className="energy-rating-estimator__info-button" onClick={() => openSimulation('etterisolering-tak')}>
                Info
              </button>
            </div>
            <div className="energy-rating-estimator__measure-item">
              <input
                type="checkbox"
                id="measure-varmepumpe"
                className="energy-rating-estimator__checkbox"
                checked={selectedMeasures.has('varmepumpe')}
                onChange={() => toggleMeasure('varmepumpe')}
              />
              <label htmlFor="measure-varmepumpe" className="energy-rating-estimator__measure-name">
                Varmepumpe
              </label>
              <button className="energy-rating-estimator__info-button" onClick={() => openSimulation('varmepumpe')}>
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
                  onChange={() => toggleMeasure('solcellepanel')}
                />
                <label htmlFor="measure-solcellepanel" className="energy-rating-estimator__measure-name">
                  Solcellepanel
                </label>
                <button className="energy-rating-estimator__info-button" onClick={() => openSimulation('solcellepanel')}>
                  Info
                </button>
              </div>
            )}
          </div>
          
          {selectedMeasures.size > 0 && yearlyConsumption && (
            <div className="energy-rating-estimator__new-consumption">
              <h4 className="energy-rating-estimator__new-consumption-title">
                Nytt energiforbruk med valgte tiltak {tekDisplay && `(basert på ${tekDisplay})`}
              </h4>
              <div className="energy-rating-estimator__new-consumption-content">
                <div className="energy-rating-estimator__consumption-details">
                  <p>
                    <span className="energy-rating-estimator__label">Opprinnelig forbruk:</span>
                    <span className="energy-rating-estimator__value">{consumptionValue.toLocaleString()} kWh/år</span>
                  </p>
                  <p>
                    <span className="energy-rating-estimator__label">Total besparelse:</span>
                    <span className="energy-rating-estimator__value energy-rating-estimator__value--savings">
                      -{totalSavings.toLocaleString()} kWh/år
                    </span>
                  </p>
                  <hr className="energy-rating-estimator__divider" />
                  <p className="energy-rating-estimator__new-total">
                    <span className="energy-rating-estimator__label">Nytt forbruk:</span>
                    <span className="energy-rating-estimator__value energy-rating-estimator__value--highlight">
                      {adjustedConsumption.toLocaleString()} kWh/år
                    </span>
                  </p>
                </div>
                {(() => {
                  const ratingAfter = newRating;
                  const newConsumption = adjustedConsumption;
                  const newIntensity = buildingData.bruksarealM2 ? newConsumption / buildingData.bruksarealM2 : 0;
                  
                  // Use Enova rating as "Before" if available, otherwise use estimated rating
                  const beforeRating = buildingData.energiattest?.energikarakter?.toUpperCase() || estimatedRating;
                  
                  if (ratingAfter && beforeRating) {
                    // Ensure the "After" rating is never worse than "Before"
                    let finalNewRating = ratingAfter;
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
        <div className="energy-rating-estimator__modal-overlay" onClick={closeSimulation}>
          <div className="energy-rating-estimator__modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="energy-rating-estimator__modal-close" 
              onClick={closeSimulation}
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
                if (!showSimulation) {
                  return '';
                }
                const baseline = getBaselineValue(showSimulation);
                if (baseline === null) {
                  return '';
                }
                const formatted = Number.isFinite(baseline)
                  ? Number(baseline).toLocaleString('nb-NO', { maximumFractionDigits: 1 })
                  : '';
                return formatted ? ` (${formatted})` : '';
              })()}
            </h3>
            {(() => {
              const savings = modalSavings;
              const tek = tekDisplay ?? 'eldre';
              
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
                        buildingCategoryLabel
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
