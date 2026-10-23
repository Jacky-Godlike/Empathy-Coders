/**
 * Reset the local demo data to the committed seed.
 *
 * This is the command-line equivalent of Settings → Reset demo data.
 * Stop the running server before using it, or restart the server afterwards,
 * because a running process keeps an in-memory cache of the JSON files.
 */
import { config } from '../server/config.js';
import { resetRuntimeFiles } from '../server/repositories/runtime.js';
import { createApplication } from '../server/bootstrap.js';

await resetRuntimeFiles({
  seedDir: config.paths.seedDir,
  runtimeDir: config.paths.runtimeDir,
});

const { services } = await createApplication();
const stats = await services.orderService.stats();
console.log('OrderPilot demo reset complete');
console.log(JSON.stringify(stats, null, 2));
