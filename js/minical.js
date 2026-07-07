(function () {
  "use strict";

  var S = window.Store;
  var root = null;
  var viewYear = null;
  var viewMonth = null;

  // this is the setup and view tracking

  function mount(container) {
    root = container;
    syncView();
    render();
  }

  function syncView() {
    var d = S.parseKey(S.getSelectedDate());
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
  }

  function shift(n) {
    viewMonth += n;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  }

  // this is where the month grid gets drawn

  function render() {
    if (!root) return;
    if (viewYear == null) syncView();
    var cfg = S.getConfig();
    root.innerHTML = "";

    var head = document.createElement("div");
    head.className = "mc-head";
    var title = document.createElement("span");
    title.className = "mc-title";
    title.textContent = S.MONTHS[viewMonth] + " " + viewYear;
    var nav = document.createElement("div");
    nav.className = "mc-nav";
    var prev = navBtn(window.Icons.get("chevronLeft"), function () { shift(-1); });
    var next = navBtn(window.Icons.get("chevronRight"), function () { shift(1); });
    nav.appendChild(prev);
    nav.appendChild(next);
    head.appendChild(title);
    head.appendChild(nav);
    root.appendChild(head);

    var dow = document.createElement("div");
    dow.className = "mc-dow";
    for (var w = 0; w < 7; w++) {
      var idx = (cfg.weekStartDay + w) % 7;
      var cell = document.createElement("span");
      cell.textContent = S.WEEKDAYS[idx].charAt(0);
      dow.appendChild(cell);
    }
    root.appendChild(dow);

    var gridWrap = document.createElement("div");
    gridWrap.className = "mc-grid";

    var first = new Date(viewYear, viewMonth, 1);
    var leading = (first.getDay() - cfg.weekStartDay + 7) % 7;
    var gridStart = new Date(viewYear, viewMonth, 1 - leading);
    var todayK = S.todayKey();

    for (var i = 0; i < 42; i++) {
      var d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      var key = S.dateKey(d);
      var inMonth = d.getMonth() === viewMonth;
      var b = document.createElement("button");
      b.className = "mc-day";
      if (!inMonth) b.className += " muted";
      if (key === todayK) b.className += " today";
      if (key === S.getSelectedDate()) b.className += " selected";
      b.textContent = d.getDate();
      b.dataset.date = key;
      b.addEventListener("click", (function (k) {
        return function () { S.setSelectedDate(k); };
      })(key));
      gridWrap.appendChild(b);
    }
    root.appendChild(gridWrap);
  }

  function navBtn(svg, fn) {
    var b = document.createElement("button");
    b.className = "mc-navbtn";
    b.innerHTML = svg;
    b.addEventListener("click", fn);
    return b;
  }

  // this is keeping it in sync with the selected date

  function syncToSelected() {
    if (viewYear == null) { syncView(); render(); return; }
    var d = S.parseKey(S.getSelectedDate());
    if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) {
      viewYear = d.getFullYear();
      viewMonth = d.getMonth();
    }
    render();
  }

  window.MiniCal = { mount: mount, render: render, syncToSelected: syncToSelected };
})();
