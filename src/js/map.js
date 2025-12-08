// ============================================================
// map.js - View A (Leaflet basemap and custom canvas overlay)
// ============================================================

import { filters } from "./main.js";

// ------------------------------------------------------------
// Module-level state
// ------------------------------------------------------------
let map;
let pointCanvas;
let ctx;
let quadtree;
let latestData = [];

const MAP_ID = "map-root";

// Colors
const COLOR_FATAL = "#b91c1c";
const COLOR_INJURY = "#f97316";
const COLOR_PDO = "#3b82f6";

// ============================================================
// initMap - called once from main.js
// ============================================================
export function initMap() {
  // 1. Create Leaflet map
  map = L.map(MAP_ID, {
    center: [40.7128, -74.0060],
    zoom: 11,
    zoomControl: true
  });

  // 2. Positron tiles
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> - Positron',
      maxZoom: 18
    }
  ).addTo(map);

  // 3. Canvas overlay positioned in #map-root
  const mapRoot = document.getElementById(MAP_ID);
  if (getComputedStyle(mapRoot).position === "static") {
    mapRoot.style.position = "relative";
  }

  pointCanvas = document.createElement("canvas");
  pointCanvas.id = "map-points-canvas";
  pointCanvas.style.position = "absolute";
  pointCanvas.style.top = "0";
  pointCanvas.style.left = "0";
  pointCanvas.style.width = "100%";
  pointCanvas.style.height = "100%";
  pointCanvas.style.pointerEvents = "auto"; //  hover
  pointCanvas.style.zIndex = "450";
  mapRoot.appendChild(pointCanvas);

  ctx = pointCanvas.getContext("2d");

  // 4. Reusable tooltip div
  const tooltip = document.createElement("div");
  tooltip.className = "hover-tooltip";
  tooltip.style.opacity = 0;
  mapRoot.appendChild(tooltip);

  // ------------------------------------------------------------
  // Hover logic
  // ------------------------------------------------------------
  pointCanvas.addEventListener("mousemove", (evt) => {
    if (!quadtree) return;

    const rect = pointCanvas.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const my = evt.clientY - rect.top;

    let nearest = null;
    let minDist2 = 64; 

    quadtree.visit((node) => {
      const d = node.data;
      if (!d) return false;

      const dx = mx - d.x;
      const dy = my - d.y;
      const dist2 = dx * dx + dy * dy;

      if (dist2 < minDist2) {
        minDist2 = dist2;
        nearest = d;
      }
      return false;
    });

    if (!nearest) {
      tooltip.style.opacity = 0;
      return;
    }

    tooltip.style.left = `${mx + 12}px`;
    tooltip.style.top = `${my + 12}px`;
    tooltip.style.opacity = 1;
    tooltip.innerHTML = `
      <b>${nearest.severity}</b><br/>
      Borough: ${nearest.borough || "Unknown"}<br/>
      Hour: ${nearest.hour}<br/>
      Weekday: ${nearest.weekday}
    `;
  });

  pointCanvas.addEventListener("mouseleave", () => {
    tooltip.style.opacity = 0;
  });

  // ------------------------------------------------------------
  // Redraw when map view changes
  // ------------------------------------------------------------
  map.on("zoomend moveend resize", () => {
    if (latestData.length) redraw();
  });

  // ------------------------------------------------------------
  // Realign hack - handles layout shifts
  // ------------------------------------------------------------
  const realign = () => {
    if (!map || !latestData.length) return;
    map.invalidateSize();
    redraw();
  };

  [0, 200, 400, 800].forEach((t) => setTimeout(realign, t));
}

// Optional recenter helper
export function recenterMap() {
  if (map) map.setView([40.7128, -74.0060], 11);
}

// ============================================================
// updateMap - called from main.js whenever filters change
// ============================================================
export function updateMap(data) {
  latestData = data || [];
  redraw();
}

// ============================================================
// redraw - project points + draw + legend
// ============================================================
function redraw() {
  if (!map || !pointCanvas || !ctx) return;

  const size = map.getSize();
  pointCanvas.width = size.x;
  pointCanvas.height = size.y;

  ctx.clearRect(0, 0, pointCanvas.width, pointCanvas.height);

  // Project crashes into container-pixel coords
  const projected = latestData
    .map((d) => {
      const lat = +d.latitude;
      const lng = +d.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const p = map.latLngToContainerPoint([lat, lng]);
      return { ...d, x: p.x, y: p.y };
    })
    .filter(Boolean);

  // QuadTree for hover
  quadtree = d3
    .quadtree()
    .x((d) => d.x)
    .y((d) => d.y)
    .addAll(projected);

  drawPoints(projected);
  drawLegend(latestData);
}

// ============================================================
// drawPoints - severity colors + optional fatal rings
// ============================================================
function drawPoints(points) {
  if (!points.length) return;

  points.forEach((d) => {
    let color, alpha;

    if (d.severity === "fatal") {
      color = COLOR_FATAL;
      alpha = 0.9;
    } else if (d.severity === "injury") {
      color = COLOR_INJURY;
      alpha = 0.7;
    } else {
      color = COLOR_PDO;
      alpha = 0.45;
    }

    ctx.beginPath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.arc(d.x, d.y, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Optional ring highlight
    if (filters.markFatal && d.severity === "fatal") {
      ctx.beginPath();
      ctx.globalAlpha = 1;
      ctx.strokeStyle ="rgba(220, 38, 38, 1.0)";
      ctx.lineWidth = 1.4;
      ctx.arc(d.x, d.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  ctx.globalAlpha = 1;
}

// ============================================================
// drawLegend - counts by severity
// ============================================================
function drawLegend(data) {
  d3.select(`#${MAP_ID} .map-legend`).remove();

  const fatalCount = data.filter((d) => d.severity === "fatal").length;
  const injuryCount = data.filter((d) => d.severity === "injury").length;
  const pdoCount = data.filter((d) => d.severity === "pdo").length;

  const legend = d3
    .select(`#${MAP_ID}`)
    .append("div")
    .attr("class", "map-legend");

  [
    { label: `Fatal (${fatalCount})`, color: COLOR_FATAL },
    { label: `Injury (${injuryCount})`, color: COLOR_INJURY },
    { label: `PDO (${pdoCount})`, color: COLOR_PDO }
  ].forEach((item) => {
    const row = legend.append("div").attr("class", "map-legend-item");

    row
      .append("div")
      .attr("class", "legend-swatch")
      .style("background", item.color);

    row.append("span").text(item.label);
  });
}
