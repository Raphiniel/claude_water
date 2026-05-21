import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_BASE as API, DOCS_URL } from './apiConfig';
import {
  Activity,
  Bell,
  ChevronDown,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  MessageSquare,
  PanelLeft,
  Search,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { Icon } from './components/ui/icon';
import { getModeMeta } from './systemMode';

const SIDEBAR_COLLAPSED_KEY = 'waterwise-sidebar-collapsed';

const FAULT_LABELS = {
  PUMP: 'Pump Failure',
  LEAK: 'Pipe Leak',
  DRY: 'Borehole Dry',
  CONTAM: 'Contamination',
  VANDAL: 'Vandalism',
  OTHER: 'Other',
};

const timeAgo = (dateInput) => {
  if (!dateInput) return 'Just now';
  const then = new Date(dateInput).getTime();
  if (Number.isNaN(then)) return 'Just now';
  const diffSec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

const Layout = ({ children }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => {
    try {
      const raw = window.localStorage.getItem('dismissedNotificationIds');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const unreadCount = notifications.length;

  const clearAllNotifications = () => {
    setDismissedNotificationIds(prev => {
      const ids = [...new Set([...prev, ...notifications.map(n => n.id)])];
      window.localStorage.setItem('dismissedNotificationIds', JSON.stringify(ids));
      return ids;
    });
    setNotifications([]);
  };

  const dismissNotification = (notification) => {
    setDismissedNotificationIds(prev => {
      const ids = prev.includes(notification.id) ? prev : [...prev, notification.id];
      window.localStorage.setItem('dismissedNotificationIds', JSON.stringify(ids));
      return ids;
    });
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    setShowNotifications(false);
    navigate('/reports');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [systemSettings, setSystemSettings] = useState({
    mode: 'NORMAL',
    organization_name: 'WaterWise',
  });
  const searchRef = useRef(null);
  const systemModeMeta = getModeMeta(systemSettings.mode);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const searchItems = [
    { name: 'Dashboard overview', path: '/' },
    { name: 'Fault Reports & Alerts', path: '/reports' },
    { name: 'Water Points map', path: '/waterpoints' },
    { name: 'Technicians list', path: '/technicians' },
    { name: 'SMS Broadcast', path: '/sms' },
    { name: 'System Analytics', path: '/analytics' },
    { name: 'Settings', path: '/settings' },
    ...(user?.is_staff ? [{ name: 'User accounts (staff)', path: '/users' }] : []),
    { name: 'Help & documentation', path: '/help' },
    { name: 'Technician field portal (GPS / jobs)', path: '/field' },
  ];
  
  const filteredSearch = searchItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearch(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSystemSettings = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await axios.get(`${API}/api/settings/`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setSystemSettings((prev) => ({ ...prev, ...res.data }));
    } catch {
      /* non-blocking */
    }
  }, [user?.token]);

  useEffect(() => {
    fetchSystemSettings();
  }, [fetchSystemSettings]);

  useEffect(() => {
    const onSettingsUpdated = (e) => {
      if (e.detail) setSystemSettings((prev) => ({ ...prev, ...e.detail }));
      else fetchSystemSettings();
    };
    const onSidebarPref = (e) => {
      if (typeof e.detail?.collapsed === 'boolean') {
        setSidebarCollapsed(e.detail.collapsed);
      }
    };
    window.addEventListener('waterwise-settings-updated', onSettingsUpdated);
    window.addEventListener('waterwise-sidebar-pref', onSidebarPref);
    return () => {
      window.removeEventListener('waterwise-settings-updated', onSettingsUpdated);
      window.removeEventListener('waterwise-sidebar-pref', onSidebarPref);
    };
  }, [fetchSystemSettings]);

  const fetchLiveNotifications = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await axios.get(`${API}/api/reports/`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      const nextNotifications = sorted
        .slice(0, 20)
        .map((report) => {
          const status = report.status || 'PENDING';
          const type = status === 'PENDING' ? 'critical' : status === 'RESOLVED' ? 'success' : 'info';
          return {
            id: `report-${report.id}`,
            type,
            time: timeAgo(report.created_at),
            text:
              status === 'RESOLVED'
                ? `${report.water_point_code || 'Unknown point'} resolved`
                : `${FAULT_LABELS[report.fault_code] || report.fault_code || 'Fault'} at ${report.water_point_code || 'Unknown point'}`,
          };
        })
        .filter((item) => !dismissedNotificationIds.includes(item.id));
      setNotifications(nextNotifications);
    } catch {
      // Notification failures should not block dashboard usage.
    }
  }, [dismissedNotificationIds, user?.token]);

  useEffect(() => {
    fetchLiveNotifications();
    const t = setInterval(fetchLiveNotifications, 15000);
    return () => clearInterval(t);
  }, [fetchLiveNotifications]);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <Icon icon={LayoutDashboard} size="lg" />, end: true },
    { to: '/map', label: 'Live Map', icon: <Icon icon={Map} size="lg" /> },
    { to: '/reports', label: 'Reports', icon: <Icon icon={FileText} size="lg" /> },
    { to: '/waterpoints', label: 'Water Points', icon: <Icon icon={MapPin} size="lg" /> },
    { to: '/technicians', label: 'Technicians', icon: <Icon icon={Users} size="lg" /> },
    { to: '/sms', label: 'SMS Alerts', icon: <Icon icon={MessageSquare} size="lg" /> },
    { to: '/analytics', label: 'Analytics', icon: <Icon icon={Activity} size="lg" /> },
    { to: '/settings', label: 'Settings', icon: <Icon icon={Settings} size="lg" /> },
    ...(user?.is_staff ? [{ to: '/users', label: 'User accounts', icon: <Icon icon={Users} size="lg" /> }] : []),
  ];

  return (
    <div className="app-layout">
      <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-logos">
            <img
              className="sidebar-brand-wordmark"
              src="/logo-wordmark.svg"
              alt="WaterWise"
              width={132}
              height={26}
              decoding="async"
            />
            <img
              className="sidebar-brand-mark"
              src="/logo-mark.svg"
              alt="WaterWise"
              width={32}
              height={32}
              decoding="async"
            />
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon icon={PanelLeft} size="lg" />
          </button>
        </div>

        <div className="sidebar-scroll">
          <nav className="sidebar-nav">
            <p className="nav-section-label">NAVIGATION</p>
            {navItems.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={sidebarCollapsed ? label : undefined}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-link-icon">{icon}</span>
                <span className="sidebar-nav-label">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-system-wrap">
            <p className="nav-section-label">SYSTEM</p>
            <div className="sidebar-system-card">
              <h4>{systemSettings.organization_name || 'WaterWise'}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: systemModeMeta.dot,
                    flexShrink: 0,
                  }}
                />
                <span className="sidebar-status-ok">{systemModeMeta.statusLabel}</span>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#888', margin: 0, lineHeight: 1.35 }}>
                {systemModeMeta.statusDetail}
              </p>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          {DOCS_URL && /^https?:\/\//i.test(DOCS_URL) ? (
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link sidebar-docs-link"
              title={sidebarCollapsed ? 'Need help? View documentation' : undefined}
              style={{ marginBottom: '0.5rem', textAlign: 'left' }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'rgba(163,230,53,0.08)',
                  border: '1px solid rgba(163,230,53,0.35)',
                  color: '#a3e635',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '4px',
                  flexShrink: 0,
                }}
              >
                <Icon icon={HelpCircle} size="lg" />
              </div>
              <div className="sidebar-collapsible-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                <span className="sidebar-help-title">Need help?</span>
                <span className="sidebar-docs-sub" style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                  View documentation
                </span>
              </div>
            </a>
          ) : (
            <NavLink
              to="/help"
              title={sidebarCollapsed ? 'Need help? View documentation' : undefined}
              className={() => 'nav-link sidebar-docs-link'}
              style={{ marginBottom: '0.5rem', textAlign: 'left' }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'rgba(163,230,53,0.08)',
                  border: '1px solid rgba(163,230,53,0.35)',
                  color: '#a3e635',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '4px',
                  flexShrink: 0,
                }}
              >
                <Icon icon={HelpCircle} size="lg" />
              </div>
              <div className="sidebar-collapsible-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                <span className="sidebar-help-title">Need help?</span>
                <span className="sidebar-docs-sub" style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                  View documentation
                </span>
              </div>
            </NavLink>
          )}
          
          <button
            type="button"
            onClick={logout}
            className="nav-link logout-btn"
            title={sidebarCollapsed ? 'Logout' : undefined}
            style={{ color: '#888' }}
          >
            <span className="nav-link-icon"><Icon icon={LogOut} size="lg" /></span>
            <span className="sidebar-nav-label">Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-navbar">
          <div className="search-bar" ref={searchRef} style={{ position: 'relative' }}>
            <Icon icon={Search} size="md" />
            <input 
              type="text" 
              placeholder="Search resources, users, reports..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearch(true);
              }}
              onFocus={() => setShowSearch(true)}
            />
            <div className="search-kbd">⌘ K</div>
            
            {showSearch && searchQuery.trim() !== '' && (
              <div className="dropdown-menu" style={{ top: '100%', left: 0, width: '100%', minWidth: '300px', marginTop: '0.5rem' }}>
                <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search Results</div>
                {filteredSearch.length === 0 ? (
                  <div style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#888' }}>No results found for "{searchQuery}"</div>
                ) : (
                  filteredSearch.map(item => (
                    <button 
                      key={item.path} 
                      className="dropdown-item" 
                      onClick={() => {
                        navigate(item.path);
                        setShowSearch(false);
                        setSearchQuery('');
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      {item.name}
                      <span style={{ fontSize: '0.7rem', color: '#666' }}>{item.path}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="top-actions">
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotifications(!showNotifications)}>
                 <Icon icon={Bell} size="lg" />
                 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
              </button>
              
              {showNotifications && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowNotifications(false)} />
                  <div className="dropdown-menu" style={{ right: 0, left: 'auto', width: '320px', padding: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--card-border)' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={clearAllNotifications} style={{ background: 'transparent', border: 'none', color: '#a3e635', fontSize: '0.75rem', cursor: 'pointer' }}>Clear all</button>
                      )}
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>No notifications</div>
                      ) : (
                        notifications.map(n => (
                          <button key={n.id} onClick={() => dismissNotification(n)} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', border: 'none', borderBottom: '1px solid var(--card-border)', display: 'flex', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.type === 'critical' ? '#ef4444' : n.type === 'success' ? '#10b981' : '#3b82f6', marginTop: '6px', flexShrink: 0 }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '0.85rem', color: '#fff', lineHeight: 1.3 }}>{n.text}</span>
                              <span style={{ fontSize: '0.7rem', color: '#888' }}>{n.time}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <button style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: 'none', borderTop: '1px solid var(--card-border)', color: '#888', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setShowNotifications(false)}>
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="divider-vert" />
            <div style={{ position: 'relative' }}>
              <div className="user-profile-menu" onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ cursor: 'pointer', padding: '0.25rem' }}>
                <div className="user-avatar-small">
                  {user?.username?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="user-meta">
                  <span className="user-name">{user?.username || 'Signed in'}</span>
                  <span className="user-role">
                    {user?.is_superuser
                      ? 'Superuser'
                      : user?.role === 'community_leader'
                        ? 'Community leader'
                        : user?.role === 'technician'
                          ? 'Technician'
                          : user?.role === 'admin'
                            ? 'Admin'
                            : user?.is_staff
                              ? 'Staff'
                              : 'User'}
                  </span>
                </div>
                <Icon icon={ChevronDown} size="sm" />
              </div>

              {showProfileMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowProfileMenu(false)} />
                  <div className="dropdown-menu" style={{ right: 0, left: 'auto', width: '220px', padding: '0.5rem', marginTop: '0.5rem' }}>
                    <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--card-border)', marginBottom: '0.5rem' }}>
                      <span style={{ display: 'block', fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{user?.username || 'Administrator'}</span>
                      <span style={{ display: 'block', color: '#888', fontSize: '0.75rem' }}>
                        {user?.email || '—'}
                      </span>
                    </div>
                    
                    <button className="dropdown-item" onClick={() => { setShowProfileMenu(false); navigate('/settings#profile'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Icon icon={Settings} size="sm" />
                      Settings
                    </button>
                    
                    <div style={{ height: '1px', background: 'var(--card-border)', margin: '0.5rem 0' }} />
                    
                    <button className="dropdown-item" onClick={() => { setShowProfileMenu(false); logout(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                      <Icon icon={LogOut} size="sm" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div
          className={`dashboard-scroll ${
            window.location.pathname === '/' || window.location.pathname === '/map'
              ? 'no-scroll'
              : ''
          }`}
        >
          {systemModeMeta.banner && (
            <div
              className={`system-mode-banner system-mode-banner--${systemModeMeta.banner.tone}`}
              role="status"
            >
              <strong>{systemModeMeta.banner.title}</strong>
              <span>{systemModeMeta.banner.body}</span>
              <button
                type="button"
                className="system-mode-banner-link"
                onClick={() => navigate('/settings#operations')}
              >
                Change mode
              </button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
