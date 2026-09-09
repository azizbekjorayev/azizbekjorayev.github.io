/* Azizbek Juraev — résumé renderer. Reads content.json, renders the page. */
(function () {
  "use strict";

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var has = function (v) { return v != null && String(v).trim() !== ""; };
  var arr = function (v) { return Array.isArray(v) ? v : []; };
  var $ = function (s) { return document.querySelector(s); };

  var ICON = {
    email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    telegram: '<path d="M21.5 4.3 2.9 11.4c-1.1.4-1.1 1.5-.2 1.8l4.7 1.5 1.8 5.5c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.2-.5-1.8-1.4-1.4z"/>',
    linkedin: '<rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/><path d="M10 21V9h4v1.7A4.3 4.3 0 0 1 22 14v7h-4v-6a2 2 0 0 0-4 0v6z"/>',
    kakao: '<path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1 3.8c-.1.4.3.6.6.4l4.5-3c.3 0 .5.1.8.1 5.1 0 9.2-3.3 9.2-7.5S17.1 3 12 3z"/>',
    location: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'
  };
  var svg = function (name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICON[name] || "") + "</svg>";
  };

  /* ---------- section renderers ---------- */

  function entry(when, title, orgLine, note, bullets) {
    var h = '<article class="entry">';
    h += '<div class="when">' + esc(when) + "</div>";
    h += "<div><h3>" + esc(title) + "</h3>";
    if (has(orgLine)) h += '<p class="org">' + orgLine + "</p>";
    if (has(note)) h += '<span class="note">' + esc(note) + "</span>";
    var b = arr(bullets).filter(has);
    if (b.length) {
      h += "<ul>" + b.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    }
    return h + "</div></article>";
  }

  function orgLine(org, location) {
    var p = [];
    if (has(org)) p.push("<strong>" + esc(org) + "</strong>");
    if (has(location)) p.push(esc(location));
    return p.join('<span class="dot">·</span>');
  }

  var RENDER = {
    experience: function (items) {
      return items.map(function (e) {
        return entry(e.period, e.role, orgLine(e.org, e.location), "", e.bullets);
      }).join("");
    },
    education: function (items) {
      return items.map(function (e) {
        return entry(e.period, e.degree, orgLine(e.school, e.location), e.note, []);
      }).join("");
    },
    certifications: function (items) {
      return '<div class="certs">' + items.map(function (c, i) {
        var img = has(c.image);
        var h = '<div class="cert' + (img ? " has-img" : "") + '"' +
          (img ? ' data-img="' + esc(c.image) + '" data-cap="' + esc(c.title) + '" tabindex="0" role="button" aria-label="View certificate: ' + esc(c.title) + '"' : "") + ">";
        h += '<div class="thumb">';
        h += img
          ? '<img src="' + esc(c.image) + '" alt="' + esc(c.title) + '" loading="lazy">'
          : '<span class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICON.award + "</svg></span>";
        h += "</div>";
        h += '<div class="body"><h3>' + esc(c.title) + "</h3>";
        if (has(c.issuer)) h += '<p class="issuer">' + esc(c.issuer) + "</p>";
        if (has(c.date)) h += '<p class="date">' + esc(c.date) + "</p>";
        return h + "</div></div>";
      }).join("") + "</div>";
    },
    scholarships: function (items) {
      return items.map(function (s) {
        return entry(s.period, s.title, orgLine(s.issuer, ""), "", s.note ? [s.note] : []);
      }).join("");
    },
    activities: function (items) {
      return items.map(function (a) {
        return entry(a.period, a.title, orgLine(a.org, a.location), "", a.bullets);
      }).join("");
    }
  };

  function renderSkills(skills, languages) {
    var left = arr(skills).map(function (g) {
      return '<div class="skill-group"><h3>' + esc(g.group) + '</h3><div class="tags">' +
        arr(g.items).map(function (i) { return '<span class="tag">' + esc(i) + "</span>"; }).join("") +
        "</div></div>";
    }).join("");

    var right = arr(languages).map(function (l) {
      var v = Math.max(0, Math.min(100, Number(l.value) || 0));
      return '<div class="lang"><div class="top"><span class="name">' + esc(l.name) +
        '</span><span class="lvl">' + esc(l.level) + '</span></div>' +
        '<div class="track"><span class="fill" style="width:' + v + '%"></span></div></div>';
    }).join("");

    return '<div class="split"><div>' +
      '<h3 style="margin:0 0 18px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)">Competencies</h3>' + left +
      '</div><div>' +
      '<h3 style="margin:0 0 18px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)">Languages</h3>' + right +
      "</div></div>";
  }

  function renderContact(c) {
    var rows = [
      { k: "Email", v: c.email, href: c.email ? "mailto:" + c.email : "", i: "email" },
      { k: "Phone", v: c.phone, href: c.phone ? "tel:" + String(c.phone).replace(/[^\d+]/g, "") : "", i: "phone" },
      { k: "Telegram", v: c.telegram ? "@" + String(c.telegram).replace(/^@/, "") : "", href: c.telegram ? "https://t.me/" + String(c.telegram).replace(/^@/, "") : "", i: "telegram" },
      { k: "LinkedIn", v: c.linkedin, href: c.linkedin ? (/^https?:/.test(c.linkedin) ? c.linkedin : "https://" + c.linkedin) : "", i: "linkedin" },
      { k: "KakaoTalk", v: c.kakao, href: "", i: "kakao" },
      { k: "Location", v: c.address, href: "", i: "location" }
    ].filter(function (r) { return has(r.v); });

    return '<div class="contact-grid">' + rows.map(function (r) {
      var inner = svg(r.i) + '<div><div class="k">' + esc(r.k) + '</div><div class="v">' + esc(r.v) + "</div></div>";
      return r.href
        ? '<a class="contact-item" href="' + esc(r.href) + '"' + (/^https/.test(r.href) ? ' target="_blank" rel="noopener"' : "") + ">" + inner + "</a>"
        : '<div class="contact-item">' + inner + "</div>";
    }).join("") + "</div>";
  }

  /* ---------- page assembly ---------- */

  function build(data) {
    var p = data.profile || {}, c = data.contact || {};

    if (has(p.name)) {
      document.title = p.name + (has(p.headline) ? " — " + p.headline : "");
      $("#p-name").textContent = p.name;
    }
    $("#p-headline").textContent = p.headline || "";
    $("#p-sub").textContent = p.subheadline || "";

    var av = $("#avatar");
    if (has(p.photo)) {
      av.outerHTML = '<img class="avatar" id="avatar" src="' + esc(p.photo) + '" alt="' + esc(p.name) + '">';
    } else {
      av.className = "avatar";
      av.textContent = p.initials || (p.name || "").split(/\s+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 2).toUpperCase();
    }

    if (has(p.resumePdf)) $("#pdf-link").href = p.resumePdf; else $("#pdf-link").style.display = "none";
    if (has(c.email)) $("#mail-btn").href = "mailto:" + c.email; else $("#mail-btn").remove();
    if (has(c.linkedin)) $("#li-btn").href = /^https?:/.test(c.linkedin) ? c.linkedin : "https://" + c.linkedin; else $("#li-btn").remove();

    var html = "";

    if (has(p.tagline)) html += '<p class="lede">' + esc(p.tagline) + "</p>";
    var facts = arr(p.facts).filter(function (f) { return has(f.value); });
    if (facts.length) {
      html += '<dl class="facts">' + facts.map(function (f) {
        return '<div class="fact"><dt>' + esc(f.label) + "</dt><dd>" + esc(f.value) + "</dd></div>";
      }).join("") + "</dl>";
    }

    var plan = [
      { id: "profile", label: "Profile", body: has(p.objective) ? '<p style="max-width:66ch;font-size:15.5px;color:var(--ink-2);margin:0">' + esc(p.objective) + "</p>" : "", count: "" },
      { id: "experience", label: "Experience", key: "experience" },
      { id: "education", label: "Education", key: "education" },
      { id: "certifications", label: "Certifications", key: "certifications" },
      { id: "skills", label: "Skills & Languages", body: (arr(data.skills).length || arr(data.languages).length) ? renderSkills(data.skills, data.languages) : "" },
      { id: "scholarships", label: "Scholarships", key: "scholarships" },
      { id: "activities", label: "Leadership & Activities", key: "activities" },
      { id: "contact", label: "Contact", body: renderContact(c) }
    ];

    var navHtml = "";
    plan.forEach(function (s) {
      var body = s.body, count = "";
      if (s.key) {
        var items = arr(data[s.key]);
        if (!items.length) return;
        body = RENDER[s.key](items);
        count = String(items.length).padStart(2, "0");
      }
      if (!has(body)) return;
      html += '<section id="' + s.id + '"><header class="sec-head"><h2>' + esc(s.label) + "</h2>" +
        (count ? '<span class="count">' + count + "</span>" : "") + "</header>" + body + "</section>";
      navHtml += '<a href="#' + s.id + '"><span class="bar"></span>' + esc(s.label) + "</a>";
    });

    html += "<footer><span>© " + new Date().getFullYear() + " " + esc(p.name || "") + "</span>" +
      '<span>Last updated ' + esc(data.updatedAt ? new Date(data.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—") + "</span></footer>";

    $("#main").innerHTML = html;
    $("#nav").innerHTML = navHtml;

    wire();
  }

  /* ---------- behaviour ---------- */

  function wire() {
    wireRest();
  }

  function wireRest() {
    // scroll-spy
    var links = [].slice.call(document.querySelectorAll("#nav a"));
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    var spy = function () {
      var y = window.scrollY + window.innerHeight * 0.28, best = 0;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= y) best = i; });
      links.forEach(function (a, i) { a.classList.toggle("active", i === best); });
    };
    window.addEventListener("scroll", spy, { passive: true });
    spy();

    // certificate lightbox
    var lb = $("#lightbox");
    var open = function (src, cap) {
      $("#lb-img").src = src;
      $("#lb-img").alt = cap;
      $("#lb-cap").textContent = cap;
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
    };
    var close = function () {
      lb.classList.remove("open");
      $("#lb-img").src = "";
      document.body.style.overflow = "";
    };
    document.querySelectorAll(".cert.has-img").forEach(function (el) {
      var go = function () { open(el.dataset.img, el.dataset.cap); };
      el.addEventListener("click", go);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      });
    });
    $("#lb-close").onclick = close;
    lb.onclick = function (e) { if (e.target === lb || e.target === $("#lb-img")) close(); };
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  /* ---------- theme ---------- */

  var SUN = '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  var MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    var dark = t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var icon = document.getElementById("theme-icon");
    if (icon) icon.innerHTML = dark ? SUN : MOON;
  }

  try { applyTheme(localStorage.getItem("aj-theme")); } catch (e) { applyTheme(null); }

  $("#theme-btn").onclick = function () {
    var cur = document.documentElement.getAttribute("data-theme");
    var isDark = cur ? cur === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next = isDark ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("aj-theme", next); } catch (e) {}
  };

  $("#print-btn").onclick = function () { window.print(); };

  /* ---------- boot ---------- */

  fetch("content.json?v=" + Date.now())
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(build)
    .catch(function (err) {
      $("#boot").innerHTML = "Could not load the résumé content.<br><small style='font-family:var(--mono)'>" + esc(err.message) + "</small>";
      console.error(err);
    });
})();
