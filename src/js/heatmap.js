// View B - Hour × Weekday heatmap
// src/js/heatmap.js
/* Right now its simple showing avg'd values for 2022-2024 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const HEATMAP_ROOT_ID = "heatmap-root";

export async function initHeatmap() {
  const root = document.getElementById(HEATMAP_ROOT_ID);
  if (!root) {
    console.warn(`No element with id="${HEATMAP_ROOT_ID}" found.`);
    return;
  }

  // Clear previous 
  root.innerHTML = "";

  // SVG size to the white card size
  const rootBox = root.getBoundingClientRect();
  const panelW = rootBox.width || 480;

  // Extra height so the legend fits  under the grid
  const panelH = (rootBox.height || 260) + 50;

  // Room for axes and labels
  const margin = { top: 40, right: 18, bottom: 55, left: 55 };
  const innerWidth = panelW - margin.left - margin.right;
  const innerHeight = panelH - margin.top - margin.bottom;

  // SVG + main group
  const svg = d3
    .select(root)
    .append("svg")
    .attr("width", panelW)
    .attr("height", panelH);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Load and aggregate data: (weekday, hour) -> count
  const weekdays = [0, 1, 2, 3, 4, 5, 6]; // 0 = Sun ... 6 = Sat
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = d3.range(24);

  let records;
  try {
    const raw = await d3.csv("data_proc/crashes_clean.csv", d => ({
      weekday: d.weekday === "" ? null : +d.weekday,
      hour: d.hour === "" ? null : +d.hour,
    }));
    records = raw.filter(d => d.weekday != null && d.hour != null);
  } catch (err) {
    console.error("Error loading heatmap data:", err);
    return;
  }

  const counts = d3.rollup(
    records,
    v => v.length,
    d => d.weekday,
    d => d.hour,
  );

  const cells = [];
  weekdays.forEach(w => {
    hours.forEach(h => {
      const row = counts.get(w);
      const value = row ? row.get(h) || 0 : 0;
      cells.push({ weekday: w, hour: h, count: value });
    });
  });

  // Scales
  const x = d3
    .scaleBand()
    .domain(weekdays)
    .range([0, innerWidth])
    .padding(0.05);

  const y = d3
    .scaleBand()
    .domain(hours)
    .range([0, innerHeight])
    .padding(0.05);

  const countsArr = cells.map(d => d.count);
  const minCount = d3.min(countsArr) ?? 0;
  const maxCount = d3.max(countsArr) || 1;

  const color = d3
    .scaleSequential(d3.interpolateBlues)
    .domain([minCount, maxCount]); 


  // Axes
  const tickHours = [0, 3, 6, 9, 12, 15, 18, 21];

  function formatHour12(h) {
    const hour = h % 24;
    const suffix = hour < 12 ? "AM" : "PM";
    let display = hour % 12;
    if (display === 0) display = 12;
    return `${display} ${suffix}`;
  }

  const xAxis = d3
    .axisBottom(x)
    .tickFormat(d => weekdayLabels[d])
    .tickSizeOuter(0);

  const yAxis = d3
    .axisLeft(y)
    .tickValues(tickHours)
    .tickFormat(formatHour12)
    .tickSizeOuter(0);

  g.append("g")
    .attr("class", "axis axis-x")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis)
    .selectAll("text")
    .style("font-size", "10px");

  g.append("g")
    .attr("class", "axis axis-y")
    .call(yAxis)
    .selectAll("text")
    .style("font-size", "11px");

  // Cells
  g.selectAll("rect.heat-cell")
    .data(cells)
    .join("rect")
    .attr("class", "heat-cell")
    .attr("x", d => x(d.weekday))
    .attr("y", d => y(d.hour))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("fill", d => (d.count === 0 ? "#f9fafb" : color(d.count)));

  // Title
  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", margin.top - 12)
    .attr("text-anchor", "start")
    .attr("font-size", 16)
    .attr("font-weight", 600)
    .text("Crash counts by hour of day and weekday");

  // Color legend (dynamic min/max ,)
  const legendWidth = 160;
  const legendHeight = 10;

  const legendGroup = g
    .append("g")
    .attr("transform", `translate(0, ${innerHeight + 20})`);

  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", "heatmap-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  gradient
    .append("stop")
    .attr("offset", "0%")
    .attr("stop-color", color(minCount));

  gradient
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", color(maxCount));

  legendGroup
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#heatmap-gradient)")
    .attr("stroke", "#d1d5db")
    .attr("stroke-width", 0.5);

  const fmt = d3.format("~s");

  legendGroup
    .append("text")
    .attr("x", 0)
    .attr("y", legendHeight + 14)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text(fmt(minCount));

  legendGroup
    .append("text")
    .attr("x", legendWidth)
    .attr("y", legendHeight + 14)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "end")
    .text(fmt(maxCount));
}
