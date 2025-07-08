// Replace with your actual Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiYm9zaXJhIiwiYSI6ImNtY3V3Y3JjZTA0Yncyd3B4cXR4YWEwamwifQ.yWciEYaITqTBPhlgAeE9Bg';

// Define projection: EPSG:32645 → WGS84
proj4.defs("EPSG:32645", "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs");
const utm = "EPSG:32645";
const wgs84 = "EPSG:4326";

// Initialize map (center will auto-adjust)
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [0, 0],
  zoom: 2,
  pitch: 60,
  bearing: -20,
  antialias: true
});

map.on('load', () => {
  // Load and reproject building.geojson
  fetch('building.geojson')
    .then(res => res.json())
    .then(data => {
      const bounds = new mapboxgl.LngLatBounds();

      data.features.forEach(feature => {
        const coords = feature.geometry.coordinates;

        if (feature.geometry.type === 'MultiPolygon') {
          // Reproject all coordinates from UTM to WGS84
          feature.geometry.coordinates = coords.map(polygon =>
            polygon.map(ring =>
              ring.map(([x, y]) => {
                const [lon, lat] = proj4(utm, wgs84, [x, y]);
                bounds.extend([lon, lat]);
                return [lon, lat];
              })
            )
          );
        }
      });

      // Add reprojected GeoJSON to map
      map.addSource('buildings', {
        type: 'geojson',
        data: data
      });

      // Add 3D extrusion layer
      map.addLayer({
        id: '3d-buildings',
        type: 'fill-extrusion',
        source: 'buildings',
        paint: {
          'fill-extrusion-color': '#00aaff',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.6
        }
      });

      // Fit the map to the extent of reprojected buildings
      map.fitBounds(bounds, { padding: 40 });

      // Add popups
      map.on('click', '3d-buildings', (e) => {
        const p = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <b>Building ID:</b> ${p.BLD_ID}<br>
            <b>Use:</b> ${p.LUSE_DET}<br>
            <b>Locality:</b> ${p.LOCALITY}<br>
            <b>Road:</b> ${p.ROAD_NAME}<br>
            <b>Floors:</b> ${p.NO_OF_FLR}<br>
            <b>Height:</b> ${p.height} m
          `)
          .addTo(map);
      });

      // Cursor pointer
      map.on('mouseenter', '3d-buildings', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', '3d-buildings', () => {
        map.getCanvas().style.cursor = '';
      });
    })
    .catch(err => console.error("Failed to load building.geojson", err));
});
