/* Kato.8 sign-in gate shared by index.html and dashboard.html. Loaded after config.js (written by build.js).
 *
 * This gate is a UX layer. The real access check happens on the server: /api/generate verifies the Clerk
 * session and role itself, so hiding this overlay in dev tools gets nobody anything.
 *
 * It FAILS CLOSED: if Clerk cannot load or is misconfigured, the page stays locked. (The old gate hid
 * itself on any load error, which opened the app whenever sign-in broke.)
 */
(function () {
  'use strict';
  var cfg = window.KATO8_CONFIG || {};
  var allowed = cfg.allowedRoles || [];
  var gate = document.getElementById('auth-gate');
  var states = ['signin', 'unavailable', 'pending', 'restricted'];
  var demoRole = null;

  function show(state) {
    document.body.classList.add('locked');
    gate.style.display = 'flex';
    states.forEach(function (s) {
      var el = document.getElementById('clerk-' + (s === 'signin' ? 'sign-in' : s));
      if (el) el.style.display = s === state ? 'block' : 'none';
    });
  }
  function unlock() {
    gate.style.display = 'none';
    document.body.classList.remove('locked');
  }

  window.kato8Auth = {
    demo: !!cfg.demo,
    /** Headers that identify the caller to /api/*. */
    headers: function () {
      if (cfg.demo) return Promise.resolve({ 'x-demo-role': demoRole || '' });
      var session = window.Clerk && window.Clerk.session;
      if (!session) return Promise.resolve({});
      return session.getToken().then(function (t) { return t ? { Authorization: 'Bearer ' + t } : {}; });
    },
  };

  function initDemo() {
    var roles = cfg.roles || [];
    demoRole = sessionStorage.getItem('kato8-demo-role') || (allowed[0] || 'member');
    var bar = document.createElement('div');
    bar.id = 'demo-bar';
    bar.setAttribute('style', 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:10000;background:#1a1a1a;color:#fff;font:12px -apple-system,Segoe UI,sans-serif;padding:8px 14px;border-radius:100px;display:flex;gap:10px;align-items:center;box-shadow:0 4px 18px rgba(0,0,0,.25)');
    var label = document.createElement('span');
    label.textContent = 'Demo mode · fictional data · view as';
    var sel = document.createElement('select');
    sel.setAttribute('style', 'background:#333;color:#fff;border:0;border-radius:6px;padding:3px 6px;font-size:12px');
    roles.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r; o.textContent = r;
      if (r === demoRole) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      demoRole = sel.value;
      sessionStorage.setItem('kato8-demo-role', demoRole);
      apply();
    });
    bar.appendChild(label); bar.appendChild(sel);
    document.body.appendChild(bar);
    apply();

    function apply() {
      if (allowed.indexOf(demoRole) === -1) show('restricted'); else unlock();
    }
  }

  function initClerk() {
    show('unavailable');
    if (!window.Clerk || !cfg.clerkKey) return; // stays closed
    window.Clerk.load({ publishableKey: cfg.clerkKey }).then(function () {
      window.Clerk.mountSignIn(document.getElementById('clerk-sign-in'), { routing: 'hash' });
      function check() {
        var user = window.Clerk.user;
        if (!user) return show('signin');
        var role = user.publicMetadata && user.publicMetadata.role;
        if (!role) return show('pending');
        if (allowed.indexOf(role) === -1) return show('restricted');
        unlock();
      }
      window.Clerk.addListener(check);
      check();
      ['signout-pending', 'signout-restricted'].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) b.addEventListener('click', function () { window.Clerk.signOut(); });
      });
    }).catch(function () { show('unavailable'); });
  }

  if (!gate) { document.body.classList.add('locked'); return; }
  if (cfg.demo) initDemo(); else initClerk();
})();
