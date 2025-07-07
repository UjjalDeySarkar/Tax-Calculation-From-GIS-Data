// Define the projections using proj4
proj4.defs("EPSG:32645", "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs");
const utm = "EPSG:32645";
const wgs84 = "EPSG:4326";

// Initialize Leaflet map (center will be adjusted after GeoJSON loads)
const map = L.map('map').setView([0, 0], 2); // Placeholder

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Fetch and process GeoJSON
fetch("agricultural_land.geojson")
  .then(response => response.json())
  .then(data => {
    const allBounds = [];

    data.features.forEach(feature => {
      const geometry = feature.geometry;

      if (geometry.type === "MultiPolygon") {
        geometry.coordinates.forEach(polygon => {
          polygon.forEach(ring => {
            const latlngs = ring.map(([x, y]) => {
              const [lon, lat] = proj4(utm, wgs84, [x, y]);
              return [lat, lon];
            });

            // Track bounds for auto-zoom
            allBounds.push(...latlngs);

            // Draw polygon
            L.polygon(latlngs, {
              color: "green",
              weight: 2,
              fillOpacity: 0.4
            }).addTo(map).bindPopup(`
              <b>OBJECTID:</b> ${feature.properties.OBJECTID}<br>
  <b>LU_TYPE:</b> ${feature.properties.LU_TYPE}<br>
  <b>TIME_ST:</b> ${feature.properties.TIME_ST}
              `);
          });
        });
      }
    });

    // Auto-fit map to polygon area
    if (allBounds.length > 0) {
      map.fitBounds(allBounds);
    }
  })
  .catch(err => {
    console.error("Failed to load or process GeoJSON:", err);
  });
