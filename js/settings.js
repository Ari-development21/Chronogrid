(function () {
  "use strict";

  var S = window.Store;

  var root = null;

  // this is the main render
  function render(container) {
    if (container) root = container;
    if (!root) return;
    var cfg = S.getConfig();
    root.innerHTML = "";

    var wrap = document.createElement("div");
    wrap.className = "settings-view";

    wrap.appendChild(themeSection(cfg));
    wrap.appendChild(timezoneSection(cfg));
    wrap.appendChild(categoriesSection());
    wrap.appendChild(bufferSection(cfg));
    wrap.appendChild(gridSection(cfg));
    wrap.appendChild(dataSection());

    root.appendChild(wrap);
  }

  // this is the little panel and field helpers
  function panel(title, sub) {
    var p = document.createElement("section");
    p.className = "panel settings-panel";
    var h = document.createElement("h3");
    h.textContent = title;
    p.appendChild(h);
    if (sub) {
      var s = document.createElement("p");
      s.className = "panel-note";
      s.textContent = sub;
      p.appendChild(s);
    }
    return p;
  }

  function field(labelText) {
    var row = document.createElement("div");
    row.className = "set-field";
    var lbl = document.createElement("label");
    lbl.textContent = labelText;
    row.appendChild(lbl);
    return row;
  }

  // this is the theme picker
  function themeSection(cfg) {
    var p = panel("Theme", "System follows your OS light/dark setting.");
    var row = field("Appearance");
    var seg = document.createElement("div");
    seg.className = "seg";
    ["light", "dark", "system"].forEach(function (mode) {
      var b = document.createElement("button");
      b.className = "seg-btn" + (cfg.theme === mode ? " on" : "");
      b.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
      b.addEventListener("click", function () {
        window.Theme.set(mode);
        S.setConfig({ theme: mode });
        render();
      });
      seg.appendChild(b);
    });
    row.appendChild(seg);
    p.appendChild(row);
    return p;
  }

  // this is the timezone picker
  function timezoneSection(cfg) {
    var p = panel("Time zone", "The current-time line, hour labels, and \"today\" follow this zone.");
    var row = field("Zone");
    var sel = document.createElement("select");
    sel.className = "set-tz";

    var localName = S.localTz();
    var localOpt = document.createElement("option");
    localOpt.value = "";
    localOpt.textContent = "Local" + (localName ? " (" + localName.replace(/_/g, " ") + ")" : "");
    if (!cfg.timezone) localOpt.selected = true;
    sel.appendChild(localOpt);

    S.tzList().forEach(function (zone) {
      var o = document.createElement("option");
      o.value = zone;
      o.textContent = zone.replace(/_/g, " ");
      if (cfg.timezone === zone) o.selected = true;
      sel.appendChild(o);
    });

    sel.addEventListener("change", function () {
      S.setConfig({ timezone: sel.value });
      render();
    });
    row.appendChild(sel);
    p.appendChild(row);
    return p;
  }

  // this is the calendars editor
  function categoriesSection() {
    var p = panel("Calendars", "Color-coded categories for your events. Toggle visibility, and mark the intensive ones that drive the buffer engine.");
    var list = document.createElement("div");
    list.className = "cat-list";

    S.getCategories().forEach(function (cat) {
      var row = document.createElement("div");
      row.className = "cat-row";

      var vis = document.createElement("label");
      vis.className = "cat-vis";
      vis.title = "Show in calendar views";
      var visCb = document.createElement("input");
      visCb.type = "checkbox";
      visCb.checked = cat.visible !== false;
      visCb.addEventListener("change", function () {
        S.setCategoryVisible(cat.id, visCb.checked);
      });
      vis.appendChild(visCb);
      row.appendChild(vis);

      var color = document.createElement("input");
      color.type = "color";
      color.value = cat.color;
      color.disabled = !!cat.system;
      color.addEventListener("change", function () {
        S.updateCategory(cat.id, { color: color.value });
      });

      var name = document.createElement("input");
      name.type = "text";
      name.className = "cat-name";
      name.value = cat.name;
      name.disabled = !!cat.system;
      name.addEventListener("change", function () {
        S.updateCategory(cat.id, { name: name.value });
      });

      var intensiveLbl = document.createElement("label");
      intensiveLbl.className = "cat-intensive";
      var intensive = document.createElement("input");
      intensive.type = "checkbox";
      intensive.checked = !!cat.intensive;
      intensive.disabled = !!cat.system;
      intensive.addEventListener("change", function () {
        S.updateCategory(cat.id, { intensive: intensive.checked });
      });
      intensiveLbl.appendChild(intensive);
      intensiveLbl.appendChild(document.createTextNode(" intensive"));

      row.appendChild(color);
      row.appendChild(name);
      row.appendChild(intensiveLbl);

      if (cat.system) {
        var tag = document.createElement("span");
        tag.className = "cat-tag";
        tag.textContent = "system";
        row.appendChild(tag);
      } else {
        var del = document.createElement("button");
        del.className = "btn btn-ghost cat-del";
        del.textContent = "Delete";
        del.addEventListener("click", function () { deleteCategory(cat); });
        row.appendChild(del);
      }

      list.appendChild(row);
    });
    p.appendChild(list);

    var addRow = document.createElement("div");
    addRow.className = "cat-add";
    var newColor = document.createElement("input");
    newColor.type = "color";
    newColor.value = "#8b5cf6";
    var newName = document.createElement("input");
    newName.type = "text";
    newName.id = "newCatName";
    newName.className = "cat-name";
    var newNameLbl = document.createElement("label");
    newNameLbl.className = "cat-add-label";
    newNameLbl.setAttribute("for", "newCatName");
    newNameLbl.textContent = "New category";
    var newIntensiveLbl = document.createElement("label");
    newIntensiveLbl.className = "cat-intensive";
    var newIntensive = document.createElement("input");
    newIntensive.type = "checkbox";
    newIntensiveLbl.appendChild(newIntensive);
    newIntensiveLbl.appendChild(document.createTextNode(" intensive"));
    var addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.textContent = "Add";
    addBtn.addEventListener("click", function () {
      var nm = newName.value.trim();
      if (!nm) { window.App.toast("Enter a category name"); return; }
      S.addCategory({ name: nm, color: newColor.value, intensive: newIntensive.checked });
      render();
    });
    addRow.appendChild(newColor);
    addRow.appendChild(newNameLbl);
    addRow.appendChild(newName);
    addRow.appendChild(newIntensiveLbl);
    addRow.appendChild(addBtn);
    p.appendChild(addRow);

    return p;
  }

  // this is the category delete and reassign
  function deleteCategory(cat) {
    var others = S.userCategories().filter(function (c) { return c.id !== cat.id; });
    if (!others.length) {
      window.App.toast("Cannot delete the only remaining category");
      return;
    }
    if (!S.categoryInUse(cat.id)) {
      S.removeCategory(cat.id);
      render();
      return;
    }
    var target = window.prompt(
      '"' + cat.name + '" is in use. Reassign its events to which category?\n\n' +
      others.map(function (c) { return c.name; }).join(", "),
      others[0].name
    );
    if (target == null) return;
    var match = others.filter(function (c) {
      return c.name.toLowerCase() === target.trim().toLowerCase();
    })[0];
    if (!match) { window.App.toast("No matching category — deletion cancelled"); return; }
    S.removeCategory(cat.id, match.id);
    window.App.toast("Reassigned events to " + match.name);
    render();
  }

  // this is the buffer settings
  function bufferSection(cfg) {
    var p = panel("Context-Shift Buffers", "Auto-insert a ramp block whenever back-to-back work shifts between an intensive category and a lighter one.");

    var enableRow = field("Enable buffers");
    var toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = cfg.bufferEnabled;
    toggle.addEventListener("change", function () {
      S.setConfig({ bufferEnabled: toggle.checked });
    });
    enableRow.appendChild(toggle);
    p.appendChild(enableRow);

    var durRow = field("Buffer duration (min)");
    var dur = numberInput(cfg.bufferDuration, 5, 120);
    dur.addEventListener("change", function () {
      S.setConfig({ bufferDuration: clampNum(dur.value, 5, 120, 15) });
    });
    durRow.appendChild(dur);
    p.appendChild(durRow);

    var gapRow = field("Max gap to bridge (min)");
    var gap = numberInput(cfg.bufferMaxGap, 0, 120);
    gap.addEventListener("change", function () {
      S.setConfig({ bufferMaxGap: clampNum(gap.value, 0, 120, 20) });
    });
    gapRow.appendChild(gap);
    p.appendChild(gapRow);

    return p;
  }

  // this is the grid settings
  function gridSection(cfg) {
    var p = panel("Grid", "Snapping and the visible timeline range.");

    var snapRow = field("Snap increment (min)");
    var snap = document.createElement("select");
    [5, 10, 15, 30].forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = v;
      if (cfg.snap === v) o.selected = true;
      snap.appendChild(o);
    });
    snap.addEventListener("change", function () { S.setConfig({ snap: +snap.value }); });
    snapRow.appendChild(snap);
    p.appendChild(snapRow);

    var startRow = field("Day start hour");
    var startSel = hourSelect(cfg.dayStart, 0, 23);
    startRow.appendChild(startSel);
    p.appendChild(startRow);

    var endRow = field("Day end hour");
    var endSel = hourSelect(cfg.dayEnd, 1, 24);
    endRow.appendChild(endSel);
    p.appendChild(endRow);

    startSel.addEventListener("change", function () {
      var start = +startSel.value;
      var end = S.getConfig().dayEnd;
      if (end <= start) end = Math.min(start + 1, 24);
      S.setConfig({ dayStart: start, dayEnd: end });
      render();
    });
    endSel.addEventListener("change", function () {
      var end = +endSel.value;
      var start = S.getConfig().dayStart;
      if (end <= start) start = Math.max(end - 1, 0);
      S.setConfig({ dayStart: start, dayEnd: end });
      render();
    });

    var weekRow = field("Week starts on");
    var week = document.createElement("select");
    [[0, "Sunday"], [1, "Monday"]].forEach(function (pair) {
      var o = document.createElement("option");
      o.value = pair[0]; o.textContent = pair[1];
      if (cfg.weekStartDay === pair[0]) o.selected = true;
      week.appendChild(o);
    });
    week.addEventListener("change", function () { S.setConfig({ weekStartDay: +week.value }); });
    weekRow.appendChild(week);
    p.appendChild(weekRow);

    return p;
  }

  function hourSelect(current, lo, hi) {
    var sel = document.createElement("select");
    for (var h = lo; h <= hi; h++) {
      var o = document.createElement("option");
      o.value = h;
      o.textContent = (h < 10 ? "0" + h : h) + ":00";
      if (h === current) o.selected = true;
      sel.appendChild(o);
    }
    return sel;
  }

  // this is the import export and clear
  function dataSection() {
    var p = panel("Data", "Import, export, and reset. Buffers are never exported.");
    var row = document.createElement("div");
    row.className = "set-buttons";

    var imp = document.createElement("button");
    imp.className = "btn";
    imp.textContent = "Import .ics";
    imp.addEventListener("click", function () { window.App.pickImport(); });

    var exp = document.createElement("button");
    exp.className = "btn btn-primary";
    exp.textContent = "Export .ics";
    exp.addEventListener("click", function () { window.App.exportICS(); });

    var clear = document.createElement("button");
    clear.className = "btn btn-danger";
    clear.textContent = "Clear all data";
    clear.addEventListener("click", function () {
      if (!window.confirm("Clear all events, categories, timers, and settings? This cannot be undone.")) return;
      S.clearAll();
      window.Theme.set(S.getConfig().theme);
      window.App.toast("All data cleared");
      render();
    });

    row.appendChild(imp);
    row.appendChild(exp);
    row.appendChild(clear);
    p.appendChild(row);
    return p;
  }

  // this is the little input helpers
  function numberInput(value, min, max) {
    var i = document.createElement("input");
    i.type = "number";
    i.value = value;
    i.min = min; i.max = max;
    i.className = "set-num";
    return i;
  }
  function clampNum(v, lo, hi, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  // this is the public api and registration
  window.SettingsView = { render: render };

  window.ViewRegistry.register("settings", {
    title: "Settings",
    render: function (c) { render(c); },
  });
})();
