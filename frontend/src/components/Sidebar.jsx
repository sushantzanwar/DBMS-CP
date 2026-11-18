import React from 'react';
import { Icon } from './ui.jsx';

export const NAV_SECTIONS = [
  {
    title: 'Operations',
    items: [
      ['dashboard', 'Overview', 'overview'],
      ['requests', 'Requests', 'requests'],
      ['proposals', 'Proposals', 'proposals'],
      ['transactions', 'Transactions', 'transactions'],
    ],
  },
  {
    title: 'Directory & Analysis',
    items: [
      ['businesses', 'Businesses', 'businesses'],
      ['reviews', 'Reviews', 'reviews'],
      ['simulation', 'Simulation', 'simulation'],
      ['forecasts', 'Forecasts', 'forecasts'],
    ],
  },
];

export const PAGE_LABELS = Object.fromEntries(
  NAV_SECTIONS.flatMap((s) => s.items.map(([id, label]) => [id, label]))
);

export default function Sidebar({ page, user, onSelect, onSignOut }) {
  const initials = (user.businessName || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <button type="button" className="brand" onClick={() => onSelect('dashboard')}>
        <span className="brand-mark" aria-hidden="true">SP</span>
        <span className="brand-text">
          <span className="brand-name">ServicePath AI</span>
          <span className="brand-sub">B2B exchange</span>
        </span>
      </button>

      <nav className="rail-nav">
        {NAV_SECTIONS.map((section) => (
          <div className="nav-section" key={section.title}>
            <div className="nav-section-title">{section.title}</div>
            {section.items.map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                className={`nav-item ${page === id ? 'active' : ''}`}
                aria-current={page === id ? 'page' : undefined}
                onClick={() => onSelect(id)}
              >
                <Icon name={icon} size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="rail-footer">
        <div className="rail-account">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div className="rail-account-meta">
            <strong>{user.businessName}</strong>
            <span>{user.city}</span>
          </div>
        </div>
        <button type="button" className="rail-signout" onClick={onSignOut}>
          <Icon name="logout" size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
