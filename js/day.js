(function () {
  "use strict";

  var T = window.Timeline;
  var S = window.Store;
  var HOUR_PX = 56;

  // this is the state
  var container = null;
  var gridArea = null;
  var blocksLayer = null;
  var hoursEl = null;
  var draftEl = null;
  var scrollRegion = null;
  var nowLine = null;
  var nowLabel = null;
  var allDayRow = null;

  var selectedId = null;
  var drag = null;
  var wired = false;
  var anchoredDate = null;

  // this is the time math helpers
  function pxPerMin() { return HOUR_PX / 60; }
  function minToPx(min) { return (min - dayStartMin()) * pxPerMin(); }
  function pxToMin(px) { return px / pxPerMin() + dayStartMin(); }
  function dayStartMin() { return S.getConfig().dayStart * 60; }
  function dayEndMin() { return S.getConfig().dayEnd * 60; }

  // this is where the day view gets built
  function build() {
    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "day-view calgrid";

    allDayRow = document.createElement("div");
    allDayRow.className = "allday-row";
    wrap.appendChild(allDayRow);

    scrollRegion = document.createElement("div");
    scrollRegion.className = "scroll-region";
    var timeline = document.createElement("div");
    timeline.className = "timeline single";
    hoursEl = document.createElement("div");
    hoursEl.className = "hours";
    gridArea = document.createElement("div");
    gridArea.className = "grid-area";
    nowLine = document.createElement("div");
    nowLine.className = "now-line";
    nowLabel = document.createElement("span");
    nowLabel.className = "now-label";
    nowLine.appendChild(nowLabel);
    blocksLayer = document.createElement("div");
    blocksLayer.className = "blocks-layer";
    draftEl = document.createElement("div");
    draftEl.className = "draft-block";
    draftEl.hidden = true;
    gridArea.appendChild(nowLine);
    gridArea.appendChild(blocksLayer);
    gridArea.appendChild(draftEl);
    timeline.appendChild(hoursEl);
    timeline.appendChild(gridArea);
    scrollRegion.appendChild(timeline);
    wrap.appendChild(scrollRegion);

    container.appendChild(wrap);
    wireGrid();
  }

  function catOf(id) { return S.getCategory(id); }

  // this is where the hour grid gets drawn
  function buildGrid() {
    var startH = S.getConfig().dayStart;
    var endH = S.getConfig().dayEnd;
    var totalH = (endH - startH) * HOUR_PX;
    gridArea.style.height = totalH + "px";
    hoursEl.style.height = totalH + "px";
    hoursEl.innerHTML = "";
    var existing = gridArea.querySelectorAll(".hour-line, .half-line");
    existing.forEach(function (n) { n.remove(); });

    for (var h = startH; h <= endH; h++) {
      var lbl = document.createElement("div");
      lbl.className = "hour-label";
      lbl.style.top = ((h - startH) * HOUR_PX) + "px";
      lbl.textContent = hourText(h);
      hoursEl.appendChild(lbl);
      if (h < endH) {
        var line = document.createElement("div");
        line.className = "hour-line";
        line.style.top = ((h - startH) * HOUR_PX) + "px";
        gridArea.appendChild(line);
        var half = document.createElement("div");
        half.className = "half-line";
        half.style.top = ((h - startH) * HOUR_PX + HOUR_PX / 2) + "px";
        gridArea.appendChild(half);
      }
    }
  }

  function hourText(h) {
    var hh = h % 24;
    var ampm = hh < 12 ? "am" : "pm";
    var disp = hh % 12; if (disp === 0) disp = 12;
    return disp + ampm;
  }

  // this is where the day gets drawn
  function render() {
    if (container == null) return;
    var dateKey = S.getSelectedDate();
    var prevScroll = scrollRegion && anchoredDate === dateKey ? scrollRegion.scrollTop : null;
    build();
    buildGrid();

    var events = S.visibleEventsOn(dateKey);
    var timed = events.filter(function (e) { return !e.allDay; });
    var allDay = events.filter(function (e) { return e.allDay; });

    renderAllDay(allDay);

    var rendered = T.withBuffers(timed, catOf, S.getConfig(), S.isCategoryVisible("buffer"));
    var layout = T.packColumns(rendered);
    blocksLayer.innerHTML = "";

    rendered.forEach(function (blk) {
      var lay = layout[blk.id] || { col: 0, cols: 1 };
      var cat = catOf(blk.categoryId) || S.getCategories()[0];
      var isBuffer = blk.categoryId === "buffer";
      var el = document.createElement("div");
      el.className = "block" + (isBuffer ? " buffer" : "");
      if (blk.id === selectedId) el.className += " selected";
      if (!isBuffer && hasTimerFor(blk.id)) el.className += " timed";
      el.dataset.id = blk.id;

      var top = minToPx(blk.start);
      var height = Math.max(minToPx(blk.end) - minToPx(blk.start), 14);
      el.style.top = top + "px";
      el.style.height = height + "px";
      var widthPct = 100 / lay.cols;
      el.style.left = "calc(" + (lay.col * widthPct) + "% + 2px)";
      el.style.width = "calc(" + widthPct + "% - 5px)";
      if (!isBuffer) {
        el.style.setProperty("--ev", cat.color);
        el.style.setProperty("--ev-text", T.inkFor(cat.color));
      }

      var title = document.createElement("div");
      title.className = "b-title";
      title.textContent = blk.title || (cat ? cat.name : "Untitled");
      el.appendChild(title);
      if (height > 30) {
        var time = document.createElement("div");
        time.className = "b-time";
        time.textContent = T.fmt12(blk.start) + " – " + T.fmt12(blk.end);
        el.appendChild(time);
      }
      if (!isBuffer) {
        var ht = document.createElement("div"); ht.className = "handle handle-top"; el.appendChild(ht);
        var hb = document.createElement("div"); hb.className = "handle handle-bottom"; el.appendChild(hb);
      }
      blocksLayer.appendChild(el);
    });

    updateNow();
    if (prevScroll !== null) {
      scrollRegion.scrollTop = prevScroll;
    } else {
      scrollToStart();
      anchoredDate = dateKey;
    }
  }

  // this is the all day row
  function renderAllDay(list) {
    allDayRow.innerHTML = "";
    var lbl = document.createElement("div");
    lbl.className = "allday-label";
    lbl.textContent = "All day";
    allDayRow.appendChild(lbl);
    var track = document.createElement("div");
    track.className = "allday-track";
    list.forEach(function (ev) {
      var cat = catOf(ev.categoryId) || S.getCategories()[0];
      var chip = document.createElement("button");
      chip.className = "allday-chip";
      chip.style.setProperty("--ev", cat.color);
      chip.style.setProperty("--ev-text", T.inkFor(cat.color));
      chip.textContent = ev.title || cat.name;
      chip.addEventListener("click", function (e) {
        window.Editor.open(ev.id, e.clientX, e.clientY);
      });
      track.appendChild(chip);
    });
    allDayRow.appendChild(track);
  }

  function hasTimerFor(id) {
    return window.Timers.list().some(function (t) { return t.blockId === id; });
  }

  function eventMin(e) {
    var rect = gridArea.getBoundingClientRect();
    var y = e.clientY - rect.top;
    return T.clamp(pxToMin(y), dayStartMin(), dayEndMin());
  }

  // this is the drag and drop and drawing
  function wireGrid() {
    if (wired) return;
    wired = true;

    document.addEventListener("mousedown", function (e) {
      if (window.Router.current() !== "day") return;
      if (!gridArea || !gridArea.contains(e.target)) return;
      if (e.button !== 0) return;
      var blockEl = e.target.closest(".block");
      if (blockEl) {
        var id = blockEl.dataset.id;
        var blk = S.getEvent(id);
        if (!blk) return;
        selectedId = id;
        var isTop = e.target.classList.contains("handle-top");
        var isBottom = e.target.classList.contains("handle-bottom");
        drag = {
          mode: isTop ? "resize-top" : isBottom ? "resize-bottom" : "move",
          id: id,
          startY: e.clientY,
          origStart: blk.start,
          origEnd: blk.end,
          moved: false,
        };
        e.preventDefault();
      } else {
        var min = eventMin(e);
        drag = { mode: "draw", startMin: min, curMin: min, moved: false };
        draftEl.hidden = false;
        updateDraft(min, min);
        e.preventDefault();
      }
    });

    window.addEventListener("mousemove", function (e) {
      if (!drag) return;
      var snapInc = S.getConfig().snap;
      if (drag.mode === "draw") {
        drag.curMin = eventMin(e);
        drag.moved = true;
        var a = Math.min(drag.startMin, drag.curMin);
        var b = Math.max(drag.startMin, drag.curMin);
        updateDraft(a, b);
        return;
      }
      var blk = S.getEvent(drag.id);
      if (!blk) return;
      var deltaMin = (e.clientY - drag.startY) / pxPerMin();
      var dur = drag.origEnd - drag.origStart;
      if (drag.mode === "move") {
        var ns = T.snap(drag.origStart + deltaMin, snapInc);
        ns = T.clamp(ns, dayStartMin(), dayEndMin() - dur);
        blk.start = ns;
        blk.end = ns + dur;
      } else if (drag.mode === "resize-top") {
        var nt = T.snap(drag.origStart + deltaMin, snapInc);
        nt = T.clamp(nt, dayStartMin(), blk.end - T.MIN_DUR);
        blk.start = nt;
      } else if (drag.mode === "resize-bottom") {
        var nb = T.snap(drag.origEnd + deltaMin, snapInc);
        nb = T.clamp(nb, blk.start + T.MIN_DUR, dayEndMin());
        blk.end = nb;
      }
      drag.moved = true;
      render();
    });

    window.addEventListener("mouseup", function (e) {
      if (!drag) return;
      var snapInc = S.getConfig().snap;
      if (drag.mode === "draw") {
        draftEl.hidden = true;
        var a = Math.min(drag.startMin, drag.curMin);
        var b = Math.max(drag.startMin, drag.curMin);
        if (drag.moved && (b - a) >= 5) {
          var start = T.clamp(T.snap(a, snapInc), dayStartMin(), dayEndMin() - T.MIN_DUR);
          var end = T.clamp(T.snap(b, snapInc), start + T.MIN_DUR, dayEndMin());
          var ev = S.addEvent({ date: S.getSelectedDate(), start: start, end: end, categoryId: S.firstUserCategoryId(), title: "" });
          selectedId = ev.id;
          window.Editor.open(ev.id, e.clientX, e.clientY);
        }
      } else if (drag.moved) {
        S.persist();
        S.emit("events");
      }
      drag = null;
    });

    document.addEventListener("dblclick", function (e) {
      if (window.Router.current() !== "day") return;
      var blockEl = e.target.closest(".block");
      if (!blockEl || !gridArea.contains(blockEl)) return;
      var id = blockEl.dataset.id;
      if (!S.getEvent(id)) { window.App.toast("Buffer blocks are auto-managed"); return; }
      selectedId = id;
      window.Editor.open(id, e.clientX, e.clientY);
    });
  }

  function updateDraft(a, b) {
    var snapInc = S.getConfig().snap;
    draftEl.style.top = minToPx(a) + "px";
    draftEl.style.height = Math.max(minToPx(b) - minToPx(a), 2) + "px";
    draftEl.textContent = T.fmt12(T.snap(a, snapInc)) + " – " + T.fmt12(T.snap(b, snapInc));
  }

  // this is the now line
  function updateNow() {
    if (!nowLine) return;
    var isToday = S.todayKey() === S.getSelectedDate();
    var min = S.nowMinutes();
    var visible = isToday && min >= dayStartMin() && min <= dayEndMin();
    nowLine.style.display = visible ? "block" : "none";
    if (visible) {
      nowLine.style.top = minToPx(min) + "px";
      nowLabel.textContent = T.fmt12(Math.floor(min));
    }
  }

  function scrollToStart() {
    if (!scrollRegion) return;
    if (S.todayKey() === S.getSelectedDate()) {
      scrollRegion.scrollTop = Math.max(0, minToPx(S.nowMinutes() - 60));
    } else {
      scrollRegion.scrollTop = Math.max(0, minToPx(8 * 60));
    }
  }

  // this is the public api
  window.DayView = {
    render: function (c) { container = c; render(); },
    updateNow: updateNow,
  };

  window.ViewRegistry.register("day", {
    title: "Day",
    render: function (c) { window.DayView.render(c); },
  });
})();
