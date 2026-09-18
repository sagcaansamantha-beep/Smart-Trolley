/**
 * authService.js
 * -----------------------------------------------------------------------
 * NFR-05: role-based access. The customer never signs in — they interact
 * only with the cart-mounted scanner — so the only accounts are staff.
 *
 * NFR-06 (hashed passwords) is enforced on whichever side actually holds
 * the password: in local mode the StaffRepository compares a marker
 * string; in server mode the API compares a bcrypt hash and this class
 * never sees the password again after posting it.
 * -----------------------------------------------------------------------
 */
(function () {
  class AuthService {
    constructor(staffRepo, auditRepo) {
      this.staffRepo = staffRepo;
      this.auditRepo = auditRepo;
      this.current = null;
    }

    async signIn(employeeId, password) {
      if (!employeeId || !password) {
        const err = new Error('Enter your employee ID and password.');
        err.code = 'MISSING_CREDENTIALS';
        throw err;
      }
      const staff = await this.staffRepo.verify(employeeId, password);
      if (!staff) {
        const err = new Error('Employee ID or password is incorrect.');
        err.code = 'BAD_CREDENTIALS';
        throw err;
      }
      this.current = staff;
      await this.auditRepo.add({
        type: 'auth',
        text: 'Signed in',
        detail: `${staff.id} · ${staff.role}`,
        actor: staff.name,
      });
      return staff;
    }

    async signOut() {
      if (this.current) {
        await this.auditRepo.add({
          type: 'auth',
          text: 'Signed out',
          detail: this.current.id,
          actor: this.current.name,
        });
      }
      this.current = null;
    }

    get user() {
      return this.current;
    }

    get isAdmin() {
      return !!this.current && this.current.isAdmin;
    }

    /** Used by views to hide admin-only controls (NFR-05). */
    requireAdmin() {
      if (!this.isAdmin) throw new Error('Administrator access is required for this action.');
    }
  }

  window.SmartCart.AuthService = AuthService;
})();
