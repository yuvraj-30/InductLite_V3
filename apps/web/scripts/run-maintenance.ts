#!/usr/bin/env tsx
import { startMaintenanceScheduler } from "@/lib/maintenance/scheduler";

console.log("Starting maintenance scheduler...");
startMaintenanceScheduler();

// keep process alive
setInterval(() => {}, 1 << 30);
