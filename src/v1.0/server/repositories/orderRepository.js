function nextOrderCode(rows) {
  const max = rows.reduce((current, row) => {
    const match = /^OP-(\d+)$/.exec(row.code || '');
    return match ? Math.max(current, Number(match[1])) : current;
  }, 1000);
  return `OP-${max + 1}`;
}

export class OrderRepository {
  constructor({ orders }) {
    this.orders = orders;
  }

  async getAll() {
    return this.orders.read();
  }

  async getById(id) {
    const rows = await this.orders.read();
    return rows.find((order) => order.id === id || order.code === id) || null;
  }

  async getByStatuses(statuses) {
    const wanted = new Set(statuses);
    const rows = await this.orders.read();
    return rows.filter((order) => wanted.has(order.status));
  }

  async getOpenDraftForCustomer(customerKey, sinceISO) {
    if (!customerKey) return null;
    const rows = await this.orders.read();
    return (
      rows
        .filter(
          (order) =>
            order.customerKey === customerKey &&
            ['draft', 'needs_info'].includes(order.status) &&
            (!sinceISO || String(order.createdAt) >= sinceISO),
        )
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null
    );
  }

  async getPotentialDuplicates({ customerKey, excludeOrderId, sinceISO }) {
    if (!customerKey) return [];
    const rows = await this.orders.read();
    return rows.filter(
      (order) =>
        order.customerKey === customerKey &&
        order.id !== excludeOrderId &&
        ['draft', 'needs_info', 'approved'].includes(order.status) &&
        (!sinceISO || String(order.createdAt) >= sinceISO),
    );
  }

  async add(payload) {
    return this.orders.update((rows) => {
      const code = payload.code || nextOrderCode(rows);
      const now = payload.createdAt || new Date().toISOString();
      const order = {
        id: payload.id || `ord_${code.toLowerCase()}`,
        code,
        status: payload.status || 'draft',
        customerKey: payload.customerKey || null,
        customerId: payload.customerId || null,
        customer: payload.customer || {},
        items: payload.items || [],
        deliveryDate: payload.deliveryDate || null,
        notes: payload.notes || null,
        channel: payload.channel || 'manual',
        sourceMessageIds: payload.sourceMessageIds || [],
        confidence: payload.confidence ?? null,
        extractionMode: payload.extractionMode || 'rules',
        extractionProvider: payload.extractionProvider || null,
        recommendation: payload.recommendation || null,
        checks: payload.checks || null,
        totals: payload.totals || null,
        flags: payload.flags || {},
        parentOrderId: payload.parentOrderId || null,
        changeRequest: Boolean(payload.changeRequest),
        replyDraft: payload.replyDraft || null,
        approvalNote: payload.approvalNote || null,
        rejectionReason: payload.rejectionReason || null,
        approvedBy: payload.approvedBy || null,
        approvedAt: payload.approvedAt || null,
        createdAt: now,
        updatedAt: payload.updatedAt || now,
      };
      rows.push(order);
      return order;
    });
  }

  async update(id, patch) {
    return this.orders.update((rows) => {
      const order = rows.find((row) => row.id === id || row.code === id);
      if (!order) return null;
      Object.assign(order, patch, { updatedAt: new Date().toISOString() });
      return order;
    });
  }

  async stats() {
    const rows = await this.orders.read();
    return {
      total: rows.length,
      draft: rows.filter((order) => order.status === 'draft').length,
      needsInfo: rows.filter((order) => order.status === 'needs_info').length,
      approved: rows.filter((order) => order.status === 'approved').length,
      rejected: rows.filter((order) => order.status === 'rejected').length,
    };
  }
}
