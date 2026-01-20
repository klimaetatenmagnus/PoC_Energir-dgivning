import type { AddressLookupResponse } from '../../../../../services/buildingApi';
import type { ContentAudience } from '../../../../../../content/schema-helpers';
import type { GlossaryEntry } from '../glossaryHelpers';
import type { Stotteordning } from '../shared';

export interface DesktopTiltakCardProps {
  /** Tiltak-ID (slug), f.eks. "varmepumpe", "solenergi" */
  tiltakId: string;
  /** Bygningstype for kontekst-spesifikt innhold */
  buildingType?: string;
  /** Bygningsdata for besparelsesberegning */
  buildingData?: AddressLookupResponse;
  /** Audience (standard/gulliste) */
  audience?: ContentAudience;
  /** Callback ved tilbake-klikk */
  onBack?: () => void;
  /** Ekstra CSS-klasse */
  className?: string;
}

export interface TiltakTabsProps {
  tabs: Array<{ id: string; title: string; body: string[] }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export interface TiltakContentProps {
  introParagraphs: string[];
  buildingTypeParagraphs?: string[];
  tabs?: Array<{ id: string; title: string; body: string[] }>;
  activeTab: string;
  glossary: GlossaryEntry[];
  hoveredTerm: string | null;
  setHoveredTerm: (term: string | null) => void;
}

export interface TiltakBenefitsProps {
  benefits: Array<{
    id: string;
    title: string;
    description?: string;
    icon?: string;
  }>;
}

export interface TiltakSavingsProps {
  annualSavingsKwh: number;
  energyPricePerKwh?: number;
  sourceDescription?: string;
}

export interface TiltakGrantsProps {
  stotteordninger: Stotteordning[];
  isLoading?: boolean;
}

export interface TiltakPermitProps {
  permitContent?: {
    id: string;
    title: string;
    body: string[];
    links?: Array<{ label: string; url: string }>;
  };
  glossary: GlossaryEntry[];
  hoveredTerm: string | null;
  setHoveredTerm: (term: string | null) => void;
}
