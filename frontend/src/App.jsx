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
import GlobeHero from './GlobeHero';
import Layout from './Layout';
import Sms from './Sms';
import Analytics from './Analytics';
import ProjectMap from './ProjectMap';
import Help from './Help';
import { API_BASE as API } from './apiConfig';

const FAULT_LABELS = {
  PUMP: 'Pump Failure', LEAK: 'Pipe Leak', DRY: 'Borehole Dry',
  CONTAM: 'Contamination', VANDAL: 'Vandalism', OTHER: 'Other',
};

export const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const KPITableModal = ({ type, onClose, reports, waterPoints, navigate }) => {
  const isWaterPoints = type === 'TOTAL';
  
  let data = [];
  let title = '';
  
  if (isWaterPoints) {
    data = waterPoints;
    title = 'Total Water Points';
  } else {
    data = reports.filter(r => r.status === type);
    title = type === 'PENDING' ? 'Active Faults' 
          : type === 'IN_PROGRESS' ? 'Pending Repairs' 
          : 'Resolved Today';
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {data.length} records found
            </p>
          </div>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {data.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>No records found.</div>
          ) : isWaterPoints ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map(wp => (
                  <tr key={wp.id} className="clickable-row" onClick={() => { onClose(); navigate(`/waterpoints?flyTo=${wp.code}`); }}>
                    <td><strong>{wp.code}</strong></td>
                    <td className="muted">{wp.location || 'Unknown'}</td>
                    <td>
                      <span className={`status-badge status-${wp.status?.toLowerCase() || 'active'}`}>
                        {wp.status || 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Water Point</th>
                  <th>Fault</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id} className="clickable-row" onClick={() => { onClose(); navigate(`/waterpoints?flyTo=${r.water_point_code}`); }}>
                    <td className="mono">{r.ticket_number}</td>
                    <td><strong>{r.water_point_code}</strong></td>
                    <td><span className={`fault-badge fault-${r.fault_code?.toLowerCase()}`}>{FAULT_LABELS[r.fault_code] || r.fault_code}</span></td>
                    <td className="muted">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [reports, setReports] = useState([]);
  const [waterPoints, setWaterPoints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showAddWP, setShowAddWP] = useState(false);
  const [globeMode, setGlobeMode] = useState('globe');
  const [selectedPos, setSelectedPos] = useState(null);
  const [newWP, setNewWP] = useState({ code: '', location: '', description: '', latitude: '', longitude: '' });
  const [wpError, setWPError] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const authHeader = useCallback(
    () => ({ Authorization: `Bearer ${user.token}` }),
    [user.token]
  );

  const fetchData = useCallback(async () => {
    try {
      const [rRes, wpRes, techRes] = await Promise.all([
        axios.get(`${API}/api/reports/`, { headers: authHeader() }),
        axios.get(`${API}/api/waterpoints/`, { headers: authHeader() }),
        axios.get(`${API}/api/technicians/`, { headers: authHeader() }),
      ]);
      setReports(rRes.data);
      setWaterPoints(wpRes.data);
      setTechnicians(techRes.data);
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

  const pendingReports = reports.filter(r => r.status === 'PENDING');
  const inProgressReports = reports.filter(r => r.status === 'IN_PROGRESS');
  const recentReports = [...reports].slice(0, 3);
  const activeTechs = technicians.filter(t => t.is_available).length;
  const totalTechs = technicians.length;
  const uptime = waterPoints.length > 0 ? ((waterPoints.length - pendingReports.length) / waterPoints.length) * 100 : 99.9;
  const trendPoints = [4, 5, 6, 4, 3, 4, 5];
  const trendMax = Math.max(...trendPoints);

  return (
    <div className="dashboard-replica">
      {fetchError && (
        <div className="alert alert-error">API error: {fetchError}</div>
      )}

      <div className="dashboard-replica-grid">
        <section className="dashboard-left">
          <div className="dashboard-map-card">
            <div className="dashboard-map-head">
              <div>
                <h3>Live Water Point Overview</h3>
                <p>Real-time overview of water points and system status.</p>
              </div>
              <div className="dashboard-map-filters">
                <button className="btn-secondary btn-sm">Show Faults</button>
                <button className="btn-secondary btn-sm">All Points ▾</button>
              </div>
            </div>
            <div className="dashboard-map-body">
              <GlobeHero
                waterPoints={waterPoints}
                reports={reports}
                onLocationSelected={handleLocationSelected}
                selectedPos={selectedPos}
                loading={loading}
                onModeChange={setGlobeMode}
                initialMode="map"
                flatMap={true}
                showBackButton={false}
              />
            </div>
          </div>

          <div className="dashboard-bottom-grid">
            <div className="dashboard-mini-card">
              <div className="dashboard-mini-head">
                <h4>Recent Reports</h4>
                <button onClick={() => navigate('/reports')}>View all</button>
              </div>
              <div className="dashboard-mini-list">
                {recentReports.length === 0 ? (
                  <div className="dashboard-mini-empty">No recent reports</div>
                ) : recentReports.map((r) => (
                  <div key={r.id} className="dashboard-mini-row">
                    <div>
                      <div className="dashboard-mini-title">{FAULT_LABELS[r.fault_code] || r.fault_code}</div>
                      <div className="dashboard-mini-sub">{formatDate(r.created_at)}</div>
                    </div>
                    <span className={`status-badge status-${r.status?.toLowerCase()}`}>{r.status?.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-mini-card">
              <div className="dashboard-mini-head">
                <h4>Maintenance Activity</h4>
                <button onClick={() => navigate('/reports')}>View all</button>
              </div>
              <div className="dashboard-mini-list">
                {inProgressReports.length === 0 ? (
                  <div className="dashboard-mini-empty">No current maintenance</div>
                ) : inProgressReports.slice(0, 3).map((r) => (
                  <div key={r.id} className="dashboard-mini-row">
                    <div>
                      <div className="dashboard-mini-title">{FAULT_LABELS[r.fault_code] || r.fault_code}</div>
                      <div className="dashboard-mini-sub">{r.water_point_code}</div>
                    </div>
                    <span className="dashboard-mini-time">in progress</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-mini-card">
              <div className="dashboard-mini-head">
                <h4>Water Points Trend (7 Days)</h4>
                <button>7 days</button>
              </div>
              <div className="dashboard-trend">
                {trendPoints.map((v, idx) => (
                  <div key={`${idx}-${v}`} className="dashboard-trend-col">
                    <div className="dashboard-trend-dot" style={{ bottom: `${(v / trendMax) * 78}%` }} />
                    <div className="dashboard-trend-line" style={{ height: `${(v / trendMax) * 80}%` }} />
                    <span>May {18 + idx}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="dashboard-kpi-rail">
          <button className="dashboard-kpi-card" onClick={() => setActiveModal('PENDING')}>
            <div className="dashboard-kpi-head">
              <span className="dashboard-kpi-dot red" />
              <span>Active Faults</span>
            </div>
            <strong>{pendingReports.length}</strong>
            <small>{pendingReports.length === 0 ? 'No active faults' : 'Needs technician assignment'}</small>
          </button>

          <button className="dashboard-kpi-card" onClick={() => setActiveModal('IN_PROGRESS')}>
            <div className="dashboard-kpi-head">
              <span className="dashboard-kpi-dot amber" />
              <span>In Progress</span>
            </div>
            <strong>{inProgressReports.length}</strong>
            <small>{inProgressReports.length === 0 ? 'No issues in progress' : 'Under active repair'}</small>
          </button>

          <button className="dashboard-kpi-card" onClick={() => setActiveModal('TOTAL')}>
            <div className="dashboard-kpi-head">
              <span className="dashboard-kpi-dot blue" />
              <span>Water Points</span>
            </div>
            <strong>{waterPoints.length}</strong>
            <small>All systems operational</small>
          </button>

          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-head">
              <span className="dashboard-kpi-dot green" />
              <span>System Uptime</span>
            </div>
            <strong>{uptime.toFixed(1)}%</strong>
            <small>Last 30 days</small>
          </div>

          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-head">
              <span className="dashboard-kpi-dot purple" />
              <span>Technicians Available</span>
            </div>
            <strong>{activeTechs} / {totalTechs || 0}</strong>
            <small>{activeTechs > 0 ? 'Online now' : 'No technicians online'}</small>
          </div>
        </aside>
      </div>

      {/* ── Add Water Point Modal ───────────────────────── */}
      {showAddWP && (
        <div className="modal-backdrop" onClick={() => { setShowAddWP(false); setSelectedPos(null); }}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Water Point</h3>
              <button onClick={() => { setShowAddWP(false); setSelectedPos(null); }} className="modal-close">✕</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Click anywhere on the map view to pre-fill coordinates, or enter them manually.
            </p>
            {wpError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{wpError}</div>}
            <form onSubmit={handleAddWP} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input value={newWP.description} onChange={e => setNewWP({ ...newWP, description: e.target.value })} placeholder="Additional details..." />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>Save Water Point</button>
            </form>
          </div>
        </div>
      )}

      {activeModal && (
        <KPITableModal 
          type={activeModal} 
          onClose={() => setActiveModal(null)} 
          reports={reports} 
          waterPoints={waterPoints} 
          navigate={navigate} 
        />
      )}
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
          <Route path="/map" element={<ProtectedRoute><Layout><ProjectMap /></Layout></ProtectedRoute>} />
          <Route path="/technicians" element={<ProtectedRoute><Layout><Technicians /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
          <Route path="/sms" element={<ProtectedRoute><Layout><Sms /></Layout></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute><Layout><Help /></Layout></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
