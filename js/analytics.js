(function () {
  "use strict";

  var S = window.Store;

  var container = null;
  var mode = "week";

  // this is the period math and data crunching
  function catOf(id) { return S.getCategory(id); }

  function periodDays() {
    var cfg = S.getConfig();
    var sel = S.getSelectedDate();
    var keys = [];
    if (mode === "week") {
      var start = S.weekStart(sel, cfg.weekStartDay);
      for (var i = 0; i < 7; i++) keys.push(S.addDays(start, i));
    } else {
      var d = S.parseKey(sel);
      var y = d.getFullYear(), m = d.getMonth();
      var last = new Date(y, m + 1, 0).getDate();
      for (var day = 1; day <= last; day++) {
        keys.push(S.dateKey(new Date(y, m, day)));
      }
    }
    return keys;
  }

  function periodLabel(keys) {
    if (mode === "month") {
      var d = S.parseKey(keys[0]);
      return S.MONTHS[d.getMonth()] + " " + d.getFullYear();
    }
    var a = S.parseKey(keys[0]), b = S.parseKey(keys[keys.length - 1]);
    var am = S.MONTHS_SHORT[a.getMonth()], bm = S.MONTHS_SHORT[b.getMonth()];
    if (a.getFullYear() !== b.getFullYear()) {
      return am + " " + a.getDate() + ", " + a.getFullYear() + " – " + bm + " " + b.getDate() + ", " + b.getFullYear();
    }
    if (a.getMonth() === b.getMonth()) {
      return am + " " + a.getDate() + " – " + b.getDate() + ", " + b.getFullYear();
    }
    return am + " " + a.getDate() + " – " + bm + " " + b.getDate() + ", " + b.getFullYear();
  }

  function stepPeriod(dir) {
    var sel = S.getSelectedDate();
    if (mode === "week") {
      S.setSelectedDate(S.addDays(sel, 7 * dir));
    } else {
      var d = S.parseKey(sel);
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      S.setSelectedDate(S.dateKey(d));
    }
  }

  function durationMin(ev) {
    if (ev.allDay) return 0;
    return Math.max(0, ev.end - ev.start);
  }

  function collect(keys) {
    var cats = S.userCategories();
    var byCat = {};
    cats.forEach(function (c) { byCat[c.id] = 0; });

    var perDay = keys.map(function (k) { return { key: k, minutes: 0, allDay: 0 }; });
    var focusMin = 0, otherMin = 0;
    var total = 0;
    var busiest = null;
    var eventCount = 0;
    var timed = [];

    keys.forEach(function (k, idx) {
      var events = S.visibleEventsOn(k);
      events.forEach(function (ev) {
        var mins = durationMin(ev);
        if (ev.allDay) { perDay[idx].allDay++; return; }
        if (mins <= 0) return;
        eventCount++;
        total += mins;
        perDay[idx].minutes += mins;
        if (byCat[ev.categoryId] == null) byCat[ev.categoryId] = 0;
        byCat[ev.categoryId] += mins;
        var cat = catOf(ev.categoryId);
        if (cat && cat.intensive) focusMin += mins; else otherMin += mins;
        timed.push({ ev: ev, minutes: mins });
      });
    });

    perDay.forEach(function (d) {
      if (!busiest || d.minutes > busiest.minutes) busiest = d;
    });

    var catRows = cats
      .map(function (c) { return { cat: c, minutes: byCat[c.id] || 0 }; })
      .filter(function (r) { return r.minutes > 0; })
      .sort(function (a, b) { return b.minutes - a.minutes; });

    timed.sort(function (a, b) {
      return b.minutes - a.minutes || a.ev.date.localeCompare(b.ev.date) || a.ev.start - b.ev.start;
    });

    return {
      total: total,
      catRows: catRows,
      perDay: perDay,
      focusMin: focusMin,
      otherMin: otherMin,
      busiest: busiest,
      eventCount: eventCount,
      topSessions: timed.slice(0, 5),
    };
  }

  function fmtHours(min) {
    var h = min / 60;
    if (h === 0) return "0h";
    if (h < 10) return (Math.round(h * 10) / 10) + "h";
    return Math.round(h) + "h";
  }

  function fmtHM(min) {
    var h = Math.floor(min / 60);
    var m = Math.round(min % 60);
    if (m === 60) { h++; m = 0; }
    if (h === 0) return m + "m";
    if (m === 0) return h + "h";
    return h + "h " + m + "m";
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // this is the main render
  function render(c) {
    if (c) container = c;
    if (!container) return;
    container.innerHTML = "";

    var keys = periodDays();
    var data = collect(keys);

    var view = el("div", "analytics-view");

    var scroll = el("div", "an-scroll");
    var inner = el("div", "an-inner");

    inner.appendChild(header(keys));
    inner.appendChild(kpiRow(data, keys));

    var grid = el("div", "an-grid");
    grid.appendChild(categoryPanel(data));
    grid.appendChild(splitPanel(data));
    grid.appendChild(sessionsPanel(data));
    grid.appendChild(trendPanel(data, keys));
    inner.appendChild(grid);

    scroll.appendChild(inner);
    view.appendChild(scroll);
    container.appendChild(view);
  }

  // this is the header with the week/month toggle and nav
  function header(keys) {
    var head = el("div", "an-head");

    var left = el("div", "an-head-left");
    var title = el("div", "an-period tabular", periodLabel(keys));
    var sub = el("div", "an-period-sub", mode === "week" ? "Weekly time allocation" : "Monthly time allocation");
    left.appendChild(title);
    left.appendChild(sub);

    var right = el("div", "an-head-right");

    var seg = el("div", "an-seg");
    [["week", "Week"], ["month", "Month"]].forEach(function (pair) {
      var b = el("button", "an-seg-btn" + (mode === pair[0] ? " on" : ""), pair[1]);
      b.addEventListener("click", function () {
        if (mode === pair[0]) return;
        mode = pair[0];
        render();
      });
      seg.appendChild(b);
    });

    var nav = el("div", "an-nav");
    var prev = el("button", "btn btn-icon");
    prev.setAttribute("aria-label", "Previous period");
    prev.innerHTML = window.Icons.get("chevronLeft");
    prev.addEventListener("click", function () { stepPeriod(-1); });
    var today = el("button", "btn", "This " + (mode === "week" ? "week" : "month"));
    today.addEventListener("click", function () { S.setSelectedDate(S.todayKey()); });
    var next = el("button", "btn btn-icon");
    next.setAttribute("aria-label", "Next period");
    next.innerHTML = window.Icons.get("chevronRight");
    next.addEventListener("click", function () { stepPeriod(1); });
    nav.appendChild(prev);
    nav.appendChild(today);
    nav.appendChild(next);

    right.appendChild(seg);
    right.appendChild(nav);

    head.appendChild(left);
    head.appendChild(right);
    return head;
  }

  // this is the kpi cards up top
  function kpiRow(data, keys) {
    var row = el("div", "an-kpis");

    var scheduledDays = data.perDay.filter(function (d) { return d.minutes > 0; }).length;
    var avg = scheduledDays ? data.total / scheduledDays : 0;
    var focusPct = data.total ? Math.round((data.focusMin / data.total) * 100) : 0;

    row.appendChild(kpiCard("Scheduled", fmtHM(data.total), data.eventCount + " event" + (data.eventCount === 1 ? "" : "s"), "brand"));
    row.appendChild(kpiCard("Busiest day", busiestLabel(data.busiest), data.busiest && data.busiest.minutes ? fmtHM(data.busiest.minutes) : "—", "amber"));
    row.appendChild(kpiCard("Focus time", focusPct + "%", fmtHM(data.focusMin) + " deep work", "focus"));
    row.appendChild(kpiCard("Daily average", fmtHM(Math.round(avg)), scheduledDays + " active day" + (scheduledDays === 1 ? "" : "s"), "teal"));

    return row;
  }

  function busiestLabel(day) {
    if (!day || !day.minutes) return "None";
    var d = S.parseKey(day.key);
    return S.WEEKDAYS[d.getDay()] + " " + d.getDate();
  }

  function kpiCard(label, value, sub, tone) {
    var card = el("div", "an-kpi tone-" + tone);
    card.appendChild(el("div", "an-kpi-label", label));
    card.appendChild(el("div", "an-kpi-value tabular", value));
    card.appendChild(el("div", "an-kpi-sub", sub));
    return card;
  }

  // this is the hours by calendar panel
  function categoryPanel(data) {
    var panel = el("section", "panel an-panel an-cat-panel");
    panel.appendChild(el("h3", null, "Hours by calendar"));
    panel.appendChild(el("p", "panel-note", "Scheduled time split across your categories."));

    if (!data.catRows.length) {
      panel.appendChild(el("div", "panel-empty", "No scheduled events in this period."));
      return panel;
    }

    var max = data.catRows[0].minutes || 1;
    var list = el("div", "an-bars");

    data.catRows.forEach(function (r) {
      var pct = data.total ? Math.round((r.minutes / data.total) * 100) : 0;
      var w = (r.minutes / max) * 100;

      var rowEl = el("div", "an-bar-row");

      var head = el("div", "an-bar-head");
      var name = el("div", "an-bar-name");
      var dot = el("span", "an-dot");
      dot.style.setProperty("--dot", r.cat.color);
      name.appendChild(dot);
      name.appendChild(el("span", "an-bar-label", r.cat.name));
      var val = el("div", "an-bar-val tabular");
      val.appendChild(el("span", "an-bar-hours", fmtHM(r.minutes)));
      val.appendChild(el("span", "an-bar-pct", pct + "%"));
      head.appendChild(name);
      head.appendChild(val);

      var track = el("div", "an-bar-track");
      var fill = el("div", "an-bar-fill");
      fill.style.setProperty("--ev", r.cat.color);
      fill.style.width = w + "%";
      track.appendChild(fill);

      rowEl.appendChild(head);
      rowEl.appendChild(track);
      list.appendChild(rowEl);
    });

    panel.appendChild(list);
    return panel;
  }

  // this is the focus vs meetings donut
  function splitPanel(data) {
    var panel = el("section", "panel an-panel an-split-panel");
    panel.appendChild(el("h3", null, "Focus vs. meetings"));
    panel.appendChild(el("p", "panel-note", "Deep-work categories against everything else."));

    var body = el("div", "an-split-body");

    if (!data.total) {
      panel.appendChild(el("div", "panel-empty", "No scheduled events in this period."));
      return panel;
    }

    var focusPct = data.focusMin / data.total;
    var otherPct = 1 - focusPct;

    var focusColor = "var(--brand)";
    var otherColor = "var(--text-3)";

    body.appendChild(donut(focusPct, focusColor, otherColor, Math.round(focusPct * 100)));

    var legend = el("div", "an-legend");
    legend.appendChild(legendRow(focusColor, "Focus", fmtHM(data.focusMin), Math.round(focusPct * 100)));
    legend.appendChild(legendRow(otherColor, "Meetings & admin", fmtHM(data.otherMin), Math.round(otherPct * 100)));
    body.appendChild(legend);

    panel.appendChild(body);
    return panel;
  }

  function donut(frac, color, restColor, pctLabel) {
    var size = 148, sw = 20, r = (size - sw) / 2, cx = size / 2, cy = size / 2;
    var circ = 2 * Math.PI * r;
    var dash = Math.max(0, Math.min(1, frac)) * circ;

    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("class", "an-donut");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", pctLabel + "% focus");

    var bg = document.createElementNS(ns, "circle");
    bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
    bg.setAttribute("fill", "none");
    bg.setAttribute("stroke", restColor);
    bg.setAttribute("stroke-width", sw);

    var fg = document.createElementNS(ns, "circle");
    fg.setAttribute("cx", cx); fg.setAttribute("cy", cy); fg.setAttribute("r", r);
    fg.setAttribute("fill", "none");
    fg.setAttribute("stroke", color);
    fg.setAttribute("stroke-width", sw);
    fg.setAttribute("stroke-linecap", "round");
    fg.setAttribute("stroke-dasharray", dash + " " + (circ - dash));
    fg.setAttribute("stroke-dashoffset", circ / 4);
    fg.setAttribute("transform", "rotate(-90 " + cx + " " + cy + ")");
    fg.setAttribute("class", "an-donut-arc");

    var wrap = el("div", "an-donut-wrap");
    svg.appendChild(bg);
    svg.appendChild(fg);
    wrap.appendChild(svg);

    var center = el("div", "an-donut-center");
    center.appendChild(el("div", "an-donut-pct tabular", pctLabel + "%"));
    center.appendChild(el("div", "an-donut-cap", "focus"));
    wrap.appendChild(center);

    return wrap;
  }

  function legendRow(color, label, value, pct) {
    var row = el("div", "an-legend-row");
    var sw = el("span", "an-legend-sw");
    sw.style.background = color;
    var name = el("span", "an-legend-name", label);
    var val = el("span", "an-legend-val tabular", value + " · " + pct + "%");
    row.appendChild(sw);
    row.appendChild(name);
    row.appendChild(val);
    return row;
  }

  // this is the longest sessions list
  function sessionsPanel(data) {
    var panel = el("section", "panel an-panel an-sessions-panel");
    panel.appendChild(el("h3", null, "Longest sessions"));
    panel.appendChild(el("p", "panel-note", "Your deepest blocks this period. Select one to edit it."));

    if (!data.topSessions.length) {
      panel.appendChild(el("div", "panel-empty", "No scheduled events in this period."));
      return panel;
    }

    var list = el("div", "an-sessions");
    data.topSessions.forEach(function (row) {
      var ev = row.ev;
      var cat = catOf(ev.categoryId);
      var d = S.parseKey(ev.date);

      var item = el("button", "an-session");
      item.setAttribute("aria-label", "Edit " + (ev.title || (cat ? cat.name : "event")));

      var bar = el("span", "an-session-bar");
      bar.style.background = cat ? cat.color : "var(--brand)";

      var body = el("span", "an-session-body");
      var titleText = ev.title || (cat ? cat.name : "Untitled");
      body.appendChild(el("span", "an-session-title", titleText));
      var meta = S.WEEKDAYS[d.getDay()] + " " + S.MONTHS_SHORT[d.getMonth()] + " " + d.getDate() +
        " · " + window.Timeline.fmt12(ev.start) + "–" + window.Timeline.fmt12(ev.end);
      body.appendChild(el("span", "an-session-meta tabular", meta));

      var dur = el("span", "an-session-dur tabular", fmtHM(row.minutes));

      item.appendChild(bar);
      item.appendChild(body);
      item.appendChild(dur);
      item.addEventListener("click", (function (id) {
        return function (e) {
          window.Editor.open(id, e.clientX, e.clientY);
        };
      })(ev.id));
      list.appendChild(item);
    });

    panel.appendChild(list);
    return panel;
  }

  // this is the hours-per-day trend chart
  function trendPanel(data, keys) {
    var panel = el("section", "panel an-panel an-trend-panel");
    panel.appendChild(el("h3", null, "Scheduled hours per day"));
    panel.appendChild(el("p", "panel-note", mode === "week" ? "Total booked time across the week." : "Total booked time across the month."));

    var maxMin = 0;
    data.perDay.forEach(function (d) { if (d.minutes > maxMin) maxMin = d.minutes; });

    if (maxMin === 0) {
      panel.appendChild(el("div", "panel-empty", "No scheduled events in this period."));
      return panel;
    }

    var topHours = Math.max(1, Math.ceil(maxMin / 60));
    var yMax = topHours * 60;

    panel.appendChild(mode === "week" ? weekTrend(data, yMax, topHours) : monthTrend(data, yMax, topHours));
    return panel;
  }

  function weekTrend(data, yMax, topHours) {
    var W = 640, H = 220, padL = 34, padR = 12, padT = 12, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var n = data.perDay.length;
    var ns = "http://www.w3.org/2000/svg";

    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "an-chart");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Scheduled hours per day");

    var todayK = S.todayKey();

    for (var g = 0; g <= topHours; g++) {
      var gy = padT + plotH - (g / topHours) * plotH;
      var line = document.createElementNS(ns, "line");
      line.setAttribute("x1", padL); line.setAttribute("x2", W - padR);
      line.setAttribute("y1", gy); line.setAttribute("y2", gy);
      line.setAttribute("class", "an-grid-line");
      svg.appendChild(line);
      var lbl = document.createElementNS(ns, "text");
      lbl.setAttribute("x", padL - 8); lbl.setAttribute("y", gy + 3);
      lbl.setAttribute("text-anchor", "end");
      lbl.setAttribute("class", "an-axis-text");
      lbl.textContent = g + "h";
      svg.appendChild(lbl);
    }

    function px(i) { return padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW); }
    function py(min) { return padT + plotH - (min / yMax) * plotH; }

    var areaPts = [];
    var linePts = [];
    data.perDay.forEach(function (d, i) {
      var x = px(i), y = py(d.minutes);
      linePts.push(x + "," + y);
      areaPts.push([x, y]);
    });

    var areaD = "M" + padL + "," + (padT + plotH);
    areaPts.forEach(function (p) { areaD += " L" + p[0] + "," + p[1]; });
    areaD += " L" + (W - padR) + "," + (padT + plotH) + " Z";
    var area = document.createElementNS(ns, "path");
    area.setAttribute("d", areaD);
    area.setAttribute("class", "an-area");
    svg.appendChild(area);

    var poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", linePts.join(" "));
    poly.setAttribute("class", "an-line");
    svg.appendChild(poly);

    data.perDay.forEach(function (d, i) {
      var x = px(i), y = py(d.minutes);
      var isToday = d.key === todayK;
      var dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", x); dot.setAttribute("cy", y);
      dot.setAttribute("r", isToday ? 5 : 3.5);
      dot.setAttribute("class", "an-dot-pt" + (isToday ? " today" : ""));
      var t = document.createElementNS(ns, "title");
      t.textContent = S.prettyDate(d.key) + " — " + fmtHM(d.minutes);
      dot.appendChild(t);
      svg.appendChild(dot);

      var wd = S.parseKey(d.key);
      var xlbl = document.createElementNS(ns, "text");
      xlbl.setAttribute("x", x); xlbl.setAttribute("y", H - 8);
      xlbl.setAttribute("text-anchor", "middle");
      xlbl.setAttribute("class", "an-axis-text" + (isToday ? " today" : ""));
      xlbl.textContent = S.WEEKDAYS[wd.getDay()];
      svg.appendChild(xlbl);
    });

    var box = el("div", "an-chart-box");
    box.appendChild(svg);
    return box;
  }

  function monthTrend(data, yMax, topHours) {
    var wrap = el("div", "an-monthbars");
    var todayK = S.todayKey();
    var maxMin = yMax;

    data.perDay.forEach(function (d) {
      var col = el("div", "an-mb-col");
      var track = el("div", "an-mb-track");
      var fill = el("div", "an-mb-fill" + (d.key === todayK ? " today" : ""));
      var h = maxMin ? (d.minutes / maxMin) * 100 : 0;
      fill.style.height = Math.max(d.minutes > 0 ? 4 : 0, h) + "%";
      fill.title = S.prettyDate(d.key) + " — " + fmtHM(d.minutes);
      track.appendChild(fill);
      var num = S.parseKey(d.key).getDate();
      var lbl = el("div", "an-mb-lbl tabular" + (d.key === todayK ? " today" : ""), (num % 5 === 0 || num === 1) ? String(num) : "");
      col.appendChild(track);
      col.appendChild(lbl);
      wrap.appendChild(col);
    });

    var box = el("div", "an-chart-box");
    box.appendChild(wrap);
    return box;
  }

  // this is the public api and registration
  window.AnalyticsView = { render: render };

  window.ViewRegistry.register("analytics", {
    title: "Analytics",
    render: function (c) { render(c); },
  });
})();
