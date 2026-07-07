(function () {
  "use strict";

  // this is the setup

  var S = window.Store;
  var Timers = window.Timers;

  var root = null;
  var timerList = null;
  var chainList = null;
  var built = false;

  // this is where the layout gets built

  function build(container) {
    root = container;
    root.innerHTML = "";

    var wrap = document.createElement("div");
    wrap.className = "timers-view";

    var p1 = panel("Multi-Timer Cockpit");
    timerList = document.createElement("div");
    timerList.className = "timer-list";
    p1.appendChild(timerList);
    var addTimer = document.createElement("button");
    addTimer.className = "btn btn-block";
    addTimer.textContent = "+ Add Timer";
    addTimer.addEventListener("click", function () {
      Timers.ensureAudio();
      Timers.addTimer({});
    });
    p1.appendChild(addTimer);

    var p2 = panel("Timer Chains");
    var note = document.createElement("p");
    note.className = "panel-note";
    note.textContent = "When a timer hits 0, trigger the next.";
    p2.appendChild(note);
    chainList = document.createElement("div");
    chainList.className = "chain-list";
    p2.appendChild(chainList);
    var addChain = document.createElement("button");
    addChain.className = "btn btn-block";
    addChain.textContent = "+ Add Chain";
    addChain.addEventListener("click", function () {
      if (Timers.list().length < 2) { window.App.toast("Add at least 2 timers to chain"); return; }
      Timers.addChain({});
    });
    p2.appendChild(addChain);

    wrap.appendChild(p1);
    wrap.appendChild(p2);
    root.appendChild(wrap);
    built = true;
  }

  function panel(title) {
    var p = document.createElement("section");
    p.className = "panel";
    var h = document.createElement("h3");
    h.textContent = title;
    p.appendChild(h);
    return p;
  }

  function blockLabel(id) {
    var e = S.getEvent(id);
    if (!e) return null;
    var cat = S.getCategory(e.categoryId);
    return e.title || (cat ? cat.name : "Block");
  }

  // this is where the timers get drawn

  function renderTimers() {
    if (!built) return;
    timerList.innerHTML = "";
    var timers = Timers.list();
    if (!timers.length) {
      timerList.appendChild(empty("No timers yet — add one to track a focus block."));
      return;
    }
    timers.forEach(function (t) {
      var el = document.createElement("div");
      el.className = "timer";

      var top = document.createElement("div");
      top.className = "timer-top";
      var name = document.createElement("input");
      name.className = "timer-name";
      name.value = t.name;
      name.addEventListener("input", function () { t.name = name.value; S.persist(); });
      var rm = document.createElement("button");
      rm.className = "btn btn-ghost";
      rm.style.padding = "2px 8px";
      rm.textContent = "Remove";
      rm.addEventListener("click", function () { Timers.removeTimer(t.id); });
      top.appendChild(name); top.appendChild(rm);
      el.appendChild(top);

      var tabs = document.createElement("div");
      tabs.className = "mode-tabs";
      ["countdown", "stopwatch"].forEach(function (mode) {
        var b = document.createElement("button");
        b.textContent = mode === "countdown" ? "Countdown" : "Stopwatch";
        if (t.mode === mode) b.className = "on";
        b.addEventListener("click", function () {
          t.mode = mode; t.running = false;
          t.remaining = t.duration; t.elapsed = 0;
          S.persist();
          renderTimers();
        });
        tabs.appendChild(b);
      });
      el.appendChild(tabs);

      if (t.mode === "countdown") {
        var sd = document.createElement("div");
        sd.className = "set-dur";
        var mins = document.createElement("input");
        mins.type = "number"; mins.min = "0"; mins.value = Math.floor(t.duration / 60);
        var secs = document.createElement("input");
        secs.type = "number"; secs.min = "0"; secs.max = "59"; secs.value = t.duration % 60;
        function applyDur() {
          var d = (parseInt(mins.value, 10) || 0) * 60 + (parseInt(secs.value, 10) || 0);
          d = Math.max(1, d);
          t.duration = d;
          if (!t.running) t.remaining = d;
          S.persist();
          renderTimers();
        }
        mins.addEventListener("change", applyDur);
        secs.addEventListener("change", applyDur);
        sd.appendChild(document.createTextNode("Set "));
        sd.appendChild(mins); sd.appendChild(document.createTextNode("m"));
        sd.appendChild(secs); sd.appendChild(document.createTextNode("s"));
        el.appendChild(sd);
      }

      var time = document.createElement("div");
      time.className = "timer-time";
      time.dataset.tid = t.id;
      var shown = t.mode === "countdown" ? t.remaining : t.elapsed;
      time.textContent = Timers.fmtClock(shown);
      if (t.mode === "countdown" && t.remaining === 0) time.className += " done";
      else if (t.mode === "countdown" && t.remaining <= 60 && t.running) time.className += " warn";
      el.appendChild(time);

      var meta = document.createElement("div");
      meta.className = "timer-meta";
      if (t.blockId) {
        var lbl = blockLabel(t.blockId);
        meta.textContent = lbl ? "linked: " + lbl : "linked block removed";
      } else {
        meta.textContent = t.running ? "running" : "paused";
      }
      el.appendChild(meta);

      var ctr = document.createElement("div");
      ctr.className = "timer-controls";
      var playBtn = document.createElement("button");
      playBtn.className = "btn";
      playBtn.textContent = t.running ? "Pause" : "Start";
      playBtn.addEventListener("click", function () {
        if (t.running) Timers.pauseTimer(t.id); else Timers.startTimer(t.id);
      });
      var resetBtn = document.createElement("button");
      resetBtn.className = "btn";
      resetBtn.textContent = "Reset";
      resetBtn.addEventListener("click", function () { Timers.resetTimer(t.id); });
      ctr.appendChild(playBtn); ctr.appendChild(resetBtn);
      el.appendChild(ctr);

      timerList.appendChild(el);
    });
  }

  // this is the per-second update

  function tickTimers() {
    if (!built) return;
    Timers.list().forEach(function (t) {
      var node = timerList.querySelector('.timer-time[data-tid="' + t.id + '"]');
      if (!node) return;
      var shown = t.mode === "countdown" ? t.remaining : t.elapsed;
      node.textContent = Timers.fmtClock(shown);
      var cls = "timer-time";
      if (t.mode === "countdown" && t.remaining === 0) cls += " done";
      else if (t.mode === "countdown" && t.remaining <= 60 && t.running) cls += " warn";
      node.className = cls;
    });
    S.persist();
  }

  // this is where the chains get drawn

  function renderChains() {
    if (!built) return;
    chainList.innerHTML = "";
    var timers = Timers.list();
    var chains = Timers.chainList();
    if (!chains.length) {
      chainList.appendChild(empty("No chains yet — link two timers so one starts when another ends."));
      return;
    }
    chains.forEach(function (c) {
      var el = document.createElement("div");
      el.className = "chain";

      var row = document.createElement("div");
      row.className = "chain-row";
      row.appendChild(document.createTextNode("When "));
      var from = timerSelect(timers, c.fromId);
      from.addEventListener("change", function () { c.fromId = from.value; S.persist(); });
      row.appendChild(from);
      row.appendChild(document.createTextNode(" reaches 0, start "));
      var to = timerSelect(timers, c.toId, c.fromId);
      if (to.value && to.value !== c.toId) { c.toId = to.value; }
      to.addEventListener("change", function () { c.toId = to.value; S.persist(); });
      row.appendChild(to);
      from.addEventListener("change", function () { renderChains(); });
      el.appendChild(row);

      var row2 = document.createElement("div");
      row2.className = "chain-row";
      var lbl = document.createElement("label");
      lbl.className = "mini";
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = c.pauseOthers;
      cb.addEventListener("change", function () { c.pauseOthers = cb.checked; S.persist(); });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(" pause everything else"));
      row2.appendChild(lbl);
      var rm = document.createElement("button");
      rm.className = "btn btn-ghost rm";
      rm.style.padding = "3px 9px";
      rm.textContent = "Remove";
      rm.addEventListener("click", function () { Timers.removeChain(c.id); });
      row2.appendChild(rm);
      el.appendChild(row2);

      chainList.appendChild(el);
    });
  }

  function timerSelect(timers, selectedId, excludeId) {
    var sel = document.createElement("select");
    var options = timers.filter(function (t) { return t.id !== excludeId; });
    if (!options.length) {
      var o = document.createElement("option");
      o.textContent = "(no timers)";
      sel.appendChild(o);
      return sel;
    }
    options.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t.id; o.textContent = t.name;
      if (t.id === selectedId) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  function empty(text) {
    var e = document.createElement("div");
    e.className = "panel-empty";
    e.textContent = text;
    return e;
  }

  function render(container) {
    build(container);
    renderTimers();
    renderChains();
  }

  function isLive() {
    return built && root && document.body.contains(root);
  }

  // this is the public api

  window.TimersView = {
    render: render,
    renderTimers: function () { if (isLive()) renderTimers(); },
    renderChains: function () { if (isLive()) renderChains(); },
    tick: function () { if (isLive()) tickTimers(); },
  };

  window.ViewRegistry.register("timers", {
    title: "Timers",
    render: function (c) { render(c); },
  });
})();
