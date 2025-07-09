mapboxgl.accessToken = 'pk.eyJ1IjoiYm9zaXJhIiwiYSI6ImNtY3V3Y3JjZTA0Yncyd3B4cXR4YWEwamwifQ.yWciEYaITqTBPhlgAeE9Bg';

// Define projections
proj4.defs("EPSG:32645", "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs");
const utm = "EPSG:32645";
const wgs84 = "EPSG:4326";

// Create map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [0, 20],
  zoom: 0,
  pitch: 0,
  bearing: 0,
  antialias: true
});

map.addControl(new mapboxgl.NavigationControl());

// Coordinate conversion based on geometry type
function convertToLngLat(feature) {
  const coords = feature.geometry.coordinates;
  switch (feature.geometry.type) {
    case "Point": {
      const [x, y] = coords;
      const [lon, lat] = proj4(utm, wgs84, [x, y]);
      return [lon, lat];
    }
    case "MultiPolygon": {
      return coords.map(polygon =>
        polygon.map(ring =>
          ring.map(([x, y]) => proj4(utm, wgs84, [x, y]))
        )
      );
    }
    case "Polygon": {
      return coords.map(ring =>
        ring.map(([x, y]) => proj4(utm, wgs84, [x, y]))
      );
    }
    case "MultiLineString": {
      return coords.map(line =>
        line.map(([x, y]) => proj4(utm, wgs84, [x, y]))
      );
    }
    case "LineString": {
      return coords.map(([x, y]) => proj4(utm, wgs84, [x, y]));
    }
    default:
      console.warn("Unsupported geometry type:", feature.geometry.type);
      return coords;
  }
}

// Generic function to load and display a GeoJSON layer
function loadLayer(url, layerId, color, popupFn, fitToBounds = false, is3D = false) {
  fetch(url)
    .then(res => res.json())
    .then(data => {
      const features = data.features.map(f => ({
        type: "Feature",
        geometry: {
          type: f.geometry.type,
          coordinates: convertToLngLat(f)
        },
        properties: f.properties
      }));

      const geojson = { type: "FeatureCollection", features };

      map.addSource(layerId, {
        type: "geojson",
        data: geojson
      });

      const firstType = features[0].geometry.type;
      const isLine = firstType.includes("Line");

      map.addLayer({
        id: layerId,
        type: is3D
          ? "fill-extrusion"
          : isLine
            ? "line"
            : "fill",
        source: layerId,
        paint: is3D
          ? {
              'fill-extrusion-color': color,
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-opacity': 0.9
            }
          : isLine
            ? {
                'line-color': color,
                'line-width': 4
              }
            : {
                'fill-color': color,
                'fill-opacity': 0.5,
                'fill-outline-color': '#333'
              }
      });

      map.on('click', layerId, e => {
        const props = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popupFn(props))
          .addTo(map);
      });

      if (fitToBounds) {
        const allCoords = features.flatMap(f => f.geometry.coordinates.flat(2));
        const lats = allCoords.map(c => c[1]);
        const lngs = allCoords.map(c => c[0]);
        const bounds = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        ];
        const center = [
          (bounds[0][0] + bounds[1][0]) / 2,
          (bounds[0][1] + bounds[1][1]) / 2
        ];

        setTimeout(() => {
          map.flyTo({
            center,
            zoom: 17,
            pitch: 60,
            bearing: -20,
            speed: 0.6,
            curve: 1.8,
            easing: t => t
          });
        }, 0);
      }
    })
    .catch(err => console.error(`Error loading ${url}:`, err));
}

// Load layers
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
    true
  );

  loadLayer(
    'Community_Toilet.geojson',
    'community-toilet',
    '#FF5733',
    props => `
      <b>OBI ID:</b> ${props.OBI_ID}<br>
      <b>Locality:</b> ${props.LOCALITY}<br>
      <b>Remarks:</b> ${props.REMARKS}<br>
      <b>WARD:</b> ${props.WARD_ID}<br>
      <b>Commissioned:</b> ${props.COM_YEAR}<br>
      <b>Time Stamp:</b> ${props.TIME_ST}
    `
  );

  loadLayer(
    'Right_of_Way.geojson',
    'roads',
    '#FF0000',
    props => `
      <b>Road Name:</b> ${props.RD_NAME}<br>
      <b>Length (m):</b> ${props.RD_LEN}<br>
      <b>Locality:</b> ${props.LOCALITY}<br>
      <b>Material:</b> ${props.CON_MAT}<br>
      <b>Time Stamp:</b> ${props.TIME_ST}
    `
  );
});
