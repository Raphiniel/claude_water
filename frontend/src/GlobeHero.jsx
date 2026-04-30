import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useNavigate } from 'react-router-dom';

const GLOBE_CENTER = [0, 15];   // centred on Earth so full globe is visible
const GLOBE_ZOOM   = 0.5;       // zoomed far out — full planet in view
const ZIM_CENTER   = [29.8, -19.5];
const ZIM_ZOOM     = 6.2;
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

const TILE_STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256, maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256, maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
    labels: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256, maxzoom: 19,
    },
  },
  layers: [
    { id: 'satellite', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 13,
      paint: { 'raster-fade-duration': 300 } },
    { id: 'osm', type: 'raster', source: 'osm', minzoom: 13,
      paint: {
        'raster-brightness-max': 0.55,
        'raster-saturation':    -0.4,
        'raster-contrast':       0.15,
        'raster-fade-duration':  300,
      }
    },
    { id: 'labels', type: 'raster', source: 'labels', minzoom: 5.5, maxzoom: 13,
      paint: { 'raster-fade-duration': 300 } },
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
}) => {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef({});
  const newMarkerRef    = useRef(null);
  const rotationRef     = useRef(null);
  const [mode, setMode] = useState('globe'); 
  const [activeWP, setActiveWP] = useState(null);
  const [mapMode, setMapMode]   = useState('country');
  const navigate = useNavigate();

  useEffect(() => {
    if (onModeChange) onModeChange(mode);
  }, [mode, onModeChange]);

  const faultIndex = {};
  reports.forEach(r => {
    if (r.status === 'RESOLVED') return;
    const c = r.water_point_code;
    if (!faultIndex[c] || r.status === 'PENDING') faultIndex[c] = r;
  });

  const startRotation = (map) => {
    let currentLng = map.getCenter().lng;
    const currentLat = map.getCenter().lat;
    
    const spin = () => {
      currentLng -= 0.15; 
      if (currentLng < -180) currentLng += 360;
      if (mapRef.current) {
        mapRef.current.jumpTo({ center: [currentLng, currentLat] });
        rotationRef.current = requestAnimationFrame(spin);
      }
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
    if (!mapContainerRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: TILE_STYLE,
      projection: { name: 'globe' },
      center: GLOBE_CENTER,
      zoom: GLOBE_ZOOM,
      pitch: 0, bearing: 0,
      antialias: true,
      interactive: false,
    });
    mapRef.current = map;
    map.on('load', () => {
      map.setProjection({ name: 'globe' });
      map.setFog({
        color:            'rgba(255, 255, 255, 0.8)',
        'high-color':     'rgba(163, 230, 53, 0.1)',   
        'horizon-blend':  0.2,               
        'space-color':    'rgba(0, 0, 0, 0)',          
        'star-intensity': 0.0,                         
      });
      startRotation(map);
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
  }, []);

  const handleGlobeClick = () => {
    if (mode !== 'globe') return;
    setMode('map');
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mode !== 'map') return;

    stopRotation();
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.dragRotate.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    map.flyTo({ center: ZIM_CENTER, zoom: ZIM_ZOOM, pitch: 0, bearing: 0, duration: 2400 });
    setMapMode('country');
    setActiveWP(null);

    map.on('click', (e) => {
      if (onLocationSelected && map.getZoom() >= 5) {
        onLocationSelected({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    waterPoints.forEach(wp => {
      if (!wp.latitude || !wp.longitude) return;
      const fault = faultIndex[wp.code];
      const color = fault ? (FAULT_COLORS[fault.status] || '#ef4444') : '#a3e635';
      const hasFault = !!fault;

      const el = document.createElement('div');
      el.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;';

      if (hasFault) {
        const lbl = document.createElement('div');
        lbl.textContent = FAULT_LABELS[fault.fault_code] || fault.fault_code;
        lbl.style.cssText = `background:${color};color:white;font-size:10px;font-weight:700;
          padding:2px 6px;border-radius:4px;white-space:nowrap;margin-bottom:3px;
          box-shadow:0 2px 8px rgba(0,0,0,.55);font-family:sans-serif;
          letter-spacing:.03em;animation:pulse-label 2s infinite;`;
        el.appendChild(lbl);
      }

      const dot = document.createElement('div');
      dot.style.cssText = `
        width:${hasFault ? '20px' : '15px'};height:${hasFault ? '20px' : '15px'};
        border-radius:50%;background:${color};border:3px solid rgba(255,255,255,0.9);
        box-shadow:0 2px 10px rgba(0,0,0,0.5)${hasFault ? `,0 0 0 5px ${color}44` : ''};
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
  }, [waterPoints, reports]);

  const zoomToPoint = (map, wp) => {
    stopRotation();
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.flyTo({
      center: [parseFloat(wp.longitude), parseFloat(wp.latitude)],
      zoom: POINT_ZOOM, pitch: POINT_PITCH, bearing: POINT_BEARING, duration: 2000,
    });
    setMapMode('point');
    setActiveWP(wp);
  };

  const goToZimbabwe = () => {
    const map = mapRef.current;
    if (!map) return;
    stopRotation();
    map.flyTo({ center: ZIM_CENTER, zoom: ZIM_ZOOM, pitch: 0, bearing: 0, duration: 1800 });
    setMapMode('country');
    setActiveWP(null);
  };

  const goToGlobe = () => {
    const map = mapRef.current;
    if (!map) return;
    stopRotation();
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    map.flyTo({ center: GLOBE_CENTER, zoom: GLOBE_ZOOM, pitch: 0, bearing: 0, duration: 2400, essential: true });
    map.once('moveend', () => startRotation(map));
    setMode('globe');
    setMapMode('country');
    setActiveWP(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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

        /* Hide attribution for clean look */
        .maplibregl-ctrl-attrib { display: none !important; }

        .globe-aura {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 110%;
          height: 110%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(163,230,53,0.1) 0%, rgba(163,230,53,0.02) 40%, transparent 70%);
          pointer-events: none;
          z-index: 1;
        }

        .globe-container {
          position: relative;
          height: 82%;
          aspect-ratio: 1 / 1;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          border: 1px solid rgba(163,230,53,0.2);
          box-shadow: 0 0 80px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,0,0,0.6);
          transition: all 0.4s ease;
          flex-shrink: 0;
          background: #000;
          z-index: 10;
        }

        .globe-container:hover {
          border-color: rgba(163,230,53,0.4);
          transform: scale(1.01);
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
      `}</style>

      <div style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#020406'
      }}>
        
        {mode === 'globe' && (
          <div className="space-bg">
            <div className="stars" />
            <div className="stars" style={{ animationDelay: '1s', opacity: 0.5, transform: 'rotate(45deg)' }} />
          </div>
        )}

        {mode === 'globe' && <div className="globe-aura" />}

        <div 
          className={mode === 'globe' ? 'globe-container' : ''}
          onClick={mode === 'globe' ? handleGlobeClick : undefined}
          style={{
            zIndex: 10,
            transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            ...(mode === 'map' ? { width: '100%', height: '100%', position: 'absolute', inset: 0, borderRadius: '16px' } : {})
          }}
        >
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: 'transparent' }} />
        </div>

        {mode === 'map' && (
          <div style={{ position: 'absolute', top: 20, right: 20, zHeight: 100 }}>
             <button onClick={goToGlobe} style={hudBtn}>← Back to Globe</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobeHero;
