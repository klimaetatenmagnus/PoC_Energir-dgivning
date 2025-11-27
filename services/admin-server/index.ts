import express, { type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { loadAdminApiConfig } from "../admin-api/config.js";
import {
  createAdminApiRouter,
  createAdminApiErrorHandler,
} from "../admin-api/router.js";
import { ContentStorage } from "../admin-api/contentStorage.js";

const config = loadAdminApiConfig();
const app = express();
const distDir = path.resolve(process.cwd(), "dist");
const indexHtmlPath = path.join(distDir, "index.html");
const port = Number(process.env.PORT ?? config.port ?? 8080);

app.use((req, _res, next) => {
  console.warn("[admin-server] request", req.method, req.path);
  next();
});

if (!fs.existsSync(indexHtmlPath)) {
  throw new Error(
    `[admin-server] Fant ikke build-output i ${indexHtmlPath}. Kjør "npm run build" før deploy.`
  );
}

app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "admin-server",
    projectId: config.projectId,
    stagingBucket: config.stagingBucket,
    prodBucket: config.prodBucket,
  });
});

app.get("/_gcp_iap/healthz", (_req: Request, res: Response) => {
  res.status(200).send("ok");
});

app.get("/_gcp_iap/clear_login_cookie", (_req: Request, res: Response) => {
  res.status(200).send("cleared");
});

app.use("/admin/api", createAdminApiRouter(config));

// Proxy for /config/content/* som leser fra staging-bøtten
// Dette lar forhåndsvisningen i admin-UI hente staging-data i stedet for prod-data
const stagingStorage = new ContentStorage(config.stagingBucket);

app.get("/config/content/*splat", async (req: Request, res: Response) => {
  try {
    // Hent relativ path fra URL (f.eks. "tiltak/varmepumpe.json")
    // I Express 5 er wildcard-parameteren et array
    const splatParam = req.params.splat;
    const relativePath = Array.isArray(splatParam) ? splatParam.join("/") : splatParam;
    if (!relativePath) {
      res.status(400).json({ error: "Mangler filsti" });
      return;
    }

    // Sjekk om vi skal inkludere draft-filer
    const includeDrafts = req.query.draft === "1" || req.query.draft === "true";

    let filePath = relativePath;
    let source: "draft" | "published" = "published";

    // Hvis includeDrafts, prøv draft-filen først
    if (includeDrafts && relativePath.endsWith(".json") && !relativePath.endsWith(".draft.json")) {
      const draftPath = relativePath.replace(/\.json$/, ".draft.json");
      const draftExists = await stagingStorage.exists(draftPath);
      if (draftExists) {
        filePath = draftPath;
        source = "draft";
      }
    }

    const { data, generation, etag } = await stagingStorage.readJson(filePath);

    // Sett cache-headere
    res.setHeader("Cache-Control", "no-cache");
    if (etag) {
      res.setHeader("ETag", etag);
    }
    if (generation) {
      res.setHeader("X-Content-Generation", generation);
    }
    res.setHeader("X-Content-Source", source);
    res.setHeader("X-Content-Bucket", "staging");

    res.json(data);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const httpError = error as { status: number; message: string };
      res.status(httpError.status).json({ error: httpError.message });
      return;
    }
    console.error("[admin-server] Feil ved lesing av innhold:", error);
    res.status(500).json({ error: "Intern serverfeil ved lesing av innhold" });
  }
});

// Proxy for /config/dictionaries/* som leser fra staging-bøtten
app.get("/config/dictionaries/*splat", async (req: Request, res: Response) => {
  try {
    const splatParam = req.params.splat;
    const pathPart = Array.isArray(splatParam) ? splatParam.join("/") : splatParam;
    const relativePath = `dictionaries/${pathPart}`;
    const { data, generation, etag } = await stagingStorage.readJson(relativePath);

    res.setHeader("Cache-Control", "no-cache");
    if (etag) {
      res.setHeader("ETag", etag);
    }
    if (generation) {
      res.setHeader("X-Content-Generation", generation);
    }
    res.setHeader("X-Content-Bucket", "staging");

    res.json(data);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const httpError = error as { status: number; message: string };
      res.status(httpError.status).json({ error: httpError.message });
      return;
    }
    console.error("[admin-server] Feil ved lesing av dictionary:", error);
    res.status(500).json({ error: "Intern serverfeil ved lesing av dictionary" });
  }
});

const registerStatic = (
  mountPath: string,
  relativePath: string,
  options?: Parameters<typeof express.static>[1]
) => {
  const absolutePath = path.join(distDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }
  app.use(mountPath, express.static(absolutePath, options));
};

registerStatic(
  "/assets",
  "assets",
  {
    fallthrough: true,
    immutable: true,
    maxAge: "365d",
  }
);

registerStatic(
  "/admin/assets",
  "assets",
  {
    fallthrough: true,
    immutable: true,
    maxAge: "365d",
  }
);

registerStatic(
  "/punkt-assets",
  "punkt-assets",
  {
    fallthrough: true,
    immutable: true,
    maxAge: "365d",
  }
);

registerStatic(
  "/admin",
  ".",
  {
    index: false,
    fallthrough: true,
    cacheControl: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }
);

const viteSvgPath = path.join(distDir, "vite.svg");
if (fs.existsSync(viteSvgPath)) {
  app.get("/vite.svg", (_req: Request, res: Response) => {
    res.sendFile(viteSvgPath);
  });
}

app.get("/", (_req: Request, res: Response) => {
  res.redirect("/admin");
});

app.get(/^\/admin(\/.*)?$/, (_req: Request, res: Response) => {
  res.sendFile(indexHtmlPath);
});

app.use(createAdminApiErrorHandler());

app.listen(port, () => {
  console.warn(`[admin-server] Listening on port ${port}`);
});
