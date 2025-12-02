// View C - Contributing Factors Bar Chart 
// src/js/factors.js

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { updateFromFactors } from "./main.js";

let allCrashes = null; // cache raw crashes so we only load once

// renderFactors();
// renderFactors(filters);
// renderFactors(filters, "#custom-root");
export async function renderFactors(arg1 = {}, arg2 = "#factors-root") {
  let filters, rootSelector;
  if (typeof arg1 === "string") {
    filters = {};
    rootSelector = arg1;
  } else {
    filters = arg1 || {};
    rootSelector = arg2;
  }

  const root = d3.select(rootSelector);
  if (root.empty()) return;

  // ---- Load & cache raw crashes ----
  if (!allCrashes) {
    allCrashes = await d3.csv("data_proc/crashes_clean.csv", d => {
      // ---- injured count: sum ANY column whose name contains "injur" ----
      let injured = 0;
      for (const key of Object.keys(d)) {
        const k = key.toLowerCase();
        if (k.includes("injur")) {
          const v = +d[key];
          if (!Number.isNaN(v)) injured += v;
        }
      }

      // ---- factor: auto-detect any column with 'factor' in the name ----
      let rawFactor =
        d.factor_clean ||
        d.factor_1_clean ||
        d.factor_1 ||
        d.contributing_factor ||
        d.contributing_factor_1;

      if (!rawFactor || rawFactor === "") {
        for (const key of Object.keys(d)) {
          if (key.toLowerCase().includes("factor")) {
            const val = d[key];
            if (val && val !== "") {
              rawFactor = val;
              break;
            }
          }
        }
      }

      const factor_clean =
        rawFactor && rawFactor !== "" ? rawFactor : "Other / unknown";

      return {
        factor_clean,
        hour: d.hour === "" ? null : +d.hour,
        weekday: d.weekday === "" ? null : +d.weekday,
        injured
      };
    });
  }

  // ---- Apply time filters (if any) ----
  let records = allCrashes;

  if (filters.hour != null) {
    records = records.filter(d => d.hour === filters.hour);
  }
  if (filters.weekday != null) {
    records = records.filter(d => d.weekday === filters.weekday);
  }

  if (!records.length) {
    root.selectAll("*").remove();
    root
      .append("div")
      .attr("class", "empty-message")
      .text("No crashes for this selection.");
    return;
  }

  // ---- Aggregate by factor ----
  let data = d3
    .rollups(
      records,
      v => ({
        crashes: v.length,
        injured: d3.sum(v, d => d.injured)
      }),
      d => d.factor_clean
    )
    .map(([factor_clean, stats]) => ({
      factor_clean,
      crashes: stats.crashes,
      injured: stats.injured,
      inj_per_crash: stats.crashes ? stats.injured / stats.crashes : 0
    }));

  // keep only top 10 factors by crash count
  data = data
    .sort((a, b) => d3.descending(a.crashes, b.crashes))
    .slice(0, 10);

  // ---- Clear previous ----
  root.selectAll("*").remove();

  // ---- Panel size from the card ----
  const bbox = root.node().getBoundingClientRect();
  const width = bbox.width || 480;
  const panelH = bbox.height || 360;

  // Layout
  const margin = {
    top: 70,
    right: 32,
    bottom: 40,
    left: 120
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = panelH - margin.top - margin.bottom;

  const svg = root
    .append("svg")
    .attr("class", "factors-chart")
    .attr("width", width)
    .attr("height", panelH);

  // ---- Scales ----

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, d => d.crashes)]).nice()
    .range([margin.left, margin.left + innerWidth]);

  const y = d3
    .scaleBand()
    .domain(data.map(d => d.factor_clean))
    .range([margin.top, margin.top + innerHeight])
    .padding(0.2);

  let injExtent = d3.extent(data, d => d.inj_per_crash);

  // safety: if all inj_per_crash are identical, pad the domain slightly
  if (injExtent[0] === injExtent[1]) {
    const base = injExtent[0] ?? 0;
    injExtent = [Math.max(0, base - 0.1), base + 0.1];
  }

  const color = d3
    .scaleSequential()
    .domain(injExtent)
    .interpolator(d3.interpolateOrRd);

  // ---- Title ----

  svg
    .append("text")
    .attr("class", "factors-title")
    .attr("x", margin.left)
    .attr("y", margin.top - 35)
    .attr("text-anchor", "start")
    .attr("font-size", 16)
    .attr("font-weight", 600)
    .text("Top crash factors and injury burden");

  // ---- Bars ----

  const bars = svg
    .append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", x(0))
    .attr("y", d => y(d.factor_clean))
    .attr("height", y.bandwidth())
    .attr("width", d => x(d.crashes) - x(0))
    .attr("fill", d => color(d.inj_per_crash))
    .style("cursor", "pointer")
    .on("click", (_, d) => {
      updateFromFactors(d.factor_clean);
    });

  // ---- Tooltip ----
  bars
    .append("title")
    .text(d => {
      const crashes = d.crashes.toLocaleString?.() ?? d.crashes;
      const injured = d.injured.toLocaleString?.() ?? d.injured;
      const ipc = d.inj_per_crash?.toFixed?.(2) ?? d.inj_per_crash;
      return `${d.factor_clean}
Crashes: ${crashes}
Injured: ${injured}
Injured per crash: ${ipc}`;
    });

  // ---- Axes ----

  const xAxis = d3
    .axisTop(x)
    .ticks(4)
    .tickFormat(d3.format("~s"));

  svg
    .append("g")
    .attr("transform", `translate(0,${margin.top})`)
    .call(xAxis)
    .call(g => g.select(".domain").remove());

  const yAxis = d3.axisLeft(y);

  const yAxisG = svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis)
    .call(g => g.select(".domain").remove());

  // Wrap long factor labels
  yAxisG.selectAll(".tick text").call(wrapText, margin.left - 10);

  // ---- Step block legend ----

  const [minIPC, maxIPC] = injExtent;

  const legendWidth = 140;
  const legendHeight = 12;
  const steps = 5;

  const legendX = margin.left;
  const legendY = panelH - 30;

  const legendGroup = svg
    .append("g")
    .attr("class", "factors-legend")
    .attr("transform", `translate(${legendX}, ${legendY})`);

  const stepWidth = legendWidth / steps;

  const stepScale = d3
    .scaleLinear()
    .domain([0, steps - 1])
    .range([minIPC, maxIPC]);

  legendGroup
    .selectAll("rect")
    .data(d3.range(steps))
    .join("rect")
    .attr("x", i => i * stepWidth)
    .attr("y", 0)
    .attr("width", stepWidth + 0.5)
    .attr("height", legendHeight)
    .attr("fill", i => color(stepScale(i)))
    .attr("stroke", "#e5e7eb")
    .attr("stroke-width", 0.5);

  const labelFmt = d3.format(".2f");

  legendGroup
    .append("text")
    .attr("x", 0)
    .attr("y", legendHeight + 12)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "start")
    .text(labelFmt(minIPC));

  legendGroup
    .append("text")
    .attr("x", legendWidth)
    .attr("y", legendHeight + 12)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .attr("text-anchor", "end")
    .text(labelFmt(maxIPC));

  legendGroup
    .append("text")
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


