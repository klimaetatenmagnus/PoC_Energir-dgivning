import express, { type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { loadAdminApiConfig } from "../admin-api/config.js";
import {
  createAdminApiRouter,
  createAdminApiErrorHandler,
} from "../admin-api/router.js";

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
