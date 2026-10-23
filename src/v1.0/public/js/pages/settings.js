import { icon } from '../icons.js';
import * as ui from '../ui.js';

function settingsCard({ title, subtitle = '', iconName = 'settings', span = false, className = '' }, ...children) {
  return ui.el(
    'section',
    { class: `settings-card${span ? ' span-2' : ''}${className ? ` ${className}` : ''}` },
    ui.el(
      'div',
      { class: 'settings-head' },
      ui.el(
        'div',
        {},
        ui.el('div', { class: 'settings-title' }, icon(iconName, 15), ' ', title),
        subtitle ? ui.el('div', { class: 'settings-sub', text: subtitle }) : null,
      ),
    ),
    ...children,
  );
}

function row(key, value) {
  return ui.el(
    'div',
    { class: 'settings-row' },
    ui.el('span', { class: 'key', text: key }),
    ui.el('span', { class: 'value', text: value }),
  );
}

export async function renderSettings(root, ctx) {
  const { api, state, actions } = ctx;
  const bootstrap = state.bootstrap;
  const ai = bootstrap.ai;
  const rules = bootstrap.rules;
  const stats = bootstrap.stats;
  const orbyte = bootstrap.orbyte;
  const owner = ui.isOwner(state.actor);
  const allowRoleSwitch = bootstrap.demo?.allowRoleSwitch !== false;

  const aiStatusBadge = ai.configured
    ? ui.el('span', { class: 'badge badge-success' }, ui.el('span', { class: 'dot' }), 'AI extraction on')
    : ui.el('span', { class: 'badge badge-neutral' }, ui.el('span', { class: 'dot' }), 'Rules fallback');

  const aiTestHost = ui.el('div', { style: { marginTop: '10px' } });
  const aiTestButton = ui.el(
    'button',
    {
      class: 'btn btn-soft btn-sm',
      type: 'button',
      onClick: async (event) => {
        const button = event.currentTarget;
        ui.setBusy(button, true, 'Testing…');
        try {
          const result = await api.testAI();
          if (result.ok) {
            ui.mount(
              aiTestHost,
              ui.el('div', {
                class: 'modal-success',
                text: `Connected to ${result.provider}${result.model ? ` · ${result.model}` : ''} in ${ui.elapsed(result.latencyMs)}.`,
              }),
            );
            ui.toast.success('AI connected', 'The extraction model responded successfully.');
          } else {
            ui.mount(
              aiTestHost,
              ui.el('div', { class: 'modal-error', text: 'The provider did not return the expected response.' }),
            );
          }
        } catch (error) {
          ui.mount(aiTestHost, ui.el('div', { class: 'modal-error', text: error.message }));
          ui.toast.danger('AI test failed', error.message);
        } finally {
          ui.setBusy(button, false);
        }
      },
    },
    icon('sparkles', 13),
    'Test connection',
  );

  const aiCard = settingsCard(
    {
      title: 'AI extraction',
      subtitle: 'AI reads messages and extracts fields. Stock, margin and risk are always calculated by the rules below.',
      iconName: 'sparkles',
      span: true,
    },
    ui.el('div', { class: 'row between', style: { marginBottom: '8px' } }, aiStatusBadge, ai.configured && owner ? aiTestButton : null),
    row('Provider', ai.provider || 'rules'),
    row('Model', ai.model || '—'),
    row('Mode', ai.mode === 'ai' ? 'AI extraction' : 'Deterministic rules fallback'),
    ui.el('div', { class: 'form-hint', style: { marginTop: '8px' }, text: ai.detail }),
    ai.configured
      ? aiTestHost
      : ui.el(
          'div',
          { style: { marginTop: '12px' } },
          ui.el('div', { class: 'section-title', text: 'Enable AI in three steps' }),
          ui.el(
            'div',
            { class: 'steps' },
            ui.el(
              'div',
              { class: 'step' },
              ui.el('div', { class: 'step-num', text: '1' }),
              ui.el(
                'div',
                { class: 'step-text' },
                'Create a free Gemini API key at ',
                ui.el(
                  'a',
                  { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener' },
                  'Google AI Studio',
                ),
                '.',
              ),
            ),
            ui.el(
              'div',
              { class: 'step' },
              ui.el('div', { class: 'step-num', text: '2' }),
              ui.el(
                'div',
                { class: 'step-text' },
                'In Replit, open Secrets and add ',
                ui.el('code', { text: 'AI_API_KEY' }),
                ' with your key, and set ',
                ui.el('code', { text: 'AI_PROVIDER=gemini' }),
                ' (or openai / deepseek / anthropic). Optionally add ',
                ui.el('code', { text: 'AI_MODEL=gemini-2.5-flash' }),
                '.',
              ),
            ),
            ui.el(
              'div',
              { class: 'step' },
              ui.el('div', { class: 'step-num', text: '3' }),
              ui.el(
                'div',
                { class: 'step-text' },
                'Restart or redeploy. The sidebar will switch to “AI extraction on”. If the AI call ever fails, the rules fallback keeps the demo working.',
              ),
            ),
          ),
          ui.el('div', {
            class: 'form-hint',
            style: { marginTop: '9px' },
            text: 'The key is read server-side only. It is never sent to the browser and never written into the repository.',
          }),
        ),
  );

  const rulesCard = settingsCard(
    {
      title: 'Decision rules',
      subtitle: 'Transparent and deterministic. Every order shows the rules it was checked against.',
      iconName: 'shield',
    },
    row('Minimum gross margin', `${rules.marginMinPct}%`),
    row('High-risk margin floor', `${rules.marginRejectPct}%`),
    row('Price deviation threshold', `${rules.priceDeviationPct}%`),
    row('Low-confidence threshold', `${Math.round(rules.lowConfidence * 100)}%`),
    row('Duplicate window', `${rules.duplicateWindowHours} hours`),
    row('Consolidation window', `${rules.consolidationWindowHours} hours`),
    row('Supplier handling buffer', `${rules.handlingDays} day${rules.handlingDays === 1 ? '' : 's'}`),
    ui.el('div', {
      class: 'form-hint',
      style: { marginTop: '9px' },
      text: 'Margin below 10% is flagged for review; below 0% or a quote below cost is high risk. A shortage is procurement only when the supplier lead time fits before the delivery date.',
    }),
  );

  const impactCard = settingsCard(
    {
      title: 'Demo impact',
      subtitle: 'Illustrative numbers from this synthetic session.',
      iconName: 'chart',
    },
    ui.el(
      'div',
      { class: 'impact-card' },
      ui.el(
        'div',
        { class: 'impact-metric' },
        ui.el('div', { class: 'value', text: ui.num(stats.processedMessages) }),
        ui.el('div', { class: 'label', text: 'messages triaged' }),
      ),
      ui.el(
        'div',
        { class: 'impact-metric' },
        ui.el('div', { class: 'value', text: ui.num(stats.approved) }),
        ui.el('div', { class: 'label', text: 'orders approved' }),
      ),
      ui.el(
        'div',
        { class: 'impact-metric' },
        ui.el('div', { class: 'value', text: `~${ui.num(stats.estimatedMinutesSaved)}` }),
        ui.el('div', { class: 'label', text: 'minutes saved (est.)' }),
      ),
    ),
    ui.el('div', {
      class: 'form-hint',
      style: { marginTop: '9px' },
      text: 'Estimate: 1.5 minutes per message triaged + 3 minutes per approved order. The real benefit is fewer missed orders and fewer wrong quotes.',
    }),
  );

  const roleButtons = allowRoleSwitch
    ? ui.el(
        'div',
        { class: 'row wrap', style: { marginBottom: '10px' } },
        ...bootstrap.users.map((user) =>
          ui.el(
            'button',
            {
              class: `btn ${user.id === state.actor.id ? 'btn-primary' : 'btn-soft'}`,
              type: 'button',
              onClick: async () => {
                if (user.id === state.actor.id) return;
                api.setActorId(user.id);
                ui.toast.info('Role switched', `You are now acting as ${user.name} (${user.title}).`);
                await actions.reloadApp();
              },
            },
            icon(user.role === 'owner' ? 'shield' : 'user', 14),
            `${user.name} · ${user.title}`,
          ),
        ),
      )
    : ui.el('div', { class: 'form-hint', text: 'Role switching is disabled by ALLOW_ROLE_SWITCH=false.' });

  const rolesCard = settingsCard(
    {
      title: 'Roles and permissions',
      subtitle: 'Simulated RBAC for the demo. A production deployment would use Orbyte SSO and roles.',
      iconName: 'users',
      span: true,
    },
    roleButtons,
    ui.el(
      'div',
      { class: 'permission-grid' },
      ui.el(
        'div',
        { class: 'permission-card' },
        ui.el('h4', { text: 'Owner / Manager · Aina' }),
        ui.el('p', { text: 'Full control of the order desk.' }),
        ui.el(
          'ul',
          {},
          ui.el('li', { text: 'View, import, scan and export' }),
          ui.el('li', { text: 'Approve or reject orders' }),
          ui.el('li', { text: 'Edit extracted details and reset the demo' }),
          ui.el('li', { text: 'Mark purchase drafts as received' }),
        ),
      ),
      ui.el(
        'div',
        { class: 'permission-card' },
        ui.el('h4', { text: 'Staff / Reviewer · Daniel' }),
        ui.el('p', { text: 'Can keep the inbox moving, but cannot commit stock.' }),
        ui.el(
          'ul',
          {},
          ui.el('li', { text: 'View orders, stock and the audit log' }),
          ui.el('li', { text: 'Import and scan messages' }),
          ui.el('li', { text: 'Request more information from the customer' }),
          ui.el('li', { text: 'Cannot approve, reject, edit or reset' }),
        ),
      ),
    ),
    ui.el('div', {
      class: 'form-hint',
      style: { marginTop: '9px' },
      text: 'The server enforces these permissions too. Clicking Approve as Staff returns a 403, not just a hidden button.',
    }),
  );

  const orbyteCard = settingsCard(
    {
      title: 'Orbyte integration',
      subtitle: 'A mock adapter keeps the integration seam explicit.',
      iconName: 'box',
    },
    row('Adapter mode', orbyte?.mode || 'mock'),
    ui.el(
      'div',
      { class: 'stack gap-4', style: { marginTop: '8px' } },
      ui.el('div', { class: 'section-title', text: 'Read methods' }),
      ui.el(
        'div',
        { class: 'flag-row', style: { maxWidth: 'none' } },
        ...(orbyte?.read || []).map((method) => ui.el('span', { class: 'chip chip-info', text: method })),
      ),
      ui.el('div', { class: 'section-title', text: 'Write methods' }),
      ui.el(
        'div',
        { class: 'flag-row', style: { maxWidth: 'none' } },
        ...(orbyte?.write || []).map((method) => ui.el('span', { class: 'chip chip-warning', text: method })),
      ),
    ),
    ui.el('div', {
      class: 'form-hint',
      style: { marginTop: '9px' },
      text: orbyte?.note || 'Mock adapter backed by synthetic JSON data.',
    }),
    ui.el('div', {
      class: 'form-hint',
      style: { marginTop: '6px' },
      text: 'The rest of OrderPilot only depends on this interface, so a real Orbyte Connect adapter can replace it without touching the order desk.',
    }),
  );

  const privacyCard = settingsCard(
    {
      title: 'Data, privacy & boundaries',
      subtitle: 'Built for a safe, synthetic demo.',
      iconName: 'lock',
    },
    ui.el(
      'ul',
      { style: { margin: '0', paddingLeft: '17px', fontSize: '11px', lineHeight: '1.65', color: 'var(--ink-2)' } },
      ui.el('li', { text: 'Every customer, order, product, supplier and address is synthetic. No real personal or company data is used.' }),
      ui.el('li', { text: 'No real payments, statutory filings or supplier purchase orders. Purchase drafts are internal reminders only.' }),
      ui.el('li', { text: 'PDPA principles in a real deployment: purpose limitation, minimum data, retention limits, role-based access and an audit trail.' }),
      ui.el('li', { text: 'API keys live in Replit Secrets or a gitignored .env file, never in GitHub or the browser.' }),
      ui.el('li', { text: 'The demo reset is a manager action and is recorded in the activity log.' }),
    ),
  );

  const resetButton = ui.el(
    'button',
    {
      class: 'btn btn-danger',
      type: 'button',
      onClick: () => actions.resetDemo(),
      disabled: !owner,
      title: owner ? 'Reset the demo data' : 'Owner only',
    },
    icon('reset', 14),
    'Reset demo data',
  );

  const demoCard = settingsCard(
    {
      title: 'Demo controls',
      subtitle: 'Restore the starting state if a live demo goes sideways.',
      iconName: 'reset',
      span: true,
      className: 'danger-zone',
    },
    ui.el(
      'div',
      { class: 'row between wrap', style: { gap: '10px' } },
      ui.el('div', {
        class: 'form-hint',
        style: { maxWidth: '580px' },
        text: 'Reset restores the 6 seeded orders and 12 pending messages. It clears approvals, purchase drafts and activity entries created during the demo. It does not change your AI key.',
      }),
      resetButton,
    ),
    !owner ? ui.el('div', { class: 'form-hint', style: { marginTop: '6px' }, text: 'Switch to the Owner/Manager role to reset the demo.' }) : null,
  );

  const aboutCard = settingsCard(
    {
      title: 'About OrderPilot',
      subtitle: 'SDC Hackathon 2026 · Domain 2 · Orbyte Smart SME Challenge',
      iconName: 'info',
      span: true,
    },
    ui.el(
      'div',
      { class: 'about-list' },
      ui.el('div', {}, ui.el('strong', { text: 'Version ' }), '1.0.0 · Apache License 2.0'),
      ui.el('div', {}, ui.el('strong', { text: 'Stack: ' }), 'Node.js + Express · JSON data store · vanilla HTML/CSS/JS · ExcelJS'),
      ui.el('div', {}, ui.el('strong', { text: 'AI: ' }), 'Provider-agnostic extraction adapter with a deterministic rules fallback'),
      ui.el('div', {}, ui.el('strong', { text: 'Impact: ' }), 'SDG 8.2 / 8.3 — productivity and growth for micro and small businesses'),
      ui.el('div', {}, ui.el('strong', { text: 'Business: ' }), bootstrap.business.name),
      ui.el('div', {
        text: 'All data shown is synthetic. Add your GitHub repository and Replit deployment links in README.md before submission.',
      }),
    ),
  );

  ui.mount(
    root,
    ui.el(
      'div',
      { class: 'settings-grid' },
      aiCard,
      rulesCard,
      impactCard,
      rolesCard,
      orbyteCard,
      privacyCard,
      demoCard,
      aboutCard,
    ),
  );
}
