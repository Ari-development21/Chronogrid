(function () {
  "use strict";

  var S = window.Store;

  var backdrop = null;
  var card = null;
  var weeksInput = null;
  var dateInput = null;
  var opened = false;
  var sources = [];

  var PRESETS = [
    { id: "every", label: "Every day" },
    { id: "workdays", label: "Work days (Mon – Fri)" },
    { id: "everyother", label: "Every other day" },
    { id: "biweekly", label: "Every other week (same weekday)" },
  ];

  // this is the dialog markup

  function build() {
    backdrop = document.createElement("div");
    backdrop.className = "applyto-backdrop";
    backdrop.hidden = true;

    card = document.createElement("div");
    card.className = "applyto-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");

    var opts = PRESETS.map(function (p, i) {
      return '<label class="applyto-opt">' +
        '<input type="radio" name="applyto-preset" value="' + p.id + '"' + (i === 0 ? " checked" : "") + ' />' +
        '<span>' + p.label + '</span>' +
        '</label>';
    }).join("");

    card.innerHTML =
      '<div class="applyto-head">' +
        '<span class="applyto-title">Apply to…</span>' +
        '<button class="applyto-close" type="button" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>' +
      '<p class="applyto-sub">Repeat the selected event(s) across future dates.</p>' +
      '<div class="applyto-opts">' + opts + '</div>' +
      '<div class="applyto-range">' +
        '<div class="applyto-range-row"><span>Repeat for</span><input type="number" min="1" max="104" value="4" data-f="weeks" /><span>weeks</span></div>' +
        '<div class="applyto-range-row"><span>or until</span><input type="date" data-f="until" /></div>' +
      '</div>' +
      '<div class="applyto-actions">' +
        '<button class="btn" data-a="cancel">Cancel</button>' +
        '<button class="btn btn-primary" data-a="apply">Apply</button>' +
      '</div>';

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    weeksInput = card.querySelector('[data-f="weeks"]');
    dateInput = card.querySelector('[data-f="until"]');

    card.querySelector(".applyto-close").addEventListener("click", close);
    card.querySelector('[data-a="cancel"]').addEventListener("click", close);
    card.querySelector('[data-a="apply"]').addEventListener("click", apply);

    backdrop.addEventListener("mousedown", function (e) {
      if (e.target === backdrop) close();
    });
    document.addEventListener("keydown", function (e) {
      if (opened && e.key === "Escape") { e.preventDefault(); close(); }
    });
  }

  // this is opening and closing

  function open(evs) {
    if (!backdrop) build();
    var snap = (evs || []).map(function (e) {
      return { date: e.date, start: e.start, end: e.end, categoryId: e.categoryId, title: e.title, note: e.note, allDay: e.allDay };
    });
    if (!snap.length) { window.App.toast("Nothing selected"); return; }
    sources = snap;
    dateInput.value = "";
    weeksInput.value = "4";
    var first = card.querySelector('input[name="applyto-preset"][value="every"]');
    if (first) first.checked = true;
    backdrop.hidden = false;
    opened = true;
  }

  function close() {
    if (backdrop) backdrop.hidden = true;
    opened = false;
  }

  function isOpen() { return opened; }

  // this is the date matching

  function daysBetween(a, b) {
    return Math.round((S.parseKey(b) - S.parseKey(a)) / 86400000);
  }

  function matches(preset, anchor, d) {
    var delta = daysBetween(anchor, d);
    if (delta < 1) return false;
    if (preset === "every") return true;
    if (preset === "workdays") { var wd = S.weekdayOf(d); return wd >= 1 && wd <= 5; }
    if (preset === "everyother") return delta % 2 === 0;
    if (preset === "biweekly") return delta % 14 === 0;
    return false;
  }

  function apply() {
    var preset = card.querySelector('input[name="applyto-preset"]:checked');
    preset = preset ? preset.value : "every";
    var anchor = sources[0].date;

    var srcDates = {};
    sources.forEach(function (s) { srcDates[s.date] = true; });

    var endKey;
    if (dateInput.value) {
      endKey = dateInput.value;
    } else {
      var weeks = parseInt(weeksInput.value, 10);
      if (!(weeks > 0)) weeks = 4;
      endKey = S.addDays(anchor, weeks * 7);
    }

    var batch = [];
    var d = S.addDays(anchor, 1);
    var guard = 0;
    while (d <= endKey && guard < 1500) {
      guard++;
      if (!srcDates[d] && matches(preset, anchor, d)) {
        sources.forEach(function (s) {
          batch.push({ date: d, start: s.start, end: s.end, categoryId: s.categoryId, title: s.title, note: s.note, allDay: s.allDay });
        });
      }
      d = S.addDays(d, 1);
    }

    if (batch.length) S.addEvents(batch);
    close();
    window.App.toast("Added " + batch.length + " event" + (batch.length === 1 ? "" : "s"));
  }

  // this is the public api

  window.ApplyTo = { open: open, close: close, isOpen: isOpen };
})();
