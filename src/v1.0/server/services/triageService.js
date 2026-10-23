import { config } from '../config.js';
import { extractBatch } from '../adapters/ai/index.js';
import { extractMessage } from '../adapters/ai/fallbackExtractor.js';
import {
  ACTIVITY_ACTIONS,
  CHANNELS,
  CHANNEL_LABELS,
} from '../domain/constants.js';
import { todayInMalaysia } from '../domain/dates.js';
import { cleanMultiline, cleanString, isNonEmptyString } from '../domain/validation.js';

function summarizeCounts(counts) {
  const parts = [`${counts.scanned} message${counts.scanned === 1 ? '' : 's'} scanned`];
  if (counts.ordersCreated) parts.push(`${counts.ordersCreated} order${counts.ordersCreated === 1 ? '' : 's'} created`);
  if (counts.ordersUpdated) parts.push(`${counts.ordersUpdated} updated`);
  if (counts.changeRequests) parts.push(`${counts.changeRequests} change request${counts.changeRequests === 1 ? '' : 's'}`);
  if (counts.filtered) parts.push(`${counts.filtered} filtered`);
  if (counts.errors) parts.push(`${counts.errors} error${counts.errors === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export class TriageService {
  constructor({ repositories, orderService, activityService }) {
    this.repositories = repositories;
    this.orderService = orderService;
    this.activity = activityService;
  }

  validateImport(payload = {}) {
    const channel = CHANNELS.includes(payload.channel) ? payload.channel : 'manual';
    const body = cleanMultiline(payload.body, 8000);
    if (!body || body.length < 3) {
      const error = new Error('Message body is required (at least 3 characters).');
      error.status = 400;
      error.code = 'INVALID_MESSAGE';
      throw error;
    }
    return {
      channel,
      from: cleanString(payload.from, 200) || (channel === 'manual' ? 'Manual entry' : null),
      fromName: cleanString(payload.fromName, 120) || null,
      to: cleanString(payload.to, 200) || config.business.name,
      subject: cleanString(payload.subject, 240) || null,
      body,
      receivedAt: payload.receivedAt || new Date().toISOString(),
    };
  }

  async importMessage(payload, { actor } = {}) {
    const validated = this.validateImport(payload);
    const message = await this.repositories.messages.add({
      ...validated,
      status: 'new',
      analysis: null,
      orderId: null,
    });
    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.MESSAGE_IMPORTED,
      entityType: 'message',
      entityId: message.id,
      summary: `${CHANNEL_LABELS[message.channel] || message.channel} message ${message.id} added to the inbox.`,
      details: { channel: message.channel, from: message.from, subject: message.subject },
      at: message.receivedAt,
    });
    return message;
  }

  async processMessages(messages, { actor, mode = 'auto', today = todayInMalaysia() } = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        scanned: 0,
        ordersCreated: 0,
        ordersUpdated: 0,
        changeRequests: 0,
        cancelled: 0,
        filtered: 0,
        errors: 0,
        modeUsed: 'rules',
        provider: null,
        model: null,
        latencyMs: 0,
        orders: [],
        messageResults: [],
        fallbackReason: null,
      };
    }

    if (mode === 'ai' && !config.ai.configured) {
      const error = new Error(
        'AI mode was requested but no AI key is configured. Add AI_API_KEY (or a provider key) in Replit Secrets, or run in rules mode.',
      );
      error.status = 400;
      error.code = 'AI_NOT_CONFIGURED';
      throw error;
    }

    const sorted = messages
      .slice()
      .sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt)));
    const started = Date.now();
    const useAI = config.ai.configured && mode !== 'rules';
    const products = await this.repositories.catalog.getProducts();
    const customers = await this.repositories.catalog.getCustomers();

    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.TRIAGE_STARTED,
      entityType: 'inbox',
      entityId: 'inbox',
      summary: `Scanning ${sorted.length} inbox message${sorted.length === 1 ? '' : 's'} (${useAI ? 'AI' : 'rules'}).`,
      details: { messageIds: sorted.map((message) => message.id), mode: useAI ? 'ai' : 'rules' },
    });

    const extractions = new Map();
    let fallbackReason = null;
    let aiLatencyMs = 0;
    let aiProvider = null;
    let aiModel = null;
    let aiErrors = [];

    if (useAI) {
      try {
        const ai = await extractBatch(sorted, { products, customers, today });
        aiLatencyMs = ai.meta.latencyMs;
        aiProvider = ai.meta.provider;
        aiModel = ai.meta.model;
        aiErrors = ai.meta.errors || [];
        sorted.forEach((message, index) => {
          const result = ai.results[index];
          if (result) extractions.set(message.id, result);
        });
        if (aiErrors.length > 0) {
          fallbackReason = aiErrors[0].message;
          await this.activity.log({
            actor,
            action: ACTIVITY_ACTIONS.AI_FALLBACK,
            entityType: 'inbox',
            entityId: 'inbox',
            summary: `AI could not process ${aiErrors.reduce((total, error) => total + error.messageIds.length, 0)} message(s); rules fallback used for those.`,
            details: { errors: aiErrors },
          });
        }
      } catch (error) {
        fallbackReason = error.message;
        await this.activity.log({
          actor,
          action: ACTIVITY_ACTIONS.AI_FALLBACK,
          entityType: 'inbox',
          entityId: 'inbox',
          summary: 'AI extraction failed; rules fallback used for this batch.',
          details: { error: error.message, code: error.code || null },
        });
      }
    }

    const counts = {
      scanned: sorted.length,
      ordersCreated: 0,
      ordersUpdated: 0,
      changeRequests: 0,
      cancelled: 0,
      filtered: 0,
      errors: 0,
    };
    const affected = [];
    const messageResults = [];
    let usedFallbackCount = 0;

    for (const message of sorted) {
      let extraction = extractions.get(message.id) || null;
      if (!extraction) {
        extraction = extractMessage(message, { products, customers, today });
        if (useAI) usedFallbackCount += 1;
      }
      try {
        const outcome = await this.orderService.upsertFromExtraction(extraction, message, {
          actor,
          at: message.receivedAt || new Date().toISOString(),
          mode: extraction.mode,
        });
        if (outcome.action === 'created') counts.ordersCreated += 1;
        else if (outcome.action === 'updated') counts.ordersUpdated += 1;
        else if (outcome.action === 'change_request') {
          counts.ordersCreated += 1;
          counts.changeRequests += 1;
        } else if (outcome.action === 'cancelled') counts.cancelled += 1;
        else counts.filtered += 1;
        if (outcome.order) affected.push(outcome.order);
        messageResults.push({
          id: message.id,
          status: outcome.action,
          orderId: outcome.order?.id || null,
          orderCode: outcome.order?.code || null,
          category: extraction.category,
          confidence: extraction.confidence,
          mode: extraction.mode,
        });
      } catch (error) {
        counts.errors += 1;
        await this.repositories.messages.update(message.id, {
          status: 'error',
          analysis: {
            ...extraction,
            error: { message: error.message, code: error.code || null },
          },
          orderId: null,
          processedAt: new Date().toISOString(),
        });
        await this.activity.log({
          actor,
          action: ACTIVITY_ACTIONS.TRIAGE_ERROR,
          entityType: 'message',
          entityId: message.id,
          summary: `Could not process ${message.id}: ${error.message}`,
          details: { messageId: message.id, error: error.message, code: error.code || null },
        });
        messageResults.push({
          id: message.id,
          status: 'error',
          error: error.message,
          category: extraction.category,
          mode: extraction.mode,
        });
      }
    }

    const latencyMs = Date.now() - started;
    const modeUsed =
      !useAI || usedFallbackCount === 0
        ? useAI
          ? 'ai'
          : 'rules'
        : usedFallbackCount === sorted.length
          ? 'rules'
          : 'mixed';
    const summary = summarizeCounts(counts);

    await this.activity.log({
      actor,
      action: ACTIVITY_ACTIONS.TRIAGE_COMPLETED,
      entityType: 'inbox',
      entityId: 'inbox',
      summary,
      details: {
        ...counts,
        mode: modeUsed,
        requestedMode: mode,
        provider: aiProvider,
        model: aiModel,
        aiLatencyMs,
        totalLatencyMs: latencyMs,
        fallbackReason,
        messageIds: sorted.map((message) => message.id),
      },
    });

    return {
      ...counts,
      modeUsed,
      provider: aiProvider,
      model: aiModel,
      latencyMs,
      aiLatencyMs,
      fallbackReason,
      orders: affected,
      messageResults,
    };
  }

  async processPending({ actor, mode = 'auto', today = todayInMalaysia() } = {}) {
    const pending = await this.repositories.messages.getPending();
    return this.processMessages(pending, { actor, mode, today });
  }

  async processMessageById(id, { actor, mode = 'auto', today = todayInMalaysia() } = {}) {
    const message = await this.repositories.messages.getById(id);
    if (!message) {
      const error = new Error(`Message ${id} not found`);
      error.status = 404;
      throw error;
    }
    if (message.status !== 'new') {
      const error = new Error(`Message ${id} has already been ${message.status}`);
      error.status = 409;
      throw error;
    }
    return this.processMessages([message], { actor, mode, today });
  }
}
