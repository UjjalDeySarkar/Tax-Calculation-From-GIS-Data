// Define projections using proj4
proj4.defs("EPSG:32645", "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs");
const utm = "EPSG:32645";
const wgs84 = "EPSG:4326";

// Initialize Leaflet map (center will be adjusted dynamically)
const map = L.map('map').setView([0, 0], 2); // Placeholder center

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

/**
 * Loads a GeoJSON file, transforms coordinates if needed, and adds it to the map
 * @param {string} url - Path to the GeoJSON file
 * @param {string} color - Polygon border color
 * @param {function} popupContentFn - Function to generate popup HTML from properties
 */
function showGeoJSONLayer(url, color, popupContentFn) {
  fetch(url)
    .then(response => response.json())
    .then(data => {
      const bounds = [];

      data.features.forEach(feature => {
        const geometry = feature.geometry;

        if (geometry.type === "MultiPolygon") {
          geometry.coordinates.forEach(polygon => {
            const latlngPolygon = polygon.map(ring => {
              return ring.map(coord => {
                const [x, y] = coord; // Ignore z-value if present
                const [lon, lat] = proj4(utm, wgs84, [x, y]);
                return [lat, lon];
              });
            });

            if (latlngPolygon.length > 0) {
              bounds.push(...latlngPolygon[0]);
            }

            L.polygon(latlngPolygon, {
              color: color,
              weight: 2,
              fillOpacity: 0.5
            }).addTo(map).bindPopup(popupContentFn(feature.properties));
          });
        }
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds);
      }
    })
    .catch(err => {
      console.error(`Failed to load or process ${url}:`, err);
    });
}

// Show Agricultural Land Layer
showGeoJSONLayer(
  "agricultural_land.geojson",
  "green",
  (props) => `
    <b>OBJECTID:</b> ${props.OBJECTID}<br>
    <b>LU_TYPE:</b> ${props.LU_TYPE}<br>
    <b>TIME_ST:</b> ${props.TIME_ST}
  `
);

// Show Building Layer
showGeoJSONLayer(
  "Building.geojson",
  "blue",
  (props) => `
    <b>Building ID:</b> ${props.BLD_ID}<br>
    <b>Road:</b> ${props.ROAD_NAME}<br>
    <b>Use:</b> ${props.LUSE_DET}<br>
    <b>Locality:</b> ${props.LOCALITY}<br>
    <b>Floors:</b> ${props.NO_OF_FLR}<br>
    <b>Ward No:</b> ${props.WARD_NO}<br>
    <b>Remarks:</b> ${props.REMARKS}
  `
);
