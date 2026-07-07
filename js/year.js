(function () {
  "use strict";

  var S = window.Store;

  // this is the heat level helper
  function densityLevel(count) {
    if (count <= 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
  }

  // this is where the whole year gets drawn
  function render(container) {
    var cfg = S.getConfig();
    var sel = S.parseKey(S.getSelectedDate());
    var year = sel.getFullYear();
    var todayK = S.todayKey();
    var today = S.parseKey(todayK);
    var selK = S.getSelectedDate();

    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "year-view scroll-region";

    wrap.appendChild(buildSummary(year));

    var grid = document.createElement("div");
    grid.className = "year-grid";
    for (var m = 0; m < 12; m++) {
      grid.appendChild(buildMonth(year, m, cfg, todayK, today, selK));
    }
    wrap.appendChild(grid);

    container.appendChild(wrap);
  }

  // this is the summary bar up top
  function countYear(year) {
    var total = 0, activeDays = 0, seen = {};
    var all = S.allEvents();
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (+e.date.slice(0, 4) !== year) continue;
      if (!S.isCategoryVisible(e.categoryId)) continue;
      total++;
      if (!seen[e.date]) { seen[e.date] = true; activeDays++; }
    }
    return { total: total, activeDays: activeDays };
  }

  function buildSummary(year) {
    var bar = document.createElement("div");
    bar.className = "year-summary";

    var stats = countYear(year);
    var counts = document.createElement("div");
    counts.className = "year-stats";

    counts.appendChild(stat(String(stats.total), stats.total === 1 ? "event" : "events"));
    counts.appendChild(stat(String(stats.activeDays), stats.activeDays === 1 ? "scheduled day" : "scheduled days"));
    bar.appendChild(counts);

    var legend = document.createElement("div");
    legend.className = "year-legend";
    var less = document.createElement("span");
    less.className = "year-legend-cap";
    less.textContent = "Less";
    legend.appendChild(less);
    for (var lvl = 1; lvl <= 4; lvl++) {
      var sw = document.createElement("span");
      sw.className = "year-legend-swatch";
      sw.setAttribute("data-heat", lvl);
      legend.appendChild(sw);
    }
    var more = document.createElement("span");
    more.className = "year-legend-cap";
    more.textContent = "More";
    legend.appendChild(more);
    bar.appendChild(legend);

    return bar;
  }

  function stat(value, label) {
    var el = document.createElement("div");
    el.className = "year-stat";
    var v = document.createElement("span");
    v.className = "year-stat-val";
    v.textContent = value;
    var l = document.createElement("span");
    l.className = "year-stat-label";
    l.textContent = label;
    el.appendChild(v);
    el.appendChild(l);
    return el;
  }

  // this is where each little month card gets built
  function buildMonth(year, month, cfg, todayK, today, selK) {
    var card = document.createElement("section");
    card.className = "ym-card";
    if (month === today.getMonth() && year === today.getFullYear()) {
      card.className += " ym-current";
    }

    var head = document.createElement("button");
    head.className = "ym-title";
    head.textContent = S.MONTHS[month];
    head.title = "Open " + S.MONTHS[month] + " " + year;
    head.addEventListener("click", function () {
      S.setSelectedDate(S.dateKey(new Date(year, month, 1)));
      window.Router.go("month");
    });
    card.appendChild(head);

    var dow = document.createElement("div");
    dow.className = "ym-dow";
    for (var w = 0; w < 7; w++) {
      var idx = (cfg.weekStartDay + w) % 7;
      var d = document.createElement("span");
      if (idx === 0 || idx === 6) d.className = "ym-dow-end";
      d.textContent = S.WEEKDAYS[idx].charAt(0);
      dow.appendChild(d);
    }
    card.appendChild(dow);

    var grid = document.createElement("div");
    grid.className = "ym-grid";

    var first = new Date(year, month, 1);
    var leading = (first.getDay() - cfg.weekStartDay + 7) % 7;
    var gridStart = new Date(year, month, 1 - leading);
    var lastDate = new Date(year, month + 1, 0).getDate();
    var rows = Math.ceil((leading + lastDate) / 7);
    var cells = rows * 7;
    grid.style.gridTemplateRows = "repeat(" + rows + ", 1fr)";

    for (var i = 0; i < cells; i++) {
      var cur = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      var key = S.dateKey(cur);
      var inMonth = cur.getMonth() === month;

      var cell = document.createElement("button");
      cell.className = "ym-day";
      cell.textContent = cur.getDate();
      cell.dataset.date = key;

      if (!inMonth) {
        cell.className += " out";
        cell.tabIndex = -1;
        cell.setAttribute("aria-hidden", "true");
      } else {
        var wd = cur.getDay();
        if (wd === 0 || wd === 6) cell.className += " weekend";
        var count = S.visibleEventsOn(key).length;
        var lvl = densityLevel(count);
        if (lvl > 0) {
          cell.className += " heat";
          cell.setAttribute("data-heat", lvl);
        }
        if (key === todayK) cell.className += " today";
        if (key === selK) cell.className += " selected";
        cell.title = S.prettyDate(key) + (count ? " · " + count + " event" + (count === 1 ? "" : "s") : "");
        cell.setAttribute("aria-label", cell.title);
        cell.addEventListener("click", (function (k) {
          return function () {
            S.setSelectedDate(k);
            window.Router.go("day");
          };
        })(key));
      }

      grid.appendChild(cell);
    }

    card.appendChild(grid);
    return card;
  }

  // this is the public api and registration
  window.YearView = { render: render };

  window.ViewRegistry.register("year", {
    title: "Year",
    render: function (c) { render(c); },
  });
})();
