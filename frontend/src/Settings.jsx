import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_BASE } from './apiConfig';

const MODES = [
  {
    key: 'NORMAL',
    label: 'Normal',
    hint: 'Standard operations and reporting.',
  },
  {
    key: 'EMERGENCY',
    label: 'Emergency',
    hint: 'Prioritize urgent faults and alerts.',
  },
  {
    key: 'MAINTENANCE',
    label: 'Maintenance',
    hint: 'Planned work; reduce auto-assignments.',
  },
];

const DEFAULT_SETTINGS = {
  mode: 'NORMAL',
  organization_name: 'WaterWise',
  auto_assign_nearest: true,
  send_confirmation_sms: true,
  sms_gateway_configured: false,
  sms_provider_configured: false,
};

const Settings = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const { user, logout } = useAuth();

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
      setMessage({ type: 'error', text: 'Could not load settings.' });
    } finally {
      setLoading(false);
    }
  }, [authHeader, user?.token]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (patch) => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axios.post(`${API_BASE}/api/settings/`, patch, { headers: authHeader() });
      setSettings({ ...DEFAULT_SETTINGS, ...res.data });
      setMessage({ type: 'success', text: 'Settings saved.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
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

  if (loading) {
    return <div className="loading">Loading settings…</div>;
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">System behaviour, SMS, and your account</p>
        </div>
      </div>

      {message.text && (
        <div
          className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
          style={{ marginBottom: '1rem' }}
        >
          {message.text}
        </div>
      )}

      <div className="settings-sections">
        <section className="glass-panel settings-section">
          <h3 className="settings-section-title">System mode</h3>
          <p className="settings-section-desc">Operational state shown across the portal.</p>
          <div className="settings-mode-grid">
            {MODES.map((m) => (
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

        <section className="glass-panel settings-section">
          <h3 className="settings-section-title">General</h3>
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

            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={!!settings.auto_assign_nearest}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, auto_assign_nearest: e.target.checked }))
                }
              />
              <span>
                <strong>Auto-assign nearest technician</strong>
                <small>When a valid SMS report arrives, assign the closest available tech.</small>
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
                <small>Send Africa&apos;s Talking reply after a successful fault report.</small>
              </span>
            </label>

            <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 0 }}>
              {saving ? 'Saving…' : 'Save general settings'}
            </button>
          </form>
        </section>

        <section className="glass-panel settings-section">
          <h3 className="settings-section-title">Integrations</h3>
          <p className="settings-section-desc">Server configuration (read-only).</p>
          <ul className="settings-info-list">
            <li>
              <span>API URL</span>
              <code className="mono">{API_BASE}</code>
            </li>
            <li>
              <span>SMS gateway (APK)</span>
              <span className={settings.sms_gateway_configured ? 'settings-ok' : 'settings-warn'}>
                {settings.sms_gateway_configured ? 'Configured' : 'Not set on server'}
              </span>
            </li>
            <li>
              <span>SMS provider (Africa&apos;s Talking)</span>
              <span className={settings.sms_provider_configured ? 'settings-ok' : 'settings-warn'}>
                {settings.sms_provider_configured ? 'Configured' : 'Not set on server'}
              </span>
            </li>
            <li>
              <span>Inbound webhook</span>
              <code className="mono">{`${API_BASE}/api/sms/incoming/`}</code>
            </li>
          </ul>
          <p className="settings-section-desc" style={{ marginTop: '0.75rem' }}>
            Configure the mobile SMS relay app with the webhook URL and shared secret from your server
            environment.
          </p>
        </section>

        <section className="glass-panel settings-section">
          <h3 className="settings-section-title">Account</h3>
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
              />
            </div>
            <button type="submit" className="btn-secondary" disabled={passwordLoading}>
              {passwordLoading ? 'Updating…' : 'Change password'}
            </button>
          </form>

          {user?.is_staff && (
            <Link to="/users" className="btn-secondary btn-sm" style={{ marginTop: '1rem', textDecoration: 'none' }}>
              Manage user accounts
            </Link>
          )}
        </section>
      </div>
    </div>
  );
};

export default Settings;
