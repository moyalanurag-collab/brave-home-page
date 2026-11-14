/* Command Centre core: storage, defaults, time helpers, icons, dialogs, toasts. */
(function () {
  "use strict";
  var CC = (window.CC = window.CC || {});
  CC.isExtension = !!(window.chrome && chrome.runtime && chrome.runtime.id);

  /* ---------- Storage (localStorage, with in-memory fallback) ---------- */
  var mem = {};
  CC.store = {
    get: function (k, d) {
      try { var v = localStorage.getItem("cc." + k); return v == null ? clone(d) : JSON.parse(v); }
      catch (e) { return k in mem ? mem[k] : clone(d); }
    },
    set: function (k, v) {
      mem[k] = v;
      try { localStorage.setItem("cc." + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    raw: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    exportAll: function () {
      var out = {};
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf("cc.") === 0) out[k] = JSON.parse(localStorage.getItem(k)); } } catch (e) {}
      return out;
    },
    importAll: function (obj) {
      Object.keys(obj).forEach(function (k) { if (k.indexOf("cc.") === 0) localStorage.setItem(k, JSON.stringify(obj[k])); });
    },
    clearAll: function () {
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf("cc.") === 0) localStorage.removeItem(k); }); } catch (e) {}
    }
  };
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  CC.clone = clone;
  CC.uid = function () { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); };

  /* ---------- Defaults ---------- */
  CC.defaults = {
    settings: {
      name: "Anurag", theme: "midnight", accent: "ember", background: "dots", cardOpacity: 70, density: "comfortable", engine: "google",
      clock: { style: "hybrid", hour12: true, seconds: true, tz: "Asia/Kolkata", label: "Mumbai",
        second: { on: true, tz: "Europe/London", label: "Glasgow" } },
      weather: { name: "Mumbai", region: "Maharashtra, India", lat: 19.07283, lon: 72.88261, units: "c" },
      calendar: { ics: "" },
      focus: { work: 25, brk: 5 }
    },
    layout: [
      { id: "clock", span: 5, visible: true },
      { id: "weather", span: 4, visible: true },
      { id: "focus", span: 3, visible: true },
      { id: "shortcuts", span: 12, visible: true },
      { id: "tasks", span: 5, visible: true },
      { id: "notes", span: 4, visible: true },
      { id: "agenda", span: 3, visible: true },
      { id: "world", span: 4, visible: false }
    ],
    shortcuts: [
      { name: "YouTube Studio", desc: "Uploads and analytics", url: "https://studio.youtube.com", key: "1" },
      { name: "YouTube", desc: "Watch", url: "https://www.youtube.com", key: "2" },
      { name: "TikTok", desc: "MMA Llama", url: "https://www.tiktok.com", key: "3" },
      { name: "Instagram", desc: "Reels", url: "https://www.instagram.com", key: "4" },
      { name: "Facebook", desc: "LLAMA MMA page", url: "https://www.facebook.com", key: "5" },
      { name: "CapCut", desc: "Edit", url: "https://www.capcut.com", key: "6" },
      { name: "ElevenLabs", desc: "Voiceovers", url: "https://elevenlabs.io/app", key: "7" },
      { name: "Gmail", desc: "Inbox", url: "https://mail.google.com", key: "8" },
      { name: "Claude", desc: "claude.ai", url: "https://claude.ai", key: "9" },
      { name: "ChatGPT", desc: "chatgpt.com", url: "https://chatgpt.com", key: "0" }
    ],
    world: [
      { tz: "Europe/London", label: "Glasgow" },
      { tz: "America/New_York", label: "New York" },
      { tz: "Asia/Dubai", label: "Dubai" }
    ]
  };
  CC.defaults.shortcuts.forEach(function (s, i) { s.id = "s" + i; });

  CC.THEMES = { midnight: "Midnight", graphite: "Graphite", abyss: "Abyss" };
  CC.ACCENTS = {
    ember: { label: "Ember", c: "#ff6b4a", ink: "#1a0a05" },
    azure: { label: "Azure", c: "#4cc3ff", ink: "#04131c" },
    jade: { label: "Jade", c: "#3ccf91", ink: "#03150d" },
    violet: { label: "Violet", c: "#a78bfa", ink: "#120a24" },
    gold: { label: "Gold", c: "#f2b84b", ink: "#1c1203" }
  };
  CC.ENGINES = {
    google: { label: "Google", url: "https://www.google.com/search?q=", domain: "google.com" },
    brave: { label: "Brave", url: "https://search.brave.com/search?q=", domain: "search.brave.com" },
    duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=", domain: "duckduckgo.com" },
    bing: { label: "Bing", url: "https://www.bing.com/search?q=", domain: "bing.com" }
  };

  /* Merge stored settings over defaults so new options appear after upgrades */
  function deepMerge(base, over) {
    if (!over || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
    var out = clone(base) || {};
    Object.keys(over).forEach(function (k) {
      out[k] = base && typeof base[k] === "object" && !Array.isArray(base[k]) ? deepMerge(base[k], over[k]) : over[k];
    });
    return out;
  }
  CC.settings = deepMerge(CC.defaults.settings, CC.store.get("settings", {}));
  CC.saveSettings = function () { CC.store.set("settings", CC.settings); CC.emit("settings"); };

  /* ---------- One-time migration from the first version of the page ---------- */
  (function migrate() {
    if (CC.store.get("migrated", false)) return;
    try {
      var old = CC.store.raw("sp.todos");
      if (old && !CC.store.raw("cc.tasks")) {
        CC.store.set("tasks", JSON.parse(old).map(function (t) {
          return { id: CC.uid(), text: t.t, done: !!t.d, p: 0, due: "", created: Date.now(), doneAt: t.d ? Date.now() : 0 };
        }));
      }
      var oldN = CC.store.raw("sp.notes");
      if (oldN && !CC.store.raw("cc.notes")) CC.store.set("notes", { text: JSON.parse(oldN), savedAt: Date.now() });
    } catch (e) {}
    CC.store.set("migrated", true);
  })();

  /* ---------- Tiny event bus ---------- */
  var subs = {};
  CC.on = function (ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return function () { subs[ev] = subs[ev].filter(function (f) { return f !== fn; }); }; };
  CC.emit = function (ev, data) { (subs[ev] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.warn(e); } }); };

  /* Hide favicons that fail to load (offline, blocked) instead of showing a broken image */
  document.addEventListener("error", function (e) { var t = e.target; if (t && t.tagName === "IMG" && !t.closest(".fav")) t.classList.add("broken"); }, true);

  /* ---------- DOM helpers ---------- */
  CC.h = function (tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.keys(v).forEach(function (s) { el.style.setProperty(s, v[s]); });
      else el.setAttribute(k, v === true ? "" : v);
    });
    (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return el;
  };
  CC.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---------- Icons (24px grid, stroke) ---------- */
  var P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.3-4.3"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    layout: '<rect x="3.5" y="3.5" width="7" height="8" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    pencil: '<path d="M14.5 5.5l4 4M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/>',
    skip: '<path d="M6 5.5v13l9-6.5zM18 5v14"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5S14.5 17.9 12 20.5C9.5 17.9 8.4 15.1 8.4 12S9.5 6.1 12 3.5z"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    flag: '<path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5M12 8v4l3 2"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    note: '<path d="M6 3.5h9l4 4v13H6z"/><path d="M14.5 3.5V8h4.5M9 12.5h7M9 16h5"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.5-1-2.6 0-.9.7-1.4 1.6-1.4h2.1c2.2 0 4-1.8 4-4 0-4.1-3.8-7.3-8.5-7.3z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>',
    star: '<path d="m12 3.8 2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    refresh: '<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1M18.5 3v4.5H14M5.5 21v-4.5H10"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'
  };
  CC.icon = function (name, cls) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "i" + (cls ? " " + cls : "")); s.setAttribute("aria-hidden", "true");
    s.innerHTML = P[name] || ""; return s;
  };
  CC.iconHTML = function (name) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || "") + "</svg>"; };

  /* ---------- Time helpers ---------- */
  var fmtCache = {};
  function partsFmt(tz) {
    var key = tz || "local";
    if (!fmtCache[key]) fmtCache[key] = new Intl.DateTimeFormat("en-GB", { timeZone: tz || undefined, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "long" });
    return fmtCache[key];
  }
  CC.tzParts = function (date, tz) {
    var o = {};
    try { partsFmt(tz).formatToParts(date).forEach(function (p) { o[p.type] = p.value; }); }
    catch (e) { partsFmt(null).formatToParts(date).forEach(function (p) { o[p.type] = p.value; }); }
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, m: +o.minute, s: +o.second, weekday: o.weekday };
  };
  /* Offset of a zone from UTC in minutes at a given instant */
  CC.tzOffset = function (tz, date) {
    var p = CC.tzParts(date || new Date(), tz);
    var asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.m, p.s);
    return Math.round((asUTC - Math.floor((date || new Date()).getTime() / 1000) * 1000) / 60000);
  };
  CC.gmtLabel = function (mins) {
    var sign = mins >= 0 ? "+" : "−", a = Math.abs(mins), h = Math.floor(a / 60), m = a % 60;
    return "GMT" + sign + h + (m ? ":" + String(m).padStart(2, "0") : "");
  };
  CC.diffLabel = function (mins) {
    if (!mins) return "Same time";
    var a = Math.abs(mins), h = Math.floor(a / 60), m = a % 60;
    return (h ? h + "h" : "") + (m ? (h ? " " : "") + m + "m" : "") + (mins > 0 ? " ahead" : " behind");
  };
  CC.fmtTime = function (h, m, hour12, s) {
    var mm = String(m).padStart(2, "0");
    if (!hour12) return String(h).padStart(2, "0") + ":" + mm + (s != null ? ":" + String(s).padStart(2, "0") : "");
    return (h % 12 || 12) + ":" + mm + (s != null ? ":" + String(s).padStart(2, "0") : "") + " " + (h < 12 ? "AM" : "PM");
  };
  CC.timeIn = function (tz, date) { var p = CC.tzParts(date || new Date(), tz); return CC.fmtTime(p.h, p.m, CC.settings.clock.hour12); };
  CC.ymd = function (d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  CC.parseYMD = function (s) { var a = s.split("-"); return new Date(+a[0], +a[1] - 1, +a[2]); };
  CC.dayLabel = function (ymd) {
    var today = CC.parseYMD(CC.ymd()), d = CC.parseYMD(ymd), diff = Math.round((d - today) / 864e5);
    if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; if (diff === -1) return "Yesterday";
    if (diff > 1 && diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };
  CC.zones = (function () { try { return Intl.supportedValuesOf("timeZone"); } catch (e) { return ["UTC", "Europe/London", "Asia/Kolkata", "America/New_York", "Asia/Dubai", "Asia/Tokyo", "Australia/Sydney"]; } })();
  CC.zoneCity = function (tz) { return tz.split("/").pop().replace(/_/g, " ").replace(/^Calcutta$|^Kolkata$/, "Mumbai"); };

  /* ---------- URL helpers ---------- */
  CC.looksLikeUrl = function (v) {
    v = v.trim();
    if (/\s/.test(v)) return false;
    if (/^(https?|file|brave|chrome):\/\//i.test(v)) return true;
    if (/^localhost(:\d+)?(\/.*)?$/i.test(v)) return true;
    return /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(v);
  };
  CC.toUrl = function (v) { v = v.trim(); return /^[a-z]+:\/\//i.test(v) ? v : (/^localhost/i.test(v) ? "http://" : "https://") + v; };
  CC.host = function (u) { try { return new URL(CC.toUrl(u)).hostname; } catch (e) { return ""; } };
  CC.favicon = function (u, size) { var h = CC.host(u); return h ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(h) + "&sz=" + (size || 64) : ""; };
  CC.go = function (url, newTab) { if (newTab) window.open(url, "_blank", "noopener"); else location.href = url; };
  CC.searchUrl = function (q) { return (CC.ENGINES[CC.settings.engine] || CC.ENGINES.google).url + encodeURIComponent(q); };

  /* Simple subsequence match with a score; higher is better */
  CC.match = function (q, text) {
    if (!q) return 1;
    q = q.toLowerCase(); text = text.toLowerCase();
    var idx = text.indexOf(q);
    if (idx === 0) return 100 - text.length * 0.01;
    if (idx > 0) return (text[idx - 1] === " " ? 80 : 60) - idx * 0.1;
    var ti = 0, score = 0, run = 0;
    for (var i = 0; i < q.length; i++) {
      var f = text.indexOf(q[i], ti);
      if (f < 0) return 0;
      run = f === ti ? run + 1 : 0; score += 1 + run; ti = f + 1;
    }
    return 10 + score;
  };

  /* ---------- Overlays: dialogs, confirm, toasts ---------- */
  var layerStack = [];
  CC.layerOpen = function () { return layerStack.length > 0; };
  CC.openLayer = function (els, onClose, opts) {
    opts = opts || {};
    var prevFocus = document.activeElement;
    var scrim = CC.h("div", { class: "scrim" });
    document.body.appendChild(scrim);
    els.forEach(function (e) { document.body.appendChild(e); });
    var layer = { close: close, els: els, scrim: scrim, keys: opts.keys };
    layerStack.push(layer);
    scrim.addEventListener("mousedown", function () { close(); });
    function close(result) {
      if (layer.closed) return; layer.closed = true;
      layerStack = layerStack.filter(function (l) { return l !== layer; });
      scrim.classList.add("out"); els.forEach(function (e) { e.classList.add("out"); });
      setTimeout(function () { scrim.remove(); els.forEach(function (e) { e.remove(); }); }, 170);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
      if (onClose) onClose(result);
    }
    return layer;
  };
  document.addEventListener("keydown", function (e) {
    var top = layerStack[layerStack.length - 1];
    if (!top) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); top.close(); return; }
    if (e.key === "Tab") { // keep focus inside the top layer
      var f = [].slice.call(top.els[0].querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }, true);

  /* Form dialog. fields: [{name,label,type,value,placeholder,hint,options,required}] */
  CC.dialog = function (o) {
    return new Promise(function (resolve) {
      var form = CC.h("form", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "dlg-t" });
      form.appendChild(CC.h("h2", { id: "dlg-t", text: o.title }));
      if (o.text) form.appendChild(CC.h("p", { text: o.text }));
      var inputs = {};
      (o.fields || []).forEach(function (f, i) {
        var id = "f-" + f.name;
        var input;
        if (f.type === "select") {
          input = CC.h("select", { class: "select", id: id, name: f.name });
          f.options.forEach(function (op) { var v = typeof op === "string" ? op : op.value; input.appendChild(CC.h("option", { value: v, selected: v === f.value ? true : null, text: typeof op === "string" ? op : op.label })); });
        } else {
          input = CC.h("input", { class: "input", id: id, name: f.name, type: f.type || "text", value: f.value == null ? "" : f.value, placeholder: f.placeholder || "", required: f.required ? true : null, autocomplete: "off", maxlength: f.max || null });
        }
        inputs[f.name] = input;
        var wrap = CC.h("label", { class: "field", for: id }, [CC.h("span", { text: f.label }), input, f.hint ? CC.h("small", { text: f.hint }) : null]);
        if (f.half && form.lastChild && form.lastChild.classList.contains("row2") && form.lastChild.children.length < 2) form.lastChild.appendChild(wrap);
        else if (f.half) form.appendChild(CC.h("div", { class: "row2" }, wrap));
        else form.appendChild(wrap);
      });
      var err = CC.h("p", { class: "err", role: "alert", hidden: true });
      form.appendChild(err);
      var actions = CC.h("div", { class: "actions" });
      if (o.extra) actions.appendChild(CC.h("button", { type: "button", class: "btn ghost danger", style: { "margin-right": "auto" }, text: o.extra.label, onclick: function () { layer.close({ __extra: true }); } }));
      actions.appendChild(CC.h("button", { type: "button", class: "btn ghost", text: o.cancel || "Cancel", onclick: function () { layer.close(null); } }));
      actions.appendChild(CC.h("button", { type: "submit", class: "btn " + (o.danger ? "danger" : "primary"), text: o.ok || "Save" }));
      form.appendChild(actions);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var vals = {}; Object.keys(inputs).forEach(function (k) { vals[k] = inputs[k].value.trim(); });
        var msg = o.validate ? o.validate(vals) : null;
        if (msg) { err.textContent = msg; err.hidden = false; return; }
        layer.close(vals);
      });
      var layer = CC.openLayer([form], function (r) { resolve(r == null ? null : r); });
      var first = form.querySelector("input,select");
      setTimeout(function () { (first || form.querySelector(".btn.primary,.btn.danger")).focus(); if (first && first.select) first.select(); }, 30);
    });
  };
  CC.confirm = function (title, text, ok) { return CC.dialog({ title: title, text: text, ok: ok || "Delete", danger: true }).then(function (r) { return !!r; }); };

  var toastBox;
  CC.toast = function (msg, opts) {
    opts = opts || {};
    if (!toastBox) { toastBox = CC.h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.appendChild(toastBox); }
    var t = CC.h("div", { class: "toast" }, [CC.icon(opts.icon || "check"), CC.h("span", { text: msg })]);
    if (opts.action) t.appendChild(CC.h("button", { class: "btn sm ghost", text: opts.action.label, onclick: function () { opts.action.run(); dismiss(); } }));
    toastBox.appendChild(t);
    var timer = setTimeout(dismiss, opts.ms || 2600);
    function dismiss() { clearTimeout(timer); t.classList.add("out"); setTimeout(function () { t.remove(); }, 170); }
  };

  /* Popover menu anchored to a button. items: [{label, icon, run, side, pressed}] or {label:'—'} */
  CC.menu = function (anchor, items, opts) {
    opts = opts || {};
    var pop = CC.h("div", { class: "pop menu", role: "menu" });
    items.forEach(function (it) {
      if (it.heading) { pop.appendChild(CC.h("div", { class: "pop-label", text: it.heading })); return; }
      var b = CC.h("button", { class: "opt", role: "menuitem", type: "button" }, [
        it.img ? CC.h("img", { src: it.img, alt: "" }) : it.icon ? CC.h("span", { class: "glyph" }, CC.icon(it.icon)) : null,
        CC.h("span", { class: "opt-main", text: it.label }),
        it.side ? CC.h("span", { class: "opt-side", text: it.side }) : it.pressed ? CC.h("span", { class: "opt-side" }, CC.icon("check")) : null
      ]);
      b.addEventListener("click", function () { close(); it.run && it.run(); });
      pop.appendChild(b);
    });
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    pop.style.position = "fixed";
    var w = pop.offsetWidth, left = opts.alignRight ? r.right - w : r.left;
    pop.style.left = Math.max(8, Math.min(left, innerWidth - w - 8)) + "px";
    var top = r.bottom + 6;
    if (top + pop.offsetHeight > innerHeight - 8) { top = r.top - pop.offsetHeight - 6; pop.style.transformOrigin = "bottom center"; }
    pop.style.top = top + "px";
    var btns = pop.querySelectorAll(".opt"); if (btns[0]) btns[0].focus();
    function onKey(e) {
      var list = [].slice.call(pop.querySelectorAll(".opt")), i = list.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); anchor.focus(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
    }
    function onDown(e) { if (!pop.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(); }
    document.addEventListener("keydown", onKey, true);
    setTimeout(function () { document.addEventListener("mousedown", onDown); }, 0);
    function close() { document.removeEventListener("keydown", onKey, true); document.removeEventListener("mousedown", onDown); pop.remove(); }
    return { close: close };
  };

  /* Short chime for timers, made with Web Audio (no files needed) */
  CC.chime = function () {
    try {
      var A = window.AudioContext || window.webkitAudioContext, ctx = new A();
      [0, 0.18].forEach(function (t, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = i ? 1046.5 : 784;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.6);
        o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.65);
      });
    } catch (e) {}
  };
})();
