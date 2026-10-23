import { icon } from '../icons.js';
import * as ui from '../ui.js';

const TABS = [
  { id: 'all', label: 'All records' },
  { id: 'approved', label: 'Approved' },
  { id: 'draft', label: 'Awaiting approval' },
  { id: 'needs_info', label: 'Needs info' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'superseded', label: 'Superseded' },
];

function overlayLabel(order) {
  if (order.status === 'approved') {
    return {
      primary: order.approvedBy?.name || 'Approved',
      secondary: order.approvedAt ? ui.dateTime(order.approvedAt) : '',
    };
  }
  if (order.status === 'rejected') {
    return {
      primary: order.rejectedBy?.name || 'Rejected',
      secondary: order.rejectedAt ? ui.dateTime(order.rejectedAt) : '',
    };
  }
  if (order.status === 'superseded') {
    return { primary: 'Superseded', secondary: order.supersededByCode || '' };
  }
  return { primary: '—', secondary: '' };
}

function ordersTable(visible, ctx) {
  const { state, actions } = ctx;
  const rows = visible.map((order) => {
    const customer = order.customer || {};
    const items = (order.items || []).filter((item) => item.quantity > 0 || item.unknown);
    const visibleItems = items.slice(0, 2);
    const more = items.length - visibleItems.length;
    const overlay = overlayLabel(order);
    return ui.el(
      'tr',
      {
        style: { cursor: 'pointer' },
        onClick: () => actions.openOrder(order.id),
      },
      ui.el(
        'td',
        {},
        ui.el('div', { class: 'order-code', text: order.code }),
        ui.el(
          'div',
          { class: 'order-meta' },
          ui.channelIcon(order.channel, 10),
          ui.relative(order.createdAt),
          order.changeRequest ? ui.el('span', { class: 'chip chip-info', text: 'Change' }) : null,
        ),
      ),
      ui.el(
        'td',
        {},
        ui.el('div', { class: 'customer-name', text: customer.businessName || customer.name || 'Unknown sender' }),
        ui.el('div', {
          class: 'customer-sub',
          text: [customer.name, customer.phone].filter(Boolean).join(' · ') || customer.email || 'No contact',
        }),
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
              ui.el('span', { class: 'item-name', text: item.productName }),
            ),
          ),
          more > 0 ? ui.el('div', { class: 'item-more', text: `+${more} more` }) : null,
          items.length === 0 ? ui.el('div', { class: 'item-line muted', text: 'No items' }) : null,
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
      ui.el('td', {}, ui.statusBadge(order.status)),
      ui.el(
        'td',
        {},
        ui.el(
          'div',
          { class: 'rec-cell', style: { maxWidth: '170px' } },
          ui.recommendationBadge(order.recommendation),
          ui.el('div', {
            class: 'rec-reason',
            text: order.summary?.stock || order.recommendation?.shortLabel || '',
          }),
        ),
      ),
      ui.el(
        'td',
        {},
        ui.el('div', { style: { fontSize: '11px', fontWeight: '600' }, text: overlay.primary }),
        ui.el('div', { class: 'form-hint', style: { fontSize: '9.5px' }, text: overlay.secondary }),
      ),
      ui.el(
        'td',
        { style: { textAlign: 'right' } },
        ui.el(
          'button',
          {
            class: 'btn btn-soft btn-sm',
            type: 'button',
            onClick: (event) => {
              event.stopPropagation();
              actions.openOrder(order.id);
            },
          },
          icon('eye', 12),
          order.status === 'draft' || order.status === 'needs_info' ? 'Review' : 'View',
        ),
      ),
    );
  });

  if (rows.length === 0) {
    return ui.emptyState({
      iconName: 'orders',
      title: 'No orders in this view',
      text: 'Approved and rejected orders will appear here. Pending orders are on the Order Desk.',
      action: ui.el(
        'button',
        { class: 'btn btn-primary', type: 'button', onClick: () => ctx.actions.navigate('desk') },
        icon('desk', 14),
        'Open Order Desk',
      ),
    });
  }

  const table = ui.el(
    'table',
    { class: 'orders-table', 'aria-label': 'Order records' },
    ui.el(
      'thead',
      {},
      ui.el(
        'tr',
        {},
        ui.el('th', { text: 'Order' }),
        ui.el('th', { text: 'Customer' }),
        ui.el('th', { text: 'Items' }),
        ui.el('th', { text: 'Revenue' }),
        ui.el('th', { text: 'Status' }),
        ui.el('th', { text: 'Recommendation' }),
        ui.el('th', { text: 'Decision' }),
        ui.el('th', { text: 'Action', style: { textAlign: 'right' } }),
      ),
    ),
    ui.el('tbody', {}, ...rows),
  );
  return ui.el('div', { class: 'orders-table-shell' }, table);
}

function purchaseCards(drafts, ctx) {
  const { state, actions } = ctx;
  if (drafts.length === 0) {
    return ui.emptyState({
      iconName: 'truck',
      title: 'No purchase drafts yet',
      text: 'Approving an order with a stock shortage creates an internal purchase draft automatically.',
    });
  }
  const owner = ui.isOwner(state.actor);
  return ui.el(
    'div',
    { class: 'purchase-grid' },
    ...drafts.map((draft) =>
      ui.el(
        'div',
        { class: 'purchase-card' },
        ui.el(
          'div',
          { class: 'purchase-head' },
          ui.el(
            'div',
            {},
            ui.el('div', { class: 'purchase-id', text: draft.id }),
            ui.el('div', { class: 'purchase-supplier', text: draft.supplierName || 'Manual procurement' }),
          ),
          draft.status === 'received'
            ? ui.el('span', { class: 'badge badge-success' }, elDot(), 'Received')
            : ui.el('span', { class: 'badge badge-warning' }, elDot(), 'Draft'),
        ),
        ui.el('div', { class: 'form-hint', style: { marginTop: '3px' }, text: `For ${draft.orderCode || draft.orderId}` }),
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
                  onClick: async (event) => {
                    const button = event.currentTarget;
                    ui.setBusy(button, true, 'Receiving…');
                    try {
                      await actions.receiveDraft(draft.id);
                    } catch (error) {
                      ui.setBusy(button, false);
                      ui.toast.danger('Could not receive stock', error.message);
                    }
                  },
                },
                icon('truck', 13),
                'Mark received',
              )
            : draft.status === 'draft'
              ? ui.el('span', { class: 'chip', text: 'Owner only' })
              : ui.el('span', { class: 'badge badge-success' }, 'Received'),
        ),
        ui.el('div', { class: 'purchase-note', text: draft.note || 'Internal draft only. Nothing is sent automatically.' }),
      ),
    ),
  );
}

function elDot() {
  return ui.el('span', { class: 'dot' });
}

export async function renderOrders(root, ctx) {
  const { api, state, actions } = ctx;
  const [ordersResponse, draftsResponse] = await Promise.all([
    api.orders('all'),
    api.purchaseDrafts(),
  ]);
  const orders = ordersResponse.orders || [];
  const drafts = draftsResponse.purchaseDrafts || [];
  let filter = state.filters.orders || 'all';

  const counts = {
    all: orders.length,
    approved: orders.filter((order) => order.status === 'approved').length,
    draft: orders.filter((order) => order.status === 'draft').length,
    needs_info: orders.filter((order) => order.status === 'needs_info').length,
    rejected: orders.filter((order) => order.status === 'rejected').length,
    superseded: orders.filter((order) => order.status === 'superseded').length,
  };

  const exportStatus = () => (filter === 'all' ? 'all' : filter);

  const pageActions = ui.el(
    'div',
    { class: 'page-actions' },
    ui.el(
      'div',
      { class: 'page-actions-left' },
      ui.el(
        'button',
        { class: 'btn btn-ghost', type: 'button', onClick: () => actions.navigate('desk') },
        icon('desk', 14),
        'Order Desk',
      ),
      ui.el('span', { class: 'last-scan', text: `${orders.length} records · ${drafts.length} purchase drafts` }),
    ),
    ui.el(
      'div',
      { class: 'page-actions-right' },
      ui.el(
        'button',
        {
          class: 'btn btn-soft',
          type: 'button',
          onClick: () => actions.exportData('orders', 'csv', exportStatus()),
        },
        icon('download', 14),
        'CSV',
      ),
      ui.el(
        'button',
        {
          class: 'btn btn-soft',
          type: 'button',
          onClick: () => actions.exportData('orders', 'xlsx', exportStatus()),
        },
        icon('download', 14),
        'Excel',
      ),
    ),
  );

  const tabs = ui.el(
    'div',
    { class: 'tabs', role: 'tablist', 'aria-label': 'Order status' },
    ...TABS.map((tab) =>
      ui.el(
        'button',
        {
          class: `tab${filter === tab.id ? ' active' : ''}`,
          type: 'button',
          role: 'tab',
          'aria-selected': filter === tab.id ? 'true' : 'false',
          onClick: () => {
            filter = tab.id;
            state.filters.orders = filter;
            updateTabs();
            renderTable();
          },
        },
        tab.label,
        ui.el('span', { class: 'tab-count', text: String(counts[tab.id] ?? 0) }),
      ),
    ),
  );

  function updateTabs() {
    [...tabs.children].forEach((tab, index) => {
      const active = TABS[index].id === filter;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  const tableHost = ui.el('div');
  function renderTable() {
    const visible =
      filter === 'all' ? orders : orders.filter((order) => order.status === filter);
    ui.mount(tableHost, ordersTable(visible, ctx));
  }

  const draftsSection = ui.el(
    'section',
    { style: { marginTop: '22px' } },
    ui.el(
      'div',
      { class: 'row between', style: { marginBottom: '9px', flexWrap: 'wrap', gap: '8px' } },
      ui.el(
        'div',
        {},
        ui.el('div', { class: 'card-title', text: 'Purchase drafts' }),
        ui.el('div', {
          class: 'card-sub',
          text: 'Internal reminders only. OrderPilot never sends a real purchase order automatically.',
        }),
      ),
      ui.el('span', { class: 'badge badge-neutral' }, `${drafts.length} total`),
    ),
    purchaseCards(drafts, ctx),
  );

  ui.mount(
    root,
    ui.el(
      'div',
      {},
      pageActions,
      tabs,
      tableHost,
      draftsSection,
      ui.el(
        'div',
        { class: 'form-hint', style: { marginTop: '14px' } },
        'Exports use the current tab. CSV opens in Excel and includes a UTF-8 BOM; the XLSX file has frozen headers and formatted money columns.',
      ),
    ),
  );
  renderTable();
}
