(function () {
  "use strict";

  var T = window.Timeline;
  var S = window.Store;

  var DAY_W = 132;
  var HEAD_H = 56;
  var BAND_H = 30;
  var BAND_GAP = 4;
  var LANE_PAD = 8;
  var BAR_GAP = 4;

  var scrollEl = null;
  var savedScroll = 0;
  var lastMonth = null;

  // this is the little helpers
  function monthDays(sel) {
    var d = S.parseKey(sel);
    var y = d.getFullYear(), m = d.getMonth();
    var last = new Date(y, m + 1, 0).getDate();
    var days = [];
    for (var i = 1; i <= last; i++) {
      days.push(S.dateKey(new Date(y, m, i)));
    }
    return days;
  }

  function laneCategories() {
    return S.userCategories().filter(function (c) {
      return c.visible !== false;
    });
  }

  function durationText(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h && m) return h + "h " + m + "m";
    if (h) return h + "h";
    return m + "m";
  }

  // this is the main render
  function render(container) {
    var sel = S.getSelectedDate();
    var monthKey = sel.slice(0, 7);
    if (scrollEl && monthKey === lastMonth) savedScroll = scrollEl.scrollLeft;
    else savedScroll = 0;
    lastMonth = monthKey;
    container.innerHTML = "";

    var days = monthDays(sel);
    var lanes = laneCategories();
    var todayK = S.todayKey();

    var wrap = document.createElement("div");
    wrap.className = "tl-view calgrid";

    wrap.appendChild(buildSummary(days, lanes));

    var scroll = document.createElement("div");
    scroll.className = "tl-scroll";
    scrollEl = scroll;

    var canvas = document.createElement("div");
    canvas.className = "tl-canvas";
    canvas.style.setProperty("--day-w", DAY_W + "px");
    canvas.style.width = "calc(var(--lane-w) + " + (days.length * DAY_W) + "px)";

    canvas.appendChild(buildAxis(days, todayK));
    var body = buildBody(days, lanes, todayK);
    canvas.appendChild(body.el);
    appendTodayMarker(canvas, days, todayK, body.height);

    scroll.appendChild(canvas);
    wrap.appendChild(scroll);
    container.appendChild(wrap);

    restoreScroll(scroll, days, todayK);
  }

  // this is the summary bar up top
  function buildSummary(days, lanes) {
    var bar = document.createElement("div");
    bar.className = "tl-summary";

    var dayIndex = {};
    days.forEach(function (k, i) { dayIndex[k] = i; });

    var count = 0, planned = 0;
    S.allEvents().forEach(function (e) {
      if (dayIndex[e.date] == null) return;
      if (!S.isCategoryVisible(e.categoryId)) return;
      count++;
      planned += e.allDay ? T.DAY_MIN : Math.max(e.end - e.start, 0);
    });

    var lead = document.createElement("div");
    lead.className = "tl-summary-lead";
    var d = S.parseKey(days[0]);
    lead.textContent = S.MONTHS[d.getMonth()] + " " + d.getFullYear();

    var stats = document.createElement("div");
    stats.className = "tl-summary-stats";
    stats.appendChild(stat(String(lanes.length), lanes.length === 1 ? "calendar" : "calendars"));
    stats.appendChild(stat(String(count), count === 1 ? "block" : "blocks"));
    stats.appendChild(stat(planned ? summaryHours(planned) : "0h", "planned"));

    bar.appendChild(lead);
    bar.appendChild(stats);
    return bar;
  }

  function stat(value, label) {
    var el = document.createElement("div");
    el.className = "tl-stat";
    var v = document.createElement("span");
    v.className = "tl-stat-value tabular";
    v.textContent = value;
    var l = document.createElement("span");
    l.className = "tl-stat-label";
    l.textContent = label;
    el.appendChild(v);
    el.appendChild(l);
    return el;
  }

  function summaryHours(mins) {
    var h = mins / 60;
    if (h >= 10 || h === Math.floor(h)) return Math.round(h) + "h";
    return (Math.round(h * 10) / 10) + "h";
  }

  // this is the day axis across the top
  function buildAxis(days, todayK) {
    var axis = document.createElement("div");
    axis.className = "tl-axis";

    var corner = document.createElement("div");
    corner.className = "tl-corner";
    corner.textContent = "Calendar";
    axis.appendChild(corner);

    var track = document.createElement("div");
    track.className = "tl-axis-track";
    track.style.width = (days.length * DAY_W) + "px";

    days.forEach(function (key) {
      var dd = S.parseKey(key);
      var col = document.createElement("button");
      col.className = "tl-daycol";
      if (key === todayK) col.classList.add("is-today");
      var dow = dd.getDay();
      if (dow === 0 || dow === 6) col.classList.add("is-weekend");
      col.title = "Open " + S.prettyDate(key);

      var wd = document.createElement("span");
      wd.className = "tl-dow";
      wd.textContent = S.WEEKDAYS[dow];

      var num = document.createElement("span");
      num.className = "tl-dnum tabular";
      num.textContent = dd.getDate();

      col.appendChild(wd);
      col.appendChild(num);
      col.addEventListener("click", function () {
        S.setSelectedDate(key);
        window.Router.go("day");
      });
      track.appendChild(col);
    });

    axis.appendChild(track);
    return axis;
  }

  // this is where the lanes and blocks get drawn
  function buildBody(days, lanes, todayK) {
    var body = document.createElement("div");
    body.className = "tl-body";

    if (!lanes.length) {
      body.appendChild(buildEmpty());
      return { el: body, height: 0 };
    }

    var dayIndex = {};
    days.forEach(function (k, i) { dayIndex[k] = i; });

    var total = 0;
    lanes.forEach(function (cat) {
      var byDay = {};
      var maxBands = 1;
      S.allEvents().forEach(function (e) {
        if (e.categoryId !== cat.id || dayIndex[e.date] == null) return;
        if (!byDay[e.date]) byDay[e.date] = [];
        byDay[e.date].push(e);
      });
      Object.keys(byDay).forEach(function (key) {
        var placed = layoutDay(byDay[key]);
        placed.forEach(function (p) { if (p.band + 1 > maxBands) maxBands = p.band + 1; });
        byDay[key] = placed;
      });

      var laneH = LANE_PAD * 2 + maxBands * BAND_H + (maxBands - 1) * BAND_GAP;
      total += laneH;

      var lane = document.createElement("div");
      lane.className = "tl-lane";
      lane.style.height = laneH + "px";
      lane.style.setProperty("--ev", cat.color);

      var head = document.createElement("button");
      head.className = "tl-lane-head";
      head.title = "Edit " + cat.name;
      var dot = document.createElement("span");
      dot.className = "tl-lane-dot";
      var name = document.createElement("span");
      name.className = "tl-lane-name";
      name.textContent = cat.name;
      head.appendChild(dot);
      head.appendChild(name);
      head.addEventListener("click", function () { window.Router.go("settings"); });
      lane.appendChild(head);

      var track = document.createElement("div");
      track.className = "tl-lane-track";
      track.style.width = (days.length * DAY_W) + "px";

      days.forEach(function (key) {
        var dd = S.parseKey(key);
        var cell = document.createElement("div");
        cell.className = "tl-cell";
        var dow = dd.getDay();
        if (dow === 0 || dow === 6) cell.classList.add("is-weekend");
        if (key === todayK) cell.classList.add("is-today");
        track.appendChild(cell);
      });

      days.forEach(function (key) {
        var placed = byDay[key];
        if (!placed) return;
        placed.forEach(function (p) {
          track.appendChild(buildBar(p.ev, cat, dayIndex[key], p));
        });
      });

      lane.appendChild(track);
      body.appendChild(lane);
    });

    return { el: body, height: total };
  }

  // this is the block stacking
  function layoutDay(items) {
    var sorted = items.slice().sort(function (a, b) {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      if (a.start !== b.start) return a.start - b.start;
      return a.end - b.end;
    });
    var bandEnds = [];
    return sorted.map(function (ev) {
      var s = ev.allDay ? 0 : ev.start;
      var e = ev.allDay ? T.DAY_MIN : Math.max(ev.end, ev.start + 1);
      var band = -1;
      for (var i = 0; i < bandEnds.length; i++) {
        if (s >= bandEnds[i]) { band = i; break; }
      }
      if (band === -1) { band = bandEnds.length; bandEnds.push(0); }
      bandEnds[band] = e;
      return { ev: ev, band: band };
    });
  }

  // this is a single block on the grid
  function buildBar(ev, cat, dayIdx, spot) {
    var bar = document.createElement("button");
    bar.className = "tl-bar" + (ev.allDay ? " allday" : "");
    bar.style.setProperty("--ev", cat.color);
    bar.style.setProperty("--ev-text", T.inkFor(cat.color));
    bar.dataset.id = ev.id;

    bar.style.left = (dayIdx * DAY_W + BAR_GAP) + "px";
    bar.style.width = (DAY_W - BAR_GAP * 2) + "px";
    bar.style.top = (LANE_PAD + spot.band * (BAND_H + BAND_GAP)) + "px";
    bar.style.height = BAND_H + "px";

    var title = document.createElement("span");
    title.className = "tl-bar-title";
    title.textContent = ev.title || cat.name;
    bar.appendChild(title);

    var meta = document.createElement("span");
    meta.className = "tl-bar-time tabular";
    meta.textContent = ev.allDay ? "All day" : T.fmt12(ev.start);
    bar.appendChild(meta);

    bar.title = ev.allDay
      ? (ev.title || cat.name) + " · All day"
      : (ev.title || cat.name) + " · " + T.fmt12(ev.start) + "–" + T.fmt12(ev.end) +
        " · " + durationText(ev.end - ev.start);

    bar.addEventListener("click", function (e) {
      window.Editor.open(ev.id, e.clientX, e.clientY);
    });
    return bar;
  }

  // this is the today marker and empty state
  function appendTodayMarker(canvas, days, todayK, bodyHeight) {
    var idx = days.indexOf(todayK);
    if (idx === -1 || !bodyHeight) return;

    var band = document.createElement("div");
    band.className = "tl-now";
    band.style.left = "calc(var(--lane-w) + " + (idx * DAY_W) + "px)";
    band.style.top = HEAD_H + "px";
    band.style.width = DAY_W + "px";
    band.style.height = bodyHeight + "px";

    var flag = document.createElement("span");
    flag.className = "tl-now-flag";
    flag.textContent = "Today";
    band.appendChild(flag);
    canvas.appendChild(band);
  }

  function buildEmpty() {
    var wrap = document.createElement("div");
    wrap.className = "tl-empty";
    var art = document.createElement("div");
    art.className = "tl-empty-art";
    art.innerHTML = window.Icons.get("timeline");
    var h = document.createElement("h3");
    h.textContent = "No calendars to show";
    var p = document.createElement("p");
    p.textContent = "Turn on a calendar in the sidebar to lay its blocks out across the month.";
    wrap.appendChild(art);
    wrap.appendChild(h);
    wrap.appendChild(p);
    return wrap;
  }

  function restoreScroll(scroll, days, todayK) {
    var idx = days.indexOf(todayK);
    if (savedScroll > 0) {
      scroll.scrollLeft = savedScroll;
    } else if (idx > 2) {
      scroll.scrollLeft = Math.max(0, (idx - 1) * DAY_W);
    }
  }

  // this is the public api and registration
  window.TimelineView = { render: render };

  window.ViewRegistry.register("timeline", {
    title: "Timeline",
    render: function (c) { render(c); },
  });
})();
