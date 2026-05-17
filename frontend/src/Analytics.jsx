import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { API_BASE as API } from './apiConfig';

const FAULT_LABELS = {
  PUMP: 'Pump Failure',
  LEAK: 'Pipe Leak',
  DRY: 'Borehole Dry',
  CONTAM: 'Contamination',
  VANDAL: 'Vandalism',
  OTHER: 'Other',
};

const FAULT_COLORS = {
  PUMP: '#ef4444',
  LEAK: '#3b82f6',
  DRY: '#f59e0b',
  CONTAM: '#a855f7',
  VANDAL: '#f97316',
  OTHER: '#94a3b8',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseList(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatRelativeTime(date) {
  if (!date) return '';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function last7DayKeys() {
  const keys = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(startOfDay(d).toISOString().slice(0, 10));
  }
  return keys;
}

function formatShortDate(isoKey) {
  const d = new Date(`${isoKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const Analytics = () => {
  const [reports, setReports] = useState([]);
  const [waterPoints, setWaterPoints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  const loadData = useCallback(async () => {
    if (!user?.token) {
      setLoading(false);
      return;
    }
    setFetchError(null);
    setLoading(true);
    try {
      const [rRes, wpRes, tRes] = await Promise.all([
        axios.get(`${API}/api/reports/`, { headers: authHeader() }),
        axios.get(`${API}/api/waterpoints/`, { headers: authHeader() }),
        axios.get(`${API}/api/technicians/`, { headers: authHeader() }),
      ]);
      setReports(parseList(rRes.data));
      setWaterPoints(parseList(wpRes.data));
      setTechnicians(parseList(tRes.data).filter((t) => t.is_active !== false));
      setLastUpdated(new Date());
    } catch (err) {
      setFetchError(err.response?.data?.detail || err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [authHeader, user?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => r.status === 'PENDING').length;
    const inProgress = reports.filter((r) => r.status === 'IN_PROGRESS').length;
    const resolved = reports.filter((r) => r.status === 'RESOLVED').length;
    const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;
    const open = pending + inProgress;

    const faultCounts = reports.reduce((acc, r) => {
      const code = r.fault_code || 'OTHER';
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});
    const faultData = Object.entries(faultCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const maxFault = faultData.length ? Math.max(...faultData.map((d) => d[1])) : 1;

    const dayKeys = last7DayKeys();
    const createdByDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    const resolvedByDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));

    reports.forEach((r) => {
      if (!r.created_at) return;
      const createdKey = startOfDay(r.created_at).toISOString().slice(0, 10);
      if (createdKey in createdByDay) createdByDay[createdKey] += 1;
      if (r.status === 'RESOLVED' && createdKey in resolvedByDay) {
        resolvedByDay[createdKey] += 1;
      }
    });

    const weeklyTrend = dayKeys.map((key) => ({
      key,
      label: DAY_LABELS[new Date(`${key}T12:00:00`).getDay()],
      dateLabel: formatShortDate(key),
      created: createdByDay[key],
      resolved: resolvedByDay[key],
    }));
    const trendMax = Math.max(1, ...weeklyTrend.map((d) => Math.max(d.created, d.resolved)));

    const availableTechs = technicians.filter((t) => t.is_available).length;
    const withGps = waterPoints.filter((wp) => wp.latitude && wp.longitude).length;
    const gpsPct = waterPoints.length ? Math.round((withGps / waterPoints.length) * 100) : 0;

    return {
      total,
      pending,
      inProgress,
      resolved,
      open,
      resolutionRate,
      faultData,
      maxFault,
      weeklyTrend,
      trendMax,
      availableTechs,
      techCount: technicians.length,
      wpCount: waterPoints.length,
      withGps,
      gpsPct,
    };
  }, [reports, waterPoints, technicians]);

  if (loading) {
    return <div className="loading">Loading analytics…</div>;
  }

  const hasData = stats.total > 0;

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Analytics</h2>
          <p className="page-subtitle">
            Reports, faults, and field coverage from live data
            {lastUpdated ? ` · Updated ${formatRelativeTime(lastUpdated)}` : ''}
          </p>
        </div>
        <button type="button" onClick={loadData} className="btn-secondary btn-sm">
          Refresh
        </button>
      </div>

      {fetchError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {fetchError}
        </div>
      )}

      <div className="settings-sections">
        <section className="glass-panel settings-section">
          <h3 className="settings-section-title">Overview</h3>
          <p className="settings-section-desc">Click a card to open the filtered list.</p>
          <div className="reports-summary-cards analytics-kpi-cards">
            <button type="button" className="reports-filter-card" onClick={() => navigate('/reports')}>
              <span className="reports-filter-card-head">
                <span className="dashboard-kpi-dot purple" aria-hidden />
                Total reports
              </span>
              <strong>{stats.total}</strong>
              <small>Full queue</small>
            </button>
            <button type="button" className="reports-filter-card" onClick={() => navigate('/reports?status=PENDING')}>
              <span className="reports-filter-card-head">
                <span className="dashboard-kpi-dot amber" aria-hidden />
                Pending
              </span>
              <strong>{stats.pending}</strong>
              <small>Awaiting assignment</small>
            </button>
            <button type="button" className="reports-filter-card" onClick={() => navigate('/reports?status=IN_PROGRESS')}>
              <span className="reports-filter-card-head">
                <span className="dashboard-kpi-dot blue" aria-hidden />
                In progress
              </span>
              <strong>{stats.inProgress}</strong>
              <small>Technician assigned</small>
            </button>
            <button type="button" className="reports-filter-card" onClick={() => navigate('/reports?status=RESOLVED')}>
              <span className="reports-filter-card-head">
                <span className="dashboard-kpi-dot green" aria-hidden />
                Resolved
              </span>
              <strong>{stats.resolved}</strong>
              <small>Closed tickets</small>
            </button>
            <button type="button" className="reports-filter-card" onClick={() => navigate('/reports?status=RESOLVED')}>
              <span className="reports-filter-card-head">
                <span className="dashboard-kpi-dot green" aria-hidden />
                Resolution rate
              </span>
              <strong>{stats.resolutionRate}%</strong>
              <small>Share resolved</small>
            </button>
            <button type="button" className="reports-filter-card" onClick={() => navigate('/reports')}>
              <span className="reports-filter-card-head">
                <span className="dashboard-kpi-dot red" aria-hidden />
                Open
              </span>
              <strong>{stats.open}</strong>
              <small>Pending + in progress</small>
            </button>
          </div>
        </section>

        {!hasData ? (
          <section className="glass-panel settings-section">
            <h3 className="settings-section-title">No data yet</h3>
            <p className="settings-section-desc">
              Fault reports from SMS and the portal will appear here once submitted.
            </p>
            <Link to="/reports" className="btn-primary" style={{ textDecoration: 'none', width: 'fit-content' }}>
              View reports
            </Link>
          </section>
        ) : (
          <>
            <section className="glass-panel settings-section">
              <h3 className="settings-section-title">Activity — last 7 days</h3>
              <p className="settings-section-desc">New reports vs resolved (by report date).</p>
              <div className="analytics-legend analytics-legend--inline" style={{ marginBottom: '0.75rem' }}>
                <span>
                  <i className="analytics-legend-dot analytics-legend-dot--created" />
                  New
                </span>
                <span>
                  <i className="analytics-legend-dot analytics-legend-dot--resolved" />
                  Resolved
                </span>
              </div>
              <div className="analytics-week-chart">
                {stats.weeklyTrend.map((day) => {
                  const createdH = Math.max(day.created ? 12 : 4, (day.created / stats.trendMax) * 100);
                  const resolvedH = Math.max(day.resolved ? 12 : 4, (day.resolved / stats.trendMax) * 100);
                  return (
                    <div
                      key={day.key}
                      className="analytics-week-col"
                      title={`${day.dateLabel}: ${day.created} new, ${day.resolved} resolved`}
                    >
                      <div className="analytics-week-bars">
                        <div
                          className="analytics-week-bar analytics-week-bar--created"
                          style={{ height: `${createdH}%` }}
                        />
                        <div
                          className="analytics-week-bar analytics-week-bar--resolved"
                          style={{ height: `${resolvedH}%` }}
                        />
                      </div>
                      <span className="analytics-week-label">{day.label}</span>
                      <span className="analytics-week-date">{day.dateLabel}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="glass-panel settings-section">
              <h3 className="settings-section-title">Resolution</h3>
              <p className="settings-section-desc">Share of reports marked resolved.</p>
              <div className="reports-summary-cards analytics-kpi-cards analytics-kpi-cards--compact">
                <button type="button" className="reports-filter-card" onClick={() => navigate('/reports?status=RESOLVED')}>
                  <span className="reports-filter-card-head">
                    <span className="dashboard-kpi-dot green" aria-hidden />
                    Resolution rate
                  </span>
                  <strong>{stats.resolutionRate}%</strong>
                  <small>Resolved share</small>
                </button>
                <button type="button" className="reports-filter-card" onClick={() => navigate('/reports?status=PENDING')}>
                  <span className="reports-filter-card-head">
                    <span className="dashboard-kpi-dot amber" aria-hidden />
                    Pending
                  </span>
                  <strong>{stats.pending}</strong>
                  <small>Awaiting work</small>
                </button>
                <button type="button" className="reports-filter-card" onClick={() => navigate('/reports?status=IN_PROGRESS')}>
                  <span className="reports-filter-card-head">
                    <span className="dashboard-kpi-dot blue" aria-hidden />
                    In progress
                  </span>
                  <strong>{stats.inProgress}</strong>
                  <small>Assigned</small>
                </button>
                <button type="button" className="reports-filter-card" onClick={() => navigate('/reports?status=RESOLVED')}>
                  <span className="reports-filter-card-head">
                    <span className="dashboard-kpi-dot green" aria-hidden />
                    Resolved
                  </span>
                  <strong>{stats.resolved}</strong>
                  <small>Closed</small>
                </button>
              </div>
              <div className="analytics-status-stack" aria-hidden>
                <div
                  className="analytics-status-seg analytics-status-seg--pending"
                  style={{ flex: stats.pending || 0.001 }}
                />
                <div
                  className="analytics-status-seg analytics-status-seg--progress"
                  style={{ flex: stats.inProgress || 0.001 }}
                />
                <div
                  className="analytics-status-seg analytics-status-seg--resolved"
                  style={{ flex: stats.resolved || 0.001 }}
                />
              </div>
            </section>

            <section className="glass-panel settings-section">
              <h3 className="settings-section-title">Fault breakdown</h3>
              <p className="settings-section-desc">Most common issue types across all reports.</p>
              {stats.faultData.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>No fault categories recorded yet.</p>
              ) : (
                <ul className="settings-info-list analytics-fault-list">
                  {stats.faultData.map(([code, count]) => {
                    const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <li key={code}>
                        <span className={`fault-badge fault-${code.toLowerCase()}`}>
                          {FAULT_LABELS[code] || code}
                        </span>
                        <div className="analytics-fault-row-meta">
                          <span>
                            {count} <span className="muted">({pct}%)</span>
                          </span>
                          <div className="analytics-bar-track">
                            <div
                              className="analytics-bar-fill"
                              style={{
                                width: `${(count / stats.maxFault) * 100}%`,
                                background: FAULT_COLORS[code] || FAULT_COLORS.OTHER,
                              }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="glass-panel settings-section">
              <h3 className="settings-section-title">Field coverage</h3>
              <p className="settings-section-desc">Water points and technicians in the system.</p>
              <div className="reports-summary-cards analytics-kpi-cards analytics-kpi-cards--compact">
                <button type="button" className="reports-filter-card" onClick={() => navigate('/waterpoints')}>
                  <span className="reports-filter-card-head">
                    <span className="dashboard-kpi-dot blue" aria-hidden />
                    Water points
                  </span>
                  <strong>{stats.wpCount}</strong>
                  <small>Registered</small>
                </button>
                <button type="button" className="reports-filter-card" onClick={() => navigate('/waterpoints?status=NO_GPS')}>
                  <span className="reports-filter-card-head">
                    <span className="dashboard-kpi-dot purple" aria-hidden />
                    GPS mapped
                  </span>
                  <strong>{stats.gpsPct}%</strong>
                  <small>{stats.withGps} with coordinates</small>
                </button>
                <button type="button" className="reports-filter-card" onClick={() => navigate('/technicians')}>
                  <span className="reports-filter-card-head">
                    <span className="dashboard-kpi-dot purple" aria-hidden />
                    Technicians
                  </span>
                  <strong>{stats.techCount}</strong>
                  <small>Active roster</small>
                </button>
                <button type="button" className="reports-filter-card" onClick={() => navigate('/technicians?status=AVAILABLE')}>
                  <span className="reports-filter-card-head">
                    <span className="dashboard-kpi-dot green" aria-hidden />
                    Available
                  </span>
                  <strong>{stats.availableTechs}</strong>
                  <small>Ready now</small>
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
