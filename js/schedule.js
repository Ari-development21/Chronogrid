(function () {
  "use strict";

  var T = window.Timeline;
  var S = window.Store;

  var RANGE_DAYS = 60;
  var MAX_SECTIONS = 30;

  // this is the little formatting helpers
  function catOf(id) { return S.getCategory(id); }

  function durationText(mins) {
    if (mins <= 0) return "";
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h && m) return h + "h " + m + "m";
    if (h) return h + "h";
    return m + "m";
  }

  function relLabel(key, todayK) {
    if (key === todayK) return "Today";
    if (key === S.addDays(todayK, 1)) return "Tomorrow";
    if (key === S.addDays(todayK, -1)) return "Yesterday";
    return "";
  }

  // this is where we gather the upcoming days that have events
  function collectSections(startKey) {
    var todayK = S.todayKey();
    var sections = [];
    var key = startKey;
    for (var i = 0; i < RANGE_DAYS && sections.length < MAX_SECTIONS; i++) {
      var events = S.visibleEventsOn(key).slice().sort(function (a, b) {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        if (a.start !== b.start) return a.start - b.start;
        return a.end - b.end;
      });
      if (events.length) {
        sections.push({ key: key, events: events, rel: relLabel(key, todayK) });
      }
      key = S.addDays(key, 1);
    }
    return sections;
  }

  // this is where each row and the date column get built
  function buildDateCell(section) {
    var d = S.parseKey(section.key);
    var cell = document.createElement("div");
    cell.className = "sc-date";

    var wd = document.createElement("div");
    wd.className = "sc-weekday";
    wd.textContent = S.WEEKDAYS[d.getDay()].toUpperCase();

    var num = document.createElement("div");
    num.className = "sc-daynum tabular";
    num.textContent = d.getDate();

    var mon = document.createElement("div");
    mon.className = "sc-month";
    mon.textContent = S.MONTHS_SHORT[d.getMonth()];

    cell.appendChild(wd);
    cell.appendChild(num);
    cell.appendChild(mon);

    if (section.key === S.todayKey()) cell.classList.add("is-today");
    return cell;
  }

  function buildEventRow(ev) {
    var cat = catOf(ev.categoryId) || S.getCategories()[0];
    var color = cat ? cat.color : "#888";

    var row = document.createElement("button");
    row.className = "sc-event";
    row.style.setProperty("--ev", color);
    row.dataset.id = ev.id;

    var time = document.createElement("div");
    time.className = "sc-time tabular";
    if (ev.allDay) {
      time.classList.add("allday");
      time.textContent = "All day";
    } else {
      var top = document.createElement("span");
      top.className = "sc-start";
      top.textContent = T.fmt12(ev.start);
      var bot = document.createElement("span");
      bot.className = "sc-end";
      bot.textContent = T.fmt12(ev.end);
      time.appendChild(top);
      time.appendChild(bot);
    }

    var dot = document.createElement("span");
    dot.className = "sc-dot";

    var body = document.createElement("div");
    body.className = "sc-body";
    var title = document.createElement("div");
    title.className = "sc-title";
    title.textContent = ev.title || (cat ? cat.name : "Untitled");
    body.appendChild(title);

    var meta = document.createElement("div");
    meta.className = "sc-meta";
    var catName = document.createElement("span");
    catName.className = "sc-cat";
    catName.textContent = cat ? cat.name : "";
    meta.appendChild(catName);
    if (!ev.allDay) {
      var dur = document.createElement("span");
      dur.className = "sc-dur";
      dur.textContent = durationText(ev.end - ev.start);
      meta.appendChild(dur);
    }
    body.appendChild(meta);

    row.appendChild(time);
    row.appendChild(dot);
    row.appendChild(body);

    row.addEventListener("click", function (e) {
      window.Editor.open(ev.id, e.clientX, e.clientY);
    });
    return row;
  }

  // this is the empty state when nothing is coming up
  function buildEmpty(startKey) {
    var wrap = document.createElement("div");
    wrap.className = "sc-empty";

    var art = document.createElement("div");
    art.className = "sc-empty-art";
    art.innerHTML = window.Icons.get("schedule");

    var h = document.createElement("h3");
    h.textContent = "Nothing on the horizon";

    var p = document.createElement("p");
    var d = S.parseKey(startKey);
    p.textContent = "No events from " + S.MONTHS[d.getMonth()] + " " + d.getDate() +
      " through the next " + RANGE_DAYS + " days.";

    var btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = "Add an event";
    btn.addEventListener("click", function (e) {
      var start = 9 * 60;
      var ev = S.addEvent({ date: startKey, start: start, end: start + 60, categoryId: S.firstUserCategoryId(), title: "" });
      window.Editor.open(ev.id, e.clientX, e.clientY);
    });

    wrap.appendChild(art);
    wrap.appendChild(h);
    wrap.appendChild(p);
    wrap.appendChild(btn);
    return wrap;
  }

  // this is where the whole schedule list gets drawn
  function render(container) {
    container.innerHTML = "";
    var startKey = S.getSelectedDate();

    var wrap = document.createElement("div");
    wrap.className = "schedule-view calgrid";

    var scroll = document.createElement("div");
    scroll.className = "scroll-region";

    var sections = collectSections(startKey);

    if (!sections.length) {
      scroll.appendChild(buildEmpty(startKey));
      wrap.appendChild(scroll);
      container.appendChild(wrap);
      return;
    }

    var list = document.createElement("div");
    list.className = "sc-list";

    sections.forEach(function (section) {
      var block = document.createElement("section");
      block.className = "sc-section";
      if (section.key === S.todayKey()) block.classList.add("is-today");

      var head = document.createElement("div");
      head.className = "sc-head";
      var full = document.createElement("span");
      full.className = "sc-head-date tabular";
      full.textContent = S.prettyDate(section.key);
      head.appendChild(full);
      if (section.rel) {
        var badge = document.createElement("span");
        badge.className = "sc-rel";
        if (section.rel === "Today") badge.classList.add("is-today");
        badge.textContent = section.rel;
        head.appendChild(badge);
      }
      var count = document.createElement("span");
      count.className = "sc-count";
      count.textContent = section.events.length + (section.events.length === 1 ? " event" : " events");
      head.appendChild(count);

      var rowWrap = document.createElement("div");
      rowWrap.className = "sc-rows";

      var dateCell = buildDateCell(section);
      var events = document.createElement("div");
      events.className = "sc-events";
      section.events.forEach(function (ev) {
        events.appendChild(buildEventRow(ev));
      });
      rowWrap.appendChild(dateCell);
      rowWrap.appendChild(events);

      block.appendChild(head);
      block.appendChild(rowWrap);
      list.appendChild(block);
    });

    scroll.appendChild(list);
    wrap.appendChild(scroll);
    container.appendChild(wrap);
  }

  // this is the public api and registration
  window.ScheduleView = { render: render };

  window.ViewRegistry.register("schedule", {
    title: "Schedule",
    render: function (c) { render(c); },
  });
})();
