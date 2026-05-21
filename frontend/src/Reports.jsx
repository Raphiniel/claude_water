import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatDate } from './App';

import { API_BASE as API } from './apiConfig';
import TableRowMenu, { TableRowMenuItem } from './TableRowMenu';
import { Crosshair, FileText, RefreshCw } from 'lucide-react';
import { Icon } from './components/ui/icon';
import { Loader } from './components/ui/loader';

const FAULT_LABELS = {
  PUMP: 'Pump Failure', LEAK: 'Pipe Leak', DRY: 'Borehole Dry',
  CONTAM: 'Contamination', VANDAL: 'Vandalism', OTHER: 'Other',
};

const STATUSES = ['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED'];

const FILTER_CARDS = [
  { key: 'ALL', label: 'All reports', dot: 'purple', hint: 'Full queue' },
  { key: 'PENDING', label: 'Pending', dot: 'amber', hint: 'Awaiting assignment' },
  { key: 'IN_PROGRESS', label: 'In progress', dot: 'blue', hint: 'Technician assigned' },
  { key: 'RESOLVED', label: 'Resolved', dot: 'green', hint: 'Closed faults' },
];

const mapsDirUrl = (lat, lng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}&travelmode=driving`;

const CloseFaultModal = ({ report, onClose, onConfirm, submitting, error }) => {
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(notes);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '92%' }}>
        <div className="modal-header">
          <div>
            <h3>Close fault</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Ticket {report.ticket_number} · {report.water_point_code}
            </p>
          </div>
          <button type="button" onClick={onClose} className="modal-close">✕</button>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
            Closure notes (required)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what was fixed on site…"
            rows={4}
            required
            minLength={3}
            maxLength={500}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.65rem 0.75rem',
              borderRadius: 10,
              border: '1px solid var(--border)',
              fontSize: '0.88rem',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: '1.1rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || notes.trim().length < 3}>
              {submitting ? 'Closing…' : 'Close fault'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ReportDetailModal = ({ report, onClose, authHeader, navigate, onAssign, onCloseFault, resolving }) => {
  const [full, setFull] = useState(report);
  const [loadErr, setLoadErr] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadErr(null);
    setDetailLoading(true);
    axios
      .get(`${API}/api/reports/${report.id}/`, { headers: authHeader() })
      .then((res) => {
        if (!cancelled) setFull(res.data);
      })
      .catch((err) => {
        if (!cancelled) setLoadErr(err.response?.data ? JSON.stringify(err.response.data) : err.message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report.id, authHeader]);

  const wp = full.water_point_details;
  const tech = full.assigned_to_details;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '92%' }}>
        <div className="modal-header">
          <div>
            <h3>Report {full.ticket_number}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {full.water_point_code} · {formatDate(full.created_at)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="modal-close">
            ✕
          </button>
        </div>

        {loadErr && <div className="alert alert-error" style={{ margin: '0 0 1rem' }}>{loadErr}</div>}

        {detailLoading ? (
          <Loader variant="section" label="Loading report details…" />
        ) : (
        <>
        <div style={{ display: 'grid', gap: '0.85rem', fontSize: '0.88rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
            <span className={`status-badge status-${full.status?.toLowerCase()}`}>{full.status?.replace('_', ' ')}</span>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Fault</div>
            <span className={`fault-badge fault-${full.fault_code?.toLowerCase()}`}>{FAULT_LABELS[full.fault_code] || full.fault_code}</span>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Reporter (SMS)</div>
            <span className="mono">{full.sender_number || '—'}</span>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Inbound message</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, color: 'var(--text-main)' }}>{full.raw_message || '—'}</div>
          </div>
          {wp && (
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Water point</div>
              <div style={{ fontWeight: 600 }}>{wp.location}</div>
              {wp.description && <div style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: '0.82rem' }}>{wp.description}</div>}
              {wp.latitude != null && wp.longitude != null && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span className="mono muted" style={{ fontSize: '0.8rem' }}>
                    {wp.latitude}, {wp.longitude}
                  </span>
                  <a className="btn-secondary btn-sm" href={mapsDirUrl(wp.latitude, wp.longitude)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    Directions (Google Maps)
                  </a>
                </div>
              )}
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Assigned technician</div>
            {tech ? (
              <div>
                <strong>{tech.name}</strong>
                <div className="muted" style={{ fontSize: '0.82rem' }}>
                  {tech.phone}
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
            )}
          </div>
          {full.status === 'RESOLVED' && (
            <>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Closed</div>
                <p>{full.resolved_at ? formatDate(full.resolved_at) : '—'}</p>
                {(full.closed_by_staff_username || full.closed_by_technician_name) && (
                  <div className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    by {full.closed_by_staff_username || full.closed_by_technician_name}
                  </div>
                )}
              </div>
              {full.closure_notes && (
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>Closure notes</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{full.closure_notes}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate('/map')}>
            Live map
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(`/waterpoints?flyTo=${full.water_point_code}`)}>
            Water point
          </button>
          {full.status !== 'RESOLVED' && (
            <>
              <button type="button" className="btn-primary" onClick={() => onAssign(full)}>
                Assign technician…
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={resolving}
                onClick={() => onCloseFault(full)}
              >
                Close fault…
              </button>
            </>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
};

const AssignModal = ({ report, onClose, onAssigned, authHeader }) => {
  const [technicians, setTechnicians] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      axios.get(`${API}/api/technicians/`, { headers: authHeader() }),
      axios.get(`${API}/api/reports/${report.id}/nearby-technicians/`, { headers: authHeader() }),
    ])
      .then(([allRes, nearbyRes]) => {
        if (!mounted) return;
        setTechnicians(allRes.data);
        setNearby(nearbyRes.data);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setTechnicians([]);
        setNearby([]);
        setError(err.response?.data?.error || 'Failed to load technicians');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [authHeader, report.id]);

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
          <Icon icon={Crosshair} size="sm" strokeWidth={2.5} />
          Auto-assign Nearest Technician
        </button>

        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Nearby technicians
          </p>
          {loading ? (
            <Loader variant="inline" label="Loading nearby technicians…" />
          ) : nearby.length === 0 ? (
            <div className="empty-state" style={{ padding: '1rem' }}>No technicians with location data near this water point.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '210px', overflowY: 'auto' }}>
              {nearby.map(t => (
                <button
                  key={`nearby-${t.id}`}
                  onClick={() => assign(t.id)}
                  disabled={assigning || !t.is_available}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.7rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59,130,246,0.25)',
                    background: t.is_available ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                    color: t.is_available ? 'var(--text-main)' : 'var(--text-muted)',
                    cursor: t.is_available ? 'pointer' : 'not-allowed',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{t.name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t.phone}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa' }}>
                      {t.distance_km} km
                    </span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                      background: t.is_available ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                      color: t.is_available ? 'var(--success)' : 'var(--text-muted)',
                    }}>
                      {t.is_available ? 'Available' : 'Busy'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Or choose manually
          </p>
          {loading ? (
            <Loader variant="inline" label="Loading technicians…" />
          ) : technicians.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>No technicians registered yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
              {technicians.filter((t) => t.is_active !== false).map(t => (
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
  const [detailReport, setDetailReport] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [closingReport, setClosingReport] = useState(null);
  const [closeError, setCloseError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const reopenDetailAfterAssign = useRef(false);
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
    setReports((prev) => prev.map((r) => (r.id === updatedReport.id ? updatedReport : r)));
    if (reopenDetailAfterAssign.current) {
      setDetailReport(updatedReport);
      reopenDetailAfterAssign.current = false;
    }
  };

  const applyFilter = (status) => {
    setStatusFilter(status);
    const params = new URLSearchParams(location.search);
    if (status === 'ALL') params.delete('status');
    else params.set('status', status);
    const q = params.toString();
    navigate({ pathname: '/reports', search: q ? `?${q}` : '' }, { replace: true });
  };

  const closeFault = async (report, closureNotes) => {
    setStatusUpdatingId(report.id);
    setCloseError(null);
    try {
      const res = await axios.post(
        `${API}/api/reports/${report.id}/status/`,
        { status: 'RESOLVED', closure_notes: closureNotes.trim() },
        { headers: authHeader() },
      );
      handleAssigned(res.data);
      setClosingReport(null);
      setDetailReport((prev) => (prev?.id === report.id ? null : prev));
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Could not close fault';
      setCloseError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openCloseModal = (report) => {
    setCloseError(null);
    setClosingReport(report);
  };

  const handleRowClick = (report) => {
    setDetailReport(report);
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
          <Icon icon={RefreshCw} size="sm" strokeWidth={2.5} />
          Refresh
        </button>
      </div>

      {fetchError && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>API error: {fetchError}</div>}

      <div className="reports-summary-cards">
        {FILTER_CARDS.map((card) => (
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
        {loading ? (
          <Loader variant="section" label="Loading reports…" />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Icon icon={FileText} size="3xl" strokeWidth={1.5} style={{ marginBottom: '1rem', opacity: 0.4 }} />
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
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className="clickable-row"
                    onClick={() => handleRowClick(r)}
                    title="Click row for full details"
                  >
                    <td className="muted">{i + 1}</td>
                    <td className="mono">{r.ticket_number}</td>
                    <td><strong>{r.water_point_code}</strong></td>
                    <td><span className={`fault-badge fault-${r.fault_code?.toLowerCase()}`}>{FAULT_LABELS[r.fault_code] || r.fault_code}</span></td>
                    <td className="mono muted">{r.sender_number}</td>
                    <td><span className={`status-badge status-${r.status?.toLowerCase()}`}>{r.status?.replace('_', ' ')}</span></td>
                    <td className="muted">{r.assigned_to_details?.name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>}</td>
                    <td className="muted">{formatDate(r.created_at)}</td>
                    <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                      <TableRowMenu
                        isOpen={openMenuId === r.id}
                        onToggle={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                        onClose={() => setOpenMenuId(null)}
                      >
                        <TableRowMenuItem
                          onClick={() => {
                            setOpenMenuId(null);
                            handleRowClick(r);
                          }}
                        >
                          View details
                        </TableRowMenuItem>
                        <TableRowMenuItem
                          onClick={() => {
                            setOpenMenuId(null);
                            navigate(`/waterpoints?flyTo=${r.water_point_code}`);
                          }}
                        >
                          View on map
                        </TableRowMenuItem>
                        {r.status !== 'RESOLVED' && (
                          <>
                            <TableRowMenuItem
                              onClick={() => {
                                setOpenMenuId(null);
                                reopenDetailAfterAssign.current = false;
                                setAssigningReport(r);
                              }}
                            >
                              Assign technician
                            </TableRowMenuItem>
                            <TableRowMenuItem
                              disabled={statusUpdatingId === r.id}
                              onClick={() => {
                                setOpenMenuId(null);
                                openCloseModal(r);
                              }}
                            >
                              Close fault…
                            </TableRowMenuItem>
                          </>
                        )}
                      </TableRowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailReport && (
        <ReportDetailModal
          report={detailReport}
          authHeader={authHeader}
          navigate={navigate}
          onClose={() => setDetailReport(null)}
          onAssign={(r) => {
            reopenDetailAfterAssign.current = true;
            setDetailReport(null);
            setAssigningReport(r);
          }}
          onCloseFault={openCloseModal}
          resolving={statusUpdatingId === detailReport.id}
        />
      )}

      {closingReport && (
        <CloseFaultModal
          report={closingReport}
          onClose={() => {
            setClosingReport(null);
            setCloseError(null);
          }}
          onConfirm={(notes) => closeFault(closingReport, notes)}
          submitting={statusUpdatingId === closingReport.id}
          error={closeError}
        />
      )}

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
