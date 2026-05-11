import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_BASE as API } from './apiConfig';

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
    is_staff: false,
    is_superuser: false,
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
      await axios.post(
        `${API}/api/users/`,
        {
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          is_staff: form.is_staff,
          is_superuser: form.is_superuser,
        },
        { headers: authHeader() },
      );
      setForm({ username: '', email: '', password: '', is_staff: false, is_superuser: false });
      await load();
    } catch (e) {
      const d = e.response?.data;
      setError(
        typeof d === 'object' ? JSON.stringify(d) : d || 'Create failed.',
      );
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
      <div className="page-wrap">
        <h1>User accounts</h1>
        <p className="muted">Staff access is required to manage user accounts.</p>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ marginBottom: '0.35rem' }}>User accounts</h1>
        <p className="muted" style={{ maxWidth: '640px' }}>
          Create sign-in accounts for coordinators and technicians. Staff users can use the full admin
          portal; non-staff accounts can sign in to the mobile app for field navigation only unless you
          grant staff access (superuser only).
        </p>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', maxWidth: '520px' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.05rem' }}>Create account</h3>
        <form onSubmit={createUser} className="login-form" style={{ gap: '0.75rem' }}>
          <div className="form-group">
            <label>Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>Password (min 8 characters)</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {user.is_superuser && (
            <>
              <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={form.is_staff}
                  onChange={(e) => setForm({ ...form, is_staff: e.target.checked })}
                />
                Staff (can access admin portal &amp; user management)
              </label>
              <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={form.is_superuser}
                  onChange={(e) => setForm({ ...form, is_superuser: e.target.checked })}
                />
                Superuser
              </label>
            </>
          )}
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </div>

      <div className="glass-panel" style={{ padding: '0' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>All users</h3>
        </div>
        {loading ? (
          <div className="loading" style={{ padding: '2rem' }}>
            Loading…
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Staff</th>
                  <th>Superuser</th>
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
                    <td>{u.is_staff ? 'Yes' : '—'}</td>
                    <td>{u.is_superuser ? 'Yes' : '—'}</td>
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
            {list.length === 0 && !loading && (
              <p className="muted" style={{ padding: '1.5rem' }}>
                No users returned.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Users;
