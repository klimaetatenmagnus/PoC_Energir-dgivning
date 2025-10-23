import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import fetch from 'node-fetch';
import http from 'node:http';

type ManagedProcess = {
  name: string;
  child: ChildProcess;
};

const managed: ManagedProcess[] = [];
let shuttingDown = false;
let stubServer: http.Server | null = null;

function startService(
  name: string,
  args: string[],
  envOverrides: NodeJS.ProcessEnv = {}
) {
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ...envOverrides },
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
    if (shuttingDown) {
      return;
    }
    const reason =
      typeof code === 'number'
        ? `code ${code}`
        : `signal ${signal ?? 'unknown'}`;
    console.error(`❌ Service ${name} terminated unexpectedly (${reason}).`);
  });

  return child;
}

async function stopAll(timeoutMs = 5_000) {
  if (shuttingDown) return;
  shuttingDown = true;

  await Promise.allSettled(
    managed.map(async ({ child }) => {
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
        console.error('⚠️  Klarte ikke å stoppe prosess:', error);
      }
    })
  );
}

async function waitForHttp(
  name: string,
  url: string,
  attempts = 20,
  intervalMs = 1_000
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.status >= 200 && response.status < 400) {
        return;
      }
      console.log(
        `↻ ${name} svarte med status ${response.status}. Forsøk ${attempt}/${attempts}.`
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

function startStubBuildingInfo(port: number) {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end('Missing URL');
      return;
    }

    if (req.url === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', service: 'stub-building-info' }));
      return;
    }

    if (req.url === '/metrics') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.end('building_info_service_lookup_total 0\n');
      return;
    }

    res.statusCode = 404;
    res.end('Not Found');
  });

  return new Promise<http.Server>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const stubPort = Number(process.env.TEST_STUB_BUILDING_INFO_PORT ?? '4999');
  const apiPort = Number(process.env.TEST_SMOKE_API_PORT ?? '3101');

  const baseEnv: NodeJS.ProcessEnv = {
    API_ENV: 'test',
    LIVE: '0',
    API_PORT: String(apiPort),
    BUILDING_INFO_BASE_URL: `http://127.0.0.1:${stubPort}`,
    APP_CONFIG_DIR: path.join(process.cwd(), 'content'),
    PUBLIC_API_BASE_URL: '/api',
    PUBLIC_SOLAR_BASE_URL: '/api/solar',
    SOLAR_SERVICE_MOCK: '1',
  };

  console.log('🧪 Starter smoke-test for API-konfig og metrics');

  stubServer = await startStubBuildingInfo(stubPort);

  startService(
    'api-server',
    ['--import', 'tsx', 'src/api-server.ts'],
    baseEnv
  );
  await waitForHttp('api-server', `http://localhost:${apiPort}/health`);

  const configResponse = await fetch(`http://localhost:${apiPort}/config/app.json`);
  if (!configResponse.ok) {
    throw new Error(
      `/config/app.json feilet med ${configResponse.status} ${configResponse.statusText}`
    );
  }
  const configPayload = (await configResponse.json()) as Record<string, unknown>;
  if (typeof configPayload.apiBaseUrl !== 'string') {
    throw new Error('apiBaseUrl mangler eller er ikke en streng i /config/app.json');
  }

  const metricsResponse = await fetch(`http://localhost:${apiPort}/metrics`);
  if (!metricsResponse.ok) {
    throw new Error(
      `/metrics feilet med ${metricsResponse.status} ${metricsResponse.statusText}`
    );
  }
  const metricsBody = await metricsResponse.text();
  if (!metricsBody.includes('building_info_service_lookup')) {
    console.warn(
      '⚠️  /metrics-responsen inneholder ikke building_info_service_lookup* - sjekk later'
    );
  }

  console.log('✅ Smoke-test fullført. /config/app.json og /metrics fungerer.');

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
    console.error('❌ Smoke-test feilet:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (stubServer) {
      await new Promise((resolve) => stubServer?.close(resolve));
      stubServer = null;
    }
    await stopAll();
  });
