import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from '../config.js';

async function listSeedFiles(seedDir) {
  const entries = await fs.readdir(seedDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name);
}

/**
 * Copy any missing seed file into the runtime directory.
 * Existing runtime files are never overwritten, so a restart keeps approvals.
 */
export async function ensureRuntimeFiles({
  seedDir = config.paths.seedDir,
  runtimeDir = config.paths.runtimeDir,
} = {}) {
  await fs.mkdir(runtimeDir, { recursive: true });
  const files = await listSeedFiles(seedDir);
  for (const file of files) {
    const destination = path.join(runtimeDir, file);
    try {
      await fs.access(destination);
    } catch {
      await fs.copyFile(path.join(seedDir, file), destination);
    }
  }
  return { seedDir, runtimeDir, files };
}

/**
 * Destructive demo reset. Only called from the manager-only reset endpoint or
 * the reset script, never automatically.
 */
export async function resetRuntimeFiles({
  seedDir = config.paths.seedDir,
  runtimeDir = config.paths.runtimeDir,
} = {}) {
  await fs.rm(runtimeDir, { recursive: true, force: true });
  await ensureRuntimeFiles({ seedDir, runtimeDir });
  return { seedDir, runtimeDir };
}
