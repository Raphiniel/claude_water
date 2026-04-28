import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatDate } from './App';

const API = 'http://localhost:8000';

const Technicians = () => {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', latitude: '', longitude: '', is_available: true });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  const fetchTechnicians = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/technicians/`, { headers: authHeader() });
      setTechnicians(res.data);
      setFetchError(null);
    } catch (err) {
      setFetchError(err.response?.data ? JSON.stringify(err.response.data) : err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { fetchTechnicians(); }, [fetchTechnicians]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const payload = {
      ...form,
      latitude: form.latitude === '' ? null : form.latitude,
      longitude: form.longitude === '' ? null : form.longitude,
    };
    try {
      const res = await axios.post(`${API}/api/technicians/`, payload, { headers: authHeader() });
      setTechnicians(prev => [...prev, res.data]);
      setShowForm(false);
      setForm({ name: '', phone: '', latitude: '', longitude: '', is_available: true });
    } catch (err) {
      setFormError(err.response?.data ? JSON.stringify(err.response.data) : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (tech) => {
    try {
      const res = await axios.patch(
        `${API}/api/technicians/${tech.id}/`,
        { is_available: !tech.is_available },
        { headers: authHeader() }
      );
      setTechnicians(prev => prev.map(t => t.id === tech.id ? res.data : t));
    } catch (err) {
      alert('Failed to update availability');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this technician?')) return;
    try {
      await axios.delete(`${API}/api/technicians/${id}/`, { headers: authHeader() });
      setTechnicians(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      alert('Failed to delete technician');
    }
  };

  const available = technicians.filter(t => t.is_available).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Technicians</h2>
          <p className="page-subtitle">{technicians.length} registered · {available} available</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={fetchTechnicians} className="btn-secondary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ marginTop: 0, padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            {showForm ? '✕ Cancel' : '+ Add Technician'}
          </button>
        </div>
      </div>

      {fetchError && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>API error: {fetchError}</div>}

      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem' }}>Register New Technician</h3>
          {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{formError}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Full Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Moyo" required />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+263771234567" required />
            </div>
            <div className="form-group">
              <label>Latitude <span style={{ color: 'var(--text-muted)' }}>(for nearest-match)</span></label>
              <input value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="-19.000" />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="29.000" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
              {saving ? 'Saving...' : 'Save Technician'}
            </button>
          </form>
        </div>
      )}

      <div className="glass-panel">
        {loading ? (
          <div className="loading">Loading technicians...</div>
        ) : technicians.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', opacity: 0.4 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p>No technicians registered yet.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Add technicians to enable fault assignment.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {technicians.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td className="mono">{t.phone}</td>
                    <td className="mono muted">
                      {t.latitude && t.longitude
                        ? `${t.latitude}, ${t.longitude}`
                        : <span style={{ fontStyle: 'italic' }}>No location</span>}
                    </td>
                    <td>
                      <button
                        onClick={() => toggleAvailability(t)}
                        className={`status-badge ${t.is_available ? 'status-resolved' : 'status-in_progress'}`}
                        style={{ border: 'none', cursor: 'pointer', background: 'none' }}
                        title="Click to toggle availability"
                      >
                        {t.is_available ? 'Available' : 'Busy'}
                      </button>
                    </td>
                    <td className="muted">{formatDate(t.created_at)}</td>
                    <td>
                      <button onClick={() => handleDelete(t.id)} className="btn-danger-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Technicians;
