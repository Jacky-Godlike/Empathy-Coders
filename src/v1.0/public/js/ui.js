import { icon } from './icons.js';

/* --------------------------------------------------------------------------
   DOM helpers
   -------------------------------------------------------------------------- */

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) node.append(child);
    else node.append(document.createTextNode(String(child)));
  }
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  const deferredSelectValue = tag === 'select' && attrs && attrs.value !== undefined ? attrs.value : null;

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class' || key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'dataset' && typeof value === 'object') Object.assign(node.dataset, value);
    else if (key === 'on' && typeof value === 'object') {
      for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'disabled' || key === 'checked' || key === 'selected' || key === 'hidden') {
      node[key] = Boolean(value);
    } else if (key === 'value') {
      node.value = value;
    } else {
      node.setAttribute(key, String(value));
    }
  }

  appendChildren(node, children);
  if (deferredSelectValue !== null) node.value = deferredSelectValue;
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(node, ...children) {
  clear(node);
  appendChildren(node, children);
  return node;
}

/* --------------------------------------------------------------------------
   Formatting
   -------------------------------------------------------------------------- */

export function money(value) {
  const number = Number(value) || 0;
  return `RM ${number.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function num(value) {
  return (Number(value) || 0).toLocaleString('en-MY');
}

export function pct(value, digits = 1) {
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toFixed(digits) : '0.0'}%`;
}

export function date(iso, { long = false } = {}) {
  if (!iso) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!match) return '—';
  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const options = {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  };
  if (long) options.year = 'numeric';
  return new Intl.DateTimeFormat('en-MY', options).format(value);
}

export function dateTime(iso) {
  if (!iso) return '—';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(value);
}

export function relative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 45_000) return 'just now';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return dateTime(iso);
}

export function daysLabel(days) {
  if (days === null || days === undefined || !Number.isFinite(Number(days))) return 'No date';
  const value = Number(days);
  if (value < 0) return `${Math.abs(value)} day${Math.abs(value) === 1 ? '' : 's'} late`;
  if (value === 0) return 'Due today';
  if (value === 1) return 'Due tomorrow';
  return `in ${value} days`;
}

export function initials(name) {
  const text = String(name || '').trim();
  if (!text) return '?';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function titleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function shortText(value, max = 90) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function modeLabel(mode) {
  if (mode === 'ai') return 'AI';
  if (mode === 'mixed') return 'Mixed';
  if (mode === 'rules' || mode === 'rules-fallback') return 'Rules';
  return mode || '—';
}

export function channelLabel(channel) {
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'email') return 'Email';
  if (channel === 'manual') return 'Manual';
  return titleCase(channel || 'Message');
}

export function channelIcon(channel, size = 11) {
  const name = channel === 'email' ? 'mail' : channel === 'whatsapp' ? 'message' : 'edit';
  return el('span', { class: `channel-ico ${channel || 'manual'}`, title: channelLabel(channel) }, icon(name, size));
}

/* --------------------------------------------------------------------------
   Badges & chips
   -------------------------------------------------------------------------- */

const STATUS_META = {
  draft: { label: 'Awaiting approval', tone: 'neutral' },
  needs_info: { label: 'Info requested', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  superseded: { label: 'Superseded', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  new: { label: 'Pending', tone: 'accent' },
  processed: { label: 'Processed', tone: 'success' },
  filtered: { label: 'Filtered', tone: 'neutral' },
  error: { label: 'Error', tone: 'danger' },
};

export function statusMeta(status) {
  return STATUS_META[status] || { label: titleCase(status || 'Unknown'), tone: 'neutral' };
}

export function statusBadge(status) {
  const meta = statusMeta(status);
  return el('span', { class: `badge badge-${meta.tone}` }, el('span', { class: 'dot' }), meta.label);
}

export function recommendationBadge(recommendationOrCode, labelOverride = null) {
  const code = typeof recommendationOrCode === 'string' ? recommendationOrCode : recommendationOrCode?.code;
  const severity =
    (typeof recommendationOrCode === 'object' && recommendationOrCode?.severity) || 'neutral';
  const label =
    labelOverride ||
    (typeof recommendationOrCode === 'object' && (recommendationOrCode?.shortLabel || recommendationOrCode?.label)) ||
    code ||
    'Unknown';
  return el('span', { class: `badge badge-${severity}` }, el('span', { class: 'dot' }), label);
}

export function modeBadge(mode) {
  const tone = mode === 'ai' ? 'info' : mode === 'mixed' ? 'warning' : 'neutral';
  return el('span', { class: `badge badge-${tone}` }, icon(mode === 'ai' ? 'sparkles' : 'shield', 10), modeLabel(mode));
}

export function flagChip(flag) {
  const tone = ['warning', 'danger', 'info', 'success'].includes(flag.tone) ? flag.tone : 'neutral';
  return el('span', { class: `chip chip-${tone}`, title: flag.key }, flag.label);
}

export function categoryBadge(category) {
  const meta = {
    order: { label: 'Order', tone: 'success' },
    order_update: { label: 'Order update', tone: 'info' },
    inquiry: { label: 'Inquiry', tone: 'warning' },
    advertisement: { label: 'Ad', tone: 'neutral' },
    supplier: { label: 'Supplier', tone: 'neutral' },
    payment: { label: 'Payment', tone: 'neutral' },
    spam: { label: 'Spam', tone: 'danger' },
    other: { label: 'Other', tone: 'neutral' },
  }[category] || { label: titleCase(category || 'Other'), tone: 'neutral' };
  return el('span', { class: `chip chip-${meta.tone}` }, meta.label);
}

/* --------------------------------------------------------------------------
   Toasts
   -------------------------------------------------------------------------- */

function removeToast(node) {
  if (!node || !node.parentNode) return;
  node.style.transition = 'opacity .15s ease, transform .15s ease';
  node.style.opacity = '0';
  node.style.transform = 'translateY(6px)';
  setTimeout(() => node.remove(), 160);
}

export function toast({ title, text = '', tone = 'info', timeout = 5200 }) {
  const root = document.getElementById('toast-root');
  if (!root) return null;
  while (root.children.length >= 4) root.firstElementChild?.remove();

  const iconName = tone === 'success' ? 'check' : tone === 'danger' ? 'alert' : tone === 'warning' ? 'alert' : 'info';
  const node = el(
    'div',
    { class: `toast ${tone}`, role: 'status' },
    el('span', { class: 'toast-icon' }, icon(iconName, 16)),
    el(
      'div',
      { class: 'toast-body' },
      el('div', { class: 'toast-title', text: title }),
      text ? el('div', { class: 'toast-text', text }) : null,
    ),
    el(
      'button',
      { class: 'toast-close', type: 'button', 'aria-label': 'Dismiss notification', onClick: () => removeToast(node) },
      icon('x', 13),
    ),
  );
  root.append(node);
  if (timeout > 0) setTimeout(() => removeToast(node), timeout);
  return node;
}

toast.success = (title, text = '') => toast({ title, text, tone: 'success' });
toast.warning = (title, text = '') => toast({ title, text, tone: 'warning' });
toast.danger = (title, text = '') => toast({ title, text, tone: 'danger' });
toast.info = (title, text = '') => toast({ title, text, tone: 'info' });

/* --------------------------------------------------------------------------
   Focus & modal helpers
   -------------------------------------------------------------------------- */

export function getFocusable(container) {
  return [
    ...container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => element.offsetParent !== null || element === document.activeElement);
}

export function trapFocus(container) {
  const onKeydown = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = getFocusable(container);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}

export function openModal({
  title,
  subtitle = null,
  body = null,
  footer = null,
  wide = false,
  onClose = null,
}) {
  const root = document.getElementById('modal-root');
  const previousFocus = document.activeElement;
  let closed = false;
  let cleanupTrap = () => {};

  const backdrop = el('div', { class: 'modal-backdrop' });
  const modal = el('div', {
    class: `modal${wide ? ' wide' : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title,
  });

  const close = () => {
    if (closed) return;
    closed = true;
    cleanupTrap();
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    if (onClose) onClose();
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const closeButton = el(
    'button',
    { class: 'modal-close', type: 'button', 'aria-label': 'Close dialog', onClick: close },
    icon('x', 15),
  );

  const modalBody = el('div', { class: 'modal-body' });
  if (body instanceof Node) modalBody.append(body);
  else if (typeof body === 'string') modalBody.append(el('div', { class: 'confirm-text', text: body }));

  const header = el(
    'div',
    { class: 'modal-header' },
    el(
      'div',
      {},
      el('div', { class: 'modal-title', text: title }),
      subtitle ? el('div', { class: 'modal-sub', text: subtitle }) : null,
    ),
    closeButton,
  );

  modal.append(header, modalBody);
  if (footer) {
    const footerNode = footer instanceof Node ? footer : el('div', { class: 'modal-footer' }, footer);
    modal.append(footerNode);
  }
  backdrop.append(modal);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeydown);
  root.append(backdrop);
  cleanupTrap = trapFocus(modal);
  setTimeout(() => {
    const first = getFocusable(modal)[0];
    if (first) first.focus();
  }, 30);

  return { backdrop, modal, body: modalBody, close };
}

export async function confirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  requireText = null,
}) {
  return new Promise((resolve) => {
    let settled = false;
    let controller;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      controller?.close();
      resolve(value);
    };

    const iconTone = tone === 'danger' ? 'danger' : tone === 'warning' ? '' : 'success';
    const body = el(
      'div',
      {},
      el('div', { class: `confirm-icon ${iconTone}` }, icon(tone === 'danger' ? 'alert' : 'info', 21)),
      message instanceof Node ? message : el('div', { class: 'confirm-text', text: message }),
    );

    let input = null;
    let confirmButton;
    if (requireText) {
      input = el('input', {
        class: 'input',
        type: 'text',
        placeholder: `Type ${requireText} to confirm`,
        autocomplete: 'off',
        'aria-label': `Type ${requireText} to confirm`,
        onInput: () => {
          confirmButton.disabled = input.value.trim() !== requireText;
        },
      });
      body.append(
        el(
          'div',
          { class: 'field', style: { marginTop: '12px' } },
          el('label', { class: 'label', text: `Type ${requireText} to confirm` }),
          input,
        ),
      );
    }

    const cancelButton = el(
      'button',
      { class: 'btn btn-ghost', type: 'button', onClick: () => finish(false) },
      cancelLabel,
    );
    confirmButton = el(
      'button',
      {
        class: `btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`,
        type: 'button',
        disabled: Boolean(requireText),
        onClick: () => finish(true),
      },
      confirmLabel,
    );

    controller = openModal({
      title,
      body,
      footer: el('div', { class: 'modal-footer' }, el('div', { class: 'spacer' }), cancelButton, confirmButton),
      onClose: () => finish(false),
    });
  });
}

/* --------------------------------------------------------------------------
   Misc
   -------------------------------------------------------------------------- */

export function setBusy(button, busy, label = 'Working…') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

export async function copy(text, successMessage = 'Copied to clipboard') {
  const value = String(text ?? '');
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const area = el('textarea', {
        style: { position: 'fixed', left: '-9999px', top: '0', opacity: '0' },
      });
      area.value = value;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast.success(successMessage);
    return true;
  } catch {
    toast.danger('Could not copy', 'Your browser blocked clipboard access. Select the text and copy manually.');
    return false;
  }
}

export function emptyState({ iconName = 'inbox', title, text, action = null }) {
  return el(
    'div',
    { class: 'empty-state' },
    el('div', { class: 'empty-icon' }, icon(iconName, 23)),
    el('div', { class: 'empty-title', text: title }),
    text ? el('div', { class: 'empty-text', text }) : null,
    action ? el('div', { style: { marginTop: '14px' } }, action) : null,
  );
}

export function download(url) {
  const link = el('a', { href: url, rel: 'noopener' });
  document.body.append(link);
  link.click();
  link.remove();
}

export function debounce(fn, wait = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function isOwner(actor) {
  return actor?.role === 'owner';
}

export function actionMeta(action) {
  const map = {
    'order.created': { label: 'Order created', tone: 'info' },
    'order.updated': { label: 'Order updated', tone: 'info' },
    'order.approved': { label: 'Order approved', tone: 'success' },
    'order.rejected': { label: 'Order rejected', tone: 'danger' },
    'order.info_requested': { label: 'Info requested', tone: 'warning' },
    'order.edited': { label: 'Order edited', tone: 'info' },
    'order.cancelled': { label: 'Order cancelled', tone: 'neutral' },
    'order.superseded': { label: 'Order superseded', tone: 'neutral' },
    'stock.reserved': { label: 'Stock reserved', tone: 'info' },
    'stock.released': { label: 'Stock released', tone: 'neutral' },
    'purchase_draft.created': { label: 'Purchase draft created', tone: 'info' },
    'purchase_draft.received': { label: 'Stock received', tone: 'success' },
    'message.imported': { label: 'Message imported', tone: 'neutral' },
    'triage.started': { label: 'Scan started', tone: 'info' },
    'triage.completed': { label: 'Inbox scanned', tone: 'success' },
    'triage.error': { label: 'Triage error', tone: 'danger' },
    'ai.fallback': { label: 'AI fallback', tone: 'warning' },
    'export.generated': { label: 'Export generated', tone: 'neutral' },
    'demo.reset': { label: 'Demo reset', tone: 'warning' },
  };
  return map[action] || { label: titleCase(action || 'Activity'), tone: 'neutral' };
}

export function elapsed(ms) {
  if (!Number.isFinite(Number(ms))) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}
