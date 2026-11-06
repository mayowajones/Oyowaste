import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api.js';

function AuthPage({ onLogin }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', city: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);

    const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login'
      ? { email: form.email, password: form.password }
      : { name: form.name, email: form.email, password: form.password, city: form.city };

    try {
      const result = await request(url, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      setMessage(mode === 'login' ? `Welcome back, ${result.user.name}!` : `Account created for ${result.user.name}.`);
      setForm({ name: '', email: '', password: '', city: '' });

      if (onLogin) {
        onLogin(result.user, result.token);
      }

      navigate('/request');
    } catch (err) {
      setMessage(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page auth-page">
      <div className="auth-card">
        <div className="auth-toggle">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              Full Name
              <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" minLength="2" maxLength="100" autoComplete="name" required />
            </label>
          )}

          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email" maxLength="254" autoComplete="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Password" minLength="10" maxLength="128" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </label>
          {mode === 'register' && (
            <label>
              City
              <input name="city" value={form.city} onChange={handleChange} placeholder="Ibadan" maxLength="100" autoComplete="address-level2" />
            </label>
          )}

          <button type="submit" className="button primary" disabled={submitting}>{submitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}</button>
        </form>

        {message && <p className="form-message">{message}</p>}
      </div>
    </section>
  );
}

export default AuthPage;
