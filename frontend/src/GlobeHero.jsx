import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useNavigate } from 'react-router-dom';
import StylizedGlobe from './StylizedGlobe';

const GLOBE_CENTER = [0, 12];
/** Pull back so the full sphere rim is visible inside the circular frame. */
const GLOBE_ZOOM   = -1.55;
/** Steep pitch — reads as a tilted 3D globe, not a flat disc. */
const GLOBE_PITCH  = 62;
const GLOBE_LAT    = 8;
/** Earth-style spin speed (full turn ~100s). */
const GLOBE_SPIN_DEG_PER_SEC = 3.6;
/** Camera follow smoothing (lower = silkier, 0.04–0.12). */
const GLOBE_SPIN_SMOOTH = 0.055;
const GLOBE_FOG = {
  color: 'rgb(186, 210, 238)',
  'high-color': 'rgb(163, 230, 53)',
  'horizon-blend': 0.55,
  'space-color': 'rgb(1, 3, 10)',
  'star-intensity': 0.65,
};
const TERRAIN_SOURCE_ID = 'waterwise-globe-terrain';
const ZIM_CENTER   = [29.8, -19.5];
const ZIM_PITCH_3D = 58;
const ZIM_BEARING_3D = -18;
const ZIM_ZOOM     = 6.35;
const TERRAIN_EXAGGERATION_LIVE = 2.2;
const POINT_ZOOM    = 14;
const POINT_PITCH   = 55;
const POINT_BEARING = -20;

const FAULT_COLORS = {
  PENDING:     '#ef4444',
  IN_PROGRESS: '#f59e0b',
  RESOLVED:    '#10b981',
};
const FAULT_LABELS = {
  PUMP: 'Pump', LEAK: 'Leak', DRY: 'Dry',
  CONTAM: 'Contam', VANDAL: 'Vandal', OTHER: 'Other',
};

const TILE_STYLE_BASE = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
    labels: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
  },
};

const TILE_STYLE = {
  ...TILE_STYLE_BASE,
  layers: [
    { id: 'satellite', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 13,
      paint: { 'raster-fade-duration': 300 } },
    { id: 'osm', type: 'raster', source: 'osm', minzoom: 13,
      paint: {
        'raster-brightness-max': 0.55,
        'raster-saturation': -0.4,
        'raster-contrast': 0.15,
        'raster-fade-duration': 300,
      },
    },
    { id: 'labels', type: 'raster', source: 'labels', minzoom: 5.5, maxzoom: 13,
      paint: { 'raster-fade-duration': 300 } },
  ],
};

/** Live Map: brighter tiles (30% secondary) — accent reserved for markers/UI */
const LIVE_TILE_STYLE = {
  ...TILE_STYLE_BASE,
  layers: [
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 13,
      paint: {
        'raster-fade-duration': 300,
        'raster-brightness-min': 0.05,
        'raster-brightness-max': 0.92,
        'raster-saturation': 0.2,
        'raster-contrast': 0.08,
      },
    },
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      minzoom: 13,
      paint: {
        'raster-brightness-max': 0.82,
        'raster-saturation': -0.1,
        'raster-contrast': 0.1,
        'raster-fade-duration': 300,
      },
    },
    {
      id: 'labels',
      type: 'raster',
      source: 'labels',
      minzoom: 5.5,
      maxzoom: 13,
      paint: {
        'raster-fade-duration': 300,
        'raster-brightness-max': 0.95,
      },
    },
  ],
};

const hudBtn = {
  background: 'rgba(163,230,53,0.12)',
  color: '#a3e635',
  border: '1px solid rgba(163,230,53,0.3)',
  padding: '3px 10px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};

const GlobeHero = ({
  waterPoints = [],
  reports = [],
  onLocationSelected,
  selectedPos,
  flyToCode,
  loading,
  onModeChange,
  initialMode = 'globe',
  flatMap = false,
  showBackButton = true,
  /** Live Map page: bottom-right controls, uniform markers, slight globe interaction */
  liveMapLayout = false,
}) => {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef({});
  const newMarkerRef    = useRef(null);
  const rotationRef     = useRef(null);
  const modeRef         = useRef(initialMode);
  const globeLngRef     = useRef(0);
  const lastSpinTimeRef = useRef(null);
  const [mode, setMode] = useState(initialMode);
  const [activeWP, setActiveWP] = useState(null);
  const [mapMode, setMapMode]   = useState('country');
  const startInMap = flatMap || initialMode === 'map';
  const useStylizedGlobe = !flatMap;
  const [mapMounted, setMapMounted] = useState(startInMap);
  const navigate = useNavigate();

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (onModeChange) onModeChange(mode);
  }, [mode, onModeChange]);

  const faultIndex = {};
  reports.forEach(r => {
    if (r.status === 'RESOLVED') return;
    const c = r.water_point_code;
    if (!faultIndex[c] || r.status === 'PENDING') faultIndex[c] = r;
  });

  const normalizeLngDelta = (from, to) => {
    let d = to - from;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  };

  const setupGlobe3D = (map, withTerrain = true) => {
    map.setProjection({ name: 'globe' });
    map.setFog(GLOBE_FOG);
    if (!withTerrain) return;
    try {
      if (!map.getSource(TERRAIN_SOURCE_ID)) {
        map.addSource(TERRAIN_SOURCE_ID, {
          type: 'raster-dem',
          url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
          tileSize: 256,
        });
      }
      map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 2.8 });
    } catch (err) {
      console.warn('Globe terrain unavailable', err);
    }
  };

  const setupLiveTerrain3D = (map) => {
    try {
      if (!map.getSource(TERRAIN_SOURCE_ID)) {
        map.addSource(TERRAIN_SOURCE_ID, {
          type: 'raster-dem',
          url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
          tileSize: 256,
        });
      }
      map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION_LIVE });
      if (!map.getLayer('waterwise-hillshade')) {
        map.addLayer({
          id: 'waterwise-hillshade',
          type: 'hillshade',
          source: TERRAIN_SOURCE_ID,
          paint: {
            'hillshade-shadow-color': '#4a5d72',
            'hillshade-highlight-color': '#c5d4e8',
            'hillshade-accent-color': '#7a8fa6',
            'hillshade-exaggeration': 0.28,
          },
        });
      }
    } catch (err) {
      console.warn('Live map terrain unavailable', err);
    }
    try {
      map.setFog({
        color: 'rgb(200, 218, 238)',
        'high-color': 'rgb(150, 175, 205)',
        'horizon-blend': 0.28,
        'space-color': 'rgb(58, 76, 98)',
        'star-intensity': 0.12,
      });
    } catch (_) {
      /* ignore */
    }
  };

  const teardownGlobe3D = (map) => {
    try {
      map.setTerrain(null);
    } catch (_) {
      /* ignore */
    }
    map.setProjection({ name: 'mercator' });
    try {
      map.setFog(null);
    } catch (_) {
      /* ignore */
    }
  };

  const lockGlobeCamera = (map) => {
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
  };

  const unlockMapCamera = (map) => {
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.dragRotate.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
  };

  const applyGlobeView = (map, lng, { immediate = false } = {}) => {
    const view = {
      center: [lng, GLOBE_LAT],
      zoom: GLOBE_ZOOM,
      pitch: GLOBE_PITCH,
      bearing: 0,
    };
    if (immediate) {
      map.jumpTo(view);
      return;
    }
    const current = map.getCenter();
    const dlng = normalizeLngDelta(current.lng, lng);
    const nextLng = current.lng + dlng * GLOBE_SPIN_SMOOTH;
    map.setCenter([nextLng, GLOBE_LAT]);
    map.setZoom(GLOBE_ZOOM);
    map.setPitch(GLOBE_PITCH);
    map.setBearing(0);
  };

  /** Spin on the polar axis with eased camera follow (no per-frame jumpTo). */
  const startRotation = () => {
    stopRotation();
    lastSpinTimeRef.current = null;

    const spin = (timestamp) => {
      const map = mapRef.current;
      if (!map || modeRef.current !== 'globe') return;

      if (lastSpinTimeRef.current == null) {
        lastSpinTimeRef.current = timestamp;
      }
      const dt = Math.min((timestamp - lastSpinTimeRef.current) / 1000, 0.032);
      lastSpinTimeRef.current = timestamp;

      globeLngRef.current += GLOBE_SPIN_DEG_PER_SEC * dt;
      if (globeLngRef.current > 180) globeLngRef.current -= 360;
      if (globeLngRef.current < -180) globeLngRef.current += 360;

      applyGlobeView(map, globeLngRef.current);

      rotationRef.current = requestAnimationFrame(spin);
    };

    rotationRef.current = requestAnimationFrame(spin);
  };

  const stopRotation = () => {
    if (rotationRef.current) {
      cancelAnimationFrame(rotationRef.current);
      rotationRef.current = null;
    }
  };

  useEffect(() => {
    if (mode === 'map') setMapMounted(true);
  }, [mode]);

  useEffect(() => {
    if (!mapMounted || !mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: liveMapLayout ? LIVE_TILE_STYLE : TILE_STYLE,
      projection: { name: 'mercator' },
      center: ZIM_CENTER,
      zoom: ZIM_ZOOM,
      minZoom: 4,
      pitch: flatMap ? 0 : (liveMapLayout ? ZIM_PITCH_3D : 0),
      bearing: flatMap ? 0 : (liveMapLayout ? ZIM_BEARING_3D : 0),
      antialias: true,
      interactive: true,
    });
    mapRef.current = map;
    map.on('load', () => {
      if (liveMapLayout) setupLiveTerrain3D(map);
      const navPos = liveMapLayout ? 'bottom-right' : (startInMap ? 'top-left' : null);
      if (navPos) {
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
          navPos
        );
      }
      if (modeRef.current === 'map') {
        map.flyTo({
          center: ZIM_CENTER,
          zoom: ZIM_ZOOM,
          pitch: flatMap ? 0 : (liveMapLayout ? ZIM_PITCH_3D : 0),
          bearing: flatMap ? 0 : (liveMapLayout ? ZIM_BEARING_3D : 0),
          duration: 2800,
          essential: true,
        });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (map) map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      stopRotation();
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [mapMounted, flatMap, liveMapLayout, startInMap]);

  const handleGlobeClick = () => {
    if (flatMap) return;
    if (mode !== 'globe') return;
    setMapMounted(true);
    setMode('map');
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const flyToZimbabwe = () => {
      stopRotation();
      const mapPitch = flatMap ? 0 : (liveMapLayout ? ZIM_PITCH_3D : 0);
      const mapBearing = flatMap ? 0 : (liveMapLayout ? ZIM_BEARING_3D : 0);
      if (liveMapLayout) setupLiveTerrain3D(map);
      map.flyTo({
        center: ZIM_CENTER,
        zoom: ZIM_ZOOM,
        pitch: mapPitch,
        bearing: mapBearing,
        duration: 2800,
        essential: true,
      });
      setMapMode('country');
      setActiveWP(null);
    };

    if (mode === 'globe') {
      stopRotation();
      setMapMode('country');
      setActiveWP(null);
      return;
    }

    const run = () => {
      requestAnimationFrame(() => {
        map.resize();
        flyToZimbabwe();
      });
    };
    if (map.isStyleLoaded()) run();
    else map.once('load', run);
  }, [mode, liveMapLayout, flatMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

      waterPoints.forEach(wp => {
      if (!wp.latitude || !wp.longitude) return;
      const fault = faultIndex[wp.code];
      const uniformLiveMarkers = liveMapLayout && mode === 'globe';
      const color = uniformLiveMarkers || flatMap
        ? (liveMapLayout ? '#a3e635' : '#b4ea4e')
        : (fault ? (FAULT_COLORS[fault.status] || '#ef4444') : '#a3e635');
      const hasFault = !!fault && !uniformLiveMarkers && !flatMap;

      const el = document.createElement('div');
      el.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;';

      if (hasFault && !flatMap) {
        const lbl = document.createElement('div');
        lbl.textContent = FAULT_LABELS[fault.fault_code] || fault.fault_code;
        lbl.style.cssText = `background:${color};color:white;font-size:10px;font-weight:700;
          padding:2px 6px;border-radius:4px;white-space:nowrap;margin-bottom:3px;
          box-shadow:0 2px 8px rgba(0,0,0,.55);font-family:sans-serif;
          letter-spacing:.03em;animation:pulse-label 2s infinite;`;
        el.appendChild(lbl);
      }

      const dot = document.createElement('div');
      const dotSize = uniformLiveMarkers ? '12px' : flatMap ? '14px' : (hasFault ? '20px' : '15px');
      dot.style.cssText = `
        width:${dotSize};height:${dotSize};
        border-radius:50%;background:${color};border:3px solid rgba(255,255,255,0.9);
        box-shadow:0 2px 10px rgba(0,0,0,0.5)${uniformLiveMarkers || flatMap ? `,0 0 0 4px rgba(180,234,78,0.28)` : (hasFault ? `,0 0 0 5px ${color}44` : '')};
        transition:transform .2s;`;
      el.appendChild(dot);

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([parseFloat(wp.longitude), parseFloat(wp.latitude)])
        .addTo(map);

      el.addEventListener('click', e => {
        e.stopPropagation();
        zoomToPoint(map, wp);
      });
      markersRef.current[wp.code] = marker;
    });
  }, [waterPoints, reports, liveMapLayout, flatMap, mode]);

  const zoomToPoint = (map, wp) => {
    stopRotation();
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.flyTo({
      center: [parseFloat(wp.longitude), parseFloat(wp.latitude)],
      zoom: POINT_ZOOM,
      pitch: flatMap ? 0 : POINT_PITCH,
      bearing: flatMap ? 0 : POINT_BEARING,
      duration: 1200,
    });
    setMapMode('point');
    setActiveWP(wp);
  };

  const goToZimbabwe = () => {
    const map = mapRef.current;
    if (!map || flatMap) return;
    stopRotation();
    const mapPitch = liveMapLayout ? ZIM_PITCH_3D : 0;
    const mapBearing = liveMapLayout ? ZIM_BEARING_3D : 0;
    map.flyTo({
      center: ZIM_CENTER,
      zoom: ZIM_ZOOM,
      pitch: mapPitch,
      bearing: mapBearing,
      duration: 1800,
    });
    setMapMode('country');
    setActiveWP(null);
  };

  const goToGlobe = () => {
    setMode('globe');
  };

  const showGlobeSphere = mode === 'globe' && useStylizedGlobe;
  const showStylizedGlobe = showGlobeSphere;

  return (
    <div
      className={[
        'globe-hero-root',
        liveMapLayout && showGlobeSphere ? 'globe-hero-root--live-sphere' : '',
        liveMapLayout ? 'globe-hero-root--live-palette' : '',
      ].filter(Boolean).join(' ')}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <style>{`
        @keyframes pulse-label {
          0%,100% { opacity:1; transform:translateY(0); }
          50%      { opacity:.82; transform:translateY(-2px); }
        }
        @keyframes glowRing {
          0%,100% { opacity: 0.6; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.04); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes shineSweep {
          0% { transform: translateX(-160%) skewX(-22deg); opacity: 0; }
          15% { opacity: 0.22; }
          45% { opacity: 0.12; }
          100% { transform: translateX(180%) skewX(-22deg); opacity: 0; }
        }
        @keyframes globeShadowPulse {
          0%, 100% { box-shadow: 0 0 80px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,0,0,0.6); }
          50% { box-shadow: 0 0 100px rgba(0,0,0,0.86), inset 0 0 70px rgba(0,0,0,0.68); }
        }
        @keyframes globeAuraSpin {
          0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 0.55; }
          50% { opacity: 0.85; }
          100% { transform: translate(-50%, -50%) rotate(360deg); opacity: 0.55; }
        }
        @keyframes globeStageFloat {
          0%, 100% { transform: rotateX(32deg) translateY(0); }
          50% { transform: rotateX(34deg) translateY(-3px); }
        }

        /* Hide attribution for clean look */
        .maplibregl-ctrl-attrib { display: none !important; }
        .maplibregl-ctrl-top-left {
          top: 12px;
          left: 12px;
        }
        .maplibregl-ctrl-bottom-right {
          bottom: 76px;
          right: 14px;
        }
        .maplibregl-ctrl-group {
          background: rgba(8, 14, 24, 0.82) !important;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px !important;
          backdrop-filter: blur(6px);
          overflow: hidden;
        }
        .maplibregl-ctrl-group button {
          width: 28px !important;
          height: 28px !important;
          color: #d5deec !important;
        }
        .maplibregl-ctrl-group button + button {
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .globe-stage-3d {
          perspective: 1400px;
          perspective-origin: 50% 54%;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          z-index: 10;
          position: relative;
        }

        .globe-stage-3d--flat {
          perspective: none;
          position: absolute;
          inset: 0;
        }

        .globe-hero-root--live-sphere .globe-stage-3d {
          perspective: none;
          perspective-origin: 50% 50%;
        }

        .globe-aura {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 98%;
          height: 98%;
          border-radius: 50%;
          background: radial-gradient(
            ellipse 88% 72% at 50% 52%,
            transparent 58%,
            rgba(163, 230, 53, 0.06) 72%,
            rgba(163, 230, 53, 0.18) 88%,
            rgba(120, 180, 40, 0.28) 100%
          );
          pointer-events: none;
          z-index: 1;
          animation: globeAuraSpin 120s linear infinite;
        }

        .globe-container {
          position: relative;
          height: 88%;
          max-height: min(88%, 88cqw);
          aspect-ratio: 1 / 1;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          border: 1px solid rgba(163,230,53,0.32);
          box-shadow:
            0 0 40px rgba(163, 230, 53, 0.06),
            0 32px 100px rgba(0, 0, 0, 0.82),
            inset 0 -28px 50px rgba(0, 0, 0, 0.55),
            inset 0 0 80px rgba(0, 0, 0, 0.35);
          flex-shrink: 0;
          background: #000;
          transform-style: preserve-3d;
          transform: rotateX(32deg);
          backface-visibility: hidden;
          will-change: transform;
          animation: globeStageFloat 14s ease-in-out infinite, globeShadowPulse 5s ease-in-out infinite;
          transition: border-color 0.35s ease, box-shadow 0.35s ease, transform 0.6s cubic-bezier(0.34, 1.2, 0.64, 1);
        }

        .globe-hero-root--live-sphere .globe-container:not(.globe-container--stylized) {
          height: min(76%, 64vmin);
          max-height: min(76%, 64vmin);
        }

        .globe-container--flat {
          position: absolute;
          inset: 0;
          width: 100% !important;
          height: 100% !important;
          max-height: none !important;
          aspect-ratio: auto;
          border-radius: 12px;
          transform: none;
          animation: none;
          border: none;
          box-shadow: none;
          cursor: default;
        }

        .globe-container--flat::after {
          display: none;
        }

        .globe-container::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          z-index: 15;
          box-shadow: inset 0 0 42px 12px rgba(0, 0, 0, 0.55);
          background: radial-gradient(
            ellipse 100% 100% at 50% 50%,
            transparent 52%,
            rgba(0, 0, 0, 0.12) 78%,
            rgba(0, 0, 0, 0.45) 100%
          );
        }

        .globe-container:hover {
          border-color: rgba(163,230,53,0.5);
          animation-play-state: paused;
          box-shadow:
            0 0 72px rgba(163, 230, 53, 0.16),
            0 28px 90px rgba(0, 0, 0, 0.8),
            inset 0 -20px 40px rgba(0, 0, 0, 0.45);
        }

        .globe-container.is-spinning .maplibregl-canvas {
          filter: saturate(1.12) contrast(1.04);
        }

        .space-bg {
          position: absolute;
          inset: 0;
          background: #020406;
          overflow: hidden;
          z-index: 0;
        }
        
        .stars {
          position: absolute;
          inset: -50%;
          background-image: 
            radial-gradient(1px 1px at 20px 30px, white, transparent),
            radial-gradient(1.5px 1.5px at 100px 150px, white, transparent),
            radial-gradient(1px 1px at 200px 50px, white, transparent),
            radial-gradient(2px 2px at 300px 250px, white, transparent);
          background-size: 400px 400px;
          animation: twinkle 4s infinite alternate;
        }
        .globe-highlight {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          z-index: 14;
          background: linear-gradient(120deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.22) 18%, rgba(255,255,255,0.06) 36%, rgba(255,255,255,0) 56%);
          mix-blend-mode: screen;
          animation: shineSweep 8s ease-in-out infinite;
        }
      `}</style>

      <div style={{
        width: '100%', 
        height: '100%', 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        overflow: 'hidden',
        background: liveMapLayout
          ? (showStylizedGlobe ? 'var(--live-60, #3d4f66)' : 'var(--live-60-deep, #35465c)')
          : (showStylizedGlobe ? '#000000' : '#020406'),
      }}>
        
        {showGlobeSphere && (
          <div className="space-bg" aria-hidden>
            <div className="stars" />
            <div className="stars" style={{ animationDelay: '1s', opacity: 0.5, transform: 'rotate(45deg)' }} />
          </div>
        )}

        {!showStylizedGlobe && showGlobeSphere && <div className="globe-aura" aria-hidden />}

        <div
          className={[
            'globe-map-host',
            showGlobeSphere ? 'globe-map-host--sphere-ui' : 'globe-map-host--flat',
            showStylizedGlobe ? 'globe-map-host--stylized' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className={`globe-stage-3d${showGlobeSphere ? '' : ' globe-stage-3d--flat'}`}>
            <div
              className={[
                'globe-container',
                showStylizedGlobe ? 'globe-container--stylized' : '',
                showGlobeSphere && !showStylizedGlobe ? 'is-spinning' : '',
                !showGlobeSphere ? 'globe-container--flat' : '',
              ].filter(Boolean).join(' ')}
              onClick={showGlobeSphere && !showStylizedGlobe ? handleGlobeClick : undefined}
              role={showGlobeSphere && !showStylizedGlobe ? 'button' : undefined}
              tabIndex={showGlobeSphere && !showStylizedGlobe ? 0 : undefined}
              onKeyDown={showGlobeSphere && !showStylizedGlobe ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleGlobeClick(); } : undefined}
              aria-label={showGlobeSphere && !showStylizedGlobe ? 'Zoom into Zimbabwe map' : undefined}
            >
              {showStylizedGlobe && (
                <StylizedGlobe onActivate={handleGlobeClick} brightPalette={liveMapLayout} />
              )}
              {mapMounted && (
                <div
                  ref={mapContainerRef}
                  className="globe-map-canvas"
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'transparent',
                    display: showStylizedGlobe ? 'none' : 'block',
                  }}
                />
              )}
              {showGlobeSphere && !showStylizedGlobe && <div className="globe-highlight" aria-hidden />}
            </div>
          </div>
        </div>

        {mode === 'map' && showBackButton && !flatMap && (
          <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100 }}>
            <button type="button" onClick={goToGlobe} style={hudBtn}>← Back to Globe</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobeHero;
