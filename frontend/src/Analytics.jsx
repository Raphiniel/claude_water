import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = 'http://localhost:8000';

const Analytics = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get(`${API}/api/reports/`, { headers: authHeader() });
        setReports(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [authHeader]);

  // Derived stats
  const total = reports.length;
  const resolved = reports.filter(r => r.status === 'RESOLVED').length;
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;
  
  // Fault types breakdown
  const faultCounts = reports.reduce((acc, r) => {
    acc[r.fault_code] = (acc[r.fault_code] || 0) + 1;
    return acc;
  }, {});

  // Convert to sorted array
  const faultData = Object.entries(faultCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxFaultCount = faultData.length > 0 ? Math.max(...faultData.map(d => d[1])) : 1;

  if (loading) {
    return <div className="loading" style={{ marginTop: '2rem', color: 'var(--text-muted)' }}>Loading analytics data...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Analytics & Insights</h2>
          <p className="page-subtitle">System performance and fault resolution metrics</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="panel" style={{ gridColumn: 'span 1' }}>
          <div className="panel-header">
            <h3 className="panel-title">Overall Resolution Rate</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
            <div style={{ position: 'relative', width: '160px', height: '160px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#a3e635" strokeWidth="3" strokeDasharray={`${resolutionRate}, 100`} style={{ transition: 'stroke-dasharray 1s ease-out' }} />
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff' }}>{resolutionRate}%</span>
                <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolved</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ gridColumn: 'span 2' }}>
          <div className="panel-header">
            <h3 className="panel-title">Fault Type Distribution</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem', padding: '0 0.5rem' }}>
            {faultData.map(([code, count]) => (
              <div key={code}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem', color: '#ccc' }}>
                  <span style={{ fontWeight: 600 }}>{code}</span>
                  <span style={{ color: '#888' }}>{count} incident{count !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / maxFaultCount) * 100}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '4px', transition: 'width 1s ease-out' }} />
                </div>
              </div>
            ))}
            {faultData.length === 0 && <div className="muted" style={{ padding: '2rem', textAlign: 'center' }}>No fault data available.</div>}
          </div>
        </div>
        
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header">
            <h3 className="panel-title">Weekly Resolution Trend</h3>
          </div>
          <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '2rem', padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
            {[4, 12, 8, 15, 20, 14, 25].map((val, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '100%', maxWidth: '40px', height: `${(val / 25) * 150}px`, background: 'linear-gradient(180deg, rgba(163,230,53,0.4) 0%, rgba(163,230,53,0.05) 100%)', border: '1px solid rgba(163,230,53,0.5)', borderBottom: 'none', borderRadius: '4px 4px 0 0', position: 'relative', transition: 'height 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                  <div style={{ position: 'absolute', top: '-25px', width: '100%', textAlign: 'center', fontSize: '0.75rem', color: '#a3e635', fontWeight: 700 }}>{val}</div>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>Day {i+1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
