(function () {
  "use strict";

  // this is the sound stuff

  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function chime() {
    var ctx = ensureAudio();
    if (!ctx) return;
    var now = ctx.currentTime;
    [ [880, 0], [1320, 0.16] ].forEach(function (pair) {
      var freq = pair[0], t = now + pair[1];
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.0);
    });
  }

  // this is the saved data and callbacks

  var timers = [];
  var chains = [];
  var uid = 0;
  function nextId(p) { uid++; return p + uid + "-" + Math.random().toString(36).slice(2, 6); }

  var onChange = function () {};
  var onTick = function () {};
  var onFire = function () {};

  // this is the timer stuff

  function addTimer(opts) {
    opts = opts || {};
    var t = {
      id: opts.id || nextId("t"),
      name: opts.name || "Timer " + (timers.length + 1),
      mode: opts.mode || "countdown",
      duration: opts.duration != null ? opts.duration : 25 * 60,
      remaining: opts.remaining != null ? opts.remaining : (opts.duration != null ? opts.duration : 25 * 60),
      elapsed: opts.elapsed || 0,
      running: !!opts.running,
      blockId: opts.blockId || null,
    };
    timers.push(t);
    onChange();
    return t;
  }
  function removeTimer(id) {
    timers = timers.filter(function (t) { return t.id !== id; });
    chains = chains.filter(function (c) { return c.fromId !== id && c.toId !== id; });
    onChange();
  }
  function getTimer(id) {
    for (var i = 0; i < timers.length; i++) if (timers[i].id === id) return timers[i];
    return null;
  }

  function startTimer(id) {
    var t = getTimer(id); if (!t) return;
    ensureAudio();
    t.running = true;
    onChange();
  }
  function pauseTimer(id) {
    var t = getTimer(id); if (!t) return;
    t.running = false;
    onChange();
  }
  function resetTimer(id) {
    var t = getTimer(id); if (!t) return;
    t.running = false;
    t.remaining = t.duration;
    t.elapsed = 0;
    onChange();
  }
  function pauseAll() {
    timers.forEach(function (t) { t.running = false; });
  }

  // this is the chain stuff

  function addChain(opts) {
    opts = opts || {};
    var c = {
      id: opts.id || nextId("c"),
      fromId: opts.fromId || (timers[0] && timers[0].id) || null,
      toId: opts.toId || (timers[1] && timers[1].id) || null,
      pauseOthers: opts.pauseOthers != null ? opts.pauseOthers : true,
    };
    chains.push(c);
    onChange();
    return c;
  }
  function removeChain(id) {
    chains = chains.filter(function (c) { return c.id !== id; });
    onChange();
  }

  function fireChainsFor(timerId) {
    chains.forEach(function (c) {
      if (c.fromId !== timerId || !c.toId || c.toId === c.fromId) return;
      var from = getTimer(c.fromId);
      if (from) from.running = false;
      if (c.pauseOthers) pauseAll();
      var to = getTimer(c.toId);
      if (to) {
        if (to.mode === "countdown") to.remaining = to.duration;
        else to.elapsed = 0;
        to.running = true;
      }
    });
  }

  // this is the tick loop

  var lastTick = Date.now();
  setInterval(function () {
    var now = Date.now();
    var elapsedMs = now - lastTick;
    var dt = Math.floor(elapsedMs / 1000);
    if (dt <= 0) return;
    lastTick += dt * 1000;
    var fired = [];
    var changed = false;
    timers.forEach(function (t) {
      if (!t.running) return;
      changed = true;
      if (t.mode === "stopwatch") {
        t.elapsed += dt;
      } else {
        t.remaining -= dt;
        if (t.remaining <= 0) {
          t.remaining = 0;
          t.running = false;
          fired.push(t);
        }
      }
    });
    fired.forEach(function (t) {
      chime();
      onFire(t);
      fireChainsFor(t.id);
    });
    if (fired.length) {
      onChange();
    } else if (changed) {
      onTick();
    }
  }, 1000);

  // this is the clock formatting

  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  // this is the save and load

  function serialize() {
    return {
      timers: timers.map(function (t) { return Object.assign({}, t); }),
      chains: chains.map(function (c) { return Object.assign({}, c); }),
    };
  }
  function load(data) {
    timers = [];
    chains = [];
    if (data && data.timers) data.timers.forEach(function (t) { addTimer(t); });
    if (data && data.chains) data.chains.forEach(function (c) { chains.push(c); });
    onChange();
  }

  // this is the public api

  window.Timers = {
    chime: chime,
    ensureAudio: ensureAudio,
    addTimer: addTimer,
    removeTimer: removeTimer,
    getTimer: getTimer,
    startTimer: startTimer,
    pauseTimer: pauseTimer,
    resetTimer: resetTimer,
    addChain: addChain,
    removeChain: removeChain,
    fmtClock: fmtClock,
    serialize: serialize,
    load: load,
    list: function () { return timers; },
    chainList: function () { return chains; },
    set onChange(fn) { onChange = fn; },
    set onTick(fn) { onTick = fn; },
    set onFire(fn) { onFire = fn; },
  };
})();
