import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIconRetina,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const LocationMarker = ({ onLocationSelected, selectedPos }) => {
    useMapEvents({
        click(e) {
            onLocationSelected(e.latlng);
        },
    });

    return selectedPos ? (
        <Marker position={selectedPos}>
            <Popup>New Water Point Location</Popup>
        </Marker>
    ) : null;
};

const MapComponent = ({ waterPoints, onLocationSelected, selectedPos }) => {
    const zimCenter = [-19.0154, 29.1549];
    const [map, setMap] = useState(null);

    return (
        <div style={{ height: '400px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
            <MapContainer 
                center={zimCenter} 
                zoom={6} 
                style={{ height: '100%', width: '100%' }}
                whenCreated={setMap}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                
                {waterPoints.map((wp) => (
                    wp.latitude && wp.longitude && (
                        <Marker key={wp.id} position={[wp.latitude, wp.longitude]}>
                            <Popup>
                                <strong>{wp.code}</strong><br />
                                {wp.location}<br />
                                <span style={{fontSize: '0.8rem', color: '#666'}}>{wp.description}</span>
                            </Popup>
                        </Marker>
                    )
                ))}

                <LocationMarker onLocationSelected={onLocationSelected} selectedPos={selectedPos} />
            </MapContainer>
        </div>
    );
};

export default MapComponent;
