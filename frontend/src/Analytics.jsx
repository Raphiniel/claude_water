import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from './AuthContext';
import { API_BASE as API } from './apiConfig';
import { Icon } from './components/ui/icon';
import { PageLoader } from './components/ui/loader';

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

function dayKey(d) {
  return startOfDay(d).toISOString().slice(0, 10);
}

function formatShortDate(isoKey) {
  const d = new Date(`${isoKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function last7DayKeys() {
  const keys = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

function StatusDonut({ pending, inProgress, resolved, total, rate }) {
  if (!total) {
    return (
      <div className="analytics-donut-wrap">
        <div className="analytics-donut analytics-donut--empty" />
        <div className="analytics-donut-label">
          <strong>—</strong>
          <span>No reports</span>
        </div>
      </div>
    );
  }
  const pPct = (pending / total) * 100;
  const iPct = (inProgress / total) * 100;
  const rPct = (resolved / total) * 100;
  const g1 = pPct;
  const g2 = g1 + iPct;
  const gradient = `conic-gradient(
    #f59e0b 0% ${g1}%,
    #3b82f6 ${g1}% ${g2}%,
    #84cc16 ${g2}% 100%
  )`;

  return (
    <div className="analytics-donut-wrap">
      <div className="analytics-donut" style={{ background: gradient }} />
      <div className="analytics-donut-label">
        <strong>{rate}%</strong>
        <span>Resolved</span>
      </div>
    </div>
  );
}

const Analytics = () => {
  const [reports, setReports] = useState([]);
  const [waterPoints, setWaterPoints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
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
    } catch (err) {
      setFetchError(err.response?.data?.detail || 'Unable to load analytics. Try again shortly.');
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
    const open = pending + inProgress;
    const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;

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
      if (r.created_at) {
        const createdKey = dayKey(r.created_at);
        if (createdKey in createdByDay) createdByDay[createdKey] += 1;
      }
      const resolvedWhen = r.resolved_at || (r.status === 'RESOLVED' ? r.created_at : null);
      if (resolvedWhen) {
        const resolvedKey = dayKey(resolvedWhen);
        if (resolvedKey in resolvedByDay) resolvedByDay[resolvedKey] += 1;
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
    return <PageLoader label="Loading analytics…" />;
  }

  const hasReports = stats.total > 0;

  return (
    <div className="analytics-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Analytics</h2>
          <p className="page-subtitle">Operational overview across reports, faults, and field assets</p>
        </div>
        <button type="button" onClick={loadData} className="btn-secondary btn-sm analytics-refresh-btn">
          <Icon icon={RefreshCw} size="sm" />
          Refresh
        </button>
      </div>

      {fetchError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {fetchError}
        </div>
      )}

      <div className="analytics-kpi-row">
        <button type="button" className="analytics-kpi" onClick={() => navigate('/reports')}>
          <span className="analytics-kpi-label">Open reports</span>
          <strong>{stats.open}</strong>
          <small>Pending and in progress</small>
        </button>
        <button
          type="button"
          className="analytics-kpi"
          onClick={() => navigate('/reports?status=RESOLVED')}
        >
          <span className="analytics-kpi-label">Resolution rate</span>
          <strong>{stats.resolutionRate}%</strong>
          <small>
            {stats.resolved} of {stats.total} closed
          </small>
        </button>
        <button type="button" className="analytics-kpi" onClick={() => navigate('/waterpoints')}>
          <span className="analytics-kpi-label">Water points</span>
          <strong>{stats.wpCount}</strong>
          <small>{stats.gpsPct}% with GPS</small>
        </button>
        <button
          type="button"
          className="analytics-kpi"
          onClick={() => navigate('/technicians?status=AVAILABLE')}
        >
          <span className="analytics-kpi-label">Technicians ready</span>
          <strong>{stats.availableTechs}</strong>
          <small>Of {stats.techCount} active</small>
        </button>
      </div>

      {!hasReports ? (
        <section className="glass-panel analytics-empty">
          <h3>No report data yet</h3>
          <p>When faults are logged via SMS or the portal, trends and breakdowns will appear here.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/reports')}>
            View reports
          </button>
        </section>
      ) : (
        <div className="analytics-grid">
          <section className="glass-panel analytics-panel analytics-panel--chart">
            <div className="analytics-panel-head">
              <h3>Last 7 days</h3>
              <div className="analytics-legend analytics-legend--inline">
                <span>
                  <i className="analytics-legend-dot analytics-legend-dot--created" />
                  New
                </span>
                <span>
                  <i className="analytics-legend-dot analytics-legend-dot--resolved" />
                  Resolved
                </span>
              </div>
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

          <section className="glass-panel analytics-panel">
            <div className="analytics-panel-head">
              <h3>Report status</h3>
            </div>
            <div className="analytics-status-layout">
              <StatusDonut
                pending={stats.pending}
                inProgress={stats.inProgress}
                resolved={stats.resolved}
                total={stats.total}
                rate={stats.resolutionRate}
              />
              <ul className="analytics-status-legend">
                <li>
                  <span className="analytics-status-swatch analytics-status-swatch--pending" />
                  Pending
                  <strong>{stats.pending}</strong>
                </li>
                <li>
                  <span className="analytics-status-swatch analytics-status-swatch--progress" />
                  In progress
                  <strong>{stats.inProgress}</strong>
                </li>
                <li>
                  <span className="analytics-status-swatch analytics-status-swatch--resolved" />
                  Resolved
                  <strong>{stats.resolved}</strong>
                </li>
              </ul>
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
            <div className="analytics-status-actions">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => navigate('/reports?status=PENDING')}
              >
                Pending queue
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => navigate('/reports?status=IN_PROGRESS')}
              >
                In progress
              </button>
            </div>
          </section>

          <section className="glass-panel analytics-panel">
            <div className="analytics-panel-head">
              <h3>Fault types</h3>
            </div>
            {stats.faultData.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No categories recorded.</p>
            ) : (
              <ul className="analytics-fault-list">
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

          <section className="glass-panel analytics-panel">
            <div className="analytics-panel-head">
              <h3>Infrastructure</h3>
            </div>
            <div className="analytics-infra-grid">
              <button type="button" className="analytics-infra-tile" onClick={() => navigate('/waterpoints')}>
                <span>Water points</span>
                <strong>{stats.wpCount}</strong>
              </button>
              <button
                type="button"
                className="analytics-infra-tile"
                onClick={() => navigate('/waterpoints?status=NO_GPS')}
              >
                <span>GPS mapped</span>
                <strong>{stats.withGps}</strong>
              </button>
              <button type="button" className="analytics-infra-tile" onClick={() => navigate('/technicians')}>
                <span>Technicians</span>
                <strong>{stats.techCount}</strong>
              </button>
              <button
                type="button"
                className="analytics-infra-tile"
                onClick={() => navigate('/technicians?status=AVAILABLE')}
              >
                <span>Available now</span>
                <strong>{stats.availableTechs}</strong>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Analytics;
