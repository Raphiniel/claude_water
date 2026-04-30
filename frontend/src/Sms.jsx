import React, { useState } from 'react';
import { useAuth } from './AuthContext';

const Sms = () => {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSend = (e) => {
    e.preventDefault();
    setSending(true);
    // Simulate API call
    setTimeout(() => {
      setSending(false);
      setSuccess(true);
      setMessage('');
      setRecipient('');
      setTimeout(() => setSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">SMS Dispatch</h2>
          <p className="page-subtitle">Send critical alerts to field technicians or community leaders</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="left-column">
          <div className="panel">
            <div className="panel-header" style={{ marginBottom: '1.25rem' }}>
              <h3 className="panel-title">Compose Alert</h3>
            </div>
            
            {success && <div className="alert alert-success" style={{ marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: '8px' }}>✓ SMS sent successfully to network provider.</div>}
            
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Recipient Group or Number</label>
                <select value={recipient} onChange={e => setRecipient(e.target.value)} required style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', padding: '0.75rem', borderRadius: '8px', color: '#fff', width: '100%', outline: 'none' }}>
                  <option value="" disabled>Select recipient...</option>
                  <option value="all_techs">All Active Technicians</option>
                  <option value="harare_region">Harare Region Contacts</option>
                  <option value="bulawayo_region">Bulawayo Region Contacts</option>
                  <option value="custom">Custom Number (+263...)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Message Payload (max 160 chars)</label>
                <textarea 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  placeholder="Enter alert message here..."
                  maxLength={160}
                  required
                  style={{ height: '120px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', padding: '0.75rem', borderRadius: '8px', color: '#fff', resize: 'none', fontFamily: 'inherit', outline: 'none' }}
                />
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: message.length >= 160 ? '#ef4444' : '#888', marginTop: '0.25rem' }}>
                  {message.length} / 160
                </div>
              </div>
              
              <button type="submit" disabled={sending || !message || !recipient} className="btn-primary" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                {sending ? 'Dispatching...' : 'Send SMS Broadcast'}
              </button>
            </form>
          </div>
        </div>
        
        <div className="right-column">
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Recent Dispatches</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { time: '10 mins ago', to: 'All Active Technicians', status: 'DELIVERED', msg: 'CRITICAL: Borehole WP005 offline in Epworth. Please investigate immediately.' },
                { time: '2 hours ago', to: '+263 77 123 4567', status: 'DELIVERED', msg: 'Your maintenance request for WP012 has been approved.' },
                { time: 'Yesterday', to: 'Harare Region Contacts', status: 'FAILED', msg: 'System maintenance scheduled for tonight 00:00 - 04:00 CAT.' }
              ].map((log, i) => (
                <div key={i} style={{ borderBottom: i < 2 ? '1px solid var(--card-border)' : 'none', paddingBottom: i < 2 ? '1rem' : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a3e635' }}>{log.to}</span>
                    <span style={{ fontSize: '0.65rem', color: '#888' }}>{log.time}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '0.5rem', lineHeight: 1.4 }}>"{log.msg}"</p>
                  <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: log.status === 'DELIVERED' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: log.status === 'DELIVERED' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sms;
