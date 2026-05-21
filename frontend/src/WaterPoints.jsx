import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatDate } from './App';
import GlobeHero from './GlobeHero';
import Map3DViewer from './Map3DViewer';
import TableRowMenu, { TableRowMenuItem } from './TableRowMenu';

import { API_BASE as API } from './apiConfig';
import {
  AlertTriangle,
  Droplet,
  Layers,
  MapPin,
  MapPinOff,
  RefreshCw,
  Search,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { Icon } from './components/ui/icon';
import { Loader, LoadingOverlay } from './components/ui/loader';

const PAGE_SIZE = 10;

const FAULT_LABELS = {
  PUMP: 'Pump Failure',
  LEAK: 'Pipe Leak',
  DRY: 'Borehole Dry',
  CONTAM: 'Contamination',
  VANDAL: 'Vandalism',
  OTHER: 'Other',
};

function parseList(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

const STATUS_FILTERS = [
  { key: 'ALL', statLabel: 'ALL POINTS', tone: 'purple', hint: 'Total registered' },
  { key: 'CLEAR', statLabel: 'CLEAR', tone: 'green', hint: 'No active faults' },
  { key: 'FAULTY', statLabel: 'WITH FAULTS', tone: 'amber', hint: 'Needs attention' },
  { key: 'NO_GPS', statLabel: 'NO GPS', tone: 'red', hint: 'Missing coordinates' },
];

const STATUS_DROPDOWN = [
  { value: 'ALL', label: 'All' },
  { value: 'CLEAR', label: 'Clear' },
  { value: 'FAULTY', label: 'With faults' },
  { value: 'NO_GPS', label: 'No GPS' },
];

const FAULT_DROPDOWN = [
  { value: 'ALL', label: 'All' },
  { value: 'WITH_FAULTS', label: 'With faults' },
  { value: 'NO_FAULTS', label: 'No faults' },
];

function formatRelativeTime(date) {
  if (!date) return '—';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

const STAT_ICONS = { purple: Layers, green: ShieldCheck, amber: AlertTriangle, red: MapPinOff };

const SPARKLINE_PATHS = {
  purple: 'M0,14 L5,10 L10,12 L15,7 L20,9 L24,5',
  green: 'M0,13 L6,9 L12,11 L18,6 L24,8',
  amber: 'M0,12 L4,14 L9,10 L14,13 L19,8 L24,11',
  red: 'M0,11 L5,13 L11,9 L16,12 L21,7 L24,10',
};

function Sparkline({ tone }) {
  return (
    <svg className={`wp-stat-sparkline wp-stat-sparkline--${tone}`} viewBox="0 0 24 16" preserveAspectRatio="none" aria-hidden>
      <path d={SPARKLINE_PATHS[tone] || SPARKLINE_PATHS.purple} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UptimeRing({ pct }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg className="wp-insight-ring" viewBox="0 0 36 36" aria-hidden>
      <circle className="wp-insight-ring-track" cx="18" cy="18" r={r} />
      <circle className="wp-insight-ring-fill" cx="18" cy="18" r={r} strokeDasharray={c} strokeDashoffset={offset} />
      <text x="18" y="18.5" className="wp-insight-ring-text">{Math.round(pct)}%</text>
    </svg>
  );
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

function ReportHistoryCard({ report, onViewReports }) {
  const tech = report.assigned_to_details;
  const closedBy = report.closed_by_staff_username || report.closed_by_technician_name;

  return (
    <article className="wp-repair-card">
      <div className="wp-repair-card-head">
        <span className="mono wp-repair-ticket">{report.ticket_number}</span>
        <span className={`status-badge status-${report.status?.toLowerCase()}`}>
          {report.status?.replace('_', ' ')}
        </span>
      </div>
      <div className="wp-repair-card-meta">
        <span className={`fault-badge fault-${(report.fault_code || 'other').toLowerCase()}`}>
          {FAULT_LABELS[report.fault_code] || report.fault_code}
        </span>
        <span className="muted">Reported {formatDate(report.created_at)}</span>
        {report.status === 'RESOLVED' && report.resolved_at && (
          <span className="muted">Resolved {formatDate(report.resolved_at)}</span>
        )}
      </div>
      {tech && (
        <p className="wp-repair-line">
          <strong>Technician:</strong> {tech.name}
          {tech.phone ? <span className="muted"> · {tech.phone}</span> : null}
        </p>
      )}
      {report.sender_number && (
        <p className="wp-repair-line">
          <strong>Reporter:</strong> <span className="mono">{report.sender_number}</span>
        </p>
      )}
      {report.raw_message && (
        <p className="wp-repair-message">{report.raw_message}</p>
      )}
      {report.status === 'RESOLVED' && (
        <>
          {closedBy && (
            <p className="wp-repair-line muted">
              Closed by {closedBy}
            </p>
          )}
          {report.closure_notes && (
            <p className="wp-repair-notes">
              <strong>Repair notes:</strong> {report.closure_notes}
            </p>
          )}
        </>
      )}
      <button type="button" className="btn-ghost btn-sm wp-repair-open" onClick={() => onViewReports(report)}>
        Open in reports
      </button>
    </article>
  );
}

const WaterPointDetailModal = ({
  point,
  pointReports,
  faultCount,
  onClose,
  onFlyToMap,
  onDelete,
  onViewReports,
}) => {
  const hasFault = faultCount > 0;
  const openReports = pointReports.filter((r) => r.status !== 'RESOLVED');
  const repairHistory = pointReports
    .filter((r) => r.status === 'RESOLVED')
    .sort(
      (a, b) =>
        new Date(b.resolved_at || b.created_at || 0) - new Date(a.resolved_at || a.created_at || 0)
    );
  const resolvedCount = repairHistory.length;
  const totalReports = pointReports.length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel wp-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>{point.code}</h3>
            <p className="wp-detail-subtitle">
              {point.location} · Registered {formatDate(point.created_at)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            ✕
          </button>
        </div>

        <dl className="wp-detail-grid">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`status-badge ${hasFault ? 'wp-status-fault' : 'wp-status-clear'}`}>
                {hasFault ? `${faultCount} active fault${faultCount > 1 ? 's' : ''}` : 'Clear'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Total reports</dt>
            <dd>{totalReports}</dd>
          </div>
          <div>
            <dt>Coordinates</dt>
            <dd>
              {point.latitude && point.longitude ? (
                <span className="mono">{point.latitude}, {point.longitude}</span>
              ) : (
                <span className="muted">Not set</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Repairs completed</dt>
            <dd>{resolvedCount}</dd>
          </div>
          <div className="wp-detail-grid--full">
            <dt>Description</dt>
            <dd>{point.description || '—'}</dd>
          </div>
        </dl>

        {openReports.length > 0 && (
          <section className="wp-detail-section">
            <h4 className="wp-detail-section-title">Open faults</h4>
            <div className="wp-repair-list">
              {openReports.map((r) => (
                <ReportHistoryCard key={r.id} report={r} onViewReports={onViewReports} />
              ))}
            </div>
          </section>
        )}

        <section className="wp-detail-section">
          <h4 className="wp-detail-section-title">
            Repair history
            {repairHistory.length > 0 && (
              <span className="wp-detail-section-count">{repairHistory.length}</span>
            )}
          </h4>
          {repairHistory.length === 0 ? (
            <p className="wp-detail-empty muted">No completed repairs recorded for this water point yet.</p>
          ) : (
            <div className="wp-repair-list">
              {repairHistory.map((r) => (
                <ReportHistoryCard key={r.id} report={r} onViewReports={onViewReports} />
              ))}
            </div>
          )}
        </section>

        {totalReports > 0 && (
          <p className="wp-detail-footer-note muted">
            Showing all fault reports linked to {point.code}, newest first.
          </p>
        )}

        <div className="wp-detail-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onClose();
              onFlyToMap(point.code);
            }}
          >
            View on map
          </button>
          {totalReports > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onViewReports(null)}
            >
              All reports
            </button>
          )}
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
  const [faultFilter, setFaultFilter] = useState('ALL');
  const [page, setPage] = useState(1);
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
      setWaterPoints(parseList(wpRes.data));
      setReports(parseList(rRes.data));
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
    setPage(1);
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
    if (faultFilter === 'WITH_FAULTS' && !hasFault) return false;
    if (faultFilter === 'NO_FAULTS' && hasFault) return false;
    return true;
  }), [waterPoints, searchQuery, statusFilter, faultFilter, faultCounts]);

  const totalFaults = useMemo(
    () => Object.values(faultCounts).reduce((sum, n) => sum + n, 0),
    [faultCounts],
  );

  const onlineCount = counts.CLEAR;
  const uptimePct = waterPoints.length > 0 ? (onlineCount / waterPoints.length) * 100 : 100;
  const allOperational = counts.FAULTY === 0;

  const totalPages = Math.max(1, Math.ceil(filteredPoints.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedPoints = filteredPoints.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, faultFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearTableFilters = () => {
    setSearchQuery('');
    setFaultFilter('ALL');
    applyFilter('ALL');
  };

  const hasActiveTableFilters = searchQuery || faultFilter !== 'ALL' || statusFilter !== 'ALL';

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

  const pointReports = useMemo(() => {
    if (!detailPoint) return [];
    return reports
      .filter((r) => r.water_point_code === detailPoint.code)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [reports, detailPoint]);

  const openReportsForPoint = (report) => {
    setDetailPoint(null);
    if (report?.status) {
      navigate(`/reports?status=${report.status}`);
    } else {
      navigate('/reports');
    }
  };

  return (
    <div className="water-points-page">
      <header className="wp-page-header">
        <div>
          <h1 className="wp-page-title">Water Points</h1>
          <p className="wp-page-subtitle">
            {waterPoints.length} registered
            {lastUpdated && (
              <>
                {' · '}
                Updated {formatRelativeTime(lastUpdated)}
              </>
            )}
          </p>
        </div>
        <div className="wp-page-actions">
          <button type="button" onClick={fetchData} className="btn-secondary btn-sm wp-btn-refresh">
            <Icon icon={RefreshCw} size="sm" strokeWidth={2.5} />
            Refresh
          </button>
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary wp-btn-add">
            <span aria-hidden>+</span>
            Add Water Point
          </button>
        </div>
      </header>

      {fetchError && <div className="alert alert-error wp-page-alert">API error: {fetchError}</div>}

      <section className="wp-overview-card" aria-label="Water points overview">
        <div className="wp-overview-copy">
          <div className="wp-overview-icon" aria-hidden>
            <Icon icon={Droplet} size="lg" />
          </div>
          <h2>Overview</h2>
          <p>
            Monitor all registered water points across Zimbabwe. Track status, detect faults,
            and ensure reliable water access for every community.
          </p>
          <p className={`wp-overview-status${allOperational ? ' wp-overview-status--ok' : ''}`}>
            <span className="wp-overview-status-dot" aria-hidden />
            {allOperational ? 'All systems operational' : `${counts.FAULTY} point${counts.FAULTY === 1 ? '' : 's'} need attention`}
          </p>
        </div>
        <div className="wp-overview-map" style={{ position: 'relative' }}>
          {loading && <LoadingOverlay label="Loading water points…" />}
          <GlobeHero
            waterPoints={waterPoints}
            reports={reports}
            onLocationSelected={handleLocationSelected}
            selectedPos={selectedPos}
            flyToCode={flyToCode}
            loading={loading}
            initialMode="map"
            flatMap
            showBackButton={false}
          />
        </div>
        <aside className="wp-insights" aria-label="Quick insights">
          <div className="wp-insight-row">
            <span className="wp-insight-icon wp-insight-icon--blue" aria-hidden><Icon icon={Droplet} size="lg" /></span>
            <div>
              <strong>{waterPoints.length}</strong>
              <span>Total water points</span>
            </div>
          </div>
          <div className="wp-insight-row">
            <span className="wp-insight-icon wp-insight-icon--amber" aria-hidden><Icon icon={AlertTriangle} size="lg" /></span>
            <div>
              <strong>{totalFaults}</strong>
              <span>Faults detected</span>
            </div>
          </div>
          <div className="wp-insight-row">
            <span className="wp-insight-icon wp-insight-icon--green" aria-hidden><Icon icon={Wifi} size="md" /></span>
            <div>
              <strong>{onlineCount}</strong>
              <span>Online &amp; operational</span>
            </div>
          </div>
          <div className="wp-insight-row wp-insight-row--ring">
            <UptimeRing pct={uptimePct} />
            <div>
              <strong>{Math.round(uptimePct)}%</strong>
              <span>System uptime</span>
            </div>
          </div>
        </aside>
      </section>

      <div className="wp-stat-grid">
        {STATUS_FILTERS.map((card) => {
          const StatIcon = STAT_ICONS[card.tone];
          return (
            <button
              key={card.key}
              type="button"
              className={`wp-stat-card wp-stat-card--${card.tone}${statusFilter === card.key ? ' active' : ''}`}
              onClick={() => applyFilter(card.key)}
              aria-pressed={statusFilter === card.key}
            >
              <span className={`wp-stat-icon wp-stat-icon--${card.tone}`} aria-hidden>
                <Icon icon={StatIcon} size="lg" />
              </span>
              <div className="wp-stat-body">
                <span className="wp-stat-label">{card.statLabel}</span>
                <strong>{counts[card.key] ?? 0}</strong>
                <small>{card.hint}</small>
              </div>
              <Sparkline tone={card.tone} />
            </button>
          );
        })}
      </div>

      <section className="wp-table-panel glass-panel" style={{ position: 'relative' }}>
        <div className="wp-table-toolbar">
          <div className="search-bar wp-table-search">
            <Icon icon={Search} size="md" />
            <input
              type="search"
              placeholder="Search by code or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <label className="wp-filter-select">
            <span>Status:</span>
            <select value={statusFilter} onChange={(e) => applyFilter(e.target.value)}>
              {STATUS_DROPDOWN.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="wp-filter-select">
            <span>Faults:</span>
            <select
              value={faultFilter}
              onChange={(e) => {
                setFaultFilter(e.target.value);
                setPage(1);
              }}
            >
              {FAULT_DROPDOWN.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          {hasActiveTableFilters && (
            <button type="button" className="wp-clear-filters" onClick={clearTableFilters}>
              <span aria-hidden>×</span>
              Clear Filters
            </button>
          )}
        </div>

        {loading ? (
          <Loader variant="section" label="Loading water points…" />
        ) : filteredPoints.length === 0 ? (
          <div className="empty-state">
            <Icon icon={MapPin} size="3xl" strokeWidth={1.5} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <p>
              {waterPoints.length === 0
                ? 'No water points registered yet.'
                : 'No water points match this filter or search.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table wp-data-table">
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
                {pagedPoints.map((wp, i) => {
                  const faults = faultCounts[wp.code] || 0;
                  return (
                    <tr
                      key={wp.id}
                      className="clickable-row"
                      onClick={() => setDetailPoint(wp)}
                      title="Click row for details"
                    >
                      <td className="muted">{pageStart + i + 1}</td>
                      <td><strong>{wp.code}</strong></td>
                      <td>{wp.location}</td>
                      <td className="mono muted">
                        {wp.latitude && wp.longitude
                          ? `${wp.latitude}, ${wp.longitude}`
                          : <span className="wp-no-coords">No coordinates</span>}
                      </td>
                      <td>
                        <span className={`status-badge ${faults > 0 ? 'wp-status-fault' : 'wp-status-clear'}`}>
                          {faults > 0 ? `${faults} FAULT${faults > 1 ? 'S' : ''}` : 'CLEAR'}
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

        {!loading && filteredPoints.length > 0 && (
          <footer className="wp-table-footer">
            <span>
              Showing {pageStart + 1} to {Math.min(pageStart + PAGE_SIZE, filteredPoints.length)} of{' '}
              {filteredPoints.length} water point{filteredPoints.length === 1 ? '' : 's'}
            </span>
            <nav className="wp-pagination" aria-label="Table pagination">
              <button
                type="button"
                className="wp-page-btn"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`wp-page-btn wp-page-num${n === safePage ? ' active' : ''}`}
                  onClick={() => setPage(n)}
                  aria-current={n === safePage ? 'page' : undefined}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="wp-page-btn"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </nav>
          </footer>
        )}
      </section>

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
          pointReports={pointReports}
          faultCount={faultCounts[detailPoint.code] || 0}
          onClose={() => setDetailPoint(null)}
          onFlyToMap={flyToOnMap}
          onDelete={handleDelete}
          onViewReports={openReportsForPoint}
        />
      )}
    </div>
  );
};

export default WaterPoints;
