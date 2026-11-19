import React, { useEffect, useRef, useState } from 'react';
import { ServicePathMark } from './BrandLogo.jsx';

export const money = (value) =>
  value === null || value === undefined
    ? '—'
    : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const ICON_PATHS = {
  overview: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  requests: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9h6m-6-4h6',
  proposals: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM9 13h6M9 17h4',
  transactions: 'M7 16V4m0 0L3 8m4-4 4 4m6 0v12m0 0 4-4m-4 4-4-4',
  businesses: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01',
  reviews: 'm12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z',
  simulation: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  forecasts: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  chevron: 'm9 6 6 6-6 6',
  chevronLeft: 'm15 18-6-6 6-6',
  chevronRight: 'm9 18 6-6-6-6',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  arrowUp: 'M12 19V5m0 0-6 6m6-6 6 6',
  arrowRight: 'M5 12h14m0 0-6-6m6 6-6 6',
  arrowLeft: 'M19 12H5m0 0 6 6m-6-6 6-6',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  logout: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  plus: 'M12 5v14M5 12h14',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2m20 0v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6m20 0-3.5-7h-13L2 12',
  flask: 'M9 3h6M10 3v6L4.5 18.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M18 6 6 18M6 6l12 12',
  search: 'M21 21l-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0z',
};

export function Icon({ name, size = 16, className = '', strokeWidth = 1.75 }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name] || ICON_PATHS.info} />
    </svg>
  );
}

export function Loading({ what = 'data' }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <ServicePathMark size={24} className="sp-mark-pulse" />
      <span className="spinner" aria-hidden="true" />
      <span>Loading {what}…</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="state error" role="alert">
      <Icon name="alert" size={18} />
      <div>
        <strong>We couldn’t load this.</strong>
        <div>{message}</div>
      </div>
      {onRetry && (
        <button type="button" className="btn ghost small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children, icon = 'inbox', action }) {
  return (
    <div className="state empty">
      <span className="state-icon"><Icon name={icon} size={18} /></span>
      <p className="empty-copy">{children}</p>
      {action}
    </div>
  );
}

export function Async({ result, what, emptyText, isEmpty, children }) {
  if (result.loading) return <Loading what={what} />;
  if (result.error) return <ErrorBox message={result.error} onRetry={result.reload} />;
  if (isEmpty ? isEmpty(result.data) : Array.isArray(result.data) && result.data.length === 0) {
    return <Empty>{emptyText}</Empty>;
  }
  return children(result.data);
}

export function Badge({ status, tone: forcedTone }) {
  const tone =
    forcedTone ||
    {
      Open: 'open',
      Submitted: 'open',
      Active: 'open',
      'In Progress': 'warn',
      Pending: 'warn',
      Accepted: 'ok',
      Completed: 'ok',
      Paid: 'ok',
      Rejected: 'bad',
      Cancelled: 'bad',
      Overdue: 'bad',
      Withdrawn: 'neutral',
    }[status] ||
    'neutral';
  return <span className={`badge badge-${tone}`}>{status}</span>;
}

export function Stars({ value }) {
  if (value === null || value === undefined) {
    return <span className="muted small-text">Not rated yet</span>;
  }
  const rounded = Math.round(Number(value));
  return (
    <span className="stars" title={`${Number(value).toFixed(1)} out of 5`}>
      <span aria-hidden="true">
        {'★'.repeat(rounded)}
        <span className="off">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span className="stars-num">{Number(value).toFixed(1)}</span>
    </span>
  );
}

export function ScoreMeter({ value, max, label, hint }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / max) * 100));
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value">
          {Number(value)}
          <span className="muted"> / {max}</span>
        </span>
      </div>
      <div className="meter-track" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
      {hint && <div className="meter-hint">{hint}</div>}
    </div>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog) {
      const first = dialog.querySelector(FOCUSABLE);
      (first || dialog).focus();
    }

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key === 'Tab' && dialog) {
        const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus();
      }
    };
  }, []);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, optional }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {optional && <span className="field-opt"> (optional)</span>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function useForm(initial, submit) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const setValue = (name, value) => setValues((v) => ({ ...v, [name]: value }));
  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await submit(values);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return { values, set, setValue, error, busy, onSubmit };
}

export function PageHeader({ title, subtitle, action, meta }) {
  return (
    <header className="page-head">
      <div className="page-head-copy">
        <h1>{title}</h1>
        {subtitle && <p className="lead">{subtitle}</p>}
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </header>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="section-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, label = 'Views' }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          className={value === t.id ? 'active' : ''}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Disclosure({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`disclosure ${open ? 'open' : ''}`}>
      <button type="button" className="disclosure-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="chevron" size={14} className="disclosure-chevron" />
        <span>{label}</span>
      </button>
      {open && <div className="disclosure-body">{children}</div>}
    </div>
  );
}

export function DetailsPanel({ title, subtitle, badge = 'Technical details', defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`details-panel ${open ? 'open' : ''}`}>
      <button type="button" className="details-header" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="details-title-wrap">
          <Icon name="chevron" size={16} className="details-chevron" />
          <div>
            <div className="details-title">{title}</div>
            {subtitle && <div className="details-sub">{subtitle}</div>}
          </div>
        </div>
        {badge && <span className="badge badge-neutral">{badge}</span>}
      </button>
      {open && <div className="details-content">{children}</div>}
    </section>
  );
}
