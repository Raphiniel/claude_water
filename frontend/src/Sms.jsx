import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';

import { API_BASE as API } from './apiConfig';

const FAULT_LABELS = {
  PUMP: 'Pump Failure', LEAK: 'Pipe Leak', DRY: 'Borehole Dry',
  CONTAM: 'Contamination', VANDAL: 'Vandalism', OTHER: 'Other',
};

const Sms = () => {
  const [recipient, setRecipient] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [faultSmsFeed, setFaultSmsFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const { user } = useAuth();

  const loadIncomingFaultSms = useCallback(async () => {
    if (!user?.token) {
      setFeedLoading(false);
      return;
    }
    setFeedError(null);
    setFeedLoading(true);
    try {
      const res = await axios.get(`${API}/api/reports/`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const rows = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setFaultSmsFeed(rows);
    } catch (err) {
      setFeedError(err.response?.data?.detail || err.message || 'Failed to load incoming SMS');
      setFaultSmsFeed([]);
    } finally {
      setFeedLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    loadIncomingFaultSms();
  }, [loadIncomingFaultSms]);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(false);

    let targetNumber = recipient;
    if (recipient === 'custom') {
      targetNumber = customNumber;
      if (!targetNumber.startsWith('+')) {
        setError('Custom number must start with a + country code (e.g. +263...)');
        setSending(false);
        return;
      }
    }

    try {
      await axios.post(
        `${API}/sms/send/`,
        { recipient: targetNumber, message },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setSuccess(true);
      setMessage('');
      if (recipient === 'custom') setCustomNumber('');
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800 }}>SMS Dispatch</h2>
          <p className="page-subtitle" style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.25rem' }}>Send critical alerts to field technicians or community leaders</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '6fr 5fr', gap: '1.5rem' }}>
        
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* COMPOSE CARD */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(163,230,53,0.1)', color: '#a3e635', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Compose Alert</h3>
            </div>
            
            {success && <div className="alert alert-success" style={{ marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: '8px' }}>✓ SMS sent successfully to network provider.</div>}
            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
            
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#ccc' }}>Recipient Group or Number</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </div>
                  <select 
                    value={recipient} 
                    onChange={e => setRecipient(e.target.value)} 
                    required 
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.85rem 0.85rem 0.85rem 2.5rem', borderRadius: '8px', color: '#fff', width: '100%', outline: 'none', appearance: 'none' }}
                  >
                    <option value="" disabled>Select recipient...</option>
                    <option value="all_techs">All Active Technicians</option>
                    <option value="harare_region">Harare Region Contacts</option>
                    <option value="bulawayo_region">Bulawayo Region Contacts</option>
                    <option value="custom">Custom Number (+263...)</option>
                  </select>
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
                
                {recipient === 'custom' && (
                  <div style={{ marginTop: '0.75rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </div>
                    <input 
                      type="tel"
                      value={customNumber}
                      onChange={e => setCustomNumber(e.target.value)}
                      placeholder="+263..."
                      required
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.85rem 0.85rem 0.85rem 2.5rem', borderRadius: '8px', color: '#fff', width: '100%', outline: 'none' }}
                    />
                  </div>
                )}
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#ccc' }}>Message Payload (max 160 chars)</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '14px', color: '#888' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                  <textarea 
                    value={message} 
                    onChange={e => setMessage(e.target.value)} 
                    placeholder="Enter alert message here..."
                    maxLength={160}
                    required
                    style={{ height: '120px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.85rem 0.85rem 0.85rem 2.5rem', borderRadius: '8px', color: '#fff', resize: 'none', fontFamily: 'inherit', outline: 'none', width: '100%' }}
                  />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                    {message.length} characters • {Math.max(1, Math.ceil(message.length / 160))} SMS segment
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>{message.length} / 160</span>
                    <span style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600 }}>
                      Tips: Keep it short and clear
                    </span>
                  </div>
                </div>
              </div>
              
              <button type="submit" disabled={sending || !message || !recipient} className="btn-primary" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                {sending ? 'Dispatching...' : 'Send SMS Broadcast'}
              </button>
            </form>
          </div>

          {/* STATS CARD */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(168,85,247,0.15)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: '1.25rem', color: '#fff' }}>0</strong>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>Messages Sent Today</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: '1.25rem', color: '#fff' }}>100%</strong>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>Delivery Rate</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: '1.25rem', color: '#fff' }}>2 mins ago</strong>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>Last Dispatch</span>
              </div>
            </div>

          </div>

        </div>
        
        {/* RIGHT COLUMN — incoming fault SMS (gateway accountability) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="glass-panel" style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(163,230,53,0.12)', color: '#a3e635', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Incoming fault SMS</h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#888' }}>Exact message and sender for each ticket opened via SMS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadIncomingFaultSms()}
                disabled={feedLoading}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', cursor: feedLoading ? 'wait' : 'pointer' }}
              >
                Refresh
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', padding: '1rem 1.5rem', flex: 1, gap: '0.75rem', maxHeight: 'min(70vh, 640px)', overflowY: 'auto' }}>
              {feedError && (
                <div className="alert alert-error" style={{ margin: 0 }}>{feedError}</div>
              )}
              {feedLoading && !feedError && (
                <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>Loading…</p>
              )}
              {!feedLoading && !feedError && faultSmsFeed.length === 0 && (
                <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>No fault tickets yet. When someone texts the gateway (e.g. <code style={{ color: '#ccc' }}>WP001 PUMP</code>), the raw SMS and number will appear here.</p>
              )}
              {!feedLoading && faultSmsFeed.map((r) => (
                <div key={r.id} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a3e635', fontWeight: 700, marginBottom: '0.35rem' }}>From</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', wordBreak: 'break-all' }}>{r.sender_number || '—'}</div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#888', whiteSpace: 'nowrap' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888', fontWeight: 600, marginBottom: '0.35rem' }}>Message (as received)</div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: '#e5e5e5',
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {r.raw_message && String(r.raw_message).trim() !== ''
                      ? r.raw_message
                      : '— No message text stored (ticket created before inbound logging was enabled).'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.85rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#ccc' }}>
                      Ticket <strong style={{ color: '#fff' }}>{r.ticket_number}</strong>
                    </span>
                    <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#ccc' }}>
                      {r.water_point_code || r.water_point_details?.code || '—'}
                    </span>
                    <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(168,85,247,0.12)', color: '#d8b4fe' }}>
                      {FAULT_LABELS[r.fault_code] || r.fault_code}
                    </span>
                    <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: r.status === 'RESOLVED' ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.12)', color: r.status === 'RESOLVED' ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                      {r.status?.replace('_', ' ') || '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '0.85rem 1.5rem' }}>
              <Link to="/reports" style={{ color: '#a3e635', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                Open fault reports
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </Link>
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: '#666' }}>Outbound broadcasts sent from this page are not listed here yet.</p>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sms;
