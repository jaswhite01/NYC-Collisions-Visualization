// src/js/main.js

import { initMap } from "./map.js";
import { initHeatmap } from "./heatmap.js";
import { renderFactors } from "./factors.js";


document.addEventListener("DOMContentLoaded", () => {
  initMap(); 
  initHeatmap();
  renderFactors();
});
