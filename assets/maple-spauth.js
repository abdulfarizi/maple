/* M-ID · "Connect Spotify" for listeners.
 * Spotify only streams full songs to a listener's own Premium account, so a listener can connect theirs once
 * (Spotify's official sign-in, PKCE flow, no secret involved). The tokens stay in this browser only.
 * Used by the player (maple-player.js) and the sign-in return page (/spotify-callback/). */
(function () {
  'use strict';
  if (window.MSP) return;
  var KEY = 'msp:tok', PK = 'msp:pkce';
  var SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';
  var REDIRECT = location.origin + '/spotify-callback/';
  var cfgP = null, subs = [];

  function config() {
    if (!cfgP) cfgP = fetch('/api/spotify-config').then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) { return String((d && d.clientId) || ''); }).catch(function () { cfgP = null; return ''; });
    return cfgP;
  }
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function write(t) { try { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY); } catch (e) {} emit(); }
  function emit() { subs.forEach(function (f) { try { f(connected()); } catch (e) {} }); }
  function connected() { var t = read(); return !!(t && t.refresh); }

  function b64url(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function rand(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a).slice(0, n); }

  function form(body) {
    return fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) { var e = new Error(d.error_description || d.error || 'Spotify refused'); e.code = d.error; throw e; } return d; }); });
  }
  function keep(d, old) {
    var t = { access: d.access_token, refresh: d.refresh_token || (old && old.refresh), exp: Date.now() + (Number(d.expires_in) || 3600) * 1000, client: (old && old.client) || d.client };
    write(t); return t;
  }

  var refreshing = null;
  /* a fresh access token, refreshed when it's close to expiring */
  function token() {
    var t = read(); if (!t || !t.refresh) return Promise.reject(new Error('not connected'));
    if (t.access && t.exp - Date.now() > 60000) return Promise.resolve(t.access);
    if (refreshing) return refreshing;
    refreshing = config().then(function (id) {
      return form({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: id || t.client });
    }).then(function (d) { d.client = t.client; return keep(d, t).access; }, function (e) {
      if (e && e.code === 'invalid_grant') write(null);            // revoked or expired: sign in again
      throw e;
    }).finally(function () { refreshing = null; });
    return refreshing;
  }

  /* open Spotify's sign-in. A popup keeps the music page as it is; if popups are blocked, the page goes there and comes back */
  function connect() {
    return config().then(function (id) {
      if (!id) throw new Error('Spotify connect is not set up on this site yet.');
      var verifier = rand(64), state = rand(16);
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (h) {
        try { localStorage.setItem(PK, JSON.stringify({ v: verifier, s: state, id: id, back: location.pathname + location.search + location.hash })); } catch (e) {}
        var url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
          response_type: 'code', client_id: id, scope: SCOPES, redirect_uri: REDIRECT, state: state, code_challenge_method: 'S256', code_challenge: b64url(h)
        }).toString();
        var w = window.open(url, 'msp-login', 'width=480,height=720');
        if (!w) location.href = url;
      });
    });
  }
  function disconnect() { write(null); }

  /* on /spotify-callback/: swap the code for tokens, tell the opener, close (or go back) */
  function handle(done) {
    var q = new URLSearchParams(location.search), pk = null;
    try { pk = JSON.parse(localStorage.getItem(PK) || 'null'); localStorage.removeItem(PK); } catch (e) {}
    var finish = function (ok, msg) {
      try { if (window.opener && window.opener !== window) { window.opener.postMessage({ maple: 'sp-auth', ok: ok }, location.origin); window.close(); } } catch (e) {}
      done(ok, msg, pk && pk.back);
    };
    if (q.get('error')) return finish(false, q.get('error') === 'access_denied' ? 'You cancelled the Spotify sign-in.' : 'Spotify sign-in failed.');
    if (!pk || !q.get('code') || q.get('state') !== pk.s) return finish(false, 'This sign-in link expired. Start again from the player.');
    form({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT, client_id: pk.id, code_verifier: pk.v })
      .then(function (d) { d.client = pk.id; keep(d, null); finish(true); }, function (e) { finish(false, e.message || 'Spotify sign-in failed.'); });
  }

  window.addEventListener('storage', function (e) { if (e.key === KEY) emit(); });
  window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.maple === 'sp-auth') emit(); });
  window.MSP = { config: config, connected: connected, token: token, connect: connect, disconnect: disconnect, handle: handle,
    onChange: function (f) { subs.push(f); } };
})();
