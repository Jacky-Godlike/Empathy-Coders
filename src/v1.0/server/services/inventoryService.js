import { ACTIVITY_ACTIONS } from '../domain/constants.js';
import { formatMYR, fromCents, toCents } from '../domain/money.js';

export class InventoryService {
  constructor({ repositories, orbyteAdapter, activityService }) {
    this.repositories = repositories;
    this.orbyte = orbyteAdapter;
    this.activity = activityService;
  }

  /**
   * Reserve the available part of each order line. Shortages are not reserved;
   * they are covered by purchase drafts.
   */
  async reserveForOrder(order, stockCheck, { actor }) {
    const updates = [];
    for (const line of stockCheck.lines || []) {
      const reserveQuantity = Math.max(0, line.required - line.shortage);
      if (reserveQuantity > 0) updates.push({ sku: line.sku, reservedDelta: reserveQuantity });
    }
    if (updates.length === 0) return [];
    const changed = await this.repositories.catalog.adjustStock(updates);
    const reservation = changed.map((row) => ({
      sku: row.sku,
      quantity: updates.find((update) => update.sku === row.sku)?.reservedDelta || 0,
    }));
    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.STOCK_RESERVED,
      entityType: 'inventory',
      entityId: order.code,
      orderId: order.id,
      summary: `Reserved stock for ${order.code}.`,
      details: { reservation },
    });
    return reservation;
  }

  async releaseReservation(order, { actor, reason = 'Reservation released' }) {
    const reservation = order.reservation || [];
    if (reservation.length === 0) return [];
    const updates = reservation.map((item) => ({ sku: item.sku, reservedDelta: -Math.abs(item.quantity) }));
    await this.repositories.catalog.adjustStock(updates);
    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.STOCK_RELEASED,
      entityType: 'inventory',
      entityId: order.code,
      orderId: order.id,
      summary: `Released stock reservation for ${order.code}.`,
      details: { reason, reservation },
    });
    return updates;
  }

  /**
   * Create one internal purchase draft per supplier. Nothing is sent to a
   * supplier automatically; the draft is a visible, auditable reminder.
   */
  async createPurchaseDrafts(order, stockCheck, { actor }) {
    const shortageLines = stockCheck.shortageLines || [];
    if (shortageLines.length === 0) return [];
    const groups = new Map();
    for (const line of shortageLines) {
      const key = line.supplierId || 'UNASSIGNED';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(line);
    }

    const drafts = [];
    for (const [supplierId, lines] of groups.entries()) {
      const supplier = supplierId === 'UNASSIGNED' ? null : await this.repositories.catalog.getSupplierById(supplierId);
      const items = lines.map((line) => {
        const orderItem = (order.items || []).find((item) => item.sku === line.sku);
        const unitCost = Number(orderItem?.unitCost) || 0;
        return {
          sku: line.sku,
          productName: line.productName,
          quantity: line.shortage,
          unit: line.unit,
          unitCost,
          lineCost: fromCents(toCents(unitCost) * line.shortage),
        };
      });
      const estimatedCost = fromCents(
        items.reduce((total, item) => total + toCents(item.lineCost), 0),
      );
      const expectedDate = lines
        .map((line) => line.restockBy)
        .filter(Boolean)
        .sort()
        .at(-1) || null;
      const note =
        supplierId === 'UNASSIGNED'
          ? 'Manual procurement required: no supplier is on file. Internal draft only; no purchase order is sent automatically.'
          : 'Internal draft only. No purchase order is sent automatically. Confirm with the supplier before ordering.';

      const draft = await this.orbyte.createPurchaseDraft({
        orderId: order.id,
        orderCode: order.code,
        supplierId: supplier?.id || null,
        supplierName: supplier?.name || 'No supplier on file',
        items,
        expectedDate,
        status: 'draft',
        estimatedCost,
        note,
      });
      drafts.push(draft);
      await this.activity.log({
        actor,
        action: ACTIVITY_ACTIONS.PURCHASE_DRAFT_CREATED,
        entityType: 'purchase_draft',
        entityId: draft.id,
        orderId: order.id,
        summary: `Purchase draft ${draft.id} created for ${supplier?.name || 'manual procurement'} (${formatMYR(estimatedCost)}).`,
        details: { draft, orderCode: order.code },
      });
    }
    return drafts;
  }

  async receivePurchaseDraft(id, { actor }) {
    const draft = await this.repositories.purchaseDrafts.getById(id);
    if (!draft) {
      const error = new Error(`Purchase draft ${id} not found`);
      error.status = 404;
      throw error;
    }
    if (draft.status !== 'draft') {
      const error = new Error(`Purchase draft ${id} is already ${draft.status}`);
      error.status = 409;
      throw error;
    }

    const updates = draft.items.map((item) => ({
      sku: item.sku,
      onHandDelta: item.quantity,
      reservedDelta: item.quantity,
    }));
    await this.repositories.catalog.adjustStock(updates);
    const updatedDraft = await this.repositories.purchaseDrafts.update(id, {
      status: 'received',
      receivedAt: new Date().toISOString(),
    });

    const order = await this.repositories.orders.getById(draft.orderId);
    let updatedOrder = order;
    if (order) {
      const existingReservation = new Map(
        (order.reservation || []).map((item) => [item.sku, Number(item.quantity) || 0]),
      );
      for (const item of draft.items) {
        existingReservation.set(item.sku, (existingReservation.get(item.sku) || 0) + item.quantity);
      }
      const receivedDrafts = new Set(order.receivedPurchaseDrafts || []);
      receivedDrafts.add(draft.id);
      const allDrafts = await this.repositories.purchaseDrafts.getByOrderId(order.id);
      const anyPending = allDrafts.some((entry) => entry.id !== draft.id && entry.status === 'draft');
      updatedOrder = await this.repositories.orders.update(order.id, {
        reservation: [...existingReservation.entries()].map(([sku, quantity]) => ({ sku, quantity })),
        receivedPurchaseDrafts: [...receivedDrafts],
        procurementPending: anyPending,
      });
    }

    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.PURCHASE_DRAFT_RECEIVED,
      entityType: 'purchase_draft',
      entityId: draft.id,
      orderId: draft.orderId,
      summary: `Stock received for ${draft.id} from ${draft.supplierName}; ${draft.orderCode || 'order'} is now fully covered.`,
      details: { draft: updatedDraft, items: draft.items },
    });

    return { draft: updatedDraft, order: updatedOrder };
  }

  async stockSummary() {
    const [stock, products, suppliers] = await Promise.all([
      this.repositories.catalog.getStock(),
      this.repositories.catalog.getProducts(),
      this.repositories.catalog.getSuppliers(),
    ]);
    const productMap = new Map(products.map((product) => [product.sku, product]));
    const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
    return stock.map((row) => {
      const product = productMap.get(row.sku);
      const supplier = product ? supplierMap.get(product.supplierId) : null;
      const available = Math.max(0, Number(row.onHand) - Number(row.reserved));
      const safetyStock = Number(product?.safetyStock) || 0;
      let status = 'healthy';
      if (available <= 0) status = 'out';
      else if (available < safetyStock) status = 'low';
      return {
        sku: row.sku,
        productName: product?.name || row.sku,
        category: product?.category || null,
        unit: product?.unit || null,
        onHand: Number(row.onHand) || 0,
        reserved: Number(row.reserved) || 0,
        available,
        safetyStock,
        status,
        sellingPrice: product?.sellingPrice ?? null,
        unitCost: product?.unitCost ?? null,
        supplierId: product?.supplierId || null,
        supplierName: supplier?.name || null,
        leadTimeDays: supplier?.leadTimeDays ?? null,
        lastCountedAt: row.lastCountedAt || null,
      };
    });
  }
}
