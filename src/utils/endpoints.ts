// src/utils/endpoints.ts
export function matrikkelEndpoint(base: string, service: string): string {
  const isTest = base.includes("prodtest.");
  if (isTest) {
    // ✅ KORT sti for *alle* tjenester i test-miljøet
    return `${base}/${service}WS`;
  }

  // Prod-miljø: lang sti for alle tjenester
  const domain = service.toLowerCase().replace(/service$/, "");
  return `${base}/service/${domain}/${service}WS`;
}
