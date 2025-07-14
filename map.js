mapboxgl.accessToken = 'pk.eyJ1IjoiYm9zaXJhIiwiYSI6ImNtY3V3Y3JjZTA0Yncyd3B4cXR4YWEwamwifQ.yWciEYaITqTBPhlgAeE9Bg';

proj4.defs("EPSG:32645", "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs");
const utm = "EPSG:32645";
const wgs84 = "EPSG:4326";

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

document.querySelectorAll('#layer-controls input[type=checkbox]').forEach(input => {
  input.addEventListener('change', () => {
    const layerId = input.getAttribute('data-layer');
    const visibility = input.checked ? 'visible' : 'none';
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
});

function convertToLngLat(feature) {
  const coords = feature.geometry.coordinates;
  switch (feature.geometry.type) {
    case "Point": return proj4(utm, wgs84, coords);
    case "Polygon": return coords.map(r => r.map(c => proj4(utm, wgs84, c)));
    case "MultiPolygon": return coords.map(p => p.map(r => r.map(c => proj4(utm, wgs84, c))));
    case "LineString": return coords.map(c => proj4(utm, wgs84, c));
    case "MultiLineString": return coords.map(l => l.map(c => proj4(utm, wgs84, c)));
    default: return coords;
  }
}

let buildingsData = [];

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
      map.addSource(layerId, { type: "geojson", data: geojson });

      const firstType = features[0].geometry.type;
      const isLine = firstType.includes("Line");

      map.addLayer({
        id: layerId,
        type: is3D ? "fill-extrusion" : isLine ? "line" : "fill",
        source: layerId,
        paint: is3D
          ? {
            'fill-extrusion-color': [
              'interpolate', ['linear'], ['get', 'NO_OF_FLR'],
              0, '#d4f0ff',
              1, '#74b9ff',
              2, '#1e90ff',
              3, '#0c2461'
            ],
            'fill-extrusion-height': ['*', ['get', 'NO_OF_FLR'], 3],
            'fill-extrusion-opacity': 0.9
          }
          : isLine
            ? { 'line-color': color, 'line-width': 4 }
            : { 'fill-color': color, 'fill-opacity': 0.5, 'fill-outline-color': '#333' }
      });

      if (!is3D && !isLine && layerId === 'parcels') {
        map.addLayer({
          id: `${layerId}-border`,
          type: 'line',
          source: layerId,
          layout: {},
          paint: {
            'line-color': '#000000',
            'line-width': 2
          }
        });
      }

      // if (layerId === 'buildings') {
      //   buildingsData = geojson.features;
      // } else {
      //   map.on('click', layerId, e => {
      //     const props = e.features[0].properties;
      //     const clickedInfo = document.getElementById('clicked-info');
      //     clickedInfo.innerHTML = popupFn(props);
      //   });
      // }

      if (layerId === 'buildings') {
        buildingsData = geojson.features;
      }
      map.on('click', layerId, e => {
        const props = e.features[0].properties;
        const clickedInfo = document.getElementById('clicked-info');
        clickedInfo.innerHTML = propsToTable(props);
      });
      

      if (fitToBounds) {
        const allCoords = features.flatMap(f => f.geometry.coordinates.flat(2));
        const bounds = [
          [Math.min(...allCoords.map(c => c[0])), Math.min(...allCoords.map(c => c[1]))],
          [Math.max(...allCoords.map(c => c[0])), Math.max(...allCoords.map(c => c[1]))]
        ];
        const center = [
          (bounds[0][0] + bounds[1][0]) / 2,
          (bounds[0][1] + bounds[1][1]) / 2
        ];
        setTimeout(() => {
          map.flyTo({ center, zoom: 17, pitch: 60, bearing: -20, speed: 0.6, curve: 1.8 });
        }, 0);
      }
    })
    .catch(err => console.error(`Error loading ${url}:`, err));
}

// Load layers
map.on('load', () => {
  loadLayer('agricultural_land.geojson', 'agri-land', '#00cc44', props => `
    <b>OBJECTID:</b> ${props.OBJECTID}<br>
    <b>Land Type:</b> ${props.LU_TYPE}<br>
    <b>TIME_ST:</b> ${props.TIME_ST}
  `, true);

  loadLayer('Streem_Drainage_Canal.geojson', 'water-features', '#00FFFF', props => `
    <b>Water ID:</b> ${props.WN_ID}<br>
    <b>Type:</b> ${props.WN_TYPE}<br>
    <b>Name:</b> ${props.WN_NAME}<br>
    <b>Length:</b> ${props.Shape_Leng?.toFixed(2)}<br>
    <b>Area:</b> ${props.Shape_Area?.toFixed(2)}<br>
    <b>Timestamp:</b> ${props.TIME_ST}
  `);

  loadLayer('Parcel.geojson', 'parcels', '#f5ed05', props => `
    <b>Parcel ID:</b> ${props.PCL_ID}<br>
    <b>Location:</b> ${props.PCL_LOC}<br>
    <b>Use:</b> ${props.LUSE_DET}<br>
    <b>Area:</b> ${props.PCL_AREA.toFixed(2)}<br>
    <b>Remarks:</b> ${props.REMARKS}<br>
    <b>Time Stamp:</b> ${props.TIME_ST}
  `);

  loadLayer('Right_of_Way.geojson', 'roads', '#FF0000', props => `
    <b>Road Name:</b> ${props.RD_NAME}<br>
    <b>Length:</b> ${props.RD_LEN}<br>
    <b>Locality:</b> ${props.LOCALITY}<br>
    <b>Material:</b> ${props.CON_MAT}<br>
    <b>Time Stamp:</b> ${props.TIME_ST}
  `);

  loadLayer('building.geojson', 'buildings', '#0074D9', props => `
    <b>Building ID:</b> ${props.BLD_ID}<br>
    <b>Road:</b> ${props.ROAD_NAME}<br>
    <b>Use:</b> ${props.LUSE_DET}<br>
    <b>Locality:</b> ${props.LOCALITY}<br>
    <b>Floors:</b> ${props.NO_OF_FLR}<br>
    <b>Ward No:</b> ${props.WARD_NO}<br>
    <b>Remarks:</b> ${props.REMARKS}
  `, false, true);
});

document.getElementById('applyBuildingFilter').addEventListener('click', () => {
  const min = parseFloat(document.getElementById('filterMinFloors').value);
  const max = parseFloat(document.getElementById('filterMaxFloors').value);
  const resultsContainer = document.getElementById('results-list');

  const filtered = buildingsData.filter(f => {
    const floors = parseFloat(f.properties.NO_OF_FLR);
    return floors >= min && floors <= max;
  });

  map.setFilter('buildings', ['all',
    ['>=', ['get', 'NO_OF_FLR'], min],
    ['<=', ['get', 'NO_OF_FLR'], max]
  ]);

  if (filtered.length === 0) {
    resultsContainer.innerHTML = '<i>No buildings match the filter.</i>';
  } else {
    resultsContainer.innerHTML = filtered.map(f => `
      <div style="margin-bottom: 10px; padding: 6px; border-bottom: 1px solid #ccc;">
        <b>ID:</b> ${f.properties.BLD_ID}<br>
        <b>Floors:</b> ${f.properties.NO_OF_FLR}<br>
        <b>Use:</b> ${f.properties.LUSE_DET || 'N/A'}<br>
        <b>Road:</b> ${f.properties.ROAD_NAME || 'N/A'}
      </div>
    `).join('');
  }
});

function propsToTable(props) {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tbody>
        ${Object.entries(props).map(([key, value]) => `
          <tr>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:500;color:#1976d2;">${key}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;">${value ?? ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
