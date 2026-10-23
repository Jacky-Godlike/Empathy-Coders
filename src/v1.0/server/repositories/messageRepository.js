function maxNumericId(rows, prefix) {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  return rows.reduce((max, row) => {
    const match = pattern.exec(row.id || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

export class MessageRepository {
  constructor({ messages }) {
    this.messages = messages;
  }

  async getAll() {
    return this.messages.read();
  }

  async getById(id) {
    const rows = await this.messages.read();
    return rows.find((message) => message.id === id) || null;
  }

  async getPending() {
    const rows = await this.messages.read();
    return rows
      .filter((message) => message.status === 'new')
      .sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt)));
  }

  async getByOrderId(orderId) {
    const rows = await this.messages.read();
    return rows.filter((message) => message.orderId === orderId);
  }

  async getByOrderIds(orderIds) {
    const wanted = new Set(orderIds);
    const rows = await this.messages.read();
    return rows.filter((message) => wanted.has(message.orderId));
  }

  async add(payload) {
    return this.messages.update((rows) => {
      const id = payload.id || `MSG-${maxNumericId(rows, 'MSG') + 1}`;
      const message = {
        id,
        channel: payload.channel || 'manual',
        from: payload.from || null,
        fromName: payload.fromName || null,
        to: payload.to || null,
        subject: payload.subject || null,
        body: payload.body || '',
        receivedAt: payload.receivedAt || new Date().toISOString(),
        seedState: payload.seedState || null,
        minutesAgo: payload.minutesAgo ?? null,
        status: payload.status || 'new',
        analysis: payload.analysis || null,
        orderId: payload.orderId || null,
      };
      rows.push(message);
      return message;
    });
  }

  async update(id, patch) {
    return this.messages.update((rows) => {
      const message = rows.find((row) => row.id === id);
      if (!message) return null;
      Object.assign(message, patch);
      return message;
    });
  }

  async updateMany(updates) {
    return this.messages.update((rows) => {
      const changed = [];
      for (const update of updates) {
        const message = rows.find((row) => row.id === update.id);
        if (!message) continue;
        Object.assign(message, update.patch);
        changed.push(message);
      }
      return changed;
    });
  }

  async stats() {
    const rows = await this.messages.read();
    return {
      total: rows.length,
      pending: rows.filter((message) => message.status === 'new').length,
      processed: rows.filter((message) => message.status === 'processed').length,
      filtered: rows.filter((message) => message.status === 'filtered').length,
    };
  }
}
