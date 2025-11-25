const eras={
  all:{key:"all",label:"All Eras",start:1970,end:2015},
  expansion:{key:"expansion",label:"Expansion Era",start:1970,end:1992},
  steroid:{key:"steroid",label:"Steroid Era",start:1993,end:2004},
  modern:{key:"modern",label:"Modern Era",start:2005,end:2015}
};
const eraList=[eras.expansion,eras.steroid,eras.modern];
const eraFill={
  expansion:"rgba(59,130,246,0.10)",
  steroid:"rgba(239,68,68,0.10)",
  modern:"rgba(34,197,94,0.10)"
};

const decades=[
  {id:"1970s",label:"1970–1979",start:1970,end:1979},
  {id:"1980s",label:"1980–1989",start:1980,end:1989},
  {id:"1990s",label:"1990–1999",start:1990,end:1999},
  {id:"2000s",label:"2000–2009",start:2000,end:2009},
  {id:"2010s",label:"2010–2015",start:2010,end:2015}
];

const eraDecades={
  all:["1970s","1980s","1990s","2000s","2010s"],
  expansion:["1970s","1980s"],
  steroid:["1990s","2000s"],
  modern:["2010s"]
};

const decadeColors={
  "1970s":"#3b82f6",
  "1980s":"#a855f7",
  "1990s":"#ef4444",
  "2000s":"#fb923c",
  "2010s":"#22c55e"
};

let runsSeries=[];
let ttoSeries=[];
let opsSeries=[];
let pitchSeries=[];
let decadeBatting=[];
let decadePitching=[];
let currentView="ops";
let currentEra="all";

const btnOPS=document.getElementById("view-ops");
const btnFIP=document.getElementById("view-fip");
const btnEraAll=document.getElementById("era-all");
const btnEraExpansion=document.getElementById("era-expansion");
const btnEraSteroid=document.getElementById("era-steroid");
const btnEraModern=document.getElementById("era-modern");
const scatterTitle=document.getElementById("scatter-title");
const tooltip=d3.select("#tooltip");

function initChart(container,height){
  const svg=d3.select(container).append("svg")
    .attr("width","100%")
    .attr("height",height);
  const width=svg.node().getBoundingClientRect().width;
  const margin={top:30,right:20,bottom:40,left:60};
  const innerWidth=width-margin.left-margin.right;
  const innerHeight=height-margin.top-margin.bottom;
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);
  return {svg,g,width,height,innerWidth,innerHeight,margin};
}

function shadeEras(g,x,innerHeight){
  eraList.forEach(e=>{
    g.append("rect")
      .attr("x",x(e.start))
      .attr("y",0)
      .attr("width",x(e.end)-x(e.start))
      .attr("height",innerHeight)
      .attr("fill",eraFill[e.key]);
  });
}

function addEraLegend(g,innerWidth){
  const legend=g.append("g")
    .attr("transform",`translate(${innerWidth-130},5)`);
  const items=[
    {label:"Expansion Era",color:eraFill.expansion},
    {label:"Steroid Era",color:eraFill.steroid},
    {label:"Modern Era",color:eraFill.modern}
  ];
  items.forEach((d,i)=>{
    const row=legend.append("g").attr("transform",`translate(0,${i*18})`);
    row.append("rect")
      .attr("width",12)
      .attr("height",12)
      .attr("fill",d.color)
      .attr("stroke","#94a3b8");
    row.append("text")
      .attr("x",18)
      .attr("y",10)
      .attr("font-size","0.75rem")
      .attr("fill","#111827")
      .text(d.label);
  });
}

function filteredDecadeBatting(){
  const allowed=eraDecades[currentEra];
  return decadeBatting.filter(d=>allowed.includes(d.decade));
}

function filteredDecadePitching(){
  const allowed=eraDecades[currentEra];
  return decadePitching.filter(d=>allowed.includes(d.decade));
}

Promise.all([
  d3.csv("datasets/Batting.csv",d3.autoType),
  d3.csv("datasets/Pitching.csv",d3.autoType)
]).then(([batRaw,pitRaw])=>{
  const yearMin=1970;
  const yearMax=2015;

  const batYearMap=new Map();
  batRaw.forEach(d=>{
    if(d.yearID<yearMin||d.yearID>yearMax)return;
    const y=d.yearID;
    if(!batYearMap.has(y)){
      batYearMap.set(y,{AB:0,H:0,R:0,BB:0,SO:0,HBP:0,SF:0,DBL:0,TRP:0,HR:0});
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

  decades.forEach(dec=>{
    let AB=0,H=0,R=0,BB=0,SO=0,HBP=0,SF=0,DBL=0,TRP=0,HR=0;
    let IPouts=0,pSO=0,pBB=0,pHBP=0,pHR=0,ER=0;

    for(let y=dec.start;y<=dec.end;y++){
      const bat=batYearMap.get(y);
      const pit=pitYearMap.get(y);
      if(bat){
        AB+=bat.AB;
        H+=bat.H;
        R+=bat.R;
        BB+=bat.BB;
        SO+=bat.SO;
        HBP+=bat.HBP;
        SF+=bat.SF;
        DBL+=bat.DBL;
        TRP+=bat.TRP;
        HR+=bat.HR;
      }
      if(pit){
        IPouts+=pit.IPouts;
        pSO+=pit.SO;
        pBB+=pit.BB;
        pHBP+=pit.HBP;
        pHR+=pit.HR;
        ER+=pit.ER;
      }
    }

    const PA=AB+BB+HBP+SF;
    const AVG=AB>0?H/AB:NaN;
    const hrRate=PA>0?HR/PA:NaN;
    const sng=H-DBL-TRP-HR;
    const TB=(sng>0?sng:0)+2*DBL+3*TRP+4*HR;
    const SLG=AB>0?TB/AB:NaN;
    const obpDen=AB+BB+HBP+SF;
    const OBP=obpDen>0?(H+BB+HBP)/obpDen:NaN;
    const OPS=OBP+SLG;

    const IP=IPouts/3;
    const K9=IP>0?(pSO*9)/IP:NaN;
    const ERA=IP>0?(ER*9)/IP:NaN;
    const FIP_val=IP>0?((13*pHR+3*(pBB+pHBP)-2*pSO)/IP)+FIP_CONST:NaN;

    decadeBatting.push({
      decade:dec.id,
      label:dec.label,
      AVG,
      HR_per_PA:hrRate,
      OPS
    });

    decadePitching.push({
      decade:dec.id,
      label:dec.label,
      K_per_9:K9,
      ERA,
      FIP:FIP_val
    });
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
  const {g,innerWidth,innerHeight}=initChart("#chart-runs",310);
  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const y=d3.scaleLinear().range([innerHeight,0]).domain(d3.extent(data,d=>d.rg));

  shadeEras(g,x,innerHeight);

  g.append("path")
    .datum(data)
    .attr("fill","none")
    .attr("stroke","#2563eb")
    .attr("stroke-width",2)
    .attr("d",d3.line().x(d=>x(d.year)).y(d=>y(d.rg)));

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#111827")
    .text("League runs per team-game");

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",innerHeight+30)
    .attr("fill","#111827")
    .attr("text-anchor","middle")
    .text("Year");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2)
    .attr("y",-45)
    .attr("fill","#111827")
    .attr("text-anchor","middle")
    .text("Runs per game");

  addEraLegend(g,innerWidth);
}

function drawTTOChart(){
  d3.select("#chart-tto").selectAll("*").remove();
  const data=ttoSeries;
  const {g,innerWidth,innerHeight}=initChart("#chart-tto",310);
  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const maxVal=d3.max(data,d=>Math.max(d.kPct,d.bbPct,d.hrPct));
  const y=d3.scaleLinear().range([innerHeight,0]).domain([0,maxVal]);

  shadeEras(g,x,innerHeight);

  const lineK=d3.line().x(d=>x(d.year)).y(d=>y(d.kPct));
  const lineBB=d3.line().x(d=>x(d.year)).y(d=>y(d.bbPct));
  const lineHR=d3.line().x(d=>x(d.year)).y(d=>y(d.hrPct));

  g.append("path").datum(data).attr("fill","none").attr("stroke","#f97316").attr("stroke-width",2).attr("d",lineK);
  g.append("path").datum(data).attr("fill","none").attr("stroke","#22c55e").attr("stroke-width",2).attr("d",lineBB);
  g.append("path").datum(data).attr("fill","none").attr("stroke","#ef4444").attr("stroke-width",2).attr("d",lineHR);

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#111827")
    .text("League three true outcomes rates");

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",innerHeight+30)
    .attr("fill","#111827")
    .attr("text-anchor","middle")
    .text("Year");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2)
    .attr("y",-45)
    .attr("fill","#111827")
    .attr("text-anchor","middle")
    .text("Rate of PA");

  const legend=g.append("g").attr("transform",`translate(${innerWidth-140},70)`);
  const items=[
    {label:"K%",color:"#f97316"},
    {label:"BB%",color:"#22c55e"},
    {label:"HR%",color:"#ef4444"}
  ];
  items.forEach((d,i)=>{
    const gItem=legend.append("g").attr("transform",`translate(0,${i*18})`);
    gItem.append("rect").attr("width",10).attr("height",10).attr("fill",d.color);
    gItem.append("text").attr("x",16).attr("y",9).attr("fill","#111827").attr("font-size","0.75rem").text(d.label);
  });

  addEraLegend(g,innerWidth);
}

function drawOpsChart(){
  d3.select("#chart-ops").selectAll("*").remove();
  const data=opsSeries;
  const {g,innerWidth,innerHeight}=initChart("#chart-ops",310);
  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const y=d3.scaleLinear().range([innerHeight,0]).domain(d3.extent(data,d=>d.ops));

  shadeEras(g,x,innerHeight);

  g.append("path")
    .datum(data)
    .attr("fill","none")
    .attr("stroke","#22c55e")
    .attr("stroke-width",2)
    .attr("d",d3.line().x(d=>x(d.year)).y(d=>y(d.ops)));

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#111827")
    .text("League OPS over time");

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",innerHeight+30)
    .attr("fill","#111827")
    .attr("text-anchor","middle")
    .text("Year");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2)
    .attr("y",-45)
    .attr("fill","#111827")
    .attr("text-anchor","middle")
    .text("OPS");

  addEraLegend(g,innerWidth);
}

function drawEraFipChart(){
  d3.select("#chart-era-fip").selectAll("*").remove();
  const data=pitchSeries;
  const {g,innerWidth,innerHeight}=initChart("#chart-era-fip",310);
  const x=d3.scaleLinear().range([0,innerWidth]).domain([1970,2015]);
  const minY=d3.min(data,d=>Math.min(d.era,d.fip));
  const maxY=d3.max(data,d=>Math.max(d.era,d.fip));
  const y=d3.scaleLinear().range([innerHeight,0]).domain([minY,maxY]);

  shadeEras(g,x,innerHeight);

  const lineERA=d3.line().x(d=>x(d.year)).y(d=>y(d.era));
  const lineFIP=d3.line().x(d=>x(d.year)).y(d=>y(d.fip));

  g.append("path").datum(data).attr("fill","none").attr("stroke","#2563eb").attr("stroke-width",2).attr("d",lineERA);
  g.append("path").datum(data).attr("fill","none").attr("stroke","#f97316").attr("stroke-width",2).attr("d",lineFIP);

  g.append("g").attr("class","axis").attr("transform",`translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",0)
    .attr("y",-10)
    .attr("fill","#111827")
    .text("League ERA and FIP over time");

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",innerHeight+30)
    .attr("fill","#111827")
    .attr("text-anchor","middle")
    .text("Year");

  g.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-innerHeight/2)
    .attr("y",-45)
    .attr("fill","#111827")
    .attr("text-anchor","middle")
    .text("Runs allowed per 9");

  const legend=g.append("g").attr("transform",`translate(${innerWidth-140},70)`);
  const items=[
    {label:"ERA",color:"#2563eb"},
    {label:"FIP",color:"#f97316"}
  ];
  items.forEach((d,i)=>{
    const gItem=legend.append("g").attr("transform",`translate(0,${i*18})`);
    gItem.append("rect").attr("width",10).attr("height",10).attr("fill",d.color);
    gItem.append("text").attr("x",16).attr("y",9).attr("fill","#111827").attr("font-size","0.75rem").text(d.label);
  });

  addEraLegend(g,innerWidth);
}

function drawScatterOPS(){
  d3.select("#scatter-container").selectAll("*").remove();
  d3.select("#legend-container").selectAll("*").remove();
  scatterTitle.textContent="Decade Hitting Dumbbell Chart: AVG → OPS (positioned by HR%)";

  const data=filteredDecadeBatting();
  if(!data.length)return;

  const svg=d3.select("#scatter-container").append("svg")
    .attr("width","100%")
    .attr("height","100%");
  const bbox=svg.node().getBoundingClientRect();
  const width=bbox.width;
  const height=bbox.height;
  const margin={top:50,right:30,bottom:50,left:80};
  const innerWidth=width-margin.left-margin.right;
  const innerHeight=height-margin.top-margin.bottom;
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear()
    .domain([d3.min(data,d=>d.AVG),d3.max(data,d=>d.OPS)])
    .nice()
    .range([0,innerWidth]);

  const y=d3.scaleLinear()
    .domain(d3.extent(data,d=>d.HR_per_PA))
    .nice()
    .range([innerHeight,0]);

  const color=d3.scaleOrdinal()
    .domain(data.map(d=>d.decade))
    .range(["#3b82f6","#a855f7","#ef4444","#fb923c","#22c55e"]);

  g.append("g")
    .attr("transform",`translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  g.append("g")
    .call(d3.axisLeft(y).tickFormat(d3.format(".1%")));

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",-20)
    .attr("text-anchor","middle")
    .attr("fill","#111827")
    .text("Decade Hitting: AVG (left) → OPS (right), positioned by HR%");

  const rows=g.selectAll(".dumbbell")
    .data(data)
    .enter()
    .append("g")
    .attr("class","dumbbell")
    .attr("transform",d=>`translate(0,${y(d.HR_per_PA)})`);

  rows.append("line")
    .attr("x1",d=>x(d.AVG))
    .attr("x2",d=>x(d.OPS))
    .attr("stroke","#9ca3af")
    .attr("stroke-width",2);

  rows.append("circle")
    .attr("cx",d=>x(d.AVG))
    .attr("r",7)
    .attr("fill",d=>color(d.decade))
    .on("mouseenter",(e,d)=>{
      tooltip.style("opacity",1).html(
        `<strong>${d.label}</strong><br>`+
        `AVG: ${d.AVG.toFixed(3)}<br>`+
        `HR%: ${(d.HR_per_PA*100).toFixed(2)}%`
      );
    })
    .on("mousemove",e=>{
      tooltip.style("left",e.pageX+12+"px").style("top",e.pageY-10+"px");
    })
    .on("mouseleave",()=>tooltip.style("opacity",0));

  rows.append("circle")
    .attr("cx",d=>x(d.OPS))
    .attr("r",7)
    .attr("fill",d=>color(d.decade))
    .on("mouseenter",(e,d)=>{
      tooltip.style("opacity",1).html(
        `<strong>${d.label}</strong><br>`+
        `OPS: ${d.OPS.toFixed(3)}<br>`+
        `HR%: ${(d.HR_per_PA*100).toFixed(2)}%`
      );
    })
    .on("mousemove",e=>{
      tooltip.style("left",e.pageX+12+"px").style("top",e.pageY-10+"px");
    })
    .on("mouseleave",()=>tooltip.style("opacity",0));

  const legend=d3.select("#legend-container");
  data.forEach(d=>{
    const item=legend.append("div").attr("class","legend-item");
    item.append("span")
      .attr("class","legend-swatch")
      .style("background-color",color(d.decade));
    item.append("span").text(d.label);
  });
}

function drawScatterFIP(){
  d3.select("#scatter-container").selectAll("*").remove();
  d3.select("#legend-container").selectAll("*").remove();
  scatterTitle.textContent="Decade Pitching Dumbbell Chart: ERA → FIP (positioned by K/9)";

  const data=filteredDecadePitching();
  if(!data.length)return;

  const svg=d3.select("#scatter-container").append("svg")
    .attr("width","100%")
    .attr("height","100%");
  const bbox=svg.node().getBoundingClientRect();
  const width=bbox.width;
  const height=bbox.height;
  const margin={top:50,right:30,bottom:50,left:80};
  const innerWidth=width-margin.left-margin.right;
  const innerHeight=height-margin.top-margin.bottom;
  const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x=d3.scaleLinear()
    .domain([d3.min(data,d=>d.ERA),d3.max(data,d=>d.FIP)])
    .nice()
    .range([0,innerWidth]);

  const y=d3.scaleLinear()
    .domain(d3.extent(data,d=>d.K_per_9))
    .nice()
    .range([innerHeight,0]);

  const color=d3.scaleOrdinal()
    .domain(data.map(d=>d.decade))
    .range(["#3b82f6","#a855f7","#ef4444","#fb923c","#22c55e"]);

  g.append("g")
    .attr("transform",`translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  g.append("g").call(d3.axisLeft(y));

  g.append("text")
    .attr("x",innerWidth/2)
    .attr("y",-20)
    .attr("text-anchor","middle")
    .attr("fill","#111827")
    .text("Decade Pitching: ERA (left) → FIP (right), positioned by K/9");

  const rows=g.selectAll(".dumbbell")
    .data(data)
    .enter()
    .append("g")
    .attr("class","dumbbell")
    .attr("transform",d=>`translate(0,${y(d.K_per_9)})`);

  rows.append("line")
    .attr("x1",d=>x(d.ERA))
    .attr("x2",d=>x(d.FIP))
    .attr("stroke","#9ca3af")
    .attr("stroke-width",2);

  rows.append("circle")
    .attr("cx",d=>x(d.ERA))
    .attr("r",7)
    .attr("fill",d=>color(d.decade))
    .on("mouseenter",(e,d)=>{
      tooltip.style("opacity",1).html(
        `<strong>${d.label}</strong><br>`+
        `ERA: ${d.ERA.toFixed(2)}<br>`+
        `K/9: ${d.K_per_9.toFixed(1)}`
      );
    })
    .on("mousemove",e=>{
      tooltip.style("left",e.pageX+12+"px").style("top",e.pageY-10+"px");
    })
    .on("mouseleave",()=>tooltip.style("opacity",0));

  rows.append("circle")
    .attr("cx",d=>x(d.FIP))
    .attr("r",7)
    .attr("fill",d=>color(d.decade))
    .on("mouseenter",(e,d)=>{
      tooltip.style("opacity",1).html(
        `<strong>${d.label}</strong><br>`+
        `FIP: ${d.FIP.toFixed(2)}<br>`+
        `K/9: ${d.K_per_9.toFixed(1)}`
      );
    })
    .on("mousemove",e=>{
      tooltip.style("left",e.pageX+12+"px").style("top",e.pageY-10+"px");
    })
    .on("mouseleave",()=>tooltip.style("opacity",0));

  const legend=d3.select("#legend-container");
  data.forEach(d=>{
    const item=legend.append("div").attr("class","legend-item");
    item.append("span")
      .attr("class","legend-swatch")
      .style("background-color",color(d.decade));
    item.append("span").text(d.label);
  });
}

function setEraButtons(activeBtn){
  [btnEraAll,btnEraExpansion,btnEraSteroid,btnEraModern].forEach(b=>b.classList.remove("era-active"));
  activeBtn.classList.add("era-active");
}

btnOPS.addEventListener("click",()=>{
  currentView="ops";
  btnOPS.classList.add("active");
  btnFIP.classList.remove("active");
  drawScatterOPS();
});

btnFIP.addEventListener("click",()=>{
  currentView="fip";
  btnFIP.classList.add("active");
  btnOPS.classList.remove("active");
  drawScatterFIP();
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
