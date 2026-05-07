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

  const pendingReports = reports.filter(r => r.status === 'PENDING').slice(0, 3);
  const inProgressReports = reports.filter(r => r.status === 'IN_PROGRESS').slice(0, 3);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1.25rem', 
      height: 'calc(100vh - 100px)',
      minHeight: 0
    }}>
      {fetchError && (
        <div className="alert alert-error">API error: {fetchError}</div>
      )}

      {/* ── Main Grid ───────────────────────────────────── */}
      <div className="dashboard-grid" style={{ 
        gridTemplateColumns: globeMode === 'map' ? '1fr' : '3.4fr 0.75fr',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        
        {/* Left Column */}
        <div className="left-column" style={{ height: '100%', minHeight: 0 }}>
          
          {/* Live Infrastructure Map Panel */}
          <div className="panel" style={{ padding: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Panel header is hidden in globe mode to match the Project Locations design */}
            {globeMode === 'map' && (
              <div className="panel-header" style={{ padding: '1.25rem 1.25rem 0.75rem 1.25rem', marginBottom: 0, zIndex: 20, position: 'relative' }}>
                <h3 className="panel-title">Live Infrastructure Map</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Show Faults</button>
                  <button className="btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>All Points ▾</button>
                </div>
              </div>
            )}
            
            <div style={{
              height: globeMode === 'map' ? 'calc(100% - 64px)' : '100%',
              minHeight: globeMode === 'map' ? '0' : '200px',
              transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              width: '100%',
              position: 'relative',
              zIndex: 10
            }}>
              <GlobeHero
                waterPoints={waterPoints}
                reports={reports}
                onLocationSelected={handleLocationSelected}
                selectedPos={selectedPos}
                loading={loading}
                onModeChange={setGlobeMode}
              />
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="right-column" style={{ display: globeMode === 'map' ? 'none' : 'flex', height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
          <div className="four-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
            <div className="mini-stat-card compact" style={{ cursor: 'pointer' }} onClick={() => setActiveModal('PENDING')}>
              <div className="mini-stat-header">
                <div className="mini-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>
                </div>
                <span className="mini-stat-label">Active Faults</span>
              </div>
              <div className="mini-stat-value">{reports.filter(r => r.status === 'PENDING').length}</div>
            </div>

            <div className="mini-stat-card compact" style={{ cursor: 'pointer' }} onClick={() => setActiveModal('IN_PROGRESS')}>
              <div className="mini-stat-header">
                <div className="mini-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle></svg>
                </div>
                <span className="mini-stat-label">In Progress</span>
              </div>
              <div className="mini-stat-value">{reports.filter(r => r.status === 'IN_PROGRESS').length}</div>
            </div>

            <div className="mini-stat-card compact" style={{ cursor: 'pointer' }} onClick={() => setActiveModal('TOTAL')}>
              <div className="mini-stat-header">
                <div className="mini-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                </div>
                <span className="mini-stat-label">Water Points</span>
              </div>
              <div className="mini-stat-value">{waterPoints.length}</div>
            </div>
          </div>
          
          {/* Active Alerts */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Active Alerts</h3>
              <span style={{ cursor: 'pointer', color: '#888', fontSize: '0.8rem' }} onClick={() => navigate('/reports')}>View all →</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingReports.length === 0 ? (
                <div style={{ color: '#888', fontSize: '0.85rem' }}>No active alerts</div>
              ) : pendingReports.map((alert, i) => (
                <div key={alert.id} style={{ background: i === 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)', border: `1px solid ${i === 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`, borderRadius: '8px', padding: '1rem', display: 'flex', gap: '1rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? '#ef4444' : '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', color: i === 0 ? '#ef4444' : '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{i === 0 ? 'CRITICAL' : 'HIGH'}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', margin: '2px 0' }}>{FAULT_LABELS[alert.fault_code] || alert.fault_code}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      {alert.water_point_code}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>10 min ago</div>
                </div>
              ))}
            </div>
          </div>

          {/* Repair Queue */}
          <div className="panel">
            <div className="panel-header" style={{ marginBottom: '0.75rem' }}>
              <h3 className="panel-title">Repair Queue</h3>
              <span style={{ cursor: 'pointer', color: '#888', fontSize: '0.8rem' }} onClick={() => navigate('/reports')}>View all →</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
              {inProgressReports.length === 0 ? (
                <div style={{ color: '#888', fontSize: '0.85rem' }}>No in-progress repairs</div>
              ) : inProgressReports.map((report) => (
                <button key={report.id} className="fault-card-item" onClick={() => navigate('/reports')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="status-badge status-in_progress">IN PROGRESS</span>
                    <span style={{ color: '#aaa', fontSize: '0.72rem' }}>{report.water_point_code}</span>
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: '#fff' }}>{FAULT_LABELS[report.fault_code] || report.fault_code}</div>
                </button>
              ))}
            </div>

            <h3 className="panel-title" style={{ marginBottom: '1rem' }}>Quick Actions</h3>
            <div className="quick-actions-grid">
              <div className="quick-action-btn" onClick={() => setShowAddWP(true)}>
                <svg className="quick-action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span className="quick-action-label">Add Water Point</span>
              </div>
              <div className="quick-action-btn" onClick={() => navigate('/sms')}>
                <svg className="quick-action-icon" style={{ color: '#3b82f6' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span className="quick-action-label">Send SMS Alert</span>
              </div>
              <div className="quick-action-btn" onClick={fetchData}>
                <svg className="quick-action-icon" style={{ color: '#10b981' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                <span className="quick-action-label">Refresh Data</span>
              </div>
              <div className="quick-action-btn" onClick={() => navigate('/waterpoints')}>
                <svg className="quick-action-icon" style={{ color: '#a3e635' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><map name="map"></map><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
                <span className="quick-action-label">View Full Map</span>
              </div>
            </div>
          </div>

        </div>
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
