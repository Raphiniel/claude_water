import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const FLY_TO_ZOOM = 18;
const PITCH_3D = 60;
const BEARING_3D = -20;
const LAYER_ID_3D = '3d-buildings';

const Map3DViewer = ({ waterPoints, onLocationSelected, selectedPos }) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef({}); // Store references to standard markers
    const newPointMarkerRef = useRef(null); // Reference to the "New Water Point" marker
    
    const [is3D, setIs3D] = useState(false);
    const [activePoint, setActivePoint] = useState(null);

    // Initial map setup
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [29.1549, -19.0154], // Zimbabwe center [lng, lat]
            zoom: 6,
            pitch: 0,
            bearing: 0,
            antialias: true
        });

        mapRef.current = map;

        map.on('load', () => {
            // Click to add new point
            map.on('click', (e) => {
                if (onLocationSelected) {
                    onLocationSelected({ lat: e.lngLat.lat, lng: e.lngLat.lng });
                }
            });
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // ─── Render New Selected Location Marker ───
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Clean up previous selection marker
        if (newPointMarkerRef.current) {
            newPointMarkerRef.current.remove();
            newPointMarkerRef.current = null;
        }

        if (selectedPos) {
            newPointMarkerRef.current = new maplibregl.Marker({ color: '#FF3366' })
                .setLngLat([selectedPos.lng, selectedPos.lat])
                .setPopup(new maplibregl.Popup({ offset: 25 }).setText('New Water Point Location'))
                .addTo(map);
            
            // Re-open popup automatically
            newPointMarkerRef.current.togglePopup();

            // ZOOM TO 3D automatically when a new point is selected
            setIs3D(true);
            setActivePoint({ code: 'New Point', longitude: selectedPos.lng, latitude: selectedPos.lat });

            map.flyTo({
                center: [selectedPos.lng, selectedPos.lat],
                zoom: FLY_TO_ZOOM,
                pitch: PITCH_3D,
                bearing: BEARING_3D,
                duration: 2000,
                essential: true
            });

            map.once('moveend', () => {
                add3DLayer(map);
            });
        }
    }, [selectedPos]);

    // ─── Render Water Points (Existing) ───
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Remove old markers that are no longer in the list (or we can just blindly clear and re-add for simplicity)
        Object.values(markersRef.current).forEach(m => m.remove());
        markersRef.current = {};

        waterPoints.forEach(wp => {
            if (wp.latitude && wp.longitude) {
                const el = document.createElement('div');
                el.style.cssText = `
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background-color: #3b82f6;
                    border: 3px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    cursor: pointer;
                    transition: transform 0.2s ease;
                `;
                
                el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.2)');
                el.addEventListener('mouseleave', () => el.style.transform = 'scale(1)');

                const popupHtml = `
                    <div style="color: #222; font-family: sans-serif; padding: 4px;">
                        <strong style="font-size: 14px;">${wp.code}</strong><br/>
                        <span style="font-size: 13px;">${wp.location}</span><br/>
                        <span style="font-size: 11px; color: #555;">${wp.description || ''}</span>
                    </div>
                `;

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([wp.longitude, wp.latitude])
                    .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(popupHtml))
                    .addTo(map);
                
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleMarkerClick(wp);
                });

                markersRef.current[wp.id] = marker;
            }
        });

    }, [waterPoints]);

    // ─── 3D Logic ───
    const add3DLayer = (map) => {
        if (map.getLayer(LAYER_ID_3D)) return;
        
        // Dark matter style uses 'carto' as vector source and 'building' as the layer
        if (map.getSource('carto')) {
            map.addLayer(
                {
                    id: LAYER_ID_3D,
                    type: 'fill-extrusion',
                    source: 'carto',
                    'source-layer': 'building',
                    filter: ['has', 'render_height'],
                    paint: {
                        'fill-extrusion-color': '#4a5568',
                        'fill-extrusion-height': ['get', 'render_height'],
                        'fill-extrusion-base': ['get', 'render_min_height'],
                        'fill-extrusion-opacity': 0.8,
                    },
                }
            );
        }
    };

    const handleMarkerClick = (wp) => {
        const map = mapRef.current;
        if (!map) return;

        setIs3D(true);
        setActivePoint(wp);

        map.flyTo({
            center: [wp.longitude, wp.latitude],
            zoom: FLY_TO_ZOOM,
            pitch: PITCH_3D,
            bearing: BEARING_3D,
            duration: 2000,
            essential: true
        });

        map.once('moveend', () => {
            add3DLayer(map);
        });
    };

    const handleReset = () => {
        const map = mapRef.current;
        if (!map) return;

        if (map.getLayer(LAYER_ID_3D)) {
            map.removeLayer(LAYER_ID_3D);
        }

        map.easeTo({
            pitch: 0,
            bearing: 0,
            zoom: 6,
            duration: 1000
        });

        setIs3D(false);
        setActivePoint(null);
    };

    return (
        <div style={{ position: 'relative', height: '400px', width: '100%', marginBottom: '2rem' }}>
            <div 
                ref={mapContainerRef} 
                style={{ 
                    height: '100%', 
                    width: '100%', 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    border: '1px solid var(--border-color)',
                    background: '#1a1a1a'
                }} 
            />

            {is3D && activePoint && (
                <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '8px 16px',
                    borderRadius: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    fontFamily: 'sans-serif'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#3b82f6',
                        boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)'
                    }}></div>
                    <span style={{ color: '#111', fontWeight: 'bold', fontSize: '14px' }}>
                        {activePoint.code}
                    </span>
                    <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '12px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                        3D View
                    </span>
                    <button 
                        onClick={handleReset}
                        style={{
                            marginLeft: '8px',
                            background: '#1f2937',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                    >
                        ← Back to 2D
                    </button>
                </div>
            )}
        </div>
    );
};

export default Map3DViewer;
