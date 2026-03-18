/**
 * Piwik Pro analytics – tynn wrapper rundt _paq for typsikker event-tracking.
 *
 * Hendelser sendes kun hvis Piwik Pro-containeren er lastet (produksjon).
 * I utvikling (uten container) er alle kall no-ops.
 */

declare global {
  interface Window {
    _paq?: Array<unknown[]>;
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

// ── Forhåndsdefinerte hendelser ──────────────────────────────────────────

export function trackAddressLookup(address: string): void {
  trackEvent('energinokkelen', 'address_lookup', address);
}

export function trackResultViewed(address: string, platform: 'desktop' | 'mobile'): void {
  trackEvent('energinokkelen', 'result_viewed', `${platform}:${address}`);
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
