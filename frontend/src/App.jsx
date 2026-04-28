import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './index.css';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Settings from './Settings';
import Reports from './Reports';
import WaterPoints from './WaterPoints';
import Technicians from './Technicians';
import Map3DViewer from './Map3DViewer';
import Layout from './Layout';

const API = 'http://localhost:8000';

const FAULT_LABELS = {
  PUMP: 'Pump Failure', LEAK: 'Pipe Leak', DRY: 'Borehole Dry',
  CONTAM: 'Contamination', VANDAL: 'Vandalism', OTHER: 'Other',
};

export const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const Dashboard = () => {
  const [reports, setReports] = useState([]);
  const [waterPoints, setWaterPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showAddWP, setShowAddWP] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);
  const [newWP, setNewWP] = useState({ code: '', location: '', description: '', latitude: '', longitude: '' });
  const [wpError, setWPError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const authHeader = useCallback(
    () => ({ Authorization: `Bearer ${user.token}` }),
    [user.token]
  );

  const fetchData = useCallback(async () => {
    try {
      const [rRes, wpRes] = await Promise.all([
        axios.get(`${API}/api/reports/`, { headers: authHeader() }),
        axios.get(`${API}/api/waterpoints/`, { headers: authHeader() }),
      ]);
      setReports(rRes.data);
      setWaterPoints(wpRes.data);
      setFetchError(null);
    } catch (err) {
      const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleLocationSelected = (latlng) => {
    setSelectedPos(latlng);
    setNewWP(prev => ({ ...prev, latitude: latlng.lat.toFixed(6), longitude: latlng.lng.toFixed(6) }));
    setShowAddWP(true);
  };

  const handleAddWP = async (e) => {
    e.preventDefault();
    setWPError(null);
    const payload = {
      ...newWP,
      latitude: newWP.latitude === '' ? null : newWP.latitude,
      longitude: newWP.longitude === '' ? null : newWP.longitude,
    };
    try {
      const res = await axios.post(`${API}/api/waterpoints/`, payload, { headers: authHeader() });
      setWaterPoints(prev => [...prev, res.data]);
      setShowAddWP(false);
      setNewWP({ code: '', location: '', description: '', latitude: '', longitude: '' });
      setSelectedPos(null);
    } catch (err) {
      setWPError(err.response?.data ? JSON.stringify(err.response.data) : 'Network error');
    }
  };

  const recentReports = [...reports].slice(0, 5);

  const stats = [
    { label: 'Total Reports', value: reports.length, color: 'var(--text-main)', route: '/reports' },
    { label: 'Pending Faults', value: reports.filter(r => r.status === 'PENDING').length, color: 'var(--warning)', route: '/reports?status=PENDING' },
    { label: 'Water Points', value: waterPoints.length, color: 'var(--primary)', route: '/waterpoints' },
    { label: 'Resolved', value: reports.filter(r => r.status === 'RESOLVED').length, color: 'var(--success)', route: '/reports?status=RESOLVED' },
  ];

  return (
    <div>
      {/* ── Hero Globe ──────────────────────────────────── */}
      <div style={{
        height: '680px',
        width: 'calc(100% + 4rem)',
        marginLeft: '-2rem',
        marginTop: '-2rem',
        marginBottom: '1.5rem',
        borderRadius: '0 0 16px 16px',
        overflow: 'hidden',
        border: '1px solid var(--card-border)',
        borderTop: 'none',
        position: 'relative',
        background: '#000',
      }}>
        <Map3DViewer
          waterPoints={waterPoints}
          reports={reports}
          onLocationSelected={handleLocationSelected}
          selectedPos={selectedPos}
        />

        {/* title overlay bottom-left */}
        <div style={{
          position: 'absolute', bottom: 14, left: 14, zIndex: 10,
          background: 'rgba(10,10,10,0.8)', padding: '8px 14px', borderRadius: 10,
          border: '1px solid rgba(163,230,53,0.15)', backdropFilter: 'blur(6px)',
          fontFamily: 'sans-serif',
        }}>
          <div style={{ color: '#a3e635', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>Waterwise</div>
          <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
            {loading ? '—' : `${waterPoints.length} water points · ${reports.filter(r => r.status === 'PENDING').length} pending faults`}
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          API error: {fetchError}
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card stat-card-clickable" onClick={() => navigate(s.route)}>
            <p className="stat-label">{s.label}</p>
            <p className="stat-value" style={{ color: s.color }}>
              {loading ? '—' : s.value}
            </p>
            <span className="stat-cta">View all →</span>
          </div>
        ))}
      </div>

      {/* ── Add Water Point ─────────────────────────────── */}
      {showAddWP && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
          <div className="section-header">
            <h3 className="section-title">New Water Point</h3>
            <button onClick={() => { setShowAddWP(false); setSelectedPos(null); }} className="btn-secondary btn-sm">✕ Cancel</button>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Click anywhere on the Zimbabwe map view to pre-fill coordinates, or enter them manually.
          </p>
          {wpError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{wpError}</div>}
          <form onSubmit={handleAddWP} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>WP Code</label>
              <input value={newWP.code} onChange={e => setNewWP({ ...newWP, code: e.target.value })} placeholder="e.g. WP005" required />
            </div>
            <div className="form-group">
              <label>Location Name</label>
              <input value={newWP.location} onChange={e => setNewWP({ ...newWP, location: e.target.value })} placeholder="e.g. Ward 5 Center" required />
            </div>
            <div className="form-group">
              <label>Latitude</label>
              <input value={newWP.latitude} onChange={e => setNewWP({ ...newWP, latitude: e.target.value })} placeholder="-19.000" required />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input value={newWP.longitude} onChange={e => setNewWP({ ...newWP, longitude: e.target.value })} placeholder="29.000" required />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description (optional)</label>
              <input value={newWP.description} onChange={e => setNewWP({ ...newWP, description: e.target.value })} placeholder="Additional details..." />
            </div>
            <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1', marginTop: 0 }}>Save Water Point</button>
          </form>
        </div>
      )}

      {/* ── Header row ──────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 className="page-title">Recent Fault Reports</h2>
          <p className="page-subtitle">Last {recentReports.length} of {reports.length} total</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowAddWP(!showAddWP)} className="btn-secondary btn-sm">
            + Add Water Point
          </button>
          <button onClick={fetchData} className="btn-secondary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          <button onClick={() => navigate('/reports')} className="btn-secondary btn-sm">View all →</button>
        </div>
      </div>

      {/* ── Recent reports table ────────────────────────── */}
      <div className="glass-panel">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : recentReports.length === 0 ? (
          <div className="empty-state">
            <p>No fault reports yet.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Send an SMS: <code>WP001 PUMP</code>
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Water Point</th>
                  <th>Fault</th>
                  <th>Reporter</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map(r => (
                  <tr key={r.id} className="clickable-row" onClick={() => navigate('/reports')} title="View all reports">
                    <td className="mono">{r.ticket_number}</td>
                    <td><strong>{r.water_point_code}</strong></td>
                    <td><span className={`fault-badge fault-${r.fault_code?.toLowerCase()}`}>{FAULT_LABELS[r.fault_code] || r.fault_code}</span></td>
                    <td className="mono muted">{r.sender_number}</td>
                    <td><span className={`status-badge status-${r.status?.toLowerCase()}`}>{r.status?.replace('_', ' ')}</span></td>
                    <td className="muted">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Checking auth...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
          <Route path="/waterpoints" element={<ProtectedRoute><Layout><WaterPoints /></Layout></ProtectedRoute>} />
          <Route path="/technicians" element={<ProtectedRoute><Layout><Technicians /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
