import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus } from 'lucide-react';
import { useAuth } from './AuthContext';
import { API_BASE as API } from './apiConfig';
import TableRowMenu, { TableRowMenuItem } from './TableRowMenu';
import { Icon } from './components/ui/icon';
import { Loader } from './components/ui/loader';

const ROLE_LABELS = {
  technician: 'Technician',
  community_leader: 'Community leader',
  admin: 'Admin',
  superuser: 'Superuser',
};

const EMPTY_CREATE_FORM = {
  username: '',
  email: '',
  password: '',
  role: 'technician',
  grantSuperuser: false,
};

function parseApiError(data) {
  if (!data) return 'Request failed.';
  if (typeof data === 'string') return data;
  if (data.detail) return String(data.detail);
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' · ');
}

function UserModal({ title, subtitle, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: '92%' }}
      >
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {subtitle}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Users = () => {
  const { user } = useAuth();
  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ email: '', role: 'technician', is_active: true });
  const [savingEdit, setSavingEdit] = useState(false);

  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const clearFeedback = () => {
    setError(null);
    setSuccess('');
  };

  const load = useCallback(async () => {
    if (!user?.is_staff) return;
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

  const openCreateModal = () => {
    clearFeedback();
    setCreateForm(EMPTY_CREATE_FORM);
    setShowCreateModal(true);
  };

  const openEditModal = (u) => {
    clearFeedback();
    setOpenMenuId(null);
    setEditUser(u);
    setEditForm({
      email: u.email || '',
      role: u.is_superuser ? 'admin' : u.role || 'technician',
      is_active: u.is_active !== false,
    });
  };

  const openPasswordModal = (u) => {
    clearFeedback();
    setOpenMenuId(null);
    setPasswordUser(u);
    setNewPassword('');
    setConfirmPassword('');
  };

  const createUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    clearFeedback();
    try {
      const payload = {
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
      };
      if (user.is_superuser && createForm.grantSuperuser) {
        payload.is_superuser = true;
      } else {
        payload.role = createForm.role;
      }
      await axios.post(`${API}/api/users/`, payload, { headers: authHeader() });
      setShowCreateModal(false);
      setCreateForm(EMPTY_CREATE_FORM);
      setSuccess('User created.');
      await load();
    } catch (e) {
      setError(parseApiError(e.response?.data));
    } finally {
      setCreating(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setSavingEdit(true);
    clearFeedback();
    try {
      const payload = {
        email: editForm.email.trim(),
        is_active: editForm.is_active,
      };
      if (!editUser.is_superuser) {
        payload.role = editForm.role;
      }
      await axios.patch(`${API}/api/users/${editUser.id}/`, payload, { headers: authHeader() });
      setEditUser(null);
      setSuccess('User updated.');
      await load();
    } catch (e) {
      setError(parseApiError(e.response?.data));
    } finally {
      setSavingEdit(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    clearFeedback();
    try {
      await axios.post(
        `${API}/api/users/${passwordUser.id}/set-password/`,
        { new_password: newPassword },
        { headers: authHeader() }
      );
      setPasswordUser(null);
      setSuccess(`Password updated for ${passwordUser.username}.`);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError(parseApiError(e.response?.data));
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleActive = async (u) => {
    const enabling = u.is_active === false;
    const msg = enabling
      ? `Re-enable account “${u.username}”?`
      : `Disable account “${u.username}”? They will not be able to sign in.`;
    if (!window.confirm(msg)) return;
    clearFeedback();
    setOpenMenuId(null);
    try {
      await axios.patch(
        `${API}/api/users/${u.id}/`,
        { is_active: enabling },
        { headers: authHeader() }
      );
      setSuccess(enabling ? `${u.username} enabled.` : `${u.username} disabled.`);
      await load();
    } catch (e) {
      setError(parseApiError(e.response?.data));
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Permanently delete “${u.username}”? This cannot be undone.`)) return;
    clearFeedback();
    setOpenMenuId(null);
    try {
      await axios.delete(`${API}/api/users/${u.id}/`, { headers: authHeader() });
      setSuccess(`${u.username} deleted.`);
      await load();
    } catch (e) {
      setError(parseApiError(e.response?.data));
    }
  };

  const canManageTarget = (target) => {
    if (target.id === user.id) return { edit: true, password: true, disable: false, delete: false };
    if (target.is_superuser && !user.is_superuser) {
      return { edit: false, password: false, disable: false, delete: false };
    }
    return { edit: true, password: true, disable: true, delete: true };
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
            Create accounts, change roles, reset passwords, disable sign-in, or remove users.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreateModal}>
          <Icon icon={Plus} size="sm" style={{ marginRight: 6 }} />
          Create user
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <section className="glass-panel settings-section users-table-section">
        <h3 className="settings-section-title">All users</h3>
        <p className="settings-section-desc">
          Use the actions menu on each row to edit, reset password, disable, or delete.
        </p>
        {loading ? (
          <Loader variant="section" label="Loading user accounts…" />
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
                  <th>Status</th>
                  <th>SMS relay</th>
                  <th>Joined</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((u) => {
                  const perms = canManageTarget(u);
                  const isSelf = u.id === user.id;
                  return (
                    <tr key={u.id} className={u.is_active === false ? 'users-row--disabled' : ''}>
                      <td>
                        <strong>{u.username}</strong>
                        {isSelf && (
                          <span className="muted" style={{ marginLeft: '0.35rem' }}>
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="muted">{u.email || '—'}</td>
                      <td>{ROLE_LABELS[u.role] || u.role || '—'}</td>
                      <td>
                        <span
                          className={`user-status-pill ${
                            u.is_active === false ? 'user-status-pill--off' : 'user-status-pill--on'
                          }`}
                        >
                          {u.is_active === false ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="muted">{u.can_configure_sms_gateway ? 'Yes' : '—'}</td>
                      <td className="muted">
                        {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}
                      </td>
                      <td className="users-actions-cell">
                        <TableRowMenu
                          isOpen={openMenuId === u.id}
                          onToggle={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                          onClose={() => setOpenMenuId(null)}
                        >
                          {(perms.edit || isSelf) && (
                            <TableRowMenuItem onClick={() => openEditModal(u)}>
                              Edit account
                            </TableRowMenuItem>
                          )}
                          {(perms.password || isSelf) && (
                            <TableRowMenuItem onClick={() => openPasswordModal(u)}>
                              Reset password
                            </TableRowMenuItem>
                          )}
                          {perms.disable && (
                            <TableRowMenuItem onClick={() => toggleActive(u)}>
                              {u.is_active === false ? 'Enable account' : 'Disable account'}
                            </TableRowMenuItem>
                          )}
                          {perms.delete && (
                            <TableRowMenuItem danger onClick={() => remove(u)}>
                              Delete permanently
                            </TableRowMenuItem>
                          )}
                          {!perms.edit && !isSelf && (
                            <TableRowMenuItem disabled>Superuser — no access</TableRowMenuItem>
                          )}
                        </TableRowMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCreateModal && (
        <UserModal
          title="Create user"
          subtitle="New portal or field account. The form closes after a successful create."
          onClose={() => !creating && setShowCreateModal(false)}
        >
          <form onSubmit={createUser} className="settings-form">
            <div className="form-group">
              <label htmlFor="user-username">Username</label>
              <input
                id="user-username"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                required
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="user-email">Email (optional)</label>
              <input
                id="user-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="user-password">Password (min 8 characters)</label>
              <input
                id="user-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {!(user.is_superuser && createForm.grantSuperuser) && (
              <div className="form-group">
                <label htmlFor="user-role">Role</label>
                <select
                  id="user-role"
                  className="form-select"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                >
                  <option value="technician">Technician — field app</option>
                  <option value="community_leader">Community leader — web portal</option>
                  <option value="admin">Admin — portal + SMS relay</option>
                </select>
              </div>
            )}
            {user.is_superuser && (
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={createForm.grantSuperuser}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, grantSuperuser: e.target.checked })
                  }
                />
                <span>
                  <strong>Create Django superuser</strong>
                  <small>Full server control — role selector ignored.</small>
                </span>
              </label>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creating} style={{ marginTop: 0 }}>
                {creating ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </form>
        </UserModal>
      )}

      {editUser && (
        <UserModal
          title={`Edit — ${editUser.username}`}
          subtitle="Update email, role, and whether the account can sign in."
          onClose={() => !savingEdit && setEditUser(null)}
        >
          <form onSubmit={saveEdit} className="settings-form">
            <div className="form-group">
              <label htmlFor="edit-email">Email</label>
              <input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                autoComplete="off"
              />
            </div>
            {!editUser.is_superuser ? (
              <div className="form-group">
                <label htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  className="form-select"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="technician">Technician</option>
                  <option value="community_leader">Community leader</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                Superuser role is managed in Django admin.
              </p>
            )}
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={editForm.is_active}
                disabled={editUser.id === user.id}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              />
              <span>
                <strong>Account enabled</strong>
                <small>
                  {editUser.id === user.id
                    ? 'You cannot disable your own account.'
                    : 'Disabled users cannot sign in to the portal or API.'}
                </small>
              </span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditUser(null)}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={savingEdit} style={{ marginTop: 0 }}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </UserModal>
      )}

      {passwordUser && (
        <UserModal
          title={`Reset password — ${passwordUser.username}`}
          subtitle="Sets a new password immediately. The user does not need their old password."
          onClose={() => !savingPassword && setPasswordUser(null)}
        >
          <form onSubmit={savePassword} className="settings-form">
            <div className="form-group">
              <label htmlFor="admin-new-pw">New password</label>
              <input
                id="admin-new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="admin-confirm-pw">Confirm password</label>
              <input
                id="admin-confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPasswordUser(null)}
                disabled={savingPassword}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={savingPassword} style={{ marginTop: 0 }}>
                {savingPassword ? 'Updating…' : 'Set password'}
              </button>
            </div>
          </form>
        </UserModal>
      )}
    </div>
  );
};

export default Users;
