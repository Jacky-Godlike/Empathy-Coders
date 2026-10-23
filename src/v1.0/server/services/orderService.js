import { config } from '../config.js';
import {
  ACTIVITY_ACTIONS,
  ACTOR_SYSTEM,
  ORDER_STATUS,
  RECOMMENDATION,
} from '../domain/constants.js';
import { formatLongDate, isValidISODate, todayInMalaysia } from '../domain/dates.js';
import { formatMYR } from '../domain/money.js';
import {
  cleanMultiline,
  cleanString,
  customerKey as makeCustomerKey,
  isNonEmptyString,
  normalizeEmail,
  normalizePhone,
} from '../domain/validation.js';
import {
  applyOperation,
  mergeCustomer,
  mergeDeliveryDate,
  mergeNotes,
  mergeSourceMessages,
} from './consolidation.js';
import { evaluateOrder } from './decisionEngine.js';

function usableFromName(name) {
  if (!isNonEmptyString(name)) return null;
  return /^(unknown|admin|administrator|finance|sales|support|team|owner|manager|rewards centre|lucky draw|coffee deals|syrup deals)$/i.test(
    name.trim(),
  )
    ? null
    : name.trim();
}

function combinedMode(sources) {
  const modes = [...new Set((sources || []).map((source) => source.mode).filter(Boolean))];
  if (modes.length === 0) return 'rules';
  if (modes.length === 1) return modes[0];
  return 'mixed';
}

function combinedProvider(sources, fallback = null) {
  const sourcesWithProvider = (sources || []).filter((source) => source.provider);
  if (sourcesWithProvider.length === 0) return fallback;
  return sourcesWithProvider.at(-1).provider;
}

function summarizeOperation(operation, items) {
  if (operation === 'add') {
    return items
      .map((item) => `+${item.quantity ?? '?'} × ${item.productName}`)
      .join(', ')
      .slice(0, 160);
  }
  if (operation === 'replace') {
    return items
      .map((item) => `${item.productName} → ${item.quantity ?? '?'}`)
      .join(', ')
      .slice(0, 160);
  }
  if (operation === 'remove') {
    return `removed ${items.map((item) => item.productName).join(', ')}`.slice(0, 160);
  }
  return 'details updated';
}

export class OrderService {
  constructor({ repositories, orbyteAdapter, activityService, inventoryService }) {
    this.repositories = repositories;
    this.orbyte = orbyteAdapter;
    this.activity = activityService;
    this.inventory = inventoryService;
  }

  ensureOwner(actor) {
    if (!actor || actor.role !== 'owner') {
      const error = new Error(
        'Only an Owner/Manager can approve, reject, edit or reset orders. Staff can review orders and request information.',
      );
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }
  }

  async loadEvaluationData() {
    const [products, suppliers, stock, orders] = await Promise.all([
      this.repositories.catalog.getProducts(),
      this.repositories.catalog.getSuppliers(),
      this.repositories.catalog.getStock(),
      this.repositories.orders.getAll(),
    ]);
    return { products, suppliers, stock, orders };
  }

  adjustedStockFor(order, data) {
    if (!order.parentOrderId) return data.stock;
    const parent = data.orders.find((candidate) => candidate.id === order.parentOrderId);
    if (
      !parent ||
      parent.status !== ORDER_STATUS.APPROVED ||
      !Array.isArray(parent.reservation) ||
      parent.reservation.length === 0
    ) {
      return data.stock;
    }
    const release = new Map(parent.reservation.map((item) => [item.sku, Number(item.quantity) || 0]));
    return data.stock.map((row) =>
      release.has(row.sku)
        ? { ...row, reserved: Math.max(0, Number(row.reserved) - release.get(row.sku)) }
        : row,
    );
  }

  evaluateWithData(order, data, { now, today } = {}) {
    return evaluateOrder(order, {
      products: data.products,
      suppliers: data.suppliers,
      stock: this.adjustedStockFor(order, data),
      existingOrders: data.orders,
      rules: config.rules,
      today: today || todayInMalaysia(),
      now: now || new Date().toISOString(),
    });
  }

  snapshot(order, result, now) {
    return {
      ...order,
      items: result.normalizedItems,
      recommendation: result.recommendation,
      checks: result.checks,
      totals: result.totals,
      summary: result.summary,
      canApprove: result.canApprove,
      approvalRequiresNote: result.approvalRequiresNote,
      evaluatedAt: now || new Date().toISOString(),
    };
  }

  async resolveCustomer(extraction, message) {
    const fromPhone = message.from && !String(message.from).includes('@') ? normalizePhone(message.from) : null;
    const fromEmail = normalizeEmail(message.from);
    const extracted = extraction.customer || {};
    const master = await this.repositories.catalog.findCustomer({
      phone: extracted.phone || fromPhone,
      email: extracted.email || fromEmail,
      name: extracted.name || usableFromName(message.fromName),
    });

    if (master) {
      return {
        customerId: master.id,
        name: master.name || extracted.name || null,
        businessName: master.businessName || extracted.businessName || null,
        phone: extracted.phone || master.phone || fromPhone || null,
        email: extracted.email || master.email || fromEmail || null,
        address: extracted.address || master.address || null,
        addressSource: extracted.address
          ? extracted.addressSource || 'message'
          : master.address
            ? 'profile'
            : null,
        matched: true,
        type: master.type || null,
      };
    }

    return {
      customerId: null,
      name: extracted.name || usableFromName(message.fromName) || null,
      businessName: extracted.businessName || null,
      phone: extracted.phone || fromPhone || null,
      email: extracted.email || fromEmail || null,
      address: extracted.address || null,
      addressSource: extracted.address ? extracted.addressSource || 'message' : null,
      matched: false,
      type: null,
    };
  }

  sanitizeIncomingItems(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        productName: item?.productName || item?.sku || 'Unknown product',
        sku: item?.sku || null,
        quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : null,
        unit: item?.unit || null,
        unitPrice:
          Number.isFinite(Number(item?.unitPrice)) && Number(item.unitPrice) > 0
            ? Number(item.unitPrice)
            : null,
        unitMismatch: Boolean(item?.unitMismatch),
        matchConfidence: item?.matchConfidence ?? null,
      }))
      .filter((item) => item.sku || isNonEmptyString(item.productName));
  }

  async markMessage(message, extraction, order, at) {
    return this.repositories.messages.update(message.id, {
      status: order ? 'processed' : 'filtered',
      analysis: extraction,
      orderId: order?.id || null,
      orderCode: order?.code || null,
      processedAt: at,
    });
  }

  /**
   * Turn one extraction into an order, a consolidation update, or a change
   * request. The decision snapshot is recomputed after every change.
   */
  async upsertFromExtraction(extraction, message, { actor = ACTOR_SYSTEM, at, mode, seed = false } = {}) {
    const eventAt = at || message.receivedAt || new Date().toISOString();
    const extractionMode = mode || extraction.mode || 'rules';

    if (!extraction.isOrder) {
      await this.markMessage(message, extraction, null, eventAt);
      return { order: null, action: 'filtered' };
    }

    const incomingItems = this.sanitizeIncomingItems(extraction.items);
    const operation = extraction.operation || 'none';
    const resolvedCustomer = await this.resolveCustomer(extraction, message);
    const key = makeCustomerKey(resolvedCustomer);
    const allOrders = await this.repositories.orders.getAll();
    const windowStart = new Date(
      Date.parse(eventAt) - config.rules.consolidationWindowHours * 3_600_000,
    ).toISOString();

    const openDraft =
      allOrders
        .filter(
          (order) =>
            order.customerKey === key &&
            [ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO].includes(order.status) &&
            String(order.createdAt) >= windowStart,
        )
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;

    const approvedOrder =
      allOrders
        .filter(
          (order) =>
            order.customerKey === key &&
            order.status === ORDER_STATUS.APPROVED &&
            String(order.createdAt) >= windowStart,
        )
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;

    const sourceEntry = {
      messageId: message.id,
      mode: extractionMode,
      provider: extraction.provider || null,
      model: extraction.model || null,
      confidence: extraction.confidence ?? null,
      at: eventAt,
    };

    const data = await this.loadEvaluationData();

    // 1. Merge into an existing draft. A plain new order from the same customer
    //    inside the consolidation window is treated as an addition.
    if (openDraft) {
      const effectiveOperation = operation === 'none' ? 'add' : operation;
      const removeAll = effectiveOperation === 'remove' && incomingItems.length === 0;
      const applied = applyOperation(openDraft.items, effectiveOperation, incomingItems, { removeAll });

      if (removeAll && applied.items.length === 0) {
        const cancelled = await this.repositories.orders.update(openDraft.id, {
          status: ORDER_STATUS.CANCELLED,
          cancellationReason: 'Customer requested cancellation',
          notes: mergeNotes(openDraft.notes, extraction.notes),
          sourceMessageIds: mergeSourceMessages(openDraft.sourceMessageIds, message.id),
          updatedAt: eventAt,
        });
        await this.markMessage(message, extraction, cancelled, eventAt);
        await this.activity.log({
          actor,
          action: ACTIVITY_ACTIONS.ORDER_CANCELLED,
          entityId: cancelled.id,
          orderId: cancelled.id,
          summary: `${cancelled.code} cancelled from ${message.id}.`,
          details: { messageId: message.id, operation },
          at: eventAt,
        });
        return { order: cancelled, action: 'cancelled' };
      }

      const nextSources = [...(openDraft.extractionSources || []), sourceEntry];
      const updated = {
        ...openDraft,
        customer: mergeCustomer(openDraft.customer, resolvedCustomer),
        customerKey: key,
        items: applied.items,
        deliveryDate: mergeDeliveryDate(openDraft.deliveryDate, extraction.deliveryDate, effectiveOperation),
        notes: mergeNotes(openDraft.notes, extraction.notes),
        sourceMessageIds: mergeSourceMessages(openDraft.sourceMessageIds, message.id),
        confidence:
          Number.isFinite(Number(openDraft.confidence)) && Number.isFinite(Number(extraction.confidence))
            ? Math.min(Number(openDraft.confidence), Number(extraction.confidence))
            : extraction.confidence ?? openDraft.confidence ?? null,
        extractionSources: nextSources,
        extractionMode: combinedMode(nextSources),
        extractionProvider: combinedProvider(nextSources, openDraft.extractionProvider),
        updatedAt: eventAt,
      };

      const result = this.evaluateWithData(updated, data, { now: eventAt });
      const snapshot = this.snapshot(updated, result, eventAt);
      const saved = await this.repositories.orders.update(openDraft.id, snapshot);
      await this.markMessage(message, extraction, saved, eventAt);
      await this.activity.log({
        actor,
        action: ACTIVITY_ACTIONS.ORDER_UPDATED,
        entityId: saved.id,
        orderId: saved.id,
        summary: `${saved.code} updated from ${message.id}: ${summarizeOperation(effectiveOperation, incomingItems)}.`,
        details: {
          messageId: message.id,
          operation: effectiveOperation,
          items: incomingItems,
          recommendation: result.recommendation.code,
          sourceCount: saved.sourceMessageIds.length,
        },
        at: eventAt,
      });
      return { order: saved, action: 'updated' };
    }

    // 2. An update after approval becomes a fresh change request.
    if (approvedOrder && ['add', 'replace', 'remove', 'update'].includes(operation)) {
      const removeAll = operation === 'remove' && incomingItems.length === 0;
      const applied = applyOperation(approvedOrder.items, operation, incomingItems, { removeAll });
      const cancellationRequested = removeAll && applied.items.length === 0;
      const nextSources = [sourceEntry];
      const changeRequest = {
        id: null,
        code: null,
        status: ORDER_STATUS.DRAFT,
        customerKey: key,
        customerId: resolvedCustomer.customerId,
        customer: mergeCustomer(approvedOrder.customer, resolvedCustomer),
        items: cancellationRequested ? approvedOrder.items : applied.items,
        deliveryDate: mergeDeliveryDate(approvedOrder.deliveryDate, extraction.deliveryDate, operation),
        notes: mergeNotes(
          `Change request for ${approvedOrder.code}.${cancellationRequested ? ' Customer requested cancellation.' : ''}`,
          extraction.notes,
        ),
        channel: message.channel,
        sourceMessageIds: [message.id],
        confidence: extraction.confidence ?? null,
        extractionMode: combinedMode(nextSources),
        extractionProvider: combinedProvider(nextSources),
        extractionSources: nextSources,
        changeRequest: true,
        cancellationRequested,
        parentOrderId: approvedOrder.id,
        flags: { changeRequest: true, cancellationRequested },
        createdAt: eventAt,
        updatedAt: eventAt,
      };

      const result = this.evaluateWithData(changeRequest, data, { now: eventAt });
      const snapshot = this.snapshot(changeRequest, result, eventAt);
      const saved = await this.repositories.orders.add(snapshot);
      await this.markMessage(message, extraction, saved, eventAt);
      await this.activity.log({
        actor,
        action: ACTIVITY_ACTIONS.ORDER_CREATED,
        entityId: saved.id,
        orderId: saved.id,
        summary: `${saved.code} created as a change request for ${approvedOrder.code}: ${summarizeOperation(operation, incomingItems)}.`,
        details: {
          parentOrderId: approvedOrder.id,
          parentCode: approvedOrder.code,
          messageId: message.id,
          operation,
          cancellationRequested,
          recommendation: result.recommendation.code,
        },
        at: eventAt,
      });
      return { order: saved, action: 'change_request' };
    }

    // 3. Create a new order (or a standalone update with no matching order).
    const standaloneUpdate = ['add', 'replace', 'remove', 'update'].includes(operation);
    const nextSources = [sourceEntry];
    const newOrder = {
      id: null,
      code: null,
      status: ORDER_STATUS.DRAFT,
      customerKey: key,
      customerId: resolvedCustomer.customerId,
      customer: resolvedCustomer,
      items: incomingItems,
      deliveryDate: extraction.deliveryDate || null,
      notes: standaloneUpdate
        ? mergeNotes(extraction.notes, 'Standalone update; no matching open or approved order was found.')
        : extraction.notes,
      channel: message.channel,
      sourceMessageIds: [message.id],
      confidence: extraction.confidence ?? null,
      extractionMode: combinedMode(nextSources),
      extractionProvider: combinedProvider(nextSources, extraction.provider),
      extractionSources: nextSources,
      changeRequest: false,
      cancellationRequested: false,
      parentOrderId: null,
      flags: { standaloneUpdate },
      createdAt: eventAt,
      updatedAt: eventAt,
    };

    const result = this.evaluateWithData(newOrder, data, { now: eventAt });
    const snapshot = this.snapshot(newOrder, result, eventAt);
    const saved = await this.repositories.orders.add(snapshot);
    await this.markMessage(message, extraction, saved, eventAt);
    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.ORDER_CREATED,
      entityId: saved.id,
      orderId: saved.id,
      summary: `${saved.code} created from ${message.id}: ${result.summary.items}.`,
      details: {
        messageId: message.id,
        operation,
        standaloneUpdate,
        recommendation: result.recommendation.code,
        mode: extractionMode,
      },
      at: eventAt,
    });
    return { order: saved, action: 'created' };
  }

  async listOrders({ status = 'pending', fresh = true } = {}) {
    const data = await this.loadEvaluationData();
    let orders = data.orders;
    if (status === 'pending') {
      orders = orders.filter((order) => [ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO].includes(order.status));
    } else if (status === 'all') {
      orders = orders.slice();
    } else {
      orders = orders.filter((order) => order.status === status);
    }

    const now = new Date().toISOString();
    orders = orders.map((order) => {
      if (fresh && [ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO].includes(order.status)) {
        const result = this.evaluateWithData(order, data, { now });
        return this.snapshot(order, result, now);
      }
      return order;
    });
    orders.sort((a, b) =>
      String(b.approvedAt || b.createdAt).localeCompare(String(a.approvedAt || a.createdAt)),
    );
    return orders;
  }

  async getOrder(id) {
    const order = await this.repositories.orders.getById(id);
    if (!order) {
      const error = new Error(`Order ${id} not found`);
      error.status = 404;
      throw error;
    }
    const data = await this.loadEvaluationData();
    const now = new Date().toISOString();
    const view = [ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO].includes(order.status)
      ? this.snapshot(order, this.evaluateWithData(order, data, { now }), now)
      : order;
    const [messages, activities, purchaseDrafts] = await Promise.all([
      this.repositories.messages.getByOrderId(order.id),
      this.activity.forOrder(order.id),
      this.repositories.purchaseDrafts.getByOrderId(order.id),
    ]);
    const parent = order.parentOrderId
      ? await this.repositories.orders.getById(order.parentOrderId)
      : null;
    return {
      order: view,
      messages: messages.sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt))),
      activities,
      purchaseDrafts,
      parent: parent ? { id: parent.id, code: parent.code, status: parent.status } : null,
    };
  }

  async approve(id, { actor, note = null } = {}) {
    this.ensureOwner(actor);
    const order = await this.repositories.orders.getById(id);
    if (!order) {
      const error = new Error(`Order ${id} not found`);
      error.status = 404;
      throw error;
    }
    if (![ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO].includes(order.status)) {
      const error = new Error(`Order ${order.code} is already ${order.status}`);
      error.status = 409;
      throw error;
    }

    const data = await this.loadEvaluationData();
    const now = new Date().toISOString();
    const result = this.evaluateWithData(order, data, { now });

    if (!result.canApprove) {
      const error = new Error(
        'This order still has missing or unmatched information. Request more information or edit the order first.',
      );
      error.status = 400;
      error.code = 'NEEDS_INFO';
      error.details = { missing: result.checks.completeness.missing, productMatch: result.checks.productMatch };
      throw error;
    }

    const trimmedNote = cleanString(note, 600);
    if (result.approvalRequiresNote && !trimmedNote) {
      const error = new Error(
        'This order is high risk. Add a short justification note before approving it.',
      );
      error.status = 400;
      error.code = 'NOTE_REQUIRED';
      error.details = { recommendation: result.recommendation };
      throw error;
    }

    const parent = order.parentOrderId
      ? await this.repositories.orders.getById(order.parentOrderId)
      : null;

    // A cancellation request is approved as an instruction, not as a new order.
    if (order.cancellationRequested && parent) {
      if (parent.status === ORDER_STATUS.APPROVED) {
        await this.inventory.releaseReservation(parent, {
          actor,
          reason: `Cancellation approved via ${order.code}`,
        });
        await this.repositories.orders.update(parent.id, {
          status: ORDER_STATUS.CANCELLED,
          cancelledAt: now,
          cancellationReason: `Customer cancellation approved via ${order.code}`,
        });
        await this.activity.log({
          actor,
          action: ACTIVITY_ACTIONS.ORDER_CANCELLED,
          entityId: parent.id,
          orderId: parent.id,
          summary: `${parent.code} cancelled after customer request.`,
          details: { changeRequestId: order.id, changeRequestCode: order.code },
          at: now,
        });
      }
      const saved = await this.repositories.orders.update(order.id, {
        ...this.snapshot(order, result, now),
        status: ORDER_STATUS.APPROVED,
        approvedAction: 'cancellation',
        approvedBy: { id: actor.id, name: actor.name, role: actor.role, initials: actor.initials || null },
        approvedAt: now,
        approvalNote: trimmedNote,
      });
      await this.activity.log({
        actor,
        action: ACTIVITY_ACTIONS.ORDER_APPROVED,
        entityId: saved.id,
        orderId: saved.id,
        summary: `Cancellation request ${saved.code} approved by ${actor.name}.`,
        details: { parentOrderId: parent?.id, parentCode: parent?.code },
        at: now,
      });
      return { order: saved, purchaseDrafts: [], recommendation: result.recommendation };
    }

    // A normal change request supersedes its parent. Release the parent's
    // reservation before reserving the new quantities.
    if (parent && parent.status === ORDER_STATUS.APPROVED) {
      await this.inventory.releaseReservation(parent, {
        actor,
        reason: `Superseded by change request ${order.code}`,
      });
      await this.repositories.orders.update(parent.id, {
        status: ORDER_STATUS.SUPERSEDED,
        supersededBy: order.id,
        supersededByCode: order.code,
        supersededAt: now,
      });
      await this.activity.log({
        actor,
        action: ACTIVITY_ACTIONS.ORDER_SUPERSEDED,
        entityId: parent.id,
        orderId: parent.id,
        summary: `${parent.code} superseded by ${order.code} after a customer change.`,
        details: { supersededBy: order.id, supersededByCode: order.code },
        at: now,
      });
    }

    let reservation = [];
    let purchaseDrafts = [];
    try {
      reservation = await this.inventory.reserveForOrder(order, result.checks.stock, { actor });
      purchaseDrafts = await this.inventory.createPurchaseDrafts(
        { ...order, items: result.normalizedItems },
        result.checks.stock,
        { actor },
      );
    } catch (error) {
      if (reservation.length > 0) {
        await this.inventory.releaseReservation(
          { ...order, reservation },
          { actor, reason: 'Approval failed before purchase drafts were created' },
        );
      }
      throw error;
    }

    const saved = await this.repositories.orders.update(order.id, {
      ...this.snapshot(order, result, now),
      status: ORDER_STATUS.APPROVED,
      approvedBy: { id: actor.id, name: actor.name, role: actor.role, initials: actor.initials || null },
      approvedAt: now,
      approvalNote: trimmedNote,
      reservation,
      purchaseDraftIds: purchaseDrafts.map((draft) => draft.id),
      procurementPending: purchaseDrafts.length > 0,
      canApprove: false,
      approvalRequiresNote: false,
      updatedAt: now,
    });

    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.ORDER_APPROVED,
      entityId: saved.id,
      orderId: saved.id,
      summary: `${saved.code} approved by ${actor.name}. Revenue ${formatMYR(result.totals.revenue)} · margin ${result.totals.marginPct.toFixed(1)}% · ${result.totals.shortageUnits} units short.`,
      details: {
        note: trimmedNote,
        recommendation: result.recommendation.code,
        reasons: result.recommendation.reasons,
        totals: result.totals,
        reservation,
        purchaseDraftIds: purchaseDrafts.map((draft) => draft.id),
      },
      at: now,
    });

    return { order: saved, purchaseDrafts, recommendation: result.recommendation, reservation };
  }

  async reject(id, { actor, reason } = {}) {
    this.ensureOwner(actor);
    const order = await this.repositories.orders.getById(id);
    if (!order) {
      const error = new Error(`Order ${id} not found`);
      error.status = 404;
      throw error;
    }
    if (![ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO].includes(order.status)) {
      const error = new Error(`Order ${order.code} is already ${order.status}`);
      error.status = 409;
      throw error;
    }
    const trimmed = cleanString(reason, 600);
    if (!trimmed || trimmed.length < 3) {
      const error = new Error('A rejection reason is required.');
      error.status = 400;
      error.code = 'REASON_REQUIRED';
      throw error;
    }
    const now = new Date().toISOString();
    const saved = await this.repositories.orders.update(order.id, {
      status: ORDER_STATUS.REJECTED,
      rejectionReason: trimmed,
      rejectedBy: { id: actor.id, name: actor.name, role: actor.role, initials: actor.initials || null },
      rejectedAt: now,
      updatedAt: now,
    });
    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.ORDER_REJECTED,
      entityId: saved.id,
      orderId: saved.id,
      summary: `${saved.code} rejected by ${actor.name}: ${trimmed}`,
      details: { reason: trimmed },
      at: now,
    });
    return saved;
  }

  buildReplyDraft(order, missingLabels, note, subject) {
    const name = order.customer?.businessName || order.customer?.name || 'there';
    const missingText =
      missingLabels.length > 0
        ? missingLabels.map((label) => label.charAt(0).toLowerCase() + label.slice(1)).join(', ')
        : 'the details we discussed';
    const business = config.business.name;
    const noteLine = note ? `\n\nNote: ${note}` : '';
    const channel = order.channel || 'whatsapp';

    if (channel === 'email') {
      const emailSubject = `Re: ${subject || `Your order ${order.code}`} — missing details for ${order.code}`;
      const body = `Hi ${name},

Thanks for your order. Before we can confirm ${order.code}, could you send us: ${missingText}?

Order: ${order.summary?.items || 'see your original message'}
Delivery: ${order.deliveryDate ? formatLongDate(order.deliveryDate) : 'to be confirmed'}

Once we have these details, we will confirm stock and delivery.

Thank you,
${business}${noteLine}`;
      return { channel, subject: emailSubject, body, copyText: `Subject: ${emailSubject}\n\n${body}` };
    }

    const body = `Hi ${name}, thanks for your order. To confirm ${order.code}, could you send us: ${missingText}? Once we have these, we can confirm stock and delivery. — ${business}${noteLine}`;
    return { channel, subject: null, body, copyText: body };
  }

  async requestInfo(id, { actor, note = null } = {}) {
    const order = await this.repositories.orders.getById(id);
    if (!order) {
      const error = new Error(`Order ${id} not found`);
      error.status = 404;
      throw error;
    }
    if (![ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO].includes(order.status)) {
      const error = new Error(`Order ${order.code} is already ${order.status}`);
      error.status = 409;
      throw error;
    }
    const data = await this.loadEvaluationData();
    const now = new Date().toISOString();
    const result = this.evaluateWithData(order, data, { now });
    const missingLabels = result.checks.completeness.missing.map((field) => field.label);
    const messages = await this.repositories.messages.getByOrderId(order.id);
    const subject = messages.find((message) => message.subject)?.subject || null;
    const trimmedNote = cleanString(note, 600);
    const replyDraft = this.buildReplyDraft(order, missingLabels, trimmedNote, subject);
    const saved = await this.repositories.orders.update(order.id, {
      ...this.snapshot(order, result, now),
      status: ORDER_STATUS.NEEDS_INFO,
      replyDraft,
      infoRequestedBy: { id: actor.id, name: actor.name, role: actor.role, initials: actor.initials || null },
      infoRequestedAt: now,
      infoRequestNote: trimmedNote,
      updatedAt: now,
    });
    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.ORDER_INFO_REQUESTED,
      entityId: saved.id,
      orderId: saved.id,
      summary: `${saved.code}: information requested from ${saved.customer?.businessName || saved.customer?.name || 'customer'} (${missingLabels.join(', ') || 'manual note'}).`,
      details: { missing: missingLabels, note: trimmedNote, channel: replyDraft.channel },
      at: now,
    });
    return { order: saved, replyDraft };
  }

  async updateOrder(id, patch = {}, { actor } = {}) {
    this.ensureOwner(actor);
    const order = await this.repositories.orders.getById(id);
    if (!order) {
      const error = new Error(`Order ${id} not found`);
      error.status = 404;
      throw error;
    }
    if (![ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO].includes(order.status)) {
      const error = new Error(`Order ${order.code} is already ${order.status}`);
      error.status = 409;
      throw error;
    }

    const customerPatch = patch.customer || {};
    const customer = mergeCustomer(order.customer, {
      name: cleanString(customerPatch.name, 120),
      businessName: cleanString(customerPatch.businessName, 160),
      phone: normalizePhone(customerPatch.phone),
      email: normalizeEmail(customerPatch.email),
      address: cleanMultiline(customerPatch.address, 400),
      addressSource: customerPatch.address ? 'message' : order.customer?.addressSource || null,
    });

    let deliveryDate = order.deliveryDate;
    if (patch.deliveryDate !== undefined) {
      if (patch.deliveryDate && !isValidISODate(patch.deliveryDate)) {
        const error = new Error('Delivery date must be YYYY-MM-DD.');
        error.status = 400;
        error.code = 'INVALID_DATE';
        throw error;
      }
      deliveryDate = patch.deliveryDate || null;
    }

    let items = order.items;
    if (Array.isArray(patch.items)) {
      items = this.sanitizeIncomingItems(patch.items);
    }

    const updated = {
      ...order,
      customer,
      customerKey: makeCustomerKey(customer),
      deliveryDate,
      items,
      notes: patch.notes !== undefined ? cleanMultiline(patch.notes, 1200) : order.notes,
      updatedAt: new Date().toISOString(),
    };
    const data = await this.loadEvaluationData();
    const now = new Date().toISOString();
    const result = this.evaluateWithData(updated, data, { now });
    const snapshot = this.snapshot(updated, result, now);
    const saved = await this.repositories.orders.update(order.id, snapshot);
    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.ORDER_EDITED,
      entityId: saved.id,
      orderId: saved.id,
      summary: `${saved.code} details edited by ${actor.name}.`,
      details: { fields: Object.keys(patch), recommendation: result.recommendation.code },
      at: now,
    });
    return saved;
  }

  async receivePurchaseDraft(id, { actor } = {}) {
    this.ensureOwner(actor);
    return this.inventory.receivePurchaseDraft(id, { actor });
  }

  async listPurchaseDrafts() {
    const drafts = await this.repositories.purchaseDrafts.getAll();
    return drafts.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async catalogView() {
    const [stock, products, suppliers, customers] = await Promise.all([
      this.inventory.stockSummary(),
      this.repositories.catalog.getProducts(),
      this.repositories.catalog.getSuppliers(),
      this.repositories.catalog.getCustomers(),
    ]);
    return { stock, products, suppliers, customers };
  }

  async stats() {
    const data = await this.loadEvaluationData();
    const [messages, purchaseDrafts, activities] = await Promise.all([
      this.repositories.messages.getAll(),
      this.repositories.purchaseDrafts.getAll(),
      this.repositories.activities.getAll({ limit: 200 }),
    ]);
    const orders = data.orders;
    const now = new Date().toISOString();
    const pendingOrders = orders
      .filter((order) => [ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO].includes(order.status))
      .map((order) => this.snapshot(order, this.evaluateWithData(order, data, { now }), now));
    const byRecommendation = (code) =>
      pendingOrders.filter((order) => order.recommendation?.code === code).length;
    const approved = orders.filter((order) => order.status === ORDER_STATUS.APPROVED);
    const processedMessages = messages.filter((message) =>
      ['processed', 'filtered'].includes(message.status),
    ).length;
    const lastTriage = activities.find(
      (activity) => activity.action === ACTIVITY_ACTIONS.TRIAGE_COMPLETED,
    );
    const estimatedMinutesSaved = Math.round(processedMessages * 1.5 + approved.length * 3);

    return {
      pendingOrders: pendingOrders.length,
      ready: byRecommendation(RECOMMENDATION.READY),
      procurement: byRecommendation(RECOMMENDATION.PROCUREMENT),
      review: byRecommendation(RECOMMENDATION.REVIEW),
      needsInfo: byRecommendation(RECOMMENDATION.NEEDS_INFO),
      highRisk: byRecommendation(RECOMMENDATION.HIGH_RISK),
      changeRequest: byRecommendation(RECOMMENDATION.CHANGE_REQUEST),
      approved: approved.length,
      rejected: orders.filter((order) => order.status === ORDER_STATUS.REJECTED).length,
      superseded: orders.filter((order) => order.status === ORDER_STATUS.SUPERSEDED).length,
      pendingMessages: messages.filter((message) => message.status === 'new').length,
      processedMessages,
      filteredMessages: messages.filter((message) => message.status === 'filtered').length,
      totalOrders: orders.length,
      purchaseDraftsPending: purchaseDrafts.filter((draft) => draft.status === 'draft').length,
      purchaseDraftsReceived: purchaseDrafts.filter((draft) => draft.status === 'received').length,
      approvedRevenue: approved.reduce((total, order) => total + (Number(order.totals?.revenue) || 0), 0),
      estimatedMinutesSaved,
      lastTriage: lastTriage
        ? {
            at: lastTriage.at,
            summary: lastTriage.summary,
            details: lastTriage.details,
          }
        : null,
    };
  }
}
