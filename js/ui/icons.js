/**
 * icons.js — the inline SVG icon set used across every view.
 * Kept as one object so a view never hand-writes an <svg> tag.
 * Usage:  ICONS.cart   or   SmartCart.icon('cart', 'leading')
 */
(function () {
  const ICONS = {
    cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="20" r="1.4"/><path d="M2 4h2.4l1.2 2M6 6l1.7 8.3a2 2 0 0 0 2 1.7h7a2 2 0 0 0 2-1.7L20 6H6Z"/><path d="M9 3.3c1-.8 2.4-1 3.6-.4M15.4 4.2c.7-.3 1.5-.3 2.2 0"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.6 2.7 21 11a2 2 0 0 1 0 2.8l-6.9 6.9a2 2 0 0 1-2.8 0L2.7 12.2A2 2 0 0 1 2 10.8V4a2 2 0 0 1 2-2h6.8c.5 0 1 .2 1.4.7Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`,
    archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="5" rx="1.3"/><path d="M4.5 9v9a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9"/><path d="M10 13.5h4"/></svg>`,
    receipt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h12v19l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V2.5Z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.3 2.6l.1.1a1.7 1.7 0 0 0 1.9.3H9.4a1.7 1.7 0 0 0 1-1.6V1a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V6.6c.2.6.8 1 1.5 1.1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`,
    help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.3 9a2.7 2.7 0 0 1 5.2 1c0 1.8-2.5 2-2.5 3.6"/><path d="M12 17.2v.1"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7.2"/><path d="m21 21-4.3-4.3"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20.5c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="m8 12.3 2.6 2.6L16.2 9"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.4 3.6 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.6 3.6a2 2 0 0 0-3.2 0Z"/><path d="M12 9v4.2M12 17v.1"/></svg>`,
    flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2.2 4L16 12H5"/></svg>`,
    scan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2M4 12h16"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.7 4.3 19.7 11.3 8 23H2v-6L12.7 4.3Z" transform="translate(-1)"/><path d="M17 3l4 4-13 13H4v-4L17 3Z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/><path d="M6 7l1 13.5A1.5 1.5 0 0 0 8.5 22h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M10 11v6M14 11v6"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
    card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 14.5h4"/></svg>`,
    cash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>`,
    inbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12h4l1.6 2.5h4l1.6-2.5h4"/><path d="M4.5 12 6 5a2 2 0 0 1 2-1.6h8a2 2 0 0 1 2 1.6l1.5 7v5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2v-5Z"/></svg>`,
    chev: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>`,
    wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V8H5.5A2.5 2.5 0 0 1 3 5.5"/><path d="M3 8h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><circle cx="16" cy="13" r="1.2"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3.2 2"/></svg>`,
  };
  function ic(name, cls) {
    return `<span class="${cls || ""}">${ICONS[name] || ""}</span>`;
  }
  
  
  /* ============================================================
     EXTRA ICONS (added to the base set above)
     ============================================================ */
  Object.assign(ICONS, {
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>`,
    history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 8v4.4l3 1.8"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8 20 6v6c0 4.8-3.3 8.4-8 9.2-4.7-.8-8-4.4-8-9.2V6l8-3.2Z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/></svg>`,
    print: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9V3.5h11V9"/><rect x="3" y="9" width="18" height="7.5" rx="2"/><path d="M6.5 14h11v6.5h-11z"/></svg>`,
    box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2.8 8.2 4.3v9.8L12 21.2 3.8 16.9V7.1L12 2.8Z"/><path d="M3.9 7.2 12 11.5l8.1-4.3"/><path d="M12 11.5v9.7"/></svg>`,
  });

  function icon(name, className) {
    const svg = ICONS[name] || '';
    return className ? svg.replace('<svg', `<svg class="${className}"`) : svg;
  }

  window.SmartCart = window.SmartCart || {};
  window.SmartCart.ICONS = ICONS;
  window.SmartCart.icon = icon;
})();
