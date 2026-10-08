#!/usr/bin/env tsx
// Standalone maintenance script to recover any ContentGenerationLog rows
// stuck in RUNNING state older than the stale threshold.
// Safe and non-destructive: only touches technical log rows, never assignments or attempts.

import { prisma } from "../src/lib/db.ts";
import { recoverAllStaleGenerations } from "../src/lib/content/content-service.ts";

async function main() {
  console.log("[maintenance] Checking for stale AI content generation logs...");
  const count = await recoverAllStaleGenerations(prisma);
  console.log(`[maintenance] Done: recovered ${count} stale generation log(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[maintenance] Recovery failed:", err);
  process.exit(1);
});
