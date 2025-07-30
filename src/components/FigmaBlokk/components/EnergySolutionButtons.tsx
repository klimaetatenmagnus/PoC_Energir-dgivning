import React, { useState } from 'react';
import { ENERGY_SOLUTIONS } from '../constants';

interface EnergySolutionButtonsProps {
  showHeader: boolean;
  isExpanded: boolean;
  onExpand: (expanded: boolean) => void;
  onSelectSolution: (solution: string) => void;
  buildingData?: any; // For accessing bruksareal
  showYellowBox?: boolean;
  onToggleYellowBox?: (show: boolean) => void;
}

export const EnergySolutionButtons: React.FC<EnergySolutionButtonsProps> = ({ showHeader, isExpanded, onExpand, onSelectSolution, buildingData, showYellowBox = true, onToggleYellowBox }) => {
  // Add CSS for fade animation
  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [yearlyConsumption, setYearlyConsumption] = useState<string>('');
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [gul_liste, setGul_liste] = useState<boolean>(showYellowBox);
  
  // Calculate energy rating based on consumption
  const calculateEnergyRating = (consumption: string): string | null => {
    const consumptionNum = parseFloat(consumption);
    if (isNaN(consumptionNum) || consumptionNum <= 0) return null;
    
    // Get bruksareal from buildingData
    const bra = buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt;
    if (!bra || bra <= 0) return null;
    
    // Calculate energy intensity (kWh/m²/year)
    const intensity = consumptionNum / bra;
    
    // Determine building type based on code
    const buildingTypeCode = buildingData?.bygningstypeKode?.substring(0, 2) || buildingData?.csvData?.bygningstypekode?.substring(0, 2);
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
    
    return rating;
  };
  
  const estimatedRating = calculateEnergyRating(yearlyConsumption);
  
  
  // Energy savings data structure - same as in EnergyRatingEstimator
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
  
  // Helper function to calculate savings for a specific building category
  const calculateSavingsForCategory = (buildingCategory: 'småhus' | 'blokk', measure: string, tek: string, consumption: string): number => {
    // Get TEK key for the data structure
    let tekKey: string | number = tek;
    if (tek.startsWith('TEK')) {
      const tekNumber = parseInt(tek.substring(3));
      tekKey = tekNumber;
    }
    
    const savingsData = ENERGY_SAVINGS_DATA[tekKey];
    if (!savingsData) return 0;
    
    let savingsPerBRA = 0;
    
    if (measure === 'Utskiftning av vindu') {
      savingsPerBRA = savingsData[buildingCategory][0.75] || 0;
    } else if (measure === 'Etterisolering av yttervegg') {
      savingsPerBRA = savingsData[buildingCategory]['etteriso_yttervegg'] || 0;
    } else if (measure === 'Isolering av kjeller og loft') {
      savingsPerBRA = savingsData[buildingCategory]['etteriso_takloft'] || 0;
    }
    
    const bra = buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt || 0;
    return savingsPerBRA * bra;
  };
  
  // Calculate savings for a measure
  const calculateSavings = (measure: string): number => {
    
    // Special handling for measures that don't need building year
    if (measure === 'Solenergi') {
      const solarEnergy = buildingData?.filteredSolarEnergy || 0;
      return solarEnergy;
    }
    
    const byggeaar = buildingData?.byggeaar || buildingData?.csvData?.byggeaar;
    if (!byggeaar || !yearlyConsumption) {
      return 0;
    }
    
    const tek = calculateTEK(byggeaar);
    
    // Determine building category
    const buildingTypeCode = buildingData?.bygningstypeKode?.substring(0, 2) || 
                            buildingData?.csvData?.bygningstypekode?.substring(0, 2) ||
                            buildingData?.csvData?.bygningstypeKode?.substring(0, 2);
    
    
    const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode || '');
    const isBlokk = ['14', '15', '16', '17'].includes(buildingTypeCode || '');
    const buildingCategory = isSmåhus ? 'småhus' : isBlokk ? 'blokk' : null;
    
    
    if (!buildingCategory) {
      // Fallback to string matching if code is not available
      const typeString = buildingData?.bygningstype?.toLowerCase() || 
                        buildingData?.csvData?.bygningstypenavn?.toLowerCase() || '';
      if (typeString.includes('enebolig') || typeString.includes('tomannsbolig') || 
          typeString.includes('rekkehus') || typeString.includes('kjedehus')) {
        return calculateSavingsForCategory('småhus', measure, tek, yearlyConsumption);
      } else if (typeString.includes('blokk') || typeString.includes('leilighet') || 
                 typeString.includes('boligbygg')) {
        return calculateSavingsForCategory('blokk', measure, tek, yearlyConsumption);
      }
      return 0;
    }
    
    // Get TEK key for the data structure
    let tekKey: string | number = tek;
    if (tek.startsWith('TEK')) {
      const tekNumber = parseInt(tek.substring(3));
      tekKey = tekNumber;
    }
    
    const savingsData = ENERGY_SAVINGS_DATA[tekKey];
    if (!savingsData) {
      return 0;
    }
    
    
    let savingsPerBRA = 0; // kWh/m² saved
    
    if (measure === 'Utskiftning av vindu') {
      // For windows, we'll use U-value 0.75 as default
      savingsPerBRA = savingsData[buildingCategory][0.75] || 0;
    } else if (measure === 'Etterisolering av yttervegg') {
      savingsPerBRA = savingsData[buildingCategory]['etteriso_yttervegg'] || 0;
    } else if (measure === 'Isolering av kjeller og loft') {
      savingsPerBRA = savingsData[buildingCategory]['etteriso_takloft'] || 0;
    } else if (measure === 'Varmepumpe') {
      // For heat pump, we'll estimate 30% savings
      const consumptionNum = parseFloat(yearlyConsumption);
      return (consumptionNum * 30) / 100;
    } else if (measure === 'Solenergi') {
      // For solar panels, use the calculated filtered solar energy
      const solarEnergy = buildingData?.filteredSolarEnergy || 0;
      
      
      return solarEnergy;
    } else if (measure === 'Tetting') {
      // Simple 5% for tetting
      const consumptionNum = parseFloat(yearlyConsumption);
      return (consumptionNum * 5) / 100;
    } else if (measure === 'Temperaturstyring') {
      // Simple 10% for temperature control
      const consumptionNum = parseFloat(yearlyConsumption);
      return (consumptionNum * 10) / 100;
    } else if (measure === 'Ventilasjon') {
      // Simple 10% for ventilation
      const consumptionNum = parseFloat(yearlyConsumption);
      return (consumptionNum * 10) / 100;
    }
    
    // Calculate total kWh saved = savings per m² * total m²
    const bra = buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt || 0;
    const totalSavings = savingsPerBRA * bra;
    
    
    return totalSavings;
  };
  
  // Calculate new energy rating after applying selected measures
  const calculateNewRating = (): string | null => {
    if (!estimatedRating || !yearlyConsumption || checkedItems.size === 0) return null;
    
    const consumptionNum = parseFloat(yearlyConsumption);
    if (isNaN(consumptionNum) || consumptionNum <= 0) return null;
    
    // Calculate total savings in kWh
    let totalSavingsKWh = 0;
    checkedItems.forEach(index => {
      const measure = ENERGY_SOLUTIONS[index];
      const savings = calculateSavings(measure);
      totalSavingsKWh += savings;
    });
    
    // Calculate new consumption
    const newConsumption = Math.max(0, consumptionNum - totalSavingsKWh);
    
    // Get bruksareal from buildingData
    const bra = buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt;
    if (!bra || bra <= 0) return null;
    
    // Calculate new energy intensity
    const newIntensity = newConsumption / bra;
    
    // Determine building type based on code
    const buildingTypeCode = buildingData?.bygningstypeKode?.substring(0, 2) || buildingData?.csvData?.bygningstypekode?.substring(0, 2);
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
  
  const newRating = calculateNewRating();

  const toggleChecked = (index: number) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div 
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '55px',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        opacity: showHeader && !isExpanded ? 1 : 0,
        transition: 'opacity 0.5s ease-in-out' + (showHeader && !isExpanded ? ' 0.5s' : isExpanded ? '' : ' 0.8s'),
        zIndex: 1000
      }}
    >
      {/* Input field for yearly consumption */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        width: '471px'
      }}>
        <label style={{
          fontFamily: 'Oslo Sans, sans-serif',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: '24px',
          letterSpacing: '-0.2px',
          color: 'white',
          flexShrink: 0
        }}>
          {estimatedRating ? `Estimert energikarakter: ${estimatedRating}` : 'Estimering av energikarakter'}
        </label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginLeft: 'auto'
        }}>
          <input
            type="text"
            value={yearlyConsumption}
            onChange={(e) => setYearlyConsumption(e.target.value)}
            placeholder="Oppgi årlig forbruk"
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontFamily: 'Oslo Sans, sans-serif',
              fontSize: '16px',
              width: '170px',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.6)';
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
          />
          <span style={{
            fontFamily: 'Oslo Sans, sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: '24px',
            letterSpacing: '-0.2px',
            color: 'white'
          }}>
            kWh
          </span>
        </div>
      </div>
      
      {/* Energy rating boxes - only show when consumption is entered */}
      {yearlyConsumption && !isNaN(parseFloat(yearlyConsumption)) && parseFloat(yearlyConsumption) > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          alignItems: 'center'
        }}>
        {[
          { letter: 'A', color: '#097E3E' },
          { letter: 'B', color: '#32A548' },
          { letter: 'C', color: '#96C133' },
          { letter: 'D', color: '#EFE61E' },
          { letter: 'E', color: '#F7AD24' },
          { letter: 'F', color: '#EA6927' },
          { letter: 'G', color: '#E31829' }
        ].map((rating) => {
          const isEstimated = estimatedRating === rating.letter;
          const isNew = newRating === rating.letter;
          const size = (isEstimated || isNew) ? '60px' : '40px';
          const fontSize = (isEstimated || isNew) ? '24px' : '18px';
          
          return (
            <div
              key={rating.letter}
              style={{
                width: size,
                height: size,
                backgroundColor: rating.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                position: 'relative',
                border: isNew ? '3px solid white' : 'none'
              }}
            >
              <span style={{
                fontFamily: 'Oslo Sans, sans-serif',
                fontWeight: 500,
                fontSize: fontSize,
                lineHeight: '22px',
                letterSpacing: '-0.2px',
                color: 'white'
              }}>
                {rating.letter}
              </span>
              {isNew && (
                <div style={{
                  position: 'absolute',
                  bottom: '-20px',
                  fontSize: '12px',
                  fontFamily: 'Oslo Sans, sans-serif',
                  color: 'white',
                  whiteSpace: 'nowrap'
                }}>
                  Ny
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
      
      {/* "Hvordan estimerer vi energikarakteren?" text - only show when rating boxes are visible */}
      {yearlyConsumption && !isNaN(parseFloat(yearlyConsumption)) && parseFloat(yearlyConsumption) > 0 && (
        <div style={{ 
          marginBottom: '32px',
          textAlign: 'left'
        }}>
          <text
            style={{
              fontFamily: 'Oslo Sans, sans-serif',
              fontWeight: 300,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '28px',
              letterSpacing: '-0.2px',
              color: 'white',
              textDecoration: 'underline',
              textDecorationStyle: 'solid',
              cursor: 'pointer'
            }}
          >
            Hvordan estimerer vi energikarakteren?
          </text>
        </div>
      )}
      
      {/* Title text with toggle button */}
      <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <text 
          style={{
            fontFamily: 'Oslo Sans, sans-serif',
            fontWeight: 500,
            fontStyle: 'normal',
            fontSize: '24px',
            lineHeight: '36px',
            letterSpacing: '-0.2px',
            color: 'white'
          }}
        >
          Tiltak for din bolig
        </text>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0',
            lineHeight: '1',
            transform: showDetails ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        >
          *
        </button>
      </div>
      
      {/* Collapsible details section */}
      {showDetails && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {/* Toggle button for gul_liste */}
          <div style={{
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <label style={{
              fontSize: '14px',
              color: 'white',
              fontFamily: 'Oslo Sans, sans-serif',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <input
                type="checkbox"
                checked={gul_liste}
                onChange={(e) => {
                  setGul_liste(e.target.checked);
                  if (onToggleYellowBox) {
                    onToggleYellowBox(e.target.checked);
                  }
                }}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer'
                }}
              />
              Vis gul informasjonsboks
            </label>
          </div>
          {yearlyConsumption && checkedItems.size > 0 && (
            <div style={{
              fontSize: '14px',
              color: 'white',
              fontFamily: 'Oslo Sans, sans-serif'
            }}>
              <div>Byggeår: {buildingData?.byggeaar || buildingData?.csvData?.byggeaar || 'Ukjent'} - TEK: {buildingData?.byggeaar || buildingData?.csvData?.byggeaar ? calculateTEK(buildingData?.byggeaar || buildingData?.csvData?.byggeaar) : 'N/A'}</div>
              <div>Opprinnelig forbruk: {yearlyConsumption} kWh</div>
              <div>Total besparelse: {(() => {
                let totalSavingsKWh = 0;
                const details: string[] = [];
                checkedItems.forEach(index => {
                  const measure = ENERGY_SOLUTIONS[index];
                  const savings = calculateSavings(measure);
                  if (savings > 0) {
                    details.push(`${measure}: ${Math.round(savings)} kWh`);
                  }
                  totalSavingsKWh += savings;
                });
                return `${Math.round(totalSavingsKWh)} kWh (${details.join(', ')})`;
              })()}</div>
              <div>Nytt forbruk: {(() => {
                const consumptionNum = parseFloat(yearlyConsumption);
                let totalSavingsKWh = 0;
                checkedItems.forEach(index => {
                  const measure = ENERGY_SOLUTIONS[index];
                  const savings = calculateSavings(measure);
                  totalSavingsKWh += savings;
                });
                return Math.round(Math.max(0, consumptionNum - totalSavingsKWh));
              })()} kWh</div>
            </div>
          )}
        </div>
      )}
      
      {/* Render 8 energy solution buttons */}
      {ENERGY_SOLUTIONS.map((buttonText, index) => (
        <svg 
          key={index} 
          width="471" 
          height="50" 
          viewBox="0 0 471 50" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          style={{ 
            cursor: 'pointer',
            transition: 'all 0.3s ease-in-out'
          }}
        >
          <rect 
            x="1" 
            y="1" 
            width="469" 
            height="48" 
            stroke="#F9F9F9" 
            strokeWidth="2" 
            fill={hoveredIndex === index || checkedItems.has(index) ? "#F8F0DD" : "none"}
            style={{ transition: 'fill 0.3s ease-in-out' }}
          />
          <text 
            x="17" 
            y="29" 
            fontFamily="Oslo Sans, sans-serif" 
            fontWeight="500" 
            fontStyle="normal"
            fontSize="18" 
            lineHeight="28"
            letterSpacing="-0.2"
            fill={hoveredIndex === index || checkedItems.has(index) ? "#2A2859" : "#F9F9F9"} 
            textAnchor="start"
            style={{ transition: 'fill 0.3s ease-in-out' }}
          >
            {buttonText}
          </text>
          {/* Hover buttons - fade in/out */}
          {(hoveredIndex === index || checkedItems.has(index)) && (
            <g 
              style={{ 
                opacity: 1,
                animation: 'fadeIn 0.3s ease-in-out'
              }}
            >
            {/* Right rectangle: width 90px, 16px from right edge - clickable */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                toggleChecked(index);
              }}
              style={{ cursor: 'pointer' }}
            >
                <rect x="365" y="10" width="90" height="30" fill="#2A2859"/>
                {/* "Legg til" text in right rectangle */}
                <text 
                  x="373" 
                  y="25" 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontWeight="500" 
                  fontStyle="normal"
                  fontSize="14" 
                  lineHeight="22"
                  letterSpacing="-0.2"
                  fill="#F9F9F9" 
                  textAnchor="start"
                  dominantBaseline="middle"
                >
                  Legg til
                </text>
                {/* Checkbox icon 8px from right edge */}
                <g transform="translate(431, 17)">
                  {checkedItems.has(index) ? (
                    <>
                      <rect x="1" y="1" width="14" height="14" fill="#2A2859"/>
                      <rect x="1" y="1" width="14" height="14" stroke="#2A2859" strokeWidth="2"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M11.8521 6.1071L6.99857 10.9607L4.14502 8.1071L4.85213 7.39999L6.99857 9.54644L11.145 5.39999L11.8521 6.1071Z" fill="white"/>
                    </>
                  ) : (
                    <>
                      <rect x="1" y="1" width="14" height="14" fill="white"/>
                      <rect x="1" y="1" width="14" height="14" stroke="#2A2859" strokeWidth="2"/>
                    </>
                  )}
                </g>
              </g>
              {/* Left rectangle: width 70px, 8px gap to right rectangle */}
              <g
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSolution(ENERGY_SOLUTIONS[index]);
                  onExpand(true);
                }}
                style={{ cursor: 'pointer' }}
              >
                <rect x="287" y="10" width="70" height="30" fill="#2A2859"/>
                {/* "Les mer" text centered in left rectangle */}
                <text 
                  x="322" 
                  y="25" 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontWeight="500" 
                  fontStyle="normal"
                  fontSize="14" 
                  lineHeight="22"
                  letterSpacing="-0.2"
                  fill="#F9F9F9" 
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  Les mer
                </text>
              </g>
            </g>
          )}
          
          {/* "Godtgjørelse" label - only visible when not hovering */}
          {!(hoveredIndex === index || checkedItems.has(index)) && (
            <g>
            <rect width="92" height="30" transform="translate(363 10)" fill="#C7F6C9"/>
            <path d="M376.726 30.14C373.8 30.14 371.672 28.082 371.672 24.778C371.672 21.558 373.926 19.5 376.572 19.5C378.35 19.5 379.722 20.298 380.464 21.838L379.036 22.636C378.574 21.642 377.664 21.068 376.572 21.068C374.92 21.068 373.38 22.23 373.38 24.764C373.38 27.298 374.822 28.642 376.852 28.642C377.748 28.642 378.434 28.46 379.05 28.124V25.66H375.62V24.204H380.492V28.964C379.47 29.748 378.14 30.14 376.726 30.14ZM385.568 30.14C383.636 30.14 382.054 28.628 382.054 26.248C382.054 23.924 383.622 22.412 385.568 22.412C387.514 22.412 389.082 23.924 389.082 26.248C389.082 28.628 387.5 30.14 385.568 30.14ZM385.568 28.81C386.618 28.81 387.472 27.998 387.472 26.248C387.472 24.484 386.604 23.742 385.568 23.742C384.532 23.742 383.664 24.484 383.664 26.248C383.664 27.998 384.532 28.81 385.568 28.81ZM395.625 19.64H397.193V30H395.625V28.656C395.051 29.692 394.155 30.112 393.301 30.112C391.509 30.112 390.221 28.572 390.221 26.318C390.221 23.98 391.523 22.426 393.483 22.426C394.323 22.426 395.163 22.804 395.625 23.714V19.64ZM393.721 28.74C394.855 28.74 395.625 27.97 395.625 26.234C395.625 24.512 394.869 23.686 393.721 23.686C392.643 23.686 391.845 24.554 391.845 26.234C391.845 27.9 392.643 28.74 393.721 28.74ZM401.306 27.704C401.306 28.53 401.81 28.782 402.328 28.782C402.734 28.782 403.056 28.614 403.378 28.292L404.05 29.3C403.49 29.86 402.874 30.126 402.076 30.126C400.788 30.126 399.738 29.342 399.738 27.802V23.798H398.436V22.58H399.738V20.928L401.306 20.214V22.58H403.924V23.798H401.306V27.704ZM413.841 27.662L414.905 28.278C414.485 29.202 413.505 30.126 411.811 30.126C409.613 30.126 408.283 28.502 408.283 26.22C408.283 23.966 409.725 22.412 411.699 22.412C413.449 22.412 414.891 23.588 414.891 25.688L414.863 26.612H409.823C409.907 28.18 410.677 28.852 411.909 28.852C412.819 28.852 413.449 28.362 413.841 27.662ZM411.699 23.644C410.747 23.644 409.949 24.148 409.823 25.492H413.365C413.379 24.176 412.567 23.644 411.699 23.644ZM423.683 23.798H422.129V23.966C422.381 24.316 422.507 24.722 422.507 25.142C422.507 26.486 421.471 27.83 419.315 27.83H418.951C418.195 27.83 417.705 28.082 417.705 28.53C417.705 28.838 417.943 29.062 418.419 29.062H421.513C422.787 29.062 423.515 29.72 423.515 30.728C423.515 32.254 421.961 33.136 419.483 33.136C417.313 33.136 415.857 32.59 415.479 31.148L417.005 30.854C417.355 31.75 418.167 31.988 419.525 31.988C420.981 31.988 422.017 31.596 422.017 30.91C422.017 30.588 421.835 30.35 421.331 30.35H417.957C416.795 30.35 416.193 29.72 416.193 28.936C416.193 28.18 416.865 27.578 417.789 27.396C416.767 26.948 416.263 25.996 416.263 25.1C416.263 23.77 417.341 22.412 419.399 22.412C420.309 22.412 421.023 22.734 421.443 23.196V22.58H423.683V23.798ZM419.399 26.696C420.477 26.696 420.981 25.94 420.981 25.128C420.981 24.316 420.477 23.574 419.399 23.574C418.335 23.574 417.817 24.316 417.817 25.128C417.817 25.94 418.335 26.696 419.399 26.696ZM428.599 22.412C430.111 22.412 431.007 23.392 431.007 25.002V30H429.439V25.254C429.439 24.232 428.949 23.77 428.095 23.77C426.989 23.77 426.429 24.54 426.429 25.982V30H424.861V22.58H426.429V23.644C426.933 22.86 427.675 22.412 428.599 22.412ZM438.179 27.662L439.243 28.278C438.823 29.202 437.843 30.126 436.149 30.126C433.951 30.126 432.621 28.502 432.621 26.22C432.621 23.966 434.063 22.412 436.037 22.412C437.787 22.412 439.229 23.588 439.229 25.688L439.201 26.612H434.161C434.245 28.18 435.015 28.852 436.247 28.852C437.157 28.852 437.787 28.362 438.179 27.662ZM436.037 23.644C435.085 23.644 434.287 24.148 434.161 25.492H437.703C437.717 24.176 436.905 23.644 436.037 23.644ZM442.926 27.704C442.926 28.53 443.43 28.782 443.948 28.782C444.354 28.782 444.676 28.614 444.998 28.292L445.67 29.3C445.11 29.86 444.494 30.126 443.696 30.126C442.408 30.126 441.358 29.342 441.358 27.802V23.798H440.056V22.58H441.358V20.928L442.926 20.214V22.58H445.544V23.798H442.926V27.704Z" fill="#2A2859"/>
            </g>
          )}
        </svg>
      ))}
    </div>
  );
};