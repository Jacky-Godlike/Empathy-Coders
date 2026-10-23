import { icon } from '../icons.js';
import * as ui from '../ui.js';

function orderCodeFor(message) {
  if (message.orderCode) return message.orderCode;
  if (!message.orderId) return null;
  return message.orderId.replace(/^ord_/, '').toUpperCase();
}

function categoryLabel(category) {
  const labels = {
    order: 'order',
    order_update: 'order update',
    inquiry: 'inquiry',
    advertisement: 'advertisement',
    supplier: 'supplier message',
    payment: 'payment message',
    spam: 'spam',
    other: 'other',
  };
  return labels[category] || category || 'non-order';
}

async function scanOne(message, button, ctx) {
  ui.setBusy(button, true, 'Scanning…');
  try {
    const result = await ctx.api.triageMessage(message.id, 'auto');
    const mode = result.modeUsed || 'rules';
    await ctx.actions.afterMutation({
      title: 'Message scanned',
      text: `1 message processed in ${ui.elapsed(result.latencyMs)} · ${mode === 'ai' ? 'AI' : 'rules'}.`,
      tone: 'success',
    });
  } catch (error) {
    ui.setBusy(button, false);
    ui.toast.danger('Could not scan message', error.message);
  }
}

function messageCard(message, ctx) {
  const { actions } = ctx;
  const analysis = message.analysis || null;
  const code = orderCodeFor(message);
  const bodyText = message.body || '';
  const canExpand = bodyText.length > 170;
  const body = ui.el('div', { class: 'message-body', text: bodyText });
  let expandButton = null;
  if (canExpand) {
    expandButton = ui.el(
      'button',
      {
        class: 'btn-link',
        type: 'button',
        onClick: () => {
          const expanded = body.classList.toggle('expanded');
          expandButton.textContent = expanded ? 'Show less' : 'Show more';
        },
      },
      'Show more',
    );
  }

  const left = ui.el('div', { class: 'message-foot-left' });
  if (message.status === 'processed' && code) {
    left.append(
      ui.el(
        'button',
        {
          class: 'btn-link',
          type: 'button',
          onClick: () => actions.openOrder(message.orderId),
        },
        `Open ${code}`,
        icon('arrowRight', 11),
      ),
    );
  } else if (message.status === 'filtered') {
    left.append(
      ui.el('span', {
        class: 'chip chip-neutral',
        text: `Not an order · ${categoryLabel(analysis?.category)}`,
      }),
    );
  } else if (message.status === 'error') {
    left.append(ui.el('span', { class: 'chip chip-danger', text: 'Processing error' }));
  } else if (message.status === 'new') {
    left.append(
      ui.el('span', {
        class: 'chip chip-warning',
        text: `${analysis ? 'Needs attention' : 'Waiting for triage'}`,
      }),
    );
  }

  const right = ui.el('div', { class: 'row gap-4' });
  if (message.status === 'new') {
    right.append(
      ui.el(
        'button',
        {
          class: 'btn btn-soft btn-sm',
          type: 'button',
          onClick: (event) => scanOne(message, event.currentTarget, ctx),
        },
        icon('sparkles', 12),
        'Scan',
      ),
    );
  }
  if (expandButton) right.append(expandButton);

  const tags = ui.el(
    'div',
    { class: 'message-tags' },
    ui.statusBadge(message.status),
    analysis?.category ? ui.categoryBadge(analysis.category) : null,
    analysis?.mode ? ui.modeBadge(analysis.mode) : null,
    analysis?.confidence !== undefined && analysis?.confidence !== null
      ? ui.el('span', { class: 'chip', text: `${Math.round(Number(analysis.confidence) * 100)}% confidence` })
      : null,
    analysis?.missingFields?.length
      ? ui.el('span', { class: 'chip chip-warning', text: `${analysis.missingFields.length} missing` })
      : null,
  );

  return ui.el(
    'article',
    { class: `message-card status-${message.status}` },
    ui.el(
      'div',
      { class: 'message-top' },
      ui.channelIcon(message.channel, 12),
      ui.el(
        'div',
        { class: 'message-who' },
        ui.el('div', { class: 'message-from' }, message.fromName || message.from || 'Unknown sender'),
        ui.el('div', {
          class: 'message-subject',
          text: message.subject || message.from || 'No subject',
        }),
      ),
      ui.el('div', { class: 'message-time', text: ui.relative(message.receivedAt), title: ui.dateTime(message.receivedAt) }),
    ),
    tags,
    body,
    analysis?.reasoning ? ui.el('div', { class: 'form-hint', style: { marginTop: '5px' }, text: analysis.reasoning }) : null,
    ui.el('div', { class: 'message-foot' }, left, right),
  );
}

function resultPanel(result, ctx, host) {
  if (!result) return null;
  const { messageResult, triage } = result;
  const status = messageResult?.status;
  const tone =
    status === 'created' || status === 'updated' || status === 'change_request'
      ? 'success'
      : status === 'filtered'
        ? 'info'
        : 'danger';
  const title =
    status === 'created'
      ? `Order ${messageResult.orderCode || ''} created`
      : status === 'change_request'
        ? `Change request ${messageResult.orderCode || ''} created`
        : status === 'updated'
          ? `Added to ${messageResult.orderCode || 'the existing order'}`
          : status === 'filtered'
            ? `Filtered as ${categoryLabel(messageResult?.category)}`
            : 'Could not analyze this message';
  const mode = triage?.modeUsed || 'rules';
  const detail =
    status === 'filtered'
      ? 'No order was created. Advertisements, inquiries and supplier notes stay out of the order desk.'
      : status === 'created' || status === 'updated' || status === 'change_request'
        ? 'The order is now in the Order Desk, still waiting for a human decision.'
        : messageResult?.error || 'Please check the message and try again.';

  return ui.el(
    'div',
    { class: `result-panel ${tone === 'success' ? '' : tone}` },
    ui.el('div', { class: 'result-title', text: title }),
    ui.el('div', { text: detail }),
    ui.el(
      'div',
      { class: 'row wrap', style: { marginTop: '7px', gap: '5px' } },
      ui.modeBadge(mode),
      triage ? ui.el('span', { class: 'pill', text: `${triage.scanned ?? 1} message · ${ui.elapsed(triage.latencyMs)}` }) : null,
      messageResult?.orderId
        ? ui.el(
            'button',
            {
              class: 'btn btn-primary btn-sm',
              type: 'button',
              style: { marginLeft: 'auto' },
              onClick: () => ctx.actions.openOrder(messageResult.orderId),
            },
            `Open ${messageResult.orderCode || 'order'}`,
            icon('arrowRight', 12),
          )
        : null,
      ui.el(
        'button',
        {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          onClick: () => {
            ctx.state.lastImportResult = null;
            host.remove();
          },
        },
        icon('x', 12),
        'Dismiss',
      ),
    ),
  );
}

export async function renderInbox(root, ctx) {
  const { api, state, actions } = ctx;
  const [messagesResponse, stats] = await Promise.all([api.messages('all', 200), api.stats()]);
  const messages = messagesResponse.messages || [];
  const pending = messages.filter((message) => message.status === 'new');
  const ai = state.bootstrap.ai;
  let feedFilter = state.filters.inbox || 'all';

  const scanCard = ui.el(
    'div',
    { class: 'scan-card' },
    ui.el('div', { class: 'scan-kicker', text: 'Inbox triage' }),
    ui.el(
      'div',
      { class: 'scan-count' },
      String(pending.length),
      ui.el('span', { class: 'unit', text: ' waiting' }),
    ),
    ui.el('div', {
      class: 'scan-copy',
      text: 'AI reads each message, extracts the order fields, merges follow-up messages and quietly filters ads, inquiries and supplier notes.',
    }),
    ui.el(
      'div',
      { class: 'scan-actions' },
      ui.el(
        'button',
        { class: 'btn btn-accent', type: 'button', onClick: () => actions.scanInbox() },
        icon('sparkles', 15),
        pending.length ? `Scan inbox (${pending.length})` : 'Scan inbox',
      ),
      ui.el(
        'button',
        {
          class: 'btn btn-ghost',
          type: 'button',
          style: { color: '#e8e2d3', borderColor: 'rgba(255,255,255,.22)' },
          onClick: () => {
            feedFilter = 'filtered';
            state.filters.inbox = feedFilter;
            renderFeed();
            document.querySelector('.message-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
        },
        icon('filter', 13),
        'Show filtered',
      ),
    ),
    ui.el(
      'div',
      { class: 'scan-meta' },
      ui.modeBadge(ai.configured ? 'ai' : 'rules'),
      ' ',
      stats.lastTriage
        ? `Last scan ${ui.relative(stats.lastTriage.at)} · ${ui.shortText(stats.lastTriage.summary, 54)}`
        : 'Demo inbox loaded',
    ),
    ui.el(
      'div',
      { class: 'scan-pipeline' },
      ...[
        'Read every message',
        'Classify order vs non-order',
        'Extract fields & merge follow-ups',
        'Check stock, cost & lead time',
      ].map((label, index) =>
        ui.el(
          'div',
          { class: 'scan-pipeline-step' },
          ui.el('span', { class: 'scan-pipeline-num', text: String(index + 1) }),
          ui.el('span', { text: label }),
        ),
      ),
    ),
    ui.el('div', {
      class: 'scan-footnote',
      text: 'Non-orders never reach the order desk. Nothing is approved automatically.',
    }),
  );

  const channelSelect = ui.el(
    'select',
    { class: 'select', 'aria-label': 'Message channel' },
    ui.el('option', { value: 'whatsapp', text: 'WhatsApp' }),
    ui.el('option', { value: 'email', text: 'Email' }),
    ui.el('option', { value: 'manual', text: 'Manual entry' }),
  );
  const fromInput = ui.el('input', {
    class: 'input',
    placeholder: 'Phone, email or customer name',
    'aria-label': 'Customer phone, email or name',
  });
  const subjectInput = ui.el('input', {
    class: 'input',
    placeholder: 'Only for email, e.g. Weekly order',
    'aria-label': 'Email subject',
  });
  const bodyInput = ui.el('textarea', {
    class: 'textarea tall',
    placeholder:
      'Paste a WhatsApp message or email here…\n\nExample: Hi kak, nak order 20 boxes Arabica coffee beans. Deliver this Friday. Address: 12, Jalan SS2/24, 47300 Petaling Jaya. 012-345 6789',
    'aria-label': 'Message body',
  });
  const fileLabel = ui.el('span', { text: 'Upload .txt or .eml (optional)' });
  const fileInput = ui.el('input', {
    type: 'file',
    accept: '.txt,.eml,.csv,text/plain,message/rfc822',
    onChange: async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        bodyInput.value = text;
        fileLabel.textContent = file.name;
        if (file.name.toLowerCase().endsWith('.eml')) channelSelect.value = 'email';
        ui.toast.info('File loaded', `${file.name} is ready to analyze.`);
      } catch (error) {
        ui.toast.danger('Could not read file', error.message);
      }
    },
  });

  const resultHost = ui.el('div');
  const lastResult = resultPanel(state.lastImportResult, ctx, resultHost);
  if (lastResult) resultHost.append(lastResult);

  const analyzeButton = ui.el(
    'button',
    {
      class: 'btn btn-primary',
      type: 'button',
      onClick: async () => {
        const body = bodyInput.value.trim();
        const from = fromInput.value.trim();
        if (body.length < 3) {
          ui.toast.warning('Add a message first', 'Paste or upload a WhatsApp or email message.');
          bodyInput.focus();
          return;
        }
        if (!from) {
          ui.toast.warning('Add a sender', 'A phone, email or customer name helps match the order to a customer.');
          fromInput.focus();
          return;
        }
        ui.setBusy(analyzeButton, true, 'Analyzing…');
        try {
          await actions.analyzeSingleMessage({
            channel: channelSelect.value,
            from,
            fromName: from,
            subject: subjectInput.value.trim() || null,
            body,
            mode: 'auto',
          });
        } catch (error) {
          ui.setBusy(analyzeButton, false);
          ui.toast.danger('Could not analyze message', error.message);
        }
      },
    },
    icon('sparkles', 15),
    'Analyze message',
  );

  const addButton = ui.el(
    'button',
    {
      class: 'btn btn-ghost',
      type: 'button',
      onClick: async () => {
        const body = bodyInput.value.trim();
        const from = fromInput.value.trim();
        if (body.length < 3 || !from) {
          ui.toast.warning('Message and sender required', 'Fill in the sender and the message first.');
          return;
        }
        ui.setBusy(addButton, true, 'Adding…');
        try {
          await actions.importMessage({
            channel: channelSelect.value,
            from,
            fromName: from,
            subject: subjectInput.value.trim() || null,
            body,
          });
        } catch (error) {
          ui.setBusy(addButton, false);
          ui.toast.danger('Could not add message', error.message);
        }
      },
    },
    icon('inbox', 14),
    'Add to inbox',
  );

  const examples = [
    {
      label: 'Order example',
      apply: () => {
        channelSelect.value = 'whatsapp';
        fromInput.value = 'Cafe Baru';
        subjectInput.value = '';
        bodyInput.value =
          'Hi, I would like to order 8 boxes of Arabica coffee beans. Deliver next Friday. Address: 22, Jalan SS15/4, 47500 Subang Jaya. 017-333 2211.';
      },
    },
    {
      label: 'Ad example',
      apply: () => {
        channelSelect.value = 'whatsapp';
        fromInput.value = 'Coffee Deals';
        subjectInput.value = '';
        bodyInput.value =
          'PROMO! 50% off all coffee beans this week only. Click http://bit.ly/demo-deal to claim. Limited time!';
      },
    },
    {
      label: 'Inquiry example',
      apply: () => {
        channelSelect.value = 'email';
        fromInput.value = 'walkin@example.com';
        subjectInput.value = 'Price list enquiry';
        bodyInput.value =
          'Hi, do you supply 16oz paper cups? Please send your price list and minimum order. Thanks.';
      },
    },
  ];

  const pasteCard = ui.el(
    'div',
    { class: 'paste-card' },
    ui.el(
      'div',
      { class: 'paste-head' },
      ui.el(
        'div',
        {},
        ui.el('div', { class: 'paste-title', text: 'Add a message' }),
        ui.el('div', { class: 'paste-sub', text: 'Paste or upload a WhatsApp message, email or manual order.' }),
      ),
      ui.el('span', { class: 'badge badge-neutral' }, icon('shield', 10), 'Synthetic demo'),
    ),
    ui.el(
      'div',
      { class: 'form-grid' },
      ui.el('div', { class: 'field' }, ui.el('label', { class: 'label', text: 'Channel' }), channelSelect),
      ui.el('div', { class: 'field' }, ui.el('label', { class: 'label', text: 'From' }), fromInput),
      ui.el('div', { class: 'field span-2' }, ui.el('label', { class: 'label', text: 'Subject' }), subjectInput),
      ui.el('div', { class: 'field span-2' }, ui.el('label', { class: 'label', text: 'Message' }), bodyInput),
    ),
    ui.el(
      'div',
      { class: 'row between wrap', style: { marginTop: '9px', gap: '8px' } },
      ui.el('label', { class: 'file-drop' }, icon('upload', 15), fileLabel, fileInput),
      ui.el(
        'div',
        { class: 'row gap-4 wrap' },
        ...examples.map((example) =>
          ui.el('button', { class: 'btn btn-soft btn-sm', type: 'button', onClick: example.apply }, example.label),
        ),
      ),
    ),
    ui.el('div', { class: 'row wrap', style: { marginTop: '10px' } }, analyzeButton, addButton),
    resultHost,
  );

  const feedHeader = ui.el('div', { class: 'message-feed-head' });
  const feedList = ui.el('div', { class: 'message-list' });
  const feed = ui.el('div', { class: 'message-feed' }, feedHeader, feedList);

  function filteredMessages() {
    if (feedFilter === 'new') return messages.filter((message) => message.status === 'new');
    if (feedFilter === 'processed') return messages.filter((message) => message.status === 'processed');
    if (feedFilter === 'filtered') return messages.filter((message) => message.status === 'filtered');
    return messages;
  }

  function renderFeedHeader() {
    const counts = {
      all: messages.length,
      new: messages.filter((message) => message.status === 'new').length,
      processed: messages.filter((message) => message.status === 'processed').length,
      filtered: messages.filter((message) => message.status === 'filtered').length,
    };
    const filters = [
      { id: 'all', label: 'All' },
      { id: 'new', label: 'Pending' },
      { id: 'processed', label: 'Orders' },
      { id: 'filtered', label: 'Filtered' },
    ];
    ui.mount(
      feedHeader,
      ui.el(
        'div',
        {},
        ui.el('div', { class: 'card-title', text: 'Inbox' }),
        ui.el('div', { class: 'card-sub', text: `${messages.length} messages · ${pending.length} waiting for triage` }),
      ),
      ui.el(
        'div',
        { class: 'filter-chips' },
        ...filters.map((item) =>
          ui.el(
            'button',
            {
              class: `filter-chip${feedFilter === item.id ? ' active' : ''}`,
              type: 'button',
              'aria-pressed': feedFilter === item.id ? 'true' : 'false',
              onClick: () => {
                feedFilter = item.id;
                state.filters.inbox = feedFilter;
                renderFeedHeader();
                renderFeed();
              },
            },
            item.label,
            ui.el('span', { class: 'count', text: String(counts[item.id]) }),
          ),
        ),
      ),
    );
  }

  function renderFeed() {
    const visible = filteredMessages();
    if (visible.length === 0) {
      ui.mount(
        feedList,
        ui.emptyState({
          iconName: 'inbox',
          title: 'No messages in this view',
          text: feedFilter === 'filtered' ? 'No non-orders have been filtered yet.' : 'Try another filter or add a message above.',
        }),
      );
      return;
    }
    ui.mount(feedList, ...visible.map((message) => messageCard(message, ctx)));
  }

  ui.mount(
    root,
    ui.el(
      'div',
      {},
      ui.el('div', { class: 'inbox-grid' }, scanCard, pasteCard),
      feed,
    ),
  );
  renderFeedHeader();
  renderFeed();
}
