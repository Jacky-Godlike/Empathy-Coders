function maxNumericId(rows) {
  return rows.reduce((max, row) => {
    const match = /^ACT-(\d+)$/.exec(row.id || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000);
}

export class ActivityRepository {
  constructor({ activities }) {
    this.activities = activities;
  }

  async getAll({ limit = 200, type = null, orderId = null, actorId = null } = {}) {
    let rows = await this.activities.read();
    if (type) rows = rows.filter((row) => row.action === type || row.action.startsWith(`${type}.`));
    if (orderId) rows = rows.filter((row) => row.orderId === orderId);
    if (actorId) rows = rows.filter((row) => row.actor?.id === actorId);
    return rows
      .slice()
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, Math.max(1, Math.min(1000, Number(limit) || 200)));
  }

  async append(entry) {
    return this.activities.update((rows) => {
      const activity = {
        id: `ACT-${maxNumericId(rows) + 1}`,
        at: entry.at || new Date().toISOString(),
        actor: entry.actor || { id: 'system', name: 'OrderPilot automation', role: 'system' },
        action: entry.action,
        entityType: entry.entityType || 'order',
        entityId: entry.entityId || null,
        orderId: entry.orderId || null,
        summary: entry.summary || '',
        details: entry.details || null,
      };
      rows.push(activity);
      return activity;
    });
  }

  async countByAction(prefix) {
    const rows = await this.activities.read();
    return rows.filter((row) => row.action.startsWith(prefix)).length;
  }
}
