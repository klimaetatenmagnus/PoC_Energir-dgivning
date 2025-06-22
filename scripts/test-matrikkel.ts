import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import 'dotenv/config'

const client = new MatrikkelClient(
  process.env.MATRIKKEL_API_BASE_URL_TEST!,
  process.env.MATRIKKEL_USERNAME_TEST!,
  process.env.MATRIKKEL_PASSWORD!
);

const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: false,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "cli",
  snapshotVersion: "9999-01-01T00:00:00+01:00",
});

(async () => {
  const ids = await client.findMatrikkelenheter(
    { kommunenummer: 301, gardsnummer: 73, bruksnummer: 704 },
    ctx()
  );
  console.log("Matrikkelenhets-ID-liste:", ids);
  for (const id of ids) {
    const info = await client.getMatrikkelenhet(id, ctx());
    console.log(id, info);
  }
})();
