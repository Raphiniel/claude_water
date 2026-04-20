import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './index.css';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Settings from './Settings';
import Map3DViewer from './Map3DViewer';
import Layout from './Layout';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [reports, setReports] = useState([]);
  const [waterPoints, setWaterPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddWP, setShowAddWP] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);
  const [newWP, setNewWP] = useState({ code: '', location: '', description: '', latitude: '', longitude: '' });
  
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const stats = {
    totalReports: reports.length,
    pendingFaults: reports.filter(r => r.status === 'PENDING').length,
    activeWaterPoints: waterPoints.length,
    resolvedIssues: reports.filter(r => r.status === 'RESOLVED').length
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportsRes, wpRes] = await Promise.all([
          axios.get('http://localhost:8000/api/reports/', {
            headers: { Authorization: `Bearer ${user.token}` }
          }),
          axios.get('http://localhost:8000/api/waterpoints/', {
            headers: { Authorization: `Bearer ${user.token}` }
          })
        ]);
        setReports(reportsRes.data);
        setWaterPoints(wpRes.data);
        setLoading(false);
      } catch (err) {
        setError('Connection issues. Using local data context.');
        setLoading(false);
      }
    };

    fetchData();
  }, [user, logout]);

  const handleLocationSelected = (latlng) => {
    setSelectedPos(latlng);
    setNewWP(prev => ({ ...prev, latitude: latlng.lat.toFixed(6), longitude: latlng.lng.toFixed(6) }));
    setShowAddWP(true);
  };

  const handleAddWP = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Sanitize coordinates: empty string -> null
    const requestData = {
      ...newWP,
      latitude: newWP.latitude === "" ? null : newWP.latitude,
      longitude: newWP.longitude === "" ? null : newWP.longitude
    };

    try {
      const response = await axios.post('http://localhost:8000/api/waterpoints/', requestData, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setWaterPoints([...waterPoints, response.data]);
      setShowAddWP(false);
      setNewWP({ code: '', location: '', description: '', latitude: '', longitude: '' });
      setSelectedPos(null);
    } catch (err) {
      const backendError = err.response?.data ? JSON.stringify(err.response.data) : "Network error";
      setError(`Failed to add water point: ${backendError}`);
      console.error("Add WP Error:", err.response?.data);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Total Reports</p>
          <p className="stat-value">{stats.totalReports}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Pending Faults</p>
          <p className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pendingFaults}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Water Points</p>
          <p className="stat-value" style={{ color: 'var(--primary)' }}>{stats.activeWaterPoints}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Resolved</p>
          <p className="stat-value" style={{ color: 'var(--success)' }}>{stats.resolvedIssues}</p>
        </div>
      </div>

      <main>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Geographic Overview</h2>
          <button onClick={() => setShowAddWP(!showAddWP)} className="btn-secondary">
            {showAddWP ? 'Cancel' : 'Add Water Point'}
          </button>
        </div>

        {showAddWP && (
          <div className="glass-panel" style={{ marginBottom: '2rem', animation: 'fadeInDown 0.4s ease-out' }}>
            <h3>Register New Water Point</h3>
            <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem'}}>
              Click on the map to pre-fill coordinates or enter them manually.
            </p>
            <form onSubmit={handleAddWP} className="reports-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div className="form-group">
                <label>WP Code</label>
                <input value={newWP.code} onChange={e => setNewWP({...newWP, code: e.target.value})} placeholder="e.g. WP005" required />
              </div>
              <div className="form-group">
                <label>Location Name</label>
                <input value={newWP.location} onChange={e => setNewWP({...newWP, location: e.target.value})} placeholder="e.g. Ward 5 Center" required />
              </div>
              <div className="form-group">
                <label>Latitude</label>
                <input value={newWP.latitude} onChange={e => setNewWP({...newWP, latitude: e.target.value})} placeholder="-19.000" required />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input value={newWP.longitude} onChange={e => setNewWP({...newWP, longitude: e.target.value})} placeholder="29.000" required />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Description (Optional)</label>
                <textarea 
                  value={newWP.description} 
                  onChange={e => setNewWP({...newWP, description: e.target.value})} 
                  style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)', color: 'white', padding: '10px', borderRadius: '8px' }}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1' }}>Save Water Point</button>
            </form>
          </div>
        )}

        <Map3DViewer 
          waterPoints={waterPoints} 
          onLocationSelected={handleLocationSelected}
          selectedPos={selectedPos}
        />

        <div className="glass-panel" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Recent Fault Reports</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {reports.length} Total Reports
            </span>
          </div>

          {loading ? (
            <div className="loading">Initializing System Data...</div>
          ) : error ? (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ color: 'var(--warning)', textAlign: 'center', marginBottom: '2rem' }}>{error}</div>
              <div className="reports-grid">
                {reports.map((report, index) => (
                  <div className="report-card" key={report.id} style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="report-header">
                      <span className="phone-number">{report.phone_number}</span>
                      <span className={`status-badge status-${report.status.toLowerCase()}`}>
                        {report.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="report-message">"{report.message}"</p>
                    <div className="report-footer">
                      <span>ID: #{report.id}</span>
                      <span>{formatDate(report.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="reports-grid">
              {reports.map((report, index) => (
                <div className="report-card" key={report.id} style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="report-header">
                    <span className="phone-number">{report.phone_number}</span>
                    <span className={`status-badge status-${report.status.toLowerCase()}`}>
                      {report.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="report-message">"{report.message}"</p>
                  <div className="report-footer">
                    <span>ID: #{report.id}</span>
                    <span>{formatDate(report.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
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
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
