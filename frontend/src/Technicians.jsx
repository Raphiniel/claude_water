import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from './AuthContext';
import { formatDate } from './App';
import { API_BASE as API } from './apiConfig';

// ── Inline Map Picker with Places Search ───────────────────
const MapPicker = ({ lat, lng, onChange }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: { sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 } },
        layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
      },
      center: [lng || 29.8, lat || -19.5],
      zoom: lat ? 10 : 5.5,
    });
    mapRef.current = map;

    if (lat && lng) {
      markerRef.current = new maplibregl.Marker({ color: '#a3e635' }).setLngLat([lng, lat]).addTo(map);
    }

    map.on('click', (e) => {
      const { lng: clickLng, lat: clickLat } = e.lngLat;
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new maplibregl.Marker({ color: '#a3e635' }).setLngLat([clickLng, clickLat]).addTo(map);
      onChange({ lat: clickLat.toFixed(6), lng: clickLng.toFixed(6) });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=6&countrycodes=zw`);
      const data = await res.json();
      setResults(data);
    } catch { setResults([]); } finally { setSearching(false); }
  };

  const selectPlace = (place) => {
    const placeLat = parseFloat(place.lat);
    const placeLng = parseFloat(place.lon);
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = new maplibregl.Marker({ color: '#a3e635' }).setLngLat([placeLng, placeLat]).addTo(mapRef.current);
    mapRef.current.flyTo({ center: [placeLng, placeLat], zoom: 12, duration: 1200 });
    onChange({ lat: placeLat.toFixed(6), lng: placeLng.toFixed(6) });
    setResults([]);
    setSearch(place.display_name.split(',')[0]);
  };

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
            placeholder="Search for a place in Zimbabwe..."
            style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none' }}
          />
          <button type="button" onClick={handleSearch} style={{ background: 'rgba(163,230,53,0.12)', border: '1px solid rgba(163,230,53,0.25)', color: '#a3e635', borderRadius: '8px', padding: '0.5rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            {searching ? '...' : 'Search'}
          </button>
        </div>
        {results.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.7)' }}>
            {results.map((r, i) => (
              <button key={i} type="button" onClick={() => selectPlace(r)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#ccc', padding: '9px 14px', cursor: 'pointer', fontSize: '0.83rem', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(163,230,53,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ color: '#a3e635', fontWeight: 600 }}>{r.display_name.split(',')[0]}</span>
                <span style={{ color: '#666', fontSize: '0.76rem', marginLeft: 6 }}>{r.display_name.split(',').slice(1, 3).join(',')}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(163,230,53,0.2)' }}>
        <div ref={containerRef} style={{ width: '100%', height: '200px' }} />
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(4px)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: '6px', padding: '4px 10px', fontSize: '0.72rem', color: '#a3e635', fontWeight: 600, pointerEvents: 'none' }}>
          {lat && lng ? `📍 ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}` : 'Click map to set location'}
        </div>
      </div>
    </div>
  );
};

const Technicians = () => {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [form, setForm] = useState({ name: '', phone: '', zone: '', latitude: '', longitude: '', is_available: true });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [menuState, setMenuState] = useState(null); // { id, x, y }
  const { user } = useAuth();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  const fetchTechnicians = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/technicians/`, { headers: authHeader() });
      setTechnicians(res.data);
      setFetchError(null);
    } catch (err) {
      setFetchError(err.response?.data ? JSON.stringify(err.response.data) : err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { fetchTechnicians(); }, [fetchTechnicians]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const payload = {
      ...form,
      latitude: form.latitude === '' ? null : form.latitude,
      longitude: form.longitude === '' ? null : form.longitude,
    };
    try {
      const res = await axios.post(`${API}/api/technicians/`, payload, { headers: authHeader() });
      setTechnicians(prev => [...prev, res.data]);
      setShowForm(false);
      setForm({ name: '', phone: '', latitude: '', longitude: '', is_available: true });
    } catch (err) {
      setFormError(err.response?.data ? JSON.stringify(err.response.data) : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (tech) => {
    try {
      const res = await axios.patch(
        `${API}/api/technicians/${tech.id}/`,
        { is_available: !tech.is_available },
        { headers: authHeader() }
      );
      setTechnicians(prev => prev.map(t => t.id === tech.id ? res.data : t));
    } catch (err) {
      alert('Failed to update availability');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this technician?')) return;
    try {
      await axios.delete(`${API}/api/technicians/${id}/`, { headers: authHeader() });
      setTechnicians(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      alert('Failed to delete technician');
    }
  };

  const available = technicians.filter(t => t.is_available).length;
  const busy = technicians.length - available;
  const lastRegistered = technicians.length > 0 ? technicians.reduce((latest, t) => new Date(t.created_at) > new Date(latest.created_at) ? t : latest, technicians[0]) : null;

  const filteredTechnicians = technicians.filter(t => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !t.phone.includes(searchQuery)) return false;
    if (statusFilter === 'Available' && !t.is_available) return false;
    if (statusFilter === 'Busy' && t.is_available) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="page-title">Technicians</h2>
          <p className="page-subtitle">{technicians.length} registered · <span style={{ color: '#10b981' }}>{available} available</span></p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={fetchTechnicians} className="btn-secondary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ marginTop: 0, padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            {showForm ? '✕ Cancel' : '+ Add Technician'}
          </button>
        </div>
      </div>

      {fetchError && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>API error: {fetchError}</div>}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', width: '90%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Register New Technician</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#666' }}>Fill in the details below to add a technician</p>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#888', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {form.name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(163,230,53,0.05)', border: '1px solid rgba(163,230,53,0.15)', borderRadius: '10px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#a3e635', color: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
                    {form.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{form.name}</div>
                    <div style={{ color: '#888', fontSize: '0.78rem' }}>{form.phone || 'No phone yet'} · {form.zone || 'No zone'}</div>
                  </div>
                </div>
              )}
              {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{formError}</div>}
              <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Moyo" required />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+263771234567" required />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Zone / Area</label>
                  <input value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} placeholder="e.g. Harare North" />
                </div>
                <div className="form-group">
                  <label>Latitude</label>
                  <input value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="-19.000" />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="29.000" />
                </div>
                <MapPicker
                  lat={form.latitude ? parseFloat(form.latitude) : null}
                  lng={form.longitude ? parseFloat(form.longitude) : null}
                  onChange={({ lat, lng }) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
                />
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '0.65rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 2, marginTop: 0 }}>{saving ? 'Saving...' : 'Save Technician'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="mini-stat-card compact" onClick={() => setActiveModal('total')} style={{ border: '1px solid rgba(163,230,53,0.3)', cursor: 'pointer', transition: 'transform 0.15s, border-color 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.borderColor='rgba(163,230,53,0.6)'; }} onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.borderColor='rgba(163,230,53,0.3)'; }}>
          <div className="stat-icon" style={{ background: 'rgba(163,230,53,0.1)', color: '#a3e635' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div className="stat-content"><p className="stat-label">Total Technicians</p><h3 className="stat-value">{technicians.length}</h3><p className="stat-sub">Registered in system</p></div>
        </div>
        <div className="mini-stat-card compact" onClick={() => setActiveModal('available')} style={{ border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer', transition: 'transform 0.15s, border-color 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.borderColor='rgba(96,165,250,0.6)'; }} onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.borderColor='rgba(59,130,246,0.3)'; }}>
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <div className="stat-content"><p className="stat-label">Available</p><h3 className="stat-value">{available}</h3><p className="stat-sub">Ready for assignment</p></div>
        </div>
        <div className="mini-stat-card compact" onClick={() => setActiveModal('busy')} style={{ border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', transition: 'transform 0.15s, border-color 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.borderColor='rgba(251,191,36,0.6)'; }} onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.borderColor='rgba(245,158,11,0.3)'; }}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <div className="stat-content"><p className="stat-label">Busy</p><h3 className="stat-value">{busy}</h3><p className="stat-sub">Currently assigned</p></div>
        </div>
        <div className="mini-stat-card compact" onClick={fetchTechnicians} style={{ border: '1px solid rgba(168,85,247,0.3)', cursor: 'pointer', transition: 'transform 0.15s, border-color 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.borderColor='rgba(192,132,252,0.6)'; }} onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.borderColor='rgba(168,85,247,0.3)'; }}>
          <div className="stat-icon" style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg></div>
          <div className="stat-content"><p className="stat-label">Last Registered</p><h3 className="stat-value" style={{ fontSize: '1.1rem' }}>{lastRegistered ? new Date(lastRegistered.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</h3><p className="stat-sub">Click to refresh</p></div>
        </div>
      </div>

      {/* KPI Modals */}
      {activeModal && (() => {
        const modalData = activeModal === 'total' ? technicians : activeModal === 'available' ? technicians.filter(t => t.is_available) : technicians.filter(t => !t.is_available);
        const modalTitle = activeModal === 'total' ? 'All Technicians' : activeModal === 'available' ? 'Available Technicians' : 'Busy Technicians';
        return (
          <div onClick={() => setActiveModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', width: '90%', maxWidth: '680px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{modalTitle}</h3><p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#666' }}>{modalData.length} technicians</p></div>
                <button onClick={() => setActiveModal(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#888', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {modalData.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem', color: '#555' }}>No technicians found.</div> : modalData.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#a3e635', color: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>{t.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{t.name}</div>
                      <div style={{ color: '#888', fontSize: '0.78rem' }}>{t.phone}</div>
                    </div>
                    <span style={{ background: t.is_available ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: t.is_available ? '#10b981' : '#f59e0b', border: `1px solid ${t.is_available ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600 }}>{t.is_available ? 'AVAILABLE' : 'BUSY'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="search-bar" style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search by name, phone or location..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', color: '#fff', border: 'none', width: '100%', outline: 'none', fontSize: '0.9rem' }}
          />
        </div>
        <select 
          className="form-control" 
          value={statusFilter} 
          onChange={e => setStatusFilter(e.target.value)}
          style={{ width: '180px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
        >
          <option>All Status</option>
          <option>Available</option>
          <option>Busy</option>
        </select>
        <select 
          className="form-control" 
          value={locationFilter} 
          onChange={e => setLocationFilter(e.target.value)}
          style={{ width: '180px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
        >
          <option>All Locations</option>
        </select>
        <button className="btn-secondary" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
          Filters
        </button>
      </div>

      <div className="glass-panel" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading">Loading technicians...</div>
        ) : technicians.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', opacity: 0.4 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p>No technicians registered yet.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Add technicians to enable fault assignment.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Technician</th>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Phone</th>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Location</th>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Status</th>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Registered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTechnicians.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#a3e635', color: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                          {t.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>{t.name}</strong>
                          <span style={{ color: '#888', fontSize: '0.8rem' }}>Technician</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        {t.phone}
                      </div>
                    </td>
                    <td className="mono muted" style={{ fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        {t.latitude && t.longitude
                          ? `${t.latitude}, ${t.longitude}`
                          : <span style={{ fontStyle: 'italic' }}>—</span>}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleAvailability(t)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.02)', color: t.is_available ? '#10b981' : '#f59e0b', border: `1px solid ${t.is_available ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        title="Click to toggle availability"
                      >
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.is_available ? '#10b981' : '#f59e0b' }} />
                        {t.is_available ? 'AVAILABLE' : 'BUSY'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: '#fff', fontSize: '0.85rem' }}>{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span style={{ color: '#888', fontSize: '0.75rem' }}>{new Date(t.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuState(menuState?.id === t.id ? null : { id: t.id, x: rect.right, y: rect.bottom + 4 });
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--glass-border)' }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>
            Showing 1 to {filteredTechnicians.length} of {filteredTechnicians.length} results
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}>&lt;</button>
            <button style={{ background: 'rgba(163,230,53,0.2)', border: '1px solid rgba(163,230,53,0.3)', color: '#a3e635', padding: '0.25rem 0.75rem', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>1</button>
            <button style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}>&gt;</button>
          </div>
        </div>
      </div>

      {/* Fixed-position dropdown portal — escapes overflow:hidden */}
      {menuState && (() => {
        const t = filteredTechnicians.find(x => x.id === menuState.id);
        if (!t) return null;
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 490 }} onClick={() => setMenuState(null)} />
            <div style={{
              position: 'fixed',
              right: window.innerWidth - menuState.x,
              top: menuState.y,
              zIndex: 500,
              background: '#141414',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              minWidth: '175px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            }}>
              <button
                onClick={() => { setMenuState(null); toggleAvailability(t); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', color: '#ccc', padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(163,230,53,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                Toggle Availability
              </button>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 8px' }} />
              <button
                onClick={() => { setMenuState(null); handleDelete(t.id); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', color: '#ef4444', padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path></svg>
                Delete
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
};

export default Technicians;
