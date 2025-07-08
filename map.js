// Replace with your actual Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiYm9zaXJhIiwiYSI6ImNtY3V3Y3JjZTA0Yncyd3B4cXR4YWEwamwifQ.yWciEYaITqTBPhlgAeE9Bg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [85.13, 25.6],
  zoom: 12,
  pitch: 45,
  bearing: -17.6,
  antialias: true
});

map.addControl(new mapboxgl.NavigationControl());

// Define UTM to WGS84 projection
proj4.defs("EPSG:32645", "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs");
const utm = "EPSG:32645";
const wgs84 = "EPSG:4326";

function convertToLngLat(feature) {
  const coords = feature.geometry.coordinates;
  return coords.map(polygon => polygon.map(ring => ring.map(([x, y]) => {
    const [lon, lat] = proj4(utm, wgs84, [x, y]);
    return [lon, lat];
  })));
}

function loadLayer(url, layerId, color, popupFn, fitToBounds = false, is3D = false) {
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

      map.addSource(layerId, {
        type: "geojson",
        data: geojson
      });

      // For 3D buildings
      if (is3D) {
        map.addLayer({
          id: layerId,
          type: "fill-extrusion",
          source: layerId,
          paint: {
            'fill-extrusion-color': color,
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-opacity': 0.9
          }
        });
      } else {
        // For 2D polygons
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
      }

      map.on('click', layerId, (e) => {
        const props = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popupFn(props))
          .addTo(map);
      });

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

map.on('load', () => {
  loadLayer(
    'agricultural_land.geojson',
    'agri-land',
    '#00cc44',
    props => `
      <b>OBJECTID:</b> ${props.OBJECTID}<br>
      <b>LU_TYPE:</b> ${props.LU_TYPE}<br>
      <b>TIME_ST:</b> ${props.TIME_ST}
    `,
    true
  );

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
    `,
    false,
    true // is3D
  );
});
