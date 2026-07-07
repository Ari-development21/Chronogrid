(function () {
  "use strict";

  var S = window.Store;
  var T = window.Timeline;

  var toastEl, toastTimer, fileInput, stage;

  // this is the little helpers

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }

  // this is the sidebar nav

  var navGroups = [
    { label: "Calendar", routes: ["day", "week", "workweek", "month", "year"] },
    { label: "Plan", routes: ["schedule", "board", "timeline", "focus"] },
    { label: "Track", routes: ["analytics", "timers"] },
    { label: "", routes: ["settings"] },
  ];

  var navLabels = {
    day: "Day", week: "Week", workweek: "Work Week", month: "Month", year: "Year",
    schedule: "Schedule", board: "Board", timeline: "Timeline", focus: "Focus",
    analytics: "Analytics", timers: "Timers", settings: "Settings",
  };

  function buildNav() {
    var nav = $("nav");
    nav.innerHTML = "";
    navGroups.forEach(function (group) {
      if (group.label) {
        var h = document.createElement("div");
        h.className = "nav-group-label";
        h.textContent = group.label;
        nav.appendChild(h);
      }
      group.routes.forEach(function (route) {
        var item = document.createElement("button");
        item.className = "nav-item";
        item.dataset.route = route;
        var ic = document.createElement("span");
        ic.className = "nav-ic";
        ic.innerHTML = window.Icons.get(route);
        var txt = document.createElement("span");
        txt.className = "nav-txt";
        txt.textContent = navLabels[route];
        item.appendChild(ic);
        item.appendChild(txt);
        item.addEventListener("click", function () { window.Router.go(route); });
        nav.appendChild(item);
      });
    });
  }

  function setActiveNav(route) {
    var items = document.querySelectorAll(".nav-item");
    items.forEach(function (it) {
      var on = it.dataset.route === route;
      it.classList.toggle("on", on);
      if (on) it.setAttribute("aria-current", "page");
      else it.removeAttribute("aria-current");
    });
  }

  // this is the calendar list in the sidebar

  function buildCalList() {
    var list = $("calList");
    list.innerHTML = "";
    S.getCategories().forEach(function (cat) {
      if (cat.id === "buffer") return;
      var row = document.createElement("div");
      row.className = "cal-item";

      var cb = document.createElement("button");
      cb.className = "cal-check" + (cat.visible !== false ? " on" : "");
      cb.style.setProperty("--dot", cat.color);
      cb.setAttribute("role", "checkbox");
      cb.setAttribute("aria-checked", cat.visible !== false ? "true" : "false");
      cb.setAttribute("aria-label", "Toggle " + cat.name);
      cb.innerHTML = '<span class="cal-box"><span class="cal-tick">' + window.Icons.get("check") + '</span></span>';
      cb.addEventListener("click", function () {
        S.setCategoryVisible(cat.id, cat.visible === false);
      });

      var name = document.createElement("button");
      name.className = "cal-name";
      name.textContent = cat.name;
      name.title = "Edit " + cat.name;
      name.addEventListener("click", function () {
        window.Router.go("settings");
      });

      row.appendChild(cb);
      row.appendChild(name);
      list.appendChild(row);
    });
  }

  // this is the date navigation and range labels

  function navStep(route, dir) {
    var sel = S.getSelectedDate();
    if (route === "week" || route === "workweek" || route === "focus" || route === "board") {
      S.setSelectedDate(S.addDays(sel, 7 * dir));
    } else if (route === "month" || route === "schedule" || route === "timeline") {
      var d = S.parseKey(sel);
      d.setMonth(d.getMonth() + dir);
      S.setSelectedDate(S.dateKey(d));
    } else if (route === "year") {
      var y = S.parseKey(sel);
      y.setFullYear(y.getFullYear() + dir);
      S.setSelectedDate(S.dateKey(y));
    } else {
      S.setSelectedDate(S.addDays(sel, dir));
    }
  }

  function rangeLabel(route) {
    var cfg = S.getConfig();
    var sel = S.getSelectedDate();
    if (route === "day") {
      return S.prettyDate(sel);
    }
    if (route === "week" || route === "workweek" || route === "focus" || route === "board") {
      var startKey = S.weekStart(sel, cfg.weekStartDay);
      var span = route === "workweek" ? 4 : 6;
      var endKey = S.addDays(startKey, span);
      return weekRangeLabel(startKey, endKey);
    }
    if (route === "year") {
      return String(S.parseKey(sel).getFullYear());
    }
    if (route === "month" || route === "schedule" || route === "timeline") {
      var d = S.parseKey(sel);
      return S.MONTHS[d.getMonth()] + " " + d.getFullYear();
    }
    return "";
  }

  function weekRangeLabel(startKey, endKey) {
    var a = S.parseKey(startKey), b = S.parseKey(endKey);
    var am = S.MONTHS_SHORT[a.getMonth()], bm = S.MONTHS_SHORT[b.getMonth()];
    if (a.getFullYear() !== b.getFullYear()) {
      return am + " " + a.getDate() + ", " + a.getFullYear() + " – " + bm + " " + b.getDate() + ", " + b.getFullYear();
    }
    if (a.getMonth() === b.getMonth()) {
      return am + " " + a.getDate() + " – " + b.getDate() + ", " + b.getFullYear();
    }
    return am + " " + a.getDate() + " – " + bm + " " + b.getDate() + ", " + b.getFullYear();
  }

  function showDateNav(route) {
    var nav = $("dateNav");
    var hidden = route === "timers" || route === "settings" || route === "analytics";
    nav.style.visibility = hidden ? "hidden" : "visible";
  }

  // this is where views get rendered

  function renderView(route) {
    var def = window.ViewRegistry.get(route);
    if (!def || !def.render) {
      throw new Error("No view registered for route: " + route);
    }
    $("viewTitle").textContent = def.title || navLabels[route] || "";
    $("viewRange").textContent = rangeLabel(route);
    showDateNav(route);
    def.render(stage);
  }

  function activate(route) {
    setActiveNav(route);
    if (S.getConfig().route !== route) S.setConfig({ route: route });
    window.MiniCal.syncToSelected();
    renderView(route);
  }

  function refreshChrome() {
    var route = window.Router.current();
    $("viewRange").textContent = rangeLabel(route);
    window.MiniCal.syncToSelected();
  }

  // this is the ics import and export

  function importICS(text) {
    var events;
    try { events = window.ICS.parse(text); }
    catch (e) { toast("Failed to parse .ics"); return; }
    if (!events.length) { toast("No events found in file"); return; }
    var added = 0;
    events.forEach(function (ev) {
      if (!ev.dtstart) return;
      var st = ev.dtstart.date;
      var startKey = S.dateKey(st);
      var catId = mapCategory(ev.categories);
      var title = ev.summary || "Imported";

      if (ev.dtstart.dateOnly) {
        var lastKey = startKey;
        if (ev.dtend && ev.dtend.date && ev.dtend.dateOnly) {
          var endExclusive = S.dateKey(ev.dtend.date);
          if (endExclusive > startKey) lastKey = S.addDays(endExclusive, -1);
        }
        var dayKey = startKey;
        while (true) {
          S.addEvent({ date: dayKey, start: 0, end: T.DAY_MIN, categoryId: catId, title: title, allDay: true });
          added++;
          if (dayKey === lastKey) break;
          dayKey = S.addDays(dayKey, 1);
        }
        return;
      }

      var startMin = st.getHours() * 60 + st.getMinutes();
      var endMin;
      if (ev.dtend && ev.dtend.date && !ev.dtend.dateOnly) {
        var e = ev.dtend.date;
        if (S.dateKey(e) > startKey) {
          endMin = T.DAY_MIN;
        } else {
          endMin = e.getHours() * 60 + e.getMinutes();
          if (endMin <= startMin) endMin = Math.min(startMin + 60, T.DAY_MIN);
        }
      } else {
        endMin = Math.min(startMin + 60, T.DAY_MIN);
      }
      S.addEvent({ date: startKey, start: startMin, end: endMin, categoryId: catId, title: title });
      added++;
    });
    toast("Imported " + added + " event" + (added === 1 ? "" : "s"));
    renderView(window.Router.current());
  }

  function mapCategory(catStr) {
    var cats = S.userCategories();
    if (catStr) {
      var match = cats.filter(function (c) {
        return c.name.toLowerCase() === catStr.trim().toLowerCase();
      })[0];
      if (match) return match.id;
      var partial = cats.filter(function (c) {
        return catStr.toLowerCase().indexOf(c.name.toLowerCase()) > -1;
      })[0];
      if (partial) return partial.id;
      var created = S.addCategory({ name: catStr.trim(), color: pickColor() });
      return created.id;
    }
    return S.firstUserCategoryId();
  }

  var colorPool = ["#6366f1", "#0ea5a4", "#f59e0b", "#10b981", "#ec4899", "#3b82f6", "#a855f7", "#f43f5e"];
  function pickColor() {
    var used = S.getCategories().map(function (c) { return c.color.toLowerCase(); });
    for (var i = 0; i < colorPool.length; i++) {
      if (used.indexOf(colorPool[i].toLowerCase()) === -1) return colorPool[i];
    }
    return colorPool[Math.floor(Math.random() * colorPool.length)];
  }

  function exportICS() {
    var all = S.allEvents();
    if (!all.length) { toast("Nothing to export"); return; }
    var events = all.map(function (ev) {
      var d = S.parseKey(ev.date);
      var y = d.getFullYear(), mo = d.getMonth(), day = d.getDate();
      var cat = S.getCategory(ev.categoryId);
      var base = {
        uid: window.ICS.genUID(),
        summary: ev.title || (cat ? cat.name : "Untitled"),
        categories: cat ? cat.name : "",
      };
      if (ev.allDay) {
        base.dateOnly = true;
        base.start = new Date(y, mo, day);
        base.end = new Date(y, mo, day + 1);
      } else {
        base.start = new Date(y, mo, day, Math.floor(ev.start / 60), ev.start % 60, 0);
        base.end = new Date(y, mo, day, Math.floor(ev.end / 60), ev.end % 60, 0);
      }
      return base;
    });
    var ics = window.ICS.serialize(events);
    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "chronogrid.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Exported " + events.length + " event" + (events.length === 1 ? "" : "s"));
  }

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = function () { importICS(String(reader.result)); };
    reader.onerror = function () { toast("Could not read file"); };
    reader.readAsText(file);
  }

  function pickImport() { fileInput.click(); }

  // this is the new event button

  function createEvent() {
    var cfg = S.getConfig();
    var route = window.Router.current();
    var date = S.getSelectedDate();
    var start, end;
    var now = new Date();
    if (date === S.todayKey()) {
      start = T.snap(T.clamp(now.getHours() * 60, cfg.dayStart * 60, cfg.dayEnd * 60 - 60), cfg.snap);
    } else {
      start = 9 * 60;
    }
    start = T.clamp(start, cfg.dayStart * 60, cfg.dayEnd * 60 - 60);
    end = Math.min(start + 60, cfg.dayEnd * 60);
    var ev = S.addEvent({ date: date, start: start, end: end, categoryId: S.firstUserCategoryId(), title: "" });
    if (route === "timers" || route === "settings" || route === "analytics" ||
        route === "year" || route === "focus") {
      window.Router.go("day");
    }
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    window.Editor.open(ev.id, cx - 130, cy - 120);
  }

  // this is the header and store wiring

  function wireHeader() {
    $("btnThemeToggle").addEventListener("click", function () {
      var cur = S.getConfig().theme;
      var next = window.Theme.resolved(cur) === "dark" ? "light" : "dark";
      window.Theme.set(next);
      S.setConfig({ theme: next });
      syncThemeSwitch();
      if (window.Router.current() === "settings") renderView("settings");
    });
    $("btnImport").addEventListener("click", pickImport);
    $("btnExport").addEventListener("click", exportICS);
    $("btnCreate").addEventListener("click", createEvent);
    $("btnHelp").addEventListener("click", function () { window.Guide.start(); });

    $("btnToday").addEventListener("click", function () { S.setSelectedDate(S.todayKey()); });
    $("btnPrev").addEventListener("click", function () { navStep(window.Router.current(), -1); });
    $("btnNext").addEventListener("click", function () { navStep(window.Router.current(), 1); });
    $("btnPrev").innerHTML = window.Icons.get("chevronLeft");
    $("btnNext").innerHTML = window.Icons.get("chevronRight");
    $("btnCreate").querySelector(".create-ic").innerHTML = window.Icons.get("plus");

    $("btnSidebar").addEventListener("click", function () {
      document.querySelector(".app").classList.toggle("sidebar-collapsed");
    });

    fileInput = $("fileInput");
    fileInput.addEventListener("change", function () {
      if (fileInput.files[0]) readFile(fileInput.files[0]);
      fileInput.value = "";
    });

    window.addEventListener("dragover", function (e) { e.preventDefault(); });
    window.addEventListener("drop", function (e) {
      e.preventDefault();
      var f = e.dataTransfer && e.dataTransfer.files[0];
      if (f && /\.ics$/i.test(f.name)) readFile(f);
    });
  }

  function syncThemeSwitch() {
    var dark = window.Theme.resolved(S.getConfig().theme) === "dark";
    var sw = $("btnThemeToggle");
    sw.classList.toggle("is-dark", dark);
    sw.querySelector(".ts-label").textContent = dark ? "Dark" : "Light";
  }

  function wireStore() {
    S.subscribe(function (reason) {
      if (reason === "date") {
        window.MiniCal.syncToSelected();
        renderView(window.Router.current());
        return;
      }
      if (reason === "categories") {
        buildCalList();
        renderView(window.Router.current());
        return;
      }
      if (reason === "config" || reason === "clear" || reason === "events") {
        if (reason === "clear") { buildCalList(); syncThemeSwitch(); }
        window.MiniCal.render();
        renderView(window.Router.current());
        return;
      }
    });
  }

  function wireTimers() {
    window.Timers.onChange = function () {
      window.TimersView.renderTimers();
      window.TimersView.renderChains();
      var r = window.Router.current();
      if (r === "day") renderView("day");
      S.persist();
    };
    window.Timers.onTick = function () { window.TimersView.tick(); };
    window.Timers.onFire = function (t) { toast(t.name + " finished"); };
  }

  function tickClock() {
    var r = window.Router.current();
    if (r === "day" && window.DayView.updateNow) window.DayView.updateNow();
    if (r === "week" && window.WeekView.updateNow) window.WeekView.updateNow();
    if (r === "workweek" && window.WorkWeekView.updateNow) window.WorkWeekView.updateNow();
  }

  // this is the startup

  function init() {
    toastEl = $("toast");
    stage = $("stage");

    var result = S.init();
    window.Theme.set(S.getConfig().theme);

    buildNav();
    buildCalList();
    window.MiniCal.mount($("miniCal"));
    window.Editor.init();

    wireHeader();
    syncThemeSwitch();
    wireStore();
    wireTimers();

    window.Router.onChange(activate);
    activate(window.Router.current());

    setTimeout(function () { window.Guide.maybeAutoStart(); }, 120);

    setInterval(tickClock, 1000);

    window.addEventListener("pointerdown", function once() {
      window.Timers.ensureAudio();
      window.removeEventListener("pointerdown", once);
    });
  }

  // this is the public api

  window.App = {
    toast: toast,
    exportICS: exportICS,
    pickImport: pickImport,
    refreshChrome: refreshChrome,
    rebuildCalList: buildCalList,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
