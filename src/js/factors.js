// View C - Contributing Factors Bar Chart 
// src/js/factors.js
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export async function renderFactors(rootSelector = "#factors-root") {
  const root = d3.select(rootSelector);
  if (root.empty()) return;

  const data = await d3.csv("data_proc/factors_top10.csv", d3.autoType);
  if (!data.length) return;

  // Clear previous 
  root.selectAll("*").remove();

  // Panel size from the card
  const bbox   = root.node().getBoundingClientRect();
  const width  = bbox.width  || 480;
  const panelH = bbox.height || 360;

  // Layout
  const margin = {
    top: 70,
    right: 32,
    bottom: 40,
    left: 120
  };

  const innerWidth  = width  - margin.left - margin.right;
  const innerHeight = panelH - margin.top  - margin.bottom;

  const svg = root
    .append("svg")
    .attr("class", "factors-chart")
    .attr("width", width)
    .attr("height", panelH);

  // Scales 

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.crashes)]).nice()
    .range([margin.left, margin.left + innerWidth]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.factor_clean))
    .range([margin.top, margin.top + innerHeight])
    .padding(0.2);

  const injExtent = d3.extent(data, d => d.inj_per_crash);
  const color = d3.scaleSequential()
    .domain(injExtent)              // low to high injury per crash
    .interpolator(d3.interpolateOrRd);

  // Title 

  svg.append("text")
    .attr("class", "factors-title")
    .attr("x", margin.left)
    .attr("y", margin.top - 35)
    .attr("text-anchor", "start")
    .attr("font-size", 16)
    .attr("font-weight", 600)
    .text("Top crash factors and injury burden");

  //  Bars 

  const bars = svg.append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
      .attr("x", x(0))
      .attr("y", d => y(d.factor_clean))
      .attr("height", y.bandwidth())
      .attr("width", d => x(d.crashes) - x(0))
      .attr("fill", d => color(d.inj_per_crash));

  // Simple tooltip
  bars.append("title")
    .text(d => {
      const crashes = d.crashes.toLocaleString?.() ?? d.crashes;
      const injured = d.injured.toLocaleString?.() ?? d.injured;
      const ipc = d.inj_per_crash?.toFixed?.(2) ?? d.inj_per_crash;
      return `${d.factor_clean}
    Crashes: ${crashes}
    Injured: ${injured}
    Injured per crash: ${ipc}`;
    });

  // Axes 

  const xAxis = d3.axisTop(x)
    .ticks(4)
    .tickFormat(d3.format("~s"));

  svg.append("g")
    .attr("transform", `translate(0,${margin.top})`)
    .call(xAxis)
    .call(g => g.select(".domain").remove());

  const yAxis = d3.axisLeft(y);

  const yAxisG = svg.append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis)
    .call(g => g.select(".domain").remove());

  // Wrap long factor labels
  yAxisG.selectAll(".tick text").call(wrapText, margin.left - 10);

  // Step block Legend 

  const [minIPC, maxIPC] = injExtent;

  const legendWidth  = 140;
  const legendHeight = 12;
  const steps        = 5;              

  const legendX = margin.left;
  const legendY = panelH - 30;   // a bit above the bottom

  const legendGroup = svg.append("g")
    .attr("class", "factors-legend")
    .attr("transform", `translate(${legendX}, ${legendY})`);

  const stepWidth = legendWidth / steps;

  // Map step index ,injury per crash value
  const stepScale = d3.scaleLinear()
    .domain([0, steps - 1])
    .range([minIPC, maxIPC]);

  // Blocks
  legendGroup.selectAll("rect")
    .data(d3.range(steps))
    .join("rect")
      .attr("x", i => i * stepWidth)
      .attr("y", 0)
      .attr("width", stepWidth + 0.5)   // tiny overlap to avoid gaps
      .attr("height", legendHeight)
      .attr("fill", i => color(stepScale(i)))
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 0.5);

  // Labels- min and max under the bar
  const labelFmt = d3.format(".2f");

  legendGroup.append("text")
    .attr("x", 0)
    .attr("y", legendHeight + 12)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "start")
    .text(labelFmt(minIPC));

  legendGroup.append("text")
    .attr("x", legendWidth)
    .attr("y", legendHeight + 12)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "end")
    .text(labelFmt(maxIPC));

  // Small caption above blocks
  legendGroup.append("text")
    .attr("x", 0)
    .attr("y", -4)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "start")
    .text("Higher injury per crash →");
}

// Simple text wrapper for axis labels
function wrapText(textSelection, maxWidth) {
  textSelection.each(function () {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1;
    const x = text.attr("x") || 0;
    const y = text.attr("y") || 0;
    const dy = parseFloat(text.attr("dy") || 0);

    let tspan = text
      .text(null)
      .append("tspan")
      .attr("x", x)
      .attr("y", y)
      .attr("dy", dy + "em");

    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > maxWidth) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text
          .append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", (++lineNumber * lineHeight + dy) + "em")
          .text(word);
      }
    }
  });
}
