import { icon } from '../icons.js';
import * as ui from '../ui.js';
import { renderOrderTable } from '../components/orderTable.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'READY', label: 'Ready' },
  { id: 'PROCUREMENT', label: 'Procurement' },
  { id: 'REVIEW', label: 'Review' },
  { id: 'NEEDS_INFO', label: 'Needs info' },
  { id: 'HIGH_RISK', label: 'High risk' },
  { id: 'CHANGE_REQUEST', label: 'Change' },
];

function countBy(orders, predicate) {
  return orders.filter(predicate).length;
}

function statCard({ label, value, unit = '', note, accent = false, noteTone = '' }) {
  return ui.el(
    'div',
    { class: `stat-card${accent ? ' accent' : ''}` },
    ui.el('div', { class: 'stat-label', text: label }),
    ui.el(
      'div',
      { class: 'stat-value' },
      String(value),
      unit ? ui.el('span', { class: 'unit', text: ` ${unit}` }) : null,
    ),
    note ? ui.el('div', { class: `stat-note ${noteTone}` }, note) : null,
  );
}

async function quickApprove(order, button, ctx) {
  const { api, state, actions } = ctx;
  if (!ui.isOwner(state.actor)) {
    ui.toast.warning('Owner approval required', 'Switch to Aina (Owner/Manager) to approve this order.');
    return;
  }
  if (order.recommendation?.code === 'PROCUREMENT') {
    const shortageLines = order.checks?.stock?.shortageLines || [];
    const shortageText = shortageLines
      .map((line) => `${line.shortage} × ${line.productName}`)
      .join(', ');
    const ok = await ui.confirmDialog({
      title: 'Approve and create a purchase draft?',
      message: `This order is short: ${shortageText}. OrderPilot will reserve the available stock and create an internal purchase draft. Nothing is sent to the supplier automatically.`,
      confirmLabel: 'Approve & create draft',
      tone: 'primary',
    });
    if (!ok) return;
  }

  ui.setBusy(button, true, 'Approving…');
  try {
    const result = await api.approve(order.id, null);
    const drafts = result.purchaseDrafts?.length || 0;
    await actions.afterMutation({
      title: 'Order approved',
      text: `${order.code} is approved.${drafts ? ` ${drafts} purchase draft${drafts === 1 ? '' : 's'} created.` : ' Stock reserved.'}`,
      tone: 'success',
    });
  } catch (error) {
    if (error.code === 'NOTE_REQUIRED' || error.code === 'NEEDS_INFO') {
      await actions.openOrder(order.id);
      ui.toast.warning(
        error.code === 'NOTE_REQUIRED' ? 'A note is required' : 'More information needed',
        error.message,
      );
    } else {
      ui.setBusy(button, false);
      ui.toast.danger('Could not approve order', error.message);
    }
  }
}

export async function renderDesk(root, ctx) {
  const { api, state, actions } = ctx;
  const [ordersResponse, stats] = await Promise.all([api.orders('pending'), api.stats()]);
  const orders = ordersResponse.orders || [];
  const pendingMessages = stats.pendingMessages ?? 0;
  const ready = orders.filter((order) => order.recommendation?.code === 'READY');
  const procurement = orders.filter((order) => order.recommendation?.code === 'PROCUREMENT');
  const needsInfo = orders.filter((order) => order.recommendation?.code === 'NEEDS_INFO');
  const highRisk = orders.filter((order) => order.recommendation?.code === 'HIGH_RISK');
  const review = orders.filter((order) => order.recommendation?.code === 'REVIEW');
  const attention = orders.filter((order) =>
    ['PROCUREMENT', 'REVIEW', 'NEEDS_INFO', 'HIGH_RISK', 'CHANGE_REQUEST'].includes(order.recommendation?.code),
  );
  const readyValue = ready.reduce((total, order) => total + (Number(order.totals?.revenue) || 0), 0);
  const pendingValue = orders.reduce((total, order) => total + (Number(order.totals?.revenue) || 0), 0);
  const pendingProfit = orders.reduce((total, order) => total + (Number(order.totals?.grossProfit) || 0), 0);
  const lastScan = stats.lastTriage;

  let filter = state.filters.desk || 'all';
  let search = state.filters.deskSearch || '';

  const scanButton = ui.el(
    'button',
    {
      class: 'btn btn-accent btn-lg',
      type: 'button',
      onClick: () => actions.scanInbox(),
      title: pendingMessages ? 'Scan pending inbox messages' : 'No pending messages',
    },
    icon('sparkles', 16),
    pendingMessages ? `Scan inbox (${pendingMessages})` : 'Scan inbox',
  );

  const pageActions = ui.el(
    'div',
    { class: 'page-actions' },
    ui.el(
      'div',
      { class: 'page-actions-left' },
      scanButton,
      ui.el(
        'button',
        { class: 'btn btn-ghost', type: 'button', onClick: () => actions.navigate('inbox') },
        icon('inbox', 14),
        'Open inbox',
      ),
    ),
    ui.el(
      'div',
      { class: 'page-actions-right' },
      ui.el(
        'div',
        { class: 'last-scan', title: lastScan?.summary || 'Seed data loaded' },
        icon('clock', 12),
        lastScan
          ? `Last scan ${ui.relative(lastScan.at)} · ${ui.shortText(lastScan.summary, 58)}`
          : 'Seed data loaded',
      ),
    ),
  );

  const statsGrid = ui.el(
    'div',
    { class: 'stats-grid' },
    statCard({
      label: 'Pending orders',
      value: orders.length,
      unit: 'orders',
      note: `${highRisk.length} high risk · ${review.length} review`,
      noteTone: highRisk.length ? 'tone-danger' : '',
      accent: true,
    }),
    statCard({
      label: 'Ready to approve',
      value: ready.length,
      unit: 'ready',
      note: readyValue ? `${ui.money(readyValue)} revenue` : 'No clean orders yet',
      noteTone: 'tone-success',
    }),
    statCard({
      label: 'Needs attention',
      value: attention.length,
      unit: 'orders',
      note: `${procurement.length} procurement · ${needsInfo.length} need info`,
    }),
    statCard({
      label: 'Value awaiting approval',
      value: ui.money(pendingValue),
      note: `Gross profit ${ui.money(pendingProfit)}`,
    }),
  );

  const filterChips = ui.el('div', { class: 'filter-chips' });
  const searchInput = ui.el('input', {
    type: 'search',
    placeholder: 'Search customer, order or item…',
    value: search,
    'aria-label': 'Search pending orders',
    onInput: (event) => {
      search = event.target.value;
      state.filters.deskSearch = search;
      renderTable();
    },
  });
  const filterBar = ui.el(
    'div',
    { class: 'filter-bar' },
    filterChips,
    ui.el('div', { class: 'search-box' }, icon('search', 14), searchInput),
  );

  const tableHost = ui.el('div');

  function renderFilterChips() {
    ui.mount(
      filterChips,
      ...FILTERS.map((item) => {
        const count =
          item.id === 'all' ? orders.length : countBy(orders, (order) => order.recommendation?.code === item.id);
        return ui.el(
          'button',
          {
            class: `filter-chip${filter === item.id ? ' active' : ''}`,
            type: 'button',
            'aria-pressed': filter === item.id ? 'true' : 'false',
            onClick: () => {
              filter = item.id;
              state.filters.desk = filter;
              renderFilterChips();
              renderTable();
            },
          },
          item.label,
          ui.el('span', { class: 'count', text: String(count) }),
        );
      }),
    );
  }

  function filteredOrders() {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter !== 'all' && order.recommendation?.code !== filter) return false;
      if (!query) return true;
      const haystack = [
        order.code,
        order.customer?.businessName,
        order.customer?.name,
        order.customer?.phone,
        order.customer?.email,
        order.notes,
        ...(order.items || []).map((item) => item.productName),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderTable() {
    const visible = filteredOrders();
    if (visible.length === 0) {
      const hasFilters = filter !== 'all' || search.trim();
      ui.mount(
        tableHost,
        ui.emptyState({
          iconName: orders.length === 0 ? 'desk' : 'search',
          title: orders.length === 0 ? 'No pending orders' : 'No orders match this view',
          text:
            orders.length === 0
              ? 'The order desk is clear. Scan the inbox to bring in new orders.'
              : 'Try another filter or clear the search.',
          action: ui.el(
            'button',
            {
              class: 'btn btn-accent',
              type: 'button',
              onClick: () => {
                if (orders.length === 0) actions.scanInbox();
                else {
                  filter = 'all';
                  search = '';
                  searchInput.value = '';
                  state.filters.desk = 'all';
                  state.filters.deskSearch = '';
                  renderFilterChips();
                  renderTable();
                }
              },
            },
            icon(orders.length === 0 ? 'sparkles' : 'refresh', 14),
            orders.length === 0 ? 'Scan inbox' : 'Clear filters',
          ),
        }),
      );
      return;
    }

    ui.mount(
      tableHost,
      renderOrderTable({
        orders: visible,
        actor: state.actor,
        newOrderIds: state.newOrderIds,
        onOpen: (order) => actions.openOrder(order.id),
        onQuickAction: (action, order, button) => {
          if (action === 'locked') {
            ui.toast.warning('Owner approval required', 'Switch to Aina (Owner/Manager) to approve this order.');
          } else if (action === 'approve') {
            quickApprove(order, button, ctx);
          }
        },
        onIntent: (order, intent) => actions.openOrder(order.id, { intent }),
      }),
    );
  }

  const impact = ui.el(
    'div',
    { class: 'impact-strip' },
    ui.el(
      'div',
      { class: 'impact-items' },
      ui.el(
        'div',
        { class: 'impact-item' },
        ui.el('span', { class: 'impact-value', text: ui.num(stats.processedMessages) }),
        ui.el('span', { class: 'impact-label', text: 'messages triaged' }),
      ),
      ui.el(
        'div',
        { class: 'impact-item' },
        ui.el('span', { class: 'impact-value', text: ui.num(stats.approved) }),
        ui.el('span', { class: 'impact-label', text: 'orders approved' }),
      ),
      ui.el(
        'div',
        { class: 'impact-item' },
        ui.el('span', { class: 'impact-value', text: `~${ui.num(stats.estimatedMinutesSaved)}` }),
        ui.el('span', { class: 'impact-label', text: 'minutes saved (est.)' }),
      ),
    ),
    ui.el('div', {
      class: 'impact-note',
      text: 'Illustrative estimate: 1.5 min per message triaged + 3 min per approved order. The real saving is the missed order and wrong-quote risk avoided.',
    }),
  );

  const page = ui.el('div', {}, pageActions, statsGrid, filterBar, tableHost, impact);
  ui.mount(root, page);
  renderFilterChips();
  renderTable();
}
