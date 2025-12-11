import type { MatrikkelContext } from "../../src/clients/MatrikkelClient.ts";

export function ctx(): MatrikkelContext {
  return {
    locale: "no_NO_B",
    brukOriginaleKoordinater: true,
    koordinatsystemKodeId: 25833,
    systemVersion: "trunk",
    klientIdentifikasjon: "test-run",
    snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
  };
}
