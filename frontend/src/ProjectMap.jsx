import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import GlobeHero from './GlobeHero';

import { API_BASE as API } from './apiConfig';

function formatRelativeTime(date) {
  if (!date) return '—';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

const ProjectMap = () => {
  const [waterPoints, setWaterPoints] = useState([]);
  const [reports, setReports] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showFaultsOnly, setShowFaultsOnly] = useState(false);
  const [viewMode, setViewMode] = useState('globe');
  const { user } = useAuth();
  const navigate = useNavigate();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  const fetchData = useCallback(async () => {
    try {
      const [wpRes, rRes, techRes] = await Promise.all([
        axios.get(`${API}/api/waterpoints/`, { headers: authHeader() }),
        axios.get(`${API}/api/reports/`, { headers: authHeader() }),
        axios.get(`${API}/api/technicians/`, { headers: authHeader() }),
      ]);
      setWaterPoints(wpRes.data);
      setReports(rRes.data);
      setTechnicians(techRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  const openFaultByCode = useMemo(() => {
    const map = {};
    reports
      .filter((r) => r.status !== 'RESOLVED')
      .forEach((r) => {
        const c = r.water_point_code;
        const prev = map[c];
        if (!prev) map[c] = r.status;
        else if (r.status === 'PENDING') map[c] = 'PENDING';
        else if (r.status === 'IN_PROGRESS' && prev !== 'PENDING') map[c] = 'IN_PROGRESS';
      });
    return map;
  }, [reports]);

  const { onlineCount, attentionCount, inProgressCount } = useMemo(() => {
    let online = 0;
    let attention = 0;
    let inProgress = 0;
    waterPoints.forEach((wp) => {
      const s = openFaultByCode[wp.code];
      if (s === 'PENDING') attention += 1;
      else if (s === 'IN_PROGRESS') inProgress += 1;
      else online += 1;
    });
    return { onlineCount: online, attentionCount: attention, inProgressCount: inProgress };
  }, [waterPoints, openFaultByCode]);

  const displayPoints = useMemo(() => {
    if (!showFaultsOnly) return waterPoints;
    return waterPoints.filter((wp) => openFaultByCode[wp.code]);
  }, [waterPoints, showFaultsOnly, openFaultByCode]);

  const displayReports = useMemo(() => {
    if (!showFaultsOnly) return reports;
    const codes = new Set(displayPoints.map((wp) => wp.code));
    return reports.filter((r) => codes.has(r.water_point_code));
  }, [reports, showFaultsOnly, displayPoints]);

  const liveTechnicians = technicians.filter((t) => t.is_available).length;

  const mapHint =
    viewMode === 'globe'
      ? 'Green globe rotating — click to open Zimbabwe map'
      : showFaultsOnly
        ? `Showing ${displayPoints.length} point${displayPoints.length === 1 ? '' : 's'} with open faults`
        : 'Click a marker to zoom in · colours show fault status';

  return (
    <div className="live-map-page">
      <header className="live-map-header">
        <div className="live-map-header-text">
          <h1>Live Map</h1>
          <p>
            Zimbabwe water points
            {lastUpdated && (
              <>
                {' '}
                · Updated {formatRelativeTime(lastUpdated)}
              </>
            )}
          </p>
        </div>
        <div className="live-map-stat-strip" aria-label="Map summary">
          <button type="button" className="live-map-stat-pill" onClick={() => navigate('/waterpoints')}>
            <span className="live-map-stat-pill-label">Total</span>
            <strong>{waterPoints.length}</strong>
          </button>
          <button
            type="button"
            className="live-map-stat-pill live-map-stat-pill--ok"
            onClick={() => navigate('/waterpoints?status=CLEAR')}
          >
            <span className="live-map-stat-pill-label">Online</span>
            <strong>{onlineCount}</strong>
          </button>
          <button
            type="button"
            className="live-map-stat-pill live-map-stat-pill--warn"
            onClick={() => navigate('/reports?status=PENDING')}
          >
            <span className="live-map-stat-pill-label">Faults</span>
            <strong>{attentionCount}</strong>
          </button>
          <button
            type="button"
            className="live-map-stat-pill live-map-stat-pill--muted"
            onClick={() => navigate('/reports?status=IN_PROGRESS')}
          >
            <span className="live-map-stat-pill-label">In progress</span>
            <strong>{inProgressCount}</strong>
          </button>
          <button
            type="button"
            className="live-map-stat-pill live-map-stat-pill--blue"
            onClick={() => navigate('/technicians?status=AVAILABLE')}
          >
            <span className="live-map-stat-pill-label">Techs</span>
            <strong>{liveTechnicians}</strong>
          </button>
        </div>
      </header>

      <div className="dashboard-map-card live-map-card">
        <div className="dashboard-map-head">
          <div>
            <h3>Water point overview</h3>
            <p>{mapHint}</p>
          </div>
          <div className="dashboard-map-filters">
            <button
              type="button"
              className={`btn-secondary btn-sm${showFaultsOnly ? ' live-map-filter-active' : ''}`}
              onClick={() => setShowFaultsOnly(true)}
            >
              Faults only
            </button>
            <button
              type="button"
              className={`btn-secondary btn-sm${!showFaultsOnly ? ' live-map-filter-active' : ''}`}
              onClick={() => setShowFaultsOnly(false)}
            >
              All points
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => navigate('/waterpoints')}
            >
              Manage points →
            </button>
          </div>
        </div>
        <div className="dashboard-map-body live-map-map-body">
          <GlobeHero
            waterPoints={displayPoints}
            reports={displayReports}
            loading={loading}
            initialMode="globe"
            flatMap={false}
            liveMapLayout
            showBackButton
            onModeChange={setViewMode}
          />
          {viewMode === 'globe' && (
            <div className="live-map-prompt" role="note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>
                Rotating globe — click to zoom into <em>Zimbabwe</em>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectMap;
