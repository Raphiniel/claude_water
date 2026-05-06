import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatDate } from './App';

import { API_BASE as API } from './apiConfig';

const FAULT_LABELS = {
  PUMP: 'Pump Failure', LEAK: 'Pipe Leak', DRY: 'Borehole Dry',
  CONTAM: 'Contamination', VANDAL: 'Vandalism', OTHER: 'Other',
};

const STATUSES = ['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED'];

const AssignModal = ({ report, onClose, onAssigned, authHeader }) => {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/technicians/`, { headers: authHeader() })
      .then(r => { setTechnicians(r.data); setLoading(false); })
      .catch(() => { setError('Failed to load technicians'); setLoading(false); });
  }, []);

  const assign = async (technicianId) => {
    setAssigning(true);
    setError(null);
    try {
      const res = await axios.post(
        `${API}/api/reports/${report.id}/assign/`,
        { technician_id: technicianId },
        { headers: authHeader() }
      );
      onAssigned(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Assignment failed');
      setAssigning(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Assign Technician</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {report.water_point_code} — {FAULT_LABELS[report.fault_code] || report.fault_code}
            </p>
          </div>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '0 0 1rem' }}>{error}</div>}

        <button
          onClick={() => assign('nearest')}
          disabled={assigning}
          className="btn-primary"
          style={{ width: '100%', marginBottom: '1rem', justifyContent: 'center' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          Auto-assign Nearest Technician
        </button>

        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Or choose manually
          </p>
          {loading ? (
            <div className="loading" style={{ height: '80px' }}>Loading...</div>
          ) : technicians.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>No technicians registered yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
              {technicians.map(t => (
                <button
                  key={t.id}
                  onClick={() => assign(t.id)}
                  disabled={assigning || !t.is_available}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--card-border)',
                    background: t.is_available ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
                    color: t.is_available ? 'var(--text-main)' : 'var(--text-muted)',
                    cursor: t.is_available ? 'pointer' : 'not-allowed',
                    textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (t.is_available) e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = t.is_available ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)'; }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.phone}</div>
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                    background: t.is_available ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                    color: t.is_available ? 'var(--success)' : 'var(--text-muted)',
                  }}>
                    {t.is_available ? 'Available' : 'Busy'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assigningReport, setAssigningReport] = useState(null);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/reports/`, { headers: authHeader() });
      setReports(res.data);
      setFetchError(null);
    } catch (err) {
      setFetchError(err.response?.data ? JSON.stringify(err.response.data) : err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get('status');
    if (s && STATUSES.includes(s)) setStatusFilter(s);
  }, [location.search]);

  useEffect(() => {
    fetchReports();
    const t = setInterval(fetchReports, 30000);
    return () => clearInterval(t);
  }, [fetchReports]);

  const handleAssigned = (updatedReport) => {
    setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
  };

  const handleRowClick = (report) => {
    navigate(`/waterpoints?flyTo=${report.water_point_code}`);
  };

  const filtered = statusFilter === 'ALL' ? reports : reports.filter(r => r.status === statusFilter);
  const counts = Object.fromEntries(STATUSES.map(s => [s, s === 'ALL' ? reports.length : reports.filter(r => r.status === s).length]));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Fault Reports</h2>
          <p className="page-subtitle">{reports.length} total reports across all water points</p>
        </div>
        <button onClick={fetchReports} className="btn-secondary btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>

      {fetchError && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>API error: {fetchError}</div>}

      <div className="glass-panel">
        <div className="filter-tabs">
          {STATUSES.map(s => (
            <button key={s} className={`filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s.replace('_', ' ')}
              <span className="filter-tab-count">{counts[s]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading">Loading reports...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', opacity: 0.4 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p>No {statusFilter !== 'ALL' ? statusFilter.replace('_', ' ').toLowerCase() : ''} reports found.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ticket</th>
                  <th>Water Point</th>
                  <th>Fault Type</th>
                  <th>Reporter</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Reported</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className="clickable-row"
                    onClick={() => handleRowClick(r)}
                    title="Click to view on map"
                  >
                    <td className="muted">{i + 1}</td>
                    <td className="mono">{r.ticket_number}</td>
                    <td><strong>{r.water_point_code}</strong></td>
                    <td><span className={`fault-badge fault-${r.fault_code?.toLowerCase()}`}>{FAULT_LABELS[r.fault_code] || r.fault_code}</span></td>
                    <td className="mono muted">{r.sender_number}</td>
                    <td><span className={`status-badge status-${r.status?.toLowerCase()}`}>{r.status?.replace('_', ' ')}</span></td>
                    <td className="muted">{r.assigned_to_details?.name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>}</td>
                    <td className="muted">{formatDate(r.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {r.status !== 'RESOLVED' && (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => setAssigningReport(r)}
                        >
                          Assign
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {assigningReport && (
        <AssignModal
          report={assigningReport}
          authHeader={authHeader}
          onClose={() => setAssigningReport(null)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  );
};

export default Reports;
