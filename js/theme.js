(function () {
  "use strict";

  // this is the dark mode watcher
  var media = null;
  try { media = window.matchMedia("(prefers-color-scheme: dark)"); } catch (e) { media = null; }

  function resolved(pref) {
    if (pref === "light" || pref === "dark") return pref;
    return media && media.matches ? "dark" : "light";
  }

  function apply(pref) {
    document.documentElement.dataset.theme = resolved(pref);
  }

  // this is where the theme gets set and kept in sync
  var currentPref = "system";
  function set(pref) {
    currentPref = pref;
    apply(pref);
  }

  if (media) {
    var handler = function () { if (currentPref === "system") apply("system"); };
    if (media.addEventListener) media.addEventListener("change", handler);
    else if (media.addListener) media.addListener(handler);
  }

  // this is the public api
  window.Theme = { set: set, resolved: resolved };
})();
