import { icon } from '../icons.js';
import * as ui from '../ui.js';

function orderCustomer(order) {
  const customer = order.customer || {};
  const primary = customer.businessName || customer.name || 'Unknown sender';
  const secondary =
    [customer.name, customer.phone].filter(Boolean).join(' · ') ||
    customer.email ||
    'No contact on file';
  return { primary, secondary };
}

function stockTone(order) {
  const stock = order.checks?.stock;
  if (!stock || (stock.lines || []).length === 0) return 'neutral';
  if (stock.totalShortageUnits > 0) return 'short';
  if ((stock.safetyWarnings || []).length > 0) return 'low';
  return 'ok';
}

function stockSub(order) {
  const stock = order.checks?.stock;
  if (!stock) return '';
  const shortage = (stock.shortageLines || [])[0];
  if (shortage) {
    return `${shortage.supplierName || 'No supplier'} · ${shortage.totalLeadDays ?? '?'}d lead`;
  }
  const safety = (stock.safetyWarnings || [])[0];
  if (safety) {
    return `Post-order ${safety.postOrderAvailable} / safety ${safety.safetyStock}`;
  }
  return stock.lines?.length ? 'Above safety stock' : 'No stock check';
}

function actionLabelFor(order) {
  const code = order.recommendation?.code;
  if (code === 'NEEDS_INFO') return 'Resolve';
  if (code === 'HIGH_RISK') return 'Review';
  return 'Approve';
}

function recommendationReason(order) {
  const reasons = order.recommendation?.reasons || [];
  if (reasons.length === 0) return 'All checks passed';
  return reasons[0].text;
}

function copySummary(order) {
  const lines = (order.items || []).map(
    (item) => `${item.quantity ?? '?'} × ${item.productName}`,
  );
  return [
    `${order.code} — ${order.customer?.businessName || order.customer?.name || 'Unknown sender'}`,
    lines.join(', '),
    `Total ${ui.money(order.totals?.revenue)} · margin ${ui.pct(order.totals?.marginPct)}`,
    `Delivery ${ui.date(order.deliveryDate)}`,
    `Recommendation: ${order.recommendation?.label || '—'}`,
  ].join('\n');
}

function closeRowMenu() {
  document.querySelectorAll('.row-menu').forEach((menu) => menu.remove());
}

function openRowMenu(button, order, { onOpen, onIntent }) {
  closeRowMenu();
  const rect = button.getBoundingClientRect();
  const menu = ui.el(
    'div',
    { class: 'row-menu', role: 'menu' },
    ui.el(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        onClick: () => {
          closeRowMenu();
          onOpen(order);
        },
      },
      icon('eye', 14),
      'View details',
    ),
    ui.el(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        onClick: () => {
          closeRowMenu();
          onIntent(order, 'request-info');
        },
      },
      icon('send', 14),
      'Request information',
    ),
    ui.el(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        class: 'danger',
        onClick: () => {
          closeRowMenu();
          onIntent(order, 'reject');
        },
      },
      icon('x', 14),
      'Reject order',
    ),
    ui.el('div', { class: 'menu-sep' }),
    ui.el(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        onClick: () => {
          closeRowMenu();
          ui.copy(copySummary(order), 'Order summary copied');
        },
      },
      icon('copy', 14),
      'Copy summary',
    ),
  );
  document.body.append(menu);
  const width = 196;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
  let top = rect.bottom + 6;
  if (top + menu.offsetHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menu.offsetHeight - 6);
  }
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  const onDocDown = (event) => {
    if (!menu.contains(event.target) && event.target !== button) closeRowMenu();
  };
  const onScroll = () => closeRowMenu();
  const onKey = (event) => {
    if (event.key === 'Escape') closeRowMenu();
  };
  setTimeout(() => {
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
  }, 0);
  const cleanup = () => {
    document.removeEventListener('mousedown', onDocDown);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', onScroll, true);
  };
  const observer = new MutationObserver(() => {
    if (!menu.isConnected) {
      cleanup();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}

export function renderOrderTable({
  orders,
  actor,
  newOrderIds = new Set(),
  onOpen,
  onQuickAction,
  onIntent,
}) {
  const owner = ui.isOwner(actor);
  const tbody = ui.el('tbody');

  for (const order of orders) {
    const customer = orderCustomer(order);
    const items = (order.items || []).filter((item) => item.quantity > 0 || item.unknown);
    const visibleItems = items.slice(0, 2);
    const moreCount = Math.max(0, items.length - visibleItems.length);
    const flags = order.summary?.flags || [];
    const visibleFlags = flags.slice(0, 2);
    const extraFlags = Math.max(0, flags.length - visibleFlags.length);
    const tone = stockTone(order);
    const deliveryLate = order.checks?.delivery?.past;
    const code = order.recommendation?.code;
    const actionLabel = actionLabelFor(order);
    const needsAttention = code === 'HIGH_RISK' || code === 'NEEDS_INFO';

    const actionButton = needsAttention
      ? ui.el(
          'button',
          {
            class: 'btn btn-soft btn-sm',
            type: 'button',
            onClick: (event) => {
              event.stopPropagation();
              onOpen(order);
            },
          },
          icon(code === 'HIGH_RISK' ? 'alert' : 'edit', 13),
          actionLabel,
        )
      : owner
        ? ui.el(
            'button',
            {
              class: 'btn btn-approve btn-sm',
              type: 'button',
              title: code === 'PROCUREMENT' ? 'Approve and create a purchase draft' : 'Approve this order',
              onClick: (event) => {
                event.stopPropagation();
                onQuickAction('approve', order, event.currentTarget);
              },
            },
            icon('check', 13),
            actionLabel,
          )
        : ui.el(
            'button',
            {
              class: 'btn btn-soft btn-sm',
              type: 'button',
              title: 'Only an Owner/Manager can approve',
              onClick: (event) => {
                event.stopPropagation();
                onQuickAction('locked', order);
              },
            },
            icon('lock', 12),
            'Approve',
          );

    const kebab = ui.el(
      'button',
      {
        class: 'kebab',
        type: 'button',
        'aria-label': `More actions for ${order.code}`,
        onClick: (event) => {
          event.stopPropagation();
          openRowMenu(event.currentTarget, order, { onOpen, onIntent });
        },
      },
      icon('more', 15),
    );

    const row = ui.el(
      'tr',
      {
        class: newOrderIds.has(order.id) ? 'is-new' : '',
        tabindex: '0',
        style: { cursor: 'pointer' },
        onClick: () => onOpen(order),
        onKeydown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(order);
          }
        },
      },
      ui.el(
        'td',
        {},
        ui.el(
          'div',
          { class: 'order-code' },
          order.code,
          icon('chevronRight', 11, 'link-mark'),
        ),
        ui.el(
          'div',
          { class: 'order-meta' },
          ui.channelIcon(order.channel, 10),
          ui.relative(order.createdAt),
          ui.el(
            'span',
            { class: 'source-count', title: `${order.sourceMessageIds?.length || 0} source messages` },
            icon('message', 9),
            String(order.sourceMessageIds?.length || 1),
          ),
        ),
      ),
      ui.el(
        'td',
        {},
        ui.el('div', { class: 'customer-name', text: customer.primary }),
        ui.el('div', { class: 'customer-sub', text: customer.secondary }),
      ),
      ui.el(
        'td',
        {},
        ui.el(
          'div',
          { class: 'item-lines' },
          ...visibleItems.map((item) =>
            ui.el(
              'div',
              { class: 'item-line' },
              ui.el('span', { class: 'item-qty', text: `${item.quantity ?? '?'}×` }),
              ui.el('span', {
                class: 'item-name',
                text: item.productName,
                title: `${item.productName}${item.unit ? ` · ${item.unit}` : ''}`,
              }),
            ),
          ),
          moreCount > 0 ? ui.el('div', { class: 'item-more', text: `+${moreCount} more` }) : null,
          items.length === 0 ? ui.el('div', { class: 'item-line muted', text: 'No items parsed' }) : null,
        ),
      ),
      ui.el(
        'td',
        {},
        ui.el('div', { class: 'money-strong', text: ui.money(order.totals?.revenue) }),
        ui.el(
          'div',
          { class: 'money-sub' },
          'margin ',
          ui.el('span', {
            class: Number(order.totals?.marginPct) < 10 ? 'down' : 'up',
            text: ui.pct(order.totals?.marginPct),
          }),
        ),
      ),
      ui.el(
        'td',
        {},
        ui.el('div', { class: 'delivery-date', text: ui.date(order.deliveryDate, { short: true }) }),
        ui.el('div', {
          class: `delivery-sub${deliveryLate ? ' late' : ''}`,
          text: ui.daysLabel(order.checks?.delivery?.daysUntil),
        }),
      ),
      ui.el(
        'td',
        {},
        ui.el(
          'div',
          { class: `stock-label ${tone}` },
          icon(tone === 'ok' ? 'check' : tone === 'short' ? 'alert' : tone === 'low' ? 'alert' : 'info', 11),
          order.summary?.stock || 'No stock check',
        ),
        ui.el('div', { class: 'stock-sub', text: stockSub(order) }),
      ),
      ui.el(
        'td',
        {},
        ui.el(
          'div',
          { class: 'flag-row' },
          ...visibleFlags.map((flag) => ui.flagChip(flag)),
          extraFlags > 0 ? ui.el('span', { class: 'chip', text: `+${extraFlags}` }) : null,
          flags.length === 0 ? ui.el('span', { class: 'chip chip-success', text: 'Clean' }) : null,
        ),
      ),
      ui.el(
        'td',
        {},
        ui.el(
          'div',
          { class: 'rec-cell' },
          ui.recommendationBadge(order.recommendation),
          ui.el('div', { class: 'rec-reason', text: recommendationReason(order), title: recommendationReason(order) }),
        ),
      ),
      ui.el('td', {}, ui.el('div', { class: 'row-actions' }, actionButton, kebab)),
    );
    tbody.append(row);
  }

  const table = ui.el(
    'table',
    { class: 'order-table', 'aria-label': 'Orders awaiting approval' },
    ui.el(
      'colgroup',
      {},
      ui.el('col', { style: { width: '115px' } }),
      ui.el('col', { style: { width: '140px' } }),
      ui.el('col', { style: { width: '170px' } }),
      ui.el('col', { style: { width: '100px' } }),
      ui.el('col', { style: { width: '100px' } }),
      ui.el('col', { style: { width: '100px' } }),
      ui.el('col', { style: { width: '120px' } }),
      ui.el('col', { style: { width: '165px' } }),
      ui.el('col', { style: { width: '138px' } }),
    ),
    ui.el(
      'thead',
      {},
      ui.el(
        'tr',
        {},
        ui.el('th', { text: 'Order / source' }),
        ui.el('th', { text: 'Customer' }),
        ui.el('th', { text: 'Items' }),
        ui.el('th', { text: 'Amount' }),
        ui.el('th', { text: 'Delivery' }),
        ui.el('th', { text: 'Stock' }),
        ui.el('th', { text: 'Checks' }),
        ui.el('th', { text: 'Recommendation' }),
        ui.el('th', { text: 'Action', style: { textAlign: 'right' } }),
      ),
    ),
    tbody,
  );

  return ui.el('div', { class: 'table-shell' }, table);
}
