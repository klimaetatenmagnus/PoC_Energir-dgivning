require('dotenv').config();
const soap = require('soap');

const wsdlUrl   = process.env.MATRIKKEL_WSDL;
const username  = process.env.MATRIKKEL_USER;
const password  = process.env.MATRIKKEL_PASS;
const endpoint  = process.env.MATRIKKEL_ENDPOINT; // Endpoint URL for the service, e.g. https://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/adresse

async function createClient() {
  // Hent og parse WSDL (med Basic Auth for nedlasting)
  const client = await soap.createClientAsync(wsdlUrl, {
    wsdl_options: { auth: `${username}:${password}` }
  });
  // Sett HTTP Basic Auth på alle kommende SOAP-kall
  client.setSecurity(new soap.BasicAuthSecurity(username, password));
  // Overskriv WSDL-ens address-lokasjon med den faktiske endpoint-URL
  client.setEndpoint(endpoint);
  return client;
}

async function logOperations() {
  const client = await createClient();
  console.log('Tjenester og metoder:');
  const desc = client.describe();
  for (const service of Object.keys(desc)) {
    for (const port of Object.keys(desc[service])) {
      console.log(`\n${service} → ${port}`);
      Object.keys(desc[service][port]).forEach(method => console.log(`  - ${method}`));
    }
  }
}

async function testAdresseKall() {
  try {
    const client = await createClient();
    const ident           = '0123456789';
    const snapshotVersion = '9999-01-01T00:00:00';

    const [res] = await client.findAdresseIdForIdentAsync({ ident, snapshotVersion });
    console.log('\nfindAdresseIdForIdent:', res);

    if (res.adresseId) {
      const [obj] = await client.getObjectAsync({ adresseId: res.adresseId, snapshotVersion });
      console.log('\ngetObject (adresse):');
      Object.entries(obj).forEach(([key, value]) =>
        console.log(`  • ${key}: ${typeof value}`)
      );
    }
  } catch (err) {
    console.error('Feil under testAdresseKall:', err);
  }
}

(async () => {
  try {
    await logOperations();
    await testAdresseKall();
  } catch (err) {
    console.error('Feil under API-test:', err);
  }
})();
