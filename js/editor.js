(function () {
  "use strict";

  var T = window.Timeline;
  var S = window.Store;

  var pop = null;
  var titleEl, catEl, startEl, endEl, dateEl, noteEl, allDayEl, timesRow, deleteBtn, timerBtn, closeBtn, applyBtn;
  var editingId = null;

  // this is the popover markup and wiring

  function build() {
    pop = document.createElement("div");
    pop.className = "popover";
    pop.hidden = true;
    pop.innerHTML =
      '<div class="pop-head"><span class="pop-title">Edit event</span></div>' +
      '<div class="pop-row"><label>Title</label><input type="text" data-f="title" /></div>' +
      '<div class="pop-row"><label>Calendar</label><select data-f="cat"></select></div>' +
      '<div class="pop-row"><label>Date</label><input type="date" data-f="date" /></div>' +
      '<div class="pop-row pop-allday"><label class="check-inline"><input type="checkbox" data-f="allday" /> <span>All day</span></label></div>' +
      '<div class="pop-row pop-times">' +
        '<div><label>Start</label><input type="time" data-f="start" step="300" /></div>' +
        '<div><label>End</label><input type="time" data-f="end" step="300" /></div>' +
      '</div>' +
      '<div class="pop-row"><label>Note</label><input type="text" data-f="note" /></div>' +
      '<div class="pop-row pop-applyto"><button class="btn" data-a="applyto">Apply to…</button></div>' +
      '<div class="pop-actions">' +
        '<button class="btn btn-danger" data-a="delete">Delete</button>' +
        '<button class="btn" data-a="timer">Start Timer</button>' +
        '<button class="btn btn-primary" data-a="close">Done</button>' +
      '</div>';
    document.body.appendChild(pop);

    titleEl = pop.querySelector('[data-f="title"]');
    catEl = pop.querySelector('[data-f="cat"]');
    dateEl = pop.querySelector('[data-f="date"]');
    startEl = pop.querySelector('[data-f="start"]');
    endEl = pop.querySelector('[data-f="end"]');
    noteEl = pop.querySelector('[data-f="note"]');
    allDayEl = pop.querySelector('[data-f="allday"]');
    timesRow = pop.querySelector(".pop-times");
    deleteBtn = pop.querySelector('[data-a="delete"]');
    timerBtn = pop.querySelector('[data-a="timer"]');
    closeBtn = pop.querySelector('[data-a="close"]');
    applyBtn = pop.querySelector('[data-a="applyto"]');

    titleEl.addEventListener("input", apply);
    catEl.addEventListener("change", apply);
    dateEl.addEventListener("change", apply);
    startEl.addEventListener("change", apply);
    endEl.addEventListener("change", apply);
    noteEl.addEventListener("input", apply);
    allDayEl.addEventListener("change", apply);
    closeBtn.addEventListener("click", close);
    applyBtn.addEventListener("click", function () {
      var e = S.getEvent(editingId);
      if (!e) return;
      window.ApplyTo.open([e]);
      close();
    });
    deleteBtn.addEventListener("click", function () {
      if (editingId) S.removeEvent(editingId);
      close();
    });
    timerBtn.addEventListener("click", function () {
      var e = S.getEvent(editingId);
      if (!e) return;
      var cat = S.getCategory(e.categoryId);
      var dur = (e.end - e.start) * 60;
      window.Timers.addTimer({
        name: (e.title || (cat ? cat.name : "Block")).slice(0, 18),
        mode: "countdown",
        duration: dur,
        remaining: dur,
        blockId: e.id,
        running: true,
      });
      window.Timers.ensureAudio();
      window.App.toast("Timer started for block");
      close();
    });

    document.addEventListener("mousedown", function (e) {
      if (pop.hidden) return;
      if (pop.contains(e.target)) return;
      if (e.target.closest(".block")) return;
      if (e.target.closest(".wk-event")) return;
      close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !pop.hidden) close();
    });
  }

  // this is the little helpers

  function fillCats() {
    catEl.innerHTML = "";
    S.userCategories().forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      catEl.appendChild(opt);
    });
  }

  function timeToMin(str) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(str);
    if (!m) return null;
    return T.clamp(+m[1] * 60 + +m[2], 0, T.DAY_MIN);
  }

  // this is opening and closing the popover

  function open(id, x, y) {
    if (!pop) build();
    var e = S.getEvent(id);
    if (!e) return;
    editingId = id;
    fillCats();
    titleEl.value = e.title || "";
    catEl.value = e.categoryId;
    dateEl.value = e.date;
    startEl.value = T.fmt(e.start);
    endEl.value = T.fmt(e.end);
    noteEl.value = e.note || "";
    allDayEl.checked = !!e.allDay;
    timesRow.style.display = e.allDay ? "none" : "";
    pop.hidden = false;

    var pw = pop.offsetWidth || 280, ph = pop.offsetHeight || 340;
    var px = Math.min(x, window.innerWidth - pw - 10);
    var py = Math.min(y, window.innerHeight - ph - 10);
    pop.style.left = Math.max(10, px) + "px";
    pop.style.top = Math.max(10, py) + "px";
    titleEl.focus();
    titleEl.select();
  }

  function close() { if (pop) { pop.hidden = true; editingId = null; } }

  // this is saving edits back to the event

  function apply() {
    var e = S.getEvent(editingId);
    if (!e) return;
    var snapInc = S.getConfig().snap;
    var allDay = allDayEl.checked;
    timesRow.style.display = allDay ? "none" : "";
    var patch = {
      title: titleEl.value,
      categoryId: catEl.value,
      note: noteEl.value,
      allDay: allDay,
    };
    if (dateEl.value) patch.date = dateEl.value;
    if (allDay) {
      patch.start = 0;
      patch.end = T.DAY_MIN;
    } else {
      var sMin = timeToMin(startEl.value);
      var eMin = timeToMin(endEl.value);
      var start = sMin != null ? T.snap(sMin, snapInc) : e.start;
      var end = eMin != null ? T.snap(eMin, snapInc) : e.end;
      if (end - start < T.MIN_DUR) end = start + T.MIN_DUR;
      if (end > T.DAY_MIN) { end = T.DAY_MIN; if (start > end - T.MIN_DUR) start = end - T.MIN_DUR; }
      patch.start = start;
      patch.end = end;
    }
    S.updateEvent(editingId, patch);
  }

  // this is the public api

  window.Editor = { init: build, open: open, close: close };
})();
