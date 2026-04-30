import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const GLOBE_CENTER = [29.8, -10];
const GLOBE_ZOOM   = 1.5;

const ZIM_CENTER = [29.8, -19.5];
const ZIM_ZOOM   = 6.2;

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
    // Satellite — the primary look for the globe
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
    // Place name labels
    labels: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    // Satellite is the base layer now
    { id: 'satellite', type: 'raster', source: 'satellite', minzoom: 0 },
    // Labels only when zoomed in to avoid cluttering the globe
    { id: 'labels',    type: 'raster', source: 'labels',    minzoom: 5.5 },
  ],
};

const Map3DViewer = ({ waterPoints = [], reports = [], onLocationSelected, selectedPos, flyToCode }) => {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef({});
  const newMarkerRef    = useRef(null);
  const rotationRef     = useRef(null);
  const [mode, setMode] = useState('globe');
  const [activeWP, setActiveWP] = useState(null);

  const faultIndex = {};
  reports.forEach(r => {
    if (r.status === 'RESOLVED') return;
    const c = r.water_point_code;
    if (!faultIndex[c] || r.status === 'PENDING') faultIndex[c] = r;
  });

  // ── slow auto-rotation while in globe mode ────────────
  const startRotation = (map) => {
    let bearing = map.getBearing();
    const spin = () => {
      bearing -= 0.08;
      map.setBearing(bearing);
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

  // ── init map ──────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: TILE_STYLE,
      projection: { name: 'globe' }, // explicitly use object syntax
      center: GLOBE_CENTER,
      zoom: GLOBE_ZOOM,
      pitch: 0,
      bearing: 0,
      antialias: true,
      interactive: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Re-assert projection on load
      map.setProjection({ name: 'globe' });
      
      map.setFog({
        color:            'rgb(5, 5, 5)',
        'high-color':     'rgb(15, 15, 15)',
        'horizon-blend':  0.08,
        'space-color':    '#000000',
        'star-intensity': 1.0,
      });

      // start slow spin
      startRotation(map);
    });

    return () => {
      stopRotation();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── globe click → Zimbabwe ────────────────────────────
  const handleGlobeClick = () => {
    const map = mapRef.current;
    if (!map || mode !== 'globe') return;

    stopRotation();

    // re-enable interactions for the zoomed-in view
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.dragRotate.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();

    map.flyTo({ center: ZIM_CENTER, zoom: ZIM_ZOOM, pitch: 0, bearing: 0, duration: 2400 });
    setMode('country');
    setActiveWP(null);

    // wire up map click for location selection once zoomed in
    map.on('click', (e) => {
      if (onLocationSelected && map.getZoom() >= 5) {
        onLocationSelected({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });
  };

  // ── markers ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    waterPoints.forEach(wp => {
      if (!wp.latitude || !wp.longitude) return;

      const fault = faultIndex[wp.code];
      const color = fault ? FAULT_COLORS[fault.status] || '#ef4444' : '#a3e635';
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
              <span style="background:${color};color:white;padding:2px 7px;border-radius:10px;font-weight:700">${fault.status.replace('_',' ')}</span>
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
      });

      markersRef.current[wp.code] = marker;
    });
  }, [waterPoints, reports]);

  // ── selectedPos (new WP pin) ──────────────────────────
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

  // ── flyToCode ─────────────────────────────────────────
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

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <style>{`
        @keyframes pulse-label {
          0%,100% { opacity:1; transform:translateY(0); }
          50%      { opacity:.82; transform:translateY(-2px); }
        }
        .wp-popup .maplibregl-popup-content {
          background:#141414 !important;border:1px solid #242424 !important;
          border-radius:8px !important;padding:10px 12px !important;
          box-shadow:0 8px 24px rgba(0,0,0,.7) !important;
        }
        .wp-popup .maplibregl-popup-tip { border-top-color:#141414 !important; }
      `}</style>

      {/* clickable globe overlay — only active in globe mode */}
      {mode === 'globe' && (
        <div
          onClick={handleGlobeClick}
          style={{
            position: 'absolute', inset: 0, zIndex: 5, cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-end',
            paddingBottom: '60px',
          }}
        >
          <div style={{
            background: 'rgba(10,10,10,0.85)',
            border: '2px solid #a3e635',
            borderRadius: 40,
            padding: '12px 32px',
            backdropFilter: 'blur(12px)',
            fontFamily: 'sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 15px rgba(163,230,53,0.15)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <span style={{
              color: '#a3e635',
              fontSize: '15px',
              fontWeight: '700',
              letterSpacing: '0.01em',
              textShadow: '0 0 12px rgba(163,230,53,0.3)',
            }}>
              Click anywhere on the globe to zoom into Zimbabwe
            </span>
          </div>
        </div>
      )}

      <div ref={mapContainerRef} style={{ height: '100%', width: '100%', borderRadius: '14px', overflow: 'hidden', background: '#000' }} />

      {/* HUD — only shown after leaving globe */}
      {mode !== 'globe' && (
        <div style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(10,10,10,0.88)', padding: '6px 14px', borderRadius: 30,
          border: '1px solid rgba(163,230,53,0.2)', backdropFilter: 'blur(8px)',
          fontFamily: 'sans-serif', whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
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

      {/* Legend */}
      {mode !== 'globe' && (
        <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
          {[
            { color: '#ef4444', label: 'Pending fault' },
            { color: '#f59e0b', label: 'In progress' },
            { color: '#a3e635', label: 'No fault' },
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

export default Map3DViewer;
