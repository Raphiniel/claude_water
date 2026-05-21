import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE as API } from './apiConfig';

const mapsDirUrl = (destLat, destLng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destLat},${destLng}`)}&travelmode=driving`;

const TechnicianField = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialToken = params.get('token') || sessionStorage.getItem('waterwise_field_token') || '';

  const [token, setToken] = useState(initialToken);
  const [saved, setSaved] = useState(!!initialToken);
  const [jobs, setJobs] = useState([]);
  const [techName, setTechName] = useState('');
  const [error, setError] = useState(null);
  const [pos, setPos] = useState(null);
  const [posError, setPosError] = useState(null);
  const [lastPost, setLastPost] = useState(null);
  const [closingJobId, setClosingJobId] = useState(null);
  const [closeTargetId, setCloseTargetId] = useState(null);
  const [closeNotes, setCloseNotes] = useState('');
  const [closeError, setCloseError] = useState(null);

  const fetchJobs = useCallback(async (t) => {
    if (!t) return;
    setError(null);
    try {
      const res = await axios.get(`${API}/api/field/jobs/`, { params: { token: t } });
      setJobs(res.data.jobs || []);
      setTechName(res.data.technician?.name || '');
    } catch (e) {
      setJobs([]);
      setError(e.response?.data?.error || 'Could not load jobs. Check your portal link token.');
    }
  }, []);

  useEffect(() => {
    if (saved && token) {
      sessionStorage.setItem('waterwise_field_token', token);
      fetchJobs(token);
      const id = setInterval(() => fetchJobs(token), 45000);
      return () => clearInterval(id);
    }
  }, [saved, token, fetchJobs]);

  useEffect(() => {
    if (!saved || !token) return undefined;
    if (!navigator.geolocation) {
      setPosError('Geolocation is not supported on this browser.');
      return undefined;
    }
    const watchId = navigator.geolocation.watchPosition(
      async (p) => {
        const { latitude, longitude, accuracy } = p.coords;
        setPos({ latitude, longitude, accuracy });
        setPosError(null);
        try {
          await axios.post(`${API}/api/field/position/`, {
            token,
            latitude,
            longitude,
          });
          setLastPost(new Date().toISOString());
        } catch (e) {
          setPosError(e.response?.data?.error || 'Failed to share location with server');
        }
      },
      (err) => setPosError(err.message || 'Location permission denied'),
      { enableHighAccuracy: true, maximumAge: 20000, timeout: 25000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [saved, token]);

  const start = (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Paste the portal token from your coordinator.');
      return;
    }
    setSaved(true);
  };

  const closeJob = async (jobId) => {
    const notes = closeNotes.trim();
    if (notes.length < 3) {
      setCloseError('Enter at least 3 characters describing the fix.');
      return;
    }
    setClosingJobId(jobId);
    setCloseError(null);
    try {
      await axios.post(`${API}/api/field/jobs/${jobId}/close/`, {
        token,
        closure_notes: notes,
      });
      setCloseNotes('');
      setCloseTargetId(null);
      await fetchJobs(token);
    } catch (e) {
      setCloseError(e.response?.data?.error || 'Could not close fault.');
    } finally {
      setClosingJobId(null);
    }
  };

  const logoutField = () => {
    sessionStorage.removeItem('waterwise_field_token');
    setSaved(false);
    setToken('');
    setJobs([]);
    setTechName('');
    setPos(null);
  };

  return (
    <div className="field-portal-page" style={{ minHeight: '100vh', background: 'linear-gradient(165deg, #0a1628 0%, #0d0d12 45%)', color: '#e2e8f0', padding: '1.25rem' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.35rem', margin: '0 0 0.35rem' }}>
          WaterWise field
        </h1>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.45 }}>
          Share your live GPS so dispatch can auto-assign the nearest jobs. Open directions to each site in Google Maps.
        </p>

        {!saved ? (
          <form onSubmit={start} style={{ background: 'rgba(15,23,42,0.65)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 14, padding: '1.1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
              Portal token
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              placeholder="Paste token from Technicians page"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.75rem', borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(0,0,0,0.25)', color: '#f1f5f9', fontSize: '0.85rem',
              }}
            />
            {error && <div style={{ color: '#fca5a5', fontSize: '0.82rem', marginTop: 10 }}>{error}</div>}
            <button
              type="submit"
              style={{
                marginTop: 14, width: '100%', padding: '0.75rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.9rem', background: 'linear-gradient(135deg, #0369a1, #0ea5e9)', color: '#fff',
              }}
            >
              Continue
            </button>
          </form>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Signed in as</div>
                <div style={{ fontWeight: 700 }}>{techName || 'Technician'}</div>
              </div>
              <button type="button" onClick={logoutField} style={{ background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.25)', color: '#cbd5e1', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem' }}>
                Change token
              </button>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.65)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 14, padding: '0.9rem 1rem', marginBottom: 14 }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 6 }}>GPS relay</div>
              {pos ? (
                <div style={{ fontSize: '0.84rem', fontFamily: 'ui-monospace, monospace' }}>
                  {pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)}
                  <span style={{ color: '#64748b', marginLeft: 8 }}>±{Math.round(pos.accuracy)}m</span>
                </div>
              ) : (
                <div style={{ fontSize: '0.84rem', color: '#94a3b8' }}>Waiting for GPS fix…</div>
              )}
              {lastPost && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 6 }}>Last server update: {new Date(lastPost).toLocaleTimeString()}</div>}
              {posError && <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: 8 }}>{posError}</div>}
            </div>

            {error && <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}
            {closeError && <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: 10 }}>{closeError}</div>}

            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', margin: '4px 0 8px' }}>My open jobs</div>
            {jobs.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', border: '1px dashed rgba(148,163,184,0.25)', borderRadius: 12 }}>
                No active assignments. Stay online — new jobs appear automatically.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {jobs.map((j) => (
                  <div
                    key={j.id}
                    style={{
                      background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 12, padding: '0.85rem 1rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{j.ticket_number}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{j.water_point_code} · {j.water_point_location}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>Reporter: {j.sender_number}</div>
                    {j.latitude && j.longitude ? (
                      <a
                        href={mapsDirUrl(j.latitude, j.longitude)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex', marginTop: 10, alignItems: 'center', gap: 6, padding: '8px 12px',
                          borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac',
                          fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none',
                        }}
                      >
                        Navigate in Google Maps
                      </a>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#fbbf24' }}>Site has no map coordinates yet.</div>
                    )}
                    {closeTargetId === j.id ? (
                      <div style={{ marginTop: 12 }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: 6 }}>
                          Closure notes (required)
                        </label>
                        <textarea
                          value={closeNotes}
                          onChange={(e) => setCloseNotes(e.target.value)}
                          rows={3}
                          placeholder="What was fixed on site?"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '0.55rem 0.65rem',
                            borderRadius: 8,
                            border: '1px solid rgba(148,163,184,0.3)',
                            background: 'rgba(0,0,0,0.2)',
                            color: '#f1f5f9',
                            fontSize: '0.82rem',
                            resize: 'vertical',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => closeJob(j.id)}
                            disabled={closingJobId === j.id}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              background: '#16a34a',
                              color: '#fff',
                            }}
                          >
                            {closingJobId === j.id ? 'Closing…' : 'Confirm close'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCloseTargetId(null);
                              setCloseNotes('');
                              setCloseError(null);
                            }}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: '1px solid rgba(148,163,184,0.3)',
                              background: 'transparent',
                              color: '#cbd5e1',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCloseTargetId(j.id);
                          setCloseNotes('');
                          setCloseError(null);
                        }}
                        style={{
                          display: 'inline-flex',
                          marginTop: 10,
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(148,163,184,0.35)',
                          background: 'rgba(148,163,184,0.1)',
                          color: '#e2e8f0',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        Close fault
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TechnicianField;
