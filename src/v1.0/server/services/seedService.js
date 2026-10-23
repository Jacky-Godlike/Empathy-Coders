import { config } from '../config.js';
import { extractMessage } from '../adapters/ai/fallbackExtractor.js';
import { ACTIVITY_ACTIONS, ACTOR_SYSTEM } from '../domain/constants.js';
import { todayInMalaysia } from '../domain/dates.js';
import { resetRuntimeFiles } from '../repositories/runtime.js';

export class SeedService {
  constructor({ repositories, repositoryBundle, orderService, activityService, runtimeDir, seedDir }) {
    this.repositories = repositories;
    this.repositoryBundle = repositoryBundle;
    this.orderService = orderService;
    this.activity = activityService;
    this.runtimeDir = runtimeDir || config.paths.runtimeDir;
    this.seedDir = seedDir || config.paths.seedDir;
  }

  async seedIfEmpty({ now = new Date(), today = todayInMalaysia() } = {}) {
    const existingOrders = await this.repositories.orders.getAll();
    if (existingOrders.length > 0) return { seeded: false };

    const messages = await this.repositories.messages.getAll();
    if (messages.length === 0) return { seeded: false };

    const products = await this.repositories.catalog.getProducts();
    const customers = await this.repositories.catalog.getCustomers();

    // Give every seeded message a fresh, relative timestamp so the demo always
    // looks like it happened today. Pending messages stay new; processed seed
    // messages are replayed in chronological order below.
    const prepared = messages.map((message) => ({
      ...message,
      receivedAt:
        message.minutesAgo === null || message.minutesAgo === undefined
          ? message.receivedAt || now.toISOString()
          : new Date(now.getTime() - Number(message.minutesAgo) * 60_000).toISOString(),
      status: 'new',
      analysis: null,
      orderId: null,
      processedAt: null,
    }));

    await this.repositories.messages.updateMany(
      prepared.map((message) => ({
        id: message.id,
        patch: {
          receivedAt: message.receivedAt,
          status: 'new',
          analysis: null,
          orderId: null,
          processedAt: null,
        },
      })),
    );

    const seedMessages = prepared
      .filter((message) => message.seedState === 'processed')
      .sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt)));

    let ordersCreated = 0;
    let ordersUpdated = 0;
    let filtered = 0;
    for (const message of seedMessages) {
      const extraction = extractMessage(message, { products, customers, today });
      const outcome = await this.orderService.upsertFromExtraction(extraction, message, {
        actor: ACTOR_SYSTEM,
        at: message.receivedAt,
        mode: 'rules',
        seed: true,
      });
      if (outcome.action === 'created') ordersCreated += 1;
      else if (outcome.action === 'updated') ordersUpdated += 1;
      else if (outcome.action === 'change_request') ordersCreated += 1;
      else filtered += 1;
    }

    await this.activity.log({
      actor: ACTOR_SYSTEM,
      action: ACTIVITY_ACTIONS.TRIAGE_COMPLETED,
      entityType: 'inbox',
      entityId: 'inbox',
      summary: `Demo inbox seeded: ${seedMessages.length} messages scanned · ${ordersCreated} orders · ${filtered} filtered.`,
      details: {
        source: 'seed',
        scanned: seedMessages.length,
        ordersCreated,
        ordersUpdated,
        filtered,
        mode: 'rules',
        note: 'Seed data is pre-analyzed with the deterministic parser so the order desk is populated on first load. New inbox batches use AI when a key is configured.',
      },
      at: now.toISOString(),
    });

    return {
      seeded: true,
      scanned: seedMessages.length,
      ordersCreated,
      ordersUpdated,
      filtered,
      pending: prepared.filter((message) => message.seedState === 'pending').length,
    };
  }

  async resetDemo({ actor } = {}) {
    await resetRuntimeFiles({
      seedDir: this.seedDir,
      runtimeDir: this.runtimeDir,
    });
    this.repositoryBundle.invalidate();
    const result = await this.seedIfEmpty();
    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.DEMO_RESET,
      entityType: 'demo',
      entityId: 'demo',
      summary: 'Demo data reset to the original synthetic seed.',
      details: result,
    });
    return result;
  }
}
