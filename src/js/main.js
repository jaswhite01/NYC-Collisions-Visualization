// ============================================================
// main.js - Central Controller / Data Pipeline
// ============================================================

import { initMap, updateMap } from "./map.js";
import { updateHeatmap } from "./heatmap.js";
import { updateFactors } from "./factors.js";

// ============================================================
// Global filter state (View coordination)
// ============================================================
export const filters = {
  year: "all",
  borough: "all",
  monthStart: 1,
  monthEnd: 12,

  hour: null,
  weekday: null,
  factor: null,

  showFatal: true,
  showInjury: true,
  showPDO: true,

  victim_ped: true,
  victim_cyc: true,
  victim_mot: true,

  markFatal: false
};

let rawData = [];

// ============================================================
// INITIAL LOAD - map must init BEFORE first render
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    d3.csv("data_proc/crashes_clean.csv")
  ]).then(([crashes]) => {
    rawData = crashes;

    initMap();     // Leaflet map first
    renderAll();   // Then all views
    attachFilterEvents();
  });
});

// ============================================================
// FILTERING LOGIC
// applyFactorFilter = true, apply factor filter (map + heatmap)
// applyFactorFilter = false, ignore factor filter (factors chart)
// ============================================================
export function filterData(applyFactorFilter = true) {
  return rawData.filter((d) => {

    // --- YEAR ---
    if (filters.year !== "all" && d.year !== filters.year) return false;

    // --- BOROUGH ---
    if (filters.borough !== "all" && d.borough !== filters.borough) return false;

    // --- MONTH RANGE ---
    const m = +d.monthNum;
    if (m < filters.monthStart || m > filters.monthEnd) return false;

    // --- SEVERITY ---
    if (!filters.showFatal && d.severity === "fatal") return false;
    if (!filters.showInjury && d.severity === "injury") return false;
    if (!filters.showPDO && d.severity === "pdo") return false;

    // --- VICTIM CATEGORY FILTERS ---
    const ped = +d.inj_ped + +d.killed_ped;
    const cyc = +d.inj_cyc + +d.killed_cyc;
    const mot = +d.inj_mot + +d.killed_mot;

    if (!filters.victim_ped && ped > 0) return false;
    if (!filters.victim_cyc && cyc > 0) return false;
    if (!filters.victim_mot && mot > 0) return false;

    // --- HEATMAP SELECTION ---
    if (filters.hour !== null && +d.hour !== filters.hour) return false;
    if (filters.weekday !== null && +d.weekday !== filters.weekday) return false;

    // --- FACTOR SELECTION (optional) ---
    if (
      applyFactorFilter &&
      filters.factor !== null &&
      d.factor_clean !== filters.factor
    ) {
      return false;
    }

    return true;
  });
}

// ============================================================
// RENDER ALL VIEWS
// ============================================================
export function renderAll() {
  // Map + heatmap respect factor filter
  const dataForViews = filterData(true);
  updateMap(dataForViews, filters);
  updateHeatmap(dataForViews);

  // Factor chart ignores factor filter so all bars stay visible
  const dataForFactors = filterData(false);
  updateFactors(dataForFactors, filters);
}

// ============================================================
// CLEAR heatmap + factor filters when clicking onoutside views
// ============================================================
function setupOutsideClickReset() {
  document.addEventListener("click", (event) => {
    const insideHeatmap = event.target.closest("#heatmap-root");
    const insideFactors = event.target.closest("#factors-root");

    if (insideHeatmap || insideFactors) return;

    if (
      filters.hour !== null ||
      filters.weekday !== null ||
      filters.factor !== null
    ) {
      filters.hour = null;
      filters.weekday = null;
      filters.factor = null;
      renderAll();
    }
  });
}

// ============================================================
// UI FILTER EVENT HANDLERS
// ============================================================
function attachFilterEvents() {

  // --- YEAR ---
  document.getElementById("filter-year").addEventListener("change", (e) => {
    filters.year = e.target.value;
    renderAll();
  });

  // --- BOROUGH ---
  document.getElementById("filter-borough").addEventListener("change", (e) => {
    filters.borough = e.target.value;
    renderAll();
  });

  // --- MONTH RANGE ---
  document.getElementById("filter-month-start").addEventListener("input", (e) => {
    filters.monthStart = +e.target.value;
    renderAll();
  });

  document.getElementById("filter-month-end").addEventListener("input", (e) => {
    filters.monthEnd = +e.target.value;
    renderAll();
  });

  // --- SEVERITY CHECKBOXES ---
  document.getElementById("sev-fatal").addEventListener("change", (e) => {
    filters.showFatal = e.target.checked;
    renderAll();
  });

  document.getElementById("sev-injury").addEventListener("change", (e) => {
    filters.showInjury = e.target.checked;
    renderAll();
  });

  document.getElementById("sev-pdo").addEventListener("change", (e) => {
    filters.showPDO = e.target.checked;
    renderAll();
  });

  // --- VICTIM CATEGORIES ---
  document.getElementById("vic-ped").addEventListener("change", (e) => {
    filters.victim_ped = e.target.checked;
    renderAll();
  });

  document.getElementById("vic-cyc").addEventListener("change", (e) => {
    filters.victim_cyc = e.target.checked;
    renderAll();
  });

  document.getElementById("vic-mot").addEventListener("change", (e) => {
    filters.victim_mot = e.target.checked;
    renderAll();
  });

  // --- FATAL HIGHLIGHT ---
  document.getElementById("mark-fatal").addEventListener("change", (e) => {
    filters.markFatal = e.target.checked;
    renderAll();
  });

  // --- RESET BUTTON ---
  document.getElementById("reset-filters-top").addEventListener("click", () => {
    Object.assign(filters, {
      year: "all",
      borough: "all",
      monthStart: 1,
      monthEnd: 12,
      hour: null,
      weekday: null,
      factor: null,
      showFatal: true,
      showInjury: true,
      showPDO: true,
      victim_ped: true,
      victim_cyc: true,
      victim_mot: true,
      markFatal: false
    });
    renderAll();
  });
}

// ============================================================
// Selection setters (exported for Heatmap + Factors)
// ============================================================
export function setHeatmapFilter(hour, weekday) {
  const sameCell =
    filters.hour === hour &&
    filters.weekday === weekday;

  // Toggle behavior
  filters.hour = sameCell ? null : hour;
  filters.weekday = sameCell ? null : weekday;

  renderAll();
}

export function setFactorFilter(factor) {
  filters.factor = (filters.factor === factor ? null : factor);
  renderAll();
}
