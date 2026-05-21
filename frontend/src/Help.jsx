import React from 'react';
import { Link } from 'react-router-dom';

const sections = [
  {
    title: 'Dashboard',
    path: '/',
    body: 'Overview KPIs, recent fault reports, the infrastructure map, and quick actions. Click stat cards to drill into water points or tickets by status.',
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
    body: 'Field staff records, availability, and assignment context.',
  },
  {
    title: 'SMS Alerts',
    path: '/sms',
    body: 'Broadcast messages and tools for the mobile SMS relay when integrated.',
  },
  {
    title: 'Analytics',
    path: '/analytics',
    body: 'Trends, fault mix, resolution rate, and infrastructure coverage.',
  },
  {
    title: 'Settings',
    path: '/settings',
    body: 'Your account, organization options, operational mode, SMS behaviour, and integrations (staff).',
  },
];

const Help = () => (
  <div>
    <div style={{ marginBottom: '2rem' }}>
      <h2 className="page-title">Help</h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: '42rem' }}>
        Quick guide to the WaterWise admin portal. Use the sidebar or the links below to open each area.
      </p>
    </div>

    <section className="glass-panel" style={{ marginBottom: '1.5rem' }}>
      <h3>Getting started</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
        Sign in with the credentials provided by your administrator. For SMS relay setup, user
        management, or integration questions, open <Link to="/settings">Settings</Link> or{' '}
        <Link to="/users">User accounts</Link> (staff only).
      </p>
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
