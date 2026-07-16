(function () {
  "use strict";

  var S = window.Store;

  // this is the selection set

  var sel = new Set();
  var listeners = [];

  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (fn) { fn(); }); }

  function list() {
    var out = [];
    sel.forEach(function (id) { out.push(id); });
    return out;
  }
  function has(id) { return sel.has(id); }
  function size() { return sel.size; }
  function isEmpty() { return sel.size === 0; }

  function only(id, silent) {
    sel.clear();
    if (id) sel.add(id);
    if (!silent) emit();
  }
  function add(id, silent) {
    if (sel.has(id)) return;
    sel.add(id);
    if (!silent) emit();
  }
  function toggle(id, silent) {
    if (sel.has(id)) sel.delete(id); else sel.add(id);
    if (!silent) emit();
  }
  function set(arr, silent) {
    sel.clear();
    arr.forEach(function (id) { sel.add(id); });
    if (!silent) emit();
  }
  function clear(silent) {
    if (!sel.size) return;
    sel.clear();
    if (!silent) emit();
  }

  function events() {
    return list().map(function (id) { return S.getEvent(id); }).filter(Boolean);
  }

  // this is the copy clipboard

  var clip = [];

  function copy() {
    var evs = events();
    if (!evs.length) return 0;
    clip = evs.map(function (e) {
      return {
        categoryId: e.categoryId,
        title: e.title,
        note: e.note,
        allDay: e.allDay,
        start: e.start,
        end: e.end,
      };
    });
    return clip.length;
  }

  function paste() {
    if (!clip.length) return 0;
    var date = S.getSelectedDate();
    var made = S.addEvents(clip.map(function (c) {
      return {
        date: date,
        start: c.start,
        end: c.end,
        categoryId: c.categoryId,
        title: c.title,
        note: c.note,
        allDay: c.allDay,
      };
    }));
    set(made.map(function (e) { return e.id; }));
    return made.length;
  }

  // this is the shortcut guards

  function isTyping(t) {
    if (!t) return false;
    if (t.isContentEditable) return true;
    var tag = t.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function dialogOpen() {
    var p = document.querySelector(".popover");
    if (p && !p.hidden) return true;
    var g = document.querySelector(".guide-overlay");
    if (g && !g.hidden) return true;
    if (window.ApplyTo && window.ApplyTo.isOpen()) return true;
    return false;
  }

  // this is the global keyboard wiring

  document.addEventListener("keydown", function (e) {
    if (isTyping(e.target)) return;

    if (e.key === "Escape") {
      if (dialogOpen()) return;
      if (!isEmpty()) { clear(); e.preventDefault(); }
      return;
    }

    var meta = e.metaKey || e.ctrlKey;
    if (!meta) return;
    if (dialogOpen()) return;

    var k = e.key.toLowerCase();
    if (k === "c") {
      var n = copy();
      if (n) { window.App.toast("Copied " + n); e.preventDefault(); }
    } else if (k === "v") {
      var m = paste();
      if (m) { window.App.toast("Pasted " + m); e.preventDefault(); }
    }
  });

  // this is the public api

  window.Selection = {
    onChange: onChange,
    list: list,
    events: events,
    has: has,
    size: size,
    isEmpty: isEmpty,
    only: only,
    add: add,
    toggle: toggle,
    set: set,
    clear: clear,
    copy: copy,
    paste: paste,
  };
})();
