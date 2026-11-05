/* M-ID · theme music.
 * Every theme has its own playlist of three tracks. The tracks are generated live with the Web Audio API
 * (no audio files, nothing to license, works offline) in five moods: lofi, synth, ambient, bell, night.
 * window.MapleMusic.create({ ctx: () => AudioContext, dest: () => AudioNode }) -> player
 *   player.tracks(theme) | play(theme, index) | stop() | next() | prev() | playing() | current() | onchange = fn */
(function () {
  'use strict';
  var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  var CH = { m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], d7: [0, 4, 7, 10] };
  // chord progressions: [type, semitones above the key's root]
  var PROG = {
    A: [['m7', 0], ['M7', 8], ['M7', 3], ['d7', 10]],      // i  VI  III  VII   (moody)
    B: [['m7', 0], ['m7', 5], ['d7', 10], ['M7', 3]],      // i  iv  VII  III   (warm)
    C: [['M7', 0], ['m7', 9], ['M7', 5], ['d7', 7]]        // I  vi  IV   V     (bright)
  };
  var PENT = { A: [0, 3, 5, 7, 10], B: [0, 3, 5, 7, 10], C: [0, 2, 4, 7, 9] };
  // [title, mood, bpm, root midi note, progression]
  var LIST = {
    maple:    [['Maple Rain', 'lofi', 74, 57, 'A'], ['Warm Leaves', 'lofi', 80, 55, 'B'], ['Evening Tea', 'night', 64, 52, 'A']],
    flame:    [['Ember Run', 'synth', 108, 57, 'A'], ['Hot Pixels', 'lofi', 88, 59, 'C'], ['Afterburn', 'synth', 116, 55, 'B']],
    cyber:    [['Neon Grid', 'synth', 112, 57, 'A'], ['Chrome Rain', 'synth', 100, 52, 'B'], ['Datastream', 'ambient', 56, 50, 'B']],
    emerald:  [['Moss Light', 'ambient', 54, 52, 'A'], ['Jade Pond', 'bell', 86, 60, 'C'], ['Fern Study', 'lofi', 76, 55, 'B']],
    sakura:   [['Petal Drift', 'bell', 90, 64, 'C'], ['Spring Letter', 'bell', 84, 60, 'A'], ['Pink Hour', 'lofi', 82, 57, 'C']],
    autumn:   [['Falling Leaves', 'lofi', 70, 53, 'A'], ['Cabin Window', 'night', 62, 55, 'B'], ['Cider', 'lofi', 78, 57, 'B']],
    sunset:   [['Golden Hour', 'lofi', 84, 60, 'C'], ['Last Light', 'ambient', 58, 55, 'A'], ['Boulevard', 'synth', 96, 57, 'C']],
    crimson:  [['Red Moon', 'synth', 104, 50, 'B'], ['Velvet', 'night', 66, 52, 'A'], ['Pulse', 'synth', 118, 53, 'A']],
    gold:     [['Gilded', 'lofi', 80, 60, 'C'], ['Café Royal', 'night', 68, 57, 'C'], ['Sunday Jazz', 'lofi', 90, 58, 'B']],
    forest:   [['Canopy', 'ambient', 52, 50, 'A'], ['Birdsong Hush', 'bell', 80, 57, 'C'], ['Trail Notes', 'lofi', 72, 52, 'B']],
    ocean:    [['Tidepool', 'ambient', 56, 54, 'B'], ['Deep Blue', 'night', 60, 50, 'A'], ['Salt Air', 'lofi', 78, 57, 'C']],
    violet:   [['Twilight Haze', 'synth', 98, 56, 'B'], ['Orchid', 'bell', 88, 62, 'A'], ['Dreamline', 'ambient', 58, 52, 'C']],
    mono:     [['Grayscale', 'night', 64, 55, 'A'], ['Paper', 'lofi', 74, 53, 'B'], ['Quiet Room', 'ambient', 54, 48, 'A']],
    midnight: [['After Hours', 'night', 60, 50, 'A'], ['Starlit', 'ambient', 50, 53, 'B'], ['Insomnia', 'lofi', 70, 50, 'A']],
    ice:      [['Frostbite', 'bell', 92, 64, 'A'], ['Glacier', 'ambient', 52, 55, 'C'], ['Snowfall', 'night', 62, 60, 'C']],
    candy:    [['Bubblegum', 'bell', 100, 64, 'C'], ['Sugar Rush', 'synth', 112, 60, 'C'], ['Sweet Tooth', 'lofi', 86, 60, 'C']],
    matcha:   [['Green Tea', 'lofi', 76, 55, 'C'], ['Zen Garden', 'ambient', 54, 53, 'B'], ['Bamboo', 'bell', 82, 57, 'C']]
  };
  var FALLBACK = LIST.maple;
  function listFor(theme) { return LIST[theme] || FALLBACK; }
  function tracks(theme) { return listFor(theme).map(function (t, i) { return { id: i, title: t[0], mood: t[1], bpm: t[2] }; }); }

  function create(env) {
    var ctx = null, bus = null, noiseBuf = null, timer = 0, run = null, state = { theme: '', index: 0, on: false };
    var player = { onchange: null };
    var rnd = Math.random;
    var pick = function (a) { return a[(rnd() * a.length) | 0]; };

    function ready() {
      ctx = env.ctx();
      if (!ctx) return false;
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
      }
      if (!bus) { bus = ctx.createGain(); bus.gain.value = 0.2; bus.connect(env.dest()); }
      return true;
    }

    /* ── voices (all go through the run's own gain so a track can fade out as a whole) ── */
    function tone(out, f, t, dur, o) {
      o = o || {};
      var osc = ctx.createOscillator(), g = ctx.createGain(), nodeOut = g;
      osc.type = o.type || 'sine'; osc.frequency.value = f; if (o.detune) osc.detune.value = o.detune;
      var a = o.attack || 0.01, peak = o.gain || 0.1, rel = o.release || dur;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel);
      osc.connect(g);
      if (o.lp) { var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(o.lp, t); if (o.lpEnd) lp.frequency.exponentialRampToValueAtTime(o.lpEnd, t + dur); g.connect(lp); nodeOut = lp; }
      nodeOut.connect(out);
      osc.start(t); osc.stop(t + a + rel + 0.05);
    }
    function noise(out, t, dur, o) {
      o = o || {};
      var src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      src.buffer = noiseBuf; src.loop = true;
      f.type = o.type || 'highpass'; f.frequency.value = o.freq || 6000; if (o.q) f.Q.value = o.q;
      g.gain.setValueAtTime(o.gain || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t, rnd() * 1.5); src.stop(t + dur + 0.02);
    }
    function kick(out, t, v) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
    }
    var snare = function (out, t, v) { noise(out, t, 0.14, { type: 'bandpass', freq: 1800, q: 0.7, gain: 0.16 * v }); tone(out, 190, t, 0.08, { type: 'triangle', gain: 0.08 * v, release: 0.08 }); };
    var hat = function (out, t, v) { noise(out, t, 0.04, { type: 'highpass', freq: 7500, gain: 0.05 * v }); };
    var voicing = function (root, type, spread) { return CH[type].map(function (s, i) { return root + s + (spread && i > 1 ? -12 : 0); }); };

    /* ── moods: each gets called once per 16th note ── */
    var MOODS = {
      lofi: function (r, st, t, bar, chord, p) {
        var o = r.out, sw = (st % 2) ? r.step * 0.18 : 0, tt = t + sw;
        if (st === 0 || st === 10) voicing(r.root + chord[1] + 12, chord[0], true).forEach(function (m, i) {
          tone(o, hz(m), tt + i * 0.012, 1.6, { type: 'triangle', gain: 0.05, attack: 0.012, release: 1.5, lp: 1900 });
          tone(o, hz(m + 12), tt + i * 0.012, 0.9, { type: 'sine', gain: 0.018, release: 0.9 }); });
        if (st === 0 || st === 6 || st === 10) tone(o, hz(r.root + chord[1] - 12), tt, r.step * 3, { type: 'sine', gain: 0.2, attack: 0.02, release: r.step * 3 });
        if (st === 0 || st === 10 || (st === 6 && rnd() < 0.4)) kick(o, t, 0.9);
        if (st === 4 || st === 12) snare(o, tt, 0.8);
        if (st % 2 === 0) hat(o, tt, st % 4 === 0 ? 0.9 : 0.5 + rnd() * 0.4);
        if (rnd() < 0.05) noise(o, t, 0.02, { type: 'highpass', freq: 3000, gain: 0.03 });            // vinyl crackle
        if (st % 2 === 0 && rnd() < 0.22) tone(o, hz(r.root + 12 + pick(p) + (rnd() < 0.3 ? 12 : 0)), tt, 0.5, { type: 'sine', gain: 0.05, release: 0.6, lp: 3000 });
      },
      synth: function (r, st, t, bar, chord, p) {
        var o = r.out, notes = voicing(r.root + chord[1] + 12, chord[0]);
        tone(o, hz(notes[st % notes.length] + (st % 8 > 3 ? 12 : 0)), t, r.step * 1.6, { type: 'sawtooth', gain: 0.045, release: r.step * 1.6, lp: 3200, lpEnd: 500 });
        if (st % 2 === 0) tone(o, hz(r.root + chord[1] - 12), t, r.step * 1.8, { type: 'sawtooth', gain: 0.1, release: r.step * 1.8, lp: 600 });
        if (st % 4 === 0) kick(o, t, 0.85);
        if (st % 4 === 2) hat(o, t, 0.8);
        if (st === 12) snare(o, t, 0.5);
        if (st === 0) notes.forEach(function (m) { tone(o, hz(m), t, r.step * 16, { type: 'sine', gain: 0.022, attack: 0.4, release: r.step * 15 }); });
      },
      ambient: function (r, st, t, bar, chord, p) {
        var o = r.out;
        if (st === 0) voicing(r.root + chord[1], chord[0]).forEach(function (m, i) {
          tone(o, hz(m), t, r.step * 16, { type: 'triangle', gain: 0.035, attack: 2.2, release: r.step * 14, detune: i % 2 ? 7 : -7, lp: 1400 });
          tone(o, hz(m - 12), t, r.step * 16, { type: 'sine', gain: 0.03, attack: 2.6, release: r.step * 14 }); });
        if (st === 8 && bar % 2 === 0) noise(o, t, 3.5, { type: 'bandpass', freq: 600, q: 0.6, gain: 0.02 });
        if (st % 4 === 0 && rnd() < 0.28) tone(o, hz(r.root + 24 + pick(p)), t, 3, { type: 'sine', gain: 0.045, release: 3.2 });
      },
      bell: function (r, st, t, bar, chord, p) {
        var o = r.out;
        if (st % 2 === 0) { var m = r.root + 12 + p[(Math.floor(st / 2) + bar * 2 + (bar % 2 ? 2 : 0)) % p.length] + (st % 8 === 4 ? 12 : 0);
          tone(o, hz(m + 12), t, 1.2, { type: 'sine', gain: 0.07, attack: 0.004, release: 1.1 });
          tone(o, hz(m + 24), t, 0.5, { type: 'triangle', gain: 0.02, attack: 0.004, release: 0.5 }); }
        if (st === 0) voicing(r.root + chord[1], chord[0]).forEach(function (m) { tone(o, hz(m), t, r.step * 16, { type: 'sine', gain: 0.022, attack: 0.8, release: r.step * 15 }); });
        if (st === 0 || st === 8) tone(o, hz(r.root + chord[1] - 12), t, r.step * 6, { type: 'sine', gain: 0.1, release: r.step * 6 });
        if (st === 4 || st === 12) hat(o, t, 0.35);
      },
      night: function (r, st, t, bar, chord, p) {
        var o = r.out;
        if (st % 4 === 0) { var n = voicing(r.root + chord[1], chord[0]), m = n[(st / 4 + bar) % n.length];
          tone(o, hz(m + 12), t, 2.2, { type: 'triangle', gain: 0.06, attack: 0.01, release: 2.2, lp: 2400 });
          tone(o, hz(m), t, 1.4, { type: 'sine', gain: 0.04, release: 1.4 }); }
        if (st === 0) { tone(o, hz(r.root + chord[1] - 12), t, r.step * 14, { type: 'sine', gain: 0.14, attack: 0.05, release: r.step * 14 });
          voicing(r.root + chord[1], chord[0]).forEach(function (m) { tone(o, hz(m), t, r.step * 16, { type: 'triangle', gain: 0.02, attack: 1.4, release: r.step * 14, lp: 900 }); }); }
        if (st % 4 === 2 && rnd() < 0.3) tone(o, hz(r.root + 24 + pick(p)), t, 1.6, { type: 'sine', gain: 0.045, release: 1.6 });
      }
    };

    function start(theme, idx) {
      if (!ready()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      var list = listFor(theme); idx = ((idx % list.length) + list.length) % list.length;
      var d = list[idx], key = d[4];
      fadeOut(run);
      var out = ctx.createGain(); out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.linearRampToValueAtTime(({ lofi: 1, synth: 1, ambient: 1.3, bell: 1.8, night: 2.4 })[d[1]] || 1, ctx.currentTime + 1.2); out.connect(bus);
      run = { out: out, mood: d[1], root: d[3], step: 60 / d[2] / 4, prog: PROG[key], pent: PENT[key], next: ctx.currentTime + 0.12, n: 0 };
      state = { theme: theme, index: idx, on: true, title: d[0] };
      clearInterval(timer); timer = setInterval(pump, 40); pump();
      if (player.onchange) player.onchange(player.current());
      return true;
    }
    function pump() {
      var r = run; if (!r || !ctx) return;
      var ahead = document.hidden ? 2.6 : 0.4;
      while (r.next < ctx.currentTime + ahead) {
        var st = r.n % 16, bar = Math.floor(r.n / 16), chord = r.prog[bar % r.prog.length];
        try { MOODS[r.mood](r, st, r.next, bar, chord, r.pent); } catch (e) {}
        r.next += r.step; r.n++;
      }
    }
    function fadeOut(r) {
      if (!r || !ctx) return;
      var t = ctx.currentTime; r.dead = true;
      try { r.out.gain.cancelScheduledValues(t); r.out.gain.setValueAtTime(r.out.gain.value, t); r.out.gain.linearRampToValueAtTime(0.0001, t + 0.9); } catch (e) {}
      setTimeout(function () { try { r.out.disconnect(); } catch (e) {} }, 1200);
    }

    player.tracks = tracks;
    player.play = function (theme, i) { return start(theme || state.theme || 'maple', i || 0); };
    player.stop = function () { clearInterval(timer); fadeOut(run); run = null; state.on = false; if (player.onchange) player.onchange(player.current()); };
    player.next = function () { return start(state.theme, state.index + 1); };
    player.prev = function () { return start(state.theme, state.index - 1); };
    player.playing = function () { return !!state.on; };
    player.current = function () { return { theme: state.theme, index: state.index, title: state.title || '', on: !!state.on }; };
    // the card's theme changed: keep playing, but move to that theme's own track (same slot)
    player.setTheme = function (theme) { if (state.on && theme !== state.theme) start(theme, state.index); else state.theme = theme; };
    return player;
  }
  window.MapleMusic = { create: create, tracks: tracks, themes: Object.keys(LIST) };
})();
