import '../../loadEnv.ts';
import express, { type RequestHandler } from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';

import { resolveBuildingData } from './matrikkel.ts';
import { PORT } from './context.ts';
import {
  metricsRegistry,
  recordCacheOperation,
  startLookupTimer,
} from './metrics.ts';
import { infoLog, errorLog } from './logging.ts';

export { resolveBuildingData } from './matrikkel.ts';
export type { BuildingDataOptions } from './matrikkel.ts';

const cache = new NodeCache({ stdTTL: 86_400, checkperiod: 600 });

const app = express();
app.use(cors());

const lookupHandler: RequestHandler = async (req, res) => {
  const finalizeLookup = startLookupTimer();
  const adresse = req.query.adresse as string | undefined;
  if (!adresse) {
    res.status(400).json({ error: 'Mangler adresse' });
    finalizeLookup('error');
    return;
  }

  const key = `lookup:${adresse}`;
  if (cache.has(key)) {
    recordCacheOperation('hit');
    res.json(cache.get(key));
    finalizeLookup('success');
    return;
  }

  recordCacheOperation('miss');

  try {
    const data = await resolveBuildingData(adresse);
    cache.set(key, data);
    res.json(data);
    finalizeLookup('success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukjent feil';
    errorLog('lookup failed', error);
    res.status(500).json({ error: message });
    finalizeLookup('error');
  }
};

app.get('/lookup', lookupHandler);
app.get('/address/:address', async (req, res) => {
  const finalizeLookup = startLookupTimer();
  const adresse = req.params.address;

  try {
    const data = await resolveBuildingData(adresse);
    res.json(data);
    finalizeLookup('success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukjent feil';
    errorLog('address lookup failed', error);
    res.status(500).json({ error: message });
    finalizeLookup('error');
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});

const entryScript = process.argv[1] ?? '';
const isStandaloneExecution =
  process.env.BUILDING_INFO_SERVICE_STANDALONE === '1' ||
  entryScript.includes('building-info-service');

if (isStandaloneExecution) {
  app.listen(PORT, () => {
    infoLog(`✓ building-info-service på http://localhost:${PORT}`);
  });
}

export default app;
