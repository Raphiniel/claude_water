import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Building2,
  KeyRound,
  MessageSquare,
  Plug,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { getPublicApiLabel, getSmsWebhookUrl } from './apiConfig';
import { Icon } from './components/ui/icon';
import { getModeMeta, SYSTEM_MODES } from './systemMode';
import { PageLoader } from './components/ui/loader';

const SIDEBAR_COLLAPSED_KEY = 'waterwise-sidebar-collapsed';

const ROLE_LABELS = {
  superuser: 'Superuser',
  admin: 'Admin',
  community_leader: 'Community leader',
  technician: 'Technician',
};

const DEFAULT_SETTINGS = {
  mode: 'NORMAL',
  organization_name: 'WaterWise',
  auto_assign_nearest: true,
  send_confirmation_sms: true,
  sms_gateway_configured: false,
  sms_provider_configured: false,
  last_updated: null,
};

const formatWhen = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
};

const Settings = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const { user, logout } = useAuth();
  const isStaff = !!user?.is_staff;
  const canConfigureGateway = !!user?.can_configure_sms_gateway;
  const modeMeta = getModeMeta(settings.mode);

  const authHeader = useCallback(
    () => ({ Authorization: `Bearer ${user.token}` }),
    [user.token]
  );

  const loadSettings = useCallback(async () => {
    if (!user?.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/settings/`, { headers: authHeader() });
      setSettings({ ...DEFAULT_SETTINGS, ...res.data });
    } catch (err) {
      console.error('Failed to fetch settings', err);
      setMessage({ type: 'error', text: 'Could not load system settings.' });
    } finally {
      setLoading(false);
    }
  }, [authHeader, user?.token]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (patch) => {
    if (!isStaff) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axios.post(`${API_BASE}/api/settings/`, patch, { headers: authHeader() });
      setSettings({ ...DEFAULT_SETTINGS, ...res.data });
      setMessage({ type: 'success', text: 'Settings saved.' });
      window.dispatchEvent(new CustomEvent('waterwise-settings-updated', { detail: res.data }));
    } catch (err) {
      const detail = err.response?.data?.detail;
      setMessage({
        type: 'error',
        text: detail || 'Failed to save settings. Staff access may be required.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (mode) => {
    setSettings((s) => ({ ...s, mode }));
    saveSettings({ mode });
  };

  const handleGeneralSave = (e) => {
    e.preventDefault();
    saveSettings({
      organization_name: settings.organization_name?.trim() || 'WaterWise',
      auto_assign_nearest: settings.auto_assign_nearest,
      send_confirmation_sms: settings.send_confirmation_sms,
    });
  };

  const handleSidebarPref = (collapsed) => {
    setSidebarCollapsed(collapsed);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent('waterwise-sidebar-pref', { detail: { collapsed } })
    );
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setPasswordLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.post(
        `${API_BASE}/api/password-change/`,
        { old_password: oldPassword, new_password: newPassword },
        { headers: authHeader() }
      );
      setMessage({ type: 'success', text: 'Password updated. Signing out…' });
      setTimeout(() => logout(), 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.old_password?.[0] || 'Failed to change password.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setPasswordLoading(false);
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: 'success', text: 'Copied to clipboard.' });
    } catch {
      setMessage({ type: 'error', text: 'Could not copy — select and copy manually.' });
    }
  };

  if (loading) {
    return <PageLoader label="Loading settings…" />;
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">
            {isStaff
              ? `Manage ${settings.organization_name || 'WaterWise'}, SMS behaviour, and your account`
              : 'Your account and portal preferences'}
          </p>
        </div>
        {isStaff && settings.last_updated && (
          <p className="settings-last-saved muted">
            System settings saved {formatWhen(settings.last_updated)}
          </p>
        )}
      </div>

      {message.text && (
        <div
          className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
          style={{ marginBottom: '1rem' }}
        >
          {message.text}
        </div>
      )}

      <div className="settings-layout">
        <section id="profile" className="glass-panel settings-section">
          <div className="settings-section-head">
            <Icon icon={Shield} size="lg" className="settings-section-icon" />
            <div>
              <h3 className="settings-section-title">Your account</h3>
              <p className="settings-section-desc">Signed-in user on this portal (from the API).</p>
            </div>
          </div>
          <dl className="settings-profile-grid">
            <div>
              <dt>Username</dt>
              <dd>{user?.username || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email || '—'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                <span className="settings-role-pill">
                  {ROLE_LABELS[user?.role] || user?.role || '—'}
                </span>
              </dd>
            </div>
            {canConfigureGateway && (
              <div>
                <dt>SMS relay handset</dt>
                <dd className="settings-ok">Can configure APK</dd>
              </div>
            )}
          </dl>
        </section>

        <section id="appearance" className="glass-panel settings-section">
          <div className="settings-section-head">
            <Icon icon={SlidersHorizontal} size="lg" className="settings-section-icon" />
            <div>
              <h3 className="settings-section-title">Appearance</h3>
              <p className="settings-section-desc">Preferences saved in this browser only.</p>
            </div>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={sidebarCollapsed}
              onChange={(e) => handleSidebarPref(e.target.checked)}
            />
            <span>
              <strong>Collapsed sidebar</strong>
              <small>Start with the navigation rail minimized (applies immediately).</small>
            </span>
          </label>
        </section>

        <section id="password" className="glass-panel settings-section">
          <div className="settings-section-head">
            <Icon icon={KeyRound} size="lg" className="settings-section-icon" />
            <div>
              <h3 className="settings-section-title">Password</h3>
              <p className="settings-section-desc">
                You will be signed out after a successful change.
              </p>
            </div>
          </div>
          <form onSubmit={handlePasswordChange} className="settings-form">
            <div className="form-group">
              <label htmlFor="old-pw">Current password</label>
              <input
                id="old-pw"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-pw">New password</label>
              <input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-pw">Confirm new password</label>
              <input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <button type="submit" className="btn-secondary" disabled={passwordLoading}>
              {passwordLoading ? 'Updating…' : 'Change password'}
            </button>
          </form>
        </section>

        {isStaff && (
          <>
            <section id="organization" className="glass-panel settings-section">
              <div className="settings-section-head">
                <Icon icon={Building2} size="lg" className="settings-section-icon" />
                <div>
                  <h3 className="settings-section-title">Organization</h3>
                  <p className="settings-section-desc">
                    Display name used in this portal and shown in the sidebar status card.
                  </p>
                </div>
              </div>
              <form onSubmit={handleGeneralSave} className="settings-form">
                <div className="form-group">
                  <label htmlFor="org-name">Organization name</label>
                  <input
                    id="org-name"
                    value={settings.organization_name || ''}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, organization_name: e.target.value }))
                    }
                    placeholder="WaterWise"
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save organization name'}
                </button>
              </form>
            </section>

            <section id="operations" className="glass-panel settings-section">
              <div className="settings-section-head">
                <Icon icon={Shield} size="lg" className="settings-section-icon" />
                <div>
                  <h3 className="settings-section-title">Operational mode</h3>
                  <p className="settings-section-desc">
                    Currently <strong>{modeMeta.statusLabel}</strong> — {modeMeta.statusDetail}
                  </p>
                </div>
              </div>
              <div className="settings-mode-grid">
                {Object.values(SYSTEM_MODES).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`settings-mode-btn ${settings.mode === m.key ? 'active' : ''}`}
                    onClick={() => handleModeChange(m.key)}
                    disabled={saving}
                  >
                    <span className="settings-mode-label">{m.label}</span>
                    <span className="settings-mode-hint">{m.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <section id="sms" className="glass-panel settings-section">
              <div className="settings-section-head">
                <Icon icon={MessageSquare} size="lg" className="settings-section-icon" />
                <div>
                  <h3 className="settings-section-title">SMS &amp; fault handling</h3>
                  <p className="settings-section-desc">
                    Controls how inbound SMS reports are processed on the server.
                  </p>
                </div>
              </div>
              <form onSubmit={handleGeneralSave} className="settings-form">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={!!settings.auto_assign_nearest}
                    disabled={settings.mode === 'MAINTENANCE'}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, auto_assign_nearest: e.target.checked }))
                    }
                  />
                  <span>
                    <strong>Auto-assign nearest technician</strong>
                    <small>
                      When a valid SMS report arrives, assign the closest available technician and
                      mark the ticket in progress.
                      {settings.mode === 'MAINTENANCE' && (
                        <> Disabled while maintenance mode is on.</>
                      )}
                    </small>
                  </span>
                </label>

                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={!!settings.send_confirmation_sms}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, send_confirmation_sms: e.target.checked }))
                    }
                  />
                  <span>
                    <strong>Confirmation SMS to reporters</strong>
                    <small>
                      Send an Africa&apos;s Talking reply after a successful fault report (when the
                      provider is configured).
                    </small>
                  </span>
                </label>

                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save SMS & organization settings'}
                </button>
              </form>
            </section>

            <section id="integrations" className="glass-panel settings-section">
              <div className="settings-section-head">
                <Icon icon={Plug} size="lg" className="settings-section-icon" />
                <div>
                  <h3 className="settings-section-title">Integrations</h3>
                  <p className="settings-section-desc">
                    Connection status for the WaterWise platform (managed on the server).
                  </p>
                </div>
              </div>
              <ul className="settings-info-list">
                <li>
                  <span>API service</span>
                  <span className="settings-ok">{getPublicApiLabel()}</span>
                </li>
                <li>
                  <span>SMS gateway shared secret</span>
                  <span
                    className={
                      settings.sms_gateway_configured ? 'settings-ok' : 'settings-warn'
                    }
                  >
                    {settings.sms_gateway_configured ? 'Configured' : 'Not set'}
                  </span>
                </li>
                <li>
                  <span>SMS provider (Africa&apos;s Talking)</span>
                  <span
                    className={
                      settings.sms_provider_configured ? 'settings-ok' : 'settings-warn'
                    }
                  >
                    {settings.sms_provider_configured ? 'Configured' : 'Not set'}
                  </span>
                </li>
                <li>
                  <span>Inbound webhook</span>
                  <div className="settings-copy-row">
                    <code className="mono">{getSmsWebhookUrl()}</code>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => copyText(getSmsWebhookUrl())}
                    >
                      Copy
                    </button>
                  </div>
                </li>
              </ul>
              {(canConfigureGateway || isStaff) && (
                <p className="settings-section-desc" style={{ marginTop: '0.75rem' }}>
                  Install the SMS relay APK on a dedicated handset, enter the webhook URL and shared
                  secret, and keep the device online for inbound community SMS.
                  {!settings.sms_gateway_configured && (
                    <> Ask your administrator to enable the gateway shared secret on the server.</>
                  )}
                </p>
              )}
            </section>

            <section id="team" className="glass-panel settings-section">
              <div className="settings-section-head">
                <Icon icon={Users} size="lg" className="settings-section-icon" />
                <div>
                  <h3 className="settings-section-title">Team &amp; access</h3>
                  <p className="settings-section-desc">
                    Create portal and field accounts, assign roles, and manage the user list.
                  </p>
                </div>
              </div>
              <Link to="/users" className="btn-secondary" style={{ textDecoration: 'none' }}>
                Open user accounts
              </Link>
            </section>
          </>
        )}

        {!isStaff && (
          <p className="settings-staff-note muted">
            Organization, SMS, and operational settings are managed by staff administrators.
          </p>
        )}
      </div>
    </div>
  );
};

export default Settings;
