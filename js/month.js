(function () {
  "use strict";

  var T = window.Timeline;
  var S = window.Store;

  // this is the state
  var container = null;
  var drag = null;
  var dragEndedAt = 0;

  function catOf(id) { return S.getCategory(id); }

  // this is where the month grid gets drawn
  function render(c) {
    container = c;
    var cfg = S.getConfig();
    var sel = S.parseKey(S.getSelectedDate());
    var viewYear = sel.getFullYear();
    var viewMonth = sel.getMonth();

    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "month-view";

    var dow = document.createElement("div");
    dow.className = "month-dow";
    for (var w = 0; w < 7; w++) {
      var idx = (cfg.weekStartDay + w) % 7;
      var cell = document.createElement("div");
      cell.className = "month-dow-cell";
      cell.textContent = S.WEEKDAYS[idx];
      dow.appendChild(cell);
    }
    wrap.appendChild(dow);

    var grid = document.createElement("div");
    grid.className = "month-grid";

    var first = new Date(viewYear, viewMonth, 1);
    var leading = (first.getDay() - cfg.weekStartDay + 7) % 7;
    var gridStart = new Date(viewYear, viewMonth, 1 - leading);
    var todayK = S.todayKey();
    var selK = S.getSelectedDate();

    var lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    var rowsNeeded = Math.ceil((leading + lastDay) / 7);
    var totalCells = rowsNeeded * 7;
    grid.style.gridTemplateRows = "repeat(" + rowsNeeded + ", minmax(96px, 1fr))";

    for (var i = 0; i < totalCells; i++) {
      var d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      var key = S.dateKey(d);
      var inMonth = d.getMonth() === viewMonth;

      var cellEl = document.createElement("div");
      cellEl.className = "month-cell" + (inMonth ? "" : " muted");
      if (key === todayK) cellEl.className += " is-today";
      if (key === selK) cellEl.className += " is-selected";
      cellEl.dataset.date = key;

      var top = document.createElement("div");
      top.className = "month-cell-top";
      var num = document.createElement("span");
      num.className = "month-num";
      num.textContent = d.getDate();
      if (key === todayK) {
        var badge = document.createElement("span");
        badge.className = "month-today-badge";
        badge.textContent = d.getDate();
        num.textContent = "";
        num.appendChild(badge);
      }
      top.appendChild(num);
      cellEl.appendChild(top);

      var events = S.visibleEventsOn(key).slice().sort(function (a, b) {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.start - b.start;
      });
      var maxChips = 3;
      var shown = events.slice(0, maxChips);
      var chips = document.createElement("div");
      chips.className = "month-chips";
      shown.forEach(function (ev) {
        var cat = catOf(ev.categoryId) || S.getCategories()[0];
        var chip = document.createElement("button");
        chip.className = "month-chip" + (ev.allDay ? " allday" : "");
        chip.dataset.id = ev.id;
        chip.style.setProperty("--ev", cat ? cat.color : "#888");
        chip.style.setProperty("--ev-text", T.inkFor(cat ? cat.color : "#888"));
        if (ev.allDay) {
          chip.textContent = ev.title || (cat ? cat.name : "");
        } else {
          var dot = document.createElement("span");
          dot.className = "month-chip-dot";
          chip.appendChild(dot);
          var tx = document.createElement("span");
          tx.className = "month-chip-tx";
          tx.textContent = T.fmt12(ev.start) + " " + (ev.title || (cat ? cat.name : ""));
          chip.appendChild(tx);
        }
        chip.title = (ev.title || (cat ? cat.name : ""));
        chip.addEventListener("mousedown", (function (id) {
          return function (e) {
            if (e.button !== 0) return;
            beginDrag(e, id);
          };
        })(ev.id));
        chip.addEventListener("click", (function (id) {
          return function (e) {
            e.stopPropagation();
            if (Date.now() - dragEndedAt < 300) return;
            window.Editor.open(id, e.clientX, e.clientY);
          };
        })(ev.id));
        chips.appendChild(chip);
      });
      cellEl.appendChild(chips);

      if (events.length > maxChips) {
        var more = document.createElement("button");
        more.className = "month-more";
        more.textContent = "+" + (events.length - maxChips) + " more";
        more.addEventListener("click", (function (k) {
          return function (e) {
            e.stopPropagation();
            S.setSelectedDate(k);
            window.Router.go("day");
          };
        })(key));
        cellEl.appendChild(more);
      }

      cellEl.addEventListener("click", (function (k) {
        return function () {
          if (Date.now() - dragEndedAt < 300) return;
          S.setSelectedDate(k);
          window.Router.go("day");
        };
      })(key));

      grid.appendChild(cellEl);
    }
    wrap.appendChild(grid);
    container.appendChild(wrap);

    wireDrag();
  }

  // this is the drag and drop
  function beginDrag(e, id) {
    drag = { id: id, startX: e.clientX, startY: e.clientY, moved: false, targetKey: null };
    e.preventDefault();
  }

  function cellUnderPoint(x, y) {
    var el = document.elementFromPoint(x, y);
    return el ? el.closest(".month-cell") : null;
  }

  function clearDropTargets() {
    if (!container) return;
    var active = container.querySelectorAll(".month-cell.drop-active");
    active.forEach(function (n) { n.classList.remove("drop-active"); });
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
        var chip = container.querySelector('.month-chip[data-id="' + drag.id + '"]');
        if (chip) chip.classList.add("dragging");
      }
      var cell = cellUnderPoint(e.clientX, e.clientY);
      drag.targetKey = cell ? cell.dataset.date : null;
      clearDropTargets();
      if (cell) cell.classList.add("drop-active");
    });

    window.addEventListener("mouseup", function () {
      if (!drag) return;
      var d = drag;
      drag = null;
      clearDropTargets();
      var chip = container.querySelector('.month-chip[data-id="' + d.id + '"]');
      if (chip) chip.classList.remove("dragging");
      if (!d.moved) return;
      dragEndedAt = Date.now();
      if (!d.targetKey) return;
      var ev = S.getEvent(d.id);
      if (!ev || ev.date === d.targetKey) return;
      S.updateEvent(d.id, { date: d.targetKey });
    });
  }

  // this is the public api
  window.MonthView = { render: render };

  window.ViewRegistry.register("month", {
    title: "Month",
    render: function (c) { render(c); },
  });
})();
