(function () {
  "use strict";

  // this is the text escaping

  function unescapeText(v) {
    return v
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }
  function escapeText(v) {
    return String(v)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  // this is the parsing

  function unfold(text) {
    var normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var rawLines = normalized.split("\n");
    var lines = [];
    for (var i = 0; i < rawLines.length; i++) {
      var line = rawLines[i];
      if ((line.charAt(0) === " " || line.charAt(0) === "\t") && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
    }
    return lines;
  }

  function parseLine(line) {
    var colon = line.indexOf(":");
    if (colon === -1) return null;
    var head = line.slice(0, colon);
    var value = line.slice(colon + 1);
    var parts = head.split(";");
    var name = parts[0].toUpperCase();
    var params = {};
    for (var i = 1; i < parts.length; i++) {
      var eq = parts[i].indexOf("=");
      if (eq > -1) params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
    }
    return { name: name, params: params, value: value };
  }

  function parseDate(value, params) {
    value = value.trim();
    var m;
    if ((m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/))) {
      var y = +m[1], mo = +m[2] - 1, d = +m[3], h = +m[4], mi = +m[5], s = +m[6];
      if (m[7] === "Z") {
        return { date: new Date(Date.UTC(y, mo, d, h, mi, s)), dateOnly: false };
      }
      return { date: new Date(y, mo, d, h, mi, s), dateOnly: false };
    }
    if ((m = value.match(/^(\d{4})(\d{2})(\d{2})$/))) {
      return { date: new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0), dateOnly: true };
    }
    return null;
  }

  function parse(text) {
    var lines = unfold(text);
    var events = [];
    var cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) continue;
      var parsed = parseLine(line);
      if (!parsed) continue;
      var n = parsed.name;
      if (n === "BEGIN" && parsed.value.toUpperCase() === "VEVENT") {
        cur = { summary: "", categories: "", dtstart: null, dtend: null, uid: "" };
        continue;
      }
      if (n === "END" && parsed.value.toUpperCase() === "VEVENT") {
        if (cur && cur.dtstart) events.push(cur);
        cur = null;
        continue;
      }
      if (!cur) continue;
      if (n === "SUMMARY") cur.summary = unescapeText(parsed.value);
      else if (n === "CATEGORIES") cur.categories = unescapeText(parsed.value);
      else if (n === "UID") cur.uid = parsed.value;
      else if (n === "DTSTART") cur.dtstart = parseDate(parsed.value, parsed.params);
      else if (n === "DTEND") cur.dtend = parseDate(parsed.value, parsed.params);
    }
    return events;
  }

  // this is the date formatting

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function formatLocal(date) {
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }
  function formatDateOnly(date) {
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate());
  }
  function formatUTC(date) {
    return (
      date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z"
    );
  }

  // this is the line folding

  function byteLen(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }
  function foldLine(line) {
    if (byteLen(line) <= 75) return line;
    var out = "";
    var chunk = "";
    var chunkBytes = 0;
    var first = true;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      var b = byteLen(ch);
      var limit = first ? 75 : 74;
      if (chunkBytes + b > limit) {
        out += (first ? "" : " ") + chunk + "\r\n";
        first = false;
        chunk = "";
        chunkBytes = 0;
      }
      chunk += ch;
      chunkBytes += b;
    }
    out += (first ? "" : " ") + chunk;
    return out;
  }

  // this is the serializing

  function serialize(events) {
    var lines = [];
    lines.push("BEGIN:VCALENDAR");
    lines.push("VERSION:2.0");
    lines.push("PRODID:-//Chronogrid//Calendar//EN");
    lines.push("CALSCALE:GREGORIAN");
    var stamp = formatUTC(new Date());
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + (e.uid || genUID()));
      lines.push("DTSTAMP:" + stamp);
      if (e.dateOnly) {
        lines.push("DTSTART;VALUE=DATE:" + formatDateOnly(e.start));
        lines.push("DTEND;VALUE=DATE:" + formatDateOnly(e.end));
      } else {
        lines.push("DTSTART:" + formatLocal(e.start));
        lines.push("DTEND:" + formatLocal(e.end));
      }
      lines.push("SUMMARY:" + escapeText(e.summary || "Untitled"));
      if (e.categories) lines.push("CATEGORIES:" + escapeText(e.categories));
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    var folded = [];
    for (var j = 0; j < lines.length; j++) folded.push(foldLine(lines[j]));
    return folded.join("\r\n") + "\r\n";
  }

  // this is the uid generator

  var uidCounter = 0;
  function genUID() {
    uidCounter++;
    return (
      Date.now().toString(36) +
      "-" +
      uidCounter +
      "-" +
      Math.random().toString(36).slice(2, 8) +
      "@chronogrid"
    );
  }

  // this is the public api

  window.ICS = {
    parse: parse,
    serialize: serialize,
    genUID: genUID,
    escapeText: escapeText,
    unescapeText: unescapeText,
    _unfold: unfold,
    _foldLine: foldLine,
    _parseDate: parseDate,
  };
})();
