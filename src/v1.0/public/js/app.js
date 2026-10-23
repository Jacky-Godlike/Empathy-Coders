import { api, getActorId, setActorId } from './api.js';
import { icon } from './icons.js';
import * as ui from './ui.js';
import { openOrderDrawer } from './components/orderDrawer.js';
import { openScanOverlay } from './components/scanOverlay.js';
import { renderDesk } from './pages/desk.js';
import { renderInbox } from './pages/inbox.js';
import { renderOrders } from './pages/orders.js';
import { renderActivity } from './pages/activity.js';
import { renderCatalog } from './pages/catalog.js';
import { renderSettings } from './pages/settings.js';

const ROUTES = {
  desk: {
    nav: 'desk',
    eyebrow: 'Operations',
    title: 'Order Desk',
    subtitle: 'AI-read orders, checked against stock, cost and delivery — approve in one click.',
    render: renderDesk,
  },
  inbox: {
    nav: 'inbox',
    eyebrow: 'Trigger',
    title: 'Inbox',
    subtitle: 'WhatsApp, email and manual messages waiting for triage.',
    render: renderInbox,
  },
  orders: {
    nav: 'orders',
    eyebrow: 'Records',
    title: 'Orders & purchases',
    subtitle: 'Approved orders, purchase drafts, and CSV / Excel exports.',
    render: renderOrders,
  },
  activity: {
    nav: 'activity',
    eyebrow: 'Audit',
    title: 'Activity log',
    subtitle: 'Every import, analysis, approval and stock change, in one trail.',
    render: renderActivity,
  },
  catalog: {
    nav: 'catalog',
    eyebrow: 'Reference data',
    title: 'Catalog & stock',
    subtitle: 'Products, available stock, safety levels and supplier lead times.',
    render: renderCatalog,
  },
  settings: {
    nav: 'settings',
    eyebrow: 'Configuration',
    title: 'Settings',
    subtitle: 'AI connection, decision rules, roles and demo controls.',
    render: renderSettings,
  },
};

const state = {
  bootstrap: null,
  actor: null,
  route: 'desk',
  filters: {
    desk: 'all',
    deskSearch: '',
    inbox: 'all',
    orders: 'all',
    activity: 'all',
  },
  lastImportResult: null,
  newOrderIds: new Set(),
  busy: false,
};

let sidebarElement = null;
let scrimElement = null;
let renderToken = 0;

function currentRoute() {
  const value = window.location.hash.replace(/^#\/?/, '').trim();
  return ROUTES[value] ? value : 'desk';
}

function navigate(route) {
  if (!ROUTES[route]) route = 'desk';
  if (currentRoute() === route && window.location.hash) {
    renderRoute();
    return;
  }
  window.location.hash = `#/${route}`;
}

function navItems() {
  const stats = state.bootstrap?.stats || {};
  return [
    { id: 'desk', label: 'Order Desk', iconName: 'desk', count: stats.pendingOrders },
    { id: 'inbox', label: 'Inbox', iconName: 'inbox', count: stats.pendingMessages },
    { id: 'orders', label: 'Orders', iconName: 'orders', count: stats.approved },
    { id: 'activity', label: 'Activity log', iconName: 'activity' },
    { id: 'catalog', label: 'Catalog & stock', iconName: 'box' },
    { id: 'settings', label: 'Settings', iconName: 'settings' },
  ];
}

function buildSidebar() {
  const ai = state.bootstrap.ai;
  const nav = ui.el('nav', { class: 'nav', 'aria-label': 'Main navigation' });
  for (const item of navItems()) {
    const hasCount = Number.isFinite(Number(item.count)) && Number(item.count) > 0;
    nav.append(
      ui.el(
        'a',
        {
          class: 'nav-item',
          href: `#/${item.id}`,
          dataset: { nav: item.id },
          'aria-current': state.route === item.id ? 'page' : null,
        },
        ui.el('span', { class: 'nav-icon' }, icon(item.iconName, 17)),
        ui.el('span', { class: 'nav-label', text: item.label }),
        ui.el('span', {
          class: `nav-count${hasCount ? '' : ' hide'}`,
          dataset: { navCount: item.id },
          text: hasCount ? String(item.count) : '',
        }),
      ),
    );
  }

  const aiCard = ui.el(
    'a',
    {
      class: 'ai-card',
      href: '#/settings',
      title: ai.configured ? 'AI extraction is configured' : 'Open Settings to enable AI extraction',
      style: { textDecoration: 'none' },
    },
    ui.el('span', { class: `ai-dot${ai.configured ? '' : ' rules'}` }),
    ui.el(
      'div',
      { style: { minWidth: '0' } },
      ui.el('div', { class: 'ai-title', text: ai.configured ? 'AI extraction on' : 'Rules fallback' }),
      ui.el('div', {
        class: 'ai-sub',
        text: ai.configured
          ? `${ai.provider}${ai.model ? ` · ${ai.model}` : ''}`
          : 'Add your AI key in Settings',
      }),
    ),
  );

  const allowRoleSwitch = state.bootstrap.demo?.allowRoleSwitch !== false;
  const roleSelect = ui.el(
    'select',
    {
      class: 'role-select',
      'aria-label': 'Switch simulated role',
      onChange: async (event) => {
        const id = event.target.value;
        setActorId(id);
        const user = state.bootstrap.users.find((entry) => entry.id === id);
        ui.toast.info(
          'Role switched',
          user ? `You are now acting as ${user.name} (${user.title}).` : 'Simulated role updated.',
        );
        await reloadApp();
      },
    },
    ...state.bootstrap.users.map((user) =>
      ui.el('option', {
        value: user.id,
        text: `${user.name} · ${user.role === 'owner' ? 'Owner' : 'Staff'}`,
      }),
    ),
  );
  roleSelect.value = state.actor.id;

  const footer = ui.el(
    'div',
    { class: 'sidebar-footer' },
    aiCard,
    allowRoleSwitch
      ? ui.el(
          'div',
          { class: 'role-card' },
          ui.el('div', { class: 'role-label', text: 'Signed in as (simulated)' }),
          roleSelect,
          ui.el('div', { class: 'role-hint', text: 'Owner can approve. Staff can review and request information.' }),
        )
      : ui.el(
          'div',
          { class: 'role-card' },
          ui.el('div', { class: 'role-label', text: 'Signed in as' }),
          ui.el('div', { class: 'ai-title', text: `${state.actor.name} · ${state.actor.title}` }),
        ),
  );

  sidebarElement = ui.el(
    'aside',
    { class: 'sidebar', id: 'sidebar' },
    ui.el(
      'div',
      { class: 'sidebar-brand' },
      ui.el('div', { class: 'brand-mark' }, icon('check', 21)),
      ui.el(
        'div',
        {},
        ui.el('div', { class: 'brand-name', text: 'OrderPilot' }),
        ui.el('div', { class: 'brand-tag', text: 'Smart order desk' }),
      ),
    ),
    ui.el('div', { class: 'nav-section-label', text: 'Workspace' }),
    nav,
    footer,
  );
  return sidebarElement;
}

function buildTopbar() {
  const heading = ui.el(
    'div',
    { class: 'page-heading' },
    ui.el('div', { class: 'page-eyebrow', id: 'page-eyebrow' }),
    ui.el('h1', { class: 'page-title', id: 'page-title' }),
    ui.el('div', { class: 'page-subtitle', id: 'page-subtitle' }),
  );

  const menu = ui.el(
    'button',
    {
      class: 'btn btn-ghost btn-icon menu-button',
      type: 'button',
      'aria-label': 'Open navigation',
      onClick: toggleMobileNav,
    },
    icon('menu', 18),
  );

  const datePill = ui.el(
    'span',
    { class: 'topbar-pill date-pill', id: 'date-pill' },
    icon('clock', 13),
    ui.date(state.bootstrap.today, { long: true }),
  );

  const demoPill = ui.el(
    'span',
    {
      class: 'topbar-pill demo-pill',
      title: 'All customers, orders, products and suppliers in this demo are synthetic.',
    },
    icon('shield', 13),
    'Synthetic data',
  );

  return ui.el(
    'header',
    { class: 'topbar' },
    ui.el('div', { class: 'topbar-left' }, menu, heading),
    ui.el('div', { class: 'topbar-right' }, datePill, demoPill),
  );
}

function toggleMobileNav() {
  if (!sidebarElement || !scrimElement) return;
  sidebarElement.classList.toggle('open');
  scrimElement.classList.toggle('open');
}

function closeMobileNav() {
  sidebarElement?.classList.remove('open');
  scrimElement?.classList.remove('open');
}

function updateShell() {
  const route = ROUTES[state.route];
  document.getElementById('page-eyebrow').textContent = route.eyebrow;
  document.getElementById('page-title').textContent = route.title;
  document.getElementById('page-subtitle').textContent = route.subtitle;
  document.querySelectorAll('[data-nav]').forEach((item) => {
    const active = item.dataset.nav === route.nav;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  const stats = state.bootstrap.stats || {};
  const counts = {
    desk: stats.pendingOrders,
    inbox: stats.pendingMessages,
    orders: stats.approved,
  };
  document.querySelectorAll('[data-nav-count]').forEach((node) => {
    const value = Number(counts[node.dataset.navCount]);
    if (Number.isFinite(value) && value > 0) {
      node.textContent = String(value);
      node.classList.remove('hide');
    } else {
      node.textContent = '';
      node.classList.add('hide');
    }
  });
  const datePill = document.getElementById('date-pill');
  if (datePill) {
    ui.mount(datePill, icon('clock', 13), ui.date(state.bootstrap.today, { long: true }));
  }
  const roleSelect = document.querySelector('.role-select');
  if (roleSelect && state.actor) roleSelect.value = state.actor.id;
}

function renderShell() {
  const app = document.getElementById('app');
  app.className = '';
  ui.clear(app);
  scrimElement = ui.el('div', {
    class: 'scrim',
    id: 'scrim',
    onClick: closeMobileNav,
  });
  const content = ui.el('main', { class: 'content', id: 'content' });
  const main = ui.el('div', { class: 'main' }, buildTopbar(), content);
  const shell = ui.el('div', { class: 'app-shell' }, buildSidebar(), main);
  app.append(shell, scrimElement);

  sidebarElement?.querySelectorAll('a.nav-item').forEach((link) => {
    link.addEventListener('click', () => closeMobileNav());
  });
}

function renderPageError(container, error, retry) {
  ui.mount(
    container,
    ui.el(
      'div',
      { class: 'card', style: { maxWidth: '620px', margin: '40px auto' } },
      ui.el(
        'div',
        { class: 'card-body' },
        ui.el('div', { class: 'confirm-icon danger' }, icon('alert', 21)),
        ui.el('div', { class: 'empty-title', text: 'Could not load this page' }),
        ui.el('div', {
          class: 'empty-text',
          text: error?.message || 'An unexpected error occurred. Please try again.',
        }),
        ui.el(
          'div',
          { style: { marginTop: '14px' } },
          ui.el(
            'button',
            { class: 'btn btn-primary', type: 'button', onClick: retry },
            icon('refresh', 15),
            'Retry',
          ),
        ),
      ),
    ),
  );
}

async function renderRoute() {
  if (!state.bootstrap) return;
  state.route = currentRoute();
  updateShell();
  closeMobileNav();
  const content = document.getElementById('content');
  if (!content) return;
  const token = ++renderToken;
  const route = ROUTES[state.route];
  try {
    await route.render(content, {
      state,
      api,
      actions,
      navigate,
      isCurrent: () => token === renderToken,
    });
  } catch (error) {
    if (token !== renderToken) return;
    console.error(error);
    renderPageError(content, error, () => renderRoute());
  }
}

async function refreshBootstrap() {
  state.bootstrap = await api.bootstrap();
  state.actor = state.bootstrap.actor;
  updateShell();
  return state.bootstrap;
}

async function reloadApp() {
  try {
    state.bootstrap = await api.bootstrap();
    state.actor = state.bootstrap.actor;
    renderShell();
    await renderRoute();
  } catch (error) {
    ui.toast.danger('Could not reload', error.message);
  }
}

async function afterMutation({
  title = null,
  text = '',
  tone = 'success',
  route = null,
  refresh = true,
} = {}) {
  try {
    if (route && route !== state.route) {
      navigate(route);
    }
    if (refresh) {
      await refreshBootstrap();
      await renderRoute();
    }
    if (title) ui.toast[tone](title, text);
  } catch (error) {
    ui.toast.danger('Could not refresh the page', error.message);
  }
}

const actions = {
  navigate,
  reloadApp,
  refreshBootstrap,
  afterMutation,

  openOrder(id, options = {}) {
    return openOrderDrawer(id, {
      state,
      api,
      ui,
      actions,
      intent: options.intent || null,
    });
  },

  async scanInbox() {
    if (state.busy) return;
    state.busy = true;
    try {
      const pendingCount = state.bootstrap.stats.pendingMessages;
      const outcome = await openScanOverlay({
        pendingCount,
        run: (mode) => api.triage(mode),
      });
      if (outcome.result) {
        state.newOrderIds = new Set((outcome.result.orders || []).map((order) => order.id));
        await refreshBootstrap();
        if (outcome.viewDesk) navigate('desk');
        else await renderRoute();
        setTimeout(() => {
          document.querySelectorAll('.order-table tr.is-new').forEach((row) => row.classList.remove('is-new'));
          state.newOrderIds.clear();
        }, 3600);
      } else if (outcome.error) {
        ui.toast.danger('Scan failed', outcome.error.message || 'Please try again.');
      }
    } finally {
      state.busy = false;
    }
  },

  async analyzeSingleMessage(payload) {
    const result = await api.importAndAnalyze(payload);
    const messageResult = result.triage?.messageResults?.[0] || null;
    state.lastImportResult = {
      triage: result.triage,
      messageResult,
      mode: result.triage?.modeUsed,
      latency: result.triage?.latencyMs,
    };
    await refreshBootstrap();
    await renderRoute();
    return result;
  },

  async importMessage(payload) {
    const result = await api.importMessage(payload);
    await afterMutation({
      title: 'Message added to inbox',
      text: 'It is waiting for the next scan.',
      tone: 'success',
    });
    return result;
  },

  async sendRequestInfo(id, note = null) {
    return api.requestInfo(id, note);
  },

  async receiveDraft(id) {
    const result = await api.receiveDraft(id);
    await afterMutation({
      title: 'Stock received',
      text: `${result.draft?.id || 'Purchase draft'} marked as received.`,
      tone: 'success',
    });
    return result;
  },

  exportData(type, format, status = 'all') {
    ui.download(api.exportUrl(type, format, status));
    ui.toast.info(
      `${format.toUpperCase()} export started`,
      type === 'activity' ? 'The audit log is downloading.' : 'The order list is downloading.',
    );
  },

  async resetDemo() {
    const ok = await ui.confirmDialog({
      title: 'Reset demo data?',
      message:
        'This restores the 6 seeded orders and 12 pending messages, and clears every approval, purchase draft and activity entry created during the demo. Your AI key is not changed.',
      confirmLabel: 'Reset demo data',
      tone: 'danger',
      requireText: 'RESET',
    });
    if (!ok) return;
    const result = await api.resetDemo('RESET');
    state.lastImportResult = null;
    state.newOrderIds.clear();
    await reloadApp();
    ui.toast.success('Demo reset', 'The order desk is back to its starting state.');
    return result;
  },
};

function renderBootError(error) {
  const app = document.getElementById('app');
  app.className = '';
  ui.mount(
    app,
    ui.el(
      'div',
      { class: 'boot-screen' },
      ui.el('div', { class: 'confirm-icon danger' }, icon('alert', 22)),
      ui.el('div', { class: 'boot-title', text: 'OrderPilot could not start' }),
      ui.el('div', {
        class: 'boot-sub',
        text: error?.message || 'The server did not respond. Check that it is running, then try again.',
      }),
      ui.el(
        'div',
        { style: { marginTop: '16px' } },
        ui.el(
          'button',
          {
            class: 'btn btn-primary',
            type: 'button',
            onClick: () => boot(),
          },
          icon('refresh', 15),
          'Try again',
        ),
      ),
    ),
  );
}

async function boot() {
  try {
    state.bootstrap = await api.bootstrap();
    state.actor = state.bootstrap.actor;
    state.route = currentRoute();
    renderShell();
    await renderRoute();
  } catch (error) {
    if (error.status === 401 && getActorId() !== 'u-aina') {
      setActorId('u-aina');
      return boot();
    }
    console.error(error);
    renderBootError(error);
  }
}

window.addEventListener('hashchange', () => {
  if (state.bootstrap) renderRoute();
});

boot();
