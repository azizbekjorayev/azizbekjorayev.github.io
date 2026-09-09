/* ============================================================
   Résumé Admin — edits content.json and commits it to GitHub.
   The token lives only in this browser; the site itself stays
   a plain static site that nobody else can change.
   ============================================================ */
(function () {
  "use strict";

  var CONTENT_PATH = "content.json";
  var LS = "aj-admin-session";

  var S = { repo: "", branch: "main", token: "" };
  var data = null;      // working copy
  var baseSha = null;   // sha of the version we loaded
  var isDirty = false;
  var current = null;

  var $ = function (s) { return document.querySelector(s); };

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (attrs[k] == null) continue;
      if (k === "class") e.className = attrs[k];
      else if (k.slice(0, 2) === "on") e[k.toLowerCase()] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  /* ---------- base64 (utf-8 safe) ---------- */
  function b64enc(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function b64dec(b64) {
    var bin = atob(String(b64).replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function bufToB64(buf) {
    var bytes = new Uint8Array(buf), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  /* ---------- GitHub API ---------- */
  function api(path, opts) {
    opts = opts || {};
    return fetch("https://api.github.com/repos/" + S.repo + path, {
      method: opts.method || "GET",
      body: opts.body,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + S.token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = {};
        try { j = t ? JSON.parse(t) : {}; } catch (e) {}
        if (!r.ok) {
          var m = j.message || "HTTP " + r.status;
          if (r.status === 401) m = "Token rejected. Check that it is valid and not expired.";
          if (r.status === 404) m = "Not found. Check the repository name, branch, and that the token has access to this repo.";
          if (r.status === 409) m = "Conflict — the file changed on GitHub. Reload and try again.";
          throw new Error(m);
        }
        return j;
      });
    });
  }

  function getFile(path) {
    return api("/contents/" + encodeURI(path) + "?ref=" + encodeURIComponent(S.branch) + "&t=" + Date.now());
  }
  function putFile(path, contentB64, sha, message) {
    var body = { message: message, content: contentB64, branch: S.branch };
    if (sha) body.sha = sha;
    return api("/contents/" + encodeURI(path), { method: "PUT", body: JSON.stringify(body) });
  }

  /* ---------- schema ---------- */
  var SCHEMA = [
    {
      id: "profile", label: "Profile", type: "object", fields: [
        { k: "name", l: "Full name", t: "text" },
        { k: "headline", l: "Headline", t: "text", half: 1 },
        { k: "subheadline", l: "Sub-headline", t: "text", half: 1 },
        { k: "tagline", l: "Hero line (large text at the top)", t: "textarea" },
        { k: "objective", l: "Objective / professional summary", t: "textarea" },
        { k: "photo", l: "Profile photo", t: "image", dir: "assets" },
        { k: "initials", l: "Monogram (used when there is no photo)", t: "text", half: 1 },
        { k: "resumePdf", l: "PDF file path", t: "text", half: 1, mono: 1 },
        { k: "facts", l: "Quick facts", t: "objlist", title: "label", fields: [
            { k: "label", l: "Label", t: "text", half: 1 },
            { k: "value", l: "Value", t: "text", half: 1 }
        ] }
      ]
    },
    {
      id: "contact", label: "Contact", type: "object", fields: [
        { k: "email", l: "Email", t: "text", half: 1 },
        { k: "phone", l: "Phone", t: "text", half: 1 },
        { k: "telegram", l: "Telegram username (no @)", t: "text", half: 1 },
        { k: "linkedin", l: "LinkedIn URL", t: "text", half: 1 },
        { k: "kakao", l: "KakaoTalk ID", t: "text", half: 1 },
        { k: "address", l: "Address", t: "text" }
      ]
    },
    {
      id: "experience", label: "Experience", type: "array", title: "role", sub: "org", fields: [
        { k: "role", l: "Job title", t: "text" },
        { k: "org", l: "Organisation", t: "text", half: 1 },
        { k: "location", l: "Location", t: "text", half: 1 },
        { k: "period", l: "Period (e.g. May 2025 — December 2025)", t: "text" },
        { k: "bullets", l: "Responsibilities", t: "list" }
      ]
    },
    {
      id: "education", label: "Education", type: "array", title: "degree", sub: "school", fields: [
        { k: "degree", l: "Degree / programme", t: "text" },
        { k: "school", l: "Institution", t: "text", half: 1 },
        { k: "location", l: "Location", t: "text", half: 1 },
        { k: "period", l: "Period", t: "text", half: 1 },
        { k: "note", l: "Highlight (e.g. GPA 4.39 / 4.5)", t: "text", half: 1 }
      ]
    },
    {
      id: "certifications", label: "Certifications", type: "array", title: "title", sub: "issuer", fields: [
        { k: "title", l: "Certificate name", t: "text" },
        { k: "issuer", l: "Issued by", t: "text", half: 1 },
        { k: "date", l: "Date", t: "text", half: 1 },
        { k: "image", l: "Scan / photo of the certificate", t: "image", dir: "certificates" }
      ]
    },
    {
      id: "skills", label: "Skills", type: "array", title: "group", fields: [
        { k: "group", l: "Group name", t: "text" },
        { k: "items", l: "Skills", t: "list" }
      ]
    },
    {
      id: "languages", label: "Languages", type: "array", title: "name", sub: "level", fields: [
        { k: "name", l: "Language", t: "text", half: 1 },
        { k: "value", l: "Bar length (0–100)", t: "number", half: 1 },
        { k: "level", l: "Proficiency description", t: "text" }
      ]
    },
    {
      id: "scholarships", label: "Scholarships", type: "array", title: "title", sub: "issuer", fields: [
        { k: "title", l: "Scholarship", t: "text" },
        { k: "issuer", l: "Awarded by", t: "text", half: 1 },
        { k: "period", l: "Period", t: "text", half: 1 },
        { k: "note", l: "Note", t: "textarea" }
      ]
    },
    {
      id: "activities", label: "Leadership & Activities", type: "array", title: "title", sub: "org", fields: [
        { k: "title", l: "Activity", t: "text" },
        { k: "org", l: "Organisation", t: "text", half: 1 },
        { k: "location", l: "Location", t: "text", half: 1 },
        { k: "period", l: "Period", t: "text" },
        { k: "bullets", l: "What you did", t: "list" }
      ]
    }
  ];

  /* ---------- dirty state ---------- */
  function setDirty(v) {
    isDirty = v;
    $("#dirty").classList.toggle("on", v);
  }
  window.addEventListener("beforeunload", function (e) {
    if (isDirty) { e.preventDefault(); e.returnValue = ""; }
  });

  function status(text, kind) {
    var el = $("#status");
    el.textContent = text || "";
    el.style.color = kind === "err" ? "var(--err)" : kind === "ok" ? "var(--ok)" : "var(--ink-3)";
  }

  /* ---------- field renderers ---------- */

  function textField(obj, f, onChange) {
    var input;
    if (f.t === "textarea") {
      input = h("textarea", { class: f.mono ? "mono" : null, rows: 3 });
    } else {
      input = h("input", { type: f.t === "number" ? "number" : "text", class: f.mono ? "mono" : null,
        min: f.t === "number" ? 0 : null, max: f.t === "number" ? 100 : null });
    }
    input.value = obj[f.k] == null ? "" : obj[f.k];
    input.oninput = function () {
      obj[f.k] = f.t === "number" ? (input.value === "" ? 0 : Number(input.value)) : input.value;
      setDirty(true);
      if (onChange) onChange();
    };
    return h("label", { class: "f" }, [h("span", {}, [f.l]), input]);
  }

  function listField(obj, f) {
    if (!Array.isArray(obj[f.k])) obj[f.k] = [];
    var list = obj[f.k];
    var wrap = h("div", { class: "slist" });

    function draw() {
      wrap.innerHTML = "";
      list.forEach(function (val, i) {
        var ta = h("textarea", { rows: 2 });
        ta.value = val == null ? "" : val;
        ta.oninput = function () { list[i] = ta.value; setDirty(true); };
        var del = h("button", { class: "btn btn-sm btn-danger", title: "Remove",
          onclick: function () { list.splice(i, 1); setDirty(true); draw(); } }, ["✕"]);
        wrap.appendChild(h("div", { class: "srow" }, [ta, del]));
      });
      if (!list.length) wrap.appendChild(h("div", { class: "hint" }, ["Nothing here yet."]));
      wrap.appendChild(h("button", { class: "btn btn-sm", style: "align-self:flex-start;margin-top:2px",
        onclick: function () { list.push(""); setDirty(true); draw(); } }, ["+ Add"]));
    }
    draw();
    return h("label", { class: "f" }, [h("span", {}, [f.l]), wrap]);
  }

  /* image: resize client-side, commit to the repo, store the path */
  function imageField(obj, f) {
    var prev = h("div", { class: "prev" });
    var pathInput = h("input", { type: "text", class: "mono", placeholder: "no image" });
    var file = h("input", { type: "file", accept: "image/*", style: "display:none" });
    var note = h("div", { class: "hint" }, ["JPG or PNG. Resized automatically before upload."]);

    function drawPrev() {
      prev.innerHTML = "";
      var v = obj[f.k];
      if (v) prev.appendChild(h("img", { src: /^https?:/.test(v) ? v : "../" + v, alt: "" }));
      else prev.appendChild(h("span", {}, ["none"]));
      pathInput.value = v || "";
    }

    pathInput.oninput = function () { obj[f.k] = pathInput.value.trim(); setDirty(true); drawPrev(); };

    var upBtn = h("button", { class: "btn btn-sm", onclick: function () { file.click(); } }, ["Upload image"]);
    var rmBtn = h("button", { class: "btn btn-sm btn-danger",
      onclick: function () { obj[f.k] = ""; setDirty(true); drawPrev(); } }, ["Remove"]);

    file.onchange = function () {
      var fl = file.files && file.files[0];
      if (!fl) return;
      note.textContent = "Processing…";
      shrink(fl).then(function (res) {
        var name = (fl.name.replace(/\.[^.]+$/, "") || "image")
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";
        var path = f.dir + "/" + Date.now() + "-" + name + "." + res.ext;
        note.textContent = "Uploading (" + Math.round(res.b64.length * 0.75 / 1024) + " KB)…";
        return putFile(path, res.b64, null, "admin: upload " + path).then(function () {
          obj[f.k] = path;
          setDirty(true);
          drawPrev();
          note.textContent = "Uploaded. Publish your changes to show it on the site.";
        });
      }).catch(function (err) {
        note.textContent = "Upload failed: " + err.message;
      });
      file.value = "";
    };

    drawPrev();
    return h("label", { class: "f" }, [
      h("span", {}, [f.l]),
      h("div", { class: "imgf" }, [
        prev,
        h("div", { class: "ctl" }, [
          h("div", { style: "display:flex;gap:7px" }, [upBtn, rmBtn]),
          pathInput, note, file
        ])
      ])
    ]);
  }

  function shrink(fileObj) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(fileObj);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var max = 1600;
        var w = img.naturalWidth, hgt = img.naturalHeight;
        var scale = Math.min(1, max / Math.max(w, hgt));
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * scale); cv.height = Math.round(hgt * scale);
        var ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        var dataUrl = cv.toDataURL("image/jpeg", 0.85);
        resolve({ b64: dataUrl.split(",")[1], ext: "jpg" });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        // not a raster image the canvas can read — upload the raw bytes instead
        var fr = new FileReader();
        fr.onload = function () {
          var ext = (fileObj.name.split(".").pop() || "bin").toLowerCase();
          if (fileObj.size > 4 * 1024 * 1024) return reject(new Error("file is larger than 4 MB"));
          resolve({ b64: bufToB64(fr.result), ext: ext });
        };
        fr.onerror = function () { reject(new Error("could not read the file")); };
        fr.readAsArrayBuffer(fileObj);
      };
      img.src = url;
    });
  }

  function objListField(obj, f) {
    if (!Array.isArray(obj[f.k])) obj[f.k] = [];
    var box = h("div", {});
    function draw() {
      box.innerHTML = "";
      box.appendChild(arrayEditor(obj[f.k], f, draw));
    }
    draw();
    return h("label", { class: "f" }, [h("span", {}, [f.l]), box]);
  }

  function renderFields(obj, fields) {
    var out = [], buf = [];
    function flush() {
      if (buf.length) { out.push(h("div", { class: "row2" }, buf)); buf = []; }
    }
    fields.forEach(function (f) {
      var node;
      if (f.t === "list") node = listField(obj, f);
      else if (f.t === "objlist") node = objListField(obj, f);
      else if (f.t === "image") node = imageField(obj, f);
      else node = textField(obj, f);

      if (f.half) buf.push(node);
      else { flush(); out.push(node); }
      if (buf.length === 2) flush();
    });
    flush();
    return out;
  }

  /* ---------- array (list of records) editor ---------- */
  function arrayEditor(list, def, redraw) {
    var wrap = h("div", {});

    if (!list.length) {
      wrap.appendChild(h("div", { class: "empty" }, ["No entries yet."]));
    }

    list.forEach(function (item, i) {
      var card = h("div", { class: "item" });
      var titleEl = h("span", { class: "title" }, [itemTitle(item, def, i)]);
      var refreshTitle = function () { titleEl.textContent = itemTitle(item, def, i); };

      var head = h("div", { class: "item-head" }, [
        h("span", { class: "chev" }, ["▸"]),
        h("span", { class: "grip" }, [String(i + 1).padStart(2, "0")]),
        titleEl,
        h("span", { class: "acts" }, [
          h("button", { class: "btn btn-sm", title: "Move up", onclick: function (e) {
            e.stopPropagation();
            if (i === 0) return;
            list.splice(i - 1, 0, list.splice(i, 1)[0]); setDirty(true); redraw();
          } }, ["↑"]),
          h("button", { class: "btn btn-sm", title: "Move down", onclick: function (e) {
            e.stopPropagation();
            if (i === list.length - 1) return;
            list.splice(i + 1, 0, list.splice(i, 1)[0]); setDirty(true); redraw();
          } }, ["↓"]),
          h("button", { class: "btn btn-sm btn-danger", title: "Delete", onclick: function (e) {
            e.stopPropagation();
            if (!confirm("Delete “" + itemTitle(item, def, i) + "”?")) return;
            list.splice(i, 1); setDirty(true); redraw();
          } }, ["✕"])
        ])
      ]);
      head.onclick = function () { card.classList.toggle("open"); };

      var body = h("div", { class: "item-body" }, renderFields(item, def.fields));
      // keep the header label in sync with the first text field
      body.addEventListener("input", refreshTitle);

      card.appendChild(head);
      card.appendChild(body);
      wrap.appendChild(card);
    });

    wrap.appendChild(h("button", { class: "btn", style: "margin-top:6px", onclick: function () {
      var blank = {};
      def.fields.forEach(function (f) {
        blank[f.k] = f.t === "list" || f.t === "objlist" ? [] : f.t === "number" ? 50 : "";
      });
      list.push(blank);
      setDirty(true);
      redraw();
      setTimeout(function () {
        var cards = document.querySelectorAll(".pane .item");
        var last = cards[cards.length - 1];
        if (last) { last.classList.add("open"); last.scrollIntoView({ behavior: "smooth", block: "center" }); }
      }, 10);
    } }, ["+ Add entry"]));

    return wrap;
  }

  function itemTitle(item, def, i) {
    var t = (item[def.title || def.fields[0].k] || "").toString().trim();
    var s = def.sub ? (item[def.sub] || "").toString().trim() : "";
    if (!t && !s) return "Untitled entry " + (i + 1);
    return t + (s ? "  ·  " + s : "");
  }

  /* ---------- panes ---------- */
  function openPane(id) {
    current = id;
    var def = SCHEMA.filter(function (s) { return s.id === id; })[0];
    $("#pane-title").textContent = def.label;
    document.querySelectorAll("#snav button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.id === id);
    });

    var pane = $("#pane");
    pane.innerHTML = "";

    if (def.type === "object") {
      if (!data[id] || typeof data[id] !== "object") data[id] = {};
      renderFields(data[id], def.fields).forEach(function (n) { pane.appendChild(n); });
    } else {
      if (!Array.isArray(data[id])) data[id] = [];
      var host = h("div", {});
      var redraw = function () {
        host.innerHTML = "";
        host.appendChild(arrayEditor(data[id], def, redraw));
        buildNav();
      };
      redraw();
      pane.appendChild(host);
    }
    pane.scrollIntoView({ block: "start" });
  }

  function buildNav() {
    var nav = $("#snav");
    nav.innerHTML = "";
    SCHEMA.forEach(function (s) {
      var n = s.type === "array" ? (Array.isArray(data[s.id]) ? data[s.id].length : 0) : "";
      nav.appendChild(h("button", { "data-id": s.id, class: s.id === current ? "active" : "",
        onclick: function () { openPane(s.id); } }, [
        h("span", {}, [s.label]),
        n !== "" ? h("span", { class: "n" }, [String(n)]) : null
      ]));
    });
  }

  /* ---------- load / save ---------- */
  function load() {
    status("Loading…");
    return getFile(CONTENT_PATH).then(function (res) {
      baseSha = res.sha;
      data = JSON.parse(b64dec(res.content));
      setDirty(false);
      buildNav();
      openPane(current || SCHEMA[0].id);
      status("Loaded from " + S.repo + " (" + S.branch + ")");
    });
  }

  function save() {
    if (!data) return;
    var btn = $("#btn-save");
    btn.disabled = true;
    status("Checking for remote changes…");

    getFile(CONTENT_PATH).then(function (res) {
      if (res.sha !== baseSha) {
        if (!confirm("content.json has changed on GitHub since you loaded it.\n\nPublishing now will overwrite those changes. Continue?")) {
          throw new Error("__cancel__");
        }
      }
      data.updatedAt = new Date().toISOString();
      var json = JSON.stringify(data, null, 2) + "\n";
      status("Publishing…");
      return putFile(CONTENT_PATH, b64enc(json), res.sha, "admin: update résumé content");
    }).then(function (res) {
      baseSha = res.content.sha;
      setDirty(false);
      status("Published. The live site rebuilds in about a minute.", "ok");
      btn.disabled = false;
    }).catch(function (err) {
      btn.disabled = false;
      if (err.message === "__cancel__") { status("Cancelled."); return; }
      status("Failed: " + err.message, "err");
    });
  }

  /* ---------- session ---------- */
  function startApp() {
    $("#gate").style.display = "none";
    $("#app").classList.add("on");
    $("#brand-repo").textContent = S.repo + " · " + S.branch;
    load().catch(function (err) {
      status("Failed: " + err.message, "err");
      alert("Could not load content.json:\n\n" + err.message);
      signOut();
    });
  }

  function signOut() {
    if (isDirty && !confirm("You have unsaved changes. Sign out anyway?")) return;
    try { localStorage.removeItem(LS); sessionStorage.removeItem(LS); } catch (e) {}
    setDirty(false);
    location.reload();
  }

  function gateMsg(text, kind) {
    var m = $("#gate-msg");
    m.textContent = text;
    m.className = "msg show " + (kind || "err");
  }

  $("#btn-login").onclick = function () {
    var repo = $("#in-repo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    var branch = $("#in-branch").value.trim() || "main";
    var token = $("#in-token").value.trim();

    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return gateMsg("Repository must look like username/repository.");
    if (!token) return gateMsg("Paste your GitHub access token.");

    S = { repo: repo, branch: branch, token: token };
    var btn = $("#btn-login");
    btn.disabled = true; btn.textContent = "Checking…";

    getFile(CONTENT_PATH).then(function () {
      var store = $("#in-remember").checked ? localStorage : sessionStorage;
      try { store.setItem(LS, JSON.stringify(S)); } catch (e) {}
      startApp();
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = "Sign in";
      gateMsg(err.message);
    });
  };

  $("#in-token").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("#btn-login").click();
  });

  $("#btn-logout").onclick = signOut;
  $("#btn-save").onclick = save;
  $("#btn-reload").onclick = function () {
    if (isDirty && !confirm("Discard your unsaved changes and reload from GitHub?")) return;
    load().catch(function (err) { status("Failed: " + err.message, "err"); });
  };

  /* restore session */
  (function () {
    var raw = null;
    try { raw = localStorage.getItem(LS) || sessionStorage.getItem(LS); } catch (e) {}
    if (!raw) return;
    try {
      var s = JSON.parse(raw);
      if (s && s.repo && s.token) {
        S = s;
        $("#in-repo").value = s.repo;
        $("#in-branch").value = s.branch || "main";
        startApp();
      }
    } catch (e) {}
  })();
})();
