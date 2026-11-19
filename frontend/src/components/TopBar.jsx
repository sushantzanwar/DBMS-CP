import React, { useEffect, useRef, useState } from 'react';
import { ServicePathMark } from './BrandLogo.jsx';
import { Icon } from './ui.jsx';
import { NAV_SECTIONS, PAGE_LABELS } from './Sidebar.jsx';

export default function TopBar({ user, page, onSelect, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [page]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const first = drawerRef.current?.querySelector('button');
    first?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const currentLabel = PAGE_LABELS[page] || 'Overview';

  return (
    <header className="mobile-bar">
      <div className="mobile-bar-row">
        <button
          ref={triggerRef}
          type="button"
          className="mobile-menu-btn"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-drawer"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={18} />
          <ServicePathMark size={24} theme="dark" />
          <span className="mobile-loc">{currentLabel}</span>
        </button>

        <div className="mobile-bar-right">
          <span className="mobile-biz" title={`${user.businessName} · ${user.city}`}>
            {user.businessName}
          </span>
          <button type="button" className="btn ghost small" onClick={onSignOut}>
            <Icon name="logout" size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-nav-drawer" ref={drawerRef} className="mobile-drawer" aria-label="All screens">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mobile-drawer-group">
              <div className="mobile-drawer-title">{section.title}</div>
              <div className="mobile-drawer-grid">
                {section.items.map(([id, label, icon]) => (
                  <button
                    key={id}
                    type="button"
                    className={`mobile-nav-item ${page === id ? 'active' : ''}`}
                    aria-current={page === id ? 'page' : undefined}
                    onClick={() => {
                      onSelect(id);
                      setMenuOpen(false);
                    }}
                  >
                    <Icon name={icon} size={15} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}
