import { build } from "esbuild";
import { rmSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const outDir = resolve(projectRoot, "dist/backend");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: {
    "building-info-service": resolve(
      projectRoot,
      "services/building-info-service/index.ts"
    ),
    "api-server": resolve(projectRoot, "src/api-server.ts"),
    "admin-server": resolve(projectRoot, "services/admin-server/index.ts"),
    "admin-api": resolve(projectRoot, "services/admin-api/index.ts"),
    "solar-service": resolve(
      projectRoot,
      "services/solar-service/index.ts"
    ),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outdir: outDir,
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  sourcemap: false,
  packages: "external",
  loader: {
    ".ts": "ts",
    ".json": "json",
  },
  splitting: false,
  chunkNames: "chunks/[name]-[hash]",
});

console.info("✓ Backend build completed (dist/backend)");
