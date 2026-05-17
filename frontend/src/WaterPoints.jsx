import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatDate } from './App';
import Map3DViewer from './Map3DViewer';
import TableRowMenu, { TableRowMenuItem } from './TableRowMenu';

import { API_BASE as API } from './apiConfig';

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All points', dot: 'purple', hint: 'Full registry' },
  { key: 'CLEAR', label: 'Clear', dot: 'green', hint: 'No active faults' },
  { key: 'FAULTY', label: 'With faults', dot: 'amber', hint: 'Needs attention' },
  { key: 'NO_GPS', label: 'No GPS', dot: 'red', hint: 'Missing coordinates' },
];

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
    return true;
  }), [waterPoints, searchQuery, statusFilter, faultCounts]);

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
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Water Points</h2>
          <p className="page-subtitle">
            {waterPoints.length} registered
            {lastUpdated && (
              <>
                {' '}
                · Updated {formatRelativeTime(lastUpdated)}
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={fetchData} className="btn-secondary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary"
            style={{ marginTop: 0, padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            + Add Water Point
          </button>
        </div>
      </div>

      {fetchError && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>API error: {fetchError}</div>}


      <div className="waterpoints-map-preview">
        <Map3DViewer
          waterPoints={waterPoints}
          reports={reports}
          onLocationSelected={handleLocationSelected}
          selectedPos={selectedPos}
          flyToCode={flyToCode}
        />
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
              placeholder="Search by code or location…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading water points…</div>
        ) : filteredPoints.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '1rem', opacity: 0.4 }} aria-hidden><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <p>
              {waterPoints.length === 0
                ? 'No water points registered yet.'
                : 'No water points match this filter or search.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
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
                {filteredPoints.map((wp, i) => {
                  const faults = faultCounts[wp.code] || 0;
                  return (
                    <tr
                      key={wp.id}
                      className="clickable-row"
                      onClick={() => setDetailPoint(wp)}
                      title="Click row for details"
                    >
                      <td className="muted">{i + 1}</td>
                      <td><strong>{wp.code}</strong></td>
                      <td>{wp.location}</td>
                      <td className="mono muted">
                        {wp.latitude && wp.longitude
                          ? `${wp.latitude}, ${wp.longitude}`
                          : <span style={{ fontStyle: 'italic' }}>No coordinates</span>}
                      </td>
                      <td>
                        <span className={`status-badge ${faults > 0 ? 'wp-status-fault' : 'wp-status-clear'}`}>
                          {faults > 0 ? `${faults} fault${faults > 1 ? 's' : ''}` : 'Clear'}
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

        {!loading && (
          <div className="page-table-footer">
            Showing {filteredPoints.length} of {waterPoints.length} water point{waterPoints.length === 1 ? '' : 's'}
            {searchQuery ? ` matching “${searchQuery}”` : ''}
          </div>
        )}
      </div>

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
