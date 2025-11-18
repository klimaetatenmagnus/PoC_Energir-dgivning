import type { Request } from "express";
import process from "node:process";
import type { PublishInitiator } from "./cloudBuild.js";
import { HttpError } from "./httpError.js";

export type AdminUserContext = PublishInitiator;

export function resolveUserContext(req: Request): AdminUserContext {
  const emailHeader = req.header("x-goog-authenticated-user-email");
  let email: string | null = null;

  if (emailHeader) {
    const [, parsedEmail] = emailHeader.split(":");
    email = parsedEmail ? parsedEmail.trim() : emailHeader.trim();
  }

  if (!email && process.env.NODE_ENV !== "production") {
    const override = req.header("x-admin-user");
    email = override?.trim() ?? null;
  }

  if (!email) {
    throw new HttpError(403, "Mangler autentisert bruker for admin-operasjon");
  }

  const displayName = req.header("x-goog-authenticated-user-display-name");
  const [, parsedName] = displayName?.split(":") ?? [];
  const sourceIp = req.ip;

  return {
    email,
    name: (parsedName ?? displayName)?.trim() || null,
    sourceIp,
  };
}
