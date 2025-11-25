const eras = {
  all: { key: "all", label: "All Eras (1970–2015)", start: 1970, end: 2015 },
  expansion: { key: "expansion", label: "Expansion Era (1970–1992)", start: 1970, end: 1992 },
  steroid: { key: "steroid", label: "Steroid Era (1993–2004)", start: 1993, end: 2004 },
  modern: { key: "modern", label: "Modern Era (2005–2015)", start: 2005, end: 2015 }
};

const eraColors = {
  expansion: "#3b82f6",
  steroid: "#ef4444",
  modern: "#22c55e",
  all: "#6b7280"
};

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

function initChart(container, height) {
  const svg = d3.select(container).append("svg")
    .attr("width", "100%")
    .attr("height", height);
  const width = svg.node().getBoundingClientRect().width;
  const margin = { top: 30, right: 20, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  return { svg, g, width, height, innerWidth, innerHeight, margin };
}

function shadeEras(g, x, innerHeight) {
  const eraList = [eras.expansion, eras.steroid, eras.modern];
  eraList.forEach(e => {
    g.append("rect")
      .attr("x", x(e.start))
      .attr("y", 0)
      .attr("width", x(e.end) - x(e.start))
      .attr("height", innerHeight)
      .attr("fill", e.key === "expansion" ? "rgba(59,130,246,0.10)" :
                    e.key === "steroid"   ? "rgba(239,68,68,0.10)" :
                                             "rgba(34,197,94,0.10)");
  });
}

function addEraLegend(g, innerWidth) {
  const legend = g.append("g")
    .attr("transform", `translate(${innerWidth - 130},5)`);

  const items = [
    { label: "Expansion Era", color: "rgba(59,130,246,0.10)" },
    { label: "Steroid Era", color: "rgba(239,68,68,0.10)" },
    { label: "Modern Era",  color: "rgba(34,197,94,0.10)" }
  ];

  items.forEach((d, i) => {
    const row = legend.append("g").attr("transform", `translate(0,${i * 18})`);
    row.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", d.color)
      .attr("stroke", "#94a3b8");
    row.append("text")
      .attr("x", 18)
      .attr("y", 10)
      .attr("font-size", "0.75rem")
      .attr("fill", "#111827")
      .text(d.label);
  });
}

function eraKeyForYear(y) {
  if (y < 1970 || y > 2015) return null;
  if (y <= 1992) return "expansion";
  if (y <= 2004) return "steroid";
  return "modern";
}

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
    const FIP = IP > 0 ? ((13 * HR + 3 * (BB + HBP) - 2 * SO) / IP) + 3.1 : NaN;
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
    const first = r.nameFirst || "";
    const last = r.nameLast || "";
    const given = r.nameGiven || "";
    const name = (first || last ? `${first} ${last}`.trim() : given) || id;
    nameMap.set(id, name);
  });

  const batYearMap = new Map();
  batRaw.forEach(d => {
    if (d.yearID < yearMin || d.yearID > yearMax) return;
    const y = d.yearID;
    if (!batYearMap.has(y)) {
      batYearMap.set(y, { AB: 0, H: 0, R: 0, BB: 0, SO: 0, HBP: 0, SF: 0, DBL: 0, TRP: 0, HR: 0 });
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
      pitYearMap.set(y, { IPouts: 0, SO: 0, BB: 0, HBP: 0, HR: 0, ER: 0 });
    }
    const agg = pitYearMap.get(y);
    agg.IPouts += d.IPouts || 0;
    agg.SO += d.SO || 0;
    agg.BB += d.BB || 0;
    agg.HBP += d.HBP || 0;
    agg.HR += d.HR || 0;
    agg.ER += d.ER || 0;
  });

  batRaw.forEach(d => {
    const y = d.yearID;
    if (y < yearMin || y > yearMax) return;
    const era = eraKeyForYear(y);
    if (!era) return;
    const pid = d.playerID;
    const AB = d.AB || 0;
    const H = d.H || 0;
    const BB = d.BB || 0;
    const SO = d.SO || 0;
    const HBP = d.HBP || 0;
    const SF = d.SF || 0;
    const DBL = d["2B"] || 0;
    const TRP = d["3B"] || 0;
    const HR = d.HR || 0;

    function update(mapKey) {
      const m = hitterEraStats[mapKey];
      let agg = m.get(pid);
      if (!agg) {
        agg = {
          playerID: pid,
          name: nameMap.get(pid) || pid,
          AB: 0, H: 0, BB: 0, SO: 0, HBP: 0, SF: 0, DBL: 0, TRP: 0, HR: 0
        };
        m.set(pid, agg);
      }
      agg.AB += AB;
      agg.H += H;
      agg.BB += BB;
      agg.SO += SO;
      agg.HBP += HBP;
      agg.SF += SF;
      agg.DBL += DBL;
      agg.TRP += TRP;
      agg.HR += HR;
    }

    update("all");
    update(era);
  });

  pitRaw.forEach(d => {
    const y = d.yearID;
    if (y < yearMin || y > yearMax) return;
    const era = eraKeyForYear(y);
    if (!era) return;
    const pid = d.playerID;
    const IPouts = d.IPouts || 0;
    const SO = d.SO || 0;
    const BB = d.BB || 0;
    const HBP = d.HBP || 0;
    const HR = d.HR || 0;
    const ER = d.ER || 0;

    function update(mapKey) {
      const m = pitcherEraStats[mapKey];
      let agg = m.get(pid);
      if (!agg) {
        agg = {
          playerID: pid,
          name: nameMap.get(pid) || pid,
          IPouts: 0, SO: 0, BB: 0, HBP: 0, HR: 0, ER: 0
        };
        m.set(pid, agg);
      }
      agg.IPouts += IPouts;
      agg.SO += SO;
      agg.BB += BB;
      agg.HBP += HBP;
      agg.HR += HR;
      agg.ER += ER;
    }

    update("all");
    update(era);
  });

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
    const pSO = pit.SO;
    const pBB = pit.BB;
    const pHBP = pit.HBP;
    const pHR = pit.HR;

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

      const ERA = 9 * ER / IP;
      const FIP_raw = (13 * pHR + 3 * (pBB + pHBP) - 2 * pSO) / IP;
      const FIP = FIP_raw + FIP_CONST;
      pitchSeries.push({ year: y, era: ERA, fip: FIP });
    }
  }

  drawRunsChart();
  drawTTOChart();
  drawOpsChart();
  drawEraFipChart();
  drawPlayerScatter();
});

function drawRunsChart() {
  d3.select("#chart-runs").selectAll("*").remove();
  const data = runsSeries;
  const { g, innerWidth, innerHeight } = initChart("#chart-runs", 310);
  const x = d3.scaleLinear().range([0, innerWidth]).domain([1970, 2015]);
  const y = d3.scaleLinear().range([innerHeight, 0]).domain(d3.extent(data, d => d.rg));

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
    .attr("fill", "#111827")
    .text("League runs per team-game");

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 30)
    .attr("fill", "#111827")
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("fill", "#111827")
    .attr("text-anchor", "middle")
    .text("Runs per game");

  addEraLegend(g, innerWidth);
}

function drawTTOChart() {
  d3.select("#chart-tto").selectAll("*").remove();
  const data = ttoSeries;
  const { g, innerWidth, innerHeight } = initChart("#chart-tto", 310);
  const x = d3.scaleLinear().range([0, innerWidth]).domain([1970, 2015]);
  const maxVal = d3.max(data, d => Math.max(d.kPct, d.bbPct, d.hrPct));
  const y = d3.scaleLinear().range([innerHeight, 0]).domain([0, maxVal]);

  shadeEras(g, x, innerHeight);

  const lineK = d3.line().x(d => x(d.year)).y(d => y(d.kPct));
  const lineBB = d3.line().x(d => x(d.year)).y(d => y(d.bbPct));
  const lineHR = d3.line().x(d => x(d.year)).y(d => y(d.hrPct));

  g.append("path").datum(data).attr("fill", "none").attr("stroke", "#f97316").attr("stroke-width", 2).attr("d", lineK);
  g.append("path").datum(data).attr("fill", "none").attr("stroke", "#22c55e").attr("stroke-width", 2).attr("d", lineBB);
  g.append("path").datum(data).attr("fill", "none").attr("stroke", "#ef4444").attr("stroke-width", 2).attr("d", lineHR);

  g.append("g").attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("fill", "#111827")
    .text("League three true outcomes rates");

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 30)
    .attr("fill", "#111827")
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("fill", "#111827")
    .attr("text-anchor", "middle")
    .text("Rate of PA");

  const legend = g.append("g").attr("transform", `translate(${innerWidth - 140},70)`);
  const items = [
    { label: "K%", color: "#f97316" },
    { label: "BB%", color: "#22c55e" },
    { label: "HR%", color: "#ef4444" }
  ];
  items.forEach((d, i) => {
    const gi = legend.append("g").attr("transform", `translate(0,${i * 18})`);
    gi.append("rect").attr("width", 10).attr("height", 10).attr("fill", d.color);
    gi.append("text").attr("x", 16).attr("y", 9).attr("fill", "#111827").attr("font-size", "0.75rem").text(d.label);
  });

  addEraLegend(g, innerWidth);
}

function drawOpsChart() {
  d3.select("#chart-ops").selectAll("*").remove();
  const data = opsSeries;
  const { g, innerWidth, innerHeight } = initChart("#chart-ops", 310);
  const x = d3.scaleLinear().range([0, innerWidth]).domain([1970, 2015]);
  const y = d3.scaleLinear().range([innerHeight, 0]).domain(d3.extent(data, d => d.ops));

  shadeEras(g, x, innerHeight);

  g.append("path")
    .datum(data)
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
    .attr("fill", "#111827")
    .text("League OPS over time");

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 30)
    .attr("fill", "#111827")
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("fill", "#111827")
    .attr("text-anchor", "middle")
    .text("OPS");

  addEraLegend(g, innerWidth);
}

function drawEraFipChart() {
  d3.select("#chart-era-fip").selectAll("*").remove();
  const data = pitchSeries;
  const { g, innerWidth, innerHeight } = initChart("#chart-era-fip", 310);
  const x = d3.scaleLinear().range([0, innerWidth]).domain([1970, 2015]);
  const minY = d3.min(data, d => Math.min(d.era, d.fip));
  const maxY = d3.max(data, d => Math.max(d.era, d.fip));
  const y = d3.scaleLinear().range([innerHeight, 0]).domain([minY, maxY]);

  shadeEras(g, x, innerHeight);

  const lineERA = d3.line().x(d => x(d.year)).y(d => y(d.era));
  const lineFIP = d3.line().x(d => x(d.year)).y(d => y(d.fip));

  g.append("path").datum(data).attr("fill", "none").attr("stroke", "#2563eb").attr("stroke-width", 2).attr("d", lineERA);
  g.append("path").datum(data).attr("fill", "none").attr("stroke", "#f97316").attr("stroke-width", 2).attr("d", lineFIP);

  g.append("g").attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y));

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("fill", "#111827")
    .text("League ERA and FIP over time");

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 30)
    .attr("fill", "#111827")
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("fill", "#111827")
    .attr("text-anchor", "middle")
    .text("Runs allowed per 9");

  const legend = g.append("g").attr("transform", `translate(${innerWidth - 140},70)`);
  const items = [
    { label: "ERA", color: "#2563eb" },
    { label: "FIP", color: "#f97316" }
  ];
  items.forEach((d, i) => {
    const gi = legend.append("g").attr("transform", `translate(0,${i * 18})`);
    gi.append("rect").attr("width", 10).attr("height", 10).attr("fill", d.color);
    gi.append("text").attr("x", 16).attr("y", 9).attr("fill", "#111827").attr("font-size", "0.75rem").text(d.label);
  });

  addEraLegend(g, innerWidth);
}

function drawPlayerScatter() {
  d3.select("#player-scatter-container").selectAll("*").remove();
  d3.select("#player-scatter-legend").selectAll("*").remove();

  const eraLabel = eras[currentEra].label;

  if (currentView === "hitters") {
    scatterTitle.textContent = `Top Hitters — ${eraLabel} (AVG vs HR%, bubble = OPS)`;
    drawHitterScatter();
  } else {
    scatterTitle.textContent = `Top Pitchers — ${eraLabel} (K/BB vs ERA, bubble = FIP)`;
    drawPitcherScatter();
  }
}

function drawHitterScatter() {
  const data = getTopHittersForEra(currentEra, 25);
  if (!data.length) return;

  const svg = d3.select("#player-scatter-container").append("svg")
    .attr("width", "100%")
    .attr("height", "100%");
  const bbox = svg.node().getBoundingClientRect();
  const width = bbox.width;
  const height = bbox.height;
  const margin = { top: 40, right: 40, bottom: 55, left: 70 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0.07, 0.35])
    .range([0, innerW]);

  const y = d3.scaleLinear()
    .domain([0.00, 0.08])
    .range([innerH, 0]);

  const rScale = d3.scaleSqrt()
    .domain([0.00, 1.05])
    .range([6, 26]);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat(d3.format(".3f")));

  g.append("g")
    .call(d3.axisLeft(y).tickFormat(d3.format(".1%")));

  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#111827")
    .text("Batting Average (AVG)");

  g.append("text")
    .attr("x", -innerH / 2)
    .attr("y", -50)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#111827")
    .text("Home Run Rate (HR%)");

  let lockedDatum = null;

  const nodes = g.selectAll(".h-node")
    .data(data)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x(d.AVG)},${y(d.HR_rate)})`);

  nodes.append("circle")
    .attr("r", d => rScale(d.OPS))
    .attr("fill", eraColors[currentEra])
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 1.2)
    .on("mouseenter", (event, d) => {
      if (lockedDatum) return;
      showHitterTooltip(event, d);
    })
    .on("mousemove", (event) => {
      if (lockedDatum) return;
      tooltip.style("left", event.pageX + 15 + "px")
             .style("top", event.pageY - 15 + "px");
    })
    .on("mouseleave", () => {
      if (lockedDatum) return;
      tooltip.style("opacity", 0);
    })
    .on("click", (event, d) => {
      lockedDatum = d;
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

  d3.select("body").on("click.playerScatter", function (e) {
    const target = e.target;
    if (!target.closest || !target.closest("svg")) {
      lockedDatum = null;
      tooltip.style("opacity", 0);
    }
  });

  const legend = d3.select("#player-scatter-legend");
  const item = legend.append("div").attr("class", "legend-item");
  item.append("span")
    .attr("class", "legend-swatch")
    .style("background-color", eraColors[currentEra]);
  item.append("span").text("Bubble size = OPS (better hitters are larger)");
}

function drawPitcherScatter() {
  const data = getTopPitchersForEra(currentEra, 25);
  if (!data.length) return;

  const svg = d3.select("#player-scatter-container").append("svg")
    .attr("width", "100%")
    .attr("height", "100%");
  const bbox = svg.node().getBoundingClientRect();
  const width = bbox.width;
  const height = bbox.height;
  const margin = { top: 40, right: 40, bottom: 55, left: 70 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0.5, 9.0])
    .range([0, innerW]);

  const y = d3.scaleLinear()
    .domain([6.3, 1.5])
    .range([innerH, 0]);

  const rScale = d3.scaleSqrt()
    .domain([1.7, 6.2])
    .range([26, 8]);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x));

  g.append("g")
    .call(d3.axisLeft(y));

  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#111827")
    .text("K/BB Ratio");

  g.append("text")
    .attr("x", -innerH / 2)
    .attr("y", -50)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#111827")
    .text("ERA (lower = better)");

  let lockedDatum = null;

  const nodes = g.selectAll(".p-node")
    .data(data)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x(d.KBB)},${y(d.ERA)})`);

  nodes.append("circle")
    .attr("r", d => rScale(d.FIP))
    .attr("fill", eraColors[currentEra])
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 1.2)
    .on("mouseenter", (event, d) => {
      if (lockedDatum) return;
      showPitchTooltip(event, d);
    })
    .on("mousemove", (event) => {
      if (lockedDatum) return;
      tooltip.style("left", event.pageX + 15 + "px")
             .style("top", event.pageY - 15 + "px");
    })
    .on("mouseleave", () => {
      if (lockedDatum) return;
      tooltip.style("opacity", 0);
    })
    .on("click", (event, d) => {
      lockedDatum = d;
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

  d3.select("body").on("click.playerScatter", function (e) {
    const target = e.target;
    if (!target.closest || !target.closest("svg")) {
      lockedDatum = null;
      tooltip.style("opacity", 0);
    }
  });

  const legend = d3.select("#player-scatter-legend");
  const item = legend.append("div").attr("class", "legend-item");
  item.append("span")
    .attr("class", "legend-swatch")
    .style("background-color", eraColors[currentEra]);
  item.append("span").text("Bubble size = FIP (better pitchers are larger)");
}

function setEraButtons(activeBtn) {
  [btnEraAll, btnEraExpansion, btnEraSteroid, btnEraModern].forEach(b => b.classList.remove("era-active"));
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
