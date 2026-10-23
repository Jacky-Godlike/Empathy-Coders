import { icon } from '../icons.js';
import * as ui from '../ui.js';

let activeDrawerClose = null;

function section(title, iconName, ...children) {
  return ui.el(
    'section',
    { class: 'drawer-section' },
    ui.el('div', { class: 'drawer-section-title' }, icon(iconName, 12), title),
    ...children,
  );
}

function recommendationBanner(order) {
  const recommendation = order.recommendation || {};
  const severity = recommendation.severity || 'info';
  const reasons = recommendation.reasons || [];
  return ui.el(
    'div',
    { class: `summary-banner ${severity}` },
    ui.el(
      'div',
      { class: 'summary-banner-top' },
      ui.recommendationBadge(recommendation),
      ui.el('div', { class: 'summary-banner-title', text: recommendation.label || 'Review' }),
      order.changeRequest ? ui.el('span', { class: 'chip chip-info', text: 'Change request' }) : null,
      order.cancellationRequested ? ui.el('span', { class: 'chip chip-danger', text: 'Cancellation requested' }) : null,
    ),
    ui.el('div', { class: 'summary-banner-text', text: recommendation.description || '' }),
    reasons.length > 0
      ? ui.el(
          'ul',
          { class: 'reason-list' },
          ...reasons.slice(0, 7).map((reason) =>
            ui.el(
              'li',
              { class: `reason-item ${reason.severity || 'warning'}` },
              ui.el('span', { class: 'reason-dot' }),
              ui.el('span', { text: reason.text }),
            ),
          ),
        )
      : ui.el('div', { class: 'form-hint', style: { marginTop: '6px' }, text: 'All checks passed.' }),
  );
}

function detailGrid(order) {
  const customer = order.customer || {};
  const contact = [customer.phone, customer.email].filter(Boolean).join(' · ') || 'Missing';
  return ui.el(
    'div',
    { class: 'detail-grid' },
    ui.el(
      'div',
      { class: 'detail-item' },
      ui.el('div', { class: 'detail-label', text: 'Customer' }),
      ui.el('div', { class: 'detail-value', text: customer.businessName || customer.name || 'Unknown sender' }),
      customer.businessName && customer.name
        ? ui.el('div', { class: 'form-hint', text: customer.name })
        : null,
    ),
    ui.el(
      'div',
      { class: 'detail-item' },
      ui.el('div', { class: 'detail-label', text: 'Contact' }),
      ui.el('div', { class: 'detail-value', text: contact }),
    ),
    ui.el(
      'div',
      { class: 'detail-item' },
      ui.el('div', { class: 'detail-label', text: 'Delivery' }),
      ui.el('div', { class: 'detail-value', text: `${ui.date(order.deliveryDate, { long: true })} · ${ui.daysLabel(order.checks?.delivery?.daysUntil)}` }),
    ),
    ui.el(
      'div',
      { class: 'detail-item' },
      ui.el('div', { class: 'detail-label', text: 'Channel' }),
      ui.el('div', { class: 'detail-value' }, ui.channelIcon(order.channel, 12), ' ', ui.channelLabel(order.channel)),
    ),
    ui.el(
      'div',
      { class: 'detail-item', style: { gridColumn: 'span 2' } },
      ui.el('div', { class: 'detail-label', text: 'Delivery address' }),
      ui.el('div', { class: 'detail-value', text: customer.address || 'Missing — request from customer' }),
      customer.addressSource
        ? ui.el('div', {
            class: 'form-hint',
            text: customer.addressSource === 'profile' ? 'From customer profile' : 'Extracted from the message',
          })
        : null,
    ),
    order.notes
      ? ui.el(
          'div',
          { class: 'detail-item', style: { gridColumn: 'span 2' } },
          ui.el('div', { class: 'detail-label', text: 'Order notes' }),
          ui.el('div', { class: 'detail-value', text: order.notes }),
        )
      : null,
  );
}

function itemsTable(order) {
  const items = order.items || [];
  const rows = items.map((item) =>
    ui.el(
      'tr',
      {},
      ui.el(
        'td',
        {},
        ui.el('div', { class: 'product', text: item.productName }),
        ui.el('div', {
          class: 'product-sub',
          text: item.unknown ? 'Unmatched product — verify manually' : item.unit || '—',
        }),
      ),
      ui.el('td', { class: 'tabular', text: item.quantity ?? '—' }),
      ui.el('td', { class: 'tabular', text: item.unitPrice !== null && item.unitPrice !== undefined ? ui.money(item.unitPrice) : '—' }),
      ui.el('td', { class: 'tabular', text: item.unitCost !== null && item.unitCost !== undefined ? ui.money(item.unitCost) : '—' }),
      ui.el('td', { class: 'tabular', text: ui.money(item.lineRevenue) }),
      ui.el(
        'td',
        {
          class: 'tabular',
          style: { color: Number(item.marginPct) < 10 ? 'var(--danger)' : 'var(--success)', fontWeight: '700' },
          text: item.marginPct === null || item.marginPct === undefined ? '—' : ui.pct(item.marginPct),
        },
      ),
    ),
  );
  if (rows.length === 0) {
    rows.push(
      ui.el(
        'tr',
        {},
        ui.el('td', { colspan: '6', class: 'muted', text: 'No items were parsed. This order needs customer information.' }),
      ),
    );
  }
  return ui.el(
    'table',
    { class: 'items-table', 'aria-label': 'Order items' },
    ui.el(
      'thead',
      {},
      ui.el(
        'tr',
        {},
        ui.el('th', { text: 'Item' }),
        ui.el('th', { text: 'Qty' }),
        ui.el('th', { text: 'Unit price' }),
        ui.el('th', { text: 'Unit cost' }),
        ui.el('th', { text: 'Line total' }),
        ui.el('th', { text: 'Margin' }),
      ),
    ),
    ui.el('tbody', {}, ...rows),
  );
}

function financials(order) {
  const totals = order.totals || {};
  const margin = Number(totals.marginPct) || 0;
  return ui.el(
    'div',
    { class: 'financials' },
    ui.el(
      'div',
      { class: 'financial' },
      ui.el('div', { class: 'label', text: 'Revenue' }),
      ui.el('div', { class: 'value', text: ui.money(totals.revenue) }),
    ),
    ui.el(
      'div',
      { class: 'financial' },
      ui.el('div', { class: 'label', text: 'Cost' }),
      ui.el('div', { class: 'value', text: ui.money(totals.cost) }),
    ),
    ui.el(
      'div',
      { class: 'financial' },
      ui.el('div', { class: 'label', text: 'Gross profit' }),
      ui.el('div', { class: `value ${Number(totals.grossProfit) < 0 ? 'bad' : 'good'}`, text: ui.money(totals.grossProfit) }),
    ),
    ui.el(
      'div',
      { class: 'financial' },
      ui.el('div', { class: 'label', text: 'Gross margin' }),
      ui.el('div', { class: `value ${margin < 10 ? 'bad' : 'good'}`, text: ui.pct(margin) }),
    ),
  );
}

function stockCard(order) {
  const stock = order.checks?.stock || {};
  const lines = stock.lines || [];
  const badge = lines.length === 0
    ? ui.el('span', { class: 'badge badge-neutral' }, elDot(), 'No check')
    : stock.totalShortageUnits > 0
      ? ui.el('span', { class: 'badge badge-danger' }, elDot(), `${stock.totalShortageUnits} short`)
      : stock.safetyWarnings?.length
        ? ui.el('span', { class: 'badge badge-warning' }, elDot(), 'Below safety')
        : ui.el('span', { class: 'badge badge-success' }, elDot(), 'In stock');

  return ui.el(
    'div',
    { class: 'check-card' },
    ui.el(
      'div',
      { class: 'check-title' },
      ui.el('span', { text: 'Stock check' }),
      badge,
    ),
    lines.length === 0
      ? ui.el('div', { class: 'check-note', text: 'No matched items — stock cannot be checked.' })
      : ui.el(
          'div',
          {},
          ...lines.map((line) =>
            ui.el(
              'div',
              { style: { padding: '4px 0', borderBottom: '1px dashed #ece7dc' } },
              ui.el(
                'div',
                { class: 'check-row', style: { borderBottom: '0', padding: '0' } },
                ui.el('span', { text: line.productName }),
                ui.el(
                  'span',
                  { class: 'right' },
                  line.shortage > 0
                    ? ui.el('span', { style: { color: 'var(--danger)', fontWeight: '700' }, text: `short ${line.shortage}` })
                    : ui.el('span', { style: { color: 'var(--success)' }, text: 'ok' }),
                ),
              ),
              ui.el('div', {
                class: 'check-note',
                text: `Need ${line.required} · ${line.available} available · ${line.supplierName || 'no supplier'}${line.totalLeadDays !== null ? ` · ${line.totalLeadDays}d lead` : ''}${line.shortage > 0 && line.canRestockInTime ? ' · restock in time' : line.shortage > 0 ? ' · too late' : ''}`,
              }),
              line.belowSafety
                ? ui.el('div', {
                    class: 'check-note',
                    style: { color: 'var(--warning)' },
                    text: `Post-order ${line.postOrderAvailable} vs safety ${line.safetyStock}`,
                  })
                : null,
            ),
          ),
          stock.totalShortageUnits > 0
            ? ui.el('div', {
                class: 'check-note',
                style: { marginTop: '6px', fontWeight: '700', color: 'var(--ink-2)' },
                text: `Estimated purchase: ${ui.money(stock.shortageValue)}`,
              })
            : null,
        ),
  );
}

function elDot() {
  return ui.el('span', { class: 'dot' });
}

function deliveryCard(order) {
  const delivery = order.checks?.delivery || {};
  return ui.el(
    'div',
    { class: 'check-card' },
    ui.el(
      'div',
      { class: 'check-title' },
      ui.el('span', { text: 'Delivery feasibility' }),
      delivery.ok
        ? ui.el('span', { class: 'badge badge-success' }, elDot(), 'On time')
        : ui.el('span', { class: 'badge badge-danger' }, elDot(), 'At risk'),
    ),
    ui.el(
      'div',
      {},
      ui.el(
        'div',
        { class: 'check-row' },
        ui.el('span', { text: 'Delivery date' }),
        ui.el('span', { class: 'right', text: ui.date(delivery.date, { long: true }) }),
      ),
      ui.el(
        'div',
        { class: 'check-row' },
        ui.el('span', { text: 'Days remaining' }),
        ui.el('span', { class: 'right', text: delivery.daysUntil === null || delivery.daysUntil === undefined ? '—' : `${delivery.daysUntil}` }),
      ),
      ui.el(
        'div',
        { class: 'check-row' },
        ui.el('span', { text: 'Longest supplier lead' }),
        ui.el('span', { class: 'right', text: delivery.maxLeadDays ? `${delivery.maxLeadDays} days` : 'None' }),
      ),
      ui.el(
        'div',
        { class: 'check-row' },
        ui.el('span', { text: 'Handling buffer' }),
        ui.el('span', { class: 'right', text: `${delivery.handlingDays ?? 0} day(s)` }),
      ),
    ),
    ui.el('div', { class: 'check-note', text: delivery.reason || '' }),
  );
}

function completenessCard(order) {
  const completeness = order.checks?.completeness || {};
  const missing = completeness.missing || [];
  return ui.el(
    'div',
    { class: 'check-card' },
    ui.el(
      'div',
      { class: 'check-title' },
      ui.el('span', { text: 'Required information' }),
      completeness.ok
        ? ui.el('span', { class: 'badge badge-success' }, elDot(), 'Complete')
        : ui.el('span', { class: 'badge badge-warning' }, elDot(), `${missing.length} missing`),
    ),
    missing.length === 0
      ? ui.el('div', { class: 'check-note', text: 'Customer, contact, items, delivery date and address are all present.' })
      : ui.el(
          'div',
          { class: 'flag-row', style: { maxWidth: 'none' } },
          ...missing.map((field) => ui.el('span', { class: 'chip chip-warning', text: field.label })),
        ),
    ui.el('div', {
      class: 'check-note',
      text: `Address source: ${completeness.addressSource === 'profile' ? 'customer profile' : completeness.addressSource === 'message' ? 'message' : 'missing'}`,
    }),
  );
}

function priceCard(order) {
  const price = order.checks?.price || {};
  const deviations = price.deviations || [];
  return ui.el(
    'div',
    { class: 'check-card' },
    ui.el(
      'div',
      { class: 'check-title' },
      ui.el('span', { text: 'Price check' }),
      price.ok
        ? ui.el('span', { class: 'badge badge-success' }, elDot(), 'Within rule')
        : ui.el('span', { class: 'badge badge-warning' }, elDot(), `${deviations.length} deviation`),
    ),
    deviations.length === 0
      ? ui.el('div', { class: 'check-note', text: `No quoted price differs from the catalogue by more than ${price.thresholdPct ?? 15}%.` })
      : ui.el(
          'div',
          {},
          ...deviations.map((deviation) =>
            ui.el(
              'div',
              { class: 'check-row' },
              ui.el(
                'span',
                {},
                ui.el('div', { text: deviation.productName }),
                ui.el('div', { class: 'check-note', text: `quoted ${ui.money(deviation.quotedPrice)} vs catalogue ${ui.money(deviation.cataloguePrice)}` }),
              ),
              ui.el('span', {
                class: 'right',
                style: { color: 'var(--warning)', fontWeight: '700' },
                text: `${deviation.deviationPct > 0 ? '+' : ''}${ui.pct(deviation.deviationPct)}`,
              }),
            ),
          ),
        ),
  );
}

function duplicateCard(order) {
  const duplicate = order.checks?.duplicate || {};
  return ui.el(
    'div',
    { class: 'check-card' },
    ui.el(
      'div',
      { class: 'check-title' },
      ui.el('span', { text: 'Duplicate check' }),
      duplicate.possible
        ? ui.el('span', { class: 'badge badge-warning' }, elDot(), 'Possible duplicate')
        : ui.el('span', { class: 'badge badge-success' }, elDot(), 'No duplicate'),
    ),
    duplicate.possible
      ? ui.el(
          'div',
          {},
          ...duplicate.matches.map((match) =>
            ui.el('div', { class: 'check-row' }, ui.el('span', { text: `${match.code} · ${match.status}` }), ui.el('span', { class: 'right', text: match.overlapSkus.join(', ') })),
          ),
        )
      : ui.el('div', { class: 'check-note', text: `No overlapping item from this customer in the last ${duplicate.windowHours ?? 48} hours.` }),
  );
}

function confidenceCard(order) {
  const confidence = order.checks?.confidence || {};
  const score = confidence.score;
  return ui.el(
    'div',
    { class: 'check-card' },
    ui.el(
      'div',
      { class: 'check-title' },
      ui.el('span', { text: 'Extraction confidence' }),
      confidence.low
        ? ui.el('span', { class: 'badge badge-warning' }, elDot(), 'Low confidence')
        : ui.el('span', { class: 'badge badge-success' }, elDot(), 'Good'),
    ),
    ui.el(
      'div',
      {},
      ui.el(
        'div',
        { class: 'check-row' },
        ui.el('span', { text: 'Score' }),
        ui.el('span', { class: 'right', text: score === null || score === undefined ? '—' : `${Math.round(Number(score) * 100)}%` }),
      ),
      ui.el(
        'div',
        { class: 'check-row' },
        ui.el('span', { text: 'Source' }),
        ui.el('span', { class: 'right' }, ui.modeBadge(confidence.source)),
      ),
      ui.el(
        'div',
        { class: 'check-row' },
        ui.el('span', { text: 'Review threshold' }),
        ui.el('span', { class: 'right', text: `${Math.round((confidence.threshold ?? 0.55) * 100)}%` }),
      ),
    ),
  );
}

function checksGrid(order) {
  return ui.el(
    'div',
    { class: 'checks-grid' },
    stockCard(order),
    deliveryCard(order),
    completenessCard(order),
    priceCard(order),
    duplicateCard(order),
    confidenceCard(order),
    ui.el(
      'div',
      { class: 'check-card full' },
      ui.el('div', { class: 'check-title' }, ui.el('span', { text: 'Rules used' })),
      ui.el('div', {
        class: 'check-note',
        text: `Margin ≥ ${order.checks?.rules?.marginMinPct ?? 10}% · margin floor ${order.checks?.rules?.marginRejectPct ?? 0}% · price deviation ≤ ${order.checks?.rules?.priceDeviationPct ?? 15}% · duplicate window ${order.checks?.rules?.duplicateWindowHours ?? 48}h · handling ${order.checks?.rules?.handlingDays ?? 0} day(s).`,
      }),
      ui.el('div', { class: 'check-note', text: 'Stock, margin and risk are calculated by these deterministic rules. AI only reads the message and extracts fields.' }),
    ),
  );
}

function sourceMessages(detail) {
  const messages = detail.messages || [];
  return section(
    'Source messages',
    'message',
    messages.length === 0
      ? ui.el('div', { class: 'check-note', text: 'No source messages are linked to this order.' })
      : ui.el(
          'div',
          {},
          ...messages.map((message) =>
            ui.el(
              'div',
              { class: 'source-card' },
              ui.el(
                'div',
                { class: 'source-head' },
                ui.el(
                  'div',
                  { class: 'source-who' },
                  ui.channelIcon(message.channel, 11),
                  message.fromName || message.from || 'Unknown sender',
                  message.subject ? ui.el('span', { class: 'muted', text: `· ${message.subject}` }) : null,
                ),
                ui.el('span', { class: 'source-time', text: `${ui.relative(message.receivedAt)} · ${message.id}` }),
              ),
              ui.el(
                'div',
                { class: 'source-meta' },
                ui.statusBadge(message.status),
                message.analysis?.category ? ui.categoryBadge(message.analysis.category) : null,
                message.analysis?.mode ? ui.modeBadge(message.analysis.mode) : null,
                message.analysis?.confidence !== undefined
                  ? ui.el('span', { class: 'chip', text: `${Math.round(Number(message.analysis.confidence) * 100)}% confidence` })
                  : null,
              ),
              ui.el('div', { class: 'source-body', text: message.body || '' }),
              message.analysis?.reasoning
                ? ui.el('div', { class: 'check-note', text: message.analysis.reasoning })
                : null,
            ),
          ),
        ),
  );
}

function purchaseDraftsSection(detail, order, { onReceive, owner }) {
  const drafts = detail.purchaseDrafts || [];
  if (drafts.length === 0) return null;
  return section(
    'Purchase drafts',
    'truck',
    ui.el(
      'div',
      {},
      ...drafts.map((draft) =>
        ui.el(
          'div',
          { class: 'source-card' },
          ui.el(
            'div',
            { class: 'source-head' },
            ui.el(
              'div',
              { class: 'source-who' },
              icon('receipt', 13),
              draft.id,
              ui.el('span', { class: 'muted', text: `· ${draft.supplierName}` }),
            ),
            ui.statusBadge(draft.status === 'received' ? 'approved' : 'draft'),
          ),
          ui.el(
            'div',
            { class: 'purchase-items' },
            ...(draft.items || []).map((item) =>
              ui.el(
                'div',
                { class: 'purchase-item' },
                ui.el('span', { text: `${item.quantity} × ${item.productName}` }),
                ui.el('span', { text: ui.money(item.lineCost) }),
              ),
            ),
          ),
          ui.el(
            'div',
            { class: 'purchase-foot' },
            ui.el('span', { class: 'purchase-cost', text: `Est. ${ui.money(draft.estimatedCost)}` }),
            ui.el('span', { class: 'muted small', text: draft.expectedDate ? `Expected ${ui.date(draft.expectedDate, { long: true })}` : 'Expected date TBC' }),
            draft.status === 'draft' && owner
              ? ui.el(
                  'button',
                  {
                    class: 'btn btn-soft btn-sm',
                    type: 'button',
                    onClick: (event) => onReceive(draft.id, event.currentTarget),
                  },
                  icon('truck', 13),
                  'Mark received',
                )
              : draft.status === 'draft' && !owner
                ? ui.el('span', { class: 'chip', text: 'Owner only' })
                : ui.el('span', { class: 'badge badge-success' }, 'Received'),
          ),
          ui.el('div', { class: 'purchase-note', text: draft.note || 'Internal draft only. Nothing is sent automatically.' }),
        ),
      ),
    ),
  );
}

function replyDraftSection(order) {
  if (!order.replyDraft) return null;
  const draft = order.replyDraft;
  return section(
    'Reply draft',
    'send',
    ui.el(
      'div',
      { class: 'source-card' },
      ui.el(
        'div',
        { class: 'source-head' },
        ui.el('div', { class: 'source-who' }, ui.channelIcon(draft.channel, 11), `Via ${ui.channelLabel(draft.channel)}`),
        ui.el(
          'button',
          {
            class: 'btn btn-soft btn-sm',
            type: 'button',
            onClick: () => ui.copy(draft.copyText || draft.body, 'Reply copied'),
          },
          icon('copy', 12),
          'Copy',
        ),
      ),
      draft.subject ? ui.el('div', { class: 'check-note', text: `Subject: ${draft.subject}` }) : null,
      ui.el('div', { class: 'reply-preview', text: draft.body }),
    ),
  );
}

function activitySection(detail, { onViewLog }) {
  const activities = detail.activities || [];
  return section(
    'Activity',
    'activity',
    activities.length === 0
      ? ui.el('div', { class: 'check-note', text: 'No activity recorded yet.' })
      : ui.el(
          'div',
          { class: 'drawer-timeline' },
          ...activities.map((activity) => {
            const meta = ui.actionMeta(activity.action);
            return ui.el(
              'div',
              { class: 'drawer-timeline-item' },
              ui.el('span', { class: 'drawer-timeline-dot', style: { background: toneColor(meta.tone) } }),
              ui.el(
                'div',
                { class: 'drawer-timeline-body' },
                ui.el('div', { class: 'drawer-timeline-summary', text: activity.summary }),
                ui.el('div', {
                  class: 'drawer-timeline-meta',
                  text: `${meta.label} · ${activity.actor?.name || 'System'} · ${ui.dateTime(activity.at)}`,
                }),
              ),
            );
          }),
        ),
    ui.el(
      'div',
      { style: { marginTop: '8px' } },
      ui.el(
        'button',
        { class: 'btn-link', type: 'button', onClick: onViewLog },
        'View full audit log',
        icon('arrowRight', 12),
      ),
    ),
  );
}

function toneColor(tone) {
  if (tone === 'success') return 'var(--success)';
  if (tone === 'danger') return 'var(--danger)';
  if (tone === 'warning') return 'var(--warning)';
  if (tone === 'info') return 'var(--info)';
  return 'var(--faint)';
}

export async function openOrderDrawer(id, ctx) {
  const { api, actions } = ctx;
  if (activeDrawerClose) activeDrawerClose();

  const root = document.getElementById('drawer-root');
  const previousFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  let detail = null;
  let noteValue = '';
  let footerError = '';
  let busy = false;
  let modalOpen = false;
  let intentHandled = false;
  let noteInput = null;
  let cleanupTrap = () => {};
  let closed = false;

  const backdrop = ui.el('div', { class: 'drawer-backdrop' });
  const drawer = ui.el('section', {
    class: 'drawer',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Order details',
  });
  const header = ui.el('div', { class: 'drawer-header' });
  const body = ui.el('div', { class: 'drawer-body' });
  const footer = ui.el('div', { class: 'drawer-footer' });
  drawer.append(header, body, footer);
  backdrop.append(drawer);
  root.append(backdrop);
  cleanupTrap = ui.trapFocus(drawer);

  const close = () => {
    if (closed) return;
    closed = true;
    cleanupTrap();
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    document.body.style.overflow = previousOverflow;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    if (activeDrawerClose === close) activeDrawerClose = null;
  };
  activeDrawerClose = close;

  const onKeydown = (event) => {
    if (event.key !== 'Escape' || modalOpen) return;
    event.preventDefault();
    close();
  };
  document.addEventListener('keydown', onKeydown);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  function setBusy(value) {
    busy = value;
    footer.querySelectorAll('button, textarea, input').forEach((element) => {
      element.disabled = value;
    });
    const primary = footer.querySelector('[data-primary-action]');
    if (primary) {
      if (value) {
        primary.dataset.originalHtml = primary.innerHTML;
        primary.textContent = 'Working…';
      } else if (primary.dataset.originalHtml) {
        primary.innerHTML = primary.dataset.originalHtml;
        delete primary.dataset.originalHtml;
      }
    }
  }

  function showFooterError(message) {
    footerError = message || '';
    const slot = footer.querySelector('#drawer-footer-error');
    if (slot) {
      slot.textContent = footerError;
      slot.classList.toggle('hide', !footerError);
    }
  }

  function renderHeader(order) {
    const sourceCount = order.sourceMessageIds?.length || 1;
    ui.mount(
      header,
      ui.el(
        'div',
        { style: { minWidth: '0' } },
        ui.el(
          'div',
          { class: 'drawer-title-row' },
          ui.el('div', { class: 'drawer-code', text: order.code }),
          ui.statusBadge(order.status),
          ui.recommendationBadge(order.recommendation),
          order.changeRequest ? ui.el('span', { class: 'chip chip-info', text: 'Change request' }) : null,
          order.cancellationRequested ? ui.el('span', { class: 'chip chip-danger', text: 'Cancellation' }) : null,
        ),
        ui.el('div', {
          class: 'drawer-sub',
          text: `${sourceCount} source message${sourceCount === 1 ? '' : 's'} · ${ui.modeLabel(order.extractionMode)} · created ${ui.relative(order.createdAt)}`,
        }),
      ),
      ui.el(
        'button',
        { class: 'drawer-close', type: 'button', 'aria-label': 'Close order details', onClick: close },
        icon('x', 16),
      ),
    );
  }

  function renderBody(order) {
    const owner = ui.isOwner(ctx.state.actor);
    const sections = [
      recommendationBanner(order),
      order.changeRequest
        ? ui.el(
            'div',
            { class: 'summary-banner info' },
            ui.el('div', { class: 'summary-banner-title', text: `Change request for ${detail.parent?.code || 'an approved order'}` }),
            ui.el('div', {
              class: 'summary-banner-text',
              text: 'Approving this change will supersede the original order and replace its stock reservation. A fresh human approval is required.',
            }),
          )
        : null,
      section('Order details', 'user', detailGrid(order)),
      section('Items and margin', 'box', itemsTable(order), ui.el('div', { class: 'mt-12' }, financials(order))),
      section('Why this recommendation', 'shield', checksGrid(order)),
      purchaseDraftsSection(detail, order, {
        owner,
        onReceive: (draftId, button) => handleReceiveDraft(draftId, button),
      }),
      replyDraftSection(order),
      sourceMessages(detail),
      activitySection(detail, {
        onViewLog: () => {
          close();
          actions.navigate('activity');
        },
      }),
      detail.parent
        ? section(
            'Original order',
            'external',
            ui.el(
              'button',
              {
                class: 'btn btn-soft btn-sm',
                type: 'button',
                onClick: () => {
                  close();
                  actions.openOrder(detail.parent.id);
                },
              },
              icon('external', 13),
              `Open ${detail.parent.code} (${detail.parent.status})`,
            ),
          )
        : null,
    ];
    const scrollTop = body.scrollTop;
    ui.mount(body, ...sections.filter(Boolean));
    body.scrollTop = scrollTop;
  }

  function approveLabel(order) {
    if (order.cancellationRequested) return 'Approve cancellation';
    const code = order.recommendation?.code;
    if (code === 'PROCUREMENT') return 'Approve & create draft';
    if (code === 'REVIEW') return 'Approve anyway';
    if (code === 'HIGH_RISK') return 'Override & approve';
    if (code === 'CHANGE_REQUEST') return 'Approve change';
    return 'Approve order';
  }

  function renderFooter(order) {
    const owner = ui.isOwner(ctx.state.actor);
    const active = ['draft', 'needs_info'].includes(order.status);
    const code = order.recommendation?.code;

    if (!active) {
      const completed = [];
      if (order.status === 'approved') {
        completed.push(`Approved by ${order.approvedBy?.name || 'a manager'} · ${order.approvedAt ? ui.dateTime(order.approvedAt) : ''}`);
        if (order.approvalNote) completed.push(`Note: ${order.approvalNote}`);
        if (order.procurementPending) completed.push('A purchase draft is still pending.');
      } else if (order.status === 'rejected') {
        completed.push(`Rejected by ${order.rejectedBy?.name || 'a manager'} · ${order.rejectedAt ? ui.dateTime(order.rejectedAt) : ''}`);
        if (order.rejectionReason) completed.push(`Reason: ${order.rejectionReason}`);
      } else if (order.status === 'superseded') {
        completed.push(`Superseded by ${order.supersededByCode || 'a change request'}.`);
      } else if (order.status === 'cancelled') {
        completed.push(order.cancellationReason || 'Cancelled.');
      }
      ui.mount(
        footer,
        ui.el(
          'div',
          { class: 'row between', style: { marginBottom: '8px' } },
          ui.el('div', { class: 'form-hint', text: completed.join(' · ') || 'This order is closed.' }),
          ui.el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: close }, 'Close'),
        ),
      );
      return;
    }

    noteInput = ui.el('textarea', {
      class: 'note-input',
      'aria-label': 'Decision note',
      placeholder:
        code === 'HIGH_RISK'
          ? 'Required: explain why you are overriding the stock or margin risk.'
          : 'Optional note for the audit log or the customer.',
      value: noteValue,
      onInput: (event) => {
        noteValue = event.target.value;
      },
    });

    const approveButton = owner
      ? ui.el(
          'button',
          {
            class: 'btn btn-approve btn-lg',
            type: 'button',
            'data-primary-action': 'true',
            disabled: !order.canApprove,
            title: !order.canApprove ? 'Resolve missing information before approving' : approveLabel(order),
            onClick: handleApprove,
          },
          icon(order.canApprove ? 'check' : 'lock', 15),
          approveLabel(order),
        )
      : ui.el(
          'button',
          {
            class: 'btn btn-soft btn-lg',
            type: 'button',
            onClick: () =>
              ui.toast.warning(
                'Owner approval required',
                'Switch to Aina (Owner/Manager) to approve, reject or edit this order.',
              ),
          },
          icon('lock', 14),
          'Approve',
        );

    const editButton = owner
      ? ui.el(
          'button',
          { class: 'btn btn-ghost', type: 'button', onClick: handleEdit },
          icon('edit', 14),
          'Edit details',
        )
      : null;

    const rejectButton = owner
      ? ui.el(
          'button',
          { class: 'btn btn-danger-soft', type: 'button', onClick: handleReject },
          icon('x', 14),
          'Reject',
        )
      : ui.el(
          'button',
          {
            class: 'btn btn-soft',
            type: 'button',
            onClick: () =>
              ui.toast.warning(
                'Owner approval required',
                'Only the Owner/Manager can reject an order.',
              ),
          },
          icon('lock', 13),
          'Reject',
        );

    ui.mount(
      footer,
      !owner
        ? ui.el(
            'div',
            { class: 'staff-banner' },
            icon('shield', 14),
            'Staff access: you can review and request information. Approval, rejection and edits require the Owner/Manager.',
          )
        : null,
      order.approvalRequiresNote
        ? ui.el(
            'div',
            { class: 'staff-banner' },
            icon('alert', 14),
            'High risk: add a short justification note before overriding this recommendation.',
          )
        : null,
      !order.canApprove
        ? ui.el(
            'div',
            { class: 'staff-banner' },
            icon('info', 14),
            'This order is missing required information. Edit the details or request information before approving.',
          )
        : null,
      ui.el(
        'div',
        { class: 'decision-note' },
        ui.el('label', { text: order.approvalRequiresNote ? 'Justification note (required)' : 'Decision note' }),
        noteInput,
      ),
      ui.el('div', { class: 'form-error hide', id: 'drawer-footer-error' }),
      ui.el(
        'div',
        { class: 'decision-actions' },
        approveButton,
        ui.el(
          'button',
          { class: 'btn btn-soft', type: 'button', onClick: handleRequestInfo },
          icon('send', 14),
          'Request info',
        ),
        editButton,
        rejectButton,
        ui.el('span', { class: 'spacer' }),
        ui.el(
          'button',
          { class: 'btn btn-ghost btn-sm', type: 'button', onClick: close },
          'Close',
        ),
      ),
    );
    if (footerError) showFooterError(footerError);
  }

  function render() {
    if (!detail) return;
    renderHeader(detail.order);
    renderBody(detail.order);
    renderFooter(detail.order);
  }

  async function load() {
    ui.mount(
      header,
      ui.el('div', { class: 'drawer-title-row' }, ui.el('div', { class: 'drawer-code', text: 'Loading…' })),
      ui.el('button', { class: 'drawer-close', type: 'button', 'aria-label': 'Close', onClick: close }, icon('x', 16)),
    );
    ui.mount(
      body,
      ui.el('div', { class: 'card', style: { padding: '18px' } }, ui.el('div', { class: 'form-hint', text: 'Loading order details…' })),
    );
    ui.mount(footer);
    try {
      detail = await api.order(id);
      render();
      setTimeout(() => header.querySelector('.drawer-close')?.focus(), 40);
      if (!intentHandled) {
        intentHandled = true;
        if (ctx.intent === 'request-info') setTimeout(() => handleRequestInfo(), 120);
        else if (ctx.intent === 'reject') setTimeout(() => handleReject(), 120);
      }
    } catch (error) {
      ui.mount(
        body,
        ui.el(
          'div',
          { class: 'card', style: { padding: '18px' } },
          ui.el('div', { class: 'confirm-icon danger' }, icon('alert', 20)),
          ui.el('div', { class: 'empty-title', text: 'Could not load this order' }),
          ui.el('div', { class: 'empty-text', text: error.message }),
          ui.el(
            'div',
            { style: { marginTop: '12px' } },
            ui.el('button', { class: 'btn btn-primary', type: 'button', onClick: load }, icon('refresh', 14), 'Retry'),
          ),
        ),
      );
    }
  }

  async function reloadDetail() {
    if (!detail?.order) return;
    try {
      detail = await api.order(detail.order.id);
      noteInput = null;
      render();
      if (footerError) showFooterError(footerError);
    } catch (error) {
      ui.toast.danger('Could not refresh order', error.message);
    }
  }

  async function handleApprove() {
    if (busy || !detail) return;
    const order = detail.order;
    if (!ui.isOwner(ctx.state.actor)) {
      ui.toast.warning('Owner approval required', 'Switch to the Owner/Manager role to approve this order.');
      return;
    }
    if (!order.canApprove) {
      ui.toast.warning('More information needed', 'Edit the details or request information before approving.');
      return;
    }
    if (order.approvalRequiresNote && !noteValue.trim()) {
      showFooterError('A justification note is required to approve a high-risk order.');
      noteInput?.focus();
      return;
    }

    if (order.recommendation?.code === 'PROCUREMENT') {
      const shortageLines = order.checks?.stock?.shortageLines || [];
      const shortageText = shortageLines
        .map((line) => `${line.shortage} × ${line.productName}`)
        .join(', ');
      modalOpen = true;
      const ok = await ui.confirmDialog({
        title: 'Approve and create a purchase draft?',
        message: `This order is short: ${shortageText}. OrderPilot will reserve the available stock and create an internal purchase draft with the supplier. Nothing is sent to the supplier automatically.`,
        confirmLabel: 'Approve & create draft',
        tone: 'primary',
      });
      modalOpen = false;
      if (!ok) return;
    }

    setBusy(true);
    showFooterError('');
    try {
      const result = await api.approve(order.id, noteValue.trim() || null);
      const draftCount = result.purchaseDrafts?.length || 0;
      close();
      await actions.afterMutation({
        title: order.cancellationRequested ? 'Cancellation approved' : 'Order approved',
        text: order.cancellationRequested
          ? `${order.code} approved. The original order was cancelled and its stock reservation released.`
          : `${order.code} is approved.${draftCount ? ` ${draftCount} purchase draft${draftCount === 1 ? '' : 's'} created.` : ' Stock reserved.'}`,
        tone: 'success',
      });
    } catch (error) {
      if (error.code === 'NOTE_REQUIRED') {
        showFooterError(error.message);
        noteInput?.focus();
      } else if (error.code === 'NEEDS_INFO') {
        const missing = (error.details?.missing || []).map((field) => field.label).join(', ');
        footerError = `Still missing: ${missing || 'required information'}.`;
        await reloadDetail();
        showFooterError(footerError);
      } else {
        showFooterError(error.message);
        ui.toast.danger('Could not approve order', error.message);
      }
    } finally {
      if (!closed) setBusy(false);
    }
  }

  async function handleRequestInfo() {
    if (busy || !detail) return;
    const order = detail.order;
    setBusy(true);
    showFooterError('');
    try {
      const result = await api.requestInfo(order.id, noteValue.trim() || null);
      const draft = result.replyDraft;
      noteValue = '';
      await reloadDetail();
      await actions.afterMutation({ refresh: true });
      modalOpen = true;
      const modalBody = ui.el(
        'div',
        {},
        ui.el('div', { class: 'form-hint', text: `Send this through ${ui.channelLabel(draft.channel)}. The order is now waiting for the customer.` }),
        draft.subject ? ui.el('div', { class: 'check-note', text: `Subject: ${draft.subject}` }) : null,
        ui.el('div', { class: 'reply-preview', text: draft.body }),
      );
      const modal = ui.openModal({
        title: 'Reply draft ready',
        subtitle: 'Copy the message and send it from your usual WhatsApp or email account.',
        body: modalBody,
        footer: ui.el(
          'div',
          { class: 'modal-footer' },
          ui.el('div', { class: 'spacer' }),
          ui.el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => modal.close() }, 'Close'),
          ui.el(
            'button',
            {
              class: 'btn btn-primary',
              type: 'button',
              onClick: () => ui.copy(draft.copyText || draft.body, 'Reply copied'),
            },
            icon('copy', 14),
            'Copy message',
          ),
        ),
        onClose: () => {
          modalOpen = false;
        },
      });
    } catch (error) {
      showFooterError(error.message);
      ui.toast.danger('Could not request information', error.message);
    } finally {
      if (!closed) setBusy(false);
    }
  }

  function handleReject() {
    if (busy || !detail) return;
    const order = detail.order;
    const reasonInput = ui.el('textarea', {
      class: 'textarea',
      placeholder: 'Why are you rejecting this order? This reason is stored in the audit log.',
      'aria-label': 'Rejection reason',
    });
    const quickReasons = [
      'Stock cannot be sourced in time',
      'Margin is too low',
      'Customer details are incomplete',
      'Duplicate order',
    ];
    const errorSlot = ui.el('div', { class: 'modal-error hide' });
    let rejectButton;
    const sync = () => {
      const ready = reasonInput.value.trim().length >= 3;
      if (rejectButton) rejectButton.disabled = !ready;
    };
    reasonInput.addEventListener('input', sync);

    const modalBody = ui.el(
      'div',
      {},
      ui.el('div', { class: 'form-hint', text: 'Pick a reason or write your own. The customer is not contacted automatically.' }),
      ui.el(
        'div',
        { class: 'flag-row', style: { maxWidth: 'none', marginTop: '10px' } },
        ...quickReasons.map((reason) =>
          ui.el(
            'button',
            {
              class: 'chip chip-warning',
              type: 'button',
              onClick: () => {
                reasonInput.value = reason;
                sync();
                reasonInput.focus();
              },
            },
            reason,
          ),
        ),
      ),
      ui.el('div', { class: 'field', style: { marginTop: '10px' } }, ui.el('label', { class: 'label', text: 'Reason' }), reasonInput),
      errorSlot,
    );

    modalOpen = true;
    const modal = ui.openModal({
      title: `Reject ${order.code}?`,
      subtitle: 'The order will be closed and the reason will appear in the activity log.',
      body: modalBody,
      footer: (() => {
        const footerNode = ui.el('div', { class: 'modal-footer' });
        rejectButton = ui.el(
          'button',
          {
            class: 'btn btn-danger',
            type: 'button',
            disabled: true,
            onClick: async () => {
              const reason = reasonInput.value.trim();
              if (reason.length < 3) return;
              rejectButton.disabled = true;
              rejectButton.textContent = 'Rejecting…';
              try {
                await api.reject(order.id, reason);
                modal.close();
                close();
                await actions.afterMutation({
                  title: 'Order rejected',
                  text: `${order.code} was rejected and the reason is in the audit log.`,
                  tone: 'warning',
                });
              } catch (error) {
                rejectButton.disabled = false;
                rejectButton.textContent = 'Reject order';
                errorSlot.textContent = error.message;
                errorSlot.classList.remove('hide');
              }
            },
          },
          'Reject order',
        );
        footerNode.append(
          ui.el('div', { class: 'spacer' }),
          ui.el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => modal.close() }, 'Cancel'),
          rejectButton,
        );
        return footerNode;
      })(),
      onClose: () => {
        modalOpen = false;
      },
    });
    setTimeout(() => reasonInput.focus(), 50);
  }

  function handleEdit() {
    if (busy || !detail) return;
    const order = detail.order;
    const customer = order.customer || {};
    const businessInput = ui.el('input', { class: 'input', value: customer.businessName || '', placeholder: 'Business name' });
    const nameInput = ui.el('input', { class: 'input', value: customer.name || '', placeholder: 'Contact name' });
    const phoneInput = ui.el('input', { class: 'input', value: customer.phone || '', placeholder: '+60…' });
    const emailInput = ui.el('input', { class: 'input', value: customer.email || '', placeholder: 'name@example.com' });
    const dateInput = ui.el('input', { class: 'input', type: 'date', value: order.deliveryDate || '' });
    const addressInput = ui.el('textarea', { class: 'textarea', style: { minHeight: '64px' }, value: customer.address || '', placeholder: 'Delivery address' });
    const notesInput = ui.el('textarea', { class: 'textarea', style: { minHeight: '64px' }, value: order.notes || '', placeholder: 'Order notes' });
    const errorSlot = ui.el('div', { class: 'modal-error hide' });
    let saveButton;

    const modalBody = ui.el(
      'div',
      {},
      ui.el(
        'div',
        { class: 'form-grid' },
        ui.el('div', { class: 'field' }, ui.el('label', { class: 'label', text: 'Business name' }), businessInput),
        ui.el('div', { class: 'field' }, ui.el('label', { class: 'label', text: 'Contact name' }), nameInput),
        ui.el('div', { class: 'field' }, ui.el('label', { class: 'label', text: 'Phone' }), phoneInput),
        ui.el('div', { class: 'field' }, ui.el('label', { class: 'label', text: 'Email' }), emailInput),
        ui.el('div', { class: 'field' }, ui.el('label', { class: 'label', text: 'Delivery date' }), dateInput),
        ui.el('div', { class: 'field span-2' }, ui.el('label', { class: 'label', text: 'Delivery address' }), addressInput),
        ui.el('div', { class: 'field span-2' }, ui.el('label', { class: 'label', text: 'Order notes' }), notesInput),
      ),
      errorSlot,
      ui.el('div', { class: 'form-hint', style: { marginTop: '8px' }, text: 'Saving recalculates stock, margin and delivery checks immediately.' }),
    );

    modalOpen = true;
    const modal = ui.openModal({
      title: `Edit ${order.code}`,
      subtitle: 'Correct the extracted details before approving. Every change is logged.',
      body: modalBody,
      wide: true,
      footer: (() => {
        const footerNode = ui.el('div', { class: 'modal-footer' });
        saveButton = ui.el(
          'button',
          {
            class: 'btn btn-primary',
            type: 'button',
            onClick: async () => {
              saveButton.disabled = true;
              saveButton.textContent = 'Saving…';
              try {
                await api.updateOrder(order.id, {
                  customer: {
                    businessName: businessInput.value.trim() || null,
                    name: nameInput.value.trim() || null,
                    phone: phoneInput.value.trim() || null,
                    email: emailInput.value.trim() || null,
                    address: addressInput.value.trim() || null,
                  },
                  deliveryDate: dateInput.value || null,
                  notes: notesInput.value.trim() || null,
                });
                modal.close();
                footerError = '';
                await reloadDetail();
                await actions.afterMutation({ refresh: true });
                ui.toast.success('Order updated', 'The checks were recalculated from the corrected details.');
              } catch (error) {
                saveButton.disabled = false;
                saveButton.textContent = 'Save changes';
                errorSlot.textContent = error.message;
                errorSlot.classList.remove('hide');
              }
            },
          },
          'Save changes',
        );
        footerNode.append(
          ui.el('div', { class: 'spacer' }),
          ui.el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => modal.close() }, 'Cancel'),
          saveButton,
        );
        return footerNode;
      })(),
      onClose: () => {
        modalOpen = false;
      },
    });
    setTimeout(() => businessInput.focus(), 50);
  }

  async function handleReceiveDraft(draftId, button) {
    if (!ui.isOwner(ctx.state.actor)) {
      ui.toast.warning('Owner action required', 'Only the Owner/Manager can mark stock as received.');
      return;
    }
    ui.setBusy(button, true, 'Receiving…');
    try {
      await api.receiveDraft(draftId);
      await reloadDetail();
      await actions.afterMutation({
        title: 'Stock received',
        text: `${draftId} marked as received. The order is now fully covered.`,
        tone: 'success',
      });
    } catch (error) {
      ui.setBusy(button, false);
      ui.toast.danger('Could not receive stock', error.message);
    }
  }

  await load();
}
