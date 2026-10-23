import React from 'react';

export default function TopBar({ user, onSignOut }) {
  return (
    <header className="topbar">
      <div className="topbar-title">ServicePath AI</div>
      <div className="topbar-user">
        <div>
          <strong>{user.businessName}</strong>
          <span>{user.city}</span>
        </div>
        <button className="btn ghost small" onClick={onSignOut}>Sign out</button>
      </div>
    </header>
  );
}
