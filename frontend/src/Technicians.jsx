import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from './AuthContext';
import { formatDate } from './App';
import Map3DViewer from './Map3DViewer';
import TableRowMenu, { TableRowMenuItem } from './TableRowMenu';
import { API_BASE as API } from './apiConfig';

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Active', dot: 'purple', hint: 'On the roster' },
  { key: 'AVAILABLE', label: 'Available', dot: 'green', hint: 'Ready for assignment' },
  { key: 'BUSY', label: 'Busy', dot: 'amber', hint: 'Currently assigned' },
  { key: 'NO_LOCATION', label: 'No location', dot: 'red', hint: 'Missing coordinates' },
  { key: 'INACTIVE', label: 'Inactive', dot: 'red', hint: 'Deactivated staff' },
];

const EMPTY_FORM = {
  name: '',
  phone: '',
  zone: '',
  latitude: '',
  longitude: '',
  is_available: true,
};

function techToForm(tech) {
  return {
    name: tech.name || '',
    phone: tech.phone || '',
    zone: tech.zone || '',
    latitude: tech.latitude != null && tech.latitude !== '' ? String(tech.latitude) : '',
    longitude: tech.longitude != null && tech.longitude !== '' ? String(tech.longitude) : '',
    is_available: tech.is_available !== false,
  };
}

function formatRelativeTime(date) {
  if (!date) return '—';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function techInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function copyFieldPortalLink(tech) {
  const url = `${window.location.origin}/field?token=${encodeURIComponent(tech.field_token || '')}`;
  if (tech.field_token) {
    navigator.clipboard
      .writeText(url)
      .then(() => alert('Field portal link copied. Send it to the technician to open on their phone.'))
      .catch(() => window.prompt('Copy this link:', url));
  } else {
    alert('Field token not available yet — refresh the list after saving this technician.');
  }
}

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
        sources: {
          sat: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 19,
          },
        },
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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=6&countrycodes=zw`
      );
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
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
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
            placeholder="Search for a place in Zimbabwe…"
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              borderRadius: 8,
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            className="btn-secondary btn-sm"
            style={{ marginTop: 0 }}
          >
            {searching ? '…' : 'Search'}
          </button>
        </div>
        {results.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 50,
              marginTop: 4,
              background: '#141414',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
            }}
          >
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectPlace(r)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  color: '#ccc',
                  padding: '9px 14px',
                  cursor: 'pointer',
                  fontSize: '0.83rem',
                  borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <span style={{ color: '#a3e635', fontWeight: 600 }}>{r.display_name.split(',')[0]}</span>
                <span style={{ color: '#666', fontSize: '0.76rem', marginLeft: 6 }}>
                  {r.display_name.split(',').slice(1, 3).join(',')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="waterpoints-map-preview"
        style={{ height: 200, borderRadius: 12 }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(10,10,10,0.85)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(163,230,53,0.2)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: '0.72rem',
            color: '#a3e635',
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {lat && lng ? `📍 ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}` : 'Click map to set location'}
        </div>
      </div>
    </div>
  );
};

const TechnicianFormModal = ({ mode, form, setForm, formError, saving, onClose, onSubmit }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '92%' }}>
      <div className="modal-header">
        <div>
          <h3>{mode === 'edit' ? 'Edit technician' : 'Register technician'}</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {mode === 'edit'
              ? 'Update contact details and base location.'
              : 'Add field staff details and optional base location.'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ✕
        </button>
      </div>

      {form.name && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'rgba(163,230,53,0.05)',
            border: '1px solid rgba(163,230,53,0.15)',
            borderRadius: 10,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#a3e635',
              color: '#0d0d0d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            {techInitials(form.name)}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{form.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {form.phone || 'No phone yet'} · {form.zone || 'No zone'}
            </div>
          </div>
        </div>
      )}

      {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{formError}</div>}

      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}
      >
        <div className="form-group">
          <label htmlFor="tech-name">Full name</label>
          <input
            id="tech-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. John Moyo"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="tech-phone">Phone number</label>
          <input
            id="tech-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+263771234567"
            required
          />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="tech-zone">Zone / area</label>
          <input
            id="tech-zone"
            value={form.zone}
            onChange={(e) => setForm({ ...form, zone: e.target.value })}
            placeholder="e.g. Harare North"
          />
        </div>
        <div className="form-group">
          <label htmlFor="tech-lat">Latitude</label>
          <input
            id="tech-lat"
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            placeholder="-19.000"
          />
        </div>
        <div className="form-group">
          <label htmlFor="tech-lng">Longitude</label>
          <input
            id="tech-lng"
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            placeholder="29.000"
          />
        </div>
        <MapPicker
          lat={form.latitude ? parseFloat(form.latitude) : null}
          lng={form.longitude ? parseFloat(form.longitude) : null}
          onChange={({ lat, lng }) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
        />
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: '0.25rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ marginTop: 0 }}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save technician'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

const TechnicianDetailModal = ({ tech, onClose, onEdit, onToggleAvailability, onDeactivate, onCopyLink }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div
      className="modal-panel"
      onClick={(e) => e.stopPropagation()}
      style={{ maxWidth: 520, width: '92%' }}
    >
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#a3e635',
              color: '#0d0d0d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            {techInitials(tech.name)}
          </div>
          <div>
            <h3 style={{ margin: 0 }}>{tech.name}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Registered {formatDate(tech.created_at)}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ✕
        </button>
      </div>

      <div style={{ display: 'grid', gap: '0.85rem', fontSize: '0.88rem' }}>
        <div>
          <div
            style={{
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Status
          </div>
          <span
            className={`status-badge ${
              tech.is_active === false
                ? 'wp-status-fault'
                : tech.is_available
                  ? 'wp-status-clear'
                  : 'wp-status-fault'
            }`}
          >
            {tech.is_active === false ? 'Inactive' : tech.is_available ? 'Available' : 'Busy'}
          </span>
        </div>
        <div>
          <div
            style={{
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Phone
          </div>
          <span className="mono">{tech.phone}</span>
        </div>
        <div>
          <div
            style={{
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Zone
          </div>
          <div>{tech.zone || '—'}</div>
        </div>
        <div>
          <div
            style={{
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Coordinates
          </div>
          {tech.latitude && tech.longitude ? (
            <span className="mono">
              {tech.latitude}, {tech.longitude}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem', flexWrap: 'wrap' }}>
        {tech.is_active !== false && (
          <>
            <button type="button" className="btn-secondary" onClick={() => { onClose(); onEdit(tech); }}>
              Edit
            </button>
            <button type="button" className="btn-secondary" onClick={() => onToggleAvailability(tech)}>
              Mark as {tech.is_available ? 'busy' : 'available'}
            </button>
          </>
        )}
        <button type="button" className="btn-secondary" onClick={() => onCopyLink(tech)}>
          Copy field link
        </button>
        {tech.is_active !== false && (
          <button
            type="button"
            className="btn-danger-sm"
            onClick={() => {
              onClose();
              onDeactivate(tech);
            }}
          >
            Deactivate
          </button>
        )}
      </div>
    </div>
  </div>
);

const Technicians = () => {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [formModalMode, setFormModalMode] = useState(null);
  const [editingTech, setEditingTech] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detailTech, setDetailTech] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    if (status && STATUS_FILTERS.some((f) => f.key === status)) setStatusFilter(status);
  }, [location.search]);

  const fetchTechnicians = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/technicians/`, { headers: authHeader() });
      setTechnicians(res.data);
      setFetchError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setFetchError(err.response?.data ? JSON.stringify(err.response.data) : err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    fetchTechnicians();
  }, [fetchTechnicians]);

  const activeTechnicians = useMemo(
    () => technicians.filter((t) => t.is_active !== false),
    [technicians]
  );

  const counts = useMemo(() => {
    const available = activeTechnicians.filter((t) => t.is_available).length;
    const noLocation = activeTechnicians.filter((t) => !t.latitude || !t.longitude).length;
    return {
      ALL: activeTechnicians.length,
      AVAILABLE: available,
      BUSY: activeTechnicians.length - available,
      NO_LOCATION: noLocation,
      INACTIVE: technicians.filter((t) => t.is_active === false).length,
    };
  }, [technicians, activeTechnicians]);

  const applyFilter = (key) => {
    setStatusFilter(key);
    const params = new URLSearchParams(location.search);
    if (key === 'ALL') params.delete('status');
    else params.set('status', key);
    const q = params.toString();
    navigate({ pathname: '/technicians', search: q ? `?${q}` : '' }, { replace: true });
  };

  const filteredTechnicians = useMemo(
    () =>
      technicians.filter((t) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const zone = (t.zone || '').toLowerCase();
          if (
            !t.name.toLowerCase().includes(q) &&
            !t.phone.includes(searchQuery) &&
            !zone.includes(q)
          ) {
            return false;
          }
        }
        const hasLocation = t.latitude && t.longitude;
        const isActive = t.is_active !== false;
        if (statusFilter === 'INACTIVE') return !isActive;
        if (!isActive) return false;
        if (statusFilter === 'AVAILABLE' && !t.is_available) return false;
        if (statusFilter === 'BUSY' && t.is_available) return false;
        if (statusFilter === 'NO_LOCATION' && hasLocation) return false;
        return true;
      }),
    [technicians, searchQuery, statusFilter]
  );

  const closeFormModal = () => {
    setFormModalMode(null);
    setEditingTech(null);
    setFormError(null);
    setForm(EMPTY_FORM);
  };

  const openAddModal = () => {
    setEditingTech(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormModalMode('add');
  };

  const openEditModal = (tech) => {
    setEditingTech(tech);
    setForm(techToForm(tech));
    setFormError(null);
    setFormModalMode('edit');
  };

  const buildPayload = () => ({
    name: form.name,
    phone: form.phone,
    latitude: form.latitude === '' ? null : form.latitude,
    longitude: form.longitude === '' ? null : form.longitude,
    is_available: form.is_available,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const payload = buildPayload();
    try {
      if (formModalMode === 'edit' && editingTech) {
        const res = await axios.patch(`${API}/api/technicians/${editingTech.id}/`, payload, {
          headers: authHeader(),
        });
        setTechnicians((prev) => prev.map((t) => (t.id === editingTech.id ? res.data : t)));
        if (detailTech?.id === editingTech.id) setDetailTech(res.data);
      } else {
        const res = await axios.post(`${API}/api/technicians/`, payload, { headers: authHeader() });
        setTechnicians((prev) => [...prev, res.data]);
      }
      closeFormModal();
      setLastUpdated(new Date());
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
      setTechnicians((prev) => prev.map((t) => (t.id === tech.id ? res.data : t)));
      if (detailTech?.id === tech.id) setDetailTech(res.data);
    } catch {
      alert('Failed to update availability');
    }
  };

  const handleDeactivate = async (tech) => {
    if (!window.confirm(`Deactivate ${tech.name}? They will be removed from assignment lists.`)) return;
    try {
      const res = await axios.patch(
        `${API}/api/technicians/${tech.id}/`,
        { is_active: false, is_available: false },
        { headers: authHeader() }
      );
      setTechnicians((prev) => prev.map((t) => (t.id === tech.id ? res.data : t)));
      if (detailTech?.id === tech.id) setDetailTech(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      alert(`Failed to deactivate: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
    }
  };

  const scrollToMap = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Technicians</h2>
          <p className="page-subtitle">
            {technicians.length} registered
            {lastUpdated && (
              <>
                {' '}
                · Updated {formatRelativeTime(lastUpdated)}
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={fetchTechnicians} className="btn-secondary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="btn-primary"
            style={{ marginTop: 0, padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            + Add Technician
          </button>
        </div>
      </div>

      {fetchError && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>API error: {fetchError}</div>}

      <div className="waterpoints-map-preview">
        <Map3DViewer technicians={activeTechnicians} waterPoints={[]} reports={[]} />
      </div>

      <div className="reports-summary-cards">
        {STATUS_FILTERS.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`reports-filter-card ${statusFilter === card.key ? 'active' : ''}`}
            onClick={() => applyFilter(card.key)}
            aria-pressed={statusFilter === card.key}
          >
            <span className="reports-filter-card-head">
              <span className={`dashboard-kpi-dot ${card.dot}`} aria-hidden />
              {card.label}
            </span>
            <strong>{counts[card.key] ?? 0}</strong>
            <small>{card.hint}</small>
          </button>
        ))}
      </div>

      <div className="glass-panel">
        <div className="page-table-toolbar">
          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="search"
              placeholder="Search by name, phone or zone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading technicians…</div>
        ) : filteredTechnicians.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '1rem', opacity: 0.4 }} aria-hidden><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p>
              {technicians.length === 0
                ? 'No technicians registered yet.'
                : 'No technicians match this filter or search.'}
            </p>
            {technicians.length === 0 && (
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                Add technicians to enable fault assignment.
              </p>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Technician</th>
                  <th>Phone</th>
                  <th>Zone</th>
                  <th>Coordinates</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTechnicians.map((t, i) => (
                  <tr
                    key={t.id}
                    className="clickable-row"
                    onClick={() => setDetailTech(t)}
                    title="Click row for details"
                  >
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: '#a3e635',
                            color: '#0d0d0d',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            flexShrink: 0,
                          }}
                        >
                          {techInitials(t.name)}
                        </span>
                        <strong>{t.name}</strong>
                      </div>
                    </td>
                    <td className="mono muted">{t.phone}</td>
                    <td className="muted">{t.zone || '—'}</td>
                    <td className="mono muted">
                      {t.latitude && t.longitude
                        ? `${t.latitude}, ${t.longitude}`
                        : <span style={{ fontStyle: 'italic' }}>Not set</span>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {t.is_active === false ? (
                        <span className="status-badge wp-status-fault">Inactive</span>
                      ) : (
                        <button
                          type="button"
                          className={`status-badge ${t.is_available ? 'wp-status-clear' : 'wp-status-fault'}`}
                          onClick={() => toggleAvailability(t)}
                          title="Click to toggle availability"
                          style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}
                        >
                          {t.is_available ? 'Available' : 'Busy'}
                        </button>
                      )}
                    </td>
                    <td className="muted">{formatDate(t.created_at)}</td>
                    <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                      <TableRowMenu
                        isOpen={openMenuId === t.id}
                        onToggle={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}
                        onClose={() => setOpenMenuId(null)}
                      >
                        <TableRowMenuItem
                          onClick={() => {
                            setOpenMenuId(null);
                            setDetailTech(t);
                          }}
                        >
                          View details
                        </TableRowMenuItem>
                        {t.is_active !== false && (
                          <TableRowMenuItem
                            onClick={() => {
                              setOpenMenuId(null);
                              openEditModal(t);
                            }}
                          >
                            Edit
                          </TableRowMenuItem>
                        )}
                        <TableRowMenuItem
                          onClick={() => {
                            setOpenMenuId(null);
                            scrollToMap();
                          }}
                        >
                          View on map
                        </TableRowMenuItem>
                        {t.is_active !== false && (
                          <TableRowMenuItem
                            onClick={() => {
                              setOpenMenuId(null);
                              toggleAvailability(t);
                            }}
                          >
                            Toggle availability
                          </TableRowMenuItem>
                        )}
                        <TableRowMenuItem
                          onClick={() => {
                            setOpenMenuId(null);
                            copyFieldPortalLink(t);
                          }}
                        >
                          Copy field portal link
                        </TableRowMenuItem>
                        {t.is_active !== false && (
                          <TableRowMenuItem
                            danger
                            onClick={() => {
                              setOpenMenuId(null);
                              handleDeactivate(t);
                            }}
                          >
                            Deactivate
                          </TableRowMenuItem>
                        )}
                      </TableRowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="page-table-footer">
            Showing {filteredTechnicians.length} of {technicians.length} technician
            {technicians.length === 1 ? '' : 's'}
            {searchQuery ? ` matching “${searchQuery}”` : ''}
          </div>
        )}
      </div>

      {formModalMode && (
        <TechnicianFormModal
          mode={formModalMode}
          form={form}
          setForm={setForm}
          formError={formError}
          saving={saving}
          onClose={closeFormModal}
          onSubmit={handleSubmit}
        />
      )}

      {detailTech && (
        <TechnicianDetailModal
          tech={detailTech}
          onClose={() => setDetailTech(null)}
          onEdit={openEditModal}
          onToggleAvailability={toggleAvailability}
          onDeactivate={handleDeactivate}
          onCopyLink={copyFieldPortalLink}
        />
      )}
    </div>
  );
};

export default Technicians;
