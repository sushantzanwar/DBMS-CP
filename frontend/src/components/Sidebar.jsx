import React from 'react';

const NAV = [
  ['dashboard', 'Dashboard'],
  ['businesses', 'Businesses'],
  ['requests', 'Requests'],
  ['proposals', 'Proposals'],
  ['transactions', 'Transactions'],
  ['reviews', 'Reviews'],
];

export default function Sidebar({ page, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">SP</span>
        <div>
          <div className="brand-name">ServicePath AI</div>
          <div className="brand-sub">B2B service marketplace</div>
        </div>
      </div>
      <nav>
        {NAV.map(([id, label]) => (
          <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => onSelect(id)}>
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
