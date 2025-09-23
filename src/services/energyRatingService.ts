import fs from 'fs';
import path from 'path';

// Energy rating thresholds (kWh/m²/year)
export interface EnergyRatingThreshold {
  rating: string;
  maxValue: number; // Maximum kWh/m²/year for this rating
  description?: string;
}

// Load thresholds from JSON file
function loadThresholds(): EnergyRatingThreshold[] {
  try {
    const filePath = path.join(process.cwd(), 'data', 'raw', 'energimerke-grenser.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.thresholds;
  } catch (error) {
    console.warn('[EnergyRatingService] Could not load thresholds from file, using defaults:', error);
    // Default thresholds as fallback
    return [
      { rating: 'A', maxValue: 50 },
      { rating: 'B', maxValue: 75 },
      { rating: 'C', maxValue: 100 },
      { rating: 'D', maxValue: 135 },
      { rating: 'E', maxValue: 180 },
      { rating: 'F', maxValue: 250 },
      { rating: 'G', maxValue: Infinity }
    ];
  }
}

export interface EnergyConsumptionInput {
  yearlyConsumption: number; // kWh per year
  bruksareal: number; // m²
}

export interface EnergyRatingResult {
  rating: string;
  energyIntensity: number; // kWh/m²/year
  description: string;
}

export class EnergyRatingService {
  private thresholds: EnergyRatingThreshold[] = loadThresholds();

  /**
   * Calculate energy rating based on consumption and area
   */
  calculateEnergyRating(input: EnergyConsumptionInput): EnergyRatingResult {
    const { yearlyConsumption, bruksareal } = input;

    // Calculate energy intensity (kWh/m²/year)
    const energyIntensity = yearlyConsumption / bruksareal;

    // Find the appropriate rating
    const ratingThreshold = this.thresholds.find(
      threshold => energyIntensity <= threshold.maxValue
    );

    const rating = ratingThreshold?.rating || 'G';

    return {
      rating,
      energyIntensity: Math.round(energyIntensity),
      description: this.getRatingDescription(rating, energyIntensity)
    };
  }

  /**
   * Get description for the energy rating
   */
  private getRatingDescription(rating: string, energyIntensity: number): string {
    const descriptions: Record<string, string> = {
      'A': 'Svært energieffektiv bolig',
      'B': 'Energieffektiv bolig',
      'C': 'God energistandard',
      'D': 'Middels energistandard',
      'E': 'Under middels energistandard',
      'F': 'Dårlig energistandard',
      'G': 'Svært dårlig energistandard'
    };

    return `${descriptions[rating] || 'Ukjent'} - ${energyIntensity} kWh/m²/år`;
  }

  /**
   * Update thresholds from external data (e.g., parsed Excel)
   */
  updateThresholds(thresholds: EnergyRatingThreshold[]): void {
    this.thresholds = thresholds.sort((a, b) => a.maxValue - b.maxValue);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): EnergyRatingThreshold[] {
    return [...this.thresholds];
  }
}

// Singleton instance
export const energyRatingService = new EnergyRatingService();
