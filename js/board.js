(function () {
  "use strict";

  var S = window.Store;
  var T = window.Timeline;

  var container = null;
  var drag = null;
  var dragEndedAt = 0;

  // this is the little helpers
  function catOf(id) { return S.getCategory(id); }

  function weekDays() {
    var cfg = S.getConfig();
    var startKey = S.weekStart(S.getSelectedDate(), cfg.weekStartDay);
    var days = [];
    for (var i = 0; i < 7; i++) days.push(S.addDays(startKey, i));
    return days;
  }

  function durationLabel(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h && m) return h + "h " + m + "m";
    if (h) return h + "h";
    return m + "m";
  }

  function sortEvents(list) {
    return list.slice().sort(function (a, b) {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.start - b.start;
    });
  }

  // this is where each event card gets built
  function makeCard(ev) {
    var cat = catOf(ev.categoryId) || S.getCategories()[0];
    var card = document.createElement("div");
    card.className = "bd-card" + (ev.allDay ? " allday" : "");
    card.dataset.id = ev.id;
    card.style.setProperty("--ev", cat ? cat.color : "#888");
    card.tabIndex = 0;

    var stripe = document.createElement("span");
    stripe.className = "bd-stripe";
    card.appendChild(stripe);

    var body = document.createElement("div");
    body.className = "bd-card-body";

    var titleEl = document.createElement("div");
    titleEl.className = "bd-card-title";
    titleEl.textContent = ev.title || (cat ? cat.name : "Untitled");
    body.appendChild(titleEl);

    var meta = document.createElement("div");
    meta.className = "bd-card-meta tabular";
    if (ev.allDay) {
      var allday = document.createElement("span");
      allday.className = "bd-card-time";
      allday.textContent = "All day";
      meta.appendChild(allday);
    } else {
      var time = document.createElement("span");
      time.className = "bd-card-time";
      time.textContent = T.fmt12(ev.start) + " – " + T.fmt12(ev.end);
      meta.appendChild(time);
      var dur = document.createElement("span");
      dur.className = "bd-card-dur";
      dur.textContent = durationLabel(ev.end - ev.start);
      meta.appendChild(dur);
    }
    body.appendChild(meta);
    card.appendChild(body);

    card.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      beginDrag(e, ev.id);
    });
    card.addEventListener("click", function (e) {
      if (Date.now() - dragEndedAt < 300) return;
      window.Editor.open(ev.id, e.clientX, e.clientY);
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        var r = card.getBoundingClientRect();
        window.Editor.open(ev.id, r.left + 20, r.top + 20);
      }
    });

    return card;
  }

  // this is adding a new block to a day
  function addCard(dayKey) {
    var cfg = S.getConfig();
    var start = 9 * 60;
    if (dayKey === S.todayKey()) {
      var now = new Date();
      start = T.snap(T.clamp(now.getHours() * 60, cfg.dayStart * 60, cfg.dayEnd * 60 - 60), cfg.snap);
    }
    start = T.clamp(start, cfg.dayStart * 60, cfg.dayEnd * 60 - 60);
    var end = Math.min(start + 60, cfg.dayEnd * 60);
    var ev = S.addEvent({ date: dayKey, start: start, end: end, categoryId: S.firstUserCategoryId(), title: "" });
    var el = container.querySelector('.bd-card[data-id="' + ev.id + '"]');
    var r = el ? el.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
    window.Editor.open(ev.id, r.left + 12, r.top + 12);
  }

  // this is the drag and drop
  function beginDrag(e, id) {
    drag = { id: id, startX: e.clientX, startY: e.clientY, moved: false, targetKey: null };
    e.preventDefault();
  }

  function colUnderPoint(x, y) {
    var el = document.elementFromPoint(x, y);
    return el ? el.closest(".bd-col") : null;
  }

  function clearDropTargets() {
    if (!container) return;
    var over = container.querySelectorAll(".bd-col.drop-over");
    over.forEach(function (n) { n.classList.remove("drop-over"); });
  }

  var dragWired = false;
  function wireDrag() {
    if (dragWired) return;
    dragWired = true;

    window.addEventListener("mousemove", function (e) {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.abs(e.clientX - drag.startX) < 4 && Math.abs(e.clientY - drag.startY) < 4) return;
        drag.moved = true;
        var card = container.querySelector('.bd-card[data-id="' + drag.id + '"]');
        if (card) card.classList.add("dragging");
      }
      var col = colUnderPoint(e.clientX, e.clientY);
      drag.targetKey = col ? col.dataset.date : null;
      clearDropTargets();
      if (col) col.classList.add("drop-over");
    });

    window.addEventListener("mouseup", function () {
      if (!drag) return;
      var d = drag;
      drag = null;
      clearDropTargets();
      var card = container.querySelector('.bd-card[data-id="' + d.id + '"]');
      if (card) card.classList.remove("dragging");
      if (!d.moved) return;
      dragEndedAt = Date.now();
      if (!d.targetKey) return;
      var ev = S.getEvent(d.id);
      if (!ev || ev.date === d.targetKey) return;
      S.updateEvent(d.id, { date: d.targetKey });
      window.App.toast("Moved to " + S.WEEKDAYS_FULL[S.weekdayOf(d.targetKey)]);
    });
  }

  // this is where each day column gets built
  function buildColumn(dayKey) {
    var d = S.parseKey(dayKey);
    var isToday = dayKey === S.todayKey();
    var events = sortEvents(S.visibleEventsOn(dayKey));

    var totalMin = 0;
    events.forEach(function (ev) {
      if (!ev.allDay) totalMin += ev.end - ev.start;
    });

    var col = document.createElement("section");
    col.className = "bd-col" + (isToday ? " is-today" : "");
    col.dataset.date = dayKey;

    var head = document.createElement("header");
    head.className = "bd-col-head";

    var dayBtn = document.createElement("button");
    dayBtn.className = "bd-col-day";
    dayBtn.title = "Open " + S.prettyDate(dayKey) + " in Day view";
    var dow = document.createElement("span");
    dow.className = "bd-dow";
    dow.textContent = S.WEEKDAYS[d.getDay()];
    var num = document.createElement("span");
    num.className = "bd-daynum tabular";
    num.textContent = d.getDate();
    dayBtn.appendChild(dow);
    dayBtn.appendChild(num);
    dayBtn.addEventListener("click", function () {
      S.setSelectedDate(dayKey);
      window.Router.go("day");
    });
    head.appendChild(dayBtn);

    var total = document.createElement("span");
    total.className = "bd-col-total tabular";
    total.textContent = totalMin ? durationLabel(totalMin) : "—";
    total.title = events.length + " event" + (events.length === 1 ? "" : "s");
    head.appendChild(total);
    col.appendChild(head);

    var list = document.createElement("div");
    list.className = "bd-col-list";
    if (!events.length) {
      var empty = document.createElement("div");
      empty.className = "bd-empty";
      empty.textContent = "No blocks";
      list.appendChild(empty);
    } else {
      events.forEach(function (ev) { list.appendChild(makeCard(ev)); });
    }
    col.appendChild(list);

    var add = document.createElement("button");
    add.className = "bd-add";
    add.innerHTML = window.Icons.get("plus") + "<span>Add block</span>";
    add.addEventListener("click", function () { addCard(dayKey); });
    col.appendChild(add);

    return col;
  }

  // this is where the whole week board gets drawn
  function render(c) {
    container = c;
    container.innerHTML = "";

    var wrap = document.createElement("div");
    wrap.className = "board-view";

    var track = document.createElement("div");
    track.className = "bd-track scroll-region";

    weekDays().forEach(function (dayKey) {
      track.appendChild(buildColumn(dayKey));
    });

    wrap.appendChild(track);
    container.appendChild(wrap);

    wireDrag();
  }

  // this is the public api and registration
  window.BoardView = { render: render };

  window.ViewRegistry.register("board", {
    title: "Board",
    render: function (c) { render(c); },
  });
})();
