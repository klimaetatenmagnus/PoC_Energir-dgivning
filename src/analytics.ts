/**
 * Piwik Pro analytics – tynn wrapper rundt _paq for typsikker event-tracking.
 *
 * Hendelser sendes kun hvis Piwik Pro-containeren er lastet (produksjon).
 * I utvikling (uten container) er alle kall no-ops.
 */

declare global {
  interface Window {
    _paq?: Array<unknown[]>;
    gtag?: (...args: unknown[]) => void;
  }
}

function push(...args: unknown[]): void {
  if (typeof window !== 'undefined' && window._paq) {
    window._paq.push(args);
  }
}

/** Spor en egendefinert hendelse. */
export function trackEvent(
  category: string,
  action: string,
  name?: string,
  value?: number,
): void {
  push('trackEvent', category, action, name, value);
}

/**
 * Google Ads-konvertering for fullført adresseoppslag.
 * send_to = konto-ID + label fra konverteringshandlingen «Adresseoppslag» (AW-18244462717).
 */
const GADS_ADDRESS_LOOKUP_SEND_TO = 'AW-18244462717/FWlCCN6wt8QcEP3Q0ftD';

/**
 * Rapporter en Google Ads-konvertering. No-op utenfor produksjon (så dev/test
 * ikke forurenser konverteringsdataene) og hvis gtag ikke er lastet.
 */
function reportGadsConversion(sendTo: string): void {
  if (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    typeof window.gtag === 'function'
  ) {
    window.gtag('event', 'conversion', { send_to: sendTo });
  }
}

// ── Forhåndsdefinerte hendelser ──────────────────────────────────────────

// Av personvernhensyn sendes aldri gateadresser til Piwik — kun aggregert bydel.

export function trackAddressLookup(): void {
  trackEvent('energinokkelen', 'address_lookup');
  reportGadsConversion(GADS_ADDRESS_LOOKUP_SEND_TO);
}

export function trackResultViewed(platform: 'desktop' | 'mobile', bydel?: string): void {
  trackEvent('energinokkelen', 'result_viewed', bydel ? `${platform}:${bydel}` : platform);
}

export function trackTiltakExpanded(tiltakId: string): void {
  trackEvent('tiltak', 'tiltak_expanded', tiltakId);
}

export function trackTiltakChecked(tiltakId: string, checked: boolean): void {
  trackEvent('tiltak', checked ? 'tiltak_checked' : 'tiltak_unchecked', tiltakId);
}

export function trackTiltakCompleted(tiltakId: string, completed: boolean): void {
  trackEvent('tiltak', completed ? 'tiltak_completed' : 'tiltak_uncompleted', tiltakId);
}

export function trackExternalLinkClick(url: string, context?: string): void {
  trackEvent('external_link', 'click', context ? `${context}:${url}` : url);
}

export function trackNeighborComparison(): void {
  trackEvent('energinokkelen', 'neighbor_comparison');
}

export function trackHowToImplement(): void {
  trackEvent('energinokkelen', 'how_to_implement');
}

export function trackPageStep(step: string, platform?: 'desktop' | 'mobile'): void {
  trackEvent('navigation', 'page_step', platform ? `${platform}:${step}` : step);
}
