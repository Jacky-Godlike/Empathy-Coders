function maxNumericId(rows) {
  return rows.reduce((max, row) => {
    const match = /^PD-(\d+)$/.exec(row.id || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000);
}

export class PurchaseDraftRepository {
  constructor({ purchaseDrafts }) {
    this.purchaseDrafts = purchaseDrafts;
  }

  async getAll() {
    return this.purchaseDrafts.read();
  }

  async getById(id) {
    const rows = await this.purchaseDrafts.read();
    return rows.find((draft) => draft.id === id) || null;
  }

  async getByOrderId(orderId) {
    const rows = await this.purchaseDrafts.read();
    return rows.filter((draft) => draft.orderId === orderId);
  }

  async add(payload) {
    return this.purchaseDrafts.update((rows) => {
      const draft = {
        id: `PD-${maxNumericId(rows) + 1}`,
        orderId: payload.orderId,
        orderCode: payload.orderCode || null,
        supplierId: payload.supplierId,
        supplierName: payload.supplierName || null,
        items: payload.items || [],
        expectedDate: payload.expectedDate || null,
        status: payload.status || 'draft',
        estimatedCost: payload.estimatedCost || 0,
        note: payload.note || 'Internal draft only. No purchase order is sent automatically.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        receivedAt: null,
      };
      rows.push(draft);
      return draft;
    });
  }

  async update(id, patch) {
    return this.purchaseDrafts.update((rows) => {
      const draft = rows.find((row) => row.id === id);
      if (!draft) return null;
      Object.assign(draft, patch, { updatedAt: new Date().toISOString() });
      return draft;
    });
  }
}
