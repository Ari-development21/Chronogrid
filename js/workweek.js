(function () {
  "use strict";

  var S = window.Store;

  // this is where the weekday offset gets worked out
  function weekdayOffset() {
    var startDay = S.getConfig().weekStartDay;
    return startDay === 0 ? 1 : 0;
  }

  // this is the rendering
  var container = null;
  function render(c) {
    container = c;
    window.WeekView.renderGrid({
      container: c,
      dayCount: 5,
      startOffset: weekdayOffset(),
    });
  }

  function updateNow() {
    window.WeekView.refreshNow(container);
  }

  // this is the public api and view registration
  window.WorkWeekView = { render: render, updateNow: updateNow };

  window.ViewRegistry.register("workweek", {
    title: "Work Week",
    render: function (c) { render(c); },
  });
})();
