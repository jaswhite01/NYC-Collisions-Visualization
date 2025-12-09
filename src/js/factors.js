// ============================================================
// factors.js - View C (top crash factors + injury burden)
// ============================================================

import { setFactorFilter, filters } from "./main.js";

// ============================================================
// updateFactors - rebuilds factor chart on every renderAll()
// ============================================================
export function updateFactors(data) {
  const root = d3.select("#factors-root");
  root.selectAll("*").remove();

  const width = root.node().clientWidth || 360;

  // ------------------------------------------------------------
  // 1. Computinh Top 10 factors + injury rate
  // ------------------------------------------------------------
  const grouped = d3.rollup(
    data,
    v => ({
      count: v.length,
      injuries: d3.sum(v, d => (+d.inj_person) + (+d.killed_person))
    }),
    d => d.factor_clean
  );

  let entries = Array.from(grouped, ([factor, stats]) => ({
    factor,
    count: stats.count,
    injRate: stats.count > 0 ? stats.injuries / stats.count : 0
  }))
    .filter(d => d.factor && d.factor !== "Other / unknown")
    .sort((a, b) => d3.descending(a.count, b.count))
    .slice(0, 10);

  if (entries.length === 0) {
    const svgEmpty = root.append("svg")
      .attr("width", width)
      .attr("height", 120);

    svgEmpty.append("text")
      .attr("x", width / 2)
      .attr("y", 60)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .text("No data for selected filters");
    return;
  }

  // ------------------------------------------------------------
  // 2. Layout constants and dynamic height
  // ------------------------------------------------------------
  const x0 = 170;            
  const barHeight = 20;
  const barGap = 10;

  const topMargin = 50;
  const bottomMargin = 10;
  const legendBlockHeight = 40;

  const nBars = entries.length;
  const chartHeight = nBars * (barHeight + barGap);
  const svgHeight = topMargin + chartHeight + bottomMargin + legendBlockHeight;

  const svg = root.append("svg")
    .attr("width", width)
    .attr("height", svgHeight);

  // ------------------------------------------------------------
  // 3. Scales
  // ------------------------------------------------------------
  const x = d3.scaleLinear()
    .domain([0, d3.max(entries, d => d.count) || 1])
    .range([x0, width - 30]);

  const y = d3.scaleBand()
    .domain(entries.map(d => d.factor))
    .range([topMargin, topMargin + chartHeight])
    .paddingInner(0.2)
    .paddingOuter(0.05);

  const minRate = d3.min(entries, d => d.injRate);
  const maxRate = d3.max(entries, d => d.injRate);
  const rateLo = Number.isFinite(minRate) ? minRate : 0;
  const rateHi = Number.isFinite(maxRate) && maxRate > rateLo ? maxRate : rateLo + 0.01;

  const color = d3.scaleSequential()
    .domain([rateLo, rateHi])
    .interpolator(t => d3.interpolatePurples(0.25 + 0.65 * t));

  // ------------------------------------------------------------
  // 4. Bars
  // ------------------------------------------------------------
  svg.append("g")
    .selectAll("rect.factor-bar")
    .data(entries)
    .enter()
    .append("rect")
    .attr("class", "factor-bar")
    .attr("x", x0)
    .attr("y", d => y(d.factor))
    .attr("width", d => Math.max(0, x(d.count) - x0))
    .attr("height", y.bandwidth())
    .attr("fill", d => color(d.injRate))
    .style("cursor", "pointer")
    .on("click", (_, d) => setFactorFilter(d.factor));

  // ------------------------------------------------------------
  // 5. Selection outline
  // ------------------------------------------------------------
  if (filters.factor) {
    const selected = entries.find(e => e.factor === filters.factor);
    if (selected) {
      svg.append("rect")
        .attr("x", x0)
        .attr("y", y(selected.factor))
        .attr("width", Math.max(0, x(selected.count) - x0))
        .attr("height", y.bandwidth())
        .attr("fill", "none")
        .attr("stroke", "#1e3a8a")
        .attr("stroke-width", 3);
    }
  }

  // ------------------------------------------------------------
  // 6. Y-axis labels 
  // ------------------------------------------------------------
  const axisG = svg.append("g")
    .attr("transform", `translate(${x0 - 10}, 0)`)
    .call(d3.axisLeft(y));

  // Remove axis line/ticks
  axisG.select(".domain").remove();
  axisG.selectAll("line").remove();

  axisG.selectAll("text")
    .attr("class", "factor-label")
    .style("font-size", "11px")
    .call(wrapText, 130); 

  // ------------------------------------------------------------
  // 7. Title
  // ------------------------------------------------------------
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 24)
    .attr("text-anchor", "middle")
    .attr("font-size", "17px")
    .style("font-weight", 600)
    .text("Top crash factors and injury burden");

  // ------------------------------------------------------------
  // 8. Legend (severity color scale)
  // ------------------------------------------------------------
  const legendTop = topMargin + chartHeight + 25;
  drawSeverityLegend(svg, color, rateLo, rateHi, width, legendTop);
}

// ============================================================
// Legend helper 
// ============================================================
function drawSeverityLegend(svg, colorScale, minRate, maxRate, width, legendTop) {
  const steps = 5;
  const legendW = 180;
  const legendH = 12;
  const legendX = 170;

  if (!isFinite(minRate) || !isFinite(maxRate) || minRate === maxRate) return;

  const stepValues = d3.range(steps).map(i =>
    minRate + (i / (steps - 1)) * (maxRate - minRate)
  );

  const stepW = legendW / steps;
  const fmt = d3.format(".2f");

  const g = svg.append("g");

  // title
  g.append("text")
    .attr("x", legendX)
    .attr("y", legendTop - 4)
    .attr("font-size", "11px")
    .text("Avg injuries per crash");

  // colored blocks
  g.selectAll("rect.legend-block")
    .data(stepValues)
    .enter()
    .append("rect")
    .attr("class", "legend-block")
    .attr("x", (d, i) => legendX + i * stepW)
    .attr("y", legendTop)
    .attr("width", stepW)
    .attr("height", legendH)
    .attr("fill", d => colorScale(d));

  // numeric labels
  g.selectAll("text.legend-label")
    .data(stepValues)
    .enter()
    .append("text")
    .attr("class", "legend-label")
    .attr("x", (d, i) => legendX + i * stepW + stepW / 2)
    .attr("y", legendTop + legendH + 12)
    .attr("font-size", "10px")
    .attr("text-anchor", "middle")
    .text(d => fmt(d));
}

// ============================================================
// wrapText - fixes bug where spacing caused legend/title to disappear when <10 factors
// ============================================================
function wrapText(selection, width) {
  selection.each(function () {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const x = text.attr("x") || 0;
    const y = text.attr("y");
    const lineHeight = 1.1; 

    text.text(null);

    let tspan = text
      .append("tspan")
      .attr("x", x)
      .attr("y", y)
      .attr("dy", "0em");

    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width && line.length > 1) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text
          .append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", `${++lineNumber * lineHeight}em`)
          .text(word);
      }
    }
  });
}
