import { icon } from '../icons.js';
import * as ui from '../ui.js';

const FILTERS = [
  { id: 'all', label: 'All activity' },
  { id: 'orders', label: 'Orders' },
  { id: 'stock', label: 'Stock & purchasing' },
  { id: 'ai', label: 'Inbox & AI' },
  { id: 'system', label: 'System' },
];

function matchesFilter(activity, filter) {
  if (filter === 'orders') return activity.action.startsWith('order.');
  if (filter === 'stock') {
    return activity.action.startsWith('stock.') || activity.action.startsWith('purchase_draft.');
  }
  if (filter === 'ai') {
    return (
      activity.action.startsWith('triage.') ||
      activity.action.startsWith('ai.') ||
      activity.action.startsWith('message.')
    );
  }
  if (filter === 'system') return activity.actor?.role === 'system';
  return true;
}

function timelineItem(activity, ctx) {
  const meta = ui.actionMeta(activity.action);
  const actor = activity.actor || {};
  const details = activity.details
    ? ui.el(
        'details',
        { class: 'timeline-details' },
        ui.el('summary', { text: 'Details' }),
        ui.el('pre', { text: JSON.stringify(activity.details, null, 2) }),
      )
    : null;

  return ui.el(
    'div',
    { class: 'timeline-item' },
    ui.el('span', { class: `timeline-dot ${meta.tone}` }),
    ui.el(
      'div',
      { class: 'timeline-body' },
      ui.el(
        'div',
        { class: 'timeline-head' },
        ui.el('div', { class: 'timeline-action', text: meta.label }),
        ui.el('div', {
          class: 'timeline-time',
          text: `${ui.dateTime(activity.at)} · ${ui.relative(activity.at)}`,
          title: activity.at,
        }),
      ),
      ui.el('div', { class: 'timeline-summary', text: activity.summary || '—' }),
      ui.el(
        'div',
        { class: 'timeline-actor' },
        ui.el('span', { class: 'avatar small', text: ui.initials(actor.name || 'System') }),
        ui.el('span', { text: actor.name || 'System' }),
        ui.el('span', { class: 'muted', text: `· ${ui.titleCase(actor.role || 'system')}` }),
        activity.orderId
          ? ui.el(
              'button',
              {
                class: 'btn-link',
                type: 'button',
                style: { marginLeft: '4px' },
                onClick: () => ctx.actions.openOrder(activity.orderId),
              },
              'Open order',
              icon('arrowRight', 10),
            )
          : null,
      ),
      details,
    ),
  );
}

export async function renderActivity(root, ctx) {
  const { api, actions } = ctx;
  const response = await api.activity({ limit: 300 });
  const activities = response.activities || [];
  let filter = 'all';
  let search = '';

  const pageActions = ui.el(
    'div',
    { class: 'page-actions' },
    ui.el(
      'div',
      { class: 'page-actions-left' },
      ui.el(
        'span',
        { class: 'last-scan' },
        icon('lock', 12),
        'Append-only demo audit log · every import, analysis, approval and stock change is recorded.',
      ),
    ),
    ui.el(
      'div',
      { class: 'page-actions-right' },
      ui.el(
        'button',
        {
          class: 'btn btn-soft',
          type: 'button',
          onClick: () => actions.exportData('activity', 'csv'),
        },
        icon('download', 14),
        'CSV',
      ),
      ui.el(
        'button',
        {
          class: 'btn btn-soft',
          type: 'button',
          onClick: () => actions.exportData('activity', 'xlsx'),
        },
        icon('download', 14),
        'Excel',
      ),
    ),
  );

  const filterChips = ui.el('div', { class: 'filter-chips' });
  const searchInput = ui.el('input', {
    type: 'search',
    placeholder: 'Search the audit trail…',
    'aria-label': 'Search activity',
    onInput: (event) => {
      search = event.target.value;
      renderTimeline();
    },
  });
  const filterBar = ui.el(
    'div',
    { class: 'filter-bar' },
    filterChips,
    ui.el('div', { class: 'search-box' }, icon('search', 14), searchInput),
  );
  const timelineHost = ui.el('div');

  function countsFor(id) {
    return activities.filter((activity) => matchesFilter(activity, id)).length;
  }

  function renderChips() {
    ui.mount(
      filterChips,
      ...FILTERS.map((item) =>
        ui.el(
          'button',
          {
            class: `filter-chip${filter === item.id ? ' active' : ''}`,
            type: 'button',
            'aria-pressed': filter === item.id ? 'true' : 'false',
            onClick: () => {
              filter = item.id;
              renderChips();
              renderTimeline();
            },
          },
          item.label,
          ui.el('span', { class: 'count', text: String(countsFor(item.id)) }),
        ),
      ),
    );
  }

  function renderTimeline() {
    const query = search.trim().toLowerCase();
    const visible = activities.filter((activity) => {
      if (!matchesFilter(activity, filter)) return false;
      if (!query) return true;
      return [
        activity.summary,
        activity.action,
        activity.actor?.name,
        activity.actor?.role,
        activity.orderId,
        activity.entityId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    if (visible.length === 0) {
      ui.mount(
        timelineHost,
        ui.emptyState({
          iconName: 'activity',
          title: 'No activity in this view',
          text: 'Try another filter or clear the search.',
        }),
      );
      return;
    }

    ui.mount(
      timelineHost,
      ui.el('div', { class: 'timeline' }, ...visible.map((activity) => timelineItem(activity, ctx))),
    );
  }

  ui.mount(
    root,
    ui.el(
      'div',
      {},
      pageActions,
      filterBar,
      ui.el(
        'div',
        { class: 'card', style: { padding: '14px 16px 4px' } },
        ui.el(
          'div',
          { class: 'row between', style: { marginBottom: '10px', flexWrap: 'wrap', gap: '8px' } },
          ui.el('div', { class: 'card-title', text: 'Audit trail' }),
          ui.el('span', { class: 'badge badge-neutral' }, `${activities.length} entries`),
        ),
        timelineHost,
      ),
    ),
  );
  renderChips();
  renderTimeline();
}
