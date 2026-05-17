import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatDate } from './App';
import GlobeHero from './GlobeHero';
import Map3DViewer from './Map3DViewer';
import TableRowMenu, { TableRowMenuItem } from './TableRowMenu';

import { API_BASE as API } from './apiConfig';

const PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { key: 'ALL', statLabel: 'ALL POINTS', tone: 'purple', hint: 'Total registered' },
  { key: 'CLEAR', statLabel: 'CLEAR', tone: 'green', hint: 'No active faults' },
  { key: 'FAULTY', statLabel: 'WITH FAULTS', tone: 'amber', hint: 'Needs attention' },
  { key: 'NO_GPS', statLabel: 'NO GPS', tone: 'red', hint: 'Missing coordinates' },
];

const STATUS_DROPDOWN = [
  { value: 'ALL', label: 'All' },
  { value: 'CLEAR', label: 'Clear' },
  { value: 'FAULTY', label: 'With faults' },
  { value: 'NO_GPS', label: 'No GPS' },
];

const FAULT_DROPDOWN = [
  { value: 'ALL', label: 'All' },
  { value: 'WITH_FAULTS', label: 'With faults' },
  { value: 'NO_FAULTS', label: 'No faults' },
];

function formatRelativeTime(date) {
  if (!date) return '—';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconDroplet = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.32 0z" />
  </svg>
);

const IconLayers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconPinOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const IconSignal = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <circle cx="12" cy="20" r="1" fill="currentColor" />
  </svg>
);

const STAT_ICONS = { purple: IconLayers, green: IconShield, amber: IconAlert, red: IconPinOff };

const SPARKLINE_PATHS = {
  purple: 'M0,14 L5,10 L10,12 L15,7 L20,9 L24,5',
  green: 'M0,13 L6,9 L12,11 L18,6 L24,8',
  amber: 'M0,12 L4,14 L9,10 L14,13 L19,8 L24,11',
  red: 'M0,11 L5,13 L11,9 L16,12 L21,7 L24,10',
};

function Sparkline({ tone }) {
  return (
    <svg className={`wp-stat-sparkline wp-stat-sparkline--${tone}`} viewBox="0 0 24 16" preserveAspectRatio="none" aria-hidden>
      <path d={SPARKLINE_PATHS[tone] || SPARKLINE_PATHS.purple} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UptimeRing({ pct }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg className="wp-insight-ring" viewBox="0 0 36 36" aria-hidden>
      <circle className="wp-insight-ring-track" cx="18" cy="18" r={r} />
      <circle className="wp-insight-ring-fill" cx="18" cy="18" r={r} strokeDasharray={c} strokeDashoffset={offset} />
      <text x="18" y="18.5" className="wp-insight-ring-text">{Math.round(pct)}%</text>
    </svg>
  );
}

const WaterPointAddModal = ({
  form,
  setForm,
  formError,
  saving,
  waterPoints,
  reports,
  selectedPos,
  onLocationSelected,
  onClose,
  onSubmit,
}) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div
      className="modal-panel"
      onClick={(e) => e.stopPropagation()}
      style={{ maxWidth: 560, width: '92%' }}
    >
      <div className="modal-header">
        <div>
          <h3>Register water point</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Click the map to set coordinates, or enter them below.
          </p>
        </div>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ✕
        </button>
      </div>

      <div
        className="waterpoints-map-preview"
        style={{ height: 200, marginBottom: '1rem', borderRadius: 12 }}
      >
        <Map3DViewer
          waterPoints={waterPoints}
          reports={reports}
          onLocationSelected={onLocationSelected}
          selectedPos={selectedPos}
        />
      </div>

      {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{formError}</div>}

      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}
      >
        <div className="form-group">
          <label htmlFor="wp-code">WP Code</label>
          <input
            id="wp-code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="e.g. WP005"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="wp-location">Location name</label>
          <input
            id="wp-location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. Ward 5 Center"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="wp-lat">Latitude</label>
          <input
            id="wp-lat"
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            placeholder="-19.000"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="wp-lng">Longitude</label>
          <input
            id="wp-lng"
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            placeholder="29.000"
            required
          />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="wp-desc">Description (optional)</label>
          <input
            id="wp-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Additional details…"
          />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: '0.25rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ marginTop: 0 }}>
            {saving ? 'Saving…' : 'Save water point'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

const WaterPointDetailModal = ({ point, faultCount, onClose, onFlyToMap, onDelete }) => {
  const hasFault = faultCount > 0;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '92%' }}>
        <div className="modal-header">
          <div>
            <h3>{point.code}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {point.location} · Registered {formatDate(point.created_at)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="modal-close">✕</button>
        </div>

        <div style={{ display: 'grid', gap: '0.85rem', fontSize: '0.88rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
            <span className={`status-badge ${hasFault ? 'wp-status-fault' : 'wp-status-clear'}`}>
              {hasFault ? `${faultCount} active fault${faultCount > 1 ? 's' : ''}` : 'Clear'}
            </span>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Coordinates</div>
            {point.latitude && point.longitude ? (
              <span className="mono">{point.latitude}, {point.longitude}</span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>
            )}
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Description</div>
            <div style={{ lineHeight: 1.45 }}>{point.description || '—'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={() => { onClose(); onFlyToMap(point.code); }}>
            View on map
          </button>
          <button
            type="button"
            className="btn-danger-sm"
            onClick={() => {
              onClose();
              onDelete(point.id);
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const WaterPoints = () => {
  const [waterPoints, setWaterPoints] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);
  const [flyToCode, setFlyToCode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [faultFilter, setFaultFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ code: '', location: '', description: '', latitude: '', longitude: '' });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detailPoint, setDetailPoint] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('flyTo');
    if (code) setFlyToCode(code);
    const status = params.get('status');
    if (status && STATUS_FILTERS.some((f) => f.key === status)) setStatusFilter(status);
  }, [location.search]);

  const fetchData = useCallback(async () => {
    try {
      const [wpRes, rRes] = await Promise.all([
        axios.get(`${API}/api/waterpoints/`, { headers: authHeader() }),
        axios.get(`${API}/api/reports/`, { headers: authHeader() }),
      ]);
      setWaterPoints(wpRes.data);
      setReports(rRes.data);
      setFetchError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setFetchError(err.response?.data ? JSON.stringify(err.response.data) : err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const faultCounts = useMemo(() => {
    const counts = {};
    reports.forEach((r) => {
      if (r.status !== 'RESOLVED') {
        counts[r.water_point_code] = (counts[r.water_point_code] || 0) + 1;
      }
    });
    return counts;
  }, [reports]);

  const counts = useMemo(() => {
    const faulty = waterPoints.filter((wp) => faultCounts[wp.code] > 0).length;
    const noGps = waterPoints.filter((wp) => !wp.latitude || !wp.longitude).length;
    return {
      ALL: waterPoints.length,
      CLEAR: waterPoints.length - faulty,
      FAULTY: faulty,
      NO_GPS: noGps,
    };
  }, [waterPoints, faultCounts]);

  const applyFilter = (key) => {
    setStatusFilter(key);
    setPage(1);
    const params = new URLSearchParams(location.search);
    if (key === 'ALL') params.delete('status');
    else params.set('status', key);
    const q = params.toString();
    navigate({ pathname: '/waterpoints', search: q ? `?${q}` : '' }, { replace: true });
  };

  const filteredPoints = useMemo(() => waterPoints.filter((wp) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!wp.code.toLowerCase().includes(q) && !wp.location?.toLowerCase().includes(q)) return false;
    }
    const hasFault = faultCounts[wp.code] > 0;
    const hasGps = wp.latitude && wp.longitude;
    if (statusFilter === 'CLEAR' && hasFault) return false;
    if (statusFilter === 'FAULTY' && !hasFault) return false;
    if (statusFilter === 'NO_GPS' && hasGps) return false;
    if (faultFilter === 'WITH_FAULTS' && !hasFault) return false;
    if (faultFilter === 'NO_FAULTS' && hasFault) return false;
    return true;
  }), [waterPoints, searchQuery, statusFilter, faultFilter, faultCounts]);

  const totalFaults = useMemo(
    () => Object.values(faultCounts).reduce((sum, n) => sum + n, 0),
    [faultCounts],
  );

  const onlineCount = counts.CLEAR;
  const uptimePct = waterPoints.length > 0 ? (onlineCount / waterPoints.length) * 100 : 100;
  const allOperational = counts.FAULTY === 0;

  const totalPages = Math.max(1, Math.ceil(filteredPoints.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedPoints = filteredPoints.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, faultFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearTableFilters = () => {
    setSearchQuery('');
    setFaultFilter('ALL');
    applyFilter('ALL');
  };

  const hasActiveTableFilters = searchQuery || faultFilter !== 'ALL' || statusFilter !== 'ALL';

  const closeAddModal = () => {
    setShowForm(false);
    setFormError(null);
    setForm({ code: '', location: '', description: '', latitude: '', longitude: '' });
    setSelectedPos(null);
  };

  const handleLocationSelected = (latlng) => {
    setSelectedPos(latlng);
    setForm((prev) => ({ ...prev, latitude: latlng.lat.toFixed(6), longitude: latlng.lng.toFixed(6) }));
    setShowForm(true);
  };

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
      const res = await axios.post(`${API}/api/waterpoints/`, payload, { headers: authHeader() });
      setWaterPoints((prev) => [...prev, res.data]);
      closeAddModal();
      setLastUpdated(new Date());
    } catch (err) {
      setFormError(err.response?.data ? JSON.stringify(err.response.data) : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this water point? All associated reports will also be deleted.')) return;
    try {
      await axios.delete(`${API}/api/waterpoints/${id}/`, { headers: authHeader() });
      setWaterPoints((prev) => prev.filter((wp) => wp.id !== id));
      setDetailPoint(null);
    } catch (err) {
      alert(`Failed to delete: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
    }
  };

  const flyToOnMap = (code) => {
    setFlyToCode(code);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="water-points-page">
      <header className="wp-page-header">
        <div>
          <h1 className="wp-page-title">Water Points</h1>
          <p className="wp-page-subtitle">
            {waterPoints.length} registered
            {lastUpdated && (
              <>
                {' · '}
                Updated {formatRelativeTime(lastUpdated)}
              </>
            )}
          </p>
        </div>
        <div className="wp-page-actions">
          <button type="button" onClick={fetchData} className="btn-secondary btn-sm wp-btn-refresh">
            <IconRefresh />
            Refresh
          </button>
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary wp-btn-add">
            <span aria-hidden>+</span>
            Add Water Point
          </button>
        </div>
      </header>

      {fetchError && <div className="alert alert-error wp-page-alert">API error: {fetchError}</div>}

      <section className="wp-overview-card" aria-label="Water points overview">
        <div className="wp-overview-copy">
          <div className="wp-overview-icon" aria-hidden>
            <IconDroplet />
          </div>
          <h2>Overview</h2>
          <p>
            Monitor all registered water points across Zimbabwe. Track status, detect faults,
            and ensure reliable water access for every community.
          </p>
          <p className={`wp-overview-status${allOperational ? ' wp-overview-status--ok' : ''}`}>
            <span className="wp-overview-status-dot" aria-hidden />
            {allOperational ? 'All systems operational' : `${counts.FAULTY} point${counts.FAULTY === 1 ? '' : 's'} need attention`}
          </p>
        </div>
        <div className="wp-overview-map">
          <GlobeHero
            waterPoints={waterPoints}
            reports={reports}
            onLocationSelected={handleLocationSelected}
            selectedPos={selectedPos}
            flyToCode={flyToCode}
            loading={loading}
            initialMode="map"
            flatMap
            showBackButton={false}
          />
        </div>
        <aside className="wp-insights" aria-label="Quick insights">
          <div className="wp-insight-row">
            <span className="wp-insight-icon wp-insight-icon--blue" aria-hidden><IconDroplet /></span>
            <div>
              <strong>{waterPoints.length}</strong>
              <span>Total water points</span>
            </div>
          </div>
          <div className="wp-insight-row">
            <span className="wp-insight-icon wp-insight-icon--amber" aria-hidden><IconAlert /></span>
            <div>
              <strong>{totalFaults}</strong>
              <span>Faults detected</span>
            </div>
          </div>
          <div className="wp-insight-row">
            <span className="wp-insight-icon wp-insight-icon--green" aria-hidden><IconSignal /></span>
            <div>
              <strong>{onlineCount}</strong>
              <span>Online &amp; operational</span>
            </div>
          </div>
          <div className="wp-insight-row wp-insight-row--ring">
            <UptimeRing pct={uptimePct} />
            <div>
              <strong>{Math.round(uptimePct)}%</strong>
              <span>System uptime</span>
            </div>
          </div>
        </aside>
      </section>

      <div className="wp-stat-grid">
        {STATUS_FILTERS.map((card) => {
          const StatIcon = STAT_ICONS[card.tone];
          return (
            <button
              key={card.key}
              type="button"
              className={`wp-stat-card wp-stat-card--${card.tone}${statusFilter === card.key ? ' active' : ''}`}
              onClick={() => applyFilter(card.key)}
              aria-pressed={statusFilter === card.key}
            >
              <span className={`wp-stat-icon wp-stat-icon--${card.tone}`} aria-hidden>
                <StatIcon />
              </span>
              <div className="wp-stat-body">
                <span className="wp-stat-label">{card.statLabel}</span>
                <strong>{counts[card.key] ?? 0}</strong>
                <small>{card.hint}</small>
              </div>
              <Sparkline tone={card.tone} />
            </button>
          );
        })}
      </div>

      <section className="wp-table-panel glass-panel">
        <div className="wp-table-toolbar">
          <div className="search-bar wp-table-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Search by code or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <label className="wp-filter-select">
            <span>Status:</span>
            <select value={statusFilter} onChange={(e) => applyFilter(e.target.value)}>
              {STATUS_DROPDOWN.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="wp-filter-select">
            <span>Faults:</span>
            <select
              value={faultFilter}
              onChange={(e) => {
                setFaultFilter(e.target.value);
                setPage(1);
              }}
            >
              {FAULT_DROPDOWN.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          {hasActiveTableFilters && (
            <button type="button" className="wp-clear-filters" onClick={clearTableFilters}>
              <span aria-hidden>×</span>
              Clear Filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading">Loading water points…</div>
        ) : filteredPoints.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '1rem', opacity: 0.4 }} aria-hidden>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <p>
              {waterPoints.length === 0
                ? 'No water points registered yet.'
                : 'No water points match this filter or search.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table wp-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Code</th>
                  <th>Location</th>
                  <th>Coordinates</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Registered</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedPoints.map((wp, i) => {
                  const faults = faultCounts[wp.code] || 0;
                  return (
                    <tr
                      key={wp.id}
                      className="clickable-row"
                      onClick={() => setDetailPoint(wp)}
                      title="Click row for details"
                    >
                      <td className="muted">{pageStart + i + 1}</td>
                      <td><strong>{wp.code}</strong></td>
                      <td>{wp.location}</td>
                      <td className="mono muted">
                        {wp.latitude && wp.longitude
                          ? `${wp.latitude}, ${wp.longitude}`
                          : <span className="wp-no-coords">No coordinates</span>}
                      </td>
                      <td>
                        <span className={`status-badge ${faults > 0 ? 'wp-status-fault' : 'wp-status-clear'}`}>
                          {faults > 0 ? `${faults} FAULT${faults > 1 ? 'S' : ''}` : 'CLEAR'}
                        </span>
                      </td>
                      <td className="muted">{wp.description || '—'}</td>
                      <td className="muted">{formatDate(wp.created_at)}</td>
                      <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                        <TableRowMenu
                          isOpen={openMenuId === wp.id}
                          onToggle={() => setOpenMenuId(openMenuId === wp.id ? null : wp.id)}
                          onClose={() => setOpenMenuId(null)}
                        >
                          <TableRowMenuItem
                            onClick={() => {
                              setOpenMenuId(null);
                              setDetailPoint(wp);
                            }}
                          >
                            View details
                          </TableRowMenuItem>
                          <TableRowMenuItem
                            onClick={() => {
                              setOpenMenuId(null);
                              flyToOnMap(wp.code);
                            }}
                          >
                            View on map
                          </TableRowMenuItem>
                          <TableRowMenuItem
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate('/map');
                            }}
                          >
                            Open live map
                          </TableRowMenuItem>
                          <TableRowMenuItem
                            danger
                            onClick={() => {
                              setOpenMenuId(null);
                              handleDelete(wp.id);
                            }}
                          >
                            Delete
                          </TableRowMenuItem>
                        </TableRowMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredPoints.length > 0 && (
          <footer className="wp-table-footer">
            <span>
              Showing {pageStart + 1} to {Math.min(pageStart + PAGE_SIZE, filteredPoints.length)} of{' '}
              {filteredPoints.length} water point{filteredPoints.length === 1 ? '' : 's'}
            </span>
            <nav className="wp-pagination" aria-label="Table pagination">
              <button
                type="button"
                className="wp-page-btn"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`wp-page-btn wp-page-num${n === safePage ? ' active' : ''}`}
                  onClick={() => setPage(n)}
                  aria-current={n === safePage ? 'page' : undefined}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="wp-page-btn"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </nav>
          </footer>
        )}
      </section>

      {showForm && (
        <WaterPointAddModal
          form={form}
          setForm={setForm}
          formError={formError}
          saving={saving}
          waterPoints={waterPoints}
          reports={reports}
          selectedPos={selectedPos}
          onLocationSelected={handleLocationSelected}
          onClose={closeAddModal}
          onSubmit={handleSubmit}
        />
      )}

      {detailPoint && (
        <WaterPointDetailModal
          point={detailPoint}
          faultCount={faultCounts[detailPoint.code] || 0}
          onClose={() => setDetailPoint(null)}
          onFlyToMap={flyToOnMap}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default WaterPoints;
