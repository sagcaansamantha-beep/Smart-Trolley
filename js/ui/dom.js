/**
 * dom.js — formatting and markup helpers shared by every view.
 *
 * Views build HTML strings, so `esc()` is not optional: any product name,
 * cashier note or search term that reaches the page goes through it.
 * A product called  O'Brien's "Special"  breaks the page without it.
 */
(function () {
  const esc = (value) =>
    String(value === null || value === undefined ? '' : value).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

  const money = (amount) =>
    '₱' +
    Number(amount || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  function timeAgo(iso) {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  const minutesSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

  const stamp = (iso) =>
    new Date(iso).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const clock = (iso) =>
    new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  // ---- small markup partials used by more than one view -----------------
  function statusPill(status) {
    const { ICONS } = window.SmartCart;
    if (status === 'verified') return `<span class="pill pill-success">${ICONS.check} Verified</span>`;
    if (status === 'pending') return `<span class="pill pill-warning">${ICONS.clock} Pending</span>`;
    if (status === 'flagged') return `<span class="pill pill-danger">${ICONS.flag} Flagged</span>`;
    return `<span class="pill pill-neutral">${esc(status)}</span>`;
  }

  function stockPill(product) {
    if (product.stockLevel === 'out') return '<span class="pill pill-danger">Out of stock</span>';
    if (product.stockLevel === 'low') return `<span class="pill pill-warning">${product.stock} left</span>`;
    return `<span class="pill pill-success">${product.stock} in stock</span>`;
  }

  function emptyState(iconName, title, body) {
    const { ICONS } = window.SmartCart;
    return `<div class="empty-state">${ICONS[iconName] || ''}<h4>${esc(title)}</h4><p>${esc(body)}</p></div>`;
  }

  function statCard(label, value, iconName, tone, delta) {
    const { ICONS } = window.SmartCart;
    const tones = {
      primary: ['var(--primary-tint)', 'var(--primary-dark)'],
      danger: ['var(--danger-tint)', 'var(--danger)'],
      warning: ['var(--warning-tint)', 'var(--warning)'],
      teal: ['var(--teal-tint)', 'var(--teal)'],
    };
    const [bg, fg] = tones[tone] || tones.primary;
    return `<div class="stat-card">
      <div class="top"><span class="label">${esc(label)}</span><span class="ic" style="background:${bg};color:${fg};">${ICONS[iconName]}</span></div>
      <div class="value">${value}</div>
      <div class="delta">${esc(delta)}</div>
    </div>`;
  }

  /** Search box markup — used identically on five different pages. */
  function searchInput(key, value, placeholder) {
    const { icon } = window.SmartCart;
    return `<div class="input-wrap">${icon('search', 'leading')}
      <input class="input has-icon" data-fkey="${esc(key)}" data-bind="${esc(key)}" value="${esc(value)}" placeholder="${esc(placeholder)}">
    </div>`;
  }

  /** Triggers a file download from a string the services produced. */
  function downloadFile(filename, text, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mime });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 500);
  }

  window.SmartCart = window.SmartCart || {};
  window.SmartCart.dom = {
    esc, money, timeAgo, minutesSince, stamp, clock, startOfToday,
    statusPill, stockPill, emptyState, statCard, searchInput, downloadFile,
  };
})();
