/* Command Centre shell: theme, header, search, layout and customise mode, command palette, settings, keyboard. */
(function () {
  "use strict";
  var CC = window.CC, h = CC.h, icon = CC.icon, S = function () { return CC.settings; };
  var root = document.documentElement;

  /* ---------- Theme ---------- */
  function applyTheme() {
    var s = S(), a = CC.ACCENTS[s.accent] || CC.ACCENTS.ember;
    root.dataset.theme = s.theme; root.dataset.bg = s.background; root.dataset.density = s.density;
    root.style.setProperty("--accent", a.c); root.style.setProperty("--accent-ink", a.ink);
  }
  applyTheme();
  CC.on("settings", applyTheme);

  /* ---------- Layout state ---------- */
  CC.layout = {
    get: function () {
      var saved = CC.store.get("layout", null), def = CC.clone(CC.defaults.layout);
      if (!saved) return def;
      // keep stored order, add any widgets introduced later, drop unknown ones
      var ids = saved.map(function (x) { return x.id; });
      def.forEach(function (d) { if (ids.indexOf(d.id) < 0) saved.push(Object.assign(d, { visible: false })); });
      return saved.filter(function (x) { return CC.widgets[x.id]; });
    },
    save: function (l) { CC.store.set("layout", l); },
    presets: function () { return CC.store.get("layouts", []); },
    savePresets: function (p) { CC.store.set("layouts", p); }
  };
  var layout = CC.layout.get();

  /* ---------- Header ---------- */
  var app = document.getElementById("app");
  var hello = h("div", { class: "hello" }, [h("h1", { id: "greet" }), h("p", { id: "today" })]);
  var palBtn = h("button", { class: "btn", type: "button", "aria-label": "Open command palette (Ctrl K)" }, [icon("command"), h("span", { text: "Commands" }), h("span", { class: "kbd", text: "Ctrl K" })]);
  var editBtn = h("button", { class: "btn", type: "button" }, [icon("layout"), h("span", { text: "Customise" })]);
  var setBtn = h("button", { class: "btn icon", type: "button", "aria-label": "Settings", title: "Settings" }, icon("sliders"));
  palBtn.addEventListener("click", function () { CC.palette(); });
  editBtn.addEventListener("click", function () { startCustomise(); });
  setBtn.addEventListener("click", function () { CC.openSettings(); });
  var top = h("header", { class: "top" }, [hello, h("div", { class: "top-actions" }, [palBtn, editBtn, setBtn])]);

  function paintHello() {
    var p = CC.tzParts(new Date(), S().clock.tz), hr = p.h;
    var g = hr < 5 ? "Working late" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
    document.getElementById("greet").textContent = g + (S().name ? ", " + S().name : "");
    var d = new Date(Date.UTC(p.y, p.mo - 1, p.d));
    var st = CC.tasks.stats();
    document.getElementById("today").textContent = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) +
      (st.open ? ". " + st.open + (st.open === 1 ? " task" : " tasks") + " open" : "");
  }

  /* ---------- Search ---------- */
  var engineBtn = h("button", { class: "engine", type: "button", "aria-label": "Choose search engine" });
  var input = h("input", { id: "q", type: "text", autocomplete: "off", spellcheck: "false", role: "combobox", "aria-expanded": "false", "aria-controls": "suggest", "aria-autocomplete": "list" });
  var goBtn = h("button", { class: "search-go", type: "submit", "aria-label": "Search" }, icon("arrowRight"));
  var hint = h("span", { class: "search-hint" }, [h("kbd", { text: "/" })]);
  var form = h("form", { class: "search-box", role: "search" }, [icon("search"), h("label", { class: "sr", for: "q", text: "Search or enter address" }), input, hint, engineBtn, goBtn]);
  var sugBox = h("div", { class: "pop suggest", id: "suggest", role: "listbox", hidden: true });
  var search = h("div", { class: "search" }, [form, sugBox]);
  function paintEngine() {
    var e = CC.ENGINES[S().engine] || CC.ENGINES.google;
    engineBtn.innerHTML = ""; engineBtn.appendChild(h("img", { src: CC.favicon(e.domain, 32), alt: "" })); engineBtn.appendChild(h("span", { text: e.label }));
    input.placeholder = "Search " + e.label + " or type a web address";
  }
  engineBtn.addEventListener("click", function () {
    CC.menu(engineBtn, [{ heading: "Search with" }].concat(Object.keys(CC.ENGINES).map(function (k) {
      return { label: CC.ENGINES[k].label, img: CC.favicon(CC.ENGINES[k].domain, 32), pressed: S().engine === k, run: function () { S().engine = k; CC.saveSettings(); input.focus(); } };
    })), { alignRight: true });
  });
  var hist = function () { return CC.store.get("searches", []); };
  function remember(q) { var l = hist().filter(function (x) { return x !== q; }); l.unshift(q); CC.store.set("searches", l.slice(0, 40)); }
  var sugItems = [], sugSel = -1, sugReq = 0, remoteSug = [];
  function runQuery(q, newTab) {
    q = q.trim(); if (!q) return;
    if (CC.looksLikeUrl(q)) CC.go(CC.toUrl(q), newTab);
    else { remember(q); CC.go(CC.searchUrl(q), newTab); }
  }
  function buildSug() {
    var q = input.value.trim(), out = [];
    if (!q) { sugItems = []; drawSug(); return; }
    if (CC.looksLikeUrl(q)) out.push({ kind: "url", label: "Open " + q, run: function (nt) { CC.go(CC.toUrl(q), nt); }, glyph: "link" });
    CC.shortcuts.all().map(function (s) { return { s: s, sc: Math.max(CC.match(q, s.name), CC.match(q, CC.host(s.url))) }; }).filter(function (x) { return x.sc > 20; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 2)
      .forEach(function (x) { out.push({ kind: "sc", label: x.s.name, side: "Shortcut", img: CC.favicon(x.s.url, 32), run: function (nt) { CC.go(x.s.url, nt); } }); });
    hist().filter(function (x) { return x.toLowerCase().indexOf(q.toLowerCase()) === 0 && x !== q; }).slice(0, 3)
      .forEach(function (x) { out.push({ kind: "hist", label: x, glyph: "history", run: function (nt) { runQuery(x, nt); } }); });
    remoteSug.filter(function (x) { return x !== q && !out.some(function (o) { return o.label === x; }); }).slice(0, 5)
      .forEach(function (x) { out.push({ kind: "remote", label: x, glyph: "search", run: function (nt) { runQuery(x, nt); } }); });
    if (!CC.looksLikeUrl(q)) out.unshift({ kind: "search", label: q, side: (CC.ENGINES[S().engine] || CC.ENGINES.google).label, glyph: "search", run: function (nt) { runQuery(q, nt); } });
    sugItems = out.slice(0, 8); sugSel = -1; drawSug();
  }
  function drawSug() {
    sugBox.innerHTML = "";
    if (!sugItems.length || document.activeElement !== input) { sugBox.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    var q = input.value.trim().toLowerCase();
    sugItems.forEach(function (it, i) {
      var main = h("span", { class: "opt-main" });
      var lab = it.label, idx = lab.toLowerCase().indexOf(q);
      if ((it.kind === "hist" || it.kind === "remote") && idx === 0) { main.appendChild(document.createTextNode(lab.slice(0, q.length))); main.appendChild(h("b", { text: lab.slice(q.length) })); }
      else main.appendChild(h("b", { text: lab }));
      var b = h("div", { class: "opt", role: "option", id: "sug-" + i, "aria-selected": i === sugSel ? "true" : "false" }, [
        it.img ? h("img", { src: it.img, alt: "" }) : h("span", { class: "glyph" }, icon(it.glyph || "search")), main,
        it.side ? h("span", { class: "opt-side", text: it.side }) : null
      ]);
      b.addEventListener("mousedown", function (e) { e.preventDefault(); it.run(e.ctrlKey || e.metaKey); });
      sugBox.appendChild(b);
    });
    sugBox.hidden = false; input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", sugSel >= 0 ? "sug-" + sugSel : "");
  }
  function fetchRemote(q) {
    if (!CC.isExtension || !q || CC.looksLikeUrl(q)) { remoteSug = []; return; }
    var id = ++sugReq;
    fetch("https://suggestqueries.google.com/complete/search?client=firefox&q=" + encodeURIComponent(q)).then(function (r) { return r.json(); })
      .then(function (d) { if (id !== sugReq) return; remoteSug = (d && d[1]) || []; buildSug(); }).catch(function () {});
  }
  var deb;
  input.addEventListener("input", function () { remoteSug = []; buildSug(); clearTimeout(deb); var q = input.value.trim(); deb = setTimeout(function () { fetchRemote(q); }, 140); });
  input.addEventListener("focus", buildSug);
  input.addEventListener("blur", function () { setTimeout(function () { sugBox.hidden = true; input.setAttribute("aria-expanded", "false"); }, 100); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" && sugItems.length) { e.preventDefault(); sugSel = (sugSel + 1) % sugItems.length; drawSug(); }
    else if (e.key === "ArrowUp" && sugItems.length) { e.preventDefault(); sugSel = sugSel <= 0 ? sugItems.length - 1 : sugSel - 1; drawSug(); }
    else if (e.key === "Escape") { if (!sugBox.hidden) { sugBox.hidden = true; } else if (input.value) input.value = ""; else input.blur(); e.preventDefault(); }
    else if (e.key === "Tab" && sugSel >= 0 && (sugItems[sugSel].kind === "hist" || sugItems[sugSel].kind === "remote")) { e.preventDefault(); input.value = sugItems[sugSel].label; buildSug(); }
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sugSel >= 0 && sugItems[sugSel]) sugItems[sugSel].run(false); else runQuery(input.value, false);
  });

  /* ---------- Edit bar (customise mode) ---------- */
  var addWBtn = h("button", { class: "btn sm", type: "button" }, [icon("plus"), "Add widget"]);
  var presetsBtn = h("button", { class: "btn sm", type: "button" }, [icon("star"), "Layouts"]);
  var resetBtn = h("button", { class: "btn sm ghost", type: "button", text: "Reset to original" });
  var cancelBtn = h("button", { class: "btn sm", type: "button", text: "Cancel" });
  var saveBtn = h("button", { class: "btn sm primary", type: "button", text: "Save layout" });
  var editbar = h("div", { class: "editbar", role: "toolbar", "aria-label": "Customise layout" }, [
    h("span", { class: "grow" }, [h("b", { text: "Customise layout" }), h("span", { class: "muted", text: "  Drag widgets to move them, pick a width, or hide them." })]),
    addWBtn, presetsBtn, resetBtn, cancelBtn, saveBtn
  ]);

  /* ---------- Grid rendering ---------- */
  var grid = h("main", { class: "grid", id: "grid", "aria-label": "Dashboard" });
  var mounted = {};
  var SIZE_NAMES = { 3: "S", 4: "M", 5: "M+", 6: "L", 8: "XL", 12: "Full" };
  function renderGrid(animate) {
    Object.keys(mounted).forEach(function (k) { try { mounted[k](); } catch (e) {} });
    mounted = {}; grid.innerHTML = "";
    layout.forEach(function (it, idx) {
      if (!it.visible) return;
      var def = CC.widgets[it.id];
      var span = def.sizes.indexOf(it.span) >= 0 ? it.span : def.sizes[Math.min(1, def.sizes.length - 1)];
      var sec = h("section", { class: "w" + (animate ? " appear" : ""), "data-id": it.id, "data-span": span, style: { "--span": span, "animation-delay": animate ? Math.min(idx * 30, 240) + "ms" : null }, "aria-label": def.title });
      // customise chrome
      var seg = h("div", { class: "seg", role: "group", "aria-label": "Width" });
      def.sizes.forEach(function (sz) {
        var b = h("button", { type: "button", "aria-pressed": String(sz === span), title: sz + " of 12 columns", text: SIZE_NAMES[sz] });
        b.addEventListener("click", function () { it.span = sz; renderGrid(false); });
        seg.appendChild(b);
      });
      var hide = h("button", { class: "btn ghost icon sm", type: "button", "aria-label": "Hide " + def.title, title: "Hide" }, icon("x"));
      hide.addEventListener("click", function () { it.visible = false; renderGrid(false); });
      var up = h("button", { class: "btn ghost icon sm", type: "button", "aria-label": "Move " + def.title + " earlier", title: "Move earlier" }, icon("chevron"));
      up.style.transform = "rotate(180deg)";
      up.addEventListener("click", function () { move(it.id, -1); });
      var dn = h("button", { class: "btn ghost icon sm", type: "button", "aria-label": "Move " + def.title + " later", title: "Move later" }, icon("chevron"));
      dn.addEventListener("click", function () { move(it.id, 1); });
      sec.appendChild(h("div", { class: "w-chrome" }, [h("span", { class: "grip" }, icon("grip")), h("span", { class: "nm", text: def.title }), up, dn, seg, hide]));
      var content = h("div", { class: "w-content" });
      sec.appendChild(content);
      grid.appendChild(sec);
      try { mounted[it.id] = def.mount(content) || function () {}; }
      catch (e) { console.error(e); content.innerHTML = ""; content.appendChild(h("div", { class: "empty" }, [h("b", { text: def.title + " couldn't load" }), h("span", { text: String(e.message || e) })])); }
      wireDrag(sec, it.id);
    });
    if (!grid.children.length) grid.appendChild(h("div", { class: "empty", style: { "grid-column": "1 / -1" } }, [h("b", { text: "Every widget is hidden" }), h("span", { text: "Use Customise, then Add widget, to bring some back." })]));
  }
  function move(id, dir) {
    var vis = layout.filter(function (x) { return x.visible; }), i = vis.findIndex(function (x) { return x.id === id; }), j = i + dir;
    if (j < 0 || j >= vis.length) return;
    var a = layout.indexOf(vis[i]), b = layout.indexOf(vis[j]); var t = layout[a]; layout[a] = layout[b]; layout[b] = t;
    renderGrid(false);
    var el = grid.querySelector('[data-id="' + id + '"] .w-chrome button[aria-label^="Move ' + CC.widgets[id].title + (dir < 0 ? ' earlier' : ' later') + '"]'); if (el) el.focus();
  }
  var dragW = null;
  function wireDrag(sec, id) {
    sec.addEventListener("dragstart", function (e) { if (!editing) return e.preventDefault(); dragW = id; sec.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); });
    sec.addEventListener("dragend", function () { dragW = null; sec.classList.remove("dragging"); grid.querySelectorAll(".drop-target").forEach(function (x) { x.classList.remove("drop-target"); }); });
    sec.addEventListener("dragover", function (e) { if (!dragW || dragW === id) return; e.preventDefault(); grid.querySelectorAll(".drop-target").forEach(function (x) { if (x !== sec) x.classList.remove("drop-target"); }); sec.classList.add("drop-target"); });
    sec.addEventListener("dragleave", function (e) { if (!sec.contains(e.relatedTarget)) sec.classList.remove("drop-target"); });
    sec.addEventListener("drop", function (e) {
      if (!dragW) return; e.preventDefault();
      var from = layout.findIndex(function (x) { return x.id === dragW; }), item = layout.splice(from, 1)[0];
      var to = layout.findIndex(function (x) { return x.id === id; }), r = sec.getBoundingClientRect();
      if (e.clientX > r.left + r.width / 2) to++;
      layout.splice(to, 0, item); renderGrid(false);
    });
  }

  /* ---------- Customise mode ---------- */
  var editing = false, snapshot = null;
  function setDraggable(on) { grid.querySelectorAll(".w").forEach(function (w) { w.draggable = on; }); }
  function startCustomise() {
    if (editing) return; editing = true; snapshot = CC.clone(layout);
    document.body.classList.add("customising"); renderGrid(false); setDraggable(true);
    setTimeout(function () { saveBtn.focus(); }, 50);
  }
  function endCustomise(save) {
    if (!editing) return; editing = false;
    if (save) { CC.layout.save(layout); CC.toast("Layout saved"); } else layout = snapshot;
    document.body.classList.remove("customising"); renderGrid(false);
  }
  CC.customise = startCustomise;
  var _render = renderGrid;
  renderGrid = function (a) { _render(a); if (editing) setDraggable(true); };
  saveBtn.addEventListener("click", function () { endCustomise(true); });
  cancelBtn.addEventListener("click", function () { endCustomise(false); });
  resetBtn.addEventListener("click", function () { layout = CC.clone(CC.defaults.layout); renderGrid(false); CC.toast("Original layout restored. Save to keep it.", { icon: "reset" }); });
  addWBtn.addEventListener("click", function () {
    var hidden = layout.filter(function (x) { return !x.visible; });
    CC.menu(addWBtn, hidden.length ? [{ heading: "Hidden widgets" }].concat(hidden.map(function (x) {
      return { label: CC.widgets[x.id].title, icon: "plus", run: function () { x.visible = true; renderGrid(false); var el = grid.querySelector('[data-id="' + x.id + '"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); } };
    })) : [{ heading: "Every widget is already on the page" }]);
  });
  presetsBtn.addEventListener("click", function () {
    var p = CC.layout.presets();
    var items = [{ label: "Save current as new layout", icon: "plus", run: savePreset }];
    if (p.length) items.push({ heading: "Saved layouts" });
    p.forEach(function (pr, i) {
      items.push({ label: "Apply " + pr.name, icon: "layout", run: function () { layout = CC.clone(pr.items); renderGrid(false); CC.toast(pr.name + " applied. Save to keep it."); } });
    });
    if (p.length) items.push({ heading: "Delete" });
    p.forEach(function (pr, i) { items.push({ label: "Delete " + pr.name, icon: "trash", run: function () { var l = CC.layout.presets(); l.splice(i, 1); CC.layout.savePresets(l); CC.toast("Layout deleted"); } }); });
    CC.menu(presetsBtn, items, { alignRight: true });
  });
  function savePreset() {
    CC.dialog({ title: "Save layout", ok: "Save layout", fields: [{ name: "name", label: "Name", placeholder: "e.g. Editing day", required: true, max: 30 }],
      validate: function (v) { if (!v.name) return "Give the layout a name."; } }).then(function (v) {
      if (!v) return; var l = CC.layout.presets().filter(function (x) { return x.name !== v.name; }); l.push({ name: v.name, items: CC.clone(layout) }); CC.layout.savePresets(l); CC.toast("Saved as " + v.name);
    });
  }
  CC.applyPreset = function (pr) { layout = CC.clone(pr.items); CC.layout.save(layout); renderGrid(true); CC.toast(pr.name + " layout applied"); };

  /* ---------- Command palette ---------- */
  CC.palette = function (initial) {
    if (document.querySelector(".palette")) return;
    var inp = h("input", { type: "text", "aria-label": "Type a command or search", placeholder: "Type a command, app or search", autocomplete: "off", spellcheck: "false", role: "combobox", "aria-expanded": "true", "aria-controls": "pal-list" });
    var list = h("div", { class: "pal-list", id: "pal-list", role: "listbox" });
    var foot = h("div", { class: "pal-foot" }, [h("span", { html: "<kbd>↑</kbd><kbd>↓</kbd> to move" }), h("span", { html: "<kbd>Enter</kbd> to run" }), h("span", { html: "<kbd>Ctrl</kbd><kbd>Enter</kbd> new tab" }), h("span", { html: "<kbd>Esc</kbd> to close" })]);
    var pal = h("div", { class: "palette", role: "dialog", "aria-modal": "true", "aria-label": "Command palette" }, [h("div", { class: "pal-in" }, [icon("command"), inp]), list, foot]);
    var layer = CC.openLayer([pal]);
    var items = [], sel = 0, bookmarks = [], bmReq = 0;
    function recent() { return CC.store.get("recentCmds", []); }
    function useCmd(c) { if (!c.id) return; var r = recent().filter(function (x) { return x !== c.id; }); r.unshift(c.id); CC.store.set("recentCmds", r.slice(0, 6)); }
    function commands(q) {
      var c = [], fs = CC.focus.state();
      CC.shortcuts.all().forEach(function (s) { c.push({ id: "sc:" + s.id, group: "Shortcuts", label: "Open " + s.name, kw: s.name + " " + CC.host(s.url) + " " + (s.desc || ""), img: CC.favicon(s.url, 32), kbd: s.key, run: function (nt) { CC.go(s.url, nt); } }); });
      c.push({ id: "a:task", group: "Actions", label: "New task", kw: "add todo to-do task", glyph: "check", kbd: "T", run: function () { focusTask(); } });
      c.push({ id: "a:notes", group: "Actions", label: "Open notes", kw: "notes write", glyph: "note", kbd: "N", run: function () { CC.openNotes(); } });
      c.push({ id: "a:focus", group: "Actions", label: fs.running ? "Pause focus timer" : "Start focus timer", kw: "focus pomodoro timer", glyph: fs.running ? "pause" : "play", kbd: "F", run: function () { CC.focus.toggle(); CC.toast(CC.focus.state().running ? "Focus timer started" : "Focus timer paused", { icon: "target" }); } });
      c.push({ id: "a:focusreset", group: "Actions", label: "Reset focus timer", kw: "focus pomodoro timer reset", glyph: "reset", run: function () { CC.focus.reset(); } });
      c.push({ id: "a:event", group: "Actions", label: "Add calendar event", kw: "agenda event appointment", glyph: "calendar", run: function () { CC.events.add(); } });
      c.push({ id: "a:gcal", group: "Actions", label: "Open Google Calendar", kw: "calendar google", glyph: "out", run: function (nt) { CC.go("https://calendar.google.com/calendar/r", nt); } });
      c.push({ id: "a:addsc", group: "Actions", label: "Add shortcut", kw: "bookmark link shortcut", glyph: "plus", run: function () { CC.shortcuts.edit(); } });
      c.push({ id: "a:city", group: "Actions", label: "Add world clock city", kw: "world clock city time zone", glyph: "globe", run: function () { CC.world.add(); } });
      c.push({ id: "a:custom", group: "Dashboard", label: "Customise layout", kw: "layout widgets edit move arrange", glyph: "layout", kbd: "E", run: startCustomise });
      c.push({ id: "a:settings", group: "Dashboard", label: "Open settings", kw: "settings preferences options", glyph: "sliders", kbd: ",", run: function () { CC.openSettings(); } });
      CC.layout.presets().forEach(function (pr) { c.push({ id: "l:" + pr.name, group: "Dashboard", label: "Apply layout: " + pr.name, kw: "layout " + pr.name, glyph: "star", run: function () { CC.applyPreset(pr); } }); });
      Object.keys(CC.THEMES).forEach(function (k) { if (k !== S().theme) c.push({ id: "t:" + k, group: "Appearance", label: "Switch to " + CC.THEMES[k] + " theme", kw: "theme dark " + k, glyph: "palette", run: function () { S().theme = k; CC.saveSettings(); } }); });
      Object.keys(CC.ACCENTS).forEach(function (k) { if (k !== S().accent) c.push({ id: "c:" + k, group: "Appearance", label: "Use " + CC.ACCENTS[k].label + " accent", kw: "accent colour color " + k, dot: CC.ACCENTS[k].c, run: function () { S().accent = k; CC.saveSettings(); } }); });
      c.push({ id: "a:12h", group: "Appearance", label: S().clock.hour12 ? "Use 24-hour clock" : "Use 12-hour clock", kw: "clock time format 12 24 hour", glyph: "clock", run: function () { S().clock.hour12 = !S().clock.hour12; CC.saveSettings(); } });
      return c;
    }
    function build() {
      var q = inp.value.trim(), all = commands(q), out = [];
      if (!q) {
        var rec = recent().map(function (id) { return all.find(function (c) { return c.id === id; }); }).filter(Boolean);
        rec.forEach(function (c) { out.push(Object.assign({}, c, { group: "Recent" })); });
        all.forEach(function (c) { if (rec.indexOf(c) < 0) out.push(c); });
      } else {
        var isUrl = CC.looksLikeUrl(q);
        if (isUrl) out.push({ group: "Go", label: "Open " + q, glyph: "link", run: function (nt) { CC.go(CC.toUrl(q), nt); } });
        var scored = all.map(function (c) { return { c: c, s: Math.max(CC.match(q, c.label), CC.match(q, c.kw || "") * 0.9) }; }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
        // group results by their group but keep best groups first
        var order = []; scored.forEach(function (x) { if (order.indexOf(x.c.group) < 0) order.push(x.c.group); });
        order.forEach(function (g) { scored.filter(function (x) { return x.c.group === g; }).slice(0, 8).forEach(function (x) { out.push(x.c); }); });
        bookmarks.slice(0, 6).forEach(function (b) { out.push({ group: "Bookmarks", label: b.title || b.url, side: CC.host(b.url), img: CC.favicon(b.url, 32), run: function (nt) { CC.go(b.url, nt); } }); });
        if (!isUrl) out.push({ group: "Search", label: "Search " + (CC.ENGINES[S().engine] || CC.ENGINES.google).label + " for “" + q + "”", glyph: "search", run: function (nt) { remember(q); CC.go(CC.searchUrl(q), nt); } });
        out.push({ group: "Create", label: "Add task: " + q, glyph: "plus", run: function () { CC.tasks.add(q); CC.toast("Task added"); } });
      }
      items = out; sel = 0; draw();
    }
    function draw() {
      list.innerHTML = "";
      if (!items.length) { list.appendChild(h("div", { class: "pal-empty", text: "No matching commands" })); return; }
      var lastG = null;
      items.forEach(function (c, i) {
        if (c.group !== lastG) { list.appendChild(h("div", { class: "pal-group", text: c.group })); lastG = c.group; }
        var lead = c.img ? h("img", { src: c.img, alt: "" }) : c.dot ? h("span", { class: "glyph" }, h("span", { style: { width: "12px", height: "12px", "border-radius": "50%", background: c.dot, display: "block" } })) : h("span", { class: "glyph" }, icon(c.glyph || "arrowRight"));
        var o = h("div", { class: "opt", role: "option", id: "pal-" + i, "aria-selected": String(i === sel) }, [lead, h("span", { class: "opt-main" }, h("b", { text: c.label })),
          c.side ? h("span", { class: "opt-side", text: c.side }) : c.kbd ? h("span", { class: "opt-side" }, h("kbd", { text: c.kbd })) : null]);
        o.addEventListener("mousemove", function () { if (sel !== i) { sel = i; mark(); } });
        o.addEventListener("click", function (e) { exec(c, e.ctrlKey || e.metaKey); });
        list.appendChild(o);
      });
      mark();
    }
    function mark() {
      list.querySelectorAll(".opt").forEach(function (o, i) { o.setAttribute("aria-selected", String(i === sel)); });
      var el = list.querySelector("#pal-" + sel); if (el) el.scrollIntoView({ block: "nearest" });
      inp.setAttribute("aria-activedescendant", "pal-" + sel);
    }
    function exec(c, nt) { useCmd(c); layer.close(); setTimeout(function () { c.run(nt); }, 10); }
    inp.addEventListener("input", function () {
      build();
      var q = inp.value.trim(), id = ++bmReq;
      if (CC.isExtension && chrome.bookmarks && q.length > 1) chrome.bookmarks.search(q, function (r) { if (id !== bmReq) return; bookmarks = (r || []).filter(function (b) { return b.url; }); build(); });
      else bookmarks = [];
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % items.length; mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; mark(); }
      else if (e.key === "Home") { e.preventDefault(); sel = 0; mark(); }
      else if (e.key === "End") { e.preventDefault(); sel = items.length - 1; mark(); }
      else if (e.key === "Enter") { e.preventDefault(); if (items[sel]) exec(items[sel], e.ctrlKey || e.metaKey); }
    });
    if (initial) inp.value = initial;
    build(); setTimeout(function () { inp.focus(); }, 20);
  };
  function focusTask() { var el = document.getElementById("task-input"); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus(); } else CC.palette("task "); }

  /* ---------- Settings drawer ---------- */
  CC.openSettings = function () {
    if (document.querySelector(".drawer")) return;
    var body = h("div", { class: "drawer-body" });
    var dr = h("aside", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-labelledby": "set-t" }, [
      h("div", { class: "drawer-head" }, [h("h2", { id: "set-t", text: "Settings" }), h("button", { class: "btn ghost icon", type: "button", "aria-label": "Close settings", onclick: function () { layer.close(); } }, icon("x"))]), body]);
    var layer = CC.openLayer([dr]);
    function save() { CC.saveSettings(); }
    function sec(title, kids) { return h("section", { class: "set-sec" }, [h("h3", { text: title })].concat(kids)); }
    function row(label, ctl, id) { return h("div", { class: "set-row" }, [h("label", { for: id, text: label, style: { color: "var(--ink-2)", "font-size": "13.5px" } }), ctl]); }
    function select(id, val, opts, on) {
      var s = h("select", { class: "select", id: id, style: { width: "200px" } });
      if (!opts.some(function (o) { return o[0] === val; })) opts = [[val, val.replace(/_/g, " ")]].concat(opts);
      opts.forEach(function (o) { s.appendChild(h("option", { value: o[0], text: o[1], selected: o[0] === val ? true : null })); });
      s.addEventListener("change", function () { on(s.value); save(); }); return s;
    }
    function toggle(id, val, on) { var i = h("input", { type: "checkbox", id: id, checked: val ? true : null }); i.addEventListener("change", function () { on(i.checked); save(); }); return h("span", { class: "switch" }, [i, h("i")]); }
    function text(id, val, ph, on) { var i = h("input", { class: "input", id: id, value: val || "", placeholder: ph || "", style: { width: "200px" } }); i.addEventListener("change", function () { on(i.value.trim()); save(); }); return i; }
    var s = S(), zoneOpts = CC.zones.map(function (z) { return [z, z.replace(/_/g, " ")]; });

    // Appearance
    var sw = h("div", { class: "swatches", role: "group", "aria-label": "Accent colour" });
    Object.keys(CC.ACCENTS).forEach(function (k) {
      var b = h("button", { class: "swatch", type: "button", style: { "--c": CC.ACCENTS[k].c }, "aria-label": CC.ACCENTS[k].label, title: CC.ACCENTS[k].label, "aria-pressed": String(s.accent === k) });
      b.addEventListener("click", function () { s.accent = k; save(); sw.querySelectorAll(".swatch").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); });
      sw.appendChild(b);
    });
    body.appendChild(sec("Appearance", [
      row("Theme", select("s-theme", s.theme, Object.keys(CC.THEMES).map(function (k) { return [k, CC.THEMES[k]]; }), function (v) { s.theme = v; }), "s-theme"),
      h("div", { class: "set-row" }, [h("span", { text: "Accent colour" }), sw]),
      row("Background", select("s-bg", s.background, [["dots", "Dot grid"], ["grid", "Line grid"], ["glow", "Soft glow"], ["plain", "Plain"]], function (v) { s.background = v; }), "s-bg"),
      row("Density", select("s-den", s.density, [["comfortable", "Comfortable"], ["compact", "Compact"]], function (v) { s.density = v; }), "s-den"),
      row("Your name", text("s-name", s.name, "Shown in the greeting", function (v) { s.name = v; paintHello(); }), "s-name")
    ]));
    // Clock
    body.appendChild(sec("Clock", [
      row("Style", select("s-cs", s.clock.style, [["hybrid", "Dial and digits"], ["digital", "Digits only"], ["analogue", "Dial only"]], function (v) { s.clock.style = v; }), "s-cs"),
      row("12-hour time", toggle("s-12", s.clock.hour12, function (v) { s.clock.hour12 = v; }), "s-12"),
      row("Show seconds", toggle("s-sec", s.clock.seconds, function (v) { s.clock.seconds = v; }), "s-sec"),
      row("Time zone", select("s-tz", s.clock.tz, zoneOpts, function (v) { s.clock.tz = v; s.clock.label = CC.zoneCity(v); document.getElementById("s-lbl").value = s.clock.label; }), "s-tz"),
      row("Place name", text("s-lbl", s.clock.label, "e.g. Mumbai", function (v) { s.clock.label = v || CC.zoneCity(s.clock.tz); }), "s-lbl"),
      row("Second time zone", toggle("s-2on", s.clock.second.on, function (v) { s.clock.second.on = v; }), "s-2on"),
      row("Second zone", select("s-2tz", s.clock.second.tz, zoneOpts, function (v) { s.clock.second.tz = v; s.clock.second.label = CC.zoneCity(v); document.getElementById("s-2lbl").value = s.clock.second.label; }), "s-2tz"),
      row("Second place name", text("s-2lbl", s.clock.second.label, "e.g. Glasgow", function (v) { s.clock.second.label = v || CC.zoneCity(s.clock.second.tz); }), "s-2lbl")
    ]));
    // Search
    body.appendChild(sec("Search", [
      row("Search engine", select("s-eng", s.engine, Object.keys(CC.ENGINES).map(function (k) { return [k, CC.ENGINES[k].label]; }), function (v) { s.engine = v; }), "s-eng"),
      h("div", { class: "set-row" }, [h("span", { text: "Search history" }), h("button", { class: "btn sm", type: "button", text: "Clear history", onclick: function () { CC.store.set("searches", []); CC.toast("Search history cleared"); } })])
    ]));
    // Weather
    var geoIn = h("input", { class: "input", id: "s-geo", placeholder: "Search for a city", autocomplete: "off" });
    var geoRes = h("div", { class: "geo-results" }), geoNow = h("small", { class: "faint", text: "Now showing " + s.weather.name + (s.weather.region ? ", " + s.weather.region : "") });
    var gt;
    geoIn.addEventListener("input", function () {
      clearTimeout(gt); var q = geoIn.value.trim(); if (q.length < 2) { geoRes.innerHTML = ""; return; }
      gt = setTimeout(function () {
        fetch("https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=" + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
          geoRes.innerHTML = "";
          if (!d.results || !d.results.length) { geoRes.appendChild(h("small", { class: "faint", text: "No places found for “" + q + "”." })); return; }
          d.results.forEach(function (p) {
            var region = [p.admin1, p.country].filter(Boolean).join(", ");
            geoRes.appendChild(h("button", { class: "opt", type: "button", onclick: function () {
              s.weather.name = p.name; s.weather.region = region; s.weather.lat = p.latitude; s.weather.lon = p.longitude; save(); rerender("weather");
              geoNow.textContent = "Now showing " + p.name + ", " + region; geoRes.innerHTML = ""; geoIn.value = "";
            } }, [h("span", { class: "glyph" }, icon("globe")), h("span", { class: "opt-main" }, [h("b", { text: p.name }), " " + region])]));
          });
        }).catch(function () { geoRes.innerHTML = ""; geoRes.appendChild(h("small", { class: "err", text: "Couldn't search places. Check your connection." })); });
      }, 250);
    });
    body.appendChild(sec("Weather", [
      h("label", { class: "field", for: "s-geo" }, [h("span", { text: "Location" }), geoIn, geoNow]), geoRes,
      row("Units", select("s-un", s.weather.units, [["c", "Celsius, km/h"], ["f", "Fahrenheit, mph"]], function (v) { s.weather.units = v; rerender("weather"); }), "s-un"),
      h("small", { class: "faint", text: "Live data from Open-Meteo. No account or key needed." })
    ]));
    // Calendar
    var ics = h("input", { class: "input", id: "s-ics", value: s.calendar.ics, placeholder: "https://calendar.google.com/calendar/ical/…/basic.ics", type: "url" });
    ics.addEventListener("change", function () { s.calendar.ics = ics.value.trim(); save(); });
    body.appendChild(sec("Google Calendar", [
      h("label", { class: "field", for: "s-ics" }, [h("span", { text: "Secret address in iCal format" }), ics,
        h("small", { text: "In Google Calendar, open Settings, choose your calendar, and copy “Secret address in iCal format”. Keep it private: anyone with it can read your calendar. " + (CC.isExtension ? "Events refresh every 15 minutes." : "Syncing needs the Command Centre extension, because browsers block calendar feeds on a local page.") })])
    ]));
    // Focus
    var fw = h("input", { class: "input", id: "s-fw", type: "number", min: 5, max: 120, value: s.focus.work, style: { width: "90px" } });
    var fb = h("input", { class: "input", id: "s-fb", type: "number", min: 1, max: 60, value: s.focus.brk, style: { width: "90px" } });
    fw.addEventListener("change", function () { s.focus.work = Math.max(5, Math.min(120, +fw.value || 25)); fw.value = s.focus.work; save(); if (!CC.focus.state().running) CC.focus.reset(); });
    fb.addEventListener("change", function () { s.focus.brk = Math.max(1, Math.min(60, +fb.value || 5)); fb.value = s.focus.brk; save(); });
    body.appendChild(sec("Focus timer", [row("Focus minutes", fw, "s-fw"), row("Break minutes", fb, "s-fb")]));
    // Widgets
    var wl = h("div", { style: { display: "grid", gap: "10px" } });
    layout.forEach(function (it) {
      wl.appendChild(row(CC.widgets[it.id].title, toggle("s-w-" + it.id, it.visible, function (v) { it.visible = v; CC.layout.save(layout); renderGrid(false); }), "s-w-" + it.id));
    });
    body.appendChild(sec("Widgets", [wl, h("button", { class: "btn sm", type: "button", style: { "justify-self": "start" }, onclick: function () { layer.close(); setTimeout(startCustomise, 200); } }, [icon("layout"), "Arrange and resize"])]));
    // Data
    var file = h("input", { type: "file", accept: "application/json", class: "sr", id: "s-imp" });
    file.addEventListener("change", function () {
      var f = file.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () { try { var d = JSON.parse(rd.result); CC.store.importAll(d); CC.toast("Backup restored. Reloading."); setTimeout(function () { location.reload(); }, 700); } catch (e) { CC.toast("That file isn't a Command Centre backup", { icon: "x" }); } };
      rd.readAsText(f);
    });
    body.appendChild(sec("Your data", [
      h("small", { class: "faint", text: "Everything is stored in this browser on this computer. Back it up to move it to another browser or to the extension." }),
      h("div", { style: { display: "flex", gap: "8px", "flex-wrap": "wrap" } }, [
        h("button", { class: "btn sm", type: "button", onclick: exportData }, [icon("download"), "Download backup"]),
        h("label", { class: "btn sm", for: "s-imp", tabindex: "0", onkeydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } } }, [icon("upload"), "Restore backup"]), file,
        h("button", { class: "btn sm danger", type: "button", onclick: function () {
          CC.confirm("Reset everything?", "This deletes your tasks, notes, shortcuts, layouts and settings on this page. Download a backup first if you want to keep them.", "Reset everything").then(function (ok) { if (ok) { CC.store.clearAll(); CC.store.set("migrated", true); location.reload(); } });
        } }, [icon("trash"), "Reset everything"])
      ])
    ]));
    setTimeout(function () { dr.querySelector("select,input,button").focus(); }, 40);
  };
  function exportData() {
    var blob = new Blob([JSON.stringify(CC.store.exportAll(), null, 2)], { type: "application/json" });
    var a = h("a", { href: URL.createObjectURL(blob), download: "command-centre-backup-" + CC.ymd() + ".json" });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    CC.toast("Backup downloaded", { icon: "download" });
  }
  function rerender(id) {
    var sec = grid.querySelector('[data-id="' + id + '"]'); if (!sec) return;
    if (mounted[id]) mounted[id]();
    var content = sec.querySelector(".w-content"); content.innerHTML = ""; mounted[id] = CC.widgets[id].mount(content) || function () {};
  }

  /* ---------- Global keyboard ---------- */
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K")) { e.preventDefault(); if (!document.querySelector(".palette")) CC.palette(); return; }
    if (e.key === "Escape" && editing && !CC.layerOpen()) { endCustomise(false); return; }
    var a = document.activeElement, tag = a && a.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (a && a.isContentEditable)) return;
    if (CC.layerOpen() || editing || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (k === "/") { e.preventDefault(); input.focus(); input.select(); }
    else if (k === "t" || k === "T") { e.preventDefault(); focusTask(); }
    else if (k === "n" || k === "N") { e.preventDefault(); CC.openNotes(); }
    else if (k === "f" || k === "F") { e.preventDefault(); CC.focus.toggle(); CC.toast(CC.focus.state().running ? "Focus timer started" : "Focus timer paused", { icon: "target" }); }
    else if (k === "e" || k === "E") { e.preventDefault(); startCustomise(); }
    else if (k === ",") { e.preventDefault(); CC.openSettings(); }
    else if (/^[0-9]$/.test(k)) { var sc = CC.shortcuts.all().find(function (x) { return x.key === k; }); if (sc) { e.preventDefault(); CC.go(sc.url, e.shiftKey); } }
  });

  /* ---------- Boot ---------- */
  var hintLine = h("p", { class: "status-line", style: { "justify-content": "center", "margin-top": "4px" }, html: "<span><kbd>Ctrl</kbd> <kbd>K</kbd> commands</span><span><kbd>/</kbd> search</span><span><kbd>T</kbd> new task</span><span><kbd>N</kbd> notes</span><span><kbd>F</kbd> focus timer</span><span><kbd>E</kbd> customise</span>" });
  app.appendChild(top); app.appendChild(editbar); app.appendChild(search); app.appendChild(grid); app.appendChild(hintLine);
  paintEngine(); paintHello(); renderGrid(true);
  CC.on("settings", function () { paintEngine(); paintHello(); });
  CC.on("tasks", paintHello);
  setInterval(paintHello, 60000);
})();
