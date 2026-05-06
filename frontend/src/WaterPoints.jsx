import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatDate } from './App';
import Map3DViewer from './Map3DViewer';

import { API_BASE as API } from './apiConfig';

/* ── KPI Detail Modal ─────────────────────────────────── */
const KPIDetailModal = ({ title, subtitle, data, type, onClose, onFlyTo }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px', width: '90%', maxWidth: '760px',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{title}</h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#666' }}>{subtitle}</p>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#888', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>
      {/* Body */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#555' }}>No records found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555' }}>Code</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555' }}>Location</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555' }}>Status</th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map(wp => (
                <tr key={wp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '0.85rem 1.5rem', fontWeight: 700, color: '#a3e635', fontSize: '0.9rem' }}>{wp.code}</td>
                  <td style={{ padding: '0.85rem 1rem', color: '#ccc', fontSize: '0.88rem' }}>{wp.location || '—'}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    {type === 'faults' ? (
                      <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600 }}>Has Faults</span>
                    ) : (
                      <span style={{ background: 'rgba(163,230,53,0.05)', color: '#a3e635', border: '1px solid rgba(163,230,53,0.2)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600 }}>Clear</span>
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1.5rem', textAlign: 'right' }}>
                    <button
                      onClick={() => { onClose(); onFlyTo(wp.code); }}
                      style={{ background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.2)', color: '#a3e635', borderRadius: '6px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                    >Fly to ↗</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </div>
);

const WaterPoints = () => {
  const [waterPoints, setWaterPoints] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);
  const [flyToCode, setFlyToCode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [regionFilter, setRegionFilter] = useState('All');
  const [form, setForm] = useState({ code: '', location: '', description: '', latitude: '', longitude: '' });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'total' | 'clear' | 'faults'
  const [openMenuId, setOpenMenuId] = useState(null);
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

  const activeFaultWPs = Object.keys(faultCounts).length;
  const activeClearWPs = waterPoints.length - activeFaultWPs;

  const filteredPoints = waterPoints.filter(wp => {
    if (searchQuery && !wp.code.toLowerCase().includes(searchQuery.toLowerCase()) && !wp.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    const hasFault = faultCounts[wp.code] > 0;
    if (statusFilter === 'Clear' && hasFault) return false;
    if (statusFilter === 'Faulty' && !hasFault) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="page-title">Water Points</h2>
          <p className="page-subtitle">{waterPoints.length} registered · <span style={{ color: activeFaultWPs > 0 ? '#ef4444' : '#10b981' }}>{activeFaultWPs} with active faults</span></p>
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

      <div style={{ height: '220px', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(163,230,53,0.15)', marginBottom: '1.5rem', position: 'relative' }}>
        <Map3DViewer
          waterPoints={waterPoints}
          reports={reports}
          onLocationSelected={handleLocationSelected}
          selectedPos={selectedPos}
          flyToCode={flyToCode}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Water Points */}
        <div
          className="mini-stat-card compact"
          onClick={() => setActiveModal('total')}
          style={{ cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(163,230,53,0.4)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}
        >
          <div className="stat-icon" style={{ background: 'rgba(163,230,53,0.1)', color: '#a3e635' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Water Points</p>
            <h3 className="stat-value">{waterPoints.length}</h3>
            <p className="stat-sub">All registered locations</p>
          </div>
        </div>

        {/* Active & Clear */}
        <div
          className="mini-stat-card compact"
          onClick={() => setActiveModal('clear')}
          style={{ border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.6)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; e.currentTarget.style.transform = ''; }}
        >
          <div className="stat-icon" style={{ background: '#1e3a8a', color: '#60a5fa' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div className="stat-content">
            <p className="stat-label">Active &amp; Clear</p>
            <h3 className="stat-value">{activeClearWPs}</h3>
            <p className="stat-sub">No active faults</p>
          </div>
        </div>

        {/* With Active Faults */}
        <div
          className="mini-stat-card compact"
          onClick={() => setActiveModal('faults')}
          style={{ border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.6)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; e.currentTarget.style.transform = ''; }}
        >
          <div className="stat-icon" style={{ background: '#451a03', color: '#fbbf24' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div className="stat-content">
            <p className="stat-label">With Active Faults</p>
            <h3 className="stat-value">{activeFaultWPs}</h3>
            <p className="stat-sub">Requires attention</p>
          </div>
        </div>

        {/* Last Updated — refreshes on click */}
        <div
          className="mini-stat-card compact"
          onClick={fetchData}
          style={{ border: '1px solid rgba(168,85,247,0.3)', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(192,132,252,0.6)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.3)'; e.currentTarget.style.transform = ''; }}
        >
          <div className="stat-icon" style={{ background: '#4c1d95', color: '#c084fc' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </div>
          <div className="stat-content">
            <p className="stat-label">Last Updated</p>
            <h3 className="stat-value">2 min ago</h3>
            <p className="stat-sub">Click to refresh</p>
          </div>
        </div>
      </div>


      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="search-bar" style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search by code or location..." 
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
          <option>Clear</option>
          <option>Faulty</option>
        </select>
        <select 
          className="form-control" 
          value={regionFilter} 
          onChange={e => setRegionFilter(e.target.value)}
          style={{ width: '150px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
        >
          <option>All</option>
        </select>
        <button className="btn-secondary" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
          Filters
        </button>
      </div>

      <div className="glass-panel" style={{ padding: 0 }}>
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
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Code</th>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Location</th>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Coordinates</th>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Status</th>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Description</th>
                  <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: '#888' }}>Registered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredPoints.map(wp => {
                  const faults = faultCounts[wp.code] || 0;
                  return (
                    <tr
                      key={wp.id}
                      className="clickable-row"
                      onClick={() => setFlyToCode(wp.code)}
                      title="Click to view on map"
                    >
                      <td><strong style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>{wp.code}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                          <span style={{ color: '#fff', fontWeight: 500 }}>{wp.location}</span>
                        </div>
                      </td>
                      <td className="mono muted" style={{ fontSize: '0.85rem' }}>
                        {wp.latitude && wp.longitude
                          ? `${wp.latitude}, ${wp.longitude}`
                          : <span style={{ fontStyle: 'italic' }}>No coordinates</span>}
                      </td>
                      <td>
                        {faults > 0
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                              {faults} Fault{faults > 1 ? 's' : ''}
                            </span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', background: 'rgba(163,230,53,0.05)', color: '#a3e635', border: '1px solid rgba(163,230,53,0.2)', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              Clear
                            </span>}
                      </td>
                      <td className="muted" style={{ fontSize: '0.85rem' }}>{wp.description || '—'}</td>
                      <td className="muted" style={{ fontSize: '0.85rem' }}>{formatDate(wp.created_at)}</td>
                      <td onClick={e => e.stopPropagation()} style={{ textAlign: 'right', position: 'relative' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === wp.id ? null : wp.id); }}
                          style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', transition: 'background 0.15s', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>
                        {openMenuId === wp.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpenMenuId(null)} />
                            <div style={{
                              position: 'absolute', right: 0, top: '100%', zIndex: 100,
                              background: '#141414', border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '8px', minWidth: '160px', overflow: 'hidden',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                            }}>
                              <button
                                onClick={() => { setOpenMenuId(null); setFlyToCode(wp.code); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', color: '#ccc', padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(163,230,53,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                Fly to Map
                              </button>
                              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 8px' }} />
                              <button
                                onClick={() => { setOpenMenuId(null); handleDelete(wp.id); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', color: '#ef4444', padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--glass-border)' }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>
            Showing 1 to {filteredPoints.length} of {filteredPoints.length} results
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}>&lt;</button>
            <button style={{ background: 'rgba(163,230,53,0.2)', border: '1px solid rgba(163,230,53,0.3)', color: '#a3e635', padding: '0.25rem 0.75rem', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>1</button>
            <button style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}>&gt;</button>
          </div>
        </div>
      </div>

      {/* KPI Detail Modals */}
      {activeModal === 'total' && (
        <KPIDetailModal
          title="All Water Points"
          subtitle={`${waterPoints.length} registered locations`}
          data={waterPoints}
          type="clear"
          onClose={() => setActiveModal(null)}
          onFlyTo={code => setFlyToCode(code)}
        />
      )}
      {activeModal === 'clear' && (
        <KPIDetailModal
          title="Active & Clear"
          subtitle={`${activeClearWPs} locations with no faults`}
          data={waterPoints.filter(wp => !faultCounts[wp.code])}
          type="clear"
          onClose={() => setActiveModal(null)}
          onFlyTo={code => setFlyToCode(code)}
        />
      )}
      {activeModal === 'faults' && (
        <KPIDetailModal
          title="With Active Faults"
          subtitle={`${activeFaultWPs} locations requiring attention`}
          data={waterPoints.filter(wp => faultCounts[wp.code] > 0)}
          type="faults"
          onClose={() => setActiveModal(null)}
          onFlyTo={code => setFlyToCode(code)}
        />
      )}
    </div>
  );
};

export default WaterPoints;
