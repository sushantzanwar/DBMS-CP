import React, { useState } from 'react';
import { ServicePathLogo, ServicePathMark } from './BrandLogo.jsx';
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
  const [collapsed, setCollapsed] = useState(false);
  const initials = (user.businessName || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Primary navigation">
      <div className="brand-row">
        <button
          type="button"
          className="brand"
          onClick={() => onSelect('dashboard')}
          aria-label="ServicePath AI overview"
        >
          {collapsed ? (
            <ServicePathMark size={30} theme="dark" />
          ) : (
            <ServicePathLogo theme="dark" size="sm" />
          )}
        </button>
        <button
          type="button"
          className="rail-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={15} />
        </button>
      </div>

      <nav className="rail-nav">
        {NAV_SECTIONS.map((section) => (
          <div className="nav-section" key={section.title}>
            {!collapsed && <div className="nav-section-title">{section.title}</div>}
            {section.items.map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                className={`nav-item ${page === id ? 'active' : ''}`}
                aria-current={page === id ? 'page' : undefined}
                aria-label={collapsed ? label : undefined}
                title={collapsed ? label : undefined}
                onClick={() => onSelect(id)}
              >
                <Icon name={icon} size={16} />
                {!collapsed && <span>{label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="rail-footer">
        <div className="rail-account" title={collapsed ? `${user.businessName} · ${user.city}` : undefined}>
          <span className="avatar" aria-hidden="true">{initials}</span>
          {!collapsed && (
            <div className="rail-account-meta">
              <strong>{user.businessName}</strong>
              <span>{user.city}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="rail-signout"
          onClick={onSignOut}
          aria-label={collapsed ? 'Sign out' : undefined}
          title={collapsed ? 'Sign out' : undefined}
        >
          <Icon name="logout" size={15} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
