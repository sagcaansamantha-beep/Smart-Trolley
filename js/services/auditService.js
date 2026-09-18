/**
 * auditService.js
 * -----------------------------------------------------------------------
 * Module 4: Data Storage & Transaction Auditing — read side.
 *
 * The visibility rule lives here and nowhere else:
 *   administrator -> every entry, every actor, every terminal
 *   cashier       -> only the entries they themselves generated
 *
 * Scoping happens in the service, not the view, so a cashier cannot see
 * another cashier's activity even if a view is changed carelessly. When
 * you move to the server, apply the same filter in the SQL WHERE clause
 * so the rows never leave the database in the first place.
 * -----------------------------------------------------------------------
 */
(function () {
  class AuditService {
    constructor(auditRepo, authService) {
      this.auditRepo = auditRepo;
      this.auth = authService;
    }

    async list(query = '') {
      const user = this.auth.user;
      if (!user) return [];
      const filter = { query };
      if (!user.isAdmin) filter.actor = user.name; // cashier: own actions only
      return this.auditRepo.list(filter);
    }

    /** Drives the heading and empty-state copy on the Activity page. */
    get scope() {
      const user = this.auth.user;
      if (user && user.isAdmin) {
        return {
          title: 'Activity Log',
          blurb: 'Every sign-in, payment, override and stock change across all terminals and staff.',
          empty: 'System activity will appear here.',
        };
      }
      return {
        title: 'My Activity',
        blurb: 'The actions you have taken on this terminal. Administrators can see the full system log.',
        empty: 'Your verifications and payments will appear here.',
      };
    }
  }

  window.SmartCart.AuditService = AuditService;
})();
