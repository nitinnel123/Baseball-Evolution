const teamColors={
BAL:"#DF4601",BOS:"#BD3039",CHA:"#27251F",CHW:"#27251F",CLE:"#0C2340",DET:"#0C2340",
HOU:"#EB6E1F",KCA:"#004687",KCR:"#004687",LAA:"#BA0021",MIN:"#0C2340",NYA:"#1C2841",
NYY:"#1C2841",OAK:"#003831",SEA:"#005C5C",TBA:"#8FBCE6",TBR:"#8FBCE6",TEX:"#003278",
TOR:"#134A8E",ARI:"#A71930",ATL:"#CE1141",CHN:"#0E3386",CHC:"#0E3386",CIN:"#C6011F",
COL:"#33006F",FLO:"#00A3E0",FLA:"#00A3E0",LAN:"#005A9C",LAD:"#005A9C",MIA:"#00A3E0",
MIL:"#12284B",MON:"#004B8D",NYN:"#FF5910",NYM:"#FF5910",PHI:"#E81828",PIT:"#FDB827",
SDN:"#2F241D",SDP:"#2F241D",SFN:"#FD5A1E",SFG:"#FD5A1E",SLN:"#C41E3A",STL:"#C41E3A",
WAS:"#AB0003",WSN:"#AB0003",BRO:"#005A9C",BSN:"#CE1141",MLN:"#CE1141",SEP:"#555555"
};
const fallback=d3.scaleOrdinal(d3.schemeTableau10);
function teamColor(id){return teamColors[id]||fallback(id);}

let fullData=[];
let currentView="ops";
let useAllYears=false;
let currentTeam="all";

const yearSlider=document.getElementById("year-slider");
const yearLabel=document.getElementById("year-label");
const yearReset=document.getElementById("year-reset");
const btnOPS=document.getElementById("view-ops");
const btnFIP=document.getElementById("view-fip");
const teamSelect=document.getElementById("team-select");
const tooltip=d3.select("#tooltip");

function clearChart(){
  d3.select("#chart-container").selectAll("*").remove();
}

function buildLegend(teams){
  const c=d3.select("#legend-container");
  c.selectAll("*").remove();
  const items=c.selectAll(".legend-item")
    .data(teams)
    .enter()
    .append("div")
    .attr("class","legend-item");
  items.append("span")
    .attr("class","legend-swatch")
    .style("background-color",d=>teamColor(d));
  items.append("span").text(d=>d);
}

Promise.all([
  d3.csv("datasets/Batting.csv",d3.autoType),
  d3.csv("datasets/Pitching.csv",d3.autoType),
  d3.csv("datasets/Master.csv",d3.autoType),
  d3.csv("datasets/Teams.csv",d3.autoType)
]).then(([batRaw,pitRaw,master,teams])=>{
  const bat=batRaw.filter(d=>d.yearID>=1950&&d.yearID<=2010);
  const pit=pitRaw.filter(d=>d.yearID>=1950&&d.yearID<=2010);

  const batProcessed=bat.map(d=>{
    const H=d.H||0,BB=d.BB||0,HBP=d.HBP||0,AB=d.AB||0,SF=d.SF||0,db=d["2B"]||0,tr=d["3B"]||0,HR=d.HR||0;
    if(AB<=0)return null;
    const sng=H-db-tr-HR;
    const obpDen=AB+BB+HBP+SF;
    const OBP=obpDen>0?(H+BB+HBP)/obpDen:NaN;
    const TB=(sng>0?sng:0)+2*db+3*tr+4*HR;
    const SLG=AB>0?TB/AB:NaN;
    const OPS=OBP+SLG;
    const AVG=AB>0?H/AB:NaN;
    if(!Number.isFinite(OPS)||!Number.isFinite(AVG))return null;
    return{playerID:d.playerID,yearID:d.yearID,OPS,AVG};
  }).filter(d=>d);

  const FIP_CONSTANT=3.1;
  const pitProcessed=pit.map(d=>{
    const HR=d.HR||0,BB=d.BB||0,SO=d.SO||0,HBP=d.HBP||0,IPouts=d.IPouts||0,IP=IPouts/3;
    if(IP<=0)return null;
    const FIP_raw=(13*HR+3*(BB+HBP)-2*SO)/IP;
    const FIP=FIP_raw+FIP_CONSTANT;
    if(!Number.isFinite(FIP))return null;
    return{playerID:d.playerID,yearID:d.yearID,FIP,IP,K:SO,teamID:d.teamID};
  }).filter(d=>d);

  const batMap=new Map();
  batProcessed.forEach(b=>batMap.set(`${b.playerID}|${b.yearID}`,b));

  const nameMap=new Map();
  master.forEach(m=>{
    const n=`${m.nameFirst||""} ${m.nameLast||""}`.trim();
    nameMap.set(m.playerID,n);
  });

  const lgMap=new Map();
  teams.forEach(t=>lgMap.set(`${t.yearID}|${t.teamID}`,t.lgID));

  const merged=[];
  pitProcessed.forEach(p=>{
    const b=batMap.get(`${p.playerID}|${p.yearID}`);
    if(!b)return;
    const n=nameMap.get(p.playerID)||p.playerID;
    const lg=lgMap.get(`${p.yearID}|${p.teamID}`)||"UNK";
    merged.push({
      playerID:p.playerID,
      name:n,
      yearID:p.yearID,
      teamID:p.teamID,
      lgID:lg,
      OPS:b.OPS,
      AVG:b.AVG,
      FIP:p.FIP,
      IP:p.IP,
      K:p.K
    });
  });

  fullData=merged;

  const years=d3.extent(fullData,d=>d.yearID);
  yearSlider.min=years[0];
  yearSlider.max=years[1];
  yearSlider.value=years[0];
  yearLabel.textContent=`Year: ${years[0]}`;
  useAllYears=false;

  const teamsList=Array.from(new Set(fullData.map(d=>d.teamID))).sort();
  buildLegend(teamsList);
  teamsList.forEach(t=>{
    const opt=document.createElement("option");
    opt.value=t;
    opt.textContent=t;
    teamSelect.appendChild(opt);
  });

  drawOPS();
});

function filteredData(){
  return fullData.filter(d=>{
    const yearOk=useAllYears||d.yearID===+yearSlider.value;
    const teamOk=currentTeam==="all"||d.teamID===currentTeam;
    return yearOk&&teamOk;
  });
}

function drawOPS(){
  clearChart();
  const data=filteredData();
  const svg=d3.select("#chart-container").append("svg")
    .attr("width",960).attr("height",600);
  const g=svg.append("g").attr("transform","translate(70,40)");
  const x=d3.scaleLinear().range([0,820])
    .domain(d3.extent(fullData,d=>d.AVG));
  const y=d3.scaleLinear().range([500,0])
    .domain(d3.extent(fullData,d=>d.OPS));
  const r=d3.scaleSqrt().range([3,22])
    .domain(d3.extent(fullData,d=>d.OPS));
  g.append("g").attr("transform","translate(0,500)")
    .attr("class","axis")
    .call(d3.axisBottom(x));
  g.append("g").attr("class","axis")
    .call(d3.axisLeft(y));
  g.append("text")
    .attr("x",410).attr("y",540)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Batting Average (AVG)");
  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-250).attr("y",-45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("OPS");
  const xGrid=d3.axisBottom(x).tickSize(-500).tickFormat("");
  const yGrid=d3.axisLeft(y).tickSize(-820).tickFormat("");
  g.append("g").attr("class","grid").attr("transform","translate(0,500)").call(xGrid);
  g.append("g").attr("class","grid").call(yGrid);
  g.append("text")
    .attr("x",0).attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("OPS vs AVG (bubble size = OPS)");
  g.selectAll("circle").data(data).enter().append("circle")
    .attr("cx",d=>x(d.AVG))
    .attr("cy",d=>y(d.OPS))
    .attr("r",d=>r(d.OPS))
    .attr("fill",d=>teamColor(d.teamID))
    .attr("opacity",.8)
    .on("mouseenter",showTipOPS)
    .on("mousemove",moveTip)
    .on("mouseleave",hideTip);
}

function drawFIP(){
  clearChart();
  const data=filteredData();
  const svg=d3.select("#chart-container").append("svg")
    .attr("width",960).attr("height",600);
  const g=svg.append("g").attr("transform","translate(70,40)");
  const x=d3.scaleLinear().range([0,820])
    .domain(d3.extent(fullData,d=>d.K));
  const y=d3.scaleLinear().range([500,0])
    .domain(d3.extent(fullData,d=>d.FIP));
  const r=d3.scaleSqrt().range([3,22])
    .domain(d3.extent(fullData,d=>d.FIP));
  g.append("g").attr("transform","translate(0,500)")
    .attr("class","axis")
    .call(d3.axisBottom(x));
  g.append("g").attr("class","axis")
    .call(d3.axisLeft(y));
  g.append("text")
    .attr("x",410).attr("y",540)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Strikeouts (K)");
  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-250).attr("y",-45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("FIP");
  const xGrid=d3.axisBottom(x).tickSize(-500).tickFormat("");
  const yGrid=d3.axisLeft(y).tickSize(-820).tickFormat("");
  g.append("g").attr("class","grid").attr("transform","translate(0,500)").call(xGrid);
  g.append("g").attr("class","grid").call(yGrid);
  g.append("text")
    .attr("x",0).attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("FIP vs K (bubble size = FIP)");
  g.selectAll("circle").data(data).enter().append("circle")
    .attr("cx",d=>x(d.K))
    .attr("cy",d=>y(d.FIP))
    .attr("r",d=>r(d.FIP))
    .attr("fill",d=>teamColor(d.teamID))
    .attr("opacity",.8)
    .on("mouseenter",showTipFIP)
    .on("mousemove",moveTip)
    .on("mouseleave",hideTip);
}

function showTipOPS(e,d){
  tooltip
    .style("opacity",1)
    .html(`<strong>${d.name}</strong><br>Year: ${d.yearID}<br>Team: ${d.teamID}<br>AVG: ${d.AVG.toFixed(3)}<br>OPS: ${d.OPS.toFixed(3)}<br>IP: ${d.IP.toFixed(1)}`);
}

function showTipFIP(e,d){
  tooltip
    .style("opacity",1)
    .html(`<strong>${d.name}</strong><br>Year: ${d.yearID}<br>Team: ${d.teamID}<br>K: ${d.K}<br>FIP: ${d.FIP.toFixed(2)}<br>IP: ${d.IP.toFixed(1)}`);
}

function moveTip(e){
  tooltip
    .style("left",e.pageX+12+"px")
    .style("top",e.pageY-10+"px");
}

function hideTip(){
  tooltip.style("opacity",0);
}

yearSlider.addEventListener("input",()=>{
  useAllYears=false;
  yearLabel.textContent=`Year: ${yearSlider.value}`;
  currentView==="ops"?drawOPS():drawFIP();
});

yearReset.addEventListener("click",()=>{
  useAllYears=true;
  yearLabel.textContent="All years";
  currentView==="ops"?drawOPS():drawFIP();
});

btnOPS.addEventListener("click",()=>{
  currentView="ops";
  btnOPS.classList.add("active");
  btnFIP.classList.remove("active");
  drawOPS();
});

btnFIP.addEventListener("click",()=>{
  currentView="fip";
  btnFIP.classList.add("active");
  btnOPS.classList.remove("active");
  drawFIP();
});

teamSelect.addEventListener("change",()=>{
  currentTeam=teamSelect.value;
  currentView==="ops"?drawOPS():drawFIP();
});
