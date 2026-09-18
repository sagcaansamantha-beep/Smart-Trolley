/**
 * activityLogView.js — Module 4 read side.
 * What is visible here depends on who is signed in; AuditService decides,
 * not this view. A cashier sees only their own actions.
 */
(function () {
  const { BaseView } = window.SmartCart;

  const TONES = {
    payment:  ['var(--success-tint)', 'var(--success)',   'wallet'],
    flag:     ['var(--danger-tint)',  'var(--danger)',    'flag'],
    override: ['var(--warning-tint)', 'var(--warning)',   'edit'],
    cart:     ['var(--primary-tint)', 'var(--primary)',   'cart'],
    stock:    ['var(--teal-tint)',    'var(--teal)',      'archive'],
    product:  ['var(--primary-tint)', 'var(--primary)',   'tag'],
    auth:     ['var(--surface-sunk)', 'var(--text-muted)', 'shield'],
    system:   ['var(--surface-sunk)', 'var(--text-muted)', 'settings'],
  };

  class ActivityLogView extends BaseView {
    constructor(ctx) {
      super(ctx);
      this.state = { search: '' };
    }

    get title() {
      return this.ctx.auditService.scope.title;
    }

    async render() {
      const { ICONS } = window.SmartCart;
      const { esc, stamp, searchInput, emptyState } = window.SmartCart.dom;
      const scope = this.ctx.auditService.scope;
      const rows = await this.ctx.auditService.list(this.state.search);

      return `
    <div class="page-head">
      <div><h2>${esc(scope.title)}</h2><p>${esc(scope.blurb)}</p></div>
    </div>
    <div class="filter-row">${searchInput('search', this.state.search, 'Search the log…')}</div>
    <div class="card">${
      rows.length
        ? rows
            .map((entry) => {
              const [bg, fg, iconName] = TONES[entry.type] || TONES.system;
              return `
        <div class="audit-row">
          <div class="dot-ic" style="background:${bg};color:${fg};">${ICONS[iconName]}</div>
          <div class="txt">
            <div class="t">${esc(entry.text)}</div>
            <div class="m">${esc(entry.actor)}${entry.detail ? ' · ' + esc(entry.detail) : ''}</div>
          </div>
          <div class="when">${stamp(entry.timestamp)}</div>
        </div>`;
            })
            .join('')
        : emptyState('history', 'Nothing logged yet', scope.empty)
    }</div>`;
    }
  }

  window.SmartCart.ActivityLogView = ActivityLogView;
})();
