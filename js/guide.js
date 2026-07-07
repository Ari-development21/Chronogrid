(function () {
  "use strict";

  var S = window.Store;

  // this is the tour steps
  var steps = [
    {
      selector: "#btnCreate",
      route: "week",
      title: "Create anything",
      body: "Start a new event from here. It drops onto the day you have selected, ready to name.",
    },
    {
      selector: "#miniCal",
      route: "week",
      title: "Jump to a date",
      body: "Pick any day in the mini-calendar and every view follows along.",
    },
    {
      selector: ".cal-list",
      route: "week",
      title: "Your calendars",
      body: "Each category has a colour. Tick one off to hide its events across all views.",
    },
    {
      selector: ".wk-scroll",
      route: "week",
      title: "The week grid",
      body: "Click and drag on an empty slot to block out time, then drag an event to reschedule it.",
    },
    {
      selector: ".month-grid",
      route: "month",
      title: "Month at a glance",
      body: "Zoom out to see the whole month and spot where your week is heading.",
    },
    {
      selector: ".analytics-view",
      route: "analytics",
      title: "Where your time goes",
      body: "Analytics breaks your logged hours down by category so you can rebalance.",
    },
    {
      selector: ".settings-view",
      route: "settings",
      title: "Make it yours",
      body: "Set your time zone, working hours, categories, and theme in Settings.",
    },
    {
      selector: "#btnHelp",
      route: "settings",
      title: "Replay any time",
      body: "That is the tour. Tap this button whenever you want to walk through it again.",
    },
  ];

  var overlay, spotlight, card, titleEl, bodyEl, counterEl, backBtn, nextBtn, skipBtn;
  var index = 0;
  var token = 0;
  var active = false;
  var pad = 8;

  // this is where the overlay gets built
  function build() {
    overlay = document.createElement("div");
    overlay.className = "guide-overlay";
    overlay.hidden = true;

    spotlight = document.createElement("div");
    spotlight.className = "guide-spotlight";

    card = document.createElement("div");
    card.className = "guide-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.innerHTML =
      '<button class="guide-close" type="button" aria-label="Close tour">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>' +
      '<div class="guide-title"></div>' +
      '<p class="guide-body"></p>' +
      '<div class="guide-foot">' +
        '<span class="guide-counter"></span>' +
        '<div class="guide-btns">' +
          '<button class="guide-btn guide-back" type="button">Back</button>' +
          '<button class="guide-btn guide-skip" type="button">Skip</button>' +
          '<button class="guide-btn guide-next guide-primary" type="button">Next</button>' +
        '</div>' +
      '</div>';

    overlay.appendChild(spotlight);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    titleEl = card.querySelector(".guide-title");
    bodyEl = card.querySelector(".guide-body");
    counterEl = card.querySelector(".guide-counter");
    backBtn = card.querySelector(".guide-back");
    nextBtn = card.querySelector(".guide-next");
    skipBtn = card.querySelector(".guide-skip");

    backBtn.addEventListener("click", function () { goTo(index - 1); });
    nextBtn.addEventListener("click", function () {
      if (index >= steps.length - 1) finish();
      else goTo(index + 1);
    });
    skipBtn.addEventListener("click", finish);
    card.querySelector(".guide-close").addEventListener("click", finish);

    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
  }

  // this is the keyboard and resize handling
  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") { finish(); return; }
    if (e.key === "ArrowRight") { nextBtn.click(); }
    else if (e.key === "ArrowLeft" && index > 0) { goTo(index - 1); }
  }

  function onResize() {
    if (active) place();
  }

  function navigateIfNeeded(route, done) {
    if (!route || window.Router.current() === route) { done(); return; }
    window.Router.go(route);
    setTimeout(done, 60);
  }

  function target() {
    return document.querySelector(steps[index].selector);
  }

  // this is the step navigation and placement
  function goTo(i) {
    if (i < 0) i = 0;
    if (i > steps.length - 1) i = steps.length - 1;
    index = i;
    var mine = ++token;
    navigateIfNeeded(steps[index].route, function () {
      if (!active || mine !== token) return;
      if (!target()) {
        if (index === steps.length - 1) { finish(); return; }
        goTo(index + 1);
        return;
      }
      renderStep();
    });
  }

  function renderStep() {
    var step = steps[index];
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    counterEl.textContent = (index + 1) + " of " + steps.length;
    backBtn.disabled = index === 0;
    nextBtn.textContent = index === steps.length - 1 ? "Done" : "Next";
    place();
  }

  function place() {
    var el = target();
    if (!el) return;
    var r = el.getBoundingClientRect();
    var top = Math.max(r.top - pad, 4);
    var left = Math.max(r.left - pad, 4);
    var width = Math.min(r.width + pad * 2, window.innerWidth - left - 4);
    var height = Math.min(r.height + pad * 2, window.innerHeight - top - 4);

    spotlight.style.top = top + "px";
    spotlight.style.left = left + "px";
    spotlight.style.width = width + "px";
    spotlight.style.height = height + "px";

    placeCard(top, left, width, height);
  }

  function placeCard(top, left, width, height) {
    var cw = card.offsetWidth || 300;
    var ch = card.offsetHeight || 180;
    var gap = 14;
    var vw = window.innerWidth, vh = window.innerHeight;

    var cx = left, cy;
    var below = top + height + gap;
    var above = top - ch - gap;
    var right = left + width + gap;

    if (below + ch <= vh - 8) {
      cy = below;
    } else if (above >= 8) {
      cy = above;
    } else if (right + cw <= vw - 8) {
      cx = right;
      cy = top;
    } else {
      cx = left - cw - gap;
      cy = top;
    }

    cx = clamp(cx, 8, Math.max(8, vw - cw - 8));
    cy = clamp(cy, 8, Math.max(8, vh - ch - 8));

    card.style.left = cx + "px";
    card.style.top = cy + "px";
  }

  function clamp(v, lo, hi) {
    if (hi < lo) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  // this is the start and finish
  function start() {
    if (!overlay) build();
    active = true;
    overlay.hidden = false;
    document.body.classList.add("guide-open");
    goTo(0);
  }

  function finish() {
    active = false;
    token++;
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("guide-open");
    S.setConfig({ guideSeen: true });
  }

  function maybeAutoStart() {
    var cfg = S.getConfig();
    if (cfg && cfg.guideSeen === true) return;
    start();
  }

  // this is the public api
  window.Guide = { start: start, maybeAutoStart: maybeAutoStart };
})();
