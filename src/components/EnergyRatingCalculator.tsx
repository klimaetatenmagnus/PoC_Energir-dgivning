import React, { useState } from 'react';
import { PktButton, PktInput, PktAlert } from '@oslokommune/punkt-react';
import '../styles/components.css';

interface EnergyRatingCalculatorProps {
  address: string;
  onCalculate?: (result: EnergyRatingResult) => void;
}

interface EnergyRatingResult {
  rating: string;
  energyIntensity: number;
  description: string;
  bruksareal: number;
  yearlyConsumption: number;
}

export const EnergyRatingCalculator: React.FC<EnergyRatingCalculatorProps> = ({ address, onCalculate }) => {
  const [yearlyConsumption, setYearlyConsumption] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<EnergyRatingResult | null>(null);

  const handleCalculate = async () => {
    // Validate input
    const consumption = parseFloat(yearlyConsumption);
    if (isNaN(consumption) || consumption <= 0) {
      setError('Vennligst oppgi et gyldig årlig energiforbruk');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/energy-rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          yearlyConsumption: consumption,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kunne ikke beregne energimerke');
      }

      const data = await response.json();
      const ratingResult: EnergyRatingResult = {
        rating: data.rating,
        energyIntensity: data.energyIntensity,
        description: data.description,
        bruksareal: data.bruksareal,
        yearlyConsumption: data.yearlyConsumption,
      };

      setResult(ratingResult);
      if (onCalculate) {
        onCalculate(ratingResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'En ukjent feil oppstod');
    } finally {
      setIsLoading(false);
    }
  };

  const getRatingColor = (rating: string): string => {
    const colors: Record<string, string> = {
      'A': '#00882d',
      'B': '#50b848',
      'C': '#a8d400',
      'D': '#f9e814',
      'E': '#f7b500',
      'F': '#e85c00',
      'G': '#d00000',
    };
    return colors[rating] || '#999999';
  };

  return (
    <div className="energy-rating-calculator">
      <h3 className="energy-rating-calculator__title">Beregn energimerke</h3>
      
      <div className="energy-rating-calculator__info">
        <p>For adresse: <strong>{address}</strong></p>
      </div>

      <div className="energy-rating-calculator__form">
        <PktInput
          label="Årlig energiforbruk"
          placeholder="F.eks. 15000"
          value={yearlyConsumption}
          onChange={(e) => {
            setYearlyConsumption(e.target.value);
            setError('');
          }}
          helperText="Oppgi totalt årlig forbruk i kWh (elektrisitet, fjernvarme osv)"
          type="number"
          min="0"
          step="100"
          id="yearly-consumption"
        />

        <PktButton
          onClick={handleCalculate}
          disabled={isLoading || !yearlyConsumption}
          skin="primary"
        >
          {isLoading ? 'Beregner...' : 'Beregn energimerke'}
        </PktButton>
      </div>

      {error && (
        <PktAlert skin="error" className="energy-rating-calculator__alert">
          {error}
        </PktAlert>
      )}

      {result && (
        <div className="energy-rating-calculator__result">
          <h4>Resultat</h4>
          
          <div className="energy-rating-calculator__rating-display">
            <div 
              className="energy-rating-calculator__rating-letter"
              style={{ backgroundColor: getRatingColor(result.rating) }}
            >
              {result.rating}
            </div>
            <div className="energy-rating-calculator__rating-info">
              <p className="energy-rating-calculator__rating-description">
                {result.description}
              </p>
              <div className="energy-rating-calculator__details">
                <p><strong>Bruksareal:</strong> {result.bruksareal} m²</p>
                <p><strong>Årlig forbruk:</strong> {result.yearlyConsumption.toLocaleString('nb-NO')} kWh</p>
                <p><strong>Energiintensitet:</strong> {result.energyIntensity} kWh/m²/år</p>
              </div>
            </div>
          </div>

          <div className="energy-rating-calculator__scale">
            <h5>Energimerkeskala</h5>
            <div className="energy-rating-calculator__scale-items">
              {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((rating) => (
                <div 
                  key={rating}
                  className={`energy-rating-calculator__scale-item ${
                    rating === result.rating ? 'energy-rating-calculator__scale-item--active' : ''
                  }`}
                  style={{ backgroundColor: getRatingColor(rating) }}
                >
                  {rating}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};