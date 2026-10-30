import { useState } from 'react';
import { api } from '../api.js';

const EMPTY = { name: '', email: '', password: '', confirm: '' };
const DEMO_PASSWORD = 'Demo1234';
const DEMO_EMAILS = ['ada@example.com', 'alan@example.com', 'grace@example.com'];

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
const STRENGTH = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === 'register';

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setForm((f) => ({ ...EMPTY, email: f.email }));
  };

  const validate = () => {
    if (isRegister) {
      if (!form.name.trim()) return 'Please enter your full name';
      if (form.password.length < 8) return 'Password must be at least 8 characters';
      if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
        return 'Password must contain at least one letter and one number';
      if (form.password !== form.confirm) return 'Passwords do not match';
    }
    if (!form.email.trim() || !form.password) return 'Email and password are required';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { user } = isRegister
        ? await api.register(form.name.trim(), form.email.trim(), form.password)
        : await api.login(form.email.trim(), form.password);
      onAuthenticated(user, isRegister);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const strength = passwordStrength(form.password);

  return (
    <main className="auth">
      <section className="auth__hero" aria-hidden="true">
        <h2>Banking that moves at your pace.</h2>
        <p>Open checking and savings accounts in seconds, move money instantly, and track every cent.</p>
        <ul className="auth__features">
          <li>⚡ Instant transfers between accounts</li>
          <li>🔒 Encrypted passwords &amp; secure sessions</li>
          <li>📊 Real-time balances and history</li>
        </ul>
      </section>

      <section className="auth__card">
        <div className="tabs" role="tablist" aria-label="Authentication">
          {[
            ['login', 'Sign in'],
            ['register', 'Create account'],
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={mode === key}
              className={`tabs__btn ${mode === key ? 'is-active' : ''}`}
              onClick={() => switchMode(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <h2 className="form__title">{isRegister ? 'Open your account' : 'Welcome back'}</h2>

          {isRegister && (
            <label className="field">
              <span>Full name</span>
              <input
                className="input"
                autoComplete="name"
                value={form.name}
                onChange={set('name')}
                maxLength={100}
                autoFocus
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              autoFocus={!isRegister}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <div className="input-group">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={set('password')}
                maxLength={128}
              />
              <button
                type="button"
                className="input-group__btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {isRegister && form.password && (
              <div className={`strength strength--${strength}`} aria-live="polite">
                <div className="strength__bar">
                  <span style={{ width: `${(strength / 4) * 100}%` }} />
                </div>
                <small>{STRENGTH[strength]}</small>
              </div>
            )}
          </label>

          {isRegister && (
            <label className="field">
              <span>Confirm password</span>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirm}
                onChange={set('confirm')}
                maxLength={128}
              />
            </label>
          )}

          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>

          <p className="form__switch">
            {isRegister ? 'Already have an account?' : 'New to Nova Bank?'}{' '}
            <button type="button" className="link" onClick={() => switchMode(isRegister ? 'login' : 'register')}>
              {isRegister ? 'Sign in' : 'Create one'}
            </button>
          </p>

          {/* Demo users only exist when the dev server seeds them (server/data/seed.js). */}
          {import.meta.env.DEV && !isRegister && (
            <div className="demo">
              <p className="demo__title">Demo accounts · password <code>{DEMO_PASSWORD}</code></p>
              <div className="demo__list">
                {DEMO_EMAILS.map((email) => (
                  <button
                    key={email}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setForm((f) => ({ ...f, email, password: DEMO_PASSWORD }));
                      setError('');
                    }}
                  >
                    {email}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
