import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatDate } from './App';
import Map3DViewer from './Map3DViewer';

const API = 'http://localhost:8000';

const WaterPoints = () => {
  const [waterPoints, setWaterPoints] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);
  const [flyToCode, setFlyToCode] = useState(null);
  const [form, setForm] = useState({ code: '', location: '', description: '', latitude: '', longitude: '' });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  // Read flyTo param from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('flyTo');
    if (code) setFlyToCode(code);
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
    } catch (err) {
      setFetchError(err.response?.data ? JSON.stringify(err.response.data) : err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLocationSelected = (latlng) => {
    setSelectedPos(latlng);
    setForm(prev => ({ ...prev, latitude: latlng.lat.toFixed(6), longitude: latlng.lng.toFixed(6) }));
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
      setWaterPoints(prev => [...prev, res.data]);
      setShowForm(false);
      setForm({ code: '', location: '', description: '', latitude: '', longitude: '' });
      setSelectedPos(null);
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
      setWaterPoints(prev => prev.filter(wp => wp.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  };

  // Count active faults per water point
  const faultCounts = {};
  reports.forEach(r => {
    if (r.status !== 'RESOLVED') {
      faultCounts[r.water_point_code] = (faultCounts[r.water_point_code] || 0) + 1;
    }
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Water Points</h2>
          <p className="page-subtitle">{waterPoints.length} registered · {Object.keys(faultCounts).length} with active faults</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={fetchData} className="btn-secondary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ marginTop: 0, padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            {showForm ? '✕ Cancel' : '+ Add Water Point'}
          </button>
        </div>
      </div>

      {fetchError && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>API error: {fetchError}</div>}

      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Register New Water Point</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Click the map to pre-fill coordinates, or type them manually.
          </p>
          {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{formError}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>WP Code</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. WP005" required />
            </div>
            <div className="form-group">
              <label>Location Name</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Ward 5 Center" required />
            </div>
            <div className="form-group">
              <label>Latitude</label>
              <input value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="-19.000" required />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="29.000" required />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description (optional)</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Additional details..." />
            </div>
            <button type="submit" disabled={saving} className="btn-primary" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
              {saving ? 'Saving...' : 'Save Water Point'}
            </button>
          </form>
        </div>
      )}

      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <Map3DViewer
          waterPoints={waterPoints}
          reports={reports}
          onLocationSelected={handleLocationSelected}
          selectedPos={selectedPos}
          flyToCode={flyToCode}
        />
      </div>

      <div className="glass-panel">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title">All Water Points</h3>
        </div>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : waterPoints.length === 0 ? (
          <div className="empty-state">
            <p>No water points registered yet.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Location</th>
                  <th>Coordinates</th>
                  <th>Active Faults</th>
                  <th>Description</th>
                  <th>Registered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {waterPoints.map(wp => {
                  const faults = faultCounts[wp.code] || 0;
                  return (
                    <tr
                      key={wp.id}
                      className="clickable-row"
                      onClick={() => setFlyToCode(wp.code)}
                      title="Click to view on map"
                    >
                      <td><strong className="mono">{wp.code}</strong></td>
                      <td>{wp.location}</td>
                      <td className="mono muted">
                        {wp.latitude && wp.longitude
                          ? `${wp.latitude}, ${wp.longitude}`
                          : <span style={{ fontStyle: 'italic' }}>No coordinates</span>}
                      </td>
                      <td>
                        {faults > 0
                          ? <span className="status-badge status-pending">{faults} active</span>
                          : <span style={{ color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600 }}>✓ Clear</span>}
                      </td>
                      <td className="muted">{wp.description || '—'}</td>
                      <td className="muted">{formatDate(wp.created_at)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleDelete(wp.id)} className="btn-danger-sm">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaterPoints;
