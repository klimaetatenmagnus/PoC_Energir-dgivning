import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import fetch from 'node-fetch';

type ManagedProcess = {
  name: string;
  child: ChildProcess;
};

const managed: ManagedProcess[] = [];
let shuttingDown = false;

const DEFAULT_ADDRESS = 'Grenseveien 99, 0663 Oslo';
const SOLAR_HEALTH_URL = 'http://localhost:4003/solinnstraling?lat=59.9139&lon=10.7522';
const BUILDING_HEALTH_URL = 'http://localhost:4000/health';
const API_HEALTH_URL = 'http://localhost:3001/health';

interface StartOptions {
  env?: NodeJS.ProcessEnv;
}

function startService(name: string, args: string[], options: StartOptions = {}) {
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  managed.push({ name, child });

  child.stdout?.on('data', (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });
  child.stderr?.on('data', (data) => {
    process.stderr.write(`[${name}:err] ${data}`);
  });

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      const reason = typeof code === 'number' ? `code ${code}` : `signal ${signal ?? 'unknown'}`;
      console.error(`❌ Service ${name} terminated unexpectedly (${reason}).`);
    } else {
      const reason = typeof code === 'number' ? `code ${code}` : `signal ${signal ?? 'unknown'}`;
      console.log(`ℹ️  Service ${name} stopped (${reason}).`);
    }
  });

  return child;
}

async function stopAll(timeoutMs = 5_000) {
  if (shuttingDown) return;
  shuttingDown = true;

  await Promise.allSettled(
    managed.map(async ({ child, name }) => {
      if (child.killed || child.exitCode !== null) {
        return;
      }

      child.kill('SIGTERM');

      try {
        await Promise.race([
          once(child, 'exit'),
          delay(timeoutMs).then(() => {
            if (child.exitCode === null) {
              child.kill('SIGKILL');
            }
          }),
        ]);
      } catch (error) {
        console.error(`⚠️  Klarte ikke å stoppe ${name}:`, error);
      }
    })
  );
}

async function waitForHttp(
  name: string,
  url: string,
  {
    attempts = 20,
    intervalMs = 1_000,
    acceptStatus = (status: number) => status >= 200 && status < 400,
  }: {
    attempts?: number;
    intervalMs?: number;
    acceptStatus?: (status: number) => boolean;
  } = {}
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (acceptStatus(response.status)) {
        return;
      }
      console.log(
        `↻ ${name} svarte med status ${response.status}. Venter før nytt forsøk (${attempt}/${attempts}).`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        `↻ Fikk ikke kontakt med ${name}: ${message || 'ukjent feil'}. Forsøk ${attempt}/${attempts}.`
      );
    }
    await delay(intervalMs);
  }
  throw new Error(`Timeout: ${name} svarte ikke på ${url}`);
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let address = DEFAULT_ADDRESS;
  let useMockSolar = false;

  for (const arg of args) {
    if (arg === '--mock') {
      useMockSolar = true;
    } else if (arg.startsWith('--address=')) {
      address = arg.split('=')[1] ?? DEFAULT_ADDRESS;
    }
  }

  return { address, useMockSolar };
}

async function main() {
  const { address, useMockSolar } = parseCliArgs();

  console.log('🏁 Starter full chain-test');
  console.log(`   Adresse: ${address}`);
  console.log(`   Solar mock: ${useMockSolar ? 'JA (lokal stub)' : 'NEI (live tjeneste)'}`);

  const solarEnv = useMockSolar ? { SOLAR_SERVICE_MOCK: '1' } : undefined;

  startService('solar-service', ['--import', 'tsx', 'services/solar-service/index.ts'], { env: solarEnv });
  try {
    await waitForHttp('solar-service', SOLAR_HEALTH_URL, {
      acceptStatus: (status) => status < 500,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️  Klarte ikke å verifisere solar-service via HTTP: ${message}. Fortsetter, men selve testen vil avsløre eventuelle problemer.`
    );
  }

  startService(
    'building-info-service',
    ['--import', 'tsx', 'services/building-info-service/index.ts']
  );
  await waitForHttp('building-info-service', BUILDING_HEALTH_URL);

  startService('api-server', ['--import', 'tsx', 'src/api-server.ts']);
  await waitForHttp('api-server', API_HEALTH_URL);

  console.log('🚀 Alle tjenester er i gang. Kjører adresseoppslag...');

  const lookupResponse = await fetch('http://localhost:3001/api/address-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, useImprovedSelection: true }),
  });

  if (!lookupResponse.ok) {
    const errorBody = await lookupResponse.text();
    throw new Error(
      `Adresseoppslag feilet (${lookupResponse.status} ${lookupResponse.statusText}): ${errorBody}`
    );
  }

  const payload = (await lookupResponse.json()) as Record<string, unknown>;

  if (typeof payload.gnr !== 'number' || typeof payload.bnr !== 'number') {
    throw new Error('Uventet respons fra API - mangler gnr/bnr.');
  }

  console.log('✅ Full chain verifisert. Nøkkeldata:');
  console.log(
    JSON.stringify(
      {
        gnr: payload.gnr,
        bnr: payload.bnr,
        byggeaar: payload.byggeaar,
        bruksarealM2: payload.bruksarealM2,
        sol_kwh_bygg_tot: payload.sol_kwh_bygg_tot,
        filteredSolarEnergy: payload.filteredSolarEnergy,
        _meta: payload._meta,
      },
      null,
      2
    )
  );
}

const signals: Array<NodeJS.Signals> = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    await stopAll();
    process.exit();
  });
});

process.on('uncaughtException', async (error) => {
  console.error('❌ Uventet feil:', error);
  await stopAll();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('❌ Uventet promise-avvisning:', reason);
  await stopAll();
  process.exit(1);
});

main()
  .catch(async (error) => {
    console.error('❌ Full chain-test feilet:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopAll();
  });
