import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_BASE as API, DOCS_URL } from './apiConfig';

// Icons
const IconDashboard = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>;
const IconReports = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const IconWaterPoint = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>;
const IconTechnician = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconSettings = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const IconLogout = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>;
const IconSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const IconBell = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>;
const IconSms = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
const IconAnalytics = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;
const IconHelp = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
const IconUsers = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
const IconMap = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><map name="map"></map><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>;

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
  const searchRef = useRef(null);

  const searchItems = [
    { name: 'Dashboard overview', path: '/' },
    { name: 'Fault Reports & Alerts', path: '/reports' },
    { name: 'Water Points map', path: '/waterpoints' },
    { name: 'Technicians list', path: '/technicians' },
    { name: 'SMS Broadcast', path: '/sms' },
    { name: 'System Analytics', path: '/analytics' },
    { name: 'Settings & Users', path: '/settings' },
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
    { to: '/', label: 'Dashboard', icon: <IconDashboard />, end: true },
    { to: '/map', label: 'Live Map', icon: <IconMap /> },
    { to: '/reports', label: 'Reports', icon: <IconReports /> },
    { to: '/waterpoints', label: 'Water Points', icon: <IconWaterPoint /> },
    { to: '/technicians', label: 'Technicians', icon: <IconTechnician /> },
    { to: '/sms', label: 'SMS Alerts', icon: <IconSms /> },
    { to: '/analytics', label: 'Analytics', icon: <IconAnalytics /> },
    { to: '/settings', label: 'Settings', icon: <IconSettings /> },
    ...(user?.is_staff ? [{ to: '/users', label: 'User accounts', icon: <IconUsers /> }] : []),
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img
            className="sidebar-brand-wordmark"
            src="/logo-wordmark.svg"
            alt="WaterWise"
            width={132}
            height={26}
            decoding="async"
          />
        </div>

        <div className="sidebar-scroll">
          <nav className="sidebar-nav">
            <p className="nav-section-label">NAVIGATION</p>
            {navItems.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {icon}
                {label}
              </NavLink>
            ))}
          </nav>

          <div style={{ padding: '1rem' }}>
            <p className="nav-section-label" style={{ marginBottom: '0.75rem' }}>SYSTEM</p>
            <div className="sidebar-system-card">
              <h4 style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '0.25rem' }}>System Status</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>Operational</span>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#888' }}>All systems running smoothly</p>
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
                <IconHelp />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                <span style={{ color: '#a3e635', fontWeight: 600 }}>Need help?</span>
                <span className="sidebar-docs-sub" style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                  View documentation
                </span>
              </div>
            </a>
          ) : (
            <NavLink
              to="/help"
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
                <IconHelp />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                <span style={{ color: '#a3e635', fontWeight: 600 }}>Need help?</span>
                <span className="sidebar-docs-sub" style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                  View documentation
                </span>
              </div>
            </NavLink>
          )}
          
          <button onClick={logout} className="nav-link logout-btn" style={{ paddingLeft: '1.5rem', color: '#888' }}>
            <IconLogout />
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-navbar">
          <div className="search-bar" ref={searchRef} style={{ position: 'relative' }}>
            <IconSearch />
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
            <div className="last-updated">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Last updated: 2 min ago
            </div>
            <div className="divider-vert" />
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotifications(!showNotifications)}>
                 <IconBell />
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
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
                    
                    <button className="dropdown-item" onClick={() => { setShowProfileMenu(false); navigate('/settings'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      My Profile
                    </button>
                    
                    <button className="dropdown-item" onClick={() => { setShowProfileMenu(false); navigate('/settings'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <IconSettings />
                      Account Settings
                    </button>
                    
                    <div style={{ height: '1px', background: 'var(--card-border)', margin: '0.5rem 0' }} />
                    
                    <button className="dropdown-item" onClick={() => { setShowProfileMenu(false); logout(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                      <IconLogout />
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
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
