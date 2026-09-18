/**
 * loginView.js — Screen 0: staff sign in.
 * There is no customer login by design (SRS 2.1: the customer interacts
 * only with the cart-mounted scanner).
 */
(function () {
  const { BaseView } = window.SmartCart;

  class LoginView extends BaseView {
    constructor(ctx) {
      super(ctx);
      this.state = { error: '', employeeId: '' };
    }

    get title() {
      return 'Sign in';
    }

    async render() {
      const { ICONS, icon } = window.SmartCart;
      const { esc } = window.SmartCart.dom;
      const { error, employeeId } = this.state;

      return `
  <div id="login-screen">
    <div class="login-hero circuit-bg">
      <div class="brandmark">
        <div class="brand-badge">${ICONS.cart}</div>
        <div>
          <div class="brand-name">SmartCart OS</div>
          <div class="brand-sub">Barcode-Scanning Smart Cart System</div>
        </div>
      </div>
      <div class="hero-mid">
        <span class="hero-eyebrow"><span class="dot"></span> Live checkout network</span>
        <h1>Scan while you shop. Verify at the register.</h1>
        <p>Customers scan items with the cart-mounted Arduino scanner as they shop — no app, no account. Staff verify the recorded cart against what is physically presented before payment is accepted.</p>
        <div class="scan-visual">
          <div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <span>UPC 4801234500011 · MATCHED</span>
        </div>
      </div>
      <div style="height:1px"></div>
      <div class="terminal-strip">
        <span>Terminal ID: POS-T049</span><span>Station: Main Register</span>
      </div>
    </div>

    <div class="login-panel">
      <div class="login-card">
        <h2>Staff sign in</h2>
        <p class="sub">Verification and administration require a staff account.</p>
        <div class="field">
          <label for="li-id">Employee ID</label>
          <div class="input-wrap">${icon('user', 'leading')}
            <input class="input has-icon" id="li-id" data-fkey="li-id" value="${esc(employeeId)}" autocomplete="username" placeholder="e.g. EMP-1042">
          </div>
        </div>
        <div class="field">
          <label for="li-pw">Password</label>
          <div class="input-wrap">${icon('lock', 'leading')}
            <input class="input has-icon" id="li-pw" data-fkey="li-pw" type="password" autocomplete="current-password" placeholder="••••••">
          </div>
        </div>
        ${error ? `<div class="help-error">${ICONS.alert}<span>${esc(error)}</span></div>` : ''}
        <button class="btn btn-primary btn-block" data-act="sign-in" style="margin-top:4px;">${ICONS.shield} Sign in</button>

        <p class="login-foot-link" style="margin-top:14px;">Customers never sign in — they scan with the cart-mounted Arduino scanner.</p>
      </div>
    </div>
  </div>`;
    }

    async onAction(act, data) {
      if (act === 'sign-in') {
        await this._attempt(this.field('li-id'), this.field('li-pw'));
        return true;
      }
      return false;
    }

    async onEnter(target) {
      if (target.id === 'li-id' || target.id === 'li-pw') {
        await this._attempt(this.field('li-id'), this.field('li-pw'));
        return true;
      }
      return false;
    }

    async _attempt(employeeId, password) {
      try {
        const staff = await this.ctx.auth.signIn(employeeId, password);
        this.state = { error: '', employeeId: '' };
        await this.ctx.app.onSignedIn(staff);
      } catch (err) {
        // keep the typed ID so they only retype the password
        this.state.employeeId = employeeId || '';
        this.state.error = err.message;
        await this.ctx.app.refresh();
      }
    }
  }

  window.SmartCart.LoginView = LoginView;
})();
