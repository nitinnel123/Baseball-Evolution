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

const eras={
  all:{key:"all",label:"All Eras",start:1970,end:2015},
  expansion:{key:"expansion",label:"Expansion Era",start:1970,end:1992},
  steroid:{key:"steroid",label:"Steroid Era",start:1993,end:2004},
  modern:{key:"modern",label:"Modern Era",start:2005,end:2015}
};
const eraList=[eras.expansion,eras.steroid,eras.modern];

let battingData=[];
let pitchingData=[];
let currentView="ops";
let useAllYears=false;
let currentTeam="all";
let currentRole="all";
let currentEra="all";
let selectedCircle=null;

const yearSlider=document.getElementById("year-slider");
const yearLabel=document.getElementById("year-label");
const yearReset=document.getElementById("year-reset");
const btnOPS=document.getElementById("view-ops");
const btnFIP=document.getElementById("view-fip");
const teamSelect=document.getElementById("team-select");
const btnRoleAll=document.getElementById("role-all");
const btnRoleStarter=document.getElementById("role-starter");
const btnRoleReliever=document.getElementById("role-reliever");
const roleGroup=document.getElementById("role-group");
const btnEraAll=document.getElementById("era-all");
const btnEraExpansion=document.getElementById("era-expansion");
const btnEraSteroid=document.getElementById("era-steroid");
const btnEraModern=document.getElementById("era-modern");
const tooltip=d3.select("#tooltip");

function clearChart(){
  d3.select("#chart-container").selectAll("*").remove();
  d3.select("#trend-container").selectAll("*").remove();
  if(selectedCircle){
    selectedCircle.classList.remove("selected");
    selectedCircle=null;
  }
  document.getElementById("player-panel").classList.add("hidden");
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
  d3.csv("datasets/Master.csv",d3.autoType)
]).then(([batRaw,pitRaw,master])=>{
  const nameMap=new Map();
  master.forEach(m=>{
    const n=`${m.nameFirst||""} ${m.nameLast||""}`.trim();
    nameMap.set(m.playerID,n);
  });

  const bat=batRaw.filter(d=>d.yearID>=1970&&d.yearID<=2015&&d.AB>=400);
  battingData=bat.map(d=>{
    const H=d.H||0;
    const BB=d.BB||0;
    const HBP=d.HBP||0;
    const AB=d.AB||0;
    const SF=d.SF||0;
    const db=d["2B"]||0;
    const tr=d["3B"]||0;
    const HR=d.HR||0;
    if(AB<=0)return null;
    const sng=H-db-tr-HR;
    const obpDen=AB+BB+HBP+SF;
    const OBP=obpDen>0?(H+BB+HBP)/obpDen:NaN;
    const TB=(sng>0?sng:0)+2*db+3*tr+4*HR;
    const SLG=AB>0?TB/AB:NaN;
    const OPS=OBP+SLG;
    const AVG=AB>0?H/AB:NaN;
    if(!Number.isFinite(OPS)||!Number.isFinite(AVG))return null;
    const name=nameMap.get(d.playerID)||d.playerID;
    return{
      playerID:d.playerID,
      name,
      yearID:d.yearID,
      teamID:d.teamID,
      AB,
      H,
      HR,
      AVG,
      OPS
    };
  }).filter(d=>d);

  const pit=pitRaw.filter(d=>d.yearID>=1970&&d.yearID<=2015&&(d.IPouts||0)/3>=40);
  const FIP_CONSTANT=3.1;
  pitchingData=pit.map(d=>{
    const HR=d.HR||0;
    const BB=d.BB||0;
    const SO=d.SO||0;
    const HBP=d.HBP||0;
    const IPouts=d.IPouts||0;
    const IP=IPouts/3;
    const ER=d.ER||0;
    if(IP<=0)return null;
    const FIP_raw=(13*HR+3*(BB+HBP)-2*SO)/IP;
    const FIP=FIP_raw+FIP_CONSTANT;
    const ERA=9*ER/IP;
    if(!Number.isFinite(FIP)||!Number.isFinite(ERA))return null;
    const G=d.G||0;
    const GS=d.GS||0;
    let role="reliever";
    if(G>0&&GS>=10&&GS/G>=0.4) role="starter";
    const name=nameMap.get(d.playerID)||d.playerID;
    return{
      playerID:d.playerID,
      name,
      yearID:d.yearID,
      teamID:d.teamID,
      IP,
      K:SO,
      FIP,
      ERA,
      role
    };
  }).filter(d=>d);

  const allTeams=new Set();
  battingData.forEach(d=>allTeams.add(d.teamID));
  pitchingData.forEach(d=>allTeams.add(d.teamID));
  const teamsList=Array.from(allTeams).sort();
  buildLegend(teamsList);
  teamsList.forEach(t=>{
    const opt=document.createElement("option");
    opt.value=t;
    opt.textContent=t;
    teamSelect.appendChild(opt);
  });

  drawOPS();
});

function inCurrentEra(year){
  const e=currentEra==="all"?eras.all:eras[currentEra];
  return year>=e.start&&year<=e.end;
}

function filteredBatting(){
  return battingData.filter(d=>{
    const inEra=inCurrentEra(d.yearID);
    const yearOk=useAllYears||d.yearID===+yearSlider.value;
    const teamOk=currentTeam==="all"||d.teamID===currentTeam;
    return inEra&&yearOk&&teamOk;
  });
}

function filteredPitching(){
  return pitchingData.filter(d=>{
    const inEra=inCurrentEra(d.yearID);
    const yearOk=useAllYears||d.yearID===+yearSlider.value;
    const teamOk=currentTeam==="all"||d.teamID===currentTeam;
    const roleOk=currentRole==="all"||d.role===currentRole;
    return inEra&&yearOk&&teamOk&&roleOk;
  });
}

function drawOPS(){
  clearChart();
  roleGroup.style.display="none";

  const data=filteredBatting();
  const svg=d3.select("#chart-container").append("svg")
    .attr("width",960).attr("height",600);

  const margin={top:40,right:20,bottom:70,left:70};
  const innerWidth=960-margin.left-margin.right;
  const innerHeight=600-margin.top-margin.bottom;

  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear().range([0,innerWidth])
    .domain(d3.extent(battingData.filter(d=>inCurrentEra(d.yearID)),d=>d.AVG));

  const y=d3.scaleLinear().range([innerHeight,0])
    .domain([0,d3.max(battingData.filter(d=>inCurrentEra(d.yearID)),d=>d.HR)]);

  const r=d3.scaleSqrt().range([3,22])
    .domain(d3.extent(battingData.filter(d=>inCurrentEra(d.yearID)),d=>d.OPS));

  g.append("g").attr("transform",`translate(0,${innerHeight})`).attr("class","axis").call(d3.axisBottom(x));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",innerWidth/2).attr("y",innerHeight+45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Batting Average (AVG)");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2).attr("y",-45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Home Runs (HR)");

  g.append("text")
    .attr("x",0).attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("AVG vs HR (bubble size = OPS)");

  const xGrid=d3.axisBottom(x).tickSize(-innerHeight).tickFormat("");
  const yGrid=d3.axisLeft(y).tickSize(-innerWidth).tickFormat("");
  g.append("g").attr("class","grid").attr("transform",`translate(0,${innerHeight})`).call(xGrid);
  g.append("g").attr("class","grid").call(yGrid);

  g.selectAll("circle").data(data).enter().append("circle")
    .attr("cx",d=>x(d.AVG))
    .attr("cy",d=>y(d.HR))
    .attr("r",d=>r(d.OPS))
    .attr("fill",d=>teamColor(d.teamID))
    .attr("opacity",0.8)
    .on("mouseenter",showTipOPS)
    .on("mousemove",moveTip)
    .on("mouseleave",hideTip)
    .on("click",function(e,d){selectPlayer(d,this);});

  drawTrendBatting();
}

function drawFIP(){
  clearChart();
  roleGroup.style.display="flex";

  const data=filteredPitching();
  const svg=d3.select("#chart-container").append("svg")
    .attr("width",960).attr("height",600);

  const margin={top:40,right:20,bottom:70,left:70};
  const innerWidth=960-margin.left-margin.right;
  const innerHeight=600-margin.top-margin.bottom;

  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear().range([0,innerWidth])
    .domain([0,d3.max(pitchingData.filter(d=>inCurrentEra(d.yearID)),d=>d.K)]);

  const y=d3.scaleLinear().range([innerHeight,0])
    .domain([0,d3.max(pitchingData.filter(d=>inCurrentEra(d.yearID)),d=>d.ERA)]);

  const r=d3.scaleSqrt().range([3,22])
    .domain(d3.extent(pitchingData.filter(d=>inCurrentEra(d.yearID)),d=>d.FIP));

  g.append("g").attr("transform",`translate(0,${innerHeight})`).attr("class","axis").call(d3.axisBottom(x));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",innerWidth/2).attr("y",innerHeight+45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Strikeouts (K)");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2).attr("y",-45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("ERA");

  g.append("text")
    .attr("x",0).attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("K vs ERA (bubble size = FIP)");

  const xGrid=d3.axisBottom(x).tickSize(-innerHeight).tickFormat("");
  const yGrid=d3.axisLeft(y).tickSize(-innerWidth).tickFormat("");
  g.append("g").attr("class","grid").attr("transform",`translate(0,${innerHeight})`).call(xGrid);
  g.append("g").attr("class","grid").call(yGrid);

  g.selectAll("circle").data(data).enter().append("circle")
    .attr("cx",d=>x(d.K))
    .attr("cy",d=>y(d.ERA))
    .attr("r",d=>r(d.FIP))
    .attr("fill",d=>teamColor(d.teamID))
    .attr("opacity",0.8)
    .on("mouseenter",showTipFIP)
    .on("mousemove",moveTip)
    .on("mouseleave",hideTip)
    .on("click",function(e,d){selectPlayer(d,this);});

  drawTrendPitching();
}

function drawTrendBatting(){
  const era=currentEra==="all"?eras.all:eras[currentEra];
  const data=battingData.filter(d=>{
    const inEra=d.yearID>=era.start&&d.yearID<=era.end;
    const teamOk=currentTeam==="all"||d.teamID===currentTeam;
    return inEra&&teamOk;
  });
  if(!data.length)return;

  const byYear=d3.rollup(data,v=>d3.mean(v,d=>d.OPS),d=>d.yearID);
  const years=Array.from(byYear.keys()).sort((a,b)=>a-b);
  const series=years.map(y=>({year:y,value:byYear.get(y)}));

  const svg=d3.select("#trend-container").append("svg")
    .attr("width",960).attr("height",220);

  const margin={top:30,right:20,bottom:40,left:60};
  const innerWidth=960-margin.left-margin.right;
  const innerHeight=220-margin.top-margin.bottom;

  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const y=d3.scaleLinear().range([innerHeight,0])
    .domain(d3.extent(series,d=>d.value));

  eraList.forEach(e=>{
    g.append("rect")
      .attr("x",x(e.start))
      .attr("y",0)
      .attr("width",x(e.end)-x(e.start))
      .attr("height",innerHeight)
      .attr("fill",e.key==="expansion"?"rgba(59,130,246,0.10)":e.key==="steroid"?"rgba(239,68,68,0.10)":"rgba(34,197,94,0.10)");
  });

  g.append("path")
    .datum(series)
    .attr("fill","none")
    .attr("stroke","#38bdf8")
    .attr("stroke-width",2)
    .attr("d",d3.line().x(d=>x(d.year)).y(d=>y(d.value)));

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("Average OPS over time");

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",innerHeight+30)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Year");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2)
    .attr("y",-45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Average OPS");
}

function drawTrendPitching(){
  const era=currentEra==="all"?eras.all:eras[currentEra];
  const data=pitchingData.filter(d=>{
    const inEra=d.yearID>=era.start&&d.yearID<=era.end;
    const teamOk=currentTeam==="all"||d.teamID===currentTeam;
    const roleOk=currentRole==="all"||d.role===currentRole;
    return inEra&&teamOk&&roleOk;
  });
  if(!data.length)return;

  const byYear=d3.rollup(data,v=>d3.mean(v,d=>d.FIP),d=>d.yearID);
  const years=Array.from(byYear.keys()).sort((a,b)=>a-b);
  const series=years.map(y=>({year:y,value:byYear.get(y)}));

  const svg=d3.select("#trend-container").append("svg")
    .attr("width",960).attr("height",220);

  const margin={top:30,right:20,bottom:40,left:60};
  const innerWidth=960-margin.left-margin.right;
  const innerHeight=220-margin.top-margin.bottom;

  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const y=d3.scaleLinear().range([innerHeight,0])
    .domain(d3.extent(series,d=>d.value));

  eraList.forEach(e=>{
    g.append("rect")
      .attr("x",x(e.start))
      .attr("y",0)
      .attr("width",x(e.end)-x(e.start))
      .attr("height",innerHeight)
      .attr("fill",e.key==="expansion"?"rgba(59,130,246,0.10)":e.key==="steroid"?"rgba(239,68,68,0.10)":"rgba(34,197,94,0.10)");
  });

  g.append("path")
    .datum(series)
    .attr("fill","none")
    .attr("stroke","#f97316")
    .attr("stroke-width",2)
    .attr("d",d3.line().x(d=>x(d.year)).y(d=>y(d.value)));

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("Average FIP over time");

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",innerHeight+30)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Year");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2)
    .attr("y",-45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Average FIP");
}

function showTipOPS(e,d){
  tooltip
    .style("opacity",1)
    .html(`<strong>${d.name}</strong><br>Year: ${d.yearID}<br>Team: ${d.teamID}<br>AB: ${d.AB}<br>AVG: ${d.AVG.toFixed(3)}<br>HR: ${d.HR}<br>OPS: ${d.OPS.toFixed(3)}`);
}

function showTipFIP(e,d){
  tooltip
    .style("opacity",1)
    .html(`<strong>${d.name}</strong><br>Year: ${d.yearID}<br>Team: ${d.teamID}<br>Role: ${d.role}<br>IP: ${d.IP.toFixed(1)}<br>K: ${d.K}<br>ERA: ${d.ERA.toFixed(2)}<br>FIP: ${d.FIP.toFixed(2)}`);
}

function moveTip(e){
  tooltip
    .style("left",e.pageX+12+"px")
    .style("top",e.pageY-10+"px");
}

function hideTip(){
  tooltip.style("opacity",0);
}

function selectPlayer(d,element){
  if(selectedCircle){
    selectedCircle.classList.remove("selected");
  }
  selectedCircle=element;
  selectedCircle.classList.add("selected");

  const panel=document.getElementById("player-panel");
  const content=document.getElementById("panel-content");

  if(currentView==="ops"){
    content.textContent=
`${d.name}
Year: ${d.yearID}
Team: ${d.teamID}
AB: ${d.AB}
AVG: ${d.AVG.toFixed(3)}
HR: ${d.HR}
OPS: ${d.OPS.toFixed(3)}`;
  } else {
    content.textContent=
`${d.name}
Year: ${d.yearID}
Team: ${d.teamID}
Role: ${d.role}
IP: ${d.IP.toFixed(1)}
K: ${d.K}
ERA: ${d.ERA.toFixed(2)}
FIP: ${d.FIP.toFixed(2)}`;
  }

  panel.classList.remove("hidden");
}

function setEraButtons(activeId){
  [btnEraAll,btnEraExpansion,btnEraSteroid,btnEraModern].forEach(b=>b.classList.remove("era-active"));
  activeId.classList.add("era-active");
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

btnRoleAll.addEventListener("click",()=>{
  currentRole="all";
  btnRoleAll.classList.add("active");
  btnRoleStarter.classList.remove("active");
  btnRoleReliever.classList.remove("active");
  drawFIP();
});

btnRoleStarter.addEventListener("click",()=>{
  currentRole="starter";
  btnRoleStarter.classList.add("active");
  btnRoleAll.classList.remove("active");
  btnRoleReliever.classList.remove("active");
  drawFIP();
});

btnRoleReliever.addEventListener("click",()=>{
  currentRole="reliever";
  btnRoleReliever.classList.add("active");
  btnRoleAll.classList.remove("active");
  btnRoleStarter.classList.remove("active");
  drawFIP();
});

btnEraAll.addEventListener("click",()=>{
  currentEra="all";
  setEraButtons(btnEraAll);
  currentView==="ops"?drawOPS():drawFIP();
});

btnEraExpansion.addEventListener("click",()=>{
  currentEra="expansion";
  setEraButtons(btnEraExpansion);
  currentView==="ops"?drawOPS():drawFIP();
});

btnEraSteroid.addEventListener("click",()=>{
  currentEra="steroid";
  setEraButtons(btnEraSteroid);
  currentView==="ops"?drawOPS():drawFIP();
});

btnEraModern.addEventListener("click",()=>{
  currentEra="modern";
  setEraButtons(btnEraModern);
  currentView==="ops"?drawOPS():drawFIP();
});
