// ----- ERA DEFINITIONS & COLORS -----

const eras = {
  all: { key: "all", label: "All Eras (1970–2015)", start: 1970, end: 2015 },
  expansion: {
    key: "expansion",
    label: "Expansion Era (1970–1992)",
    start: 1970,
    end: 1992
  },
  steroid: {
    key: "steroid",
    label: "Steroid Era (1993–2004)",
    start: 1993,
    end: 2004
  },
  modern: {
    key: "modern",
    label: "Modern Era (2005–2015)",
    start: 2005,
    end: 2015
  }
};

const eraColors = {
  expansion: "#3b82f6",
  steroid: "#ef4444",
  modern: "#22c55e",
  all: "#6b7280"
};

// ----- STATE -----

let currentView = "hitters";
let currentEra = "all";

let runsSeries = [];
let ttoSeries = [];
let opsSeries = [];
let pitchSeries = [];

const hitterEraStats = {
  all: new Map(),
  expansion: new Map(),
  steroid: new Map(),
  modern: new Map()
};

const pitcherEraStats = {
  all: new Map(),
  expansion: new Map(),
  steroid: new Map(),
  modern: new Map()
};

const btnHitters = document.getElementById("view-hitters");
const btnPitchers = document.getElementById("view-pitchers");
const btnEraAll = document.getElementById("era-all");
const btnEraExpansion = document.getElementById("era-expansion");
const btnEraSteroid = document.getElementById("era-steroid");
const btnEraModern = document.getElementById("era-modern");

const scatterTitle = document.getElementById("player-scatter-title");
const tooltip = d3.select("#tooltip");

// ----- UTILS -----

function eraKeyForYear(y) {
  if (y < 1970 || y > 2015) return null;
  if (y <= 1992) return "expansion";
  if (y <= 2004) return "steroid";
  return "modern";
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function initChart(containerSelector, height) {
  const container = document.querySelector(containerSelector);
  const bbox = container.getBoundingClientRect();
  const width = bbox.width || 600;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const margin = { top: 30, right: 20, bottom: 40, left: 60 };

  return {
    svg,
    g: svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`),
    width,
    height,
    innerWidth: width - margin.left - margin.right,
    innerHeight: height - margin.top - margin.bottom,
    margin
  };
}

function shadeEras(g, x, innerHeight) {
  const eraList = [eras.expansion, eras.steroid, eras.modern];
  eraList.forEach(e => {
    g.append("rect")
      .attr("x", x(e.start))
      .attr("y", 0)
      .attr("width", x(e.end) - x(e.start))
      .attr("height", innerHeight)
      .attr("fill",
        e.key === "expansion" ? "rgba(59,130,246,0.10)" :
        e.key === "steroid"   ? "rgba(239,68,68,0.10)" :
                                "rgba(34,197,94,0.10)"
      );
  });
}

function addEraLegend(g, innerWidth) {
  const legend = g.append("g")
    .attr("transform", `translate(${innerWidth - 130},5)`);

  const items = [
    { label: "Expansion Era", color: "rgba(59,130,246,0.10)" },
    { label: "Steroid Era",  color: "rgba(239,68,68,0.10)" },
    { label: "Modern Era",   color: "rgba(34,197,94,0.10)" }
  ];

  items.forEach((d, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(0,${i * 18})`);
    row.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", d.color)
      .attr("stroke", "#94a3b8");
    row.append("text")
      .attr("x", 18)
      .attr("y", 10)
      .attr("font-size", "0.75rem")
      .text(d.label);
  });
}

// ----- AGG HELPERS -----

function getTopHittersForEra(eraKey, limit) {
  const map = hitterEraStats[eraKey];
  const arr = [];
  map.forEach(agg => {
    const AB = agg.AB || 0;
    const H = agg.H || 0;
    const BB = agg.BB || 0;
    const SO = agg.SO || 0;
    const HBP = agg.HBP || 0;
    const SF = agg.SF || 0;
    const DBL = agg.DBL || 0;
    const TRP = agg.TRP || 0;
    const HR = agg.HR || 0;

    const PA = AB + BB + HBP + SF;
    if (PA < 300) return;

    const AVG = AB > 0 ? H / AB : NaN;
    const hrRate = PA > 0 ? HR / PA : NaN;
    const sng = H - DBL - TRP - HR;
    const TB = (sng > 0 ? sng : 0) + 2 * DBL + 3 * TRP + 4 * HR;
    const SLG = AB > 0 ? TB / AB : NaN;
    const obpDen = AB + BB + HBP + SF;
    const OBP = obpDen > 0 ? (H + BB + HBP) / obpDen : NaN;
    const OPS = OBP + SLG;

    if (!isFinite(OPS)) return;

    arr.push({
      era: eraKey,
      playerID: agg.playerID,
      name: agg.name,
      AVG,
      HR_rate: hrRate,
      OPS,
      PA
    });
  });

  arr.sort((a, b) => b.OPS - a.OPS);
  return arr.slice(0, limit);
}

function getTopPitchersForEra(eraKey, limit) {
  const map = pitcherEraStats[eraKey];
  const arr = [];
  map.forEach(agg => {
    const IPouts = agg.IPouts || 0;
    const IP = IPouts / 3;
    if (IP < 300) return;

    const SO = agg.SO || 0;
    const BB = agg.BB || 0;
    const HBP = agg.HBP || 0;
    const HR = agg.HR || 0;
    const ER = agg.ER || 0;

    const ERA = IP > 0 ? 9 * ER / IP : NaN;
    const K9 = IP > 0 ? 9 * SO / IP : NaN;
    const FIP = IP > 0 ?
      ((13 * HR + 3 * (BB + HBP) - 2 * SO) / IP) + 3.1 : NaN;

    if (!isFinite(ERA) || !isFinite(FIP)) return;

    const KBB = BB > 0 ? SO / BB : SO;

    arr.push({
      era: eraKey,
      playerID: agg.playerID,
      name: agg.name,
      IP,
      ERA,
      K9,
      FIP,
      SO,
      BB,
      KBB
    });
  });

  arr.sort((a, b) => b.KBB - a.KBB);
  return arr.slice(0, limit);
}

// ----- LOAD DATA -----

Promise.all([
  d3.csv("datasets/Batting.csv", d3.autoType),
  d3.csv("datasets/Pitching.csv", d3.autoType),
  d3.csv("datasets/Master.csv", d3.autoType)
]).then(([batRaw, pitRaw, masterRaw]) => {

  const yearMin = 1970;
  const yearMax = 2015;

  const nameMap = new Map();
  masterRaw.forEach(r => {
    const id = r.playerID;
    const fullname =
      (r.nameFirst ? r.nameFirst + " " : "") +
      (r.nameLast ? r.nameLast : "") ||
      r.nameGiven ||
      id;
    nameMap.set(id, fullname.trim());
  });

  const batYearMap = new Map();
  batRaw.forEach(d => {
    if (d.yearID < yearMin || d.yearID > yearMax) return;

    const y = d.yearID;
    if (!batYearMap.has(y)) {
      batYearMap.set(y, {
        AB: 0, H: 0, R: 0, BB: 0, SO: 0,
        HBP: 0, SF: 0, DBL: 0, TRP: 0, HR: 0
      });
    }

    const agg = batYearMap.get(y);
    agg.AB += d.AB || 0;
    agg.H += d.H || 0;
    agg.R += d.R || 0;
    agg.BB += d.BB || 0;
    agg.SO += d.SO || 0;
    agg.HBP += d.HBP || 0;
    agg.SF += d.SF || 0;
    agg.DBL += d["2B"] || 0;
    agg.TRP += d["3B"] || 0;
    agg.HR += d.HR || 0;
  });

  const pitYearMap = new Map();
  pitRaw.forEach(d => {
    if (d.yearID < yearMin || d.yearID > yearMax) return;

    const y = d.yearID;
    if (!pitYearMap.has(y)) {
      pitYearMap.set(y, {
        IPouts: 0, SO: 0, BB: 0, HBP: 0, HR: 0, ER: 0
      });
    }

    const agg = pitYearMap.get(y);
    agg.IPouts += d.IPouts || 0;
    agg.SO += d.SO || 0;
    agg.BB += d.BB || 0;
    agg.HBP += d.HBP || 0;
    agg.HR += d.HR || 0;
    agg.ER += d.ER || 0;
  });

  // Build hitter era stats aggregate
  batRaw.forEach(d => {
    if (d.yearID < yearMin || d.yearID > yearMax) return;

    const era = eraKeyForYear(d.yearID);
    if (!era) return;

    const pid = d.playerID;
    const stats = {
      AB: d.AB || 0,
      H: d.H || 0,
      BB: d.BB || 0,
      SO: d.SO || 0,
      HBP: d.HBP || 0,
      SF: d.SF || 0,
      DBL: d["2B"] || 0,
      TRP: d["3B"] || 0,
      HR: d.HR || 0
    };

    function updateEraMap(mapKey) {
      const map = hitterEraStats[mapKey];
      if (!map.has(pid)) {
        map.set(pid, {
          playerID: pid,
          name: nameMap.get(pid),
          AB: 0, H: 0, BB: 0, SO: 0,
          HBP: 0, SF: 0, DBL: 0, TRP: 0, HR: 0
        });
      }

      let agg = map.get(pid);
      Object.keys(stats).forEach(k => {
        agg[k] += stats[k];
      });
    }

    updateEraMap("all");
    updateEraMap(era);
  });

  // Build pitcher era stats aggregate
  pitRaw.forEach(d => {
    if (d.yearID < yearMin || d.yearID > yearMax) return;

    const era = eraKeyForYear(d.yearID);
    if (!era) return;

    const pid = d.playerID;
    const stats = {
      IPouts: d.IPouts || 0,
      SO: d.SO || 0,
      BB: d.BB || 0,
      HBP: d.HBP || 0,
      HR: d.HR || 0,
      ER: d.ER || 0
    };

    function updateEraMap(mapKey) {
      const map = pitcherEraStats[mapKey];
      if (!map.has(pid)) {
        map.set(pid, {
          playerID: pid,
          name: nameMap.get(pid),
          IPouts: 0, SO: 0, BB: 0, HBP: 0, HR: 0, ER: 0
        });
      }

      let agg = map.get(pid);
      Object.keys(stats).forEach(k => {
        agg[k] += stats[k];
      });
    }

    updateEraMap("all");
    updateEraMap(era);
  });

  // Build league-level series
  const FIP_CONST = 3.1;
  for (let y = yearMin; y <= yearMax; y++) {
    const bat = batYearMap.get(y);
    const pit = pitYearMap.get(y);
    if (!bat || !pit) continue;

    const AB = bat.AB;
    const H = bat.H;
    const R = bat.R;
    const BB = bat.BB;
    const SO = bat.SO;
    const HBP = bat.HBP;
    const SF = bat.SF;
    const DBL = bat.DBL;
    const TRP = bat.TRP;
    const HR = bat.HR;

    const PA = AB + BB + HBP + SF;

    const IPouts = pit.IPouts;
    const IP = IPouts / 3;
    const ER = pit.ER;

    if (PA > 0 && IP > 0) {
      const games = IPouts / 27;
      const rpg = games > 0 ? R / games : NaN;
      runsSeries.push({ year: y, rg: rpg });

      const kPct = SO / PA;
      const bbPct = BB / PA;
      const hrPct = HR / PA;
      ttoSeries.push({ year: y, kPct, bbPct, hrPct });

      const sng = H - DBL - TRP - HR;
      const TB = (sng > 0 ? sng : 0) + 2 * DBL + 3 * TRP + 4 * HR;
      const SLG = AB > 0 ? TB / AB : NaN;
      const obpDen = AB + BB + HBP + SF;
      const OBP = obpDen > 0 ? (H + BB + HBP) / obpDen : NaN;
      const OPS = OBP + SLG;
      opsSeries.push({ year: y, ops: OPS });

      const pSO = pit.SO;
      const pBB = pit.BB;
      const pHBP = pit.HBP;
      const pHR = pit.HR;

      const ERA = 9 * ER / IP;
      const FIP_raw = (13 * pHR + 3 * (pBB + pHBP) - 2 * pSO) / IP;
      const FIP = FIP_raw + FIP_CONST;

      pitchSeries.push({ year: y, era: ERA, fip: FIP });
    }
  }

  renderAll();
  window.addEventListener("resize", debounce(renderAll, 200));
});

// ----- RENDER ALL CHARTS -----

function renderAll() {
  ["#chart-runs", "#chart-tto", "#chart-ops", "#chart-era-fip"].forEach(sel =>
    d3.select(sel).selectAll("*").remove()
  );

  d3.select("#player-scatter-container").selectAll("*").remove();
  d3.select("#player-scatter-legend").selectAll("*").remove();

  drawRunsChart();
  drawTTOChart();
  drawOpsChart();
  drawEraFipChart();
  drawPlayerScatter();
}

// ----- LEAGUE CHARTS -----

function drawRunsChart() {
  const data = runsSeries;
  const { g, innerWidth, innerHeight } = initChart("#chart-runs", 350);

  const x = d3.scaleLinear().domain([1970, 2015]).range([0, innerWidth]);
  const y = d3.scaleLinear().domain(d3.extent(data, d => d.rg)).range([innerHeight, 0]).nice();

  shadeEras(g, x, innerHeight);

  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#2563eb")
    .attr("stroke-width", 2)
    .attr("d", d3.line().x(d => x(d.year)).y(d => y(d.rg)));

  g.append("g").attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("g").call(d3.axisLeft(y));

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .text("League runs per team-game");

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 30)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Runs per game");

  addEraLegend(g, innerWidth);
}

function drawTTOChart() {
  const data = ttoSeries;
  const { g, innerWidth, innerHeight } = initChart("#chart-tto", 350);

  const x = d3.scaleLinear().domain([1970, 2015]).range([0, innerWidth]);
  const maxVal = d3.max(data, d => Math.max(d.kPct, d.bbPct, d.hrPct));
  const y = d3.scaleLinear().domain([0, maxVal]).range([innerHeight, 0]).nice();

  shadeEras(g, x, innerHeight);

  const lineK = d3.line().x(d => x(d.year)).y(d => y(d.kPct));
  const lineBB = d3.line().x(d => x(d.year)).y(d => y(d.bbPct));
  const lineHR = d3.line().x(d => x(d.year)).y(d => y(d.hrPct));

  g.append("path").datum(data)
    .attr("fill", "none")
    .attr("stroke", "#f97316")
    .attr("stroke-width", 2)
    .attr("d", lineK);

  g.append("path").datum(data)
    .attr("fill", "none")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 2)
    .attr("d", lineBB);

  g.append("path").datum(data)
    .attr("fill", "none")
    .attr("stroke", "#ef4444")
    .attr("stroke-width", 2)
    .attr("d", lineHR);

  g.append("g").attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .text("League three true outcomes rates");

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 30)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Rate of PA");

  const legend = g.append("g").attr("transform", `translate(${innerWidth - 140},70)`);
  [
    { label: "K%", color: "#f97316" },
    { label: "BB%", color: "#22c55e" },
    { label: "HR%", color: "#ef4444" }
  ].forEach((d, i) => {
    const gi = legend.append("g").attr("transform", `translate(0,${i * 18})`);
    gi.append("rect").attr("width", 10).attr("height", 10).attr("fill", d.color);
    gi.append("text").attr("x", 16).attr("y", 9).attr("font-size", "0.75rem").text(d.label);
  });

  addEraLegend(g, innerWidth);
}

function drawOpsChart() {
  const data = opsSeries;
  const { g, innerWidth, innerHeight } = initChart("#chart-ops", 350);

  const x = d3.scaleLinear().domain([1970, 2015]).range([0, innerWidth]);
  const y = d3.scaleLinear().domain(d3.extent(data, d => d.ops)).range([innerHeight, 0]).nice();

  shadeEras(g, x, innerHeight);

  g.append("path").datum(data)
    .attr("fill", "none")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 2)
    .attr("d", d3.line().x(d => x(d.year)).y(d => y(d.ops)));

  g.append("g").attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y));

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .text("League OPS over time");

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 30)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("OPS");

  addEraLegend(g, innerWidth);
}

function drawEraFipChart() {
  const data = pitchSeries;
  const { g, innerWidth, innerHeight } = initChart("#chart-era-fip", 350);

  const x = d3.scaleLinear().domain([1970, 2015]).range([0, innerWidth]);
  const minY = d3.min(data, d => Math.min(d.era, d.fip));
  const maxY = d3.max(data, d => Math.max(d.era, d.fip));
  const y = d3.scaleLinear().domain([minY, maxY]).range([innerHeight, 0]).nice();

  shadeEras(g, x, innerHeight);

  g.append("path").datum(data)
    .attr("fill", "none")
    .attr("stroke", "#2563eb")
    .attr("stroke-width", 2)
    .attr("d", d3.line().x(d => x(d.year)).y(d => y(d.era)));

  g.append("path").datum(data)
    .attr("fill", "none")
    .attr("stroke", "#f97316")
    .attr("stroke-width", 2)
    .attr("d", d3.line().x(d => x(d.year)).y(d => y(d.fip)));

  g.append("g").attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y));

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .text("League ERA and FIP over time");

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 30)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Runs allowed per 9");

  const legend = g.append("g").attr("transform", `translate(${innerWidth - 140},70)`);
  [
    { label: "ERA", color: "#2563eb" },
    { label: "FIP", color: "#f97316" }
  ].forEach((d, i) => {
    const gi = legend.append("g").attr("transform", `translate(0,${i * 18})`);
    gi.append("rect").attr("width", 10).attr("height", 10).attr("fill", d.color);
    gi.append("text").attr("x", 16).attr("y", 9).attr("font-size", "0.75rem").text(d.label);
  });

  addEraLegend(g, innerWidth);
}

// ----- PLAYER SCATTER -----

function drawPlayerScatter() {
  d3.select("#player-scatter-container").selectAll("*").remove();
  d3.select("#player-scatter-legend").selectAll("*").remove();

  if (currentView === "hitters") {
    scatterTitle.textContent =
      `Top Hitters — ${eras[currentEra].label} (AVG vs HR%, bubble = OPS)`;
    drawHitterScatter();
  } else {
    scatterTitle.textContent =
      `Top Pitchers — ${eras[currentEra].label} (K/BB vs ERA, bubble = FIP)`;
    drawPitcherScatter();
  }
}

// ----- HITTER SCATTER -----

function drawHitterScatter() {
  const data = getTopHittersForEra(currentEra, 25);
  if (!data.length) {
    d3.select("#player-scatter-container")
      .append("p")
      .text("No qualifying hitters for this era.");
    return;
  }

  const box = document.getElementById("player-scatter-container").getBoundingClientRect();
  const width = box.width || 700;
  const height = box.height || 520;

  const svg = d3.select("#player-scatter-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const margin = { top: 40, right: 60, bottom: 65, left: 90 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0.07, 0.35]).range([0, innerW]);
  const y = d3.scaleLinear().domain([0.00, 0.08]).range([innerH, 0]);
  const rScale = d3.scaleSqrt().domain([0.0, 1.05]).range([6, 22]);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat(d3.format(".3f")));

  g.append("g").call(d3.axisLeft(y).tickFormat(d3.format(".1%")));

  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .text("Batting Average (AVG)");

  g.append("text")
    .attr("x", -innerH / 2)
    .attr("y", -55)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Home Run Rate (HR%)");

  let lockedDatum = null;

  const nodes = g.selectAll(".h-node").data(data).enter().append("g")
    .attr("class", "h-node")
    .attr("transform", d => `translate(${x(d.AVG)},${y(d.HR_rate)})`);

  const bubbles = nodes.append("circle")
    .attr("class", "bubble")
    .attr("r", d => rScale(d.OPS))
    .attr("fill", eraColors[currentEra])
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 1.2);

  nodes.append("circle")
    .attr("class", "hit-area")
    .attr("r", d => rScale(d.OPS) + 8)
    .attr("fill", "transparent")
    .on("mouseenter", (event, d) => {
      if (!lockedDatum) {
        d3.select(event.currentTarget.parentNode).raise();
        showHitterTooltip(event, d);
      }
    })
    .on("mousemove", event => {
      if (!lockedDatum) {
        tooltip.style("left", event.pageX + 15 + "px")
               .style("top", event.pageY - 15 + "px");
      }
    })
    .on("mouseleave", () => {
      if (!lockedDatum) tooltip.style("opacity", 0);
    })
    .on("click", (event, d) => {
      if (lockedDatum === d) {
        lockedDatum = null;
        tooltip.style("opacity", 0);
        updateHitterHighlight();
        return;
      }

      lockedDatum = d;
      d3.select(event.currentTarget.parentNode).raise();
      updateHitterHighlight();
      showHitterTooltip(event, d);
      event.stopPropagation();
    });

  function showHitterTooltip(event, d) {
    tooltip
      .style("opacity", 1)
      .html(
        `<strong>${d.name}</strong><br>` +
        `OPS: ${d.OPS.toFixed(3)}<br>` +
        `AVG: ${d.AVG.toFixed(3)}<br>` +
        `HR%: ${(d.HR_rate * 100).toFixed(2)}%<br>` +
        `PA: ${d.PA.toFixed(0)}`
      )
      .style("left", event.pageX + 15 + "px")
      .style("top", event.pageY - 15 + "px");
  }

  function updateHitterHighlight() {
    bubbles
      .attr("opacity", d => lockedDatum && d !== lockedDatum ? 0.3 : 1)
      .attr("stroke", d => d === lockedDatum ? "#facc15" : "#0f172a")
      .attr("stroke-width", d => d === lockedDatum ? 3 : 1.2);
  }

  // global click to clear selection
  d3.select("body").on("click.hitter", e => {
    const target = e.target;
    if (!target.closest("svg")) {
      lockedDatum = null;
      tooltip.style("opacity", 0);
      updateHitterHighlight();
    }
  });

  const legend = d3.select("#player-scatter-legend");
  legend.append("div").attr("class", "legend-item")
    .html(`<span class="legend-swatch" style="background:${eraColors[currentEra]}"></span>
           Bubble size = OPS (better hitters are larger)`);
}

// ----- PITCHER SCATTER -----

function drawPitcherScatter() {
  const data = getTopPitchersForEra(currentEra, 25);
  if (!data.length) {
    d3.select("#player-scatter-container")
      .append("p")
      .text("No qualifying pitchers for this era.");
    return;
  }

  const box = document.getElementById("player-scatter-container").getBoundingClientRect();
  const width = box.width || 700;
  const height = box.height || 520;

  const svg = d3.select("#player-scatter-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const margin = { top: 40, right: 60, bottom: 65, left: 90 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0.5, 9.0]).range([0, innerW]);
  const y = d3.scaleLinear().domain([6.3, 1.5]).range([innerH, 0]);
  const rScale = d3.scaleSqrt().domain([1.7, 6.2]).range([22, 8]);

  g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x));
  g.append("g").call(d3.axisLeft(y));

  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .text("K/BB Ratio");

  g.append("text")
    .attr("x", -innerH / 2)
    .attr("y", -55)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("ERA (lower = better)");

  let lockedDatum = null;

  const nodes = g.selectAll(".p-node").data(data).enter().append("g")
    .attr("class", "p-node")
    .attr("transform", d => `translate(${x(d.KBB)},${y(d.ERA)})`);

  const bubbles = nodes.append("circle")
    .attr("class", "bubble")
    .attr("r", d => rScale(d.FIP))
    .attr("fill", eraColors[currentEra])
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 1.2);

  nodes.append("circle")
    .attr("class", "hit-area")
    .attr("r", d => rScale(d.FIP) + 8)
    .attr("fill", "transparent")
    .on("mouseenter", (event, d) => {
      if (!lockedDatum) {
        d3.select(event.currentTarget.parentNode).raise();
        showPitchTooltip(event, d);
      }
    })
    .on("mousemove", event => {
      if (!lockedDatum) {
        tooltip.style("left", event.pageX + 15 + "px")
               .style("top", event.pageY - 15 + "px");
      }
    })
    .on("mouseleave", () => {
      if (!lockedDatum) tooltip.style("opacity", 0);
    })
    .on("click", (event, d) => {
      if (lockedDatum === d) {
        lockedDatum = null;
        tooltip.style("opacity", 0);
        updatePitchHighlight();
        return;
      }

      lockedDatum = d;
      d3.select(event.currentTarget.parentNode).raise();
      updatePitchHighlight();
      showPitchTooltip(event, d);
      event.stopPropagation();
    });

  function showPitchTooltip(event, d) {
    tooltip
      .style("opacity", 1)
      .html(
        `<strong>${d.name}</strong><br>` +
        `ERA: ${d.ERA.toFixed(2)}<br>` +
        `K/BB: ${d.KBB.toFixed(2)}<br>` +
        `K/9: ${d.K9.toFixed(1)}<br>` +
        `FIP: ${d.FIP.toFixed(2)}<br>` +
        `IP: ${d.IP.toFixed(1)}`
      )
      .style("left", event.pageX + 15 + "px")
      .style("top", event.pageY - 15 + "px");
  }

  function updatePitchHighlight() {
    bubbles
      .attr("opacity", d => lockedDatum && d !== lockedDatum ? 0.3 : 1)
      .attr("stroke", d => d === lockedDatum ? "#facc15" : "#0f172a")
      .attr("stroke-width", d => d === lockedDatum ? 3 : 1.2);
  }

  d3.select("body").on("click.pitcher", e => {
    const target = e.target;
    if (!target.closest("svg")) {
      lockedDatum = null;
      tooltip.style("opacity", 0);
      updatePitchHighlight();
    }
  });

  const legend = d3.select("#player-scatter-legend");
  legend.append("div").attr("class", "legend-item")
    .html(`<span class="legend-swatch" style="background:${eraColors[currentEra]}"></span>
           Bubble size = FIP (better pitchers are larger)`);
}

// ----- BUTTONS -----

function setEraButtons(activeBtn) {
  [btnEraAll, btnEraExpansion, btnEraSteroid, btnEraModern]
    .forEach(b => b.classList.remove("era-active"));
  activeBtn.classList.add("era-active");
}

btnHitters.addEventListener("click", () => {
  currentView = "hitters";
  btnHitters.classList.add("active");
  btnPitchers.classList.remove("active");
  drawPlayerScatter();
});

btnPitchers.addEventListener("click", () => {
  currentView = "pitchers";
  btnPitchers.classList.add("active");
  btnHitters.classList.remove("active");
  drawPlayerScatter();
});

btnEraAll.addEventListener("click", () => {
  currentEra = "all";
  setEraButtons(btnEraAll);
  drawPlayerScatter();
});

btnEraExpansion.addEventListener("click", () => {
  currentEra = "expansion";
  setEraButtons(btnEraExpansion);
  drawPlayerScatter();
});

btnEraSteroid.addEventListener("click", () => {
  currentEra = "steroid";
  setEraButtons(btnEraSteroid);
  drawPlayerScatter();
});

btnEraModern.addEventListener("click", () => {
  currentEra = "modern";
  setEraButtons(btnEraModern);
  drawPlayerScatter();
});
