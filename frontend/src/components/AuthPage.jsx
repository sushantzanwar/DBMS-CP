import React, { useState } from 'react';
import { apiRequest, setToken } from '../api.js';
import { ServicePathLogo } from './BrandLogo.jsx';
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
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          spellCheck={false}
          placeholder="contact@company.com…"
          value={form.values.email}
          onChange={form.set('email')}
        />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Enter your password…"
          value={form.values.password}
          onChange={form.set('password')}
        />
      </Field>
      {form.error && <div className="form-error" role="alert">{form.error}</div>}
      <button type="submit" className="btn full-width" disabled={form.busy}>
        {form.busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function RegisterForm({ onAuthenticated }) {
  const form = useForm(
    {
      businessName: '',
      industry: '',
      city: '',
      state: '',
      businessSize: 'Small',
      email: '',
      phone: '',
      website: '',
      description: '',
      password: '',
      confirm: '',
    },
    async ({ confirm, ...values }) => {
      if (values.password !== confirm) throw new Error('The two passwords do not match.');
      const { token, user } = await apiRequest('POST', '/auth/register', values);
      setToken(token);
      onAuthenticated(user);
    }
  );

  const text = (name, label, props = {}, optional = false) => (
    <Field label={label} optional={optional}>
      <input name={name} value={form.values[name]} onChange={form.set(name)} {...props} />
    </Field>
  );

  return (
    <form onSubmit={form.onSubmit} className="auth-form">
      <fieldset className="form-group">
        <legend>Business details</legend>
        <div className="stack-sm">
          {text('businessName', 'Business name', {
            required: true,
            maxLength: 100,
            autoComplete: 'organization',
            placeholder: 'Acme Engineering Pvt. Ltd.…',
          })}
          <div className="two-col">
            {text('industry', 'Industry', {
              required: true,
              maxLength: 50,
              placeholder: 'Information Technology…',
            })}
            <Field label="Business size">
              <select name="businessSize" value={form.values.businessSize} onChange={form.set('businessSize')}>
                {SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="two-col">
            {text('city', 'City', { required: true, maxLength: 50, autoComplete: 'address-level2', placeholder: 'Pune…' })}
            {text('state', 'State', { required: true, maxLength: 50, autoComplete: 'address-level1', placeholder: 'Maharashtra…' })}
          </div>
          <Field label="About your business" optional>
            <textarea
              name="description"
              rows="2"
              maxLength={2000}
              placeholder="Core services offered or typical projects sourced…"
              value={form.values.description}
              onChange={form.set('description')}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend>Contact & account security</legend>
        <div className="stack-sm">
          {text('email', 'Business email', {
            type: 'email',
            required: true,
            maxLength: 100,
            autoComplete: 'email',
            spellCheck: false,
            placeholder: 'team@company.com…',
          })}
          <div className="two-col">
            <Field label="Mobile number" hint="10 digits, starting with 6–9">
              <input
                name="phone"
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                placeholder="9876500011…"
                title="Enter a 10-digit mobile number starting with 6, 7, 8 or 9"
                value={form.values.phone}
                onChange={(e) => form.setValue('phone', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            {text(
              'website',
              'Website',
              {
                maxLength: 150,
                spellCheck: false,
                autoComplete: 'url',
                placeholder: 'www.example.com…',
              },
              true
            )}
          </div>
          <div className="two-col">
            <Field label="Password" hint="8–72 characters, at least 1 letter and 1 number">
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,72}"
                title="At least 8 characters, with at least one letter and one number"
                autoComplete="new-password"
                placeholder="Create password…"
                value={form.values.password}
                onChange={form.set('password')}
              />
            </Field>
            <Field label="Confirm password">
              <input
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Repeat password…"
                value={form.values.confirm}
                onChange={form.set('confirm')}
              />
            </Field>
          </div>
        </div>
      </fieldset>

      {form.error && <div className="form-error" role="alert">{form.error}</div>}
      <button type="submit" className="btn full-width" disabled={form.busy}>
        {form.busy ? 'Creating account…' : 'Create business account'}
      </button>
    </form>
  );
}

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-brand-row">
            <ServicePathLogo theme="light" size="lg" />
          </div>
          <h1>{mode === 'login' ? 'Sign in to your desk' : 'Register your business'}</h1>
          <p className="muted auth-sub">
            {mode === 'login'
              ? 'Enter your registered business email and password.'
              : 'Set up one account to source services and bid on open work.'}
          </p>

          {mode === 'login' ? (
            <LoginForm onAuthenticated={onAuthenticated} />
          ) : (
            <RegisterForm onAuthenticated={onAuthenticated} />
          )}

          <div className="auth-switch">
            {mode === 'login' ? (
              <>
                New to ServicePath?{' '}
                <button type="button" onClick={() => setMode('register')}>
                  Register your business
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => setMode('login')}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <aside className="auth-brief" aria-label="About ServicePath AI">
        <h2>One workspace for scoping work and comparing bids.</h2>
        <p>
          ServicePath connects B2B buyers and service providers across IT, Marketing, Finance, and Design with
          transparent budgets, structured proposals, and verified deal histories.
        </p>
        <dl className="auth-points">
          <div>
            <dt>For buyers</dt>
            <dd>Publish scoped requests with clear budget ranges, compare quotes side by side against target budget fit, and review SQL-ranked provider matches.</dd>
          </div>
          <div>
            <dt>For providers</dt>
            <dd>Submit itemized proposals on open scopes, track delivery milestones from acceptance to completion, and build verifiable reputation ratings.</dd>
          </div>
          <div>
            <dt>Decision tools</dt>
            <dd>Run read-only backup provider simulations before committing, and inspect category demand trends.</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
