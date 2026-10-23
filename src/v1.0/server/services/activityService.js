import { ACTOR_SYSTEM } from '../domain/constants.js';

export class ActivityService {
  constructor({ repositories }) {
    this.repositories = repositories;
  }

  async log({
    actor = ACTOR_SYSTEM,
    action,
    entityType = 'order',
    entityId = null,
    orderId = null,
    summary = '',
    details = null,
    at = null,
  }) {
    return this.repositories.activities.append({
      at: at || new Date().toISOString(),
      actor: {
        id: actor.id || 'system',
        name: actor.name || 'OrderPilot automation',
        role: actor.role || 'system',
        initials: actor.initials || null,
      },
      action,
      entityType,
      entityId,
      orderId,
      summary,
      details,
    });
  }

  async list(options = {}) {
    return this.repositories.activities.getAll(options);
  }

  async forOrder(orderId, limit = 100) {
    return this.repositories.activities.getAll({ orderId, limit });
  }
}
