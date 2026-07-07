(function () {
  "use strict";

  // this is the list of routes and who's listening
  var routes = [
    "day", "week", "workweek", "month", "year",
    "schedule", "board", "timeline", "focus",
    "analytics", "timers", "settings",
  ];
  var listeners = [];

  // this is where the current route gets figured out and switched
  function current() {
    var h = location.hash.replace(/^#\/?/, "").toLowerCase();
    if (routes.indexOf(h) > -1) return h;
    var cfg = window.Store && window.Store.getConfig && window.Store.getConfig();
    if (cfg && routes.indexOf(cfg.route) > -1) return cfg.route;
    return "week";
  }

  function go(route) {
    if (routes.indexOf(route) === -1) route = "week";
    if (current() === route) { notify(route); return; }
    location.hash = "#/" + route;
  }

  function notify(route) {
    listeners.forEach(function (fn) { fn(route); });
  }

  function onChange(fn) { listeners.push(fn); }

  // this is the hash change wiring
  window.addEventListener("hashchange", function () { notify(current()); });

  // this is the public api
  window.Router = {
    routes: routes,
    current: current,
    go: go,
    onChange: onChange,
  };
})();
