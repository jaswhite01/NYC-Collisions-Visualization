import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const MAP_ROOT_ID = "map-root";

export async function initMap() {
  const container = document.getElementById(MAP_ROOT_ID);
  if (!container) {
    console.error(`No element with id="${MAP_ROOT_ID}" found.`);
    return;
  }

  // Clear
  container.innerHTML = "";

  // Wrapper for SVG + canvas
  const wrapper = document.createElement("div");
  wrapper.className = "map-wrap";
  container.appendChild(wrapper);

  // Legend overlay
  const legend = document.createElement("div");
  legend.className = "map-legend";
  legend.innerHTML = `
    <p class="map-legend-title">Crash severity</p>
    <ul class="map-legend-list">
      <li class="map-legend-item">
        <span class="legend-swatch legend-fatal"></span>
        Fatal crash
      </li>
      <li class="map-legend-item">
        <span class="legend-swatch legend-injury"></span>
        Injury crash
      </li>
      <li class="map-legend-item">
        <span class="legend-swatch legend-pdo"></span>
        Property damage only
      </li>
    </ul>
  `;
  wrapper.appendChild(legend);

  // Tooltip overlay (for hover info)
  const tooltip = document.createElement("div");
  tooltip.className = "map-tooltip";
  wrapper.appendChild(tooltip);

  // SVG for borough outlines and mouse capture
  const svg = d3
    .select(wrapper)
    .append("svg")
    .attr("class", "map-svg");

  // Canvas for points
  const canvas = document.createElement("canvas");
  canvas.className = "map-canvas";
  wrapper.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const projection = d3.geoMercator();
  const path = d3.geoPath(projection);

  let geojson;
  let crashes;

  // quadtree + currently hovered crash
  let quadtree = null;
  let hoveredCrash = null;

  try {
    [geojson, crashes] = await Promise.all([
      d3.json("data_geo/boroughs.geojson"),
      d3.csv("data_proc/crashes_clean.csv", rowParser)
    ]);
  } catch (err) {
    console.error("Error loading map data:", err);
    return;
  }

  console.log("GeoJSON features:", geojson.features.length);
  console.log("Crashes loaded:", crashes.length);

  function resizeAndRedraw() {
    const { width, height } = wrapper.getBoundingClientRect();
    if (!width || !height) return;

    // Resize SVG
    svg.attr("width", width).attr("height", height);

    // Resize canvas (handle devicePixelRatio)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fit projection to geojson
    projection.fitSize([width, height], geojson);

    // Draw borough outlines
    svg.selectAll("path").remove();
    svg
      .selectAll("path")
      .data(geojson.features)
      .enter()
      .append("path")
      .attr("class", "borough-outline")
      .attr("d", path);

    // Transparent rect over SVG to capture mouse events
    const hitRect = svg
      .selectAll(".map-hit-rect")
      .data([null]);
    hitRect
      .enter()
      .append("rect")
      .attr("class", "map-hit-rect")
      .merge(hitRect)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("mousemove", handleMouseMove)
      .on("mouseleave", handleMouseLeave);

    // Project crash points
    for (const d of crashes) {
      const [lon, lat] = [d.longitude, d.latitude];
      const p = projection([lon, lat]);
      if (p) {
        d.x = p[0];
        d.y = p[1];
      } else {
        d.x = NaN;
        d.y = NaN;
      }
    }

    // Build quadtree for fast nearest-neighbor lookup
    quadtree = d3
      .quadtree()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(crashes.filter(d => !Number.isNaN(d.x) && !Number.isNaN(d.y)));

    drawPoints();
  }

  function drawPoints() {
    const { width, height } = wrapper.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const radius = 0.8;

    for (const d of crashes) {
      if (Number.isNaN(d.x) || Number.isNaN(d.y)) continue;

      let fill;
      if (d.severity === "fatal") {
        fill = "rgba(220, 38, 38, 0.9)";
      } else if (d.severity === "injury") {
        fill = "rgba(245, 158, 11, 0.6)";
      } else {
        fill = "rgba(31, 41, 55, 0.15)";
      }

      ctx.beginPath();
      ctx.fillStyle = fill;
      ctx.arc(d.x, d.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw hover highlight on top
    if (hoveredCrash && !Number.isNaN(hoveredCrash.x) && !Number.isNaN(hoveredCrash.y)) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(37, 99, 235, 0.9)"; // blue outline
      ctx.lineWidth = 2;
      ctx.arc(hoveredCrash.x, hoveredCrash.y, 4, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = "rgba(37, 99, 235, 0.9)";
      ctx.arc(hoveredCrash.x, hoveredCrash.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  function handleMouseMove(event) {
    if (!quadtree) return;

    const [mx, my] = d3.pointer(event, svg.node());
    const searchRadius = 10; // pixels

    const nearest = quadtree.find(mx, my, searchRadius);

    if (!nearest) {
      hoveredCrash = null;
      tooltip.style.opacity = 0;
      drawPoints();
      return;
    }

    hoveredCrash = nearest;
    drawPoints();

    // Position tooltip relative to wrapper
    const bounds = wrapper.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = event.clientY;

    tooltip.style.opacity = 1;
    tooltip.style.left = `${clientX - bounds.left + 12}px`;
    tooltip.style.top = `${clientY - bounds.top + 12}px`;

    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdayLabel =
      nearest.weekday != null ? weekdayNames[nearest.weekday] ?? nearest.weekday : "–";
    const hourLabel = nearest.hour != null ? `${nearest.hour}:00` : "–";
    const severityLabel =
      nearest.severity === "fatal"
        ? "Fatal"
        : nearest.severity === "injury"
        ? "Injury"
        : "Property damage only";

    tooltip.innerHTML = `
      <div><strong>Crash ${nearest.collision_id}</strong></div>
      <div>Severity: ${severityLabel}</div>
      <div>Borough: ${nearest.borough ?? "–"}</div>
      <div>ZIP: ${nearest.zip_code ?? "–"}</div>
      <div>Weekday: ${weekdayLabel}</div>
      <div>Hour: ${hourLabel}</div>
    `;
  }

  function handleMouseLeave() {
    hoveredCrash = null;
    tooltip.style.opacity = 0;
    drawPoints();
  }

  resizeAndRedraw();
  window.addEventListener("resize", resizeAndRedraw);
}

function rowParser(d) {
  return {
    collision_id: d.collision_id,
    latitude: +d.latitude,
    longitude: +d.longitude,
    borough: d.borough || null,
    zip_code: d.zip_code || null,
    hour: d.hour === "" ? null : +d.hour,
    weekday: d.weekday === "" ? null : +d.weekday,
    severity: d.severity || "pdo"
  };
}
