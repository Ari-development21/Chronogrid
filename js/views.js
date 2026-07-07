(function () {
  "use strict";

  // this is the view registry
  window.Views = window.Views || {};

  function register(route, def) {
    window.Views[route] = def;
  }

  function get(route) {
    return window.Views[route] || null;
  }

  window.ViewRegistry = { register: register, get: get };
})();
