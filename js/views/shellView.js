/**
 * shellView.js — the frame every signed-in screen renders inside:
 * sidebar navigation, top bar, and the content outlet.
 *
 * NAV is the single place that decides which pages a role can reach
 * (NFR-05). Adding a screen means adding one line here plus one entry in
 * app.js — the shell itself never changes.
 */
(function () {
  const NAV = {
    cashier: [
      { key: 'queue', icon: 'grid', label: 'Verification Queue' },
      { key: 'transactions', icon: 'receipt', label: 'Transactions' },
      { key: 'products', icon: 'tag', label: 'Product Catalog' },
      { key: 'inventory', icon: 'archive', label: 'Inventory' },
      { key: 'audit', icon: 'history', label: 'My Activity' },
      { key: 'simulator', icon: 'scan', label: 'Cart Simulator' },
    ],
    admin: [
      { key: 'dashboard', icon: 'grid', label: 'Dashboard' },
      { key: 'transactions', icon: 'receipt', label: 'Transactions' },
      { key: 'products', icon: 'tag', label: 'Products' },
      { key: 'inventory', icon: 'archive', label: 'Inventory' },
      { key: 'audit', icon: 'history', label: 'Activity Log' },
      { key: 'simulator', icon: 'scan', label: 'Cart Simulator' },
    ],
  };

  class ShellView {
    constructor(ctx) {
      this.ctx = ctx;
    }

    navFor(role) {
      return NAV[role] || NAV.cashier;
    }

    /** @param {string} content already-rendered HTML for the active page */
    render(user, page, pageTitle, content, badges) {
      const { ICONS } = window.SmartCart;
      const { esc } = window.SmartCart.dom;
      const items = this.navFor(user.role);

      return `
  <div id="app-screen">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-badge">${ICONS.cart}</div>
        <div>
          <div class="brand-name">SmartCart OS</div>
          <div class="brand-sub">${user.isAdmin ? 'Back-Office Admin' : 'Cashier Terminal'}</div>
        </div>
      </div>
      <div class="nav-group-label">Menu</div>
      ${items
        .map((item) => {
          const active = page === item.key || (item.key === 'queue' && page === 'verification');
          const badge =
            item.key === 'queue' ? badges.pending : item.key === 'transactions' ? badges.flagged : 0;
          return `
      <div class="nav-item ${active ? 'active' : ''}" data-act="go" data-page="${item.key}" role="button" tabindex="0">
        ${ICONS[item.icon]} <span>${esc(item.label)}</span>
        ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
      </div>`;
        })
        .join('')}
      <div class="sidebar-bottom">
        <div class="nav-item ${page === 'settings' ? 'active' : ''}" data-act="go" data-page="settings" role="button" tabindex="0">${ICONS.settings}<span>Settings</span></div>
        <div class="nav-item" data-act="sign-out" role="button" tabindex="0">${ICONS.logout}<span>Log out</span></div>
      </div>
    </aside>

    <div class="main-col">
      <header class="topbar">
        <div class="topbar-left">
          <h1>SmartCart OS</h1>
          <span class="crumb">/ ${esc(pageTitle)}</span>
        </div>
        <div class="topbar-right">
          ${badges.activeTxId ? `<span class="tx-chip">Transaction #${esc(badges.activeTxId)}</span>` : ''}
          <div class="bell-wrap">
            <div class="icon-btn" data-act="go" data-page="audit">${ICONS.bell}</div>
            ${badges.flagged ? '<span class="bell-dot"></span>' : ''}
          </div>
          <div class="who">
            <div class="avatar">${esc(user.initials)}</div>
            <div>
              <div class="name">${esc(user.name)}</div>
              <div class="role">${esc(user.roleLabel)}</div>
            </div>
          </div>
        </div>
      </header>
      <main class="content">${content}</main>
    </div>
  </div>`;
    }
  }

  window.SmartCart.ShellView = ShellView;
  window.SmartCart.NAV = NAV;
})();
