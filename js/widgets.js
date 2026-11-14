/* Command Centre widgets. Each widget: { title, sizes, mount(el) -> cleanup fn } */
(function () {
  "use strict";
  var CC = window.CC, h = CC.h, icon = CC.icon, S = function () { return CC.settings; };
  var W = (CC.widgets = {});
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Shared animation-frame ticker so every clock repaints in one frame */
  var tickers = [];
  CC.addTicker = function (fn) { tickers.push(fn); return function () { tickers = tickers.filter(function (f) { return f !== fn; }); }; };
  (function loop() { var now = new Date(); tickers.forEach(function (f) { try { f(now); } catch (e) { console.warn(e); } }); requestAnimationFrame(loop); })();

  function head(title, sub, tools) {
    return h("div", { class: "w-head" }, [
      h("h2", { class: "w-title" }, [title, sub ? h("span", { class: "w-sub" }, sub) : null]),
      tools ? h("div", { class: "w-tools" }, tools) : null
    ]);
  }
  function iconBtn(name, label, onclick, extra) {
    return h("button", Object.assign({ class: "btn ghost icon sm", type: "button", "aria-label": label, title: label, onclick: onclick }, extra || {}), icon(name));
  }
  CC.iconBtn = iconBtn;

  /* ======================= Clock ======================= */
  W.clock = {
    title: "Clock", sizes: [4, 5, 6, 8],
    mount: function (el) {
      var c = S().clock;
      el.closest(".w").classList.add("clock");
      el.closest(".w").dataset.style = c.style;
      var NS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 200 200"); svg.setAttribute("class", "dial"); svg.setAttribute("role", "img");
      var ticks = "";
      for (var i = 0; i < 60; i++) {
        var hr = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = hr ? 76 : 80, r2 = 85;
        ticks += '<line class="tick' + (hr ? " hr" : "") + '" x1="' + (100 + r1 * Math.sin(a)).toFixed(2) + '" y1="' + (100 - r1 * Math.cos(a)).toFixed(2) + '" x2="' + (100 + r2 * Math.sin(a)).toFixed(2) + '" y2="' + (100 - r2 * Math.cos(a)).toFixed(2) + '"/>';
      }
      var nums = [[12, 0], [3, 90], [6, 180], [9, 270]].map(function (n) { var a = n[1] * Math.PI / 180; return '<text class="numeral" x="' + (100 + 63 * Math.sin(a)).toFixed(1) + '" y="' + (100 - 63 * Math.cos(a)).toFixed(1) + '">' + n[0] + "</text>"; }).join("");
      var C = 2 * Math.PI * 95;
      svg.innerHTML = '<circle class="face" cx="100" cy="100" r="89"/><circle class="ring-track" cx="100" cy="100" r="95"/><circle class="ring" cx="100" cy="100" r="95" stroke-dasharray="0 ' + C + '"/>' + ticks + nums +
        '<line class="hand h" x1="100" y1="112" x2="100" y2="58"/><line class="hand m" x1="100" y1="116" x2="100" y2="34"/><line class="hand s" x1="100" y1="122" x2="100" y2="22"/><circle class="pin" cx="100" cy="100" r="4.5"/><circle class="pin2" cx="100" cy="100" r="1.6"/>';
      var ring = svg.querySelector(".ring"), hh = svg.querySelector(".hand.h"), mh = svg.querySelector(".hand.m"), sh = svg.querySelector(".hand.s");

      var place = h("div", { class: "place" }, [h("span", { class: "pl" }), h("span", { class: "faint gmt" })]);
      var time = h("div", { class: "time", "aria-live": "off" });
      var hEl = h("span"), colon = h("span", { class: "colon", text: ":" }), mEl = h("span"), ap = h("span", { class: "ampm" }), sEl = h("span", { class: "secs" });
      [hEl, colon, mEl, h("span", { class: "side" }, [ap, sEl])].forEach(function (x) { time.appendChild(x); });
      var date = h("div", { class: "date" });
      var second = h("div", { class: "second-tz" });
      var read = h("div", { class: "read" }, [place, time, date, second]);
      el.appendChild(h("div", { class: "w-body" }, [svg, read]));

      var last = {};
      function setText(node, v, anim) {
        if (node.textContent === v) return;
        node.textContent = v;
        if (anim && !reduced) { node.classList.remove("roll"); void node.offsetWidth; node.classList.add("roll"); }
      }
      var stop = CC.addTicker(function (now) {
        c = S().clock;
        var p = CC.tzParts(now, c.tz), ms = reduced ? 0 : now.getMilliseconds();
        var sec = p.s + ms / 1000, min = p.m + sec / 60, hour = (p.h % 12) + min / 60;
        hh.setAttribute("transform", "rotate(" + (hour * 30).toFixed(3) + " 100 100)");
        mh.setAttribute("transform", "rotate(" + (min * 6).toFixed(3) + " 100 100)");
        sh.setAttribute("transform", "rotate(" + (sec * 6).toFixed(3) + " 100 100)");
        // Seconds ring: fills on even minutes, unwinds on odd minutes, so it never jumps
        var f = sec / 60;
        if (p.m % 2 === 0) { ring.setAttribute("stroke-dasharray", (f * C).toFixed(2) + " " + C); ring.setAttribute("stroke-dashoffset", 0); }
        else { ring.setAttribute("stroke-dasharray", ((1 - f) * C).toFixed(2) + " " + C); ring.setAttribute("stroke-dashoffset", (-f * C).toFixed(2)); }
        if (last.s === p.s && last.style === c.style) return;
        last.s = p.s; last.style = c.style;
        var H = c.hour12 ? String(p.h % 12 || 12) : String(p.h).padStart(2, "0");
        setText(hEl, H, true); setText(mEl, String(p.m).padStart(2, "0"), true);
        ap.textContent = c.hour12 ? (p.h < 12 ? "AM" : "PM") : ""; ap.hidden = !c.hour12;
        sEl.textContent = c.seconds ? String(p.s).padStart(2, "0") : ""; sEl.hidden = !c.seconds;
        place.querySelector(".pl").textContent = c.label || CC.zoneCity(c.tz);
        place.querySelector(".gmt").textContent = CC.gmtLabel(CC.tzOffset(c.tz, now));
        var dObj = new Date(Date.UTC(p.y, p.mo - 1, p.d));
        date.textContent = dObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
        svg.setAttribute("aria-label", "Analogue clock showing " + CC.fmtTime(p.h, p.m, c.hour12));
        if (c.second && c.second.on && c.second.tz) {
          second.hidden = false;
          var q = CC.tzParts(now, c.second.tz), diff = CC.tzOffset(c.second.tz, now) - CC.tzOffset(c.tz, now);
          second.innerHTML = "";
          second.appendChild(h("span", { text: c.second.label || CC.zoneCity(c.second.tz) }));
          second.appendChild(h("b", { text: CC.fmtTime(q.h, q.m, c.hour12) }));
          second.appendChild(h("span", { class: "faint", text: CC.diffLabel(diff) }));
        } else second.hidden = true;
        el.closest(".w").dataset.style = c.style;
      });
      return stop;
    }
  };

  /* ======================= Weather (Open-Meteo, no key) ======================= */
  var WMO = {
    0: ["Clear sky", "clear"], 1: ["Mainly clear", "clear"], 2: ["Partly cloudy", "partly"], 3: ["Overcast", "cloud"],
    45: ["Fog", "fog"], 48: ["Freezing fog", "fog"], 51: ["Light drizzle", "rain"], 53: ["Drizzle", "rain"], 55: ["Heavy drizzle", "rain"],
    56: ["Freezing drizzle", "rain"], 57: ["Freezing drizzle", "rain"], 61: ["Light rain", "rain"], 63: ["Rain", "rain"], 65: ["Heavy rain", "rain"],
    66: ["Freezing rain", "rain"], 67: ["Freezing rain", "rain"], 71: ["Light snow", "snow"], 73: ["Snow", "snow"], 75: ["Heavy snow", "snow"], 77: ["Snow grains", "snow"],
    80: ["Rain showers", "rain"], 81: ["Rain showers", "rain"], 82: ["Violent showers", "rain"], 85: ["Snow showers", "snow"], 86: ["Snow showers", "snow"],
    95: ["Thunderstorm", "storm"], 96: ["Thunderstorm, hail", "storm"], 99: ["Thunderstorm, hail", "storm"]
  };
  function wxSvg(kind, day) {
    var sun = '<circle class="sun" cx="24" cy="24" r="8"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) { var r = a * Math.PI / 180; return '<line class="ray" x1="' + (24 + 12 * Math.cos(r)).toFixed(1) + '" y1="' + (24 + 12 * Math.sin(r)).toFixed(1) + '" x2="' + (24 + 15.5 * Math.cos(r)).toFixed(1) + '" y2="' + (24 + 15.5 * Math.sin(r)).toFixed(1) + '"/>'; }).join("");
    var moon = '<path class="moon" d="M30 10a12 12 0 1 0 8 19.5A10 10 0 0 1 30 10z"/>';
    var cloud = function (cls, dx, dy) { return '<path class="cloud ' + (cls || "") + '" transform="translate(' + (dx || 0) + " " + (dy || 0) + ')" d="M14 36h20a8 8 0 0 0 .6-16A11 11 0 0 0 13.5 23 6.5 6.5 0 0 0 14 36z"/>'; };
    var inner = "";
    if (kind === "clear") inner = day ? sun : moon;
    else if (kind === "partly") inner = '<g transform="translate(-6 -7) scale(.8)">' + (day ? sun : moon) + "</g>" + cloud("", 2, 2);
    else if (kind === "cloud") inner = cloud("dark", -6, -4) + cloud("", 2, 2);
    else if (kind === "fog") inner = cloud("dark", 0, -6) + '<line class="fog" x1="10" y1="36" x2="38" y2="36"/><line class="fog" x1="14" y1="41" x2="34" y2="41"/>';
    else if (kind === "rain") inner = cloud("", 0, -6) + '<line class="drop" x1="17" y1="35" x2="15" y2="41"/><line class="drop" x1="25" y1="35" x2="23" y2="41"/><line class="drop" x1="33" y1="35" x2="31" y2="41"/>';
    else if (kind === "snow") inner = cloud("", 0, -6) + '<circle class="flake" cx="16" cy="38" r="1.8"/><circle class="flake" cx="24" cy="41" r="1.8"/><circle class="flake" cx="32" cy="38" r="1.8"/>';
    else if (kind === "storm") inner = cloud("dark", 0, -6) + '<path class="bolt" d="M25 31h-5l-2 8h4l-2 7 8-10h-4.5z"/>';
    return '<svg viewBox="0 0 48 48" aria-hidden="true">' + inner + "</svg>";
  }
  CC.weather = {
    load: function (force) {
      var w = S().weather, key = "wx:" + w.lat + "," + w.lon + "," + w.units;
      var cached = CC.store.get("wxcache", null);
      if (!force && cached && cached.key === key && Date.now() - cached.at < 30 * 60 * 1000) return Promise.resolve(cached);
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + w.lat + "&longitude=" + w.lon +
        "&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=5&timezone=auto" +
        (w.units === "f" ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : "");
      return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (d) {
        var out = { key: key, at: Date.now(), data: d };
        CC.store.set("wxcache", out); return out;
      }).catch(function (e) { if (cached && cached.key === key) { cached.stale = true; return cached; } throw e; });
    }
  };
  W.weather = {
    title: "Weather", sizes: [3, 4, 5, 6],
    mount: function (el) {
      el.classList.add("wx");
      var w = S().weather;
      var refresh = iconBtn("refresh", "Refresh weather", function () { load(true); });
      el.appendChild(head("Weather", w.name, [refresh]));
      var body = h("div", { class: "w-body" }); el.appendChild(body);
      function skeleton() {
        body.innerHTML = "";
        body.appendChild(h("div", { class: "wx-now" }, [h("div", { class: "skeleton", style: { width: "58px", height: "58px", "border-radius": "50%" } }), h("div", { style: { display: "grid", gap: "8px", flex: "1" } }, [h("div", { class: "skeleton", style: { width: "90px", height: "40px" } }), h("div", { class: "skeleton", style: { width: "120px", height: "14px" } })])]));
        body.appendChild(h("div", { class: "skeleton", style: { height: "74px", "margin-top": "auto" } }));
      }
      function render(res) {
        var d = res.data, cur = d.current, u = w.units === "f" ? "°" : "°", wk = WMO[cur.weather_code] || ["Unknown", "cloud"];
        body.innerHTML = "";
        var now = h("div", { class: "wx-now" });
        now.appendChild(h("div", { class: "wx-icon", html: wxSvg(wk[1], cur.is_day) }));
        now.appendChild(h("div", null, [
          h("div", { class: "wx-temp", text: Math.round(cur.temperature_2m) + u }),
          h("div", { class: "wx-cond", text: wk[0] })
        ]));
        body.appendChild(now);
        body.appendChild(h("div", { class: "wx-meta" }, [
          h("span", { text: "High " + Math.round(d.daily.temperature_2m_max[0]) + u + ", low " + Math.round(d.daily.temperature_2m_min[0]) + u }),
          h("span", { text: "Feels " + Math.round(cur.apparent_temperature) + u }),
          h("span", { text: "Wind " + Math.round(cur.wind_speed_10m) + (w.units === "f" ? " mph" : " km/h") }),
          h("span", { text: "Humidity " + cur.relative_humidity_2m + "%" })
        ]));
        var days = h("div", { class: "wx-days" });
        for (var i = 1; i < Math.min(5, d.daily.time.length); i++) {
          var dk = WMO[d.daily.weather_code[i]] || ["", "cloud"];
          days.appendChild(h("div", { class: "wx-day", title: dk[0] }, [
            h("span", { text: CC.parseYMD(d.daily.time[i]).toLocaleDateString("en-GB", { weekday: "short" }) }),
            h("span", { html: wxSvg(dk[1], 1) }),
            h("b", { text: Math.round(d.daily.temperature_2m_max[i]) + "°" }),
            h("span", { text: Math.round(d.daily.temperature_2m_min[i]) + "°" })
          ]));
        }
        body.appendChild(days);
        var t = new Date(res.at);
        body.appendChild(h("div", { class: "status-line" }, [h("span", { text: (res.stale ? "Offline, showing data from " : "Updated ") + CC.fmtTime(t.getHours(), t.getMinutes(), S().clock.hour12) }), h("a", { href: "https://open-meteo.com/", target: "_blank", rel: "noopener", class: "faint", text: "Open-Meteo" })]));
      }
      function fail(e) {
        body.innerHTML = "";
        body.appendChild(h("div", { class: "empty" }, [h("b", { text: "Weather didn't load" }), h("span", { text: navigator.onLine ? "Open-Meteo didn't respond. Try again in a moment." : "You're offline. It will load when you reconnect." }),
          h("button", { class: "btn sm", type: "button", text: "Try again", onclick: function () { load(true); } })]));
      }
      function load(force) { skeleton(); CC.weather.load(force).then(render, fail); }
      load(false);
      var iv = setInterval(function () { CC.weather.load(false).then(render, function () {}); }, 15 * 60 * 1000);
      var onl = function () { load(true); }; window.addEventListener("online", onl);
      return function () { clearInterval(iv); window.removeEventListener("online", onl); };
    }
  };

  /* ======================= Tasks ======================= */
  CC.tasks = {
    all: function () { return CC.store.get("tasks", []); },
    save: function (t) { CC.store.set("tasks", t); CC.emit("tasks"); },
    add: function (text, p, due) {
      text = (text || "").trim(); if (!text) return;
      var t = CC.tasks.all(); t.unshift({ id: CC.uid(), text: text, done: false, p: p || 0, due: due || "", created: Date.now(), doneAt: 0 });
      CC.tasks.save(t);
    },
    stats: function () {
      var t = CC.tasks.all(), today = CC.ymd();
      var doneToday = t.filter(function (x) { return x.done && x.doneAt && CC.ymd(new Date(x.doneAt)) === today; }).length;
      var open = t.filter(function (x) { return !x.done; }).length;
      return { doneToday: doneToday, open: open, total: doneToday + open };
    }
  };
  var PRI = ["No priority", "Low priority", "Medium priority", "High priority"];
  W.tasks = {
    title: "Tasks", sizes: [4, 5, 6, 8, 12],
    mount: function (el) {
      var sub = h("span"), clearBtn = iconBtn("more", "Task options", function () {
        CC.menu(clearBtn, [
          { label: "Clear completed", icon: "trash", run: clearDone },
          { label: showDone ? "Hide completed" : "Show completed", icon: "check", run: function () { showDone = !showDone; render(); } }
        ], { alignRight: true });
      });
      el.appendChild(head("Tasks", sub, [clearBtn]));
      var body = h("div", { class: "w-body" }); el.appendChild(body);
      var newP = 0, newDue = "";
      var input = h("input", { type: "text", id: "task-input", placeholder: "Add a task", "aria-label": "New task", autocomplete: "off", maxlength: 300 });
      var pBtn = h("button", { type: "button", class: "chipbtn", "data-p": "0", title: "Priority", "aria-label": "Priority: none" }, icon("flag"));
      pBtn.addEventListener("click", function () { newP = (newP + 1) % 4; pBtn.dataset.p = newP; pBtn.setAttribute("aria-label", PRI[newP]); pBtn.title = PRI[newP]; });
      var dLbl = h("span", { text: "" });
      var dInp = h("input", { type: "date", "aria-label": "Due date" });
      var dBtn = h("span", { class: "chipbtn date-in", title: "Due date" }, [icon("calendar"), dLbl, dInp]);
      dInp.addEventListener("change", function () { newDue = dInp.value; dLbl.textContent = newDue ? CC.dayLabel(newDue) : ""; });
      var form = h("form", { class: "add-row" }, [input, pBtn, dBtn, h("button", { type: "submit", class: "btn sm primary", text: "Add" })]);
      form.addEventListener("submit", function (e) {
        e.preventDefault(); if (!input.value.trim()) { input.focus(); return; }
        CC.tasks.add(input.value, newP, newDue); input.value = ""; newP = 0; pBtn.dataset.p = 0; newDue = ""; dInp.value = ""; dLbl.textContent = "";
      });
      body.appendChild(form);
      var list = h("ul", { class: "tasks", "aria-label": "Tasks" }); body.appendChild(list);
      var showDone = false, editing = null;

      function sortOpen(a, b) {
        var ad = a.due || "9999", bd = b.due || "9999";
        if (ad !== bd) return ad < bd ? -1 : 1;
        if (a.p !== b.p) return b.p - a.p;
        return b.created - a.created;
      }
      function item(t) {
        var li = h("li", { class: "task" + (t.done ? " done" : ""), "data-p": t.p, "data-id": t.id });
        var chk = h("button", { type: "button", class: "check", role: "checkbox", "aria-checked": t.done ? "true" : "false", "aria-label": (t.done ? "Mark not done: " : "Mark done: ") + t.text, html: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' });
        chk.addEventListener("click", function () { toggle(t.id, li); });
        li.appendChild(chk);
        if (editing === t.id) {
          var ed = h("input", { class: "task-edit", value: t.text, "aria-label": "Edit task", maxlength: 300 });
          var commit = function (save) {
            if (editing !== t.id) return; editing = null;
            if (save && ed.value.trim()) { var all = CC.tasks.all(); all.forEach(function (x) { if (x.id === t.id) x.text = ed.value.trim(); }); CC.tasks.save(all); } else render();
          };
          ed.addEventListener("keydown", function (e) { if (e.key === "Enter") commit(true); if (e.key === "Escape") { e.stopPropagation(); commit(false); } });
          ed.addEventListener("blur", function () { commit(true); });
          li.appendChild(ed); setTimeout(function () { ed.focus(); ed.select(); }, 0);
        } else {
          var txt = h("span", { class: "task-text", text: t.text, title: "Double-click to edit" });
          txt.addEventListener("dblclick", function () { editing = t.id; render(); });
          li.appendChild(txt);
          if (t.due && !t.done) {
            var today = CC.ymd(), cls = t.due < today ? "due over" : t.due === today ? "due today" : "due";
            li.appendChild(h("span", { class: cls, text: t.due < today ? "Overdue, " + CC.dayLabel(t.due) : CC.dayLabel(t.due) }));
          }
          li.appendChild(iconBtn("pencil", "Edit task", function () { editing = t.id; render(); }, { class: "btn ghost icon sm act" }));
          li.appendChild(iconBtn("trash", "Delete task", function () { remove(t.id); }, { class: "btn ghost icon sm act" }));
        }
        return li;
      }
      function render() {
        var all = CC.tasks.all(), open = all.filter(function (x) { return !x.done; }).sort(sortOpen), done = all.filter(function (x) { return x.done; }).sort(function (a, b) { return b.doneAt - a.doneAt; });
        sub.textContent = open.length ? open.length + " open" : "";
        list.innerHTML = "";
        if (!open.length && !done.length) {
          list.appendChild(h("li", { class: "empty" }, [h("b", { text: "Nothing to do yet" }), h("span", { html: "Type above, or press <kbd>T</kbd> anywhere to add a task." })]));
          return;
        }
        if (!open.length) list.appendChild(h("li", { class: "empty" }, [h("b", { text: "All clear" }), h("span", { text: "Every task is done. Add the next one above." })]));
        open.forEach(function (t) { list.appendChild(item(t)); });
        if (done.length) {
          var tg = h("button", { type: "button", class: "done-toggle", "aria-expanded": String(showDone) }, [icon("chevron"), "Completed (" + done.length + ")"]);
          tg.addEventListener("click", function () { showDone = !showDone; render(); });
          list.appendChild(h("li", null, tg));
          if (showDone) done.forEach(function (t) { list.appendChild(item(t)); });
        }
      }
      function toggle(id, li) {
        var all = CC.tasks.all(), t = all.find(function (x) { return x.id === id; }); if (!t) return;
        t.done = !t.done; t.doneAt = t.done ? Date.now() : 0;
        li.classList.toggle("done", t.done);
        li.querySelector(".check").setAttribute("aria-checked", String(t.done));
        setTimeout(function () { li.classList.add("leaving"); }, reduced ? 0 : 380);
        setTimeout(function () { CC.tasks.save(all); }, reduced ? 0 : 600);
      }
      function remove(id) {
        var all = CC.tasks.all(), idx = all.findIndex(function (x) { return x.id === id; }); if (idx < 0) return;
        var gone = all.splice(idx, 1)[0]; CC.tasks.save(all);
        CC.toast("Task deleted", { icon: "trash", action: { label: "Undo", run: function () { var a = CC.tasks.all(); a.splice(idx, 0, gone); CC.tasks.save(a); } } });
      }
      function clearDone() {
        var all = CC.tasks.all(), n = all.filter(function (x) { return x.done; }).length;
        if (!n) { CC.toast("No completed tasks to clear", { icon: "check" }); return; }
        CC.tasks.save(all.filter(function (x) { return !x.done; })); CC.toast(n + " completed " + (n === 1 ? "task" : "tasks") + " cleared");
      }
      render();
      var off = CC.on("tasks", render);
      var dayTimer = setInterval(render, 60 * 60 * 1000);
      return function () { off(); clearInterval(dayTimer); };
    }
  };

  /* ======================= Notes ======================= */
  CC.notes = {
    get: function () { return CC.store.get("notes", { text: "", savedAt: 0 }); },
    set: function (text) { var n = { text: text, savedAt: Date.now() }; CC.store.set("notes", n); CC.emit("notes", n); }
  };
  function words(t) { var m = t.trim().match(/\S+/g); return m ? m.length : 0; }
  function ago(ts) {
    if (!ts) return "Saves as you type";
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 10) return "Saved just now"; if (s < 60) return "Saved " + s + "s ago";
    var m = Math.round(s / 60); if (m < 60) return "Saved " + m + " min ago";
    var d = new Date(ts); return "Saved " + CC.fmtTime(d.getHours(), d.getMinutes(), S().clock.hour12);
  }
  CC.openNotes = function () {
    var n = CC.notes.get();
    var ta = h("textarea", { "aria-label": "Notes", placeholder: "Write anything. It saves as you type." }); ta.value = n.text;
    var stat = h("span", { class: "status-line" });
    function upd() { stat.textContent = words(ta.value) + " words, " + ago(CC.notes.get().savedAt).toLowerCase(); }
    var t; ta.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { CC.notes.set(ta.value); upd(); }, 300); });
    var panel = h("div", { class: "notes-full", role: "dialog", "aria-modal": "true", "aria-label": "Notes" }, [
      h("div", { class: "w-head" }, [h("h2", { class: "w-title", text: "Notes" }), h("div", { class: "w-tools" }, [stat, h("button", { class: "btn sm", type: "button", text: "Done", onclick: function () { layer.close(); } })])]),
      ta
    ]);
    var layer = CC.openLayer([panel], function () { clearTimeout(t); CC.notes.set(ta.value); });
    upd(); setTimeout(function () { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 40);
  };
  W.notes = {
    title: "Notes", sizes: [3, 4, 5, 6, 8, 12],
    mount: function (el) {
      var status = h("span", { class: "status-line" }, [h("i", { class: "saved-dot" }), h("span", { class: "st" })]);
      el.appendChild(head("Notes", null, [status,
        iconBtn("expand", "Expand notes", function () { CC.openNotes(); }),
        iconBtn("trash", "Clear notes", function () {
          if (!ta.value.trim()) return;
          CC.confirm("Clear all notes?", "This removes everything in your notes. It can't be undone.", "Clear notes").then(function (ok) { if (ok) { ta.value = ""; CC.notes.set(""); upd(); CC.toast("Notes cleared"); } });
        })]));
      var ta = h("textarea", { class: "note-area", id: "notes-area", "aria-label": "Notes", placeholder: "Video ideas, reminders, anything. It saves as you type." });
      ta.value = CC.notes.get().text;
      var body = h("div", { class: "w-body" }, ta); el.appendChild(body);
      var t;
      function upd() { status.classList.remove("saving"); var n = words(ta.value); status.querySelector(".st").textContent = n ? n + (n === 1 ? " word, " : " words, ") + ago(CC.notes.get().savedAt).toLowerCase() : "Saves as you type"; }
      ta.addEventListener("input", function () { status.classList.add("saving"); status.querySelector(".st").textContent = "Saving"; clearTimeout(t); t = setTimeout(function () { CC.notes.set(ta.value); upd(); }, 400); });
      upd();
      var off = CC.on("notes", function (n) { if (document.activeElement !== ta) ta.value = n.text; upd(); });
      var iv = setInterval(upd, 20000);
      return function () { off(); clearInterval(iv); if (t) { clearTimeout(t); CC.notes.set(ta.value); } };
    }
  };

  /* ======================= Focus timer ======================= */
  CC.focus = {
    state: function () { return CC.store.get("focus", { mode: "work", running: false, endsAt: 0, left: S().focus.work * 60, sessions: { date: "", n: 0, mins: 0 } }); },
    save: function (s) { CC.store.set("focus", s); CC.emit("focus", s); },
    dur: function (mode) { return (mode === "work" ? S().focus.work : S().focus.brk) * 60; },
    remaining: function (s) { return s.running ? Math.max(0, Math.round((s.endsAt - Date.now()) / 1000)) : s.left; },
    start: function () { var s = CC.focus.state(); if (s.running) return; s.running = true; s.endsAt = Date.now() + s.left * 1000; CC.focus.save(s); },
    pause: function () { var s = CC.focus.state(); if (!s.running) return; s.left = CC.focus.remaining(s); s.running = false; CC.focus.save(s); },
    toggle: function () { CC.focus.state().running ? CC.focus.pause() : CC.focus.start(); },
    reset: function () { var s = CC.focus.state(); s.running = false; s.left = CC.focus.dur(s.mode); CC.focus.save(s); },
    skip: function () { var s = CC.focus.state(); s.mode = s.mode === "work" ? "break" : "work"; s.running = false; s.left = CC.focus.dur(s.mode); CC.focus.save(s); },
    complete: function () {
      var s = CC.focus.state(), today = CC.ymd();
      if (s.sessions.date !== today) s.sessions = { date: today, n: 0, mins: 0 };
      if (s.mode === "work") { s.sessions.n++; s.sessions.mins += S().focus.work; }
      var was = s.mode; s.mode = was === "work" ? "break" : "work"; s.running = false; s.left = CC.focus.dur(s.mode);
      CC.focus.save(s); CC.chime();
      CC.toast(was === "work" ? "Focus session done. Take a " + S().focus.brk + " minute break." : "Break over. Ready for the next session?", { icon: "target", ms: 6000 });
    }
  };
  /* Background check so the timer completes even when the widget is hidden, and the tab title shows the countdown */
  var baseTitle = document.title;
  setInterval(function () {
    var s = CC.focus.state();
    if (s.running && CC.focus.remaining(s) <= 0) CC.focus.complete();
    s = CC.focus.state();
    if (s.running) { var r = CC.focus.remaining(s); document.title = Math.floor(r / 60) + ":" + String(r % 60).padStart(2, "0") + " " + (s.mode === "work" ? "Focus" : "Break"); }
    else if (document.title !== baseTitle) document.title = baseTitle;
  }, 1000);

  W.focus = {
    title: "Focus", sizes: [3, 4, 5, 6],
    mount: function (el) {
      var modeEl = h("span");
      el.appendChild(head("Focus", modeEl, [iconBtn("skip", "Skip to next session", function () { CC.focus.skip(); })]));
      var body = h("div", { class: "w-body" }); el.appendChild(body);
      var R = 42, C = 2 * Math.PI * R;
      var ring = h("div", { class: "focus-ring", html: '<svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="' + R + '"/><circle class="bar" cx="50" cy="50" r="' + R + '" stroke-dasharray="' + C + '"/></svg><div class="t num" aria-live="off"></div>' });
      var playBtn = h("button", { type: "button", class: "btn sm primary" });
      playBtn.addEventListener("click", function () { CC.focus.toggle(); });
      var resetBtn = iconBtn("reset", "Reset timer", function () { CC.focus.reset(); }, { class: "btn icon sm" });
      body.appendChild(h("div", { class: "focus-row" }, [ring, h("div", { class: "focus-ctl" }, [playBtn, resetBtn])]));
      var prog = h("i"), progWrap = h("div", { class: "progress", role: "progressbar", "aria-label": "Today's task progress" }, prog);
      var stats = h("div", { class: "stats" });
      body.appendChild(h("div", { style: { display: "grid", gap: "8px", "margin-top": "auto" } }, [progWrap, stats]));
      var lastSec = -1, lastRunning = null;
      function paint() {
        var s = CC.focus.state(), r = CC.focus.remaining(s), total = CC.focus.dur(s.mode);
        ring.dataset.mode = s.mode;
        ring.querySelector(".bar").style.strokeDashoffset = (C * (1 - r / total)).toFixed(2);
        var tEl = ring.querySelector(".t"); tEl.innerHTML = ""; tEl.appendChild(document.createTextNode(Math.floor(r / 60) + ":" + String(r % 60).padStart(2, "0"))); tEl.appendChild(h("small", { text: s.mode === "work" ? "Focus" : "Break" }));
        if (lastRunning !== s.running) {
          playBtn.innerHTML = ""; playBtn.appendChild(icon(s.running ? "pause" : "play")); playBtn.appendChild(document.createTextNode(s.running ? "Pause" : (r < total ? "Resume" : "Start")));
          lastRunning = s.running;
        }
        modeEl.textContent = s.mode === "work" ? S().focus.work + " min" : S().focus.brk + " min break";
      }
      function paintStats() {
        var st = CC.tasks.stats(), s = CC.focus.state(), today = CC.ymd(), n = s.sessions.date === today ? s.sessions.n : 0;
        var pct = st.total ? Math.round(st.doneToday / st.total * 100) : 0;
        prog.style.width = pct + "%"; progWrap.setAttribute("aria-valuenow", pct); progWrap.setAttribute("aria-valuemin", 0); progWrap.setAttribute("aria-valuemax", 100);
        stats.innerHTML = "";
        [[st.doneToday, "done today"], [st.open, "remaining"], [n, n === 1 ? "session" : "sessions"]].forEach(function (x) { stats.appendChild(h("div", { class: "stat" }, [h("b", { text: x[0] }), h("span", { text: x[1] })])); });
      }
      paint(); paintStats();
      var iv = setInterval(function () { var s = CC.focus.state(), r = CC.focus.remaining(s); if (r !== lastSec) { lastSec = r; paint(); } }, 250);
      var off1 = CC.on("focus", function () { lastRunning = null; paint(); paintStats(); }), off2 = CC.on("tasks", paintStats), off3 = CC.on("settings", function () { lastRunning = null; paint(); });
      return function () { clearInterval(iv); off1(); off2(); off3(); };
    }
  };

  /* ======================= Shortcuts ======================= */
  CC.shortcuts = {
    all: function () { return CC.store.get("shortcuts", CC.defaults.shortcuts); },
    save: function (s) { CC.store.set("shortcuts", s); CC.emit("shortcuts"); },
    edit: function (sc) {
      var all = CC.shortcuts.all(), isNew = !sc;
      sc = sc || { id: CC.uid(), name: "", desc: "", url: "", key: "" };
      var used = all.filter(function (x) { return x.id !== sc.id && x.key; }).map(function (x) { return x.key; });
      var keys = [{ value: "", label: "None" }].concat("1234567890".split("").map(function (k) { return { value: k, label: k + (used.indexOf(k) >= 0 ? " (swap with " + all.find(function (x) { return x.key === k && x.id !== sc.id; }).name + ")" : "") }; }));
      return CC.dialog({
        title: isNew ? "Add shortcut" : "Edit shortcut", ok: isNew ? "Add shortcut" : "Save changes",
        extra: isNew ? null : { label: "Remove" },
        fields: [
          { name: "name", label: "Name", value: sc.name, placeholder: "e.g. LinkedIn", required: true, max: 40 },
          { name: "url", label: "Web address", value: sc.url, placeholder: "linkedin.com", required: true },
          { name: "desc", label: "Description", value: sc.desc, placeholder: "Optional", max: 50 },
          { name: "key", label: "Keyboard number", type: "select", value: sc.key || "", options: keys, hint: "Press this number on the page to open the shortcut." }
        ],
        validate: function (v) { if (!v.name) return "Give the shortcut a name."; if (!CC.looksLikeUrl(v.url)) return "Enter a web address like linkedin.com or https://example.com."; }
      }).then(function (v) {
        if (!v) return;
        var list = CC.shortcuts.all();
        if (v.__extra) { CC.shortcuts.remove(sc.id); return; }
        if (v.key) list.forEach(function (x) { if (x.key === v.key && x.id !== sc.id) x.key = sc.key || ""; });
        var rec = { id: sc.id, name: v.name, url: CC.toUrl(v.url), desc: v.desc, key: v.key };
        var i = list.findIndex(function (x) { return x.id === sc.id; });
        if (i >= 0) list[i] = rec; else list.push(rec);
        CC.shortcuts.save(list); CC.toast(isNew ? "Shortcut added" : "Shortcut saved");
      });
    },
    remove: function (id) {
      var list = CC.shortcuts.all(), i = list.findIndex(function (x) { return x.id === id; }); if (i < 0) return;
      var gone = list.splice(i, 1)[0]; CC.shortcuts.save(list);
      CC.toast(gone.name + " removed", { icon: "trash", action: { label: "Undo", run: function () { var l = CC.shortcuts.all(); l.splice(i, 0, gone); CC.shortcuts.save(l); } } });
    },
    favEl: function (sc) {
      var box = h("span", { class: "fav" });
      var img = h("img", { src: CC.favicon(sc.url), alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
      img.addEventListener("error", function () { box.innerHTML = ""; box.appendChild(h("span", { class: "mono", text: (sc.name || "?").slice(0, 1).toUpperCase() })); });
      box.appendChild(img); return box;
    }
  };
  W.shortcuts = {
    title: "Shortcuts", sizes: [6, 8, 12],
    mount: function (el) {
      el.appendChild(head("Shortcuts", null, [
        h("span", { class: "status-line", text: "Drag to reorder" }),
        iconBtn("plus", "Add shortcut", function () { CC.shortcuts.edit(); })
      ]));
      var grid = h("nav", { class: "tiles", "aria-label": "Shortcuts" }); el.appendChild(h("div", { class: "w-body" }, grid));
      var dragId = null;
      function render() {
        grid.innerHTML = "";
        CC.shortcuts.all().forEach(function (sc) {
          var a = h("a", { class: "tile", href: sc.url, draggable: "true", "data-id": sc.id, title: sc.url }, [
            CC.shortcuts.favEl(sc),
            h("span", { class: "tile-text" }, [h("span", { class: "tile-name", text: sc.name }), sc.desc ? h("span", { class: "tile-desc", text: sc.desc }) : null]),
            sc.key ? h("kbd", { class: "key", text: sc.key, "aria-label": "Shortcut key " + sc.key }) : null
          ]);
          var ed = h("button", { class: "edit", type: "button", "aria-label": "Edit " + sc.name, title: "Edit" }, icon("pencil"));
          ed.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); CC.shortcuts.edit(sc); });
          a.appendChild(ed);
          a.addEventListener("dragstart", function (e) { dragId = sc.id; a.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/x-cc-shortcut", sc.id); });
          a.addEventListener("dragend", function () { dragId = null; a.classList.remove("dragging"); clearMarks(); });
          a.addEventListener("dragover", function (e) {
            if (!dragId || dragId === sc.id) return; e.preventDefault();
            var r = a.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
            clearMarks(); a.classList.add(after ? "drop-after" : "drop-before");
          });
          a.addEventListener("drop", function (e) {
            if (!dragId) return; e.preventDefault();
            var after = a.classList.contains("drop-after"), list = CC.shortcuts.all();
            var from = list.findIndex(function (x) { return x.id === dragId; }), item = list.splice(from, 1)[0];
            var to = list.findIndex(function (x) { return x.id === sc.id; }) + (after ? 1 : 0);
            list.splice(to, 0, item); CC.shortcuts.save(list);
          });
          grid.appendChild(a);
        });
        if (!grid.children.length) {
          var add = h("button", { type: "button", class: "tile add" }, [icon("plus"), "Add your first shortcut"]);
          add.addEventListener("click", function () { CC.shortcuts.edit(); });
          grid.appendChild(add);
        }
      }
      function clearMarks() { grid.querySelectorAll(".drop-before,.drop-after").forEach(function (x) { x.classList.remove("drop-before", "drop-after"); }); }
      render();
      return CC.on("shortcuts", render);
    }
  };

  /* ======================= Agenda (your events + Google Calendar feed) ======================= */
  CC.events = {
    all: function () { return CC.store.get("events", []); },
    save: function (e) { CC.store.set("events", e); CC.emit("events"); },
    add: function () {
      return CC.dialog({
        title: "Add event", ok: "Add event",
        fields: [
          { name: "title", label: "What", placeholder: "e.g. Call with supervisor", required: true, max: 80 },
          { name: "date", label: "Date", type: "date", value: CC.ymd(), half: true },
          { name: "time", label: "Time", type: "time", value: "", half: true, hint: "Leave empty for all day" }
        ],
        validate: function (v) { if (!v.title) return "Give the event a name."; if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return "Pick a date."; }
      }).then(function (v) {
        if (!v) return;
        var e = CC.events.all(); e.push({ id: CC.uid(), title: v.title, date: v.date, time: v.time || "" }); CC.events.save(e); CC.toast("Event added");
      });
    }
  };
  /* Minimal iCalendar parser with common recurrence rules */
  function icsUnfold(t) { return t.replace(/\r?\n[ \t]/g, ""); }
  function icsDate(v, params) {
    var m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/); if (!m) return null;
    if (!m[4]) return { d: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
    if (m[7]) return { d: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])), allDay: false };
    var tz = (params.match(/TZID=([^;:]+)/) || [])[1];
    var naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (tz) { try { var off = CC.tzOffset(tz, new Date(naive)); return { d: new Date(naive - off * 60000), allDay: false }; } catch (e) {} }
    return { d: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]), allDay: false };
  }
  CC.parseICS = function (text, from, to) {
    var out = [], lines = icsUnfold(text).split(/\r?\n/), ev = null;
    lines.forEach(function (ln) {
      if (ln === "BEGIN:VEVENT") { ev = { ex: [] }; return; }
      if (ln === "END:VEVENT") { if (ev) expand(ev); ev = null; return; }
      if (!ev) return;
      var i = ln.indexOf(":"); if (i < 0) return;
      var key = ln.slice(0, i), val = ln.slice(i + 1), name = key.split(";")[0], params = key.slice(name.length);
      if (name === "SUMMARY") ev.title = val.replace(/\\([,;\\])/g, "$1").replace(/\\n/gi, " ");
      else if (name === "DTSTART") ev.start = icsDate(val, params);
      else if (name === "DTEND") ev.end = icsDate(val, params);
      else if (name === "RRULE") ev.rrule = val;
      else if (name === "EXDATE") val.split(",").forEach(function (x) { var d = icsDate(x, params); if (d) ev.ex.push(+d.d); });
      else if (name === "STATUS") ev.status = val;
      else if (name === "RECURRENCE-ID") ev.recurId = icsDate(val, params);
    });
    function push(ev, d) { if (d >= from && d <= to && ev.ex.indexOf(+d) < 0 && ev.status !== "CANCELLED") out.push({ title: ev.title || "Busy", at: d, allDay: ev.start.allDay, src: "cal" }); }
    function expand(ev) {
      if (!ev.start) return;
      if (!ev.rrule) { push(ev, ev.start.d); return; }
      var r = {}; ev.rrule.split(";").forEach(function (p) { var kv = p.split("="); r[kv[0]] = kv[1]; });
      var freq = r.FREQ, interval = +(r.INTERVAL || 1), count = r.COUNT ? +r.COUNT : Infinity, until = r.UNTIL ? icsDate(r.UNTIL, "").d : null;
      var days = r.BYDAY ? r.BYDAY.split(",").map(function (x) { return ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(x.slice(-2)); }) : null;
      var d = new Date(ev.start.d), n = 0, guard = 0;
      while (guard++ < 2000 && n < count) {
        if (until && d > until) break; if (d > to) break;
        if (freq === "WEEKLY" && days) {
          var weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay());
          for (var k = 0; k < 7 && n < count; k++) {
            var x = new Date(weekStart); x.setDate(weekStart.getDate() + k);
            x.setHours(ev.start.d.getHours(), ev.start.d.getMinutes(), 0, 0);
            if (days.indexOf(x.getDay()) >= 0 && x >= ev.start.d) { if (until && x > until) break; n++; push(ev, x); }
          }
          d.setDate(d.getDate() + 7 * interval); d.setDate(d.getDate() - d.getDay() + ev.start.d.getDay());
          continue;
        }
        n++; push(ev, new Date(d));
        if (freq === "DAILY") d.setDate(d.getDate() + interval);
        else if (freq === "WEEKLY") d.setDate(d.getDate() + 7 * interval);
        else if (freq === "MONTHLY") d.setMonth(d.getMonth() + interval);
        else if (freq === "YEARLY") d.setFullYear(d.getFullYear() + interval);
        else break;
      }
    }
    return out;
  };
  CC.calendar = {
    load: function (force) {
      var url = (S().calendar.ics || "").trim();
      if (!url) return Promise.resolve({ events: [], state: "none" });
      var cached = CC.store.get("calcache", null);
      if (!force && cached && cached.url === url && Date.now() - cached.at < 15 * 60 * 1000) return Promise.resolve(cached);
      var from = new Date(); from.setHours(0, 0, 0, 0); var to = new Date(from); to.setDate(to.getDate() + 14);
      return fetch(url.replace(/^webcal:/i, "https:")).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then(function (t) {
        if (t.indexOf("BEGIN:VCALENDAR") < 0) throw new Error("not-ics");
        var ev = CC.parseICS(t, from, to).map(function (e) { return { title: e.title, at: +e.at, allDay: e.allDay, src: "cal" }; });
        var res = { url: url, at: Date.now(), events: ev, state: "ok" }; CC.store.set("calcache", res); return res;
      }).catch(function (e) {
        var why = CC.isExtension ? (e.message === "not-ics" ? "That address isn't a calendar feed." : "Couldn't reach the calendar feed.") : "Browsers block calendar feeds on a local page. Load the Command Centre extension to sync it.";
        if (cached && cached.url === url) { cached.state = "stale"; cached.why = why; return cached; }
        return { events: [], state: "error", why: why };
      });
    }
  };
  W.agenda = {
    title: "Agenda", sizes: [3, 4, 5, 6],
    mount: function (el) {
      el.appendChild(head("Agenda", null, [
        h("a", { class: "btn ghost icon sm", href: "https://calendar.google.com/calendar/r", target: "_blank", rel: "noopener", "aria-label": "Open Google Calendar", title: "Open Google Calendar" }, icon("out")),
        iconBtn("plus", "Add event", function () { CC.events.add(); })
      ]));
      var body = h("div", { class: "w-body" }); el.appendChild(body);
      var cal = { events: [], state: "none" };
      function collect() {
        var now = Date.now(), start = new Date(); start.setHours(0, 0, 0, 0);
        var local = CC.events.all().map(function (e) {
          var d = CC.parseYMD(e.date); if (e.time) { var t = e.time.split(":"); d.setHours(+t[0], +t[1]); }
          return { id: e.id, title: e.title, at: +d, allDay: !e.time, src: "local" };
        });
        return local.concat(cal.events).filter(function (e) { return e.allDay ? e.at >= +start : e.at >= now - 30 * 60000; }).sort(function (a, b) { return a.at - b.at; });
      }
      function rel(ms) { var m = Math.round(ms / 60000); if (m < 1) return "now"; if (m < 60) return "in " + m + " min"; var hh = Math.floor(m / 60), mm = m % 60; return "in " + hh + "h" + (mm ? " " + mm + "m" : ""); }
      function render() {
        var evs = collect(); body.innerHTML = "";
        var hour12 = S().clock.hour12;
        if (!evs.length) {
          body.appendChild(h("div", { class: "empty" }, [h("b", { text: "No upcoming events" }), h("span", { text: cal.state === "none" ? "Add one here, or connect your Google Calendar in Settings." : "Your calendar is clear for the next two weeks." }),
            h("button", { class: "btn sm", type: "button", text: "Add event", onclick: function () { CC.events.add(); } })]));
        } else {
          var next = evs.find(function (e) { return !e.allDay && e.at >= Date.now() - 5 * 60000; }) || evs[0], nd = new Date(next.at);
          body.appendChild(h("div", { class: "next-up" }, [
            h("div", { class: "lbl", text: "Next up" }),
            h("div", { class: "ttl", text: next.title }),
            h("div", { class: "when", text: CC.dayLabel(CC.ymd(nd)) + (next.allDay ? ", all day" : ", " + CC.fmtTime(nd.getHours(), nd.getMinutes(), hour12) + (next.at - Date.now() < 864e5 && next.at > Date.now() ? " (" + rel(next.at - Date.now()) + ")" : "")) })
          ]));
          var ul = h("ul", { class: "ev-list" }), lastDay = "";
          evs.filter(function (e) { return e !== next; }).slice(0, 12).forEach(function (e) {
            var d = new Date(e.at), day = CC.ymd(d);
            if (day !== lastDay) { ul.appendChild(h("li", { class: "day-head", text: CC.dayLabel(day) })); lastDay = day; }
            var li = h("li", { class: "ev" }, [h("span", { class: "d num", text: e.allDay ? "All day" : CC.fmtTime(d.getHours(), d.getMinutes(), hour12) }), h("span", { class: "tt", text: e.title, title: e.title }), h("span", { class: "src" + (e.src === "local" ? " local" : ""), title: e.src === "local" ? "Added here" : "Google Calendar" })]);
            if (e.src === "local") { li.style.gridTemplateColumns = "62px 1fr auto auto"; li.appendChild(iconBtn("x", "Delete event " + e.title, function () { CC.events.save(CC.events.all().filter(function (x) { return x.id !== e.id; })); }, { class: "btn ghost icon sm x" })); }
            ul.appendChild(li);
          });
          body.appendChild(ul);
        }
        var st = h("div", { class: "status-line", style: { "margin-top": "auto" } });
        if (cal.state === "ok") { var t = new Date(cal.at); st.textContent = "Google Calendar synced " + CC.fmtTime(t.getHours(), t.getMinutes(), hour12); }
        else if (cal.state === "error" || cal.state === "stale") st.textContent = cal.why;
        else st.textContent = "Showing events you add here";
        body.appendChild(st);
      }
      function load(force) { CC.calendar.load(force).then(function (r) { cal = r; render(); }); }
      render(); load(false);
      var iv = setInterval(function () { load(false); }, 5 * 60 * 1000), iv2 = setInterval(render, 60 * 1000);
      var off = CC.on("events", render), off2 = CC.on("settings", function () { load(true); });
      return function () { clearInterval(iv); clearInterval(iv2); off(); off2(); };
    }
  };

  /* ======================= World clock ======================= */
  CC.world = {
    all: function () { return CC.store.get("world", CC.defaults.world); },
    save: function (w) { CC.store.set("world", w); CC.emit("world"); },
    add: function () {
      return CC.dialog({
        title: "Add a city", ok: "Add city",
        fields: [
          { name: "tz", label: "Time zone", type: "select", value: "Europe/Paris", options: CC.zones.map(function (z) { return { value: z, label: z.replace(/_/g, " ") }; }) },
          { name: "label", label: "Name to show", placeholder: "Leave empty to use the city in the time zone", max: 30 }
        ]
      }).then(function (v) { if (!v) return; var w = CC.world.all(); w.push({ tz: v.tz, label: v.label || CC.zoneCity(v.tz) }); CC.world.save(w); CC.toast("City added"); });
    }
  };
  W.world = {
    title: "World clock", sizes: [3, 4, 5, 6],
    mount: function (el) {
      el.appendChild(head("World clock", null, [iconBtn("plus", "Add city", function () { CC.world.add(); })]));
      var ul = h("ul", { class: "zones" }); el.appendChild(h("div", { class: "w-body" }, ul));
      function render() {
        ul.innerHTML = ""; var now = new Date(), base = CC.tzOffset(S().clock.tz, now), list = CC.world.all();
        if (!list.length) { ul.appendChild(h("li", { class: "empty" }, [h("b", { text: "No cities yet" }), h("span", { text: "Add the places you keep track of." })])); return; }
        list.forEach(function (z, i) {
          var p = CC.tzParts(now, z.tz), here = CC.tzParts(now, S().clock.tz);
          var dayDiff = Date.UTC(p.y, p.mo - 1, p.d) - Date.UTC(here.y, here.mo - 1, here.d), dayTxt = dayDiff > 0 ? "Tomorrow, " : dayDiff < 0 ? "Yesterday, " : "";
          ul.appendChild(h("li", { class: "zone" }, [
            h("div", { class: "zn" }, [h("b", { text: z.label, style: { "font-weight": "500" } }), h("span", { text: dayTxt + CC.diffLabel(CC.tzOffset(z.tz, now) - base) })]),
            h("span", { class: "zt", text: CC.fmtTime(p.h, p.m, S().clock.hour12) }),
            iconBtn("x", "Remove " + z.label, function () { var w = CC.world.all(); w.splice(i, 1); CC.world.save(w); }, { class: "btn ghost icon sm x" })
          ]));
        });
      }
      render();
      var iv = setInterval(render, 15000), off = CC.on("world", render), off2 = CC.on("settings", render);
      return function () { clearInterval(iv); off(); off2(); };
    }
  };
})();
