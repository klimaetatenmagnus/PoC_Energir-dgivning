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
  onCloseYellowBox?: () => void;
  onTotalSavingsChange?: (savings: number) => void;
}

export const EnergySolutionButtons: React.FC<EnergySolutionButtonsProps> = ({ showHeader, isExpanded, onExpand, onSelectSolution, buildingData, showYellowBox = true, onToggleYellowBox, yearlyConsumption = '', onProcessClick, onCloseYellowBox, onTotalSavingsChange }) => {
  // Add CSS for fade animation
  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUpFadeIn {
        from { 
          opacity: 0;
          transform: translateY(20px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
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
  const [hasClickedReadMore, setHasClickedReadMore] = useState<boolean>(false);
  const [showEnergyInfo, setShowEnergyInfo] = useState<boolean>(false);
  
  // Helper function to compare energy ratings (A is better than G)
  const isRatingBetter = React.useCallback((rating1: string, rating2: string): boolean => {
    const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const index1 = order.indexOf(rating1.toUpperCase());
    const index2 = order.indexOf(rating2.toUpperCase());
    return index1 < index2;
  }, []);

  // Calculate energy rating based on consumption
  const calculateEnergyRating = (consumption: string): string | null => {
    const consumptionNum = parseFloat(consumption);
    if (isNaN(consumptionNum) || consumptionNum <= 0) return null;
    
    // Get bruksareal from buildingData
    const bra = buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt;
    if (!bra || bra <= 0) return null;
    
    // Calculate energy intensity (kWh/m²/year)
    const intensity = consumptionNum / bra;
    
    // Determine building type based on code or name
    const buildingTypeCode = buildingData?.bygningstypeKode?.substring(0, 2) || buildingData?.csvData?.bygningstypekode?.substring(0, 2);
    const buildingTypeName = buildingData?.bygningstype || buildingData?.csvData?.bygningstype || '';
    
    // Check by code first, then by name
    const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode || '') ||
                     buildingTypeName.toLowerCase().includes('enebolig') ||
                     buildingTypeName.toLowerCase().includes('tomannsbolig') ||
                     buildingTypeName.toLowerCase().includes('rekkehus') ||
                     buildingTypeName.toLowerCase().includes('kjedehus');
    
    const isBlokk = ['14', '15', '16', '17'].includes(buildingTypeCode || '') ||
                    buildingTypeName.toLowerCase().includes('blokk') ||
                    buildingTypeName.toLowerCase().includes('leilighet') ||
                    buildingTypeName.toLowerCase().includes('boligbygg') ||
                    buildingTypeName.toLowerCase() === 'store boligbygg';
    
    // Debug logging - commented out for production
    // console.log('EnergySolutionButtons calculateEnergyRating:', {
    //   consumption: consumptionNum,
    //   bra,
    //   intensity,
    //   buildingTypeCode,
    //   buildingTypeName,
    //   isSmåhus,
    //   isBlokk,
    //   fThreshold: isBlokk ? 200 + 4000/bra : (isSmåhus ? 250 + 8000/bra : 225 + 6000/bra)
    // });
    
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
    
    // console.log('EnergySolutionButtons final rating:', rating);
    return rating;
  };
  
  // Check if we have Enova certificate rating, otherwise use estimated
  const enovaRating = buildingData?.energiattest?.energikarakter?.toUpperCase();
  const calculatedRating = React.useMemo(() => {
    return calculateEnergyRating(yearlyConsumption);
  }, [yearlyConsumption, buildingData?.bruksarealM2, buildingData?.csvData?.bruksareal_totalt, 
      buildingData?.bygningstypeKode, buildingData?.csvData?.bygningstypekode, 
      buildingData?.bygningstype, buildingData?.csvData?.bygningstype]);
  const estimatedRating = enovaRating || calculatedRating;
  
  // Determine building type for UI display
  const buildingTypeCode = buildingData?.bygningstypeKode?.substring(0, 2) || buildingData?.csvData?.bygningstypekode?.substring(0, 2);
  const buildingTypeName = buildingData?.bygningstype || buildingData?.csvData?.bygningstype || '';
  const isBlokk = ['14', '15', '16', '17'].includes(buildingTypeCode || '') ||
                  buildingTypeName.toLowerCase().includes('blokk') ||
                  buildingTypeName.toLowerCase().includes('leilighet') ||
                  buildingTypeName.toLowerCase().includes('boligbygg') ||
                  buildingTypeName.toLowerCase() === 'store boligbygg';
  
  
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
  const calculateTEK = React.useCallback((byggeaar: number): string => {
    const terskel = 2; // lag i år i forhold til tek
    
    // TEK years with threshold applied
    if (byggeaar >= 2007 + terskel) return "TEK7";      // 2009 and newer
    if (byggeaar >= 1997 + terskel) return "TEK97";     // 1999-2008
    if (byggeaar >= 1987 + terskel) return "TEK87";     // 1989-1998
    if (byggeaar >= 1969 + terskel) return "TEK69";     // 1971-1988
    if (byggeaar >= 1949 + terskel) return "TEK49";     // 1951-1970
    
    // Older than 1951
    return "eldre";
  }, []);
  
  // Helper function to calculate savings for a specific building category
  const calculateSavingsForCategory = React.useCallback((buildingCategory: 'småhus' | 'blokk', measure: string, tek: string, consumption: string): number => {
    // Get TEK key for the data structure
    let tekKey: string | number = tek;
    if (tek.startsWith('TEK')) {
      const tekNumber = parseInt(tek.substring(3));
      tekKey = tekNumber;
    }
    
    const savingsData = ENERGY_SAVINGS_DATA[tekKey];
    if (!savingsData) return 0;
    
    let savingsPerBRA = 0;
    
    if (measure === 'Oppgradering av vindu') {
      savingsPerBRA = savingsData[buildingCategory][0.75] || 0;
    } else if (measure === 'Etterisolering av yttervegg') {
      savingsPerBRA = savingsData[buildingCategory]['etteriso_yttervegg'] || 0;
    } else if (measure === 'Isolering av kjeller og loft') {
      savingsPerBRA = savingsData[buildingCategory]['etteriso_takloft'] || 0;
    }
    
    const bra = buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt || 0;
    return savingsPerBRA * bra;
  }, [buildingData, ENERGY_SAVINGS_DATA]);
  
  // Calculate savings for a measure
  const calculateSavings = React.useCallback((measure: string): number => {
    
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
    
    if (measure === 'Oppgradering av vindu') {
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
  }, [yearlyConsumption, buildingData, calculateTEK, calculateSavingsForCategory, ENERGY_SAVINGS_DATA]);
  
  // Calculate new energy rating after applying selected measures
  const calculateNewRating = React.useCallback((): string | null => {
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
    
    // Determine building type based on code or name
    const buildingTypeCode = buildingData?.bygningstypeKode?.substring(0, 2) || buildingData?.csvData?.bygningstypekode?.substring(0, 2);
    const buildingTypeName = buildingData?.bygningstype || buildingData?.csvData?.bygningstype || '';
    
    // Check by code first, then by name (same logic as calculateEnergyRating)
    const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode || '') ||
                     buildingTypeName.toLowerCase().includes('enebolig') ||
                     buildingTypeName.toLowerCase().includes('tomannsbolig') ||
                     buildingTypeName.toLowerCase().includes('rekkehus') ||
                     buildingTypeName.toLowerCase().includes('kjedehus');
    
    const isBlokk = ['14', '15', '16', '17'].includes(buildingTypeCode || '') ||
                    buildingTypeName.toLowerCase().includes('blokk') ||
                    buildingTypeName.toLowerCase().includes('leilighet') ||
                    buildingTypeName.toLowerCase().includes('boligbygg') ||
                    buildingTypeName.toLowerCase() === 'store boligbygg';
    
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
  }, [estimatedRating, yearlyConsumption, checkedItems, buildingData, calculateSavings, isRatingBetter]);
  
  const newRating = React.useMemo(() => calculateNewRating(), [calculateNewRating]);

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
  
  // Calculate total savings whenever checked items change
  React.useEffect(() => {
    if (onTotalSavingsChange) {
      let totalSavingsKWh = 0;
      checkedItems.forEach(index => {
        const measure = ENERGY_SOLUTIONS[index];
        const savings = calculateSavings(measure);
        totalSavingsKWh += savings;
      });
      onTotalSavingsChange(totalSavingsKWh);
    }
  }, [checkedItems, yearlyConsumption, buildingData, onTotalSavingsChange]);

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
        zIndex: 1000,
        pointerEvents: showHeader && !isExpanded ? 'auto' : 'none'
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
          flexShrink: 0,
          opacity: showEnergyInfo ? 0 : 1
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
            cursor: 'pointer',
            opacity: showEnergyInfo ? 0 : 1
          }}
          onClick={() => setShowEnergyInfo(true)}
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
        <span 
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
          Velg tiltak for din bolig
        </span>
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
                setHasClickedReadMore(true);
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
        </svg>
      ))}
      
      {/* New bottom box with #2A2859 background - only show if user has clicked "Legg til" */}
      {hasClickedReadMore && (
        <div
          style={{
            animation: 'slideUpFadeIn 0.4s ease-out forwards',
            marginTop: '0px'
          }}
        >
          <svg 
            width="471" 
            height="50" 
            viewBox="0 0 471 50" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ 
              cursor: 'pointer',
              display: 'block'
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
              letterSpacing="-0.2"
              fill="#F9F9F9" 
              textAnchor="start"
            >
              Hvordan gjennomføre tiltakene
            </text>
            {/* Dropdown arrow icon - 16px from right edge, 8px from top */}
            <svg x="431" y="8" width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 16.56L4.7466 9.5L3.75 10.47L12 18.5L20.25 10.47L19.2534 9.5L12 16.56Z" fill="white"/>
            </svg>
          </svg>
        </div>
      )}

      {/* Energy Info Modal */}
      {showEnergyInfo && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0px',
              padding: '32px',
              width: '471px',
              height: '700px',
              position: 'absolute',
              bottom: '0px',
              left: '50%',
              transform: 'translateX(-50%)',
              overflow: 'auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowEnergyInfo(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
                <path d="M6 6L18 18" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#333' }}>
              Hvordan fungerer siden?
            </h2>

            <div style={{ color: '#555', lineHeight: '1.6' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: '#333' }}>
                Innhenting av data
              </h3>
              <p style={{ marginBottom: '16px' }}>
                Informasjon om bygningen din hentes automatisk fra Matrikkelen (Norges offisielle eiendomsregister). 
                Dette inkluderer bygningstype, byggeår, bruksareal (BRA) og om bygningen er på Gul liste.
              </p>

              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', marginTop: '24px', color: '#333' }}>
                Energikarakter
              </h3>
              <p style={{ marginBottom: '16px' }}>
                Energikarakteren viser hvor energieffektiv bygningen din er på en skala fra A til G, hvor A er best. 
                Karakteren beregnes ut fra grenseverdier fra{' '}
                <a 
                  href="https://www.enova.no/energimerking/karakterskalaen" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#0066CC', textDecoration: 'underline' }}
                >
                  Enova
                </a>
                {' '}for bygningens årlige energiforbruk per kvadratmeter (kWh/m²/år).
              </p>

              <p style={{ marginBottom: '16px' }}>
                {enovaRating ? (
                  isBlokk ? (
                    <>Blokkens energiforbruk beregnes fra energikarakteren til en av leilighetene. Deretter brukes de samme grenseverdiene fra Enova for å beregne energiforbruket for hele blokken basert på blokkens bruksareal.</>
                  ) : (
                    <>Din nåværende energikarakteren og energiforbruk er hentet direkte fra bygningens energiattest registrert hos Enova.</>
                  )
                ) : (
                  <>Siden bygningen ikke har en registrert energiattest, estimeres energiforbruket basert på byggeår og gjeldende teknisk forskrift (TEK) ved byggeåret. Vi bruker deretter de samme grenseverdiene fra Enova for å beregne en estimert energikarakter.</>
                )}
              </p>

              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', marginTop: '24px', color: '#333' }}>
                Beregning av besparelser
              </h3>
              <p style={{ marginBottom: '16px' }}>
                Besparelsene beregnes fra datasett som gir estimert besparelse basert på bygningstype, bruksareal (BRA) og 
                teknisk forskrift (TEK). Disse variablene hentes automatisk fra Matrikkelen, utenom TEK som estimeres ut fra byggeår. Dette er en forenkling som gjør at det ikke blir tatt hensyn til om bygget har tidligere blitt oppgradert.
              </p>
              <p style={{ marginBottom: '16px' }}>
                For solenergi hentes data fra Oslo kommunes{' '}
                <a 
                  href="https://od2.pbe.oslo.kommune.no/solkart/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#0066CC', textDecoration: 'underline' }}
                >
                  Solkart
                </a>
                . Alle takflater med solpotensial over 800 kWh/m² summeres og multipliseres. Deretter antas det at 85% av takarealet kan utnyttes til solceller, og at solcellene har en en virkningsgrad på 20%.
              </p>

              <p style={{ marginTop: '16px', fontSize: '16px', color: '#555', fontWeight: 'bold', lineHeight: '1.6' }}>
                Merk: Alle beregninger er estimater. Faktiske besparelser varierer ut ifra mange forskjellige faktorer.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};