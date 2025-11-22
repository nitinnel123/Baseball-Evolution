const margin = { top: 40, right: 40, bottom: 60, left: 70 };
const width = 900 - margin.left - margin.right;
const height = 550 - margin.top - margin.bottom;

const container = d3.select("#chart-container");

const svg = container
  .append("svg")
  .attr(
    "viewBox",
    `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
  )
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom);

const g = svg
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);


const tooltip = d3.select("#tooltip");

const xScale = d3.scaleLinear().range([0, width]); 
const yScale = d3.scaleLinear().range([height, 0]); 
const rScale = d3.scaleSqrt().range([3, 18]);
const colorScale = d3.scaleOrdinal(d3.schemeCategory10); 


const xAxisGroup = g
  .append("g")
  .attr("class", "axis x-axis")
  .attr("transform", `translate(0, ${height})`);

const yAxisGroup = g.append("g").attr("class", "axis y-axis");


const xGridGroup = g
  .append("g")
  .attr("class", "grid x-grid")
  .attr("transform", `translate(0, ${height})`);

const yGridGroup = g.append("g").attr("class", "grid y-grid");

g.append("text")
  .attr("class", "x-label")
  .attr("x", width / 2)
  .attr("y", height + 45)
  .attr("text-anchor", "middle")
  .attr("fill", "#e5e7eb")
  .style("font-size", "0.9rem")
  .text("OPS (On-Base Plus Slugging)");

g.append("text")
  .attr("class", "y-label")
  .attr("x", -height / 2)
  .attr("y", -50)
  .attr("transform", "rotate(-90)")
  .attr("text-anchor", "middle")
  .attr("fill", "#e5e7eb")
  .style("font-size", "0.9rem")
  .text("FIP (Fielding Independent Pitching)");

const chartTitle = g
  .append("text")
  .attr("x", 0)
  .attr("y", -10)
  .attr("fill", "#e5e7eb")
  .style("font-size", "0.95rem")
  .text("OPS vs FIP by player-season (bubble size ~ IP, 1950–2010)");


const legendGroup = g
  .append("g")
  .attr("class", "legend")
  .attr("transform", `translate(${width - 90}, 0)`);


const yearSlider = document.getElementById("year-slider");
const yearLabel = document.getElementById("year-label");
const yearResetBtn = document.getElementById("year-reset");
const leagueSelect = document.getElementById("league-select");


let fullData = [];
let filteredData = [];

Promise.all([
  d3.csv("datasets/Batting.csv", d3.autoType),
  d3.csv("datasets/Pitching.csv", d3.autoType),
  d3.csv("datasets/Master.csv", d3.autoType),
  d3.csv("datasets/Teams.csv", d3.autoType)
]).then(([batRaw, pitRaw, master, teams]) => {

  const bat = batRaw.filter(
    (d) => d.yearID >= 1950 && d.yearID <= 2010
  );
  const pit = pitRaw.filter(
    (d) => d.yearID >= 1950 && d.yearID <= 2010
  );

  const batProcessed = bat
    .map((d) => {
      const H = d.H || 0;
      const BB = d.BB || 0;
      const HBP = d.HBP || 0;
      const AB = d.AB || 0;
      const SF = d.SF || 0;
      const doubles = d["2B"] || 0;
      const triples = d["3B"] || 0;
      const HR = d.HR || 0;

      if (AB <= 0) return null; 

      const singles = H - doubles - triples - HR;
      const obpDen = AB + BB + HBP + SF;
      const OBP = obpDen > 0 ? (H + BB + HBP) / obpDen : NaN;

      const TB =
        (singles > 0 ? singles : 0) +
        2 * doubles +
        3 * triples +
        4 * HR;
      const SLG = AB > 0 ? TB / AB : NaN;

      const OPS = OBP + SLG;

      if (!Number.isFinite(OPS)) return null;

      return {
        playerID: d.playerID,
        yearID: d.yearID,
        OPS
      };
    })
    .filter((d) => d !== null);

  const FIP_CONSTANT = 3.1; 

  const pitProcessed = pit
    .map((d) => {
      const HR = d.HR || 0;
      const BB = d.BB || 0;
      const SO = d.SO || 0;
      const HBP = d.HBP || 0;
      const IPouts = d.IPouts || 0;
      const IP = IPouts / 3;

      if (IP <= 0) return null;

      const FIP_raw =
        (13 * HR + 3 * (BB + HBP) - 2 * SO) / IP;
      const FIP = FIP_raw + FIP_CONSTANT;

      if (!Number.isFinite(FIP)) return null;

      return {
        playerID: d.playerID,
        yearID: d.yearID,
        FIP,
        IP,
        teamID: d.teamID
      };
    })
    .filter((d) => d !== null);

  const batMap = new Map();
  batProcessed.forEach((b) => {
    batMap.set(`${b.playerID}|${b.yearID}`, b);
  });

  const nameMap = new Map();
  master.forEach((m) => {
    const first = m.nameFirst || "";
    const last = m.nameLast || "";
    const name = `${first} ${last}`.trim();
    nameMap.set(m.playerID, name);
  });

  const leagueMap = new Map();
  teams.forEach((t) => {
    const key = `${t.yearID}|${t.teamID}`;
    leagueMap.set(key, t.lgID);
  });

  const merged = [];

  pitProcessed.forEach((p) => {
    const key = `${p.playerID}|${p.yearID}`;
    const b = batMap.get(key);
    if (!b) return;

    const playerID = p.playerID;
    const yearID = p.yearID;
    const OPS = b.OPS;
    const FIP = p.FIP;
    const IP = p.IP;
    const teamID = p.teamID;
    const name = nameMap.get(playerID) || playerID;

    const lgKey = `${yearID}|${teamID}`;
    const lgID = leagueMap.get(lgKey) || "UNK";

    merged.push({
      playerID,
      name,
      yearID,
      teamID,
      lgID,
      OPS,
      FIP,
      IP
    });
  });

  fullData = merged;

  if (fullData.length === 0) {
    console.warn("No two-way seasons found in 1950–2010.");
  }


  const yearsExtent = d3.extent(fullData, (d) => d.yearID);
  if (yearsExtent[0] == null) {
    yearsExtent[0] = 1950;
    yearsExtent[1] = 2010;
  }

  yearSlider.min = yearsExtent[0];
  yearSlider.max = yearsExtent[1];
  yearSlider.value = yearsExtent[0];
  yearLabel.textContent = `Year: ${yearSlider.value} (use "All years" to reset)`;

  const xExtent = d3.extent(fullData, (d) => d.OPS);
  const yExtent = d3.extent(fullData, (d) => d.FIP);
  const ipExtent = d3.extent(fullData, (d) => d.IP);

  const xPad = 0.05;
  xScale.domain([
    (xExtent[0] ?? 0.5) - xPad,
    (xExtent[1] ?? 1.2) + xPad
  ]);

  yScale.domain([
    (yExtent[0] ?? 1.5) - 0.5,
    (yExtent[1] ?? 6.0) + 0.5
  ]);

  rScale.domain(ipExtent);

  const leagues = Array.from(
    new Set(fullData.map((d) => d.lgID))
  ).sort();
  colorScale.domain(leagues);

  const xAxis = d3.axisBottom(xScale).ticks(8);
  const yAxis = d3.axisLeft(yScale).ticks(8);

  xAxisGroup.call(xAxis);
  yAxisGroup.call(yAxis);

  const xGrid = d3
    .axisBottom(xScale)
    .tickSize(-height)
    .tickFormat("");
  const yGrid = d3
    .axisLeft(yScale)
    .tickSize(-width)
    .tickFormat("");

  xGridGroup.call(xGrid);
  yGridGroup.call(yGrid);

  const legendItem = legendGroup
    .selectAll(".legend-item")
    .data(leagues)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 18})`);

  legendItem
    .append("rect")
    .attr("class", "legend-rect")
    .attr("x", 0)
    .attr("y", -10)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", (d) => colorScale(d));

  legendItem
    .append("text")
    .attr("x", 18)
    .attr("y", 0)
    .attr("dominant-baseline", "middle")
    .text((d) => d);

  updateChart();

  yearSlider.addEventListener("input", () => {
    const y = +yearSlider.value;
    yearLabel.textContent = `Year: ${y} (use "All years" to reset)`;
    updateChart();
  });

  yearResetBtn.addEventListener("click", () => {
    yearLabel.textContent = "All years";
    updateChart(true); 
  });

  leagueSelect.addEventListener("change", () => {
    updateChart();
  });
});

function updateChart(forceAllYears = false) {
  const selectedLeague = leagueSelect.value;
  const sliderYear = +yearSlider.value;

  filteredData = fullData.filter((d) => {
    const yearMatch = forceAllYears
      ? true
      : d.yearID === sliderYear;

    const leagueMatch =
      selectedLeague === "all" || d.lgID === selectedLeague;

    return yearMatch && leagueMatch;
  });

  const circles = g
    .selectAll("circle.bubble")
    .data(
      filteredData,
      (d) => `${d.playerID}-${d.yearID}-${d.teamID}`
    );

  circles
    .exit()
    .transition()
    .duration(300)
    .attr("r", 0)
    .remove();

  circles
    .transition()
    .duration(300)
    .attr("cx", (d) => xScale(d.OPS))
    .attr("cy", (d) => yScale(d.FIP))
    .attr("r", (d) => rScale(d.IP))
    .attr("fill", (d) => colorScale(d.lgID))
    .attr("opacity", 0.7);

  circles
    .enter()
    .append("circle")
    .attr("class", "bubble")
    .attr("cx", (d) => xScale(d.OPS))
    .attr("cy", (d) => yScale(d.FIP))
    .attr("r", 0)
    .attr("fill", (d) => colorScale(d.lgID))
    .attr("opacity", 0.7)
    .on("mouseenter", handleMouseEnter)
    .on("mousemove", handleMouseMove)
    .on("mouseleave", handleMouseLeave)
    .transition()
    .duration(300)
    .attr("r", (d) => rScale(d.IP));
}

function handleMouseEnter(event, d) {
  tooltip
    .style("opacity", 1)
    .html(buildTooltipHTML(d));
}

function handleMouseMove(event, d) {
  tooltip
    .style("left", `${event.pageX + 12}px`)
    .style("top", `${event.pageY - 10}px`);
}

function handleMouseLeave() {
  tooltip.style("opacity", 0);
}

function buildTooltipHTML(d) {
  const name = d.name || d.playerID;
  return `
    <strong>${name}</strong>
    Year: ${d.yearID}<br/>
    League: ${d.lgID} &middot; Team: ${d.teamID}<br/>
    OPS: ${d.OPS.toFixed(3)}<br/>
    FIP: ${d.FIP.toFixed(2)}<br/>
    IP: ${d.IP.toFixed(1)}
  `;
}
