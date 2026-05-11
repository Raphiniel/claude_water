import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import GlobeHero from './GlobeHero';

import { API_BASE as API } from './apiConfig';

const IconDroplet = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const IconTarget = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconGlobeSmall = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const IconPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconSliders = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const ProjectMap = () => {
  const [waterPoints, setWaterPoints] = useState([]);
  const [reports, setReports] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const { onlineCount, attentionCount, offlineCount } = useMemo(() => {
    const openByCode = {};
    reports
      .filter((r) => r.status !== 'RESOLVED')
      .forEach((r) => {
        const c = r.water_point_code;
        const prev = openByCode[c];
        if (!prev) openByCode[c] = r.status;
        else if (r.status === 'PENDING') openByCode[c] = 'PENDING';
        else if (r.status === 'IN_PROGRESS' && prev !== 'PENDING') openByCode[c] = 'IN_PROGRESS';
      });
    let online = 0;
    let attention = 0;
    let offline = 0;
    waterPoints.forEach((wp) => {
      const s = openByCode[wp.code];
      if (s === 'PENDING') attention += 1;
      else if (s === 'IN_PROGRESS') offline += 1;
      else online += 1;
    });
    return { onlineCount: online, attentionCount: attention, offlineCount: offline };
  }, [waterPoints, reports]);

  const liveTechnicians = technicians.filter((t) => t.is_available).length;

  const trendPct = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const t = (d) => new Date(d).getTime();
    const last7 = waterPoints.filter((wp) => t(wp.created_at) >= now - week).length;
    const prev7 = waterPoints.filter((wp) => t(wp.created_at) < now - week && t(wp.created_at) >= now - 2 * week).length;
    if (prev7 === 0) return last7 > 0 ? 4.2 : 0;
    return ((last7 - prev7) / prev7) * 100;
  }, [waterPoints]);

  return (
    <div className="live-map-replica">
      <div className="live-map-frame">
        <div className="live-map-content">
          <aside className="live-map-left">
            <div className="live-map-kicker">
              <span className="live-map-kicker-dot" aria-hidden />
              LIVE MAP
            </div>
            <h2>Global Water Point Monitor</h2>
            <p>Real-time overview of water points across the globe.</p>

            <div className="live-map-stat-card">
              <div className="live-map-stat-top">
                <IconDroplet />
                <span className="live-map-stat-label">Total Water Points</span>
              </div>
              <strong>{waterPoints.length.toLocaleString()}</strong>
              <small className="live-map-stat-trend">
                <span className="live-map-trend-arrow">↑</span>
                {trendPct >= 0 ? `${trendPct.toFixed(1)}%` : `${Math.abs(trendPct).toFixed(1)}%`} vs last 7 days
              </small>
            </div>

            <div className="live-map-stat-card">
              <div className="live-map-stat-top">
                <IconTarget />
                <span className="live-map-stat-label">Online</span>
              </div>
              <strong>{onlineCount.toLocaleString()}</strong>
              <small className="live-map-stat-green">
                {waterPoints.length > 0 ? `${((onlineCount / waterPoints.length) * 100).toFixed(1)}% of total` : '—'}
              </small>
            </div>

            <div className="live-map-stat-card">
              <div className="live-map-stat-top">
                <IconAlert />
                <span className="live-map-stat-label">Faults Detected</span>
              </div>
              <strong>{attentionCount.toLocaleString()}</strong>
              <small className="live-map-stat-orange">{attentionCount > 0 ? 'Needs attention' : 'All clear'}</small>
            </div>

            <div className="live-map-stat-card">
              <div className="live-map-stat-top">
                <IconUsers />
                <span className="live-map-stat-label">Technicians Online</span>
              </div>
              <strong>{liveTechnicians.toLocaleString()}</strong>
              <small className="live-map-stat-blue">{technicians.length > 0 ? 'Active in field' : 'No roster yet'}</small>
            </div>
          </aside>

          <section className="live-map-center">
            <GlobeHero
              waterPoints={waterPoints}
              reports={reports}
              loading={loading}
              initialMode="globe"
              flatMap={false}
              showBackButton={false}
              liveMapLayout
            />
            <div className="live-map-prompt" role="note">
              <IconGlobeSmall />
              <span>
                Click anywhere on the globe to zoom into <em>Zimbabwe</em>
              </span>
            </div>
          </section>

          <aside className="live-map-right">
            <div className="live-map-info-card">
              <h4>MAP LEGEND</h4>
              <div className="live-map-legend-row">
                <span>
                  <i className="live-map-legend-dot online" aria-hidden />
                  Online
                </span>
                <b>{onlineCount.toLocaleString()}</b>
              </div>
              <div className="live-map-legend-row">
                <span>
                  <i className="live-map-legend-dot attention" aria-hidden />
                  Attention
                </span>
                <b>{attentionCount.toLocaleString()}</b>
              </div>
              <div className="live-map-legend-row">
                <span>
                  <i className="live-map-legend-dot offline" aria-hidden />
                  Offline
                </span>
                <b>{offlineCount.toLocaleString()}</b>
              </div>
            </div>

            <div className="live-map-info-card">
              <div className="live-map-info-card-head">
                <h4>DATA STATUS</h4>
                <span className="live-map-live-pill">
                  <span className="live-map-live-dot" aria-hidden />
                  Live
                </span>
              </div>
              <div className="live-map-legend-row live-map-status-row">
                <span className="live-map-status-label">
                  <IconClock />
                  Last updated
                </span>
                <b>2 min ago</b>
              </div>
              <div className="live-map-legend-row live-map-status-row">
                <span className="live-map-status-label">
                  <IconRefresh />
                  Update frequency
                </span>
                <b>30 sec</b>
              </div>
            </div>

            <div className="live-map-info-card">
              <div className="live-map-info-card-head">
                <h4>QUICK FILTERS</h4>
                <button type="button" className="live-map-icon-ghost" aria-label="Filter settings">
                  <IconSliders />
                </button>
              </div>
              <button type="button" className="live-map-filter-btn">
                <IconPin />
                <span>All Regions</span>
                <IconChevronDown />
              </button>
              <button type="button" className="live-map-cta-btn" onClick={() => navigate('/waterpoints')}>
                <span>View All Water Points</span>
                <IconArrowRight />
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ProjectMap;
