/**
 * Builds an equirectangular texture: bright green land, deep blue ocean (radial glow), black seas at poles.
 * Matches the minimalist WaterWise globe reference art.
 */
const LAND_GEOJSON_URLS = [
  '/geo/ne_110m_land.geojson',
  'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_110m_land.geojson',
];

/** Default globe (dashboard hero) */
const OCEAN_CENTER = '#2a6fc4';
const OCEAN_MID = '#0f3d6e';
const OCEAN_EDGE = '#051018';
const LAND_COLOR = '#00ad00';

/** Live Map — 30% secondary: readable ocean + land on 60% slate base */
const LIVE_OCEAN_CENTER = '#6eb5f0';
const LIVE_OCEAN_MID = '#3d7eb8';
const LIVE_OCEAN_EDGE = '#2a5580';
const LIVE_LAND_COLOR = '#72d45e';

let texturePromise = null;

function project(lng, lat, width, height) {
  return [((lng + 180) / 360) * width, ((90 - lat) / 180) * height];
}

function ringToPath(ctx, ring, width, height) {
  ring.forEach(([lng, lat], i) => {
    const [x, y] = project(lng, lat, width, height);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawGeometry(ctx, geometry, width, height) {
  const { type, coordinates } = geometry;
  if (type === 'Polygon') {
    coordinates.forEach((ring) => ringToPath(ctx, ring, width, height));
  } else if (type === 'MultiPolygon') {
    coordinates.forEach((poly) => poly.forEach((ring) => ringToPath(ctx, ring, width, height)));
  }
}

function paintOcean(ctx, width, height, palette) {
  const center = palette === 'live' ? LIVE_OCEAN_CENTER : OCEAN_CENTER;
  const mid = palette === 'live' ? LIVE_OCEAN_MID : OCEAN_MID;
  const edge = palette === 'live' ? LIVE_OCEAN_EDGE : OCEAN_EDGE;
  const g = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    width * 0.06,
    width * 0.5,
    height * 0.5,
    width * 0.52,
  );
  g.addColorStop(0, center);
  g.addColorStop(0.42, mid);
  g.addColorStop(1, edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

export function buildStylizedEarthTexture(THREE, options = {}) {
  const palette = options.palette === 'live' ? 'live' : 'default';

  if (palette === 'default' && texturePromise) return texturePromise;

  const build = async () => {
    const width = 2048;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    paintOcean(ctx, width, height, palette);

    let landDrawn = false;
    const landFill = palette === 'live' ? LIVE_LAND_COLOR : LAND_COLOR;
    for (const url of LAND_GEOJSON_URLS) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const geo = await res.json();
        ctx.fillStyle = landFill;
        ctx.beginPath();
        geo.features.forEach((f) => {
          if (f.geometry) drawGeometry(ctx, f.geometry, width, height);
        });
        ctx.fill('evenodd');
        landDrawn = true;
        break;
      } catch {
        /* try next source */
      }
    }
    if (!landDrawn) {
      console.warn('Land GeoJSON unavailable; globe will show ocean only until data loads.');
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  };

  if (palette === 'live') {
    return build();
  }

  texturePromise = build();
  return texturePromise;
}
