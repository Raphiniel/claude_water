import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { formatDate } from './App';
import TableRowMenu, { TableRowMenuItem } from './TableRowMenu';
import { API_BASE as API } from './apiConfig';
import { ChevronDown, Search } from 'lucide-react';
import { Icon } from './components/ui/icon';
import { Loader } from './components/ui/loader';

const FAULT_LABELS = {
  PUMP: 'Pump Failure',
  LEAK: 'Pipe Leak',
  DRY: 'Borehole Dry',
  CONTAM: 'Contamination',
  VANDAL: 'Vandalism',
  OTHER: 'Other',
};

const INBOUND_FILTERS = [
  { key: 'ALL', label: 'All', dot: 'purple' },
  { key: 'PENDING', label: 'Pending', dot: 'amber' },
  { key: 'TODAY', label: 'Today', dot: 'blue' },
  { key: 'RESOLVED', label: 'Resolved', dot: 'green' },
];

const SENT_LOG_KEY = 'ww_sms_sent_log';

function formatRelativeTime(date) {
  if (!date) return '—';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function loadSentLog() {
  try {
    const raw = sessionStorage.getItem(SENT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSentLog(entries) {
  try {
    sessionStorage.setItem(SENT_LOG_KEY, JSON.stringify(entries.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function recipientLabel(recipient, technicians) {
  if (recipient === 'all_techs' || recipient === 'all_technicians') return 'All active technicians';
  if (recipient === 'available_technicians' || recipient === 'available') return 'Available technicians';
  if (recipient?.startsWith?.('tech:')) {
    const id = parseInt(recipient.split(':')[1], 10);
    const t = technicians.find((x) => x.id === id);
    return t ? t.name : recipient;
  }
  return recipient;
}

const Sms = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const authHeader = useCallback(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  const [technicians, setTechnicians] = useState([]);
  const [inbound, setInbound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [recipient, setRecipient] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(null);

  const [inboundFilter, setInboundFilter] = useState('ALL');
  const [inboundSearch, setInboundSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showOutbound, setShowOutbound] = useState(false);

  const [sentLog, setSentLog] = useState(loadSentLog);

  const loadData = useCallback(async () => {
    if (!user?.token) {
      setLoading(false);
      return;
    }
    setFetchError(null);
    setLoading(true);
    try {
      const [reportsRes, techRes] = await Promise.all([
        axios.get(`${API}/api/reports/`, { headers: authHeader() }),
        axios.get(`${API}/api/technicians/`, { headers: authHeader() }),
      ]);
      const rows = Array.isArray(reportsRes.data) ? reportsRes.data : reportsRes.data?.results || [];
      setInbound(rows);
      setTechnicians((techRes.data || []).filter((t) => t.is_active !== false));
      setLastUpdated(new Date());
    } catch (err) {
      setFetchError(err.response?.data?.detail || err.message || 'Failed to load SMS data');
    } finally {
      setLoading(false);
    }
  }, [authHeader, user?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const inboundCounts = useMemo(() => {
    const today = inbound.filter((r) => isToday(r.created_at)).length;
    const pending = inbound.filter((r) => r.status === 'PENDING').length;
    const resolved = inbound.filter((r) => r.status === 'RESOLVED').length;
    return { ALL: inbound.length, PENDING: pending, TODAY: today, RESOLVED: resolved };
  }, [inbound]);

  const sentTodayCount = useMemo(() => sentLog.filter((e) => isToday(e.sent_at)).length, [sentLog]);

  const filteredInbound = useMemo(() => {
    return inbound.filter((r) => {
      if (inboundFilter === 'PENDING' && r.status !== 'PENDING') return false;
      if (inboundFilter === 'RESOLVED' && r.status !== 'RESOLVED') return false;
      if (inboundFilter === 'TODAY' && !isToday(r.created_at)) return false;
      if (inboundSearch) {
        const q = inboundSearch.toLowerCase();
        const msg = (r.raw_message || '').toLowerCase();
        const phone = (r.sender_number || '').toLowerCase();
        const ticket = (r.ticket_number || '').toLowerCase();
        const wp = (r.water_point_code || '').toLowerCase();
        if (!msg.includes(q) && !phone.includes(q) && !ticket.includes(q) && !wp.includes(q)) return false;
      }
      return true;
    });
  }, [inbound, inboundFilter, inboundSearch]);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    let target = recipient;
    if (recipient === 'custom') {
      target = customNumber.trim();
      if (!target.startsWith('+')) {
        setSendError('Use country code, e.g. +263771234567');
        setSending(false);
        return;
      }
    }

    try {
      const res = await axios.post(
        `${API}/sms/send/`,
        { recipient: target, message: message.trim() },
        { headers: authHeader() }
      );
      const count = res.data.sent_count || 1;
      setSendSuccess(`Sent to ${count} recipient${count === 1 ? '' : 's'}.`);
      const entry = {
        id: Date.now(),
        sent_at: new Date().toISOString(),
        recipient: target,
        recipient_label: recipientLabel(target, technicians),
        message: message.trim(),
        sent_count: count,
      };
      const next = [entry, ...sentLog].slice(0, 50);
      setSentLog(next);
      saveSentLog(next);
      setMessage('');
      setShowOutbound(true);
      if (recipient === 'custom') setCustomNumber('');
    } catch (err) {
      setSendError(err.response?.data?.error || err.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const activeTechs = technicians.filter((t) => t.is_available);

  return (
    <div className="sms-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">SMS Alerts</h2>
          <p className="page-subtitle">
            {inbound.length} inbound · {inboundCounts.PENDING} pending · {sentTodayCount} sent today
            {lastUpdated && <> · {formatRelativeTime(lastUpdated)}</>}
          </p>
        </div>
        <button type="button" onClick={loadData} className="btn-secondary btn-sm" disabled={loading}>
          Refresh
        </button>
      </div>

      {fetchError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{fetchError}</div>}

      <div className="glass-panel sms-compose-panel">
        {sendSuccess && <div className="alert alert-success sms-compose-alert">{sendSuccess}</div>}
        {sendError && <div className="alert alert-error sms-compose-alert">{sendError}</div>}

        <form className="sms-compose-form" onSubmit={handleSend}>
          <div className="form-group sms-compose-field">
            <label htmlFor="sms-to">To</label>
            <select
              id="sms-to"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
            >
              <option value="" disabled>
                Recipient…
              </option>
              <option value="available_technicians">Available ({activeTechs.length})</option>
              <option value="all_techs">All active ({technicians.length})</option>
              {technicians.map((t) => (
                <option key={t.id} value={`tech:${t.id}`}>
                  {t.name} · {t.phone}
                </option>
              ))}
              <option value="custom">Custom number</option>
            </select>
          </div>

          {recipient === 'custom' && (
            <div className="form-group sms-compose-field">
              <label htmlFor="sms-custom">Number</label>
              <input
                id="sms-custom"
                type="tel"
                value={customNumber}
                onChange={(e) => setCustomNumber(e.target.value)}
                placeholder="+263…"
                required
              />
            </div>
          )}

          <div className="form-group sms-compose-field sms-compose-message">
            <label htmlFor="sms-msg">Message</label>
            <input
              id="sms-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Alert text"
              maxLength={160}
              required
            />
            <span className="sms-char-count">{message.length}/160</span>
          </div>

          <button
            type="submit"
            disabled={sending || !recipient || !message.trim()}
            className="btn-primary sms-compose-submit"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>

      <div className="glass-panel">
        <div className="reports-summary-cards sms-inbound-filters">
          {INBOUND_FILTERS.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`reports-filter-card ${inboundFilter === card.key ? 'active' : ''}`}
              onClick={() => setInboundFilter(card.key)}
              aria-pressed={inboundFilter === card.key}
            >
              <span className="reports-filter-card-head">
                <span className={`dashboard-kpi-dot ${card.dot}`} aria-hidden />
                {card.label}
              </span>
              <strong>{inboundCounts[card.key] ?? 0}</strong>
            </button>
          ))}
        </div>

        <div className="page-table-toolbar">
          <div className="search-bar">
            <Icon icon={Search} size="md" />
            <input
              type="search"
              placeholder="Search inbound…"
              value={inboundSearch}
              onChange={(e) => setInboundSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <Loader variant="section" label="Loading messages…" />
        ) : filteredInbound.length === 0 ? (
          <div className="empty-state">
            <p>{inbound.length === 0 ? 'No inbound SMS yet.' : 'No matches.'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>From</th>
                  <th>Message</th>
                  <th>Ticket</th>
                  <th>Point</th>
                  <th>Status</th>
                  <th className="actions-col" />
                </tr>
              </thead>
              <tbody>
                {filteredInbound.map((r) => (
                  <tr
                    key={r.id}
                    className="clickable-row"
                    onClick={() => navigate('/reports')}
                  >
                    <td className="muted">{formatDate(r.created_at)}</td>
                    <td className="mono">{r.sender_number || '—'}</td>
                    <td className="muted sms-message-cell" title={r.raw_message || ''}>
                      {r.raw_message?.trim() || '—'}
                    </td>
                    <td>
                      <strong>{r.ticket_number}</strong>
                    </td>
                    <td className="muted">{r.water_point_code || '—'}</td>
                    <td>
                      <span className={`status-badge status-${r.status?.toLowerCase()}`}>
                        {r.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                      <TableRowMenu
                        isOpen={openMenuId === r.id}
                        onToggle={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                        onClose={() => setOpenMenuId(null)}
                      >
                        <TableRowMenuItem
                          onClick={() => {
                            setOpenMenuId(null);
                            navigate('/reports');
                          }}
                        >
                          View report
                        </TableRowMenuItem>
                        <TableRowMenuItem
                          onClick={() => {
                            setOpenMenuId(null);
                            navigate(`/waterpoints?flyTo=${encodeURIComponent(r.water_point_code || '')}`);
                          }}
                        >
                          Water point
                        </TableRowMenuItem>
                      </TableRowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="page-table-footer">
            {filteredInbound.length} of {inbound.length}
            {' · '}
            <Link to="/reports">Reports</Link>
          </div>
        )}
      </div>

      <div className="glass-panel sms-outbound-panel">
        <button
          type="button"
          className="sms-outbound-toggle"
          onClick={() => setShowOutbound((v) => !v)}
          aria-expanded={showOutbound}
        >
          <span>Recent sends ({sentLog.length})</span>
          <Icon
            icon={ChevronDown}
            size="sm"
            style={{ transform: showOutbound ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </button>

        {showOutbound && (
          sentLog.length === 0 ? (
            <p className="sms-outbound-empty">Nothing sent this session yet.</p>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sent</th>
                      <th>To</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentLog.map((row) => (
                      <tr key={row.id}>
                        <td className="muted">{formatDate(row.sent_at)}</td>
                        <td>{row.recipient_label}</td>
                        <td className="muted">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};

export default Sms;
