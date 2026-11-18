import React from 'react';

const MAIN_NAV = [
  ['dashboard', 'Overview', '📊'],
  ['requests', 'Requests', '📋'],
  ['proposals', 'Proposals', '📝'],
  ['transactions', 'Transactions', '🤝'],
  ['businesses', 'Businesses', '🏢'],
  ['reviews', 'Reviews', '⭐'],
];

const INTEL_NAV = [
  ['simulation', 'Simulation', '⚡', 'What-If'],
  ['forecasts', 'Forecasts', '📈', 'AI'],
];

export default function Sidebar({ page, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="brand" onClick={() => onSelect('dashboard')} style={{ cursor: 'pointer' }}>
        <span className="brand-mark">SP</span>
        <div>
          <div className="brand-name">ServicePath AI</div>
          <div className="brand-sub">B2B Service Exchange</div>
        </div>
      </div>

      <nav>
        <div className="nav-section-title">MARKETPLACE</div>
        {MAIN_NAV.map(([id, label, icon]) => (
          <button
            key={id}
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => onSelect(id)}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}

        <div className="nav-section-title" style={{ marginTop: '20px' }}>
          INTELLIGENCE
        </div>
        {INTEL_NAV.map(([id, label, icon, badge]) => (
          <button
            key={id}
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => onSelect(id)}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
            {badge && <span className="nav-badge">{badge}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
