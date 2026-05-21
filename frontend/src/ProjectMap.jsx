import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import GlobeHero from './GlobeHero';

import { API_BASE as API } from './apiConfig';
import {
  AlertTriangle,
  Droplet,
  Info,
  RefreshCw,
  User,
  Wifi,
} from 'lucide-react';
import { Icon } from './components/ui/icon';

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

function pct(n, total) {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
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
  const total = waterPoints.length;

  const statCards = [
    {
      key: 'total',
      label: 'Total',
      value: total,
      sub: 'All points',
      icon: <Icon icon={Droplet} size="md" />,
      tone: 'default',
      onClick: () => navigate('/waterpoints'),
    },
    {
      key: 'online',
      label: 'Online',
      value: onlineCount,
      sub: pct(onlineCount, total),
      icon: <Icon icon={Wifi} size="md" />,
      tone: 'ok',
      onClick: () => navigate('/waterpoints?status=CLEAR'),
    },
    {
      key: 'faults',
      label: 'Faults',
      value: attentionCount,
      sub: pct(attentionCount, total),
      icon: <Icon icon={AlertTriangle} size="md" />,
      tone: 'warn',
      onClick: () => navigate('/reports?status=PENDING'),
    },
    {
      key: 'progress',
      label: 'In progress',
      value: inProgressCount,
      sub: pct(inProgressCount, total),
      icon: <Icon icon={RefreshCw} size="md" />,
      tone: 'blue',
      onClick: () => navigate('/reports?status=IN_PROGRESS'),
    },
    {
      key: 'techs',
      label: 'Techs',
      value: liveTechnicians,
      sub: 'Active',
      icon: <Icon icon={User} size="md" />,
      tone: 'muted',
      onClick: () => navigate('/technicians?status=AVAILABLE'),
    },
  ];

  return (
    <div className="live-map-page live-map-page--mockup">
      <header className="live-map-header">
        <div className="live-map-header-text">
          <h1>Live Map</h1>
          <p>
            Zimbabwe water points
            {lastUpdated && (
              <>
                {' · '}
                <span className="live-map-updated-accent">
                  Updated {formatRelativeTime(lastUpdated)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="live-map-kpi-strip" aria-label="Map summary">
          {statCards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`live-map-kpi-card live-map-kpi-card--${card.tone}`}
              onClick={card.onClick}
            >
              <span className="live-map-kpi-icon">{card.icon}</span>
              <span className="live-map-kpi-label">{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.sub}</small>
            </button>
          ))}
        </div>
      </header>

      <div className="live-map-frame">
        <div className="live-map-viewport">
          <aside className="live-map-about-card" aria-label="About this map">
            <h3>
              <Icon icon={Info} size="sm" />
              About this map
            </h3>
            <p>Real-time overview of water point status across Zimbabwe.</p>
            <ul className="live-map-about-legend">
              <li>
                <span className="live-map-legend-dot online" aria-hidden />
                Online &amp; operational
              </li>
              <li>
                <span className="live-map-legend-dot attention" aria-hidden />
                Faults detected
              </li>
              <li>
                <span className="live-map-legend-dot live-map-legend-dot--progress" aria-hidden />
                Maintenance in progress
              </li>
              <li>
                <span className="live-map-legend-dot live-map-legend-dot--tech" aria-hidden />
                Technicians active
              </li>
            </ul>
          </aside>

          <div className="live-map-map-toolbar dashboard-map-head">
            <div className="dashboard-map-filters live-map-filter-group">
              <button
                type="button"
                className={`live-map-filter-btn${showFaultsOnly ? ' live-map-filter-active' : ''}`}
                onClick={() => setShowFaultsOnly(true)}
              >
                Faults only
              </button>
              <button
                type="button"
                className={`live-map-filter-btn${!showFaultsOnly ? ' live-map-filter-active' : ''}`}
                onClick={() => setShowFaultsOnly(false)}
              >
                All points
              </button>
              <button
                type="button"
                className="live-map-filter-btn live-map-filter-btn--cta"
                onClick={() => navigate('/waterpoints')}
              >
                Manage points →
              </button>
            </div>
          </div>

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

          <div className="live-map-bottom-legend" role="list" aria-label="Map legend">
            <span className="live-map-legend-chip">
              <span className="live-map-legend-dot online" aria-hidden />
              Online
            </span>
            <span className="live-map-legend-chip">
              <span className="live-map-legend-dot attention" aria-hidden />
              Fault
            </span>
            <span className="live-map-legend-chip">
              <span className="live-map-legend-dot live-map-legend-dot--progress" aria-hidden />
              In progress
            </span>
            <span className="live-map-legend-chip">
              <span className="live-map-legend-dot live-map-legend-dot--tech" aria-hidden />
              Technician
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectMap;
