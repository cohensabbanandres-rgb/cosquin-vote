/const CosquinApp = (() => {
  const PEOPLE = ["Andy","Brian","Cori","Gon","Marcos","Matu","Nacho","Fran"];
  const WEIGHTS = { must:4, would:3, opt:2, no:0 };
  const LABELS = [
    { key:"must", label:"Must (4)" },
    { key:"would", label:"Would (3)" },
    { key:"opt",  label:"Optional (2)" },
    { key:"no",   label:"No (0)" }
  ];

  function qs(name){ return new URLSearchParams(location.search).get(name) || ""; }

  // --- CSV parsing (simple + works for your format) ---
  function parseCSV(text){
  // Detect delimiter ; vs ,
  const delimiter = text.includes(";") ? ";" : ",";

  const rows = [];
  let cur = "", row = [], inQ=false;

  for (let i=0;i<text.length;i++){
    const ch = text[i], nx = text[i+1];

    if (ch === '"' && inQ && nx === '"'){ cur += '"'; i++; continue; }
    if (ch === '"'){ inQ = !inQ; continue; }

    if (ch === delimiter && !inQ){
      row.push(cur.trim()); cur=""; continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQ){
      if (ch === "\r" && nx === "\n") i++;
      row.push(cur.trim()); cur="";
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  if (cur.length || row.length){ row.push(cur.trim()); rows.push(row); }

  if (!rows.length) throw new Error("CSV vacío");

  const header = rows[0].map(x => (x||"").trim());
  const stages = header.slice(1).filter(Boolean);

  const blocks = [];
  for (let r=1;r<rows.length;r++){
    const time = (rows[r][0]||"").trim();
    if (!time) continue;

    const bands = [];
    for (let c=1;c<rows[r].length;c++){
      const band = (rows[r][c]||"").trim();
      const stage = stages[c-1];
      if (band && stage) bands.push({ time, stage, band });
    }
    blocks.push({ time, bands });
  }

  return { stages, blocks };
}

    if ((ch === '\n' || ch === '\r') && !inQ){
      if (ch === '\r' && nx === '\n') i++;
      row.push(cur.trim());
      cur="";
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  if (cur.length || row.length){
    row.push(cur.trim());
    rows.push(row);
  }

  if (!rows.length) throw new Error("CSV vacío");

  const header = rows[0].map(h => h.trim());
  const stages = header.slice(1);

  const blocks = [];
  for (let r=1;r<rows.length;r++){
    const time = rows[r][0];
    if (!time) continue;

    const bands = [];
    for (let c=1;c<rows[r].length;c++){
      const band = rows[r][c];
      if (band){
        bands.push({
          time,
          stage: stages[c-1],
          band
        });
      }
    }
    blocks.push({ time, bands });
  }

  return { stages, blocks };
}

      cur += ch;
    }
    if (cur.length || row.length){ row.push(cur); rows.push(row); }

    const header = rows[0].map(h => (h || "").trim());

    // Acepta "time", "hora", "Hora", etc. y si viene vacío igual usa col 0 como tiempo
    const first = (header[0] || "").toLowerCase();
  const header = rows[0].map(h => (h || "").trim());
const stages = header.slice(1);

const stages = header.slice(1);

    const blocks = [];

    for (let r=1;r<rows.length;r++){
      const time = (rows[r][0] || "").trim();
      if (!time) continue;
      const bands = [];
      for (let c=1;c<header.length;c++){
        const stage = stages[c-1];
        const band = (rows[r][c] || "").trim();
        if (band) bands.push({ time, stage, band });
      }
      blocks.push({ time, bands });
    }

    return { stages, blocks };
  }

  async function let data;
try {
 let data;
try {
  data = await loadDay(day);
} catch (e) {
  const err = document.getElementById("error");
  err.style.display = "block";
  err.textContent = "Error cargando CSV: " + (e?.message || e);
  console.error(e);
  return;
}
renderGrid(grid, data, day, votes, false);


  // Vote storage structure:
  // votes[day][time][stage][band] = one of "must/would/opt/no"
  function emptyVotes(){ return { "14":{}, "15":{} }; }

  function setVote(votes, day, time, stage, band, key){
    votes[day] ??= {};
    votes[day][time] ??= {};
    votes[day][time][stage] ??= {};
    votes[day][time][stage][band] = key;
  }
  function getVote(votes, day, time, stage, band){
    return votes?.[day]?.[time]?.[stage]?.[band] ?? "no";
  }

  // Encode/decode votes into URL-safe string (base64 of JSON)
  function encodeVotes(obj){
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
  }
  function decodeVotes(str){
    // restore padding
    let s = str.replaceAll("-","+").replaceAll("_","/");
    while (s.length % 4) s += "=";
    const json = decodeURIComponent(escape(atob(s)));
    return JSON.parse(json);
  }

  // --- Rendering vote grid ---
  function renderGrid(container, data, day, votes, locked=false){
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    const thTime = document.createElement("th");
    thTime.textContent = "Time";
    trh.appendChild(thTime);
    data.stages.forEach(s => {
      const th = document.createElement("th");
      th.textContent = s;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    data.blocks.forEach(block => {
      const tr = document.createElement("tr");
      const tdTime = document.createElement("td");
      tdTime.className = "time";
      tdTime.textContent = block.time;
      tr.appendChild(tdTime);

      data.stages.forEach(stage => {
        const td = document.createElement("td");
        const bandsHere = block.bands.filter(b => b.stage === stage);

        if (!bandsHere.length) {
          td.innerHTML = `<div class="small">—</div>`;
        } else {
          bandsHere.forEach(({band, time}) => {
            const wrap = document.createElement("div");
            wrap.style.marginBottom = "10px";

            const bn = document.createElement("div");
            bn.className = "band";
            bn.textContent = band;
            wrap.appendChild(bn);

            const row = document.createElement("div");
            row.className = "voteRow";

            LABELS.forEach(({key,label}) => {
              const pill = document.createElement("div");
              pill.className = "pill";
              pill.textContent = label;

              const cur = getVote(votes, day, time, stage, band);
              if (cur === key) pill.classList.add("active");

              if (!locked) {
                pill.onclick = () => {
                  setVote(votes, day, time, stage, band, key);
                  // re-render quickly: toggle pills in this row only
                  row.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
                  pill.classList.add("active");
                };
              } else {
                pill.style.cursor = "default";
              }

              row.appendChild(pill);
            });

            wrap.appendChild(row);
            td.appendChild(wrap);
          });
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.innerHTML = "";
    const shell = document.createElement("div");
    shell.className = "grid";
    shell.appendChild(table);
    container.appendChild(shell);
  }

  // --- Scheduling ---
  function scheduleForGroup(data, day, groupVotesByPerson){
    // Returns chosen band per time, and scores
    const chosen = []; // {time, band, stage, scoreBreakdown}
    const perPerson = {};
    Object.keys(groupVotesByPerson).forEach(p => perPerson[p] = 0);

    data.blocks.forEach(block => {
      // Gather all candidates at this time
      const candidates = [];
      block.bands.forEach(({time, stage, band}) => {
        let total = 0, must=0, would=0;
        for (const [person, votes] of Object.entries(groupVotesByPerson)){
          const v = getVote(votes, day, time, stage, band);
          const w = WEIGHTS[v] ?? 0;
          total += w;
          if (v === "must") must++;
          if (v === "would") would++;
        }
        candidates.push({time, stage, band, total, must, would});
      });

      candidates.sort((a,b) =>
        (b.total - a.total) ||
        (b.must - a.must) ||
        (b.would - a.would) ||
        (a.band.localeCompare(b.band))
      );

      const pick = candidates[0];
      chosen.push(pick);

      // Add per-person contribution (what they voted for the chosen band)
      for (const [person, votes] of Object.entries(groupVotesByPerson)){
        const v = getVote(votes, day, pick.time, pick.stage, pick.band);
        perPerson[person] += (WEIGHTS[v] ?? 0);
      }
    });

    const totalScore = Object.values(perPerson).reduce((a,b)=>a+b,0);
    return { chosen, perPerson, totalScore };
  }

  function allSplits(people){
    // Unique splits into A & B (avoid duplicates by forcing first person into A)
    const first = people[0];
    const rest = people.slice(1);
    const splits = [];
    const n = rest.length;
    for (let mask=0; mask < (1<<n); mask++){
      const A = [first];
      const B = [];
      for (let i=0;i<n;i++){
        if (mask & (1<<i)) A.push(rest[i]); else B.push(rest[i]);
      }
      splits.push({A,B});
    }
    return splits;
  }

  function bestTwoGroupSplit(data, day, votesByPerson){
    const splits = allSplits(Object.keys(votesByPerson));
    let best = null;

    for (const s of splits){
      const vA = {}; s.A.forEach(p => vA[p] = votesByPerson[p]);
      const vB = {}; s.B.forEach(p => vB[p] = votesByPerson[p]);

      const resA = scheduleForGroup(data, day, vA);
      const resB = scheduleForGroup(data, day, vB);
      const total = resA.totalScore + resB.totalScore;

      if (!best || total > best.total){
        best = { split:s, resA, resB, total };
      }
    }
    return best;
  }

  // --- Vote page init ---
  async function initVotePage(){
    const day = qs("day");
    const name = qs("name");

    if (!["14","15"].includes(day)) { alert("Missing day"); location.href="index.html"; return; }
    if (!PEOPLE.includes(name)) { alert("Pick a valid name on Home"); location.href="index.html"; return; }

    document.getElementById("title").textContent = `Vote – Day ${day} (${name})`;
    const data = await loadDay(day);

    const votes = emptyVotes();
    const grid = document.getElementById("grid");
    renderGrid(grid, data, day, votes, false);

    const submitBtn = document.getElementById("submit");
    const copyBtn = document.getElementById("copy");
    const share = document.getElementById("share");

    submitBtn.onclick = () => {
      // lock + generate link
      submitBtn.disabled = true;
      renderGrid(grid, data, day, votes, true);

      const payload = { name, votes };
      const encoded = encodeVotes(payload);
      const link = `${location.origin}${location.pathname.replace("vote.html","results.html")}#v=${encoded}`;
      share.style.display = "block";
      share.value = link;
      copyBtn.style.display = "inline-block";
      alert("Locked! Copy your share link and send it to the group.");
    };

    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(share.value);
      alert("Copied!");
    };
  }

  // --- Results page init ---
  async function initResultsPage(){
    // Allow opening a single share link directly (hash)
    const hash = location.hash.startsWith("#v=") ? location.hash.slice(3) : "";

    const linksEl = document.getElementById("links");
    if (hash) {
      const link = location.href;
      linksEl.value = link + "\n";
    }

    document.getElementById("compute").onclick = async () => {
      const lines = linksEl.value.split("\n").map(s=>s.trim()).filter(Boolean);
      const votesByPerson = {};
      for (const line of lines){
        const m = line.match(/#v=([A-Za-z0-9\-_]+)/);
        if (!m) continue;
        const payload = decodeVotes(m[1]);
        if (!payload?.name || !payload?.votes) continue;
        votesByPerson[payload.name] = payload.votes;
      }

      const missing = PEOPLE.filter(p => !votesByPerson[p]);
      if (missing.length) {
        alert("Missing submissions from: " + missing.join(", "));
        return;
      }

      const out = document.getElementById("out");
      out.innerHTML = "";

      for (const day of ["14","15"]){
        const data = await
async function loadDay(day){
    const path = day === "14" ? "data/day14.csv" : "data/day15.csv";
    const res = await fetch(path);
    if (!res.ok) throw new Error("No pude cargar " + path + " (HTTP " + res.status + ")");
    const text = await res.text();
    return parseCSV(text);
}


        const all = scheduleForGroup(data, day, votesByPerson);
        const bestSplit = bestTwoGroupSplit(data, day, votesByPerson);

        out.appendChild(renderScheduleCard(`Day ${day} — Whole Crew`, all));
        out.appendChild(renderSplitCard(`Day ${day} — Group A / B (best split)`, bestSplit));
      }
    };
  }

  function renderScheduleCard(title, res){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h2>${title}</h2>
      <div class="small">Total happiness: <b>${res.totalScore}</b></div>`;

    const per = Object.entries(res.perPerson).sort((a,b)=>b[1]-a[1]);
    const ul = document.createElement("div");
    ul.className = "small";
    ul.innerHTML = "<b>Per person:</b> " + per.map(([p,s])=>`${p}: ${s}`).join(" · ");
    card.appendChild(ul);

    const tbl = document.createElement("table");
    tbl.innerHTML = `<thead><tr><th>Time</th><th>Chosen</th><th>Stage</th><th>Score</th></tr></thead>`;
    const tb = document.createElement("tbody");
    res.chosen.forEach(x=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="time">${x.time}</td><td>${x.band}</td><td>${x.stage}</td><td>${x.total}</td>`;
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    const shell = document.createElement("div");
    shell.className = "grid";
    shell.appendChild(tbl);
    card.appendChild(shell);

    return card;
  }

  function renderSplitCard(title, best){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h2>${title}</h2>
      <div class="small">Combined happiness: <b>${best.total}</b></div>
      <div class="small"><b>Group A:</b> ${best.split.A.join(", ")}</div>
      <div class="small"><b>Group B:</b> ${best.split.B.join(", ")}</div>`;

    card.appendChild(renderScheduleCard("Group A schedule", best.resA));
    card.appendChild(renderScheduleCard("Group B schedule", best.resB));
    return card;
  }

  return { initVotePage, initResultsPage };
})();

