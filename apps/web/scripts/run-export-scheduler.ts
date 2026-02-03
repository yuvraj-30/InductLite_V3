#!/usr/bin/env tsx
import { startExportScheduler } from "@/lib/export/scheduler";

console.log("Starting export scheduler...");
startExportScheduler(5000);

// keep process alive
setInterval(() => {}, 1 << 30);
