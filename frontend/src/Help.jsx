import React from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, DOCS_URL } from './apiConfig';

const sections = [
  {
    title: 'Dashboard',
    path: '/',
    body: 'Overview KPIs, recent fault reports, the live infrastructure map, and quick actions. Click stat cards to drill into water points or tickets by status.',
  },
  {
    title: 'Live Map',
    path: '/map',
    body: 'Project-wide map view for monitoring locations and context in the field.',
  },
  {
    title: 'Reports',
    path: '/reports',
    body: 'Fault tickets from SMS and other channels. Update status as technicians progress from pending through resolved.',
  },
  {
    title: 'Water Points',
    path: '/waterpoints',
    body: 'Register and edit boreholes and distribution points. Coordinates power map fly-to and analytics.',
  },
  {
    title: 'Technicians',
    path: '/technicians',
    body: 'Field staff records and assignment context (extend as your workflow grows).',
  },
  {
    title: 'SMS Alerts',
    path: '/sms',
    body: 'Broadcast messages and gateway-related tools when integrated with the mobile SMS relay.',
  },
  {
    title: 'Analytics',
    path: '/analytics',
    body: 'Trends and operational metrics derived from reports and infrastructure data.',
  },
  {
    title: 'Settings',
    path: '/settings',
    body: 'System mode, password change, and other administrator controls.',
  },
];

const Help = () => (
  <div>
    <div style={{ marginBottom: '2rem' }}>
      <h2>Documentation</h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: '42rem' }}>
        Quick reference for the Waterwise admin portal. Use the sidebar or the links below to jump to each area.
      </p>
    </div>

    <section className="glass-panel" style={{ marginBottom: '1.5rem' }}>
      <h3>Configuration</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
        This browser app talks to the API at <code style={{ color: 'var(--primary)' }}>{API_BASE}</code>.
        Override with <code>VITE_API_BASE_URL</code> when building or in a <code>.env</code> file for local development.
      </p>
      {DOCS_URL ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
          External docs are set to{' '}
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
            {DOCS_URL}
          </a>
          .
        </p>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
          To open an external wiki or handbook from the sidebar instead of this page, set{' '}
          <code>VITE_DOCS_URL</code> to a full <code>https://…</code> URL and rebuild.
        </p>
      )}
    </section>

    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {sections.map(({ title, path, body }) => (
        <section key={path} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link to={path} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            {title} →
          </Link>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, lineHeight: 1.45 }}>{body}</p>
        </section>
      ))}
    </div>
  </div>
);

export default Help;
