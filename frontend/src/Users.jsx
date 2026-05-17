import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_BASE as API } from './apiConfig';

const ROLE_LABELS = {
  technician: 'Technician',
  community_leader: 'Community leader',
  admin: 'Admin',
  superuser: 'Superuser',
};

const Users = () => {
  const { user } = useAuth();
  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'technician',
    grantSuperuser: false,
  });

  const load = useCallback(async () => {
    if (!user?.is_staff) return;
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/users/`, { headers: authHeader() });
      setList(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load users.');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [authHeader, user?.is_staff]);

  useEffect(() => {
    load();
  }, [load]);

  const createUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      if (user.is_superuser && form.grantSuperuser) {
        payload.is_superuser = true;
      } else {
        payload.role = form.role;
      }
      await axios.post(`${API}/api/users/`, payload, { headers: authHeader() });
      setForm({
        username: '',
        email: '',
        password: '',
        role: 'technician',
        grantSuperuser: false,
      });
      await load();
    } catch (e) {
      const d = e.response?.data;
      setError(typeof d === 'object' ? JSON.stringify(d) : d || 'Create failed.');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this user account? This cannot be undone.')) return;
    setError(null);
    try {
      await axios.delete(`${API}/api/users/${id}/`, { headers: authHeader() });
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Delete failed.');
    }
  };

  if (!user?.is_staff) {
    return (
      <div className="settings-page">
        <div className="page-header">
          <div>
            <h2 className="page-title">User accounts</h2>
            <p className="page-subtitle">Staff access is required to manage accounts.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">User accounts</h2>
          <p className="page-subtitle">
            Technicians use the field app; community leaders and admins use this portal. Admins may
            configure the SMS relay APK. Only a superuser can create another superuser.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="settings-sections">
        <section className="glass-panel settings-section">
          <h3 className="settings-section-title">Create account</h3>
          <form onSubmit={createUser} className="settings-form">
            <div className="form-group">
              <label htmlFor="user-username">Username</label>
              <input
                id="user-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="user-email">Email (optional)</label>
              <input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="user-password">Password (min 8 characters)</label>
              <input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {!(user.is_superuser && form.grantSuperuser) && (
              <div className="form-group">
                <label htmlFor="user-role">Role</label>
                <select
                  id="user-role"
                  className="form-select"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="technician">Technician — field app (maps / jobs)</option>
                  <option value="community_leader">Community leader — web portal</option>
                  <option value="admin">Admin — full portal + SMS relay handset</option>
                </select>
              </div>
            )}
            {user.is_superuser && (
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={form.grantSuperuser}
                  onChange={(e) => setForm({ ...form, grantSuperuser: e.target.checked })}
                />
                <span>
                  <strong>Create Django superuser</strong>
                  <small>Full control — role selector ignored.</small>
                </span>
              </label>
            )}
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create user'}
            </button>
          </form>
        </section>
      </div>

      <section className="glass-panel settings-section users-table-section">
        <h3 className="settings-section-title">All users</h3>
        <p className="settings-section-desc">Portal and field accounts registered on the server.</p>
        {loading ? (
          <div className="loading" style={{ padding: '1.5rem 0' }}>
            Loading…
          </div>
        ) : list.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No users returned.</p>
        ) : (
          <div className="users-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>SMS relay (APK)</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.username}</strong>
                      {u.id === user.id ? (
                        <span className="muted" style={{ marginLeft: '0.35rem' }}>
                          (you)
                        </span>
                      ) : null}
                    </td>
                    <td className="muted">{u.email || '—'}</td>
                    <td>{ROLE_LABELS[u.role] || u.role || '—'}</td>
                    <td className="muted">{u.can_configure_sms_gateway ? 'Yes' : '—'}</td>
                    <td className="muted">
                      {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      {u.id !== user.id ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ color: 'var(--danger, #f87171)' }}
                          onClick={() => remove(u.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Users;
