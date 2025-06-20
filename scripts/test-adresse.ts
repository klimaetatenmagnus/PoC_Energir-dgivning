import fetch from "node-fetch";
import { findMatrikkelenhetIdForAddress } from "../src/clients/adresseClient.ts";

/* 1) REN ADRESSE­STRENG – akkurat som sluttbrukeren skriver den */
const ADDRESS = "Kapellveien 156C, 0493 Oslo"; // ← OBS to p-er!

async function main() {
  /* a) slå opp adressen hos Kartverket ------------------------ */
  const url =
    "https://ws.geonorge.no/adresser/v1/sok" +
    "?sok=" +
    encodeURIComponent(ADDRESS) +
    "&treffPerSide=1&fuzzy=true";
  const r = await fetch(url, { headers: { "User-Agent": "test-script/1.0" } });
  if (!r.ok) throw new Error(`Kartverket ${r.status} – ${await r.text()}`);
  const { adresser } = (await r.json()) as {
    adresser: any[];
  };
  if (!adresser?.length) throw new Error("Fant ingen adresser");

  /* b) plukk feltene vi trenger ------------------------------ */
  const a = adresser[0];
  const parsed = {
    kommunenummer: a.kommunenummer ?? a.kommunekode,
    adressekode: a.adressekode?.nummer ?? a.adressekode,
    husnummer: `${a.nummer ?? a.husnummer}`, // 🡅 Kartverket-feltet
    bokstav: a.bokstav,
  };
  console.log("Kartverket ga:", parsed);

  /* c) kall adresseClient ------------------------------------ */
  const matrId = await findMatrikkelenhetIdForAddress(parsed);
  console.log("\n✅ Matrikkelenhets-ID:", matrId);
}

main().catch((e) => {
  console.error("🚨 Feil:", e);
  process.exit(1);
});
