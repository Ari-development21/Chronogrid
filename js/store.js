(function () {
  "use strict";

  var STORAGE_KEY = "chronogrid.v1";

  // this is the timezone and date stuff

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function nowParts() {
    var d = new Date();
    var tz = state && state.config && state.config.timezone;
    if (!tz) {
      return { y: d.getFullYear(), mo: d.getMonth() + 1, da: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() };
    }
    try {
      var p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
      }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return { y: +p.year, mo: +p.month, da: +p.day, h: (+p.hour) % 24, mi: +p.minute, s: +p.second };
    } catch (e) {
      return { y: d.getFullYear(), mo: d.getMonth() + 1, da: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() };
    }
  }

  function todayKey() {
    var p = nowParts();
    return p.y + "-" + pad2(p.mo) + "-" + pad2(p.da);
  }

  function nowMinutes() {
    var p = nowParts();
    return p.h * 60 + p.mi + p.s / 60;
  }

  function tzLabel() {
    var d = new Date();
    var tz = state && state.config && state.config.timezone;
    try {
      if (!tz) {
        var off = -d.getTimezoneOffset() / 60;
        return "GMT" + (off >= 0 ? "+" : "") + off;
      }
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(d);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "timeZoneName") return parts[i].value;
      }
      return tz;
    } catch (e) { return ""; }
  }

  function localTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
  }

  function tzList() {
    try {
      if (typeof Intl.supportedValuesOf === "function") return Intl.supportedValuesOf("timeZone");
    } catch (e) { }
    return ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
      "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Athens",
      "Africa/Johannesburg", "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok", "Asia/Shanghai",
      "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"];
  }

  function dateKey(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parseKey(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!m) return new Date();
    return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
  }

  function addDays(key, n) {
    var d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }

  function weekdayOf(key) {
    return parseKey(key).getDay();
  }

  function weekStart(key, weekStartDay) {
    var d = parseKey(key);
    var diff = (d.getDay() - weekStartDay + 7) % 7;
    d.setDate(d.getDate() - diff);
    return dateKey(d);
  }

  // this is the month and weekday names

  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function prettyDate(key) {
    var d = parseKey(key);
    return WEEKDAYS_FULL[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  // this is the defaults and the state

  var defaultCategories = [
    { id: "dev", name: "Deep Work", color: "#6366f1", intensive: true, visible: true },
    { id: "admin", name: "Admin", color: "#0f766e", intensive: false, visible: true },
    { id: "meeting", name: "Meetings", color: "#b45309", intensive: false, visible: true },
    { id: "break", name: "Personal", color: "#047857", intensive: false, visible: true },
    { id: "buffer", name: "Buffer", color: "#94a3b8", intensive: false, system: true, visible: true },
  ];

  var defaultConfig = {
    theme: "light",
    route: "week",
    snap: 15,
    dayStart: 0,
    dayEnd: 24,
    weekStartDay: 1,
    timezone: "",
    bufferEnabled: true,
    bufferDuration: 15,
    bufferMaxGap: 20,
    guideSeen: false,
  };

  var state = {
    events: [],
    categories: null,
    config: null,
    selectedDate: todayKey(),
  };

  // this is the subscribe and notify

  var subs = [];
  function subscribe(fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }
  function emit(reason) { subs.forEach(function (fn) { fn(reason); }); }

  var idSeq = 0;
  function newId(prefix) {
    idSeq++;
    return prefix + Date.now().toString(36) + idSeq.toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function cloneDefaults() {
    return defaultCategories.map(function (c) { return Object.assign({}, c); });
  }

  // this is the categories

  function getCategories() { return state.categories; }
  function getCategory(id) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].id === id) return state.categories[i];
    }
    return null;
  }
  function userCategories() {
    return state.categories.filter(function (c) { return !c.system; });
  }
  function firstUserCategoryId() {
    var u = userCategories();
    if (u.length) return u[0].id;
    return state.categories.length ? state.categories[0].id : "dev";
  }
  function isCategoryVisible(id) {
    var c = getCategory(id);
    if (!c) return true;
    return c.visible !== false;
  }
  function setCategoryVisible(id, visible) {
    var c = getCategory(id);
    if (!c) return;
    c.visible = !!visible;
    persist();
    emit("categories");
  }

  // this is the config and selected date

  function getConfig() { return state.config; }
  function setConfig(patch) {
    Object.assign(state.config, patch);
    persist();
    emit("config");
  }

  function getSelectedDate() { return state.selectedDate; }
  function setSelectedDate(key) {
    if (key === state.selectedDate) return;
    state.selectedDate = key;
    persist();
    emit("date");
  }

  // this is the events

  function allEvents() { return state.events; }

  function eventsOn(dateKeyStr) {
    return state.events.filter(function (e) { return e.date === dateKeyStr; });
  }

  function visibleEventsOn(dateKeyStr) {
    return state.events.filter(function (e) {
      return e.date === dateKeyStr && isCategoryVisible(e.categoryId);
    });
  }

  function getEvent(id) {
    for (var i = 0; i < state.events.length; i++) {
      if (state.events[i].id === id) return state.events[i];
    }
    return null;
  }

  function makeEvent(ev) {
    return {
      id: ev.id || newId("e"),
      date: ev.date || state.selectedDate,
      start: ev.start,
      end: ev.end,
      categoryId: ev.categoryId || firstUserCategoryId(),
      title: ev.title || "",
      note: ev.note || "",
      allDay: !!ev.allDay,
    };
  }

  function addEvent(ev) {
    var e = makeEvent(ev);
    state.events.push(e);
    persist();
    emit("events");
    return e;
  }

  function addEvents(list) {
    var out = list.map(function (ev) {
      var e = makeEvent(ev);
      state.events.push(e);
      return e;
    });
    persist();
    emit("events");
    return out;
  }

  function updateEvent(id, patch) {
    var e = getEvent(id);
    if (!e) return null;
    Object.assign(e, patch);
    persist();
    emit("events");
    return e;
  }

  function removeEvent(id) {
    state.events = state.events.filter(function (e) { return e.id !== id; });
    persist();
    emit("events");
  }

  // this is the category editing

  function addCategory(data) {
    var c = {
      id: newId("cat"),
      name: data.name || "Untitled",
      color: data.color || "#6366f1",
      intensive: !!data.intensive,
      visible: data.visible !== false,
    };
    state.categories.push(c);
    persist();
    emit("categories");
    return c;
  }

  function updateCategory(id, patch) {
    var c = getCategory(id);
    if (!c) return null;
    if (c.system) {
      if (patch.visible != null) c.visible = !!patch.visible;
      persist();
      emit("categories");
      return c;
    }
    if (patch.name != null) c.name = patch.name;
    if (patch.color != null) c.color = patch.color;
    if (patch.intensive != null) c.intensive = !!patch.intensive;
    if (patch.visible != null) c.visible = !!patch.visible;
    persist();
    emit("categories");
    return c;
  }

  function categoryInUse(id) {
    return state.events.some(function (e) { return e.categoryId === id; });
  }

  function removeCategory(id, reassignTo) {
    var c = getCategory(id);
    if (!c || c.system) return false;
    if (categoryInUse(id)) {
      if (!reassignTo) return false;
      state.events.forEach(function (e) {
        if (e.categoryId === id) e.categoryId = reassignTo;
      });
    }
    state.categories = state.categories.filter(function (x) { return x.id !== id; });
    persist();
    emit("categories");
    return true;
  }

  // this is the saved data

  function persist() {
    try {
      var data = {
        version: 3,
        events: state.events,
        categories: state.categories,
        config: state.config,
        selectedDate: state.selectedDate,
        timers: window.Timers ? window.Timers.serialize() : null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { }
  }

  function persistOnly() { persist(); }

  function load() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function clearAll() {
    state.events = [];
    state.categories = cloneDefaults();
    state.config = Object.assign({}, defaultConfig);
    state.selectedDate = todayKey();
    if (window.Timers) window.Timers.load({ timers: [], chains: [] });
    persist();
    emit("clear");
  }

  function replaceState(data) {
    state.events = data.events;
    state.categories = data.categories;
    state.config = data.config;
    state.selectedDate = data.selectedDate;
    persist();
    emit("clear");
  }

  function normalizeCategories(cats) {
    return cats.map(function (c) {
      if (c.visible == null) c.visible = true;
      return c;
    });
  }

  // this is the startup and loading

  function init() {
    var saved = load();
    if (saved && saved.categories && saved.config) {
      state.categories = normalizeCategories(saved.categories);
      state.config = Object.assign({}, defaultConfig, saved.config);
      state.events = saved.events || [];
      state.selectedDate = saved.selectedDate || todayKey();
      migrateFullDay();
      ensureBufferCategory();
      if (window.Timers && saved.timers) window.Timers.load(saved.timers);
      return { restored: true, timers: saved.timers };
    }
    state.categories = cloneDefaults();
    state.config = Object.assign({}, defaultConfig);
    state.selectedDate = todayKey();
    return { restored: false };
  }

  // this is the one-time full-day migration

  function migrateFullDay() {
    var c = state.config;
    if (c.dayStart === 6 && c.dayEnd === 24 && !c.fullDayMigrated) {
      c.dayStart = 0;
      c.fullDayMigrated = true;
      persist();
    }
  }

  function ensureBufferCategory() {
    var has = state.categories.some(function (c) { return c.id === "buffer"; });
    if (!has) {
      state.categories.push({ id: "buffer", name: "Buffer", color: "#94a3b8", intensive: false, system: true, visible: true });
    }
  }

  // this is the public api

  window.Store = {
    STORAGE_KEY: STORAGE_KEY,
    init: init,
    subscribe: subscribe,
    emit: emit,
    persist: persistOnly,

    todayKey: todayKey,
    nowMinutes: nowMinutes,
    tzLabel: tzLabel,
    tzList: tzList,
    localTz: localTz,
    dateKey: dateKey,
    parseKey: parseKey,
    addDays: addDays,
    weekdayOf: weekdayOf,
    weekStart: weekStart,
    prettyDate: prettyDate,
    MONTHS: MONTHS,
    MONTHS_SHORT: MONTHS_SHORT,
    WEEKDAYS: WEEKDAYS,
    WEEKDAYS_FULL: WEEKDAYS_FULL,

    getConfig: getConfig,
    setConfig: setConfig,
    getSelectedDate: getSelectedDate,
    setSelectedDate: setSelectedDate,

    getCategories: getCategories,
    getCategory: getCategory,
    userCategories: userCategories,
    firstUserCategoryId: firstUserCategoryId,
    isCategoryVisible: isCategoryVisible,
    setCategoryVisible: setCategoryVisible,
    addCategory: addCategory,
    updateCategory: updateCategory,
    removeCategory: removeCategory,
    categoryInUse: categoryInUse,

    allEvents: allEvents,
    eventsOn: eventsOn,
    visibleEventsOn: visibleEventsOn,
    getEvent: getEvent,
    addEvent: addEvent,
    addEvents: addEvents,
    updateEvent: updateEvent,
    removeEvent: removeEvent,

    clearAll: clearAll,
    replaceState: replaceState,
    newId: newId,
  };
})();
