(function () {
  "use strict";

  // this is the shared svg bits
  var s = 'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  var box = 'viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';

  // this is all the icons
  var icons = {
    day: '<svg ' + box + '><rect x="4" y="4" width="16" height="16" rx="3" ' + s + '/><path d="M4 9h16" ' + s + '/><path d="M9 13h6M9 16h4" ' + s + '/></svg>',
    week: '<svg ' + box + '><rect x="3" y="4" width="18" height="16" rx="3" ' + s + '/><path d="M3 9h18M9 9v11M15 9v11" ' + s + '/></svg>',
    workweek: '<svg ' + box + '><rect x="3" y="4" width="18" height="16" rx="3" ' + s + '/><path d="M3 9h18M8 9v11M13 9v11" ' + s + '/></svg>',
    month: '<svg ' + box + '><rect x="3" y="4" width="18" height="16" rx="3" ' + s + '/><path d="M3 9h18M9 9v11M15 9v11M3 14.5h18" ' + s + '/></svg>',
    year: '<svg ' + box + '><rect x="3" y="4" width="8" height="7" rx="1.5" ' + s + '/><rect x="13" y="4" width="8" height="7" rx="1.5" ' + s + '/><rect x="3" y="13" width="8" height="7" rx="1.5" ' + s + '/><rect x="13" y="13" width="8" height="7" rx="1.5" ' + s + '/></svg>',
    schedule: '<svg ' + box + '><path d="M8 6h12M8 12h12M8 18h12" ' + s + '/><circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>',
    board: '<svg ' + box + '><rect x="3" y="4" width="5" height="16" rx="1.5" ' + s + '/><rect x="9.5" y="4" width="5" height="11" rx="1.5" ' + s + '/><rect x="16" y="4" width="5" height="14" rx="1.5" ' + s + '/></svg>',
    timeline: '<svg ' + box + '><path d="M4 7h11M4 12h16M4 17h8" ' + s + '/><circle cx="17" cy="7" r="1.6" ' + s + '/><circle cx="12" cy="17" r="1.6" ' + s + '/></svg>',
    focus: '<svg ' + box + '><circle cx="12" cy="12" r="8" ' + s + '/><circle cx="12" cy="12" r="3" ' + s + '/></svg>',
    analytics: '<svg ' + box + '><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" ' + s + '/></svg>',
    timers: '<svg ' + box + '><circle cx="12" cy="13" r="8" ' + s + '/><path d="M12 13V9M9.5 3h5" ' + s + '/></svg>',
    settings: '<svg ' + box + '><circle cx="12" cy="12" r="3" ' + s + '/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2l-.4-2.6H8.9l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 4 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4.2l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12Z" ' + s + '/></svg>',
    plus: '<svg ' + box + '><path d="M12 5v14M5 12h14" ' + s + '/></svg>',
    chevronLeft: '<svg ' + box + '><path d="M15 6l-6 6 6 6" ' + s + '/></svg>',
    chevronRight: '<svg ' + box + '><path d="M9 6l6 6-6 6" ' + s + '/></svg>',
    sun: '<svg ' + box + '><circle cx="12" cy="12" r="4.2" ' + s + '/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" ' + s + '/></svg>',
    moon: '<svg ' + box + '><path d="M20 14.5A8 8 0 1 1 9.5 4a6.2 6.2 0 0 0 10.5 10.5Z" ' + s + '/></svg>',
    grid: '<svg ' + box + '><rect x="4" y="4" width="16" height="16" rx="3" ' + s + '/><path d="M4 12h16M12 4v16" ' + s + '/></svg>',
    upload: '<svg ' + box + '><path d="M12 15V4M8 8l4-4 4 4M5 20h14" ' + s + '/></svg>',
    download: '<svg ' + box + '><path d="M12 4v11M8 11l4 4 4-4M5 20h14" ' + s + '/></svg>',
    trash: '<svg ' + box + '><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" ' + s + '/></svg>',
    check: '<svg ' + box + '><path d="M5 12l5 5L20 6" ' + s + '/></svg>',
  };

  // this is the public api
  function get(name) { return icons[name] || icons.grid; }

  window.Icons = { get: get };
})();
