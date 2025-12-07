// ============================================================
// heatmap.js - View B (Hour × Weekday Heatmap)
// ============================================================

import { setHeatmapFilter, filters } from "./main.js";

// ============================================================
// updateHeatmap - rebuilds entire heatmap on each renderAll()
// ============================================================
export function updateHeatmap(data) {
  const root = d3.select("#heatmap-root");
  root.selectAll("*").remove();

  const width = root.node().clientWidth;
  const height = 410;

  const margin = { top: 40, right: 30, bottom: 60, left: 70 };

  const svg = root.append("svg")
    .attr("width", width)
    .attr("height", height);

  // ------------------------------------------------------------
  // 1. Build grid of hour × weekday counts
  // ------------------------------------------------------------
  const hours = d3.range(0, 24);
  const weekdays = d3.range(0, 7);

  const nested = d3.rollup(
    data,
    (v) => v.length,
    (d) => +d.hour,
    (d) => +d.weekday
  );

  const cells = [];
  hours.forEach((h) => {
    weekdays.forEach((w) => {
      cells.push({
        hour: h,
        weekday: w,
        count: nested.get(h)?.get(w) || 0
      });
    });
  });

  const counts = cells.map((d) => d.count);
  const maxVal = d3.max(counts) || 0;
  const minVal = d3.min(counts) ?? 0;

  const color = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(d3.interpolateOranges);

  const gridW = width - margin.left - margin.right;
  const gridH = height - margin.top - margin.bottom;

  const cellW = gridW / 7;
  const cellH = gridH / 24;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ------------------------------------------------------------
  // 2. Draw heatmap cells
  // ------------------------------------------------------------
  g.selectAll("rect.heat-cell")
    .data(cells)
    .enter()
    .append("rect")
    .attr("class", "heat-cell")
    .attr("x", (d) => d.weekday * cellW)
    .attr("y", (d) => d.hour * cellH)
    .attr("width", cellW)
    .attr("height", cellH)
    .attr("fill", (d) => color(d.count))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.6)
    .style("cursor", "pointer")
    .on("click", (_, d) => setHeatmapFilter(d.hour, d.weekday));

  // ------------------------------------------------------------
  // 3. Selected outline (hour + weekday selection)
  // ------------------------------------------------------------
  if (filters.hour !== null && filters.weekday !== null) {
    g.append("rect")
      .attr("x", filters.weekday * cellW)
      .attr("y", filters.hour * cellH)
      .attr("width", cellW)
      .attr("height", cellH)
      .attr("fill", "none")
      .attr("stroke", "#1e3a8a")
      .attr("stroke-width", 3);
  }

  // ------------------------------------------------------------
  // 4. Axes
  // ------------------------------------------------------------
  const yScale = d3.scaleBand().domain(hours).range([0, gridH]);
  const xScale = d3.scaleBand().domain(weekdays).range([0, gridW]);

  g.append("g").call(d3.axisLeft(yScale).tickFormat(formatHourLabel));

  g.append("g")
    .attr("transform", `translate(0,${gridH})`)
    .call(
      d3.axisBottom(xScale).tickFormat((w) =>
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w]
      )
    );

  // ------------------------------------------------------------
  // 5. Title
  // ------------------------------------------------------------
  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 22)
    .attr("font-size", "17px")
    .attr("font-weight", 600)
    .text("Crash counts by hour and weekday");

  // ------------------------------------------------------------
  // 6. Legend
  // ------------------------------------------------------------
  drawLegend(svg, color, minVal, maxVal, margin, height);
}

// ============================================================
// Format hours for axis
// ============================================================
function formatHourLabel(h) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

// ============================================================
// Vertical gradient legend
// ============================================================

function drawLegend(svg, color, minVal, maxVal, margin, height) {
  const gridH = height - margin.top - margin.bottom;
  const legendW = 12;
  const legendH = Math.min(240, gridH * 0.7);

  const legendX = 20;
  const legendY = margin.top + (gridH - legendH) / 2;

  // Pixel --> data scale
  const scale = d3.scaleLinear()
    .domain([legendH, 0])       // top pixel = max count
    .range([minVal, maxVal]);

  // ------------------------------------------------------------
  // Gradient bar
  // ------------------------------------------------------------
  svg.append("g")
    .selectAll("rect")
    .data(d3.range(legendH))
    .enter()
    .append("rect")
    .attr("x", legendX)
    .attr("y", d => legendY + d)
    .attr("width", legendW)
    .attr("height", 1)
    .attr("fill", d => color(scale(d)));

  // ------------------------------------------------------------
  // Labels for legend 
  // ------------------------------------------------------------

  // Top label (max)
  svg.append("text")
    .attr("x", legendX + legendW / 2)
    .attr("y", legendY - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .text(maxVal);

  // Bottom label (min)
  svg.append("text")
    .attr("x", legendX + legendW / 2)
    .attr("y", legendY + legendH + 14)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .text(minVal);
}
