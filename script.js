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
let runsSeries=[];
let ttoSeries=[];
let opsSeries=[];
let pitchSeries=[];
let currentView="ops";
let currentTeam="all";
let currentRole="all";
let currentEra="all";
let selectedCircle=null;

const teamSelect=document.getElementById("team-select");
const btnOPS=document.getElementById("view-ops");
const btnFIP=document.getElementById("view-fip");
const btnRoleAll=document.getElementById("role-all");
const btnRoleStarter=document.getElementById("role-starter");
const btnRoleReliever=document.getElementById("role-reliever");
const roleGroup=document.getElementById("role-group");
const btnEraAll=document.getElementById("era-all");
const btnEraExpansion=document.getElementById("era-expansion");
const btnEraSteroid=document.getElementById("era-steroid");
const btnEraModern=document.getElementById("era-modern");
const scatterTitle=document.getElementById("scatter-title");
const tooltip=d3.select("#tooltip");

function buildLegendFromData(data){
  const c=d3.select("#legend-container");
  c.selectAll("*").remove();
  const teams=Array.from(new Set(data.map(d=>d.teamID))).sort();
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

function clearScatter(){
  d3.select("#scatter-container").selectAll("*").remove();
  d3.select("#legend-container").selectAll("*").remove();
  if(selectedCircle){
    selectedCircle.classList.remove("selected");
    selectedCircle=null;
  }
  document.getElementById("player-panel").classList.add("hidden");
}

function inCurrentEra(year){
  const e=eras[currentEra];
  return year>=e.start&&year<=e.end;
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

  const batScatter=batRaw.filter(d=>d.yearID>=1970&&d.yearID<=2015&&d.AB>=400);
  battingData=batScatter.map(d=>{
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

  const pitScatter=pitRaw.filter(d=>d.yearID>=1970&&d.yearID<=2015&&(d.IPouts||0)/3>=40);
  const FIP_CONSTANT=3.1;
  pitchingData=pitScatter.map(d=>{
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

  const yearMin=1970;
  const yearMax=2015;

  const batYearMap=new Map();
  batRaw.forEach(d=>{
    if(d.yearID<yearMin||d.yearID>yearMax)return;
    const y=d.yearID;
    if(!batYearMap.has(y)){
      batYearMap.set(y,{
        AB:0,H:0,R:0,BB:0,SO:0,HBP:0,SF:0,DBL:0,TRP:0,HR:0
      });
    }
    const agg=batYearMap.get(y);
    agg.AB+=(d.AB||0);
    agg.H+=(d.H||0);
    agg.R+=(d.R||0);
    agg.BB+=(d.BB||0);
    agg.SO+=(d.SO||0);
    agg.HBP+=(d.HBP||0);
    agg.SF+=(d.SF||0);
    agg.DBL+=(d["2B"]||0);
    agg.TRP+=(d["3B"]||0);
    agg.HR+=(d.HR||0);
  });

  const pitYearMap=new Map();
  pitRaw.forEach(d=>{
    if(d.yearID<yearMin||d.yearID>yearMax)return;
    const y=d.yearID;
    if(!pitYearMap.has(y)){
      pitYearMap.set(y,{IPouts:0,SO:0,BB:0,HBP:0,HR:0,ER:0});
    }
    const agg=pitYearMap.get(y);
    agg.IPouts+=(d.IPouts||0);
    agg.SO+=(d.SO||0);
    agg.BB+=(d.BB||0);
    agg.HBP+=(d.HBP||0);
    agg.HR+=(d.HR||0);
    agg.ER+=(d.ER||0);
  });

  const FIP_CONST=3.1;
  for(let y=yearMin;y<=yearMax;y++){
    const bat=batYearMap.get(y);
    const pit=pitYearMap.get(y);
    if(!bat||!pit)continue;

    const AB=bat.AB;
    const H=bat.H;
    const R=bat.R;
    const BB=bat.BB;
    const SO=bat.SO;
    const HBP=bat.HBP;
    const SF=bat.SF;
    const DBL=bat.DBL;
    const TRP=bat.TRP;
    const HR=bat.HR;

    const PA=AB+BB+HBP+SF;
    const IPouts=pit.IPouts;
    const IP=IPouts/3;
    const ER=pit.ER;
    const pSO=pit.SO;
    const pBB=pit.BB;
    const pHBP=pit.HBP;
    const pHR=pit.HR;

    if(PA>0&&IP>0){
      const games=IPouts/27;
      const rpg=games>0?R/games:NaN;
      runsSeries.push({year:y,rg:rpg});

      const kPct=SO/PA;
      const bbPct=BB/PA;
      const hrPct=HR/PA;
      ttoSeries.push({year:y,kPct,bbPct,hrPct});

      const sng=H-DBL-TRP-HR;
      const TB=(sng>0?sng:0)+2*DBL+3*TRP+4*HR;
      const SLG=AB>0?TB/AB:NaN;
      const obpDen=AB+BB+HBP+SF;
      const OBP=obpDen>0?(H+BB+HBP)/obpDen:NaN;
      const OPS=OBP+SLG;
      opsSeries.push({year:y,ops:OPS});

      const ERA=9*ER/IP;
      const FIP_raw=(13*pHR+3*(pBB+pHBP)-2*pSO)/IP;
      const FIP=FIP_raw+FIP_CONST;
      pitchSeries.push({year:y,era:ERA,fip:FIP});
    }
  }

  const allTeams=new Set();
  battingData.forEach(d=>allTeams.add(d.teamID));
  pitchingData.forEach(d=>allTeams.add(d.teamID));
  const teamsList=Array.from(allTeams).sort();
  teamsList.forEach(t=>{
    const opt=document.createElement("option");
    opt.value=t;
    opt.textContent=t;
    teamSelect.appendChild(opt);
  });

  drawRunsChart();
  drawTTOChart();
  drawOpsChart();
  drawEraFipChart();
  drawScatterOPS();
});

function drawRunsChart(){
  d3.select("#chart-runs").selectAll("*").remove();
  const data=runsSeries;
  const svg=d3.select("#chart-runs").append("svg")
    .attr("width","100%")
    .attr("height",240);
  const width=svg.node().getBoundingClientRect().width;
  const height=240;
  const margin={top:30,right:20,bottom:40,left:60};
  const innerWidth=width-margin.left-margin.right;
  const innerHeight=height-margin.top-margin.bottom;
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const y=d3.scaleLinear().range([innerHeight,0]).domain(d3.extent(data,d=>d.rg));

  eraList.forEach(e=>{
    g.append("rect")
      .attr("x",x(e.start))
      .attr("y",0)
      .attr("width",x(e.end)-x(e.start))
      .attr("height",innerHeight)
      .attr("fill",e.key==="expansion"?"rgba(59,130,246,0.10)":e.key==="steroid"?"rgba(239,68,68,0.10)":"rgba(34,197,94,0.10)");
  });

  g.append("path")
    .datum(data)
    .attr("fill","none")
    .attr("stroke","#38bdf8")
    .attr("stroke-width",2)
    .attr("d",d3.line().x(d=>x(d.year)).y(d=>y(d.rg)));

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("League runs per team-game");

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
    .text("Runs per game");
}

function drawTTOChart(){
  d3.select("#chart-tto").selectAll("*").remove();
  const data=ttoSeries;
  const svg=d3.select("#chart-tto").append("svg")
    .attr("width","100%")
    .attr("height",240);
  const width=svg.node().getBoundingClientRect().width;
  const height=240;
  const margin={top:30,right:20,bottom:40,left:60};
  const innerWidth=width-margin.left-margin.right;
  const innerHeight=height-margin.top-margin.bottom;
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const maxVal=d3.max(data,d=>Math.max(d.kPct,d.bbPct,d.hrPct));
  const y=d3.scaleLinear().range([innerHeight,0]).domain([0,maxVal]);

  eraList.forEach(e=>{
    g.append("rect")
      .attr("x",x(e.start))
      .attr("y",0)
      .attr("width",x(e.end)-x(e.start))
      .attr("height",innerHeight)
      .attr("fill",e.key==="expansion"?"rgba(59,130,246,0.10)":e.key==="steroid"?"rgba(239,68,68,0.10)":"rgba(34,197,94,0.10)");
  });

  const lineK=d3.line().x(d=>x(d.year)).y(d=>y(d.kPct));
  const lineBB=d3.line().x(d=>x(d.year)).y(d=>y(d.bbPct));
  const lineHR=d3.line().x(d=>x(d.year)).y(d=>y(d.hrPct));

  g.append("path").datum(data).attr("fill","none").attr("stroke","#f97316").attr("stroke-width",2).attr("d",lineK);
  g.append("path").datum(data).attr("fill","none").attr("stroke","#22c55e").attr("stroke-width",2).attr("d",lineBB);
  g.append("path").datum(data).attr("fill","none").attr("stroke","#e11d48").attr("stroke-width",2).attr("d",lineHR);

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("League three true outcomes rates");

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
    .text("Rate of PA");

  const legend=g.append("g").attr("transform",`translate(${innerWidth-140},0)`);
  const items=[
    {label:"K%",color:"#f97316"},
    {label:"BB%",color:"#22c55e"},
    {label:"HR%",color:"#e11d48"}
  ];
  items.forEach((d,i)=>{
    const gItem=legend.append("g").attr("transform",`translate(0,${i*18})`);
    gItem.append("rect").attr("width",10).attr("height",10).attr("fill",d.color);
    gItem.append("text").attr("x",16).attr("y",9).attr("fill","#e5e7eb").attr("font-size","0.75rem").text(d.label);
  });
}

function drawOpsChart(){
  d3.select("#chart-ops").selectAll("*").remove();
  const data=opsSeries;
  const svg=d3.select("#chart-ops").append("svg")
    .attr("width","100%")
    .attr("height",240);
  const width=svg.node().getBoundingClientRect().width;
  const height=240;
  const margin={top:30,right:20,bottom:40,left:60};
  const innerWidth=width-margin.left-margin.right;
  const innerHeight=height-margin.top-margin.bottom;
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const y=d3.scaleLinear().range([innerHeight,0]).domain(d3.extent(data,d=>d.ops));

  eraList.forEach(e=>{
    g.append("rect")
      .attr("x",x(e.start))
      .attr("y",0)
      .attr("width",x(e.end)-x(e.start))
      .attr("height",innerHeight)
      .attr("fill",e.key==="expansion"?"rgba(59,130,246,0.10)":e.key==="steroid"?"rgba(239,68,68,0.10)":"rgba(34,197,94,0.10)");
  });

  g.append("path")
    .datum(data)
    .attr("fill","none")
    .attr("stroke","#22c55e")
    .attr("stroke-width",2)
    .attr("d",d3.line().x(d=>x(d.year)).y(d=>y(d.ops)));

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("League OPS over time");

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
    .text("OPS");
}

function drawEraFipChart(){
  d3.select("#chart-era-fip").selectAll("*").remove();
  const data=pitchSeries;
  const svg=d3.select("#chart-era-fip").append("svg")
    .attr("width","100%")
    .attr("height",240);
  const width=svg.node().getBoundingClientRect().width;
  const height=240;
  const margin={top:30,right:20,bottom:40,left:60};
  const innerWidth=width-margin.left-margin.right;
  const innerHeight=height-margin.top-margin.bottom;
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const minY=d3.min(data,d=>Math.min(d.era,d.fip));
  const maxY=d3.max(data,d=>Math.max(d.era,d.fip));
  const y=d3.scaleLinear().range([innerHeight,0]).domain([minY,maxY]);

  eraList.forEach(e=>{
    g.append("rect")
      .attr("x",x(e.start))
      .attr("y",0)
      .attr("width",x(e.end)-x(e.start))
      .attr("height",innerHeight)
      .attr("fill",e.key==="expansion"?"rgba(59,130,246,0.10)":e.key==="steroid"?"rgba(239,68,68,0.10)":"rgba(34,197,94,0.10)");
  });

  const lineERA=d3.line().x(d=>x(d.year)).y(d=>y(d.era));
  const lineFIP=d3.line().x(d=>x(d.year)).y(d=>y(d.fip));

  g.append("path").datum(data).attr("fill","none").attr("stroke","#60a5fa").attr("stroke-width",2).attr("d",lineERA);
  g.append("path").datum(data).attr("fill","none").attr("stroke","#f97316").attr("stroke-width",2).attr("d",lineFIP);

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("League ERA and FIP over time");

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
    .text("Runs allowed per 9");

  const legend=g.append("g").attr("transform",`translate(${innerWidth-140},0)`);
  const items=[
    {label:"ERA",color:"#60a5fa"},
    {label:"FIP",color:"#f97316"}
  ];
  items.forEach((d,i)=>{
    const gItem=legend.append("g").attr("transform",`translate(0,${i*18})`);
    gItem.append("rect").attr("width",10).attr("height",10).attr("fill",d.color);
    gItem.append("text").attr("x",16).attr("y",9).attr("fill","#e5e7eb").attr("font-size","0.75rem").text(d.label);
  });
}

function filteredBattingScatter(){
  return battingData.filter(d=>{
    const inEra=inCurrentEra(d.yearID);
    const teamOk=currentTeam==="all"||d.teamID===currentTeam;
    return inEra&&teamOk;
  });
}

function filteredPitchingScatter(){
  return pitchingData.filter(d=>{
    const inEra=inCurrentEra(d.yearID);
    const teamOk=currentTeam==="all"||d.teamID===currentTeam;
    const roleOk=currentRole==="all"||d.role===currentRole;
    return inEra&&teamOk&&roleOk;
  });
}

function drawScatterOPS(){
  clearScatter();
  scatterTitle.textContent="Hitting view: AVG vs HR (bubble size = OPS)";
  const data=filteredBattingScatter();
  const svg=d3.select("#scatter-container").append("svg")
    .attr("width","100%")
    .attr("height","100%");
  const bbox=svg.node().getBoundingClientRect();
  const width=bbox.width;
  const height=bbox.height;
  const margin={top:30,right:20,bottom:60,left:70};
  const innerWidth=width-margin.left-margin.right;
  const innerHeight=height-margin.top-margin.bottom;
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const domainData=battingData.filter(d=>inCurrentEra(d.yearID));
  const x=d3.scaleLinear().range([0,innerWidth]).domain(d3.extent(domainData,d=>d.AVG));
  const y=d3.scaleLinear().range([innerHeight,0]).domain([0,d3.max(domainData,d=>d.HR)]);
  const r=d3.scaleSqrt().range([3,22]).domain(d3.extent(domainData,d=>d.OPS));

  const xGrid=d3.axisBottom(x).tickSize(-innerHeight).tickFormat("");
  const yGrid=d3.axisLeft(y).tickSize(-innerWidth).tickFormat("");
  g.append("g").attr("class","grid").attr("transform",`translate(0,${innerHeight})`).call(xGrid);
  g.append("g").attr("class","grid").call(yGrid);

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",innerHeight+45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Batting Average (AVG)");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2)
    .attr("y",-45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Home Runs (HR)");

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("Player seasons within selected era");

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

  buildLegendFromData(data);
}

function drawScatterFIP(){
  clearScatter();
  scatterTitle.textContent="Pitching view: K vs ERA (bubble size = FIP)";
  const data=filteredPitchingScatter();
  const svg=d3.select("#scatter-container").append("svg")
    .attr("width","100%")
    .attr("height","100%");
  const bbox=svg.node().getBoundingClientRect();
  const width=bbox.width;
  const height=bbox.height;
  const margin={top:30,right:20,bottom:60,left:70};
  const innerWidth=width-margin.left-margin.right;
  const innerHeight=height-margin.top-margin.bottom;
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const domainData=pitchingData.filter(d=>inCurrentEra(d.yearID));
  const x=d3.scaleLinear().range([0,innerWidth]).domain([0,d3.max(domainData,d=>d.K)]);
  const y=d3.scaleLinear().range([innerHeight,0]).domain([0,d3.max(domainData,d=>d.ERA)]);
  const r=d3.scaleSqrt().range([3,22]).domain(d3.extent(domainData,d=>d.FIP));

  const xGrid=d3.axisBottom(x).tickSize(-innerHeight).tickFormat("");
  const yGrid=d3.axisLeft(y).tickSize(-innerWidth).tickFormat("");
  g.append("g").attr("class","grid").attr("transform",`translate(0,${innerHeight})`).call(xGrid);
  g.append("g").attr("class","grid").call(yGrid);

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",innerHeight+45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("Strikeouts (K)");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2)
    .attr("y",-45)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .text("ERA");

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#e5e7eb")
    .text("Pitcher seasons within selected era");

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

  buildLegendFromData(data);
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

function setEraButtons(activeBtn){
  [btnEraAll,btnEraExpansion,btnEraSteroid,btnEraModern].forEach(b=>b.classList.remove("era-active"));
  activeBtn.classList.add("era-active");
}

btnOPS.addEventListener("click",()=>{
  currentView="ops";
  btnOPS.classList.add("active");
  btnFIP.classList.remove("active");
  roleGroup.style.display="none";
  drawScatterOPS();
});

btnFIP.addEventListener("click",()=>{
  currentView="fip";
  btnFIP.classList.add("active");
  btnOPS.classList.remove("active");
  roleGroup.style.display="flex";
  drawScatterFIP();
});

teamSelect.addEventListener("change",()=>{
  currentTeam=teamSelect.value;
  currentView==="ops"?drawScatterOPS():drawScatterFIP();
});

btnRoleAll.addEventListener("click",()=>{
  currentRole="all";
  btnRoleAll.classList.add("active");
  btnRoleStarter.classList.remove("active");
  btnRoleReliever.classList.remove("active");
  if(currentView==="fip")drawScatterFIP();
});

btnRoleStarter.addEventListener("click",()=>{
  currentRole="starter";
  btnRoleStarter.classList.add("active");
  btnRoleAll.classList.remove("active");
  btnRoleReliever.classList.remove("active");
  if(currentView==="fip")drawScatterFIP();
});

btnRoleReliever.addEventListener("click",()=>{
  currentRole="reliever";
  btnRoleReliever.classList.add("active");
  btnRoleAll.classList.remove("active");
  btnRoleStarter.classList.remove("active");
  if(currentView==="fip")drawScatterFIP();
});

btnEraAll.addEventListener("click",()=>{
  currentEra="all";
  setEraButtons(btnEraAll);
  currentView==="ops"?drawScatterOPS():drawScatterFIP();
});

btnEraExpansion.addEventListener("click",()=>{
  currentEra="expansion";
  setEraButtons(btnEraExpansion);
  currentView==="ops"?drawScatterOPS():drawScatterFIP();
});

btnEraSteroid.addEventListener("click",()=>{
  currentEra="steroid";
  setEraButtons(btnEraSteroid);
  currentView==="ops"?drawScatterOPS():drawScatterFIP();
});

btnEraModern.addEventListener("click",()=>{
  currentEra="modern";
  setEraButtons(btnEraModern);
  currentView==="ops"?drawScatterOPS():drawScatterFIP();
});
