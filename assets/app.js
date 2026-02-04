/* Cosquin Rock Planner – standalone, no services
   Exposes: window.CosquinApp = { initVotePage, initResultsPage }
*/
(function () {
  const WEIGHTS = { must: 4, would: 3, optional: 2, no: 0 };
  const LEVELS = [
    { key: "must", label: "Must see" },
    { key: "would", label: "Would like" },
    { key: "optional", label: "Optional" },
    { key: "no", label: "No" },
  ];

  // ---------- small utils ----------
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  function normalizeBandKey(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function getParams() {
    const u = new URL(window.location.href);
    const params = {};
    u.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  // base64url helpers
  function b64urlEncode(str) {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  function b64urlDecode(b64url) {
    const b64 =
      b64url.replaceAll("-", "+").replaceAll("_", "/") +
      "===".slice((b64url.length + 3) % 4);
    const str = decodeURIComponent(escape(atob(b64)));
    return str;
  }

  function showError(msg) {
    const el = qs("#error");
    if (!el) return;
    el.style.display = "block";
    el.textContent = msg;
  }

  // ---------- CSV loading / parsing ----------
  async function loadDay(day) {
    const path = day === "14" ? "data/day14.csv" : "data/day15.csv";
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`No pude cargar ${path} (HTTP ${res.status})`);
    const text = await res.text();
    return parseCSV(text);
  }

  function parseCSV(text) {
    // Detect delimiter: if there are semicolons, use ; (Google Sheets / Excel ES)
    const delimiter = text.includes(";") ? ";" : ",";

    // minimal CSV parser with quotes
    const rows = [];
    let cur = "";
    let row = [];
    let inQ = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const nx = text[i + 1];

      if (ch === '"' && inQ && nx === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === delimiter && !inQ) {
        row.push(cur.trim());
        cur = "";
        continue;
      }
      if ((ch === "\n" || ch === "\r") && !inQ) {
        if (ch === "\r" && nx === "\n") i++;
        row.push(cur.trim());
        cur = "";
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
        continue;
      }
      cur += ch;
    }
    if (cur.length || row.length) {
      row.push(cur.trim());
      if (row.some((c) => c !== "")) rows.push(row);
    }
    if (!rows.length) throw new Error("CSV vacío");

    const header = rows[0].map((h) => (h || "").trim());
    const timeHeader = header[0] || "time";
    const stages = header.slice(1).filter(Boolean);

    const blocks = [];
    for (let r = 1; r < rows.length; r++) {
      const t = (rows[r][0] || "").trim();
      if (!t) continue;

      const cells = [];
      for (let c = 1; c < stages.length + 1; c++) {
        const band = (rows[r][c] || "").trim();
        const stage = stages[c - 1];
        cells.push({ time: t, stage: stage || `Stage ${c}`, band });
      }
      blocks.push({ time: t, cells });
    }

    return { timeHeader, stages, blocks };
  }

  // ---------- Build "band runs" + lookup ----------
  // Rule:
  // - "" (blank) means "continuation of previous band" for that stage
  // - "-" or "—" means explicitly empty (breaks continuation)
  function buildModelForDay(day, dayData) {
    const stages = dayData.stages;
    const blocks = dayData.blocks;
    const times = blocks.map((b) => b.time);

    function rawBandAt(timeIndex, stageIndex) {
      const cell =
        (blocks[timeIndex] && blocks[timeIndex].cells[stageIndex]) || null;
      return ((cell && cell.band) || "").trim();
    }

    // compute effective bands with continuation on blanks
    const effective = Array.from({ length: stages.length }, () =>
      new Array(times.length).fill("")
    );

    for (let s = 0; s < stages.length; s++) {
      let last = "";
      for (let i = 0; i < times.length; i++) {
        const raw = rawBandAt(i, s);
        const isExplicitEmpty = raw === "-" || raw === "—";
        if (isExplicitEmpty) {
          effective[s][i] = ""; // empty cell, breaks run
          last = "";
          continue;
        }
        if (raw) {
          effective[s][i] = raw;
          last = raw;
        } else {
          // blank: continuation
          effective[s][i] = last;
        }
      }
    }

    // build runs per stage (merge consecutive identical effective band)
    const lookup = {}; // lookup[stageIndex][timeIndex] = { run, isStart, runKey }
    const allRunKeys = []; // list of runKey for all band-runs (for defaulting)
    const runInfoByKey = {}; // runKey -> { band, stageIndex, startIndex, span }

    for (let s = 0; s < stages.length; s++) {
      lookup[s] = {};
      let current = null;

      for (let i = 0; i < times.length; i++) {
        const band = (effective[s][i] || "").trim();
        const empty = !band;
        const bandKey = empty ? "" : normalizeBandKey(band);

        if (!current) {
          current = { band, bandKey, empty, startIndex: i, span: 1 };
        } else {
          const same = !empty && !current.empty && bandKey === current.bandKey;
          if (same) {
            current.span += 1;
          } else {
            // finalize previous
            const runKey = makeRunKey(day, s, current.startIndex, current.bandKey, current.empty);
            writeRunToLookup(s, current, runKey);
            current = { band, bandKey, empty, startIndex: i, span: 1 };
          }
        }
      }

      if (current) {
        const runKey = makeRunKey(day, s, current.startIndex, current.bandKey, current.empty);
        writeRunToLookup(s, current, runKey);
      }
    }

    function makeRunKey(dayStr, stageIndex, startIndex, bandKey, empty) {
      if (empty) return `${dayStr}__${stageIndex}__${startIndex}__empty`;
      return `${dayStr}__${stageIndex}__${startIndex}__${bandKey}`;
    }

    function writeRunToLookup(stageIndex, run, runKey) {
      // store only non-empty runs for default voting and scoring
      if (!run.empty) {
        allRunKeys.push(runKey);
        runInfoByKey[runKey] = {
          band: run.band,
          stageIndex,
          startIndex: run.startIndex,
          span: run.span,
        };
      }

      for (let i = run.startIndex; i < run.startIndex + run.span; i++) {
        lookup[stageIndex][i] = {
          run,
          runKey,
          isStart: i === run.startIndex,
        };
      }
    }

    return { stages, blocks, times, lookup, allRunKeys, runInfoByKey };
  }

  // ---------- Voting (grid with rowspan) ----------
  function renderGrid(day, dayData, votes, locked) {
    const holder = qs("#grid");
    if (!holder) return;

    const model = buildModelForDay(day, dayData);
    const { stages, blocks, lookup, allRunKeys } = model;

    // expose keys so submit can default missing to "no"
    window.__COSQUIN_ALL_RUN_KEYS__ = allRunKeys;

    let html = `<div class="grid"><table><thead><tr>`;
    html += `<th class="time">${esc(dayData.timeHeader || "time")}</th>`;
    for (const st of stages) html += `<th>${esc(st)}</th>`;
    html += `</tr></thead><tbody>`;

    for (let timeIndex = 0; timeIndex < blocks.length; timeIndex++) {
      const b = blocks[timeIndex];
      html += `<tr>`;
      html += `<td class="time">${esc(b.time)}</td>`;

      for (let s = 0; s < stages.length; s++) {
        const hit = lookup[s][timeIndex];

        // if nothing defined, show empty cell
        if (!hit) {
          html += `<td><div class="small">—</div></td>`;
          continue;
        }

        // if inside a rowspan but not the start, skip rendering a <td>
        if (!hit.isStart) continue;

        const run = hit.run;
        const runKey = hit.runKey;

        // empty run
        if (run.empty) {
          html += `<td rowspan="${run.span}"><div class="small">—</div></td>`;
          continue;
        }

        const selected = votes[runKey] || "";

        html += `<td rowspan="${run.span}">`;
        html += `<div class="band">${esc(run.band)}</div>`;
        html += `<div class="voteRow" data-key="${esc(runKey)}">`;

        for (const lvl of LEVELS) {
          const active = selected === lvl.key ? "pill active" : "pill";
          const dis = locked ? `data-locked="1"` : "";
          html += `<span class="${active}" data-level="${lvl.key}" ${dis}>${esc(
            lvl.label
          )}</span>`;
        }

        html += `</div></td>`;
      }

      html += `</tr>`;
    }

    html += `</tbody></table></div>`;
    holder.innerHTML = html;

    // click handlers
    qsa(".voteRow .pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        if (locked) return;
        if (pill.getAttribute("data-locked") === "1") return;

        const row = pill.closest(".voteRow");
        const k = row.getAttribute("data-key");
        const lvl = pill.getAttribute("data-level");

        votes[k] = lvl;

        row.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
      });
    });
  }

  function lockUI() {
    qsa(".pill").forEach((p) => p.setAttribute("data-locked", "1"));
    const btn = qs("#submit");
    if (btn) btn.disabled = true;
  }

  function generateShareLink(payload) {
    const encoded = b64urlEncode(JSON.stringify(payload));
    const u = new URL(window.location.href);
    u.searchParams.set("share", encoded);
    return u.toString();
  }

  function tryLoadShare() {
    const params = getParams();
    if (!params.share) return null;
    try {
      const json = b64urlDecode(params.share);
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  // ---------- Results (force plan + A/B) ----------
  function scoreOf(levelKey) {
    return WEIGHTS[levelKey] != null ? WEIGHTS[levelKey] : 0;
  }

  function computePlans(day, dayData, allPeopleVotes) {
    const model = buildModelForDay(day, dayData);
    const { times, stages, lookup, runInfoByKey } = model;

    // For each time slot, build options:
    // option = choose a stage at that timeIndex
    // score = sum of each person's vote for that band-runKey
    const perTimeOptions = times.map((t, timeIndex) => {
      const options = [];

      for (let s = 0; s < stages.length; s++) {
        const hit = lookup[s][timeIndex];

        // if empty/no band, score = 0
        if (!hit || hit.run.empty) {
          options.push({
            time: t,
            stage: stages[s],
            band: "",
            total: 0,
            runKey: null,
          });
          continue;
        }

        const runKey = hit.runKey;
        const band = runInfoByKey[runKey] ? runInfoByKey[runKey].band : hit.run.band;

        let total = 0;

        for (const [person, votes] of Object.entries(allPeopleVotes)) {
          const lvl = votes[runKey] || "no";
          total += scoreOf(lvl);
        }

        options.push({
          time: t,
          stage: stages[s],
          band,
          total,
          runKey,
        });
      }

      options.sort((a, b) => b.total - a.total);
      return options;
    });

    // Force plan: best per time
    const force = perTimeOptions.map((opts) => opts[0]);

    // Candidates: swap 1 slot to 2nd best
    const candidates = [];
    for (let i = 0; i < perTimeOptions.length; i++) {
      const opts = perTimeOptions[i];
      if (opts.length < 2) continue;
      const cand = force.slice();
      cand[i] = opts[1];
      candidates.push(cand);
    }

    function scheduleScore(schedule) {
      return schedule.reduce((sum, o) => sum + (o && o.total ? o.total : 0), 0);
    }

    candidates.sort((a, b) => scheduleScore(b) - scheduleScore(a));

    const A = candidates[0] || force;
    const B = candidates[1] || force;

    return { force, A, B };
  }

  function renderPlan(title, plan) {
    let total = 0;
    for (const o of plan) total += o.total || 0;

    let html = `<div class="card"><h2>${esc(title)}</h2>`;
    html += `<div class="small">Score total: ${total}</div>`;
    html += `<div class="grid"><table><thead><tr><th class="time">Hora</th><th>Escenario</th><th>Banda</th></tr></thead><tbody>`;

    for (const o of plan) {
      html += `<tr>`;
      html += `<td class="time">${esc(o.time)}</td>`;
      html += `<td>${esc(o.stage)}</td>`;
      html += `<td>${esc(o.band || "—")}</td>`;
      html += `</tr>`;
    }

    html += `</tbody></table></div></div>`;
    return html;
  }

  // ---------- Public init functions ----------
  async function initVotePage() {
    const params = getParams();
    const day = params.day || "14";
    const name = params.name || "Anon";

    const title = qs("#title");
    if (title) title.textContent = `Vote – Day ${day} (${name})`;

    // load data
    let dayData;
    try {
      dayData = await loadDay(day);
    } catch (e) {
      showError(e && e.message ? e.message : String(e));
      return;
    }

    // votes object
    let votes = {};

    // if share exists, load and lock
    const shared = tryLoadShare();
    let locked = false;
    if (shared && shared.votes && shared.day === day) {
      votes = shared.votes;
      locked = true;
    }

    renderGrid(day, dayData, votes, locked);

    if (locked) lockUI();

    // submit button
    const submit = qs("#submit");
    const copyBtn = qs("#copy");
    const shareBox = qs("#share");

    if (submit) {
      submit.addEventListener("click", () => {
        // ✅ Default any missing band-votes to "no"
        const runKeys = window.__COSQUIN_ALL_RUN_KEYS__ || [];
        runKeys.forEach((k) => {
          if (!votes[k]) votes[k] = "no";
        });

        // lock
        lockUI();

        const payload = { day, name, votes };
        const link = generateShareLink(payload);

        if (shareBox) {
          shareBox.style.display = "block";
          shareBox.value = link;
        }
        if (copyBtn) {
          copyBtn.style.display = "inline-block";
          copyBtn.onclick = async () => {
            try {
              await navigator.clipboard.writeText(link);
              copyBtn.textContent = "Copied!";
              setTimeout(() => (copyBtn.textContent = "Copy Share Link"), 1200);
            } catch {
              if (shareBox) {
                shareBox.focus();
                shareBox.select();
              }
            }
          };
        }
      });
    }
  }

  async function initResultsPage() {
    const linksEl = qs("#links");
    const btn = qs("#compute");
    const out = qs("#out") || document.body;

    async function compute() {
      const text = ((linksEl && linksEl.value) || "").trim();
      if (!text) {
        showError("Pegá los links (uno por línea).");
        return;
      }

      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const byDay = { "14": {}, "15": {} };

      for (const line of lines) {
        try {
          const u = new URL(line);
          const share = u.searchParams.get("share");
          if (!share) continue;
          const payload = JSON.parse(b64urlDecode(share));
          if (!payload || !payload.day || !payload.name || !payload.votes) continue;
          if (payload.day === "14" || payload.day === "15") {
            byDay[payload.day][payload.name] = payload.votes;
          }
        } catch {
          // ignore bad lines
        }
      }

      let html = "";

      for (const day of ["14", "15"]) {
        let dayData;
        try {
          dayData = await loadDay(day);
        } catch (e) {
          html += `<div class="card"><h2>Day ${esc(
            day
          )}</h2><div class="error">No pude cargar day${esc(day)}.csv</div></div>`;
          continue;
        }

        const people = Object.keys(byDay[day]);
        html += `<div class="card"><h1>Results — Day ${esc(
          day
        )}</h1><div class="small">Votos cargados: ${people.length}</div></div>`;

        if (!people.length) {
          html += `<div class="card"><div class="small">No hay votos para este día.</div></div>`;
          continue;
        }

        const plans = computePlans(day, dayData, byDay[day]);

        html += renderPlan("Force plan (best total happiness)", plans.force);
        html += renderPlan("Plan A (best alternative)", plans.A);
        html += renderPlan("Plan B (second alternative)", plans.B);
      }

      out.innerHTML = html;
    }

    if (btn) btn.addEventListener("click", compute);
    if (linksEl && linksEl.value.trim()) compute();
  }

  // ✅ Export to window
  window.CosquinApp = { initVotePage, initResultsPage };
})();
