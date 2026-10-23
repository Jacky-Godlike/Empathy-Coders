import { icon } from '../icons.js';
import * as ui from '../ui.js';

const STEPS = [
  'Reading the inbox',
  'Classifying each message',
  'Matching products and units',
  'Checking stock, cost and lead time',
  'Building the order desk',
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function openScanOverlay({ pendingCount = 0, run }) {
  return new Promise((resolve) => {
    const root = document.getElementById('scan-root');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let settled = false;
    let canClose = false;
    let result = null;
    let error = null;
    let viewDesk = false;
    let stepIndex = 0;
    let stepTimer = null;
    let slowTimer = null;
    let cleanupTrap = () => {};

    const overlay = ui.el('div', {
      class: 'scan-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Scanning the order inbox',
    });
    const panel = ui.el('div', { class: 'scan-panel' });
    const closeButton = ui.el(
      'button',
      {
        class: 'scan-close hide',
        type: 'button',
        'aria-label': 'Close scan results',
        onClick: () => finish(false),
      },
      icon('x', 15),
    );

    const radar = ui.el('div', { class: 'scan-radar', 'aria-hidden': 'true' });
    const kicker = ui.el('div', { class: 'scan-kicker-light', text: 'Inbox triage' });
    const title = ui.el('div', { class: 'scan-title', text: 'Reading your inbox' });
    const subtitle = ui.el('div', { class: 'scan-sub' });
    const steps = ui.el('div', { class: 'scan-steps' });
    const stepNodes = STEPS.map((label) => {
      const node = ui.el(
        'div',
        { class: 'scan-step' },
        ui.el('span', { class: 'scan-step-dot' }, icon('check', 9)),
        ui.el('span', { text: label }),
      );
      steps.append(node);
      return node;
    });
    const resultArea = ui.el('div', { class: 'scan-result hide' });

    subtitle.textContent =
      pendingCount > 0
        ? `${pendingCount} message${pendingCount === 1 ? '' : 's'} are waiting. OrderPilot reads each one, extracts the fields, merges updates and quietly filters non-orders.`
        : 'There are no pending messages. Add a message from the Inbox, then scan again.';

    panel.append(closeButton, radar, kicker, title, subtitle, steps, resultArea);
    overlay.append(panel);
    root.append(overlay);
    cleanupTrap = ui.trapFocus(panel);

    function markStep(index) {
      stepNodes.forEach((node, nodeIndex) => {
        node.classList.toggle('active', nodeIndex === index);
        node.classList.toggle('done', nodeIndex < index);
        if (nodeIndex < index) node.querySelector('.scan-step-dot').replaceChildren(icon('check', 9));
      });
    }

    function startAnimation() {
      markStep(0);
      stepTimer = setInterval(() => {
        if (stepIndex < STEPS.length - 1) {
          stepIndex += 1;
          markStep(stepIndex);
        }
      }, 500);
      slowTimer = setTimeout(() => {
        if (!result && !error) {
          subtitle.textContent =
            'Still reading the inbox — a live AI model can take a few seconds. The rules engine is ready as a fallback.';
        }
      }, 5200);
    }

    function stopAnimation() {
      clearInterval(stepTimer);
      clearTimeout(slowTimer);
      stepTimer = null;
      slowTimer = null;
      stepNodes.forEach((node) => {
        node.classList.add('done');
        node.classList.remove('active');
      });
      panel.classList.add('done');
    }

    function finish(goToDesk) {
      if (settled) return;
      if (!canClose && !goToDesk) return;
      settled = true;
      viewDesk = Boolean(goToDesk);
      cleanupTrap();
      document.removeEventListener('keydown', onKeydown);
      clearInterval(stepTimer);
      clearTimeout(slowTimer);
      document.body.style.overflow = previousOverflow;
      overlay.remove();
      resolve({ result, error, viewDesk });
    }

    function onKeydown(event) {
      if (event.key === 'Escape' && canClose) {
        event.preventDefault();
        finish(false);
      }
    }
    document.addEventListener('keydown', onKeydown);

    function showError(message) {
      error = { message };
      canClose = true;
      closeButton.classList.remove('hide');
      title.textContent = 'The scan did not finish';
      subtitle.textContent = 'No orders were changed. You can retry with the deterministic rules fallback.';
      resultArea.classList.remove('hide');
      ui.mount(
        resultArea,
        ui.el('div', { class: 'scan-error', text: message }),
        ui.el(
          'div',
          { class: 'scan-actions' },
          ui.el(
            'button',
            {
              class: 'btn btn-accent',
              type: 'button',
              onClick: async (event) => {
                const button = event.currentTarget;
                ui.setBusy(button, true, 'Running rules fallback…');
                try {
                  const fallbackResult = await run('rules');
                  result = fallbackResult;
                  error = null;
                  showResult();
                } catch (fallbackError) {
                  ui.setBusy(button, false);
                  showError(fallbackError.message || 'The rules fallback also failed.');
                }
              },
            },
            icon('shield', 15),
            'Run rules fallback',
          ),
          ui.el(
            'button',
            { class: 'btn btn-ghost', type: 'button', onClick: () => finish(false) },
            'Close',
          ),
        ),
      );
      setTimeout(() => resultArea.querySelector('button')?.focus(), 30);
    }

    function showResult() {
      canClose = true;
      closeButton.classList.remove('hide');
      title.textContent =
        result.ordersCreated + result.ordersUpdated > 0 ? 'Order desk updated' : 'Inbox scanned';
      subtitle.textContent =
        result.ordersCreated + result.ordersUpdated > 0
          ? 'The tidy order table is ready. Nothing has been approved yet — every order still needs a human decision.'
          : 'Everything in this batch was filtered as a non-order. No order was created.';
      resultArea.classList.remove('hide');

      const orderCount = (result.ordersCreated || 0) + (result.ordersUpdated || 0);
      const mode = result.modeUsed || (result.provider ? 'ai' : 'rules');
      const modeText =
        mode === 'ai'
          ? `AI${result.provider ? ` · ${result.provider}` : ''}`
          : mode === 'mixed'
            ? 'Mixed AI + rules'
            : 'Rules fallback';

      const metrics = ui.el(
        'div',
        { class: 'scan-metrics' },
        ui.el(
          'div',
          { class: 'scan-metric' },
          ui.el('div', { class: 'value', text: String(result.scanned ?? 0) }),
          ui.el('div', { class: 'label', text: 'messages scanned' }),
        ),
        ui.el(
          'div',
          { class: 'scan-metric' },
          ui.el('div', { class: 'value', text: String(orderCount) }),
          ui.el('div', { class: 'label', text: 'orders on the desk' }),
        ),
        ui.el(
          'div',
          { class: 'scan-metric' },
          ui.el('div', { class: 'value', text: String(result.filtered ?? 0) }),
          ui.el('div', { class: 'label', text: 'non-orders filtered' }),
        ),
      );

      const notes = [];
      if (result.changeRequests) notes.push(`${result.changeRequests} change request${result.changeRequests === 1 ? '' : 's'}`);
      if (result.errors) notes.push(`${result.errors} message${result.errors === 1 ? '' : 's'} could not be processed`);
      if (result.fallbackReason) notes.push(`AI fallback: ${result.fallbackReason}`);

      ui.mount(
        resultArea,
        ui.el('div', { class: 'scan-result-title', text: 'Here is what changed' }),
        metrics,
        ui.el(
          'div',
          { class: 'scan-actions', style: { marginTop: '10px', gap: '6px' } },
          ui.modeBadge(mode),
          ui.el('span', { class: 'pill', text: `${modeText} · ${ui.elapsed(result.latencyMs)}` }),
          result.aiLatencyMs
            ? ui.el('span', { class: 'pill', text: `AI ${ui.elapsed(result.aiLatencyMs)}` })
            : null,
        ),
        notes.length > 0
          ? ui.el('div', {
              class: result.fallbackReason || result.errors ? 'scan-error' : 'form-hint',
              style: { marginTop: '10px' },
              text: notes.join(' · '),
            })
          : null,
        ui.el(
          'div',
          { class: 'scan-actions' },
          ui.el(
            'button',
            {
              class: 'btn btn-primary',
              type: 'button',
              onClick: () => finish(true),
            },
            'View order desk',
            icon('arrowRight', 15),
          ),
          ui.el(
            'button',
            { class: 'btn btn-ghost', type: 'button', onClick: () => finish(false) },
            'Close',
          ),
        ),
      );
      setTimeout(() => resultArea.querySelector('.btn-primary')?.focus(), 30);
    }

    if (pendingCount === 0) {
      canClose = true;
      closeButton.classList.remove('hide');
      steps.classList.add('hide');
      panel.classList.add('done');
      title.textContent = 'Nothing waiting';
      subtitle.textContent = 'There are no pending messages. Add one from the Inbox or reset the demo.';
      resultArea.classList.remove('hide');
      ui.mount(
        resultArea,
        ui.el(
          'div',
          { class: 'scan-actions' },
          ui.el('button', { class: 'btn btn-primary', type: 'button', onClick: () => finish(false) }, 'Close'),
        ),
      );
      setTimeout(() => resultArea.querySelector('button')?.focus(), 30);
      return;
    }

    startAnimation();
    Promise.all([run('auto'), delay(2200)])
      .then(([scanResult]) => {
        result = scanResult;
        error = null;
        stopAnimation();
        showResult();
      })
      .catch((scanError) => {
        stopAnimation();
        showError(scanError?.message || 'The scan failed. Please try again.');
      });
  });
}
