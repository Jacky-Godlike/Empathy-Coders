import { config } from './config.js';
import { createOrbyteAdapter } from './adapters/orbyte/index.js';
import { createRepositories } from './repositories/index.js';
import { ensureRuntimeFiles } from './repositories/runtime.js';
import { ActivityService } from './services/activityService.js';
import { OrderService } from './services/orderService.js';
import { InventoryService } from './services/inventoryService.js';
import { SeedService } from './services/seedService.js';
import { TriageService } from './services/triageService.js';
import { createApp } from './app.js';

export async function createApplication({
  runtimeDir = config.paths.runtimeDir,
  seedDir = config.paths.seedDir,
  skipSeed = false,
} = {}) {
  await ensureRuntimeFiles({ seedDir, runtimeDir });
  const repositoryBundle = createRepositories(runtimeDir);
  const { repositories } = repositoryBundle;

  const activityService = new ActivityService({ repositories });
  const orbyteAdapter = createOrbyteAdapter(repositories);
  const inventoryService = new InventoryService({
    repositories,
    orbyteAdapter,
    activityService,
  });
  const orderService = new OrderService({
    repositories,
    orbyteAdapter,
    activityService,
    inventoryService,
  });
  const triageService = new TriageService({
    repositories,
    orderService,
    activityService,
  });
  const seedService = new SeedService({
    repositories,
    repositoryBundle,
    orderService,
    activityService,
    runtimeDir,
    seedDir,
  });

  if (!skipSeed) {
    await seedService.seedIfEmpty();
  }

  const services = {
    repositories,
    repositoryBundle,
    activityService,
    orbyteAdapter,
    inventoryService,
    orderService,
    triageService,
    seedService,
  };
  const app = createApp({ services });

  return { app, services, repositories, repositoryBundle, seedService };
}
