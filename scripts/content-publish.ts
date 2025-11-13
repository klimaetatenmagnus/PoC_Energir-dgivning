import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const STAGING_BUCKET = 'gs://energinokkelen-content/content';
const PROD_BUCKET = 'gs://energinokkelen-content-prod/content';
const LOG_BUCKET_PREFIX = 'gs://energinokkelen-content-prod/content/logs';

type Mode = 'push-staging' | 'promote';

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Kommandoen ${command} ${args.join(' ')} feilet.`);
  }
}

function currentUser() {
  return (
    process.env.GIT_AUTHOR_NAME ||
    process.env.GIT_COMMITTER_NAME ||
    process.env.USER ||
    process.env.LOGNAME ||
    'unknown'
  );
}

function gitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status === 0 && result.stdout) {
    return result.stdout.toString().trim();
  }

  return null;
}

async function writePublishLog() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'content-publish-'));
  const timestamp = new Date().toISOString();
  const logPath = path.join(tempDir, 'publish-log.json');
  const data = {
    promotedAt: timestamp,
    source: STAGING_BUCKET,
    target: PROD_BUCKET,
    user: currentUser(),
    gitSha: gitSha(),
  };

  await writeFile(logPath, JSON.stringify(data, null, 2));

  const remoteObject = `${LOG_BUCKET_PREFIX}/publish-${timestamp.replace(/[:.]/g, '-')}.json`;
  run('gsutil', ['cp', logPath, remoteObject]);
}

function usageAndExit() {
  console.log(`Bruk: npm run content:publish -- <push-staging|promote>

push-staging  Synkroniser lokal content/ til ${STAGING_BUCKET}
promote       Kopier content fra staging-bøtten til prod og logg publiseringen`);
  process.exit(1);
}

async function main() {
  const mode = process.argv[2] as Mode | undefined;

  if (!mode || (mode !== 'push-staging' && mode !== 'promote')) {
    usageAndExit();
    return;
  }

  if (mode === 'push-staging') {
    console.log('🔄 Synker lokal content/ til staging...');
    run('gsutil', ['-m', 'rsync', '-d', '-r', 'content', STAGING_BUCKET]);
    console.log('✅ Ferdig synk til staging.');
    return;
  }

  console.log('🚀 Promoterer staging-content til prod...');
  run('gsutil', ['-m', 'rsync', '-d', '-r', STAGING_BUCKET, PROD_BUCKET]);
  await writePublishLog();
  console.log('✅ Ferdig promotert. Logg lagt i prod-bøtten under content/logs/.');
}

main().catch((error) => {
  console.error('Publiseringsskript feilet:', error);
  process.exit(1);
});
