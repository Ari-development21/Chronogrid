(function () {
  "use strict";

  var T = window.Timeline;
  var S = window.Store;
  var Sel = window.Selection;
  var HOUR_PX = 52;

  // this is the state
  var lastOpts = null;
  var drag = null;
  var dragEndedAt = 0;

  // this is the multi-select action bar
  function buildSelBar() {
    var evs = Sel.events();
    if (!evs.length) return null;

    var bar = document.createElement("div");
    bar.className = "sel-bar";

    var count = document.createElement("span");
    count.className = "sel-count";
    count.textContent = evs.length + " selected";
    bar.appendChild(count);

    var applyBtn = document.createElement("button");
    applyBtn.className = "btn btn-sm";
    applyBtn.textContent = "Apply to…";
    applyBtn.addEventListener("click", function () { window.ApplyTo.open(Sel.events()); });
    bar.appendChild(applyBtn);

    var copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-sm";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", function () {
      var n = Sel.copy();
      if (n) window.App.toast("Copied " + n);
    });
    bar.appendChild(copyBtn);

    var clearBtn = document.createElement("button");
    clearBtn.className = "btn btn-sm btn-ghost";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", function () { Sel.clear(); });
    bar.appendChild(clearBtn);

    return bar;
  }

  // this is where the week grid gets drawn
  function renderGrid(opts) {
    lastOpts = opts;
    var container = opts.container;
    var dayCount = opts.dayCount;
    var cfg = S.getConfig();
    var weekStartKey = S.weekStart(S.getSelectedDate(), cfg.weekStartDay);
    var firstKey = S.addDays(weekStartKey, opts.startOffset || 0);

    var days = [];
    for (var i = 0; i < dayCount; i++) days.push(S.addDays(firstKey, i));

    var startMin = cfg.dayStart * 60;
    var endMin = cfg.dayEnd * 60;
    var totalPx = ((endMin - startMin) / 60) * HOUR_PX;

    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "week-view calgrid";

    var selBar = buildSelBar();
    if (selBar) wrap.appendChild(selBar);

    var header = document.createElement("div");
    header.className = "wk-header";
    header.style.gridTemplateColumns = "var(--gutter) repeat(" + dayCount + ", 1fr)";
    var corner = document.createElement("div");
    corner.className = "wk-corner";
    corner.textContent = S.tzLabel();
    header.appendChild(corner);

    days.forEach(function (dayKey) {
      var d = S.parseKey(dayKey);
      var isToday = dayKey === S.todayKey();
      var col = document.createElement("button");
      col.className = "wk-dayhead" + (isToday ? " is-today" : "");
      col.title = "Open " + S.prettyDate(dayKey) + " in Day view";
      var dow = document.createElement("span");
      dow.className = "wk-dow";
      dow.textContent = S.WEEKDAYS[d.getDay()];
      var num = document.createElement("span");
      num.className = "wk-daynum";
      num.textContent = d.getDate();
      col.appendChild(dow);
      col.appendChild(num);
      col.addEventListener("click", function () {
        S.setSelectedDate(dayKey);
        window.Router.go("day");
      });
      header.appendChild(col);
    });
    wrap.appendChild(header);

    var allDayEvents = days.map(function (k) {
      return S.visibleEventsOn(k).filter(function (e) { return e.allDay; });
    });
    var hasAllDay = allDayEvents.some(function (l) { return l.length; });
    if (hasAllDay) {
      var adRow = document.createElement("div");
      adRow.className = "wk-allday";
      adRow.style.gridTemplateColumns = "var(--gutter) repeat(" + dayCount + ", 1fr)";
      var adLabel = document.createElement("div");
      adLabel.className = "wk-allday-label";
      adLabel.textContent = "All day";
      adRow.appendChild(adLabel);
      days.forEach(function (dayKey, di) {
        var cell = document.createElement("div");
        cell.className = "wk-allday-cell";
        allDayEvents[di].forEach(function (ev) {
          var cat = S.getCategory(ev.categoryId) || S.getCategories()[0];
          var chip = document.createElement("button");
          chip.className = "wk-allday-chip";
          chip.style.setProperty("--ev", cat.color);
          chip.style.setProperty("--ev-text", T.inkFor(cat.color));
          chip.textContent = ev.title || cat.name;
          chip.addEventListener("click", function (e) {
            e.stopPropagation();
            window.Editor.open(ev.id, e.clientX, e.clientY);
          });
          cell.appendChild(chip);
        });
        adRow.appendChild(cell);
      });
      wrap.appendChild(adRow);
    }

    var scroll = document.createElement("div");
    scroll.className = "wk-scroll scroll-region";
    var body = document.createElement("div");
    body.className = "wk-body";
    body.style.gridTemplateColumns = "var(--gutter) repeat(" + dayCount + ", 1fr)";
    body.style.height = totalPx + "px";

    var gutter = document.createElement("div");
    gutter.className = "wk-gutter";
    gutter.style.height = totalPx + "px";
    for (var h = cfg.dayStart; h <= cfg.dayEnd; h++) {
      var hl = document.createElement("div");
      hl.className = "wk-hour-label";
      hl.style.top = ((h - cfg.dayStart) * HOUR_PX) + "px";
      hl.textContent = hourText(h);
      gutter.appendChild(hl);
    }
    body.appendChild(gutter);

    var cols = [];
    days.forEach(function (dayKey) {
      var colTrack = document.createElement("div");
      colTrack.className = "wk-col";
      if (dayKey === S.todayKey()) colTrack.className += " is-today";
      colTrack.style.height = totalPx + "px";
      colTrack.dataset.date = dayKey;
      cols.push(colTrack);

      for (var hh = cfg.dayStart; hh < cfg.dayEnd; hh++) {
        var line = document.createElement("div");
        line.className = "wk-hline";
        line.style.top = ((hh - cfg.dayStart) * HOUR_PX) + "px";
        colTrack.appendChild(line);
      }

      var timed = S.visibleEventsOn(dayKey).filter(function (e) { return !e.allDay; });
      var rendered = T.withBuffers(timed, S.getCategory, cfg, S.isCategoryVisible("buffer"));
      var layout = T.packColumns(rendered);

      rendered.forEach(function (blk) {
        var lay = layout[blk.id] || { col: 0, cols: 1 };
        var cat = S.getCategory(blk.categoryId) || S.getCategories()[0];
        var isBuffer = blk.categoryId === "buffer";
        var el = document.createElement("div");
        el.className = "wk-event" + (isBuffer ? " buffer" : "");
        if (!isBuffer && Sel.has(blk.id)) el.className += " selected";
        el.dataset.id = blk.id;
        var top = ((blk.start - startMin) / 60) * HOUR_PX;
        var height = Math.max(((blk.end - blk.start) / 60) * HOUR_PX, 14);
        el.style.top = top + "px";
        el.style.height = height + "px";
        var wPct = 100 / lay.cols;
        el.style.left = "calc(" + (lay.col * wPct) + "% + 1px)";
        el.style.width = "calc(" + wPct + "% - 3px)";
        if (!isBuffer) {
          el.style.setProperty("--ev", cat.color);
          el.style.setProperty("--ev-text", T.inkFor(cat.color));
        }

        var t = document.createElement("span");
        t.className = "wk-ev-title";
        t.textContent = blk.title || (cat ? cat.name : "");
        el.appendChild(t);
        if (height > 30) {
          var tm = document.createElement("span");
          tm.className = "wk-ev-time";
          tm.textContent = T.fmt12(blk.start) + " – " + T.fmt12(blk.end);
          el.appendChild(tm);
        }
        if (!isBuffer) {
          el.addEventListener("mousedown", (function (id, ev) {
            return function (e) {
              if (e.button !== 0) return;
              e.stopPropagation();
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              beginDrag(e, id, ev);
            };
          })(blk.id, blk));
          el.addEventListener("click", (function (id) {
            return function (e) {
              e.stopPropagation();
              if (Date.now() - dragEndedAt < 300) return;
              if (e.metaKey || e.ctrlKey || e.shiftKey) {
                Sel.toggle(id);
                return;
              }
              Sel.only(id, true);
              window.Editor.open(id, e.clientX, e.clientY);
            };
          })(blk.id));
        }
        colTrack.appendChild(el);
      });

      if (dayKey === S.todayKey()) {
        var now = nowMarker(startMin, endMin);
        if (now) colTrack.appendChild(now);
      }

      colTrack.addEventListener("click", (function (dk) {
        return function (e) {
          if (e.target.closest(".wk-event")) return;
          if (Date.now() - dragEndedAt < 300) return;
          var rect = colTrack.getBoundingClientRect();
          var frac = (e.clientY - rect.top) / rect.height;
          var min = startMin + frac * (endMin - startMin);
          var start = T.clamp(T.snap(min, cfg.snap), startMin, endMin - 60);
          var end = Math.min(start + 60, endMin);
          var ev = S.addEvent({ date: dk, start: start, end: end, categoryId: S.firstUserCategoryId(), title: "" });
          Sel.only(ev.id, true);
          window.Editor.open(ev.id, e.clientX, e.clientY);
        };
      })(dayKey));

      body.appendChild(colTrack);
    });

    scroll.appendChild(body);
    wrap.appendChild(scroll);
    container.appendChild(wrap);

    var anchorKey = firstKey + ":" + dayCount;
    if (container._chronoAnchorKey === anchorKey && typeof container._chronoScrollTop === "number") {
      scroll.scrollTop = container._chronoScrollTop;
    } else {
      var scrollToMin = 8 * 60;
      if (days.indexOf(S.todayKey()) > -1) {
        scrollToMin = S.nowMinutes() - 60;
      }
      scroll.scrollTop = Math.max(0, ((scrollToMin - startMin) / 60) * HOUR_PX);
      container._chronoAnchorKey = anchorKey;
    }

    scroll.addEventListener("scroll", function () {
      container._chronoScrollTop = scroll.scrollTop;
    });

    container._chronoScroll = scroll;
    container._chronoStartMin = startMin;
    container._chronoEndMin = endMin;
    container._chronoCols = cols;

    wireDrag();
  }

  // this is the drag and drop
  function beginDrag(e, id, ev) {
    drag = {
      id: id,
      startX: e.clientX,
      startY: e.clientY,
      origStart: ev.start,
      origEnd: ev.end,
      origDate: ev.date,
      dur: ev.end - ev.start,
      moved: false,
    };
    e.preventDefault();
  }

  function colUnderPoint(clientX) {
    if (!lastOpts) return null;
    var cols = lastOpts.container._chronoCols;
    if (!cols) return null;
    for (var i = 0; i < cols.length; i++) {
      var r = cols[i].getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return cols[i];
    }
    var firstR = cols[0].getBoundingClientRect();
    if (clientX < firstR.left) return cols[0];
    return cols[cols.length - 1];
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
      }
      var blk = S.getEvent(drag.id);
      if (!blk) { drag = null; return; }
      var cfg = S.getConfig();
      var startMin = cfg.dayStart * 60;
      var endMin = cfg.dayEnd * 60;
      var deltaMin = ((e.clientY - drag.startY) / HOUR_PX) * 60;
      var ns = T.snap(drag.origStart + deltaMin, cfg.snap);
      ns = T.clamp(ns, startMin, endMin - drag.dur);
      var col = colUnderPoint(e.clientX);
      var newDate = col ? col.dataset.date : drag.origDate;
      blk.start = ns;
      blk.end = ns + drag.dur;
      blk.date = newDate;
      renderGrid(lastOpts);
      var moving = lastOpts.container.querySelector('.wk-event[data-id="' + drag.id + '"]');
      if (moving) moving.classList.add("dragging");
      var target = lastOpts.container.querySelector('.wk-col[data-date="' + newDate + '"]');
      if (target) target.classList.add("drop-active");
    });

    window.addEventListener("mouseup", function () {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (!d.moved) return;
      dragEndedAt = Date.now();
      var blk = S.getEvent(d.id);
      if (!blk) return;
      S.updateEvent(d.id, { date: blk.date, start: blk.start, end: blk.end });
    });
  }

  // this is the now line
  function nowMarker(startMin, endMin) {
    var min = S.nowMinutes();
    if (min < startMin || min > endMin) return null;
    var el = document.createElement("div");
    el.className = "wk-now";
    el.style.top = ((min - startMin) / 60) * HOUR_PX + "px";
    el.innerHTML = '<span class="wk-now-dot"></span>';
    return el;
  }

  function hourText(h) {
    var hh = h % 24;
    var ampm = hh < 12 ? "am" : "pm";
    var disp = hh % 12; if (disp === 0) disp = 12;
    if (h === 24) return "12am";
    return disp + ampm;
  }

  function refreshNow(container) {
    if (!container) return;
    var startMin = container._chronoStartMin;
    var endMin = container._chronoEndMin;
    if (typeof startMin !== "number") return;
    var todayCol = container.querySelector('.wk-col[data-date="' + S.todayKey() + '"]');
    var existing = container.querySelector(".wk-now");
    var marker = nowMarker(startMin, endMin);
    if (!todayCol || !marker) {
      if (existing) existing.parentNode.removeChild(existing);
      return;
    }
    if (existing) {
      existing.style.top = marker.style.top;
    } else {
      todayCol.appendChild(marker);
    }
  }

  var weekContainer = null;
  function render(c) {
    weekContainer = c;
    renderGrid({ container: c, dayCount: 7, startOffset: 0 });
  }

  function updateNow() {
    refreshNow(weekContainer);
  }

  // this is the public api
  window.WeekView = { render: render, renderGrid: renderGrid, updateNow: updateNow, refreshNow: refreshNow, HOUR_PX: HOUR_PX };

  window.ViewRegistry.register("week", {
    title: "Week",
    render: function (c) { render(c); },
  });
})();
