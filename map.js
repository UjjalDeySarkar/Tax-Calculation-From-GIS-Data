// Replace with your actual Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiYm9zaXJhIiwiYSI6ImNtY3V3Y3JjZTA0Yncyd3B4cXR4YWEwamwifQ.yWciEYaITqTBPhlgAeE9Bg';

// Initialize Mapbox map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [85.13, 25.6], // Temporary fallback
  zoom: 12,
  pitch: 45,
  bearing: -17.6,
  antialias: true
});

// Add navigation controls
map.addControl(new mapboxgl.NavigationControl());

// Define projections
proj4.defs("EPSG:32645", "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs");
const utm = "EPSG:32645";
const wgs84 = "EPSG:4326";

// Function to convert MultiPolygon with reprojection
function convertToLngLat(feature) {
  const coords = feature.geometry.coordinates;
  return coords.map(polygon => polygon.map(ring => ring.map(([x, y]) => {
    const [lon, lat] = proj4(utm, wgs84, [x, y]);
    return [lon, lat];
  })));
}

// Load and show GeoJSON file
function loadLayer(url, layerId, color, popupFn, fitToBounds = false) {
  fetch(url)
    .then(res => res.json())
    .then(data => {
      const features = data.features.map(f => {
        return {
          type: "Feature",
          geometry: {
            type: "MultiPolygon",
            coordinates: convertToLngLat(f)
          },
          properties: f.properties
        };
      });

      const geojson = {
        type: "FeatureCollection",
        features
      };

      // Add source
      map.addSource(layerId, {
        type: "geojson",
        data: geojson
      });

      // Add layer
      map.addLayer({
        id: layerId,
        type: "fill",
        source: layerId,
        paint: {
          'fill-color': color,
          'fill-opacity': 0.5,
          'fill-outline-color': '#333'
        }
      });

      // Add popups
      map.on('click', layerId, (e) => {
        const props = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popupFn(props))
          .addTo(map);
      });

      // Zoom to layer bounds
      if (fitToBounds) {
        const allCoords = features.flatMap(f =>
          f.geometry.coordinates.flat(2)
        );
        const lats = allCoords.map(c => c[1]);
        const lngs = allCoords.map(c => c[0]);
        const bounds = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        ];
        map.fitBounds(bounds, { padding: 50 });
      }
    })
    .catch(err => console.error(`Error loading ${url}:`, err));
}

// Wait for map to load before adding sources/layers
map.on('load', () => {
  // Show Agricultural Land (Zoom to this layer)
  loadLayer(
    'agricultural_land.geojson',
    'agri-land',
    '#00cc44',
    props => `
      <b>OBJECTID:</b> ${props.OBJECTID}<br>
      <b>LU_TYPE:</b> ${props.LU_TYPE}<br>
      <b>TIME_ST:</b> ${props.TIME_ST}
    `,
    true // Fit to bounds
  );

  // Show Building Layer
  loadLayer(
    'building.geojson',
    'buildings',
    '#0074D9',
    props => `
      <b>Building ID:</b> ${props.BLD_ID}<br>
      <b>Road:</b> ${props.ROAD_NAME}<br>
      <b>Use:</b> ${props.LUSE_DET}<br>
      <b>Locality:</b> ${props.LOCALITY}<br>
      <b>Floors:</b> ${props.NO_OF_FLR}<br>
      <b>Ward No:</b> ${props.WARD_NO}<br>
      <b>Remarks:</b> ${props.REMARKS}
    `
  );
});
