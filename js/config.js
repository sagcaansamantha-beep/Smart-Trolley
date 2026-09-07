/**
 * config.js — the one switch that decides where data lives.
 *
 *   backend: 'local'  -> js/data/repositories.js  + localStorage
 *                        Works by double-clicking index.html. No server,
 *                        no install. This is the build to use on the
 *                        Arduino test bench.
 *
 *   backend: 'api'    -> js/data/apiRepositories.js + fetch() to the
 *                        Node + SQLite server in /server. Start it with
 *                        `npm start` inside that folder first.
 *
 * index.html sets 'local'; index-sqlite.html sets 'api'. Nothing else in
 * the codebase reads this value except app.js, which picks the repository
 * classes to construct.
 */
(function () {
  window.SmartCart = window.SmartCart || {};
  window.SmartCart.CONFIG = Object.assign(
    {
      backend: 'local',
      apiBaseUrl: 'http://localhost:3000/api',
      terminalId: 'POS-T049',
      station: 'Main Register',
    },
    window.SMARTCART_CONFIG || {}
  );
})();
