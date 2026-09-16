/**
 * settingsView.js — terminal info and prototype data controls.
 * Also reports which backend the app is talking to, which is the quickest
 * way to tell whether your SQLite server is actually connected.
 */
(function () {
  const { BaseView } = window.SmartCart;

  class SettingsView extends BaseView {
    constructor(ctx) {
      super(ctx);
      this.state = { confirmReset: false, staffModal: null, editingId: null, removeId: null };
      this.staffList = [];
    }

    get title() {
      return 'Settings';
    }

    async onShow() {
      if (this.user.isAdmin) {
        this.staffList = await this.guard(() => this.ctx.adminService.listStaff()) || [];
      }
    }

    async render() {
      const { ICONS } = window.SmartCart;
      const { esc } = window.SmartCart.dom;
      const cfg = window.SmartCart.CONFIG;
      const online = cfg.backend === 'api';
      const isAdmin = this.user.isAdmin;

      if (isAdmin && !this.staffList.length) {
        this.staffList = await this.guard(() => this.ctx.adminService.listStaff()) || [];
      }

      return `
    <div class="page-head"><div><h2>Settings</h2><p>Terminal configuration and prototype data controls.</p></div></div>
    <div class="verify-grid">
      <div class="card">
        <div class="card-head"><h3>${ICONS.settings} Terminal</h3></div>
        <div class="card-body">
          <div class="kv"><span class="k">Terminal ID</span><span class="v mono">${esc(cfg.terminalId)}</span></div>
          <div class="kv"><span class="k">Station</span><span class="v">${esc(cfg.station)}</span></div>
          <div class="kv"><span class="k">Signed in as</span><span class="v">${esc(this.user.name)} (${esc(this.user.id)})</span></div>
          <div class="kv"><span class="k">Scanner bridge</span><span class="v">Keyboard-wedge / HID <span class="pill pill-warning">Arduino pending</span></span></div>
          <div class="kv"><span class="k">Data store</span><span class="v">
            ${online ? `SQLite via ${esc(cfg.apiBaseUrl)} <span class="pill pill-success">Server mode</span>` : 'Browser localStorage <span class="pill pill-neutral">Local mode</span>'}
          </span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>${ICONS.refresh} Prototype data</h3></div>
        <div class="card-body">
          <p style="font-size:13.5px;color:var(--text-muted);line-height:1.55;margin:0 0 14px;">
            ${online
              ? 'This terminal is reading and writing the SQLite database on the server. Reset it there with <span class="mono">npm run seed</span> rather than from this screen.'
              : 'Everything is stored in this browser. Reset it before a demo so the queue, stock levels and log start from a known state.'}
          </p>
          <button class="btn btn-outline btn-block" data-act="export-json" style="margin-bottom:10px;">${ICONS.download} Export all data (JSON)</button>
          <button class="btn btn-danger-outline btn-block" data-act="ask-reset" ${online ? 'disabled' : ''}>${ICONS.refresh} Reset demo data</button>
        </div>
      </div>
    </div>
    ${isAdmin ? `
    <div class="card" style="margin-top:16px;">
      <div class="card-head">
        <h3>${ICONS.user} Staff accounts</h3>
        <button class="btn btn-primary btn-sm" data-act="add-staff">${ICONS.plus || '+'} Add staff</button>
      </div>
      <div class="card-body">
        <p style="font-size:13.5px;color:var(--text-muted);line-height:1.55;margin:0 0 14px;">
          Administrators share one login (yours). Give each cashier their own Employee ID and password here — they'll use those to sign in instead of a shared account.
        </p>
        ${this.staffList.length ? `
        <table>
          <thead><tr><th>Employee ID</th><th>Name</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>
            ${this.staffList.map((s) => `
            <tr>
              <td class="mono">${esc(s.id)}</td>
              <td>${esc(s.name)}</td>
              <td><span class="pill ${s.isAdmin ? 'pill-success' : 'pill-neutral'}">${esc(s.roleLabel)}</span></td>
              <td style="display:flex;gap:8px;">
                <button class="btn btn-outline btn-sm" data-act="edit-staff" data-id="${esc(s.id)}">Edit</button>
                <button class="btn btn-danger-outline btn-sm" data-act="ask-remove-staff" data-id="${esc(s.id)}" ${s.id === this.user.id ? 'disabled' : ''}>Remove</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>` : `<p style="color:var(--text-muted);font-size:13.5px;">No staff accounts yet.</p>`}
      </div>
    </div>` : ''}`;
    }

    async renderModal() {
      const { esc } = window.SmartCart.dom;
      if (this.state.confirmReset) {
        return this.modalShell(
          'Reset demo data',
          `<p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin:0;">
            The catalog, stock levels, transactions and activity log all return to their seeded state. This cannot be undone.
          </p>`,
          `<button class="btn btn-outline" data-act="close-reset">Cancel</button>
           <button class="btn btn-danger-outline" data-act="do-reset">Reset everything</button>`
        );
      }
      if (this.state.staffModal === 'form') {
        const editing = this.state.editingId
          ? this.staffList.find((s) => s.id === this.state.editingId)
          : null;
        return this.modalShell(
          editing ? 'Edit staff account' : 'Add staff account',
          `<div class="field"><label for="sf-id">Employee ID</label>
            <div class="input-wrap"><input class="input mono" id="sf-id" data-fkey="sf-id" value="${esc(editing ? editing.id : '')}" placeholder="e.g. EMP-1050" ${editing ? 'disabled' : ''}></div>
          </div>
          <div class="field"><label for="sf-name">Full name</label>
            <div class="input-wrap"><input class="input" id="sf-name" data-fkey="sf-name" value="${esc(editing ? editing.name : '')}" placeholder="e.g. Jamie Cruz"></div>
          </div>
          <div class="field"><label for="sf-role">Role</label>
            <select class="input" id="sf-role">
              <option value="cashier" ${!editing || editing.role === 'cashier' ? 'selected' : ''}>Cashier</option>
              <option value="admin" ${editing && editing.role === 'admin' ? 'selected' : ''}>Administrator</option>
            </select>
          </div>
          <div class="field"><label for="sf-pw">${editing ? 'New password (leave blank to keep current)' : 'Password'}</label>
            <div class="input-wrap"><input class="input" id="sf-pw" data-fkey="sf-pw" type="password" placeholder="At least 4 characters"></div>
          </div>`,
          `<button class="btn btn-outline" data-act="close-staff">Cancel</button>
           <button class="btn btn-primary" data-act="${editing ? 'save-edit-staff' : 'save-add-staff'}">${editing ? 'Save changes' : 'Create account'}</button>`
        );
      }
      if (this.state.removeId) {
        const s = this.staffList.find((x) => x.id === this.state.removeId);
        return this.modalShell(
          'Remove staff account',
          `<p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin:0;">
            ${esc(s ? s.name : this.state.removeId)} (${esc(this.state.removeId)}) will no longer be able to sign in. This cannot be undone.
          </p>`,
          `<button class="btn btn-outline" data-act="close-staff">Cancel</button>
           <button class="btn btn-danger-outline" data-act="do-remove-staff">Remove account</button>`
        );
      }
      return '';
    }

    async closeModal() {
      this.state.confirmReset = false;
      this.state.staffModal = null;
      this.state.editingId = null;
      this.state.removeId = null;
      await this.ctx.app.refresh();
    }

    async onAction(act, data) {
      switch (act) {
        case 'ask-reset':
          this.state.confirmReset = true;
          await this.ctx.app.refresh();
          return true;
        case 'close-reset':
          this.state.confirmReset = false;
          await this.ctx.app.refresh();
          return true;
        case 'do-reset':
          this.state.confirmReset = false;
          this.ctx.db.resetAll();
          this.toast.success('Demo data reset.');
          await this.ctx.app.go('settings');
          return true;
        case 'export-json': {
          const payload = JSON.stringify(
            {
              products: await this.ctx.productRepo.list(),
              transactions: await this.ctx.adminService.listTransactions({}),
              audit: await this.ctx.auditService.list(''),
            },
            null,
            2
          );
          window.SmartCart.dom.downloadFile('smartcart-data.json', payload, 'application/json');
          this.toast.success('smartcart-data.json downloaded.');
          return true;
        }
        case 'add-staff':
          this.state.staffModal = 'form';
          this.state.editingId = null;
          await this.ctx.app.refresh();
          return true;
        case 'edit-staff':
          this.state.staffModal = 'form';
          this.state.editingId = data && data.id;
          await this.ctx.app.refresh();
          return true;
        case 'ask-remove-staff':
          this.state.removeId = data && data.id;
          await this.ctx.app.refresh();
          return true;
        case 'close-staff':
          this.state.staffModal = null;
          this.state.editingId = null;
          this.state.removeId = null;
          await this.ctx.app.refresh();
          return true;
        case 'save-add-staff': {
          const data = {
            id: this.field('sf-id'),
            name: this.field('sf-name'),
            role: this.field('sf-role'),
            password: this.field('sf-pw'),
          };
          const staff = await this.guard(() => this.ctx.adminService.addStaff(data), `${data.name || 'Staff'} account created.`);
          if (staff) {
            this.state.staffModal = null;
            this.staffList = await this.ctx.adminService.listStaff();
            await this.ctx.app.refresh();
          }
          return true;
        }
        case 'save-edit-staff': {
          const id = this.state.editingId;
          const data = {
            name: this.field('sf-name'),
            role: this.field('sf-role'),
            password: this.field('sf-pw'),
          };
          const staff = await this.guard(() => this.ctx.adminService.editStaff(id, data), 'Account updated.');
          if (staff) {
            this.state.staffModal = null;
            this.state.editingId = null;
            this.staffList = await this.ctx.adminService.listStaff();
            await this.ctx.app.refresh();
          }
          return true;
        }
        case 'do-remove-staff': {
          const id = this.state.removeId;
          const removed = await this.guard(() => this.ctx.adminService.removeStaff(id), 'Account removed.');
          this.state.removeId = null;
          if (removed !== null) this.staffList = await this.ctx.adminService.listStaff();
          await this.ctx.app.refresh();
          return true;
        }
        default:
          return false;
      }
    }
  }

  window.SmartCart.SettingsView = SettingsView;
})();
