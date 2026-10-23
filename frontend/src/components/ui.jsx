import React, { useState } from 'react';

// Small shared building blocks used by every page.

export const money = (value) =>
  value === null || value === undefined ? '-' : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function Loading({ what = 'data' }) {
  return <div className="state">Loading {what}…</div>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="state error">
      <strong>We couldn't load this.</strong> {message}
      {onRetry && <div><button className="btn small" onClick={onRetry}>Try again</button></div>}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="state">{children}</div>;
}

// Shows loading / error / empty states for a useApi() result and renders children(data) when there is data.
export function Async({ result, what, emptyText, isEmpty, children }) {
  if (result.loading) return <Loading what={what} />;
  if (result.error) return <ErrorBox message={result.error} onRetry={result.reload} />;
  if (isEmpty ? isEmpty(result.data) : Array.isArray(result.data) && result.data.length === 0) {
    return <Empty>{emptyText}</Empty>;
  }
  return children(result.data);
}

export function Badge({ status }) {
  const tone = {
    Open: 'blue', Submitted: 'blue', Active: 'blue', 'In Progress': 'amber', Pending: 'amber',
    Accepted: 'green', Completed: 'green', Paid: 'green',
    Rejected: 'red', Cancelled: 'red', Withdrawn: 'grey',
  }[status] || 'grey';
  return <span className={`badge ${tone}`}>{status}</span>;
}

export function Stars({ value }) {
  if (value === null || value === undefined) return <span className="muted">Not rated yet</span>;
  const rounded = Math.round(Number(value));
  return (
    <span className="stars" title={`${value} out of 5`}>
      {'★'.repeat(rounded)}<span className="off">{'★'.repeat(5 - rounded)}</span> <span className="muted">{Number(value).toFixed(1)}</span>
    </span>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

// Tiny form helper: keeps field values, runs an async submit, shows the error message if it fails.
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

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="lead">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={value === t.id ? 'active' : ''} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}
