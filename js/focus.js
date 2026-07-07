(function () {
  "use strict";

  var S = window.Store;
  var T = window.Timeline;

  var GOAL_HOURS = 20;

  // this is the data crunching
  function catOf(id) { return S.getCategory(id); }

  function weekDays() {
    var cfg = S.getConfig();
    var start = S.weekStart(S.getSelectedDate(), cfg.weekStartDay);
    var days = [];
    for (var i = 0; i < 7; i++) days.push(S.addDays(start, i));
    return days;
  }

  function timedEventsOn(key) {
    return S.visibleEventsOn(key).filter(function (e) {
      return !e.allDay && e.categoryId !== "buffer" && e.end > e.start;
    });
  }

  function isFocus(ev) {
    var c = catOf(ev.categoryId);
    return !!(c && c.intensive);
  }

  function mergedMinutes(events) {
    if (!events.length) return 0;
    var iv = events.map(function (e) { return [e.start, e.end]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var total = 0;
    var curStart = iv[0][0], curEnd = iv[0][1];
    for (var i = 1; i < iv.length; i++) {
      if (iv[i][0] <= curEnd) {
        if (iv[i][1] > curEnd) curEnd = iv[i][1];
      } else {
        total += curEnd - curStart;
        curStart = iv[i][0];
        curEnd = iv[i][1];
      }
    }
    total += curEnd - curStart;
    return total;
  }

  function longestFocusRun(events) {
    var focus = events.filter(isFocus)
      .map(function (e) { return [e.start, e.end]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    if (!focus.length) return null;
    var bridge = 10;
    var best = null;
    var runStart = focus[0][0], runEnd = focus[0][1];
    for (var i = 1; i < focus.length; i++) {
      if (focus[i][0] - runEnd <= bridge) {
        if (focus[i][1] > runEnd) runEnd = focus[i][1];
      } else {
        best = keepLonger(best, runStart, runEnd);
        runStart = focus[i][0];
        runEnd = focus[i][1];
      }
    }
    best = keepLonger(best, runStart, runEnd);
    return best;
  }

  function keepLonger(best, start, end) {
    var len = end - start;
    if (!best || len > (best.end - best.start)) return { start: start, end: end };
    return best;
  }

  function computeWeek() {
    var days = weekDays();
    var perDay = [];
    var focusMin = 0, meetingMin = 0;
    var runs = [];

    days.forEach(function (key) {
      var events = timedEventsOn(key);
      var focus = events.filter(isFocus);
      var other = events.filter(function (e) { return !isFocus(e); });
      var fMin = mergedMinutes(focus);
      var mMin = mergedMinutes(other);
      focusMin += fMin;
      meetingMin += mMin;
      perDay.push({ key: key, focus: fMin, meeting: mMin });

      var run = longestFocusRun(events);
      if (run) {
        runs.push({ key: key, start: run.start, end: run.end, len: run.end - run.start });
      }
    });

    runs.sort(function (a, b) { return b.len - a.len; });

    return {
      days: days,
      perDay: perDay,
      focusMin: focusMin,
      meetingMin: meetingMin,
      runs: runs.slice(0, 4),
    };
  }

  function hours(min) { return min / 60; }

  function fmtHours(min) {
    var h = min / 60;
    if (h === 0) return "0h";
    if (h < 1) return Math.round(min) + "m";
    var whole = Math.floor(h);
    var rem = Math.round(min - whole * 60);
    if (rem === 0) return whole + "h";
    return whole + "h " + rem + "m";
  }

  function pct(part, whole) {
    if (whole <= 0) return 0;
    return Math.round((part / whole) * 100);
  }

  function svgIcon(name) {
    return window.Icons.get(name);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // this is the main render
  function render(container) {
    container.innerHTML = "";
    var data = computeWeek();

    var wrap = el("div", "focus-view");
    var scroll = el("div", "focus-scroll");
    wrap.appendChild(scroll);

    scroll.appendChild(buildStats(data));
    scroll.appendChild(buildSplit(data));

    var lower = el("div", "focus-lower");
    lower.appendChild(buildPerDay(data));
    lower.appendChild(buildRuns(data));
    scroll.appendChild(lower);

    scroll.appendChild(buildGuidance(data));

    container.appendChild(wrap);
  }

  // this is the stat cards
  function buildStats(data) {
    var totalTracked = data.focusMin + data.meetingMin;
    var protectedPct = pct(data.focusMin, totalTracked);
    var avgFocus = data.focusMin / 7;

    var grid = el("div", "focus-stats");

    grid.appendChild(statCard({
      label: "Focus time",
      value: fmtHours(data.focusMin),
      sub: "deep work this week",
      accent: "focus",
    }));
    grid.appendChild(statCard({
      label: "Shallow time",
      value: fmtHours(data.meetingMin),
      sub: "meetings, admin & the rest",
      accent: "meeting",
    }));
    grid.appendChild(statCard({
      label: "Protected",
      value: protectedPct + "%",
      sub: "of scheduled time is focus",
      accent: "focus",
    }));
    grid.appendChild(statCard({
      label: "Daily average",
      value: fmtHours(avgFocus),
      sub: "focus per day",
      accent: "neutral",
    }));

    return grid;
  }

  function statCard(o) {
    var card = el("div", "focus-stat accent-" + o.accent);
    var lbl = el("div", "focus-stat-label", o.label);
    var val = el("div", "focus-stat-value tabular", o.value);
    var sub = el("div", "focus-stat-sub", o.sub);
    card.appendChild(lbl);
    card.appendChild(val);
    card.appendChild(sub);
    return card;
  }

  // this is the focus vs everything else split
  function buildSplit(data) {
    var panel = el("div", "panel focus-panel");
    panel.appendChild(el("h3", null, "Deep work vs everything else"));

    var total = data.focusMin + data.meetingMin;
    if (total <= 0) {
      panel.appendChild(emptyNote("No time-blocked events scheduled this week yet."));
      return panel;
    }

    var note = el("p", "panel-note",
      "How this week's scheduled hours divide between intensive focus work and everything else.");
    panel.appendChild(note);

    var bar = el("div", "split-bar");
    var fSeg = el("div", "split-seg seg-focus");
    fSeg.style.width = (data.focusMin / total * 100) + "%";
    var mSeg = el("div", "split-seg seg-meeting");
    mSeg.style.width = (data.meetingMin / total * 100) + "%";
    bar.appendChild(fSeg);
    bar.appendChild(mSeg);
    panel.appendChild(bar);

    var legend = el("div", "split-legend");
    legend.appendChild(legendItem("seg-focus", "Focus", fmtHours(data.focusMin), pct(data.focusMin, total)));
    legend.appendChild(legendItem("seg-meeting", "Everything else", fmtHours(data.meetingMin), pct(data.meetingMin, total)));
    panel.appendChild(legend);

    return panel;
  }

  function legendItem(segCls, name, hoursText, percent) {
    var item = el("div", "legend-item");
    var dot = el("span", "legend-dot " + segCls);
    var txt = el("span", "legend-txt");
    txt.appendChild(el("span", "legend-name", name));
    var meta = el("span", "legend-meta tabular");
    meta.textContent = hoursText + " · " + percent + "%";
    txt.appendChild(meta);
    item.appendChild(dot);
    item.appendChild(txt);
    return item;
  }

  // this is the per-day chart
  function buildPerDay(data) {
    var panel = el("div", "panel focus-panel");
    panel.appendChild(el("h3", null, "Per-day breakdown"));
    panel.appendChild(el("p", "panel-note", "Focus versus everything else, across each day of the week."));

    var maxMin = 0;
    data.perDay.forEach(function (d) {
      var t = d.focus + d.meeting;
      if (t > maxMin) maxMin = t;
    });
    if (maxMin === 0) maxMin = 60;

    var chart = el("div", "day-chart");
    data.perDay.forEach(function (d) {
      var wd = S.weekdayOf(d.key);
      var isToday = d.key === S.todayKey();
      var col = el("div", "day-col" + (isToday ? " is-today" : ""));

      var bars = el("div", "day-bars");
      var total = d.focus + d.meeting;
      var stack = el("div", "day-stack");
      stack.style.height = (total / maxMin * 100) + "%";
      if (d.focus > 0) {
        var fb = el("div", "day-seg seg-focus");
        fb.style.height = (d.focus / total * 100) + "%";
        stack.appendChild(fb);
      }
      if (d.meeting > 0) {
        var mb = el("div", "day-seg seg-meeting");
        mb.style.height = (d.meeting / total * 100) + "%";
        stack.appendChild(mb);
      }
      bars.appendChild(stack);
      col.appendChild(bars);

      var val = el("div", "day-total tabular", total > 0 ? fmtHours(total) : "");
      col.appendChild(val);
      col.appendChild(el("div", "day-name", S.WEEKDAYS[wd]));

      col.title = S.prettyDate(d.key) + "\nFocus " + fmtHours(d.focus) + " · Other " + fmtHours(d.meeting);
      col.addEventListener("click", (function (k) {
        return function () { S.setSelectedDate(k); window.Router.go("day"); };
      })(d.key));

      chart.appendChild(col);
    });
    panel.appendChild(chart);
    return panel;
  }

  // this is the longest focus blocks list
  function buildRuns(data) {
    var panel = el("div", "panel focus-panel");
    panel.appendChild(el("h3", null, "Longest focus blocks"));
    panel.appendChild(el("p", "panel-note", "Your biggest uninterrupted stretches of deep work."));

    if (!data.runs.length) {
      panel.appendChild(emptyNote("No focus blocks scheduled. Add a Deep Work event to protect time."));
      return panel;
    }

    var maxLen = data.runs[0].len || 1;
    var list = el("div", "run-list");
    data.runs.forEach(function (r) {
      var row = el("button", "run-row");
      var head = el("div", "run-head");
      var day = el("span", "run-day", S.WEEKDAYS_FULL[S.weekdayOf(r.key)]);
      var len = el("span", "run-len tabular", fmtHours(r.len));
      head.appendChild(day);
      head.appendChild(len);
      row.appendChild(head);

      var meter = el("div", "run-meter");
      var fill = el("div", "run-fill");
      fill.style.width = (r.len / maxLen * 100) + "%";
      meter.appendChild(fill);
      row.appendChild(meter);

      var time = el("div", "run-time tabular", T.fmt12(r.start) + " – " + T.fmt12(r.end));
      row.appendChild(time);

      row.addEventListener("click", (function (k) {
        return function () { S.setSelectedDate(k); window.Router.go("day"); };
      })(r.key));

      list.appendChild(row);
    });
    panel.appendChild(list);
    return panel;
  }

  // this is the written read of the week
  function buildGuidance(data) {
    var panel = el("div", "panel focus-guide");
    var head = el("div", "guide-head");
    var ic = el("span", "guide-ic");
    ic.innerHTML = svgIcon("focus");
    head.appendChild(ic);
    head.appendChild(el("h3", null, "This week's read"));
    panel.appendChild(head);

    var hrs = hours(data.focusMin);
    var total = data.focusMin + data.meetingMin;
    var share = pct(data.focusMin, total);
    var lines = [];

    if (data.focusMin === 0) {
      lines.push("You haven't protected any focus time this week. Block a few Deep Work sessions to carve out room for intensive work.");
    } else {
      lines.push("You've protected " + fmtHours(data.focusMin) + " of focus time, about " +
        share + "% of your scheduled hours.");
      if (hrs >= GOAL_HOURS) {
        lines.push("That clears a healthy " + GOAL_HOURS + "h target — strong deep-work coverage for the week.");
      } else {
        var gap = GOAL_HOURS - hrs;
        lines.push("You're " + fmtHours(gap * 60) + " short of a " + GOAL_HOURS + "h focus target. A couple more protected blocks would close the gap.");
      }
      if (data.runs.length && data.runs[0].len < 90) {
        lines.push("Your longest uninterrupted block is under 90 minutes. Try consolidating focus time into larger stretches for deeper work.");
      } else if (data.runs.length) {
        lines.push("Your longest stretch runs " + fmtHours(data.runs[0].len) + " uninterrupted — great for deep, sustained work.");
      }
      if (share < 40) {
        lines.push("Meetings and admin are eating the larger share of your week. Guard a recurring focus window to rebalance.");
      }
    }

    lines.forEach(function (t) {
      panel.appendChild(el("p", "guide-line", t));
    });
    return panel;
  }

  function emptyNote(text) {
    return el("div", "panel-empty", text);
  }

  // this is the public api and registration
  window.FocusView = { render: render };

  window.ViewRegistry.register("focus", {
    title: "Focus",
    render: function (c) { render(c); },
  });
})();
