import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const GLOBE_CENTER = [29.8, -10];
const GLOBE_ZOOM = -0.2;

const ZIM_CENTER = [29.8, -19.5];
const ZIM_ZOOM = 6.2;

const POINT_ZOOM = 14;
const POINT_PITCH = 55;
const POINT_BEARING = -20;

const FAULT_COLORS = {
  PENDING: '#ef4444',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#10b981',
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
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
    labels: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#020406' } },
    { 
      id: 'satellite', 
      type: 'raster', 
      source: 'satellite', 
      minzoom: 0,
      paint: {
        'raster-brightness-max': 0.85,
        'raster-contrast': 0.15,
        'raster-saturation': 0.1
      }
    },
    { id: 'labels',    type: 'raster', source: 'labels',    minzoom: 5.5 },
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

const Map3DViewer = ({
  waterPoints = [],
  reports = [],
  technicians = [],
  onLocationSelected,
  selectedPos,
  flyToCode,
  isHero = false,
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const newMarkerRef = useRef(null);
  const rotationRef = useRef(null);
  const [mode, setMode] = useState('globe');
  const [activeWP, setActiveWP] = useState(null);

  // Build fault index (worst active fault per water point)
  const faultIndex = {};
  reports.forEach(r => {
    if (r.status === 'RESOLVED') return;
    const c = r.water_point_code;
    if (!faultIndex[c] || r.status === 'PENDING') faultIndex[c] = r;
  });

  // ── Rotation helpers ──────────────────────────────────
  const startRotation = (map) => {
    let currentLng = map.getCenter().lng;
    const currentLat = map.getCenter().lat;
    let lastTime = 0;
    
    const spin = (time) => {
      if (rotationRef.current === null) return;
      if (!lastTime) lastTime = time;
      const deltaTime = time - lastTime;
      lastTime = time;

      // Ensure consistent rotation speed regardless of frame rate
      currentLng += (0.005 * deltaTime);
      if (currentLng > 180) currentLng -= 360;
      
      if (mapRef.current) {
        mapRef.current.setCenter([currentLng, currentLat]);
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

  // ── Init map ──────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: TILE_STYLE,
      projection: { name: 'globe' },
      center: GLOBE_CENTER,
      zoom: GLOBE_ZOOM,
      minZoom: -2,
      maxZoom: 18,
      pitch: 0,
      bearing: 0,
      antialias: true,
      interactive: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      map.setProjection({ name: 'globe' });
      map.setFog({
        color: 'rgb(5, 5, 5)',
        'high-color': 'rgb(15, 15, 15)',
        'horizon-blend': 0.08,
        'space-color': '#000000',
        'star-intensity': 1.0,
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

  // ── Globe click → Zimbabwe ────────────────────────────
  const handleGlobeClick = () => {
    const map = mapRef.current;
    if (!map || mode !== 'globe') return;

    stopRotation();
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.dragRotate.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    map.flyTo({ center: ZIM_CENTER, zoom: ZIM_ZOOM, pitch: 0, bearing: 0, duration: 2400 });
    setMode('country');
    setActiveWP(null);

    map.on('click', (e) => {
      if (onLocationSelected && map.getZoom() >= 5) {
        onLocationSelected({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });
  };

  // ── Markers ───────────────────────────────────────────
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
        lbl.style.cssText = `
          background:${color};color:white;font-size:10px;font-weight:700;
          padding:2px 6px;border-radius:4px;white-space:nowrap;margin-bottom:3px;
          box-shadow:0 2px 8px rgba(0,0,0,.55);font-family:sans-serif;
          letter-spacing:.03em;animation:pulse-label 2s infinite;
        `;
        el.appendChild(lbl);
      }

      const dot = document.createElement('div');
      dot.style.cssText = `
        width:${hasFault ? '20px' : '15px'};height:${hasFault ? '20px' : '15px'};
        border-radius:50%;background:${color};border:3px solid rgba(255,255,255,0.9);
        box-shadow:0 2px 10px rgba(0,0,0,0.5)${hasFault ? `,0 0 0 5px ${color}44` : ''};
        transition:transform .2s;
      `;
      el.appendChild(dot);
      el.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.3)'; });
      el.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)'; });

      const popupHtml = fault
        ? `<div style="font-family:sans-serif;padding:6px 2px;min-width:165px;">
            <strong style="font-size:13px;color:#a3e635">${wp.code}</strong>
            <div style="font-size:12px;color:#888;margin:2px 0">${wp.location}</div>
            <hr style="border:none;border-top:1px solid #242424;margin:6px 0"/>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="background:${color};color:white;padding:2px 7px;border-radius:10px;font-weight:700">${fault.status.replace('_', ' ')}</span>
              <span style="color:#fff;font-weight:600">${FAULT_LABELS[fault.fault_code] || fault.fault_code}</span>
            </div>
            <div style="font-size:11px;color:#888;margin-top:5px">Ticket: ${fault.ticket_number}</div>
            <div style="font-size:11px;color:#888">From: ${fault.sender_number}</div>
           </div>`
        : `<div style="font-family:sans-serif;padding:4px 2px;">
            <strong style="font-size:13px;color:#a3e635">${wp.code}</strong>
            <div style="font-size:12px;color:#888">${wp.location}</div>
            <div style="font-size:11px;color:#10b981;margin-top:4px;font-weight:600">✓ No active faults</div>
           </div>`;

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([parseFloat(wp.longitude), parseFloat(wp.latitude)])
        .setPopup(new maplibregl.Popup({ offset: 10, closeButton: false, className: 'wp-popup' }).setHTML(popupHtml))
        .addTo(map);

      el.addEventListener('click', e => {
        e.stopPropagation();
        zoomToPoint(map, wp);
        if (!marker.getPopup().isOpen()) {
          marker.togglePopup();
        }
      });

      markersRef.current[wp.code] = marker;
    });

    // Technician markers
    technicians.forEach(tech => {
      if (!tech.current_lat || !tech.current_lng) return;

      const isDuty = tech.status === 'ON_DUTY' || tech.status === 'ON_SITE';
      const color = isDuty ? '#3b82f6' : '#888';

      const el = document.createElement('div');
      el.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;';

      const lbl = document.createElement('div');
      lbl.textContent = tech.name.split(' ')[0];
      lbl.style.cssText = `
        background:rgba(10,10,10,0.8);color:${color};font-size:10px;font-weight:700;
        padding:2px 6px;border-radius:4px;white-space:nowrap;margin-bottom:3px;
        border:1px solid ${color};box-shadow:0 2px 8px rgba(0,0,0,.55);
        font-family:sans-serif;letter-spacing:.03em;
      `;
      el.appendChild(lbl);

      const dot = document.createElement('div');
      dot.style.cssText = `
        width:14px;height:14px;border-radius:50%;background:${color};
        border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.6);
        transition:transform .2s;
      `;
      el.appendChild(dot);
      el.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.3)'; });
      el.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)'; });

      const popupHtml = `
        <div style="font-family:sans-serif;padding:4px 2px;min-width:140px;">
          <strong style="font-size:13px;color:#fff">${tech.name}</strong>
          <div style="font-size:12px;color:#888;margin:2px 0">${tech.zone || 'No Zone'}</div>
          <div style="display:inline-block;background:rgba(255,255,255,0.1);color:${color};padding:2px 6px;border-radius:10px;font-size:11px;font-weight:700;margin-top:4px;">
            ${tech.status.replace('_', ' ')}
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([parseFloat(tech.current_lng), parseFloat(tech.current_lat)])
        .setPopup(new maplibregl.Popup({ offset: 10, closeButton: false, className: 'wp-popup' }).setHTML(popupHtml))
        .addTo(map);

      el.addEventListener('click', e => {
        e.stopPropagation();
        if (!marker.getPopup().isOpen()) {
          marker.togglePopup();
        }
      });

      markersRef.current[`tech_${tech.id}`] = marker;
    });
  }, [waterPoints, reports, technicians]);

  // ── Selected position pin (new water point) ───────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPos) return;
    if (newMarkerRef.current) { newMarkerRef.current.remove(); newMarkerRef.current = null; }

    newMarkerRef.current = new maplibregl.Marker({ color: '#a3e635' })
      .setLngLat([selectedPos.lng, selectedPos.lat])
      .setPopup(new maplibregl.Popup({ offset: 25 }).setText('New Water Point'))
      .addTo(map);
    newMarkerRef.current.togglePopup();

    map.flyTo({ center: [selectedPos.lng, selectedPos.lat], zoom: POINT_ZOOM, pitch: POINT_PITCH, bearing: POINT_BEARING, duration: 2000 });
    setMode('point');
    setActiveWP({ code: 'New Point', location: '' });
  }, [selectedPos]);

  // ── Fly to code ───────────────────────────────────────
  useEffect(() => {
    if (!flyToCode || !mapRef.current) return;
    const wp = waterPoints.find(w => w.code === flyToCode);
    if (wp?.latitude && wp?.longitude) {
      zoomToPoint(mapRef.current, wp);
      setTimeout(() => { markersRef.current[wp.code]?.togglePopup(); }, 2100);
    }
  }, [flyToCode, waterPoints]);

  const zoomToPoint = (map, wp) => {
    stopRotation();
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.flyTo({
      center: [parseFloat(wp.longitude), parseFloat(wp.latitude)],
      zoom: POINT_ZOOM, pitch: POINT_PITCH, bearing: POINT_BEARING, duration: 2000,
    });
    setMode('point');
    setActiveWP(wp);
  };

  const goToZimbabwe = () => {
    const map = mapRef.current;
    if (!map) return;
    stopRotation();
    map.flyTo({ center: ZIM_CENTER, zoom: ZIM_ZOOM, pitch: 0, bearing: 0, duration: 1800 });
    setMode('country');
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
    map.flyTo({ center: GLOBE_CENTER, zoom: GLOBE_ZOOM, pitch: 0, bearing: 0, duration: 2000, essential: true });
    map.once('moveend', () => startRotation(map));
    setMode('globe');
    setActiveWP(null);
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          0%, 100% { opacity: 0.25; }
          50% { opacity: 1; }
        }
        @keyframes ctaHover {
          0%,100% { box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(163,230,53,0.15); }
          50%      { box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 35px rgba(163,230,53,0.3); }
        }

        .maplibregl-ctrl-attrib { display: none !important; }
        .maplibregl-ctrl-logo   { display: none !important; }

        /* ── Space background ── */
        .m3d-space-bg {
          position: absolute;
          inset: 0;
          background: #020406;
          overflow: hidden;
          z-index: 0;
        }
        .m3d-stars {
          position: absolute;
          inset: -50%;
          background-image:
            radial-gradient(1px 1px at  5% 12%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 15% 72%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1.5px 1.5px at 25% 30%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 35% 88%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 45% 55%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 65% 45%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 75% 80%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1.5px 1.5px at 85% 33%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 92% 65%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at  8% 48%, rgba(255,255,255,0.4), transparent);
          background-size: 500px 500px;
          animation: twinkle 6s infinite alternate;
        }

        /* ── Globe container in globe-mode ── */
        .m3d-globe-wrap {
          position: relative;
          height: 100%;
          aspect-ratio: 1 / 1;
          flex-shrink: 0;
          z-index: 10;
          cursor: pointer;
        }

        /* The actual round clipped viewport */
        .m3d-globe-clip {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          overflow: hidden;
          border: 1px solid rgba(20, 30, 40, 0.4);
          background: #020406;
          box-shadow: 0 0 60px rgba(0,0,0,0.5);
        }

        /* 3D Lighting Overlay */
        .m3d-globe-overlay {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          z-index: 5;
          box-shadow: 
            inset -80px -40px 140px rgba(0,0,0,0.95),
            inset 0 0 40px rgba(0,0,0,0.7);
          background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 85%, rgba(0,0,0,0.85) 100%);
        }

        /* ── CTA pill button ── */
        .m3d-cta-pill {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(14, 20, 10, 0.85);
          border: 1px solid rgba(163,230,53,0.25);
          border-radius: 40px;
          padding: 10px 28px;
          cursor: pointer;
          backdrop-filter: blur(8px);
          white-space: nowrap;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s;
        }
        .m3d-cta-pill:hover {
          transform: translateX(-50%) scale(1.03);
          background: rgba(20, 28, 15, 0.9);
        }
        .m3d-cta-pill span {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #a3e635;
          letter-spacing: 0.01em;
        }

        /* ── HUD bar ── */
        .m3d-hud {
          position: absolute;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(10,10,10,0.88);
          padding: 6px 14px;
          border-radius: 30px;
          border: 1px solid rgba(163,230,53,0.2);
          backdrop-filter: blur(8px);
          font-family: sans-serif;
          white-space: nowrap;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        /* ── Popup styling ── */
        .wp-popup .maplibregl-popup-content {
          background:#141414 !important;
          border:1px solid #242424 !important;
          border-radius:8px !important;
          padding:10px 12px !important;
          box-shadow:0 8px 24px rgba(0,0,0,.7) !important;
        }
        .wp-popup .maplibregl-popup-tip { border-top-color:#141414 !important; }
      `}</style>

      {/* ── Space background (globe mode only) ── */}
      {isHero && mode === 'globe' && (
        <div className="m3d-space-bg">
          <div className="m3d-stars" />
          <div className="m3d-stars m3d-stars-2" />
        </div>
      )}

      {/* ── Map Container Layout (Unified to prevent unmounts) ── */}
      <div 
        className={mode === 'globe' ? 'm3d-globe-wrap' : ''}
        style={mode === 'globe' ? { maxHeight: 'calc(100% - 20px)' } : { position: 'absolute', inset: 0 }}
        onClick={mode === 'globe' ? handleGlobeClick : undefined}
      >
        <div className={mode === 'globe' ? 'm3d-globe-clip' : ''} style={mode !== 'globe' ? { width: '100%', height: '100%' } : {}}>
          {/* This div must never be unmounted while the map exists */}
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          
          {mode === 'globe' && <div className="m3d-globe-overlay" />}
        </div>

        {mode === 'globe' && (
          <div className="m3d-cta-pill">
            <span>Click anywhere on the globe to zoom into Zimbabwe</span>
          </div>
        )}
      </div>

      {/* ── HUD (country / point modes) ── */}
      {mode !== 'globe' && (
        <div className="m3d-hud">
          {mode === 'country' && (
            <>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#a3e635' }} />
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>Zimbabwe</span>
              <span style={{ color: '#888', fontSize: 11 }}>— click a marker to zoom in</span>
              <button onClick={goToGlobe} style={hudBtn}>← Globe</button>
            </>
          )}
          {mode === 'point' && (
            <>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#a3e635', boxShadow: '0 0 0 3px rgba(163,230,53,0.25)' }} />
              <span style={{ color: '#a3e635', fontWeight: 700, fontSize: 13 }}>{activeWP?.code}</span>
              <span style={{ background: 'rgba(163,230,53,0.12)', color: '#a3e635', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>SATELLITE</span>
              <button onClick={goToZimbabwe} style={hudBtn}>← Zimbabwe</button>
              <button onClick={goToGlobe} style={{ ...hudBtn, background: 'transparent', color: '#666', borderColor: 'rgba(255,255,255,0.1)' }}>Globe</button>
            </>
          )}
        </div>
      )}

      {/* ── Legend (country / point modes) ── */}
      {mode !== 'globe' && (
        <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
          {[
            { color: '#ef4444', label: 'Pending fault' },
            { color: '#f59e0b', label: 'In progress' },
            { color: '#a3e635', label: 'No fault' },
            { color: '#3b82f6', label: 'Active Technician' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(10,10,10,0.8)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: '#fff', fontSize: 10, fontFamily: 'sans-serif' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Map3DViewer;
