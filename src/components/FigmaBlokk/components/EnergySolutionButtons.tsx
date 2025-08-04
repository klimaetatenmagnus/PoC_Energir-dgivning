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
  yearlyConsumption?: string;
  onProcessClick?: () => void;
}

export const EnergySolutionButtons: React.FC<EnergySolutionButtonsProps> = ({ showHeader, isExpanded, onExpand, onSelectSolution, buildingData, showYellowBox = true, onToggleYellowBox, yearlyConsumption = '', onProcessClick }) => {
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
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [gul_liste, setGul_liste] = useState<boolean>(showYellowBox);
  
  // Helper function to compare energy ratings (A is better than G)
  const isRatingBetter = (rating1: string, rating2: string): boolean => {
    const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const index1 = order.indexOf(rating1.toUpperCase());
    const index2 = order.indexOf(rating2.toUpperCase());
    return index1 < index2;
  };

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
  
  // Check if we have Enova certificate rating, otherwise use estimated
  const enovaRating = buildingData?.energiattest?.energikarakter?.toUpperCase();
  const calculatedRating = calculateEnergyRating(yearlyConsumption);
  const estimatedRating = enovaRating || calculatedRating;
  
  
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
    
    // Ensure new rating is never worse than current rating
    if (estimatedRating && !isRatingBetter(rating, estimatedRating)) {
      rating = estimatedRating;
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
      {/* Energy rating label */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        width: '471px',
        position: 'relative'
      }}>
        <label style={{
          fontFamily: 'Oslo Sans, sans-serif',
          fontWeight: 400,
          fontSize: '24px',
          lineHeight: '24px',
          letterSpacing: '-0.2px',
          color: 'white',
          flexShrink: 0
        }}>
          {estimatedRating ? `${enovaRating ? 'Energikarakter fra Enova' : 'Estimert energikarakter'}: ${estimatedRating}` : 'Beregner energikarakter...'}
        </label>
        {/* Info icon aligned with right edge of G rating box */}
        <svg 
          width="32" 
          height="32" 
          viewBox="0 0 32 32" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            left: '439px', // 471px - 32px (icon width) = 439px to align with right edge
            cursor: 'pointer'
          }}
        >
          <path d="M15.93 7.6C17.1356 7.5897 18.3022 8.02698 19.204 8.82721C20.1058 9.62744 20.6787 10.7337 20.8118 11.932C20.945 13.1303 20.6289 14.3354 19.9247 15.314C19.2206 16.2927 18.1785 16.9754 17 17.23H16.94V18.91H14.94V15.35H15.94C16.479 15.3516 17.0077 15.2019 17.4658 14.9179C17.924 14.634 18.2932 14.2271 18.5316 13.7437C18.77 13.2602 18.8679 12.7196 18.8142 12.1832C18.7606 11.6469 18.5574 11.1364 18.228 10.7098C17.8986 10.2831 17.456 9.95754 16.9507 9.76998C16.4453 9.58243 15.8975 9.54045 15.3695 9.64883C14.8415 9.75721 14.3545 10.0116 13.9639 10.383C13.5733 10.7545 13.2948 11.2281 13.16 11.75V11.92L11.16 11.53C11.3793 10.425 11.9741 9.42996 12.8436 8.71364C13.713 7.99731 14.8035 7.60384 15.93 7.6ZM16 3C13.4288 3 10.9154 3.76244 8.77759 5.1909C6.63975 6.61935 4.97351 8.64968 3.98957 11.0251C3.00563 13.4006 2.74818 16.0144 3.24979 18.5362C3.7514 21.0579 4.98953 23.3743 6.80761 25.1924C8.62569 27.0105 10.9421 28.2486 13.4638 28.7502C15.9856 29.2518 18.5994 28.9944 20.9749 28.0104C23.3503 27.0265 25.3806 25.3603 26.8091 23.2224C28.2376 21.0846 29 18.5712 29 16C29 12.5522 27.6304 9.24558 25.1924 6.80761C22.7544 4.36964 19.4478 3 16 3ZM16 1C18.9667 1 21.8668 1.87973 24.3336 3.52796C26.8003 5.17618 28.7229 7.51886 29.8582 10.2597C30.9935 13.0006 31.2906 16.0166 30.7118 18.9264C30.133 21.8361 28.7044 24.5088 26.6066 26.6066C24.5088 28.7044 21.8361 30.133 18.9264 30.7118C16.0166 31.2906 13.0006 30.9935 10.2597 29.8582C7.51886 28.7229 5.17618 26.8003 3.52796 24.3336C1.87973 21.8668 1 18.9667 1 16C1 12.0218 2.58035 8.20644 5.3934 5.3934C8.20644 2.58035 12.0218 1 16 1Z" fill="white"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M17.65 22.38C17.648 22.7197 17.5455 23.0513 17.3553 23.3328C17.1651 23.6144 16.8958 23.8333 16.5813 23.9619C16.2669 24.0906 15.9213 24.1232 15.5884 24.0557C15.2554 23.9882 14.9498 23.8236 14.7103 23.5827C14.4707 23.3418 14.3079 23.0353 14.2424 22.7019C14.1768 22.3685 14.2114 22.0232 14.3419 21.7095C14.4724 21.3958 14.6928 21.1277 14.9755 20.9392C15.2581 20.7506 15.5902 20.65 15.93 20.65C16.1567 20.65 16.3812 20.6948 16.5905 20.7819C16.7999 20.8689 16.9899 20.9965 17.1498 21.1573C17.3096 21.3181 17.4361 21.5089 17.522 21.7187C17.6078 21.9285 17.6513 22.1533 17.65 22.38Z" fill="white"/>
        </svg>
      </div>
      
      {/* Energy rating boxes */}
      <div style={{
          display: 'flex',
          gap: '0', // We'll use margin on each box instead for dynamic spacing
          marginBottom: '12px',
          alignItems: 'flex-end',
          width: '471px', // Fixed total width to match tiltak list
          justifyContent: 'flex-start'
        }}>
        {[
          { letter: 'A', color: '#097E3E' },
          { letter: 'B', color: '#32A548' },
          { letter: 'C', color: '#96C133' },
          { letter: 'D', color: '#EFE61E' },
          { letter: 'E', color: '#F7AD24' },
          { letter: 'F', color: '#EA6927' },
          { letter: 'G', color: '#E31829' }
        ].map((rating, index, array) => {
          const isEstimated = estimatedRating === rating.letter;
          const isNew = newRating === rating.letter;
          const size = (isEstimated || isNew) ? '73px' : '53.5px';
          const fontSize = (isEstimated || isNew) ? '45px' : '33px';
          
          // Calculate total width of all boxes
          const totalBoxWidth = array.reduce((acc, r) => {
            const isLarge = (estimatedRating === r.letter || newRating === r.letter);
            return acc + (isLarge ? 73 : 53.5);
          }, 0);
          
          // Calculate gap to distribute evenly
          const remainingSpace = 471 - totalBoxWidth;
          const gapSize = remainingSpace / (array.length - 1);
          
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
                border: isNew ? '3px solid white' : 'none',
                marginRight: index < array.length - 1 ? `${gapSize}px` : '0'
              }}
            >
              <span style={{
                fontFamily: 'Oslo Sans, sans-serif',
                fontWeight: 500,
                fontStyle: 'normal',
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
      
      {/* New bottom box with #2A2859 background */}
      <svg 
        width="471" 
        height="50" 
        viewBox="0 0 471 50" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ 
          transition: 'all 0.3s ease-in-out',
          cursor: 'pointer'
        }}
        onClick={onProcessClick}
      >
        <rect 
          x="0" 
          y="0" 
          width="471" 
          height="50" 
          fill="#2A2859"
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
          fill="#F9F9F9" 
          textAnchor="start"
        >
          Prosessen videre
        </text>
        {/* Dropdown arrow icon - 16px from right edge, 8px from top */}
        <svg x="431" y="8" width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 16.56L4.7466 9.5L3.75 10.47L12 18.5L20.25 10.47L19.2534 9.5L12 16.56Z" fill="white"/>
        </svg>
      </svg>
    </div>
  );
};