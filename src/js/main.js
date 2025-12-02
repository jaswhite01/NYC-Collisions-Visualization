// src/js/main.js

import { initMap, updateMap } from "./map.js";
import { initHeatmap } from "./heatmap.js";
import { renderFactors } from "./factors.js";

// ---- GLOBAL FILTER STATE ----
export const filters = {
  hour: null,    // 0–23
  weekday: null, // 0–6 (Sun–Sat)
  factor: null   // string
};

document.addEventListener("DOMContentLoaded", () => {
  // Initial render with no filters
  initMap(filters);
  initHeatmap(filters);
  renderFactors(filters);
});

// called by heatmap -> user clicked a time block
export function updateFromHeatmap(hour, weekday) {
  filters.hour = hour;
  filters.weekday = weekday;

  // Map filtered by hour + weekday (+ factor if already set)
  updateMap(filters);

  // Factors recomputed for that hour/weekday
  renderFactors(filters);
}

// called by factors -> user clicked a factor bar
export function updateFromFactors(factor) {
  filters.factor = factor;

  // Map filtered by hour, weekday, and factor
  updateMap(filters);

  // Heatmap recomputed using only crashes with that factor
  initHeatmap(filters);

  // Factors recomputed as well (within same time window if hour/weekday set)
  renderFactors(filters);
}
