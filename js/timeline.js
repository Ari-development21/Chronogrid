(function () {
  "use strict";

  // this is the basic setup

  var DAY_MIN = 24 * 60;
  var MIN_DUR = 15;

  function snap(min, inc) { return Math.round(min / inc) * inc; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // this is the color and text stuff

  function inkFor(color) {
    var rgb = parseColor(color);
    if (!rgb) return "#fff";
    var lum = relativeLuminance(rgb);
    return lum > 0.22 ? "#1f2430" : "#fff";
  }

  function parseColor(color) {
    if (typeof color !== "string") return null;
    var hex = color.trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    var rm = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(hex);
    if (rm) return [+rm[1], +rm[2], +rm[3]];
    return null;
  }

  function relativeLuminance(rgb) {
    var c = rgb.map(function (v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function fmt(min) {
    min = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
    var h = Math.floor(min / 60), m = min % 60;
    return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  }

  function fmt12(min) {
    min = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
    var h = Math.floor(min / 60), m = min % 60;
    var ampm = h < 12 ? "am" : "pm";
    var hh = h % 12; if (hh === 0) hh = 12;
    return m === 0 ? hh + ampm : hh + ":" + (m < 10 ? "0" + m : m) + ampm;
  }

  // this is the overlap layout

  function packColumns(items) {
    var list = items.slice().sort(function (a, b) {
      return a.start - b.start || a.end - b.end;
    });
    var clusters = [];
    var current = [];
    var clusterEnd = -1;
    for (var i = 0; i < list.length; i++) {
      var blk = list[i];
      if (current.length && blk.start >= clusterEnd) {
        clusters.push(current);
        current = [];
        clusterEnd = -1;
      }
      current.push(blk);
      clusterEnd = Math.max(clusterEnd, blk.end);
    }
    if (current.length) clusters.push(current);

    var layout = {};
    clusters.forEach(function (cluster) {
      var colEnds = [];
      cluster.forEach(function (blk) {
        var placed = -1;
        for (var c = 0; c < colEnds.length; c++) {
          if (blk.start >= colEnds[c]) { placed = c; break; }
        }
        if (placed === -1) { placed = colEnds.length; colEnds.push(0); }
        colEnds[placed] = blk.end;
        blk._col = placed;
      });
      var cols = colEnds.length;
      cluster.forEach(function (blk) {
        layout[blk.id] = { col: blk._col, cols: cols };
      });
    });
    return layout;
  }

  // this is the buffer inserting

  function withBuffers(items, catOf, config, bufferVisible) {
    var user = items.filter(function (b) {
      var c = catOf(b.categoryId);
      return !(c && c.system);
    });
    if (!config.bufferEnabled) return user;
    if (bufferVisible === false) return user;

    var dur = config.bufferDuration;
    var maxGap = config.bufferMaxGap;
    var result = user.slice();
    var sorted = user.slice().sort(function (a, b) { return a.start - b.start; });

    for (var i = 0; i < sorted.length; i++) {
      for (var j = 0; j < sorted.length; j++) {
        if (i === j) continue;
        var a = sorted[i], b = sorted[j];
        var ca = catOf(a.categoryId), cb = catOf(b.categoryId);
        if (!ca || !cb) continue;
        var shift = (ca.intensive && !cb.intensive) || (!ca.intensive && cb.intensive);
        if (!shift) continue;
        var gap = b.start - a.end;
        if (gap < 0) continue;
        if (gap > maxGap) continue;
        var bufStart = a.end;
        var bufEnd = a.end + dur;
        if (bufEnd > b.start) bufEnd = b.start;
        if (bufEnd - bufStart < 5) continue;
        if (bufEnd > DAY_MIN) continue;
        var dup = result.some(function (x) {
          return x.categoryId === "buffer" && x.start === bufStart && x.end === bufEnd;
        });
        if (dup) continue;
        result.push({
          id: "buf-" + a.id + "-" + b.id,
          title: "Buffer",
          categoryId: "buffer",
          start: bufStart,
          end: bufEnd,
          system: true,
        });
      }
    }
    return result;
  }

  // this is the public api

  window.Timeline = {
    DAY_MIN: DAY_MIN,
    MIN_DUR: MIN_DUR,
    snap: snap,
    clamp: clamp,
    fmt: fmt,
    fmt12: fmt12,
    inkFor: inkFor,
    packColumns: packColumns,
    withBuffers: withBuffers,
  };
})();
