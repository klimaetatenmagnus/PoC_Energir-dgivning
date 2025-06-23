#!/usr/bin/env tsx
// Script for å rydde opp i SOAP-dump mappen

import { cleanupSoapDumps } from "../src/utils/soapDump.ts";

console.log("🧹 Starter opprydding av SOAP-dump filer...");

await cleanupSoapDumps();

console.log("✅ Opprydding fullført!");