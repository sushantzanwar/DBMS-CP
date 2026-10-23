import React, { useState } from 'react';
import { apiRequest, setToken } from '../api.js';
import { Field, useForm } from './ui.jsx';

const SIZES = ['Small', 'Medium', 'Large'];

function LoginForm({ onAuthenticated }) {
  const form = useForm({ email: '', password: '' }, async (values) => {
    const { token, user } = await apiRequest('POST', '/auth/login', values);
    setToken(token);
    onAuthenticated(user);
  });
  return (
    <form onSubmit={form.onSubmit} className="auth-form">
      <Field label="Business email">
        <input type="email" required autoComplete="email" value={form.values.email} onChange={form.set('email')} />
      </Field>
      <Field label="Password">
        <input type="password" required autoComplete="current-password" value={form.values.password} onChange={form.set('password')} />
      </Field>
      {form.error && <div className="form-error">{form.error}</div>}
      <button className="btn" disabled={form.busy}>{form.busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

function RegisterForm({ onAuthenticated }) {
  const form = useForm(
    { businessName: '', industry: '', city: '', state: '', businessSize: 'Small', email: '', phone: '', website: '', description: '', password: '', confirm: '' },
    async ({ confirm, ...values }) => {
      if (values.password !== confirm) throw new Error('The two passwords do not match.');
      const { token, user } = await apiRequest('POST', '/auth/register', values);
      setToken(token);
      onAuthenticated(user);
    }
  );
  const text = (name, label, props = {}) => (
    <Field label={label}>
      <input value={form.values[name]} onChange={form.set(name)} {...props} />
    </Field>
  );
  return (
    <form onSubmit={form.onSubmit} className="auth-form">
      {text('businessName', 'Business name', { required: true, maxLength: 100 })}
      <div className="two-col">
        {text('industry', 'Industry', { required: true, maxLength: 50 })}
        <Field label="Business size">
          <select value={form.values.businessSize} onChange={form.set('businessSize')}>
            {SIZES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="two-col">
        {text('city', 'City', { required: true, maxLength: 50 })}
        {text('state', 'State', { required: true, maxLength: 50 })}
      </div>
      {text('email', 'Business email', { type: 'email', required: true, maxLength: 100, autoComplete: 'email' })}
      <div className="two-col">
        <Field label="Mobile number" hint="10 digits, starting with 6-9">
          <input
            required
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            pattern="[6-9][0-9]{9}"
            title="Enter a 10-digit mobile number starting with 6, 7, 8 or 9"
            value={form.values.phone}
            onChange={(e) => form.setValue('phone', e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        {text('website', 'Website (optional)', { maxLength: 150, placeholder: 'www.example.com' })}
      </div>
      <Field label="About your business (optional)">
        <textarea rows="2" maxLength="2000" value={form.values.description} onChange={form.set('description')} />
      </Field>
      <div className="two-col">
        <Field label="Password" hint="8+ characters with a letter and a number">
          <input
            type="password"
            required
            minLength={8}
            maxLength={72}
            pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,72}"
            title="At least 8 characters, with at least one letter and one number"
            autoComplete="new-password"
            value={form.values.password}
            onChange={form.set('password')}
          />
        </Field>
        <Field label="Confirm password">
          <input type="password" required autoComplete="new-password" value={form.values.confirm} onChange={form.set('confirm')} />
        </Field>
      </div>
      {form.error && <div className="form-error">{form.error}</div>}
      <button className="btn" disabled={form.busy}>{form.busy ? 'Creating account…' : 'Create business account'}</button>
    </form>
  );
}

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="brand">
          <span className="brand-mark">SP</span>
          <div className="brand-name">ServicePath AI</div>
        </div>
        <h1>Find the right services. Grow your business.</h1>
        <p>
          ServicePath connects businesses that need services with trusted providers. Post a request, compare
          proposals, and build a reputation through verified reviews.
        </p>
        <ul>
          <li>Discover services and businesses</li>
          <li>Request work and receive competitive proposals</li>
          <li>Track every deal from proposal to review</li>
        </ul>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>{mode === 'login' ? 'Welcome back' : 'Register your business'}</h2>
          <p className="muted">
            {mode === 'login' ? 'Sign in to your business account.' : 'Create an account to buy and provide services.'}
          </p>
          {mode === 'login' ? <LoginForm onAuthenticated={onAuthenticated} /> : <RegisterForm onAuthenticated={onAuthenticated} />}
          <div className="auth-switch">
            {mode === 'login' ? (
              <>New to ServicePath? <button onClick={() => setMode('register')}>Register your business</button></>
            ) : (
              <>Already registered? <button onClick={() => setMode('login')}>Sign in</button></>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
