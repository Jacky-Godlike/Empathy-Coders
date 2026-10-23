import path from 'node:path';

import express from 'express';
import ExcelJS from 'exceljs';

import { config, aiStatus } from './config.js';
import { testConnection } from './adapters/ai/aiClient.js';
import { ACTIVITY_ACTIONS, CHANNELS, CHANNEL_LABELS } from './domain/constants.js';
import { todayInMalaysia } from './domain/dates.js';
import { toCsv } from './domain/validation.js';

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function actorMiddleware({ repositories }) {
  return async (req, res, next) => {
    try {
      const requestedId =
        req.header('X-OrderPilot-User') || (typeof req.query.as === 'string' ? req.query.as : null);
      let actor = null;
      if (config.demo.allowRoleSwitch && requestedId) {
        actor = await repositories.users.getUserById(requestedId);
        if (!actor) {
          return res.status(401).json({
            error: { code: 'UNKNOWN_ACTOR', message: `Unknown demo user: ${requestedId}` },
          });
        }
      }
      if (!actor) actor = await repositories.users.getDefaultUser();
      if (!actor) {
        return res.status(500).json({
          error: { code: 'NO_ACTOR', message: 'No demo user is configured.' },
        });
      }
      req.actor = actor;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function rateLimit({ windowMs = 60_000, max = 30 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment and try again.',
        },
      });
    }
    return next();
  };
}

function requestLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/api/')) return;
    const elapsed = Date.now() - started;
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${elapsed}ms)`);
  });
  next();
}

function sendExport(res, { filename, contentType, body }) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(body);
}

function orderExportRows(orders) {
  return orders.map((order) => ({
    code: order.code,
    status: order.status,
    customer: order.customer?.businessName || order.customer?.name || 'Unknown',
    contact: order.customer?.name || '',
    phone: order.customer?.phone || '',
    email: order.customer?.email || '',
    address: order.customer?.address || '',
    items: (order.items || [])
      .map((item) => `${item.quantity ?? '?'} × ${item.productName}`)
      .join('; '),
    units: order.totals?.unitCount || 0,
    revenue: Number(order.totals?.revenue) || 0,
    cost: Number(order.totals?.cost) || 0,
    grossProfit: Number(order.totals?.grossProfit) || 0,
    margin: Number(order.totals?.marginPct) || 0,
    delivery: order.deliveryDate || '',
    recommendation: order.recommendation?.label || '',
    stock: order.summary?.stock || '',
    shortage: Number(order.totals?.shortageUnits) || 0,
    approvedBy: order.approvedBy?.name || '',
    approvedAt: order.approvedAt || '',
    createdAt: order.createdAt || '',
    sources: (order.sourceMessageIds || []).join(', '),
  }));
}

const ORDER_EXPORT_COLUMNS = [
  { header: 'Order', key: 'code', width: 13 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Customer', key: 'customer', width: 26 },
  { header: 'Contact', key: 'contact', width: 20 },
  { header: 'Phone', key: 'phone', width: 17 },
  { header: 'Email', key: 'email', width: 26 },
  { header: 'Address', key: 'address', width: 38 },
  { header: 'Items', key: 'items', width: 42 },
  { header: 'Units', key: 'units', width: 8 },
  { header: 'Revenue (RM)', key: 'revenue', width: 13, numFmt: '#,##0.00' },
  { header: 'Cost (RM)', key: 'cost', width: 12, numFmt: '#,##0.00' },
  { header: 'Gross profit (RM)', key: 'grossProfit', width: 15, numFmt: '#,##0.00' },
  { header: 'Margin %', key: 'margin', width: 10, numFmt: '0.0' },
  { header: 'Delivery', key: 'delivery', width: 13 },
  { header: 'Recommendation', key: 'recommendation', width: 20 },
  { header: 'Stock', key: 'stock', width: 20 },
  { header: 'Shortage units', key: 'shortage', width: 13 },
  { header: 'Approved by', key: 'approvedBy', width: 18 },
  { header: 'Approved at', key: 'approvedAt', width: 23 },
  { header: 'Created at', key: 'createdAt', width: 23 },
  { header: 'Source messages', key: 'sources', width: 34 },
];

function activityExportRows(activities) {
  return activities.map((activity) => ({
    at: activity.at,
    actor: activity.actor?.name || '',
    role: activity.actor?.role || '',
    action: activity.action,
    entityType: activity.entityType || '',
    entityId: activity.entityId || '',
    orderId: activity.orderId || '',
    summary: activity.summary || '',
    details: activity.details ? JSON.stringify(activity.details) : '',
  }));
}

const ACTIVITY_EXPORT_COLUMNS = [
  { header: 'Time', key: 'at', width: 24 },
  { header: 'Actor', key: 'actor', width: 20 },
  { header: 'Role', key: 'role', width: 10 },
  { header: 'Action', key: 'action', width: 24 },
  { header: 'Entity type', key: 'entityType', width: 16 },
  { header: 'Entity', key: 'entityId', width: 18 },
  { header: 'Order', key: 'orderId', width: 18 },
  { header: 'Summary', key: 'summary', width: 60 },
  { header: 'Details', key: 'details', width: 80 },
];

async function buildXlsx(columns, rows, sheetName) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OrderPilot';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  worksheet.columns = columns.map(({ header, key, width, numFmt }) => ({
    header,
    key,
    width,
    style: numFmt ? { numFmt } : undefined,
  }));
  worksheet.addRows(rows);
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C5C' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function createApp({ services }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    next();
  });
  app.use(express.json({ limit: config.server.bodyLimit }));
  app.use(requestLogger);

  app.get('/api/health', (req, res) => {
    const ai = aiStatus();
    res.json({
      ok: true,
      version: config.version,
      time: new Date().toISOString(),
      ai: {
        configured: ai.configured,
        mode: ai.mode,
        provider: ai.provider,
        model: ai.model,
      },
    });
  });

  app.use('/api', actorMiddleware(services));

  const {
    repositories,
    activityService,
    orbyteAdapter,
    orderService,
    triageService,
    seedService,
  } = services;

  app.get(
    '/api/bootstrap',
    asyncHandler(async (req, res) => {
      const [stats, users] = await Promise.all([
        orderService.stats(),
        repositories.users.getUsers(),
      ]);
      res.json({
        business: config.business,
        users,
        actor: req.actor,
        ai: aiStatus(),
        rules: config.rules,
        stats,
        today: todayInMalaysia(),
        orbyte: orbyteAdapter.capabilities(),
        channels: CHANNELS.map((channel) => ({ id: channel, label: CHANNEL_LABELS[channel] })),
        demo: { allowRoleSwitch: config.demo.allowRoleSwitch },
      });
    }),
  );

  app.get(
    '/api/stats',
    asyncHandler(async (req, res) => {
      res.json(await orderService.stats());
    }),
  );

  app.get(
    '/api/messages',
    asyncHandler(async (req, res) => {
      const status = typeof req.query.status === 'string' ? req.query.status : 'all';
      const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
      let messages = await repositories.messages.getAll();
      if (status !== 'all') messages = messages.filter((message) => message.status === status);
      messages.sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
      res.json({ messages: messages.slice(0, limit), total: messages.length });
    }),
  );

  app.post(
    '/api/messages/import',
    rateLimit({ max: 60 }),
    asyncHandler(async (req, res) => {
      const message = await triageService.importMessage(req.body, { actor: req.actor });
      res.status(201).json({ message });
    }),
  );

  app.post(
    '/api/messages/import-and-analyze',
    rateLimit({ max: 30 }),
    asyncHandler(async (req, res) => {
      const message = await triageService.importMessage(req.body, { actor: req.actor });
      const triage = await triageService.processMessageById(message.id, {
        actor: req.actor,
        mode: req.body?.mode || 'auto',
      });
      res.status(201).json({ message, triage });
    }),
  );

  app.post(
    '/api/triage/run',
    rateLimit({ max: 20 }),
    asyncHandler(async (req, res) => {
      const result = await triageService.processPending({
        actor: req.actor,
        mode: req.body?.mode || 'auto',
      });
      res.json(result);
    }),
  );

  app.post(
    '/api/triage/messages/:id',
    rateLimit({ max: 40 }),
    asyncHandler(async (req, res) => {
      const result = await triageService.processMessageById(req.params.id, {
        actor: req.actor,
        mode: req.body?.mode || 'auto',
      });
      res.json(result);
    }),
  );

  app.get(
    '/api/orders/export',
    asyncHandler(async (req, res) => {
      const format = req.query.format === 'xlsx' ? 'xlsx' : req.query.format === 'csv' ? 'csv' : null;
      if (!format) {
        return res.status(400).json({
          error: { code: 'INVALID_FORMAT', message: 'format must be csv or xlsx' },
        });
      }
      const status = typeof req.query.status === 'string' ? req.query.status : 'all';
      const orders = await orderService.listOrders({ status, fresh: true });
      const rows = orderExportRows(orders);
      const date = todayInMalaysia();
      await activityService.log({
        actor: req.actor,
        action: ACTIVITY_ACTIONS.EXPORT_GENERATED,
        entityType: 'export',
        entityId: 'orders',
        summary: `Exported ${orders.length} orders as ${format.toUpperCase()} (${status}).`,
        details: { format, status, count: orders.length },
      });
      if (format === 'csv') {
        const csv = toCsv(
          rows,
          ORDER_EXPORT_COLUMNS.map((column) => ({
            label: column.header,
            value: (row) => row[column.key],
          })),
        );
        sendExport(res, {
          filename: `orderpilot-orders-${date}.csv`,
          contentType: 'text/csv; charset=utf-8',
          body: `﻿${csv}`,
        });
      } else {
        const buffer = await buildXlsx(ORDER_EXPORT_COLUMNS, rows, 'Orders');
        sendExport(res, {
          filename: `orderpilot-orders-${date}.xlsx`,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          body: buffer,
        });
      }
    }),
  );

  app.get(
    '/api/orders',
    asyncHandler(async (req, res) => {
      const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
      const orders = await orderService.listOrders({ status, fresh: true });
      res.json({ orders, total: orders.length });
    }),
  );

  app.get(
    '/api/orders/:id',
    asyncHandler(async (req, res) => {
      res.json(await orderService.getOrder(req.params.id));
    }),
  );

  app.patch(
    '/api/orders/:id',
    asyncHandler(async (req, res) => {
      const order = await orderService.updateOrder(req.params.id, req.body, { actor: req.actor });
      res.json({ order });
    }),
  );

  app.post(
    '/api/orders/:id/approve',
    rateLimit({ max: 30 }),
    asyncHandler(async (req, res) => {
      const result = await orderService.approve(req.params.id, {
        actor: req.actor,
        note: req.body?.note || null,
      });
      res.json(result);
    }),
  );

  app.post(
    '/api/orders/:id/reject',
    rateLimit({ max: 30 }),
    asyncHandler(async (req, res) => {
      const order = await orderService.reject(req.params.id, {
        actor: req.actor,
        reason: req.body?.reason,
      });
      res.json({ order });
    }),
  );

  app.post(
    '/api/orders/:id/request-info',
    rateLimit({ max: 30 }),
    asyncHandler(async (req, res) => {
      const result = await orderService.requestInfo(req.params.id, {
        actor: req.actor,
        note: req.body?.note || null,
      });
      res.json(result);
    }),
  );

  app.get(
    '/api/purchase-drafts',
    asyncHandler(async (req, res) => {
      const purchaseDrafts = await orderService.listPurchaseDrafts();
      res.json({ purchaseDrafts });
    }),
  );

  app.post(
    '/api/purchase-drafts/:id/receive',
    asyncHandler(async (req, res) => {
      const result = await orderService.receivePurchaseDraft(req.params.id, { actor: req.actor });
      res.json(result);
    }),
  );

  app.get(
    '/api/activity/export',
    asyncHandler(async (req, res) => {
      const format = req.query.format === 'xlsx' ? 'xlsx' : req.query.format === 'csv' ? 'csv' : null;
      if (!format) {
        return res.status(400).json({
          error: { code: 'INVALID_FORMAT', message: 'format must be csv or xlsx' },
        });
      }
      const activities = await activityService.list({ limit: 1000 });
      const rows = activityExportRows(activities);
      const date = todayInMalaysia();
      await activityService.log({
        actor: req.actor,
        action: ACTIVITY_ACTIONS.EXPORT_GENERATED,
        entityType: 'export',
        entityId: 'activity',
        summary: `Exported ${activities.length} activity entries as ${format.toUpperCase()}.`,
        details: { format, count: activities.length },
      });
      if (format === 'csv') {
        const csv = toCsv(
          rows,
          ACTIVITY_EXPORT_COLUMNS.map((column) => ({
            label: column.header,
            value: (row) => row[column.key],
          })),
        );
        sendExport(res, {
          filename: `orderpilot-activity-${date}.csv`,
          contentType: 'text/csv; charset=utf-8',
          body: `﻿${csv}`,
        });
      } else {
        const buffer = await buildXlsx(ACTIVITY_EXPORT_COLUMNS, rows, 'Activity log');
        sendExport(res, {
          filename: `orderpilot-activity-${date}.xlsx`,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          body: buffer,
        });
      }
    }),
  );

  app.get(
    '/api/activity',
    asyncHandler(async (req, res) => {
      const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 200));
      const type = typeof req.query.type === 'string' ? req.query.type : null;
      const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : null;
      const activities = await activityService.list({ limit, type, orderId });
      res.json({ activities });
    }),
  );

  app.get(
    '/api/catalog',
    asyncHandler(async (req, res) => {
      res.json(await orderService.catalogView());
    }),
  );

  app.get('/api/ai/status', (req, res) => {
    res.json(aiStatus());
  });

  app.post(
    '/api/ai/test',
    rateLimit({ max: 10 }),
    asyncHandler(async (req, res) => {
      orderService.ensureOwner(req.actor);
      try {
        const result = await testConnection();
        res.json(result);
      } catch (error) {
        res.status(502).json({
          error: {
            code: error.code || 'AI_TEST_FAILED',
            message: error.message,
          },
        });
      }
    }),
  );

  app.post(
    '/api/demo/reset',
    rateLimit({ max: 5 }),
    asyncHandler(async (req, res) => {
      orderService.ensureOwner(req.actor);
      if (req.body?.confirm !== 'RESET') {
        return res.status(400).json({
          error: { code: 'CONFIRM_REQUIRED', message: 'Send {"confirm":"RESET"} to reset the demo data.' },
        });
      }
      const result = await seedService.resetDemo({ actor: req.actor });
      const stats = await orderService.stats();
      return res.json({ ok: true, result, stats });
    }),
  );

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found' } });
  });

  app.use(
    express.static(config.paths.publicDir, {
      extensions: ['html'],
      maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    }),
  );

  app.get('*', (req, res) => {
    res.sendFile(path.join(config.paths.publicDir, 'index.html'));
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number(error.status) >= 400 && Number(error.status) < 600 ? Number(error.status) : 500;
    if (status >= 500) console.error(error);
    return res.status(status).json({
      error: {
        code: error.code || (status >= 500 ? 'INTERNAL' : 'REQUEST_ERROR'),
        message: status >= 500 ? 'Something went wrong on the server.' : error.message,
        details: error.details || undefined,
      },
    });
  });

  return app;
}
