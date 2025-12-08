// ============================================================
// factors.js - View C (top crash factors + injury burden)
// ============================================================

import { setFactorFilter, filters } from "./main.js";

// ============================================================
// updateFactors - rebuilds factor chart on every renderAll()
// ============================================================
export function updateFactors(data, filters) {
  const root = d3.select("#factors-root");
  root.selectAll("*").remove();

  const width = root.node().clientWidth;
  const height = root.node().clientHeight || 360;

  const svg = root.append("svg")
    .attr("width", width)
    .attr("height", height);

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
    injRate: stats.injuries / stats.count
  }))
    .filter(d => d.factor !== "Other / unknown")
    .sort((a, b) => d3.descending(a.count, b.count))
    .slice(0, 10);

  if (entries.length === 0) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("No data for selected filters");
    return;
  }

  // ------------------------------------------------------------
  // 2. Scales (preserve original layout)
  // ------------------------------------------------------------
  const x0 = 150;              // left offset for bars
  const x = d3.scaleLinear()
    .domain([0, d3.max(entries, d => d.count)])
    .range([x0, width - 30]);

  const y = d3.scaleBand()
    .domain(entries.map(d => d.factor))
    .range([25, height - 10])   
    .padding(0.5);

  const minRate = d3.min(entries, d => d.injRate);
  const maxRate = d3.max(entries, d => d.injRate);

  const color = d3.scaleSequential()
    .domain([minRate, maxRate])
    .interpolator(t => d3.interpolatePurples(0.25 + 0.65 * t));

  // ------------------------------------------------------------
  // 3. Bars
  // ------------------------------------------------------------
  svg.append("g")
    .selectAll("rect.factor-bar")
    .data(entries)
    .enter()
    .append("rect")
    .attr("class", "factor-bar")
    .attr("x", x0)
    .attr("y", d => y(d.factor))
    .attr("width", d => x(d.count) - x0)
    .attr("height", y.bandwidth())
    .attr("fill", d => color(d.injRate))
    .style("cursor", "pointer")
    .on("click", (_, d) => setFactorFilter(d.factor));

  // ------------------------------------------------------------
  // 4. Selection outline 
  // ------------------------------------------------------------
  if (filters.factor) {
    const selected = entries.find(e => e.factor === filters.factor);
    if (selected) {
      svg.append("rect")
        .attr("x", x0)
        .attr("y", y(selected.factor))
        .attr("width", x(selected.count) - x0)
        .attr("height", y.bandwidth())
        .attr("fill", "none")
        .attr("stroke", "#1e3a8a")
        .attr("stroke-width", 3);
    }
  }

  // ------------------------------------------------------------
  // 5. Y-axis labels 
  // ------------------------------------------------------------
  const axisG = svg.append("g")
    .attr("transform", `translate(${x0 - .5 }, 0)`)
    .call(d3.axisLeft(y));

  // remove axis lines/ticks
  axisG.select(".domain").remove();
  axisG.selectAll("line").remove();

  // // wrap labels 
  axisG.selectAll("text")
    .attr("class", "factor-label")
    .call(wrapText, 130);

  // ------------------------------------------------------------
  // 6. Title 
  // ------------------------------------------------------------
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .attr("font-size", "17px")     
    .style("font-weight", 600)
    .text("Top crash factors and injury burden");

  // ------------------------------------------------------------
  // 7. Legend (severity color scale)
  // ------------------------------------------------------------
  const lastFactor = entries[entries.length - 1].factor;
  const lastBarBottom = y(lastFactor) + y.bandwidth();

  drawSeverityLegend(svg, color, minRate, maxRate, width, height, lastBarBottom);
}

// ============================================================
// Legend helper 
// ============================================================
function drawSeverityLegend(svg, colorScale, minRate, maxRate, width, height, lastBarBottom) {
  const steps = 5;
  const legendW = 180;
  const legendH = 12;
  const legendX = 150;

  if (!isFinite(minRate) || !isFinite(maxRate) || minRate === maxRate) return;

  let legendY = lastBarBottom + 22;

  const neededHeight = legendY + legendH + 20;
  if (neededHeight > height) {
    svg.attr("height", neededHeight);
    height = neededHeight;
  }

  const stepValues = d3.range(steps).map(i =>
    minRate + (i / (steps - 1)) * (maxRate - minRate)
  );

  const stepW = legendW / steps;
  const fmt = d3.format(".2f");

  const g = svg.append("g");

  // title
  g.append("text")
    .attr("x", legendX)
    .attr("y", legendY - 4)
    .attr("font-size", "11px")
    .text("Avg injuries per crash");

  // colored blocks
  g.selectAll("rect")
    .data(stepValues)
    .enter()
    .append("rect")
    .attr("x", (d, i) => legendX + i * stepW)
    .attr("y", legendY)
    .attr("width", stepW)
    .attr("height", legendH)
    .attr("fill", d => colorScale(d));

  // numeric labels
  g.selectAll("text.legend-label")
    .data(stepValues)
    .enter()
    .append("text")
    .attr("x", (d, i) => legendX + i * stepW + stepW / 2)
    .attr("y", legendY + legendH + 12)
    .attr("font-size", "10px")
    .attr("text-anchor", "middle")
    .text(d => fmt(d));
}

// ============================================================
// wrapText - fixed width / spacing bug for factor labels
// ============================================================

function wrapText(text, width) {
  text.each(function () {
    const words = this.textContent.split(/\s+/);
    const lines = [];
    let line = [];

    // Build wrapped lines 
    words.forEach(word => {
      const testLine = [...line, word].join(" ");
      const temp = d3.select(this)
        .text(testLine)
        .node()
        .getComputedTextLength();

      if (temp > width && line.length) {
        lines.push(line.join(" "));
        line = [word];
      } else {
        line = [...line, word];
      }
    });

    if (line.length) lines.push(line.join(" "));

    const textSel = d3.select(this).text(null);

 
    const totalHeight = lines.length * 1.1;
    const offset = -(totalHeight - 1.1) / 2;

    lines.forEach((l, i) => {
      textSel.append("tspan")
        .text(l)
        .attr("x", -10)
        .attr("dy", `${i === 0 ? offset : 1.1}em`);
    });
  });
}
