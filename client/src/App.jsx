import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import RequestPage from './pages/RequestPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import OperationsPage from './pages/OperationsPage.jsx';
import { request } from './api.js';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem('oyowasteResidentToken') || '');

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      return undefined;
    }

    let active = true;
    request('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(({ user }) => { if (active) setCurrentUser(user); })
      .catch(() => {
        if (!active) return;
        window.localStorage.removeItem('oyowasteResidentToken');
        setAuthToken('');
        setCurrentUser(null);
      });

    return () => { active = false; };
  }, [authToken]);

  const handleLogin = (user, token) => {
    setCurrentUser(user);
    window.localStorage.setItem('oyowasteResidentToken', token);
    setAuthToken(token);
  };

  const handleLogout = () => {
    const token = authToken;
    setCurrentUser(null);
    setAuthToken('');
    window.localStorage.removeItem('oyowasteResidentToken');
    if (token) {
      request('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Oyowaste</div>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/about">About Us</Link>
          <Link to="/operations">Operations</Link>
          <Link to="/request">Request Pickup</Link>
          <Link to="/auth">Sign In / Register</Link>
          {currentUser && <button className="button secondary logout-button" type="button" onClick={handleLogout}>Logout</button>}
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage currentUser={currentUser} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/dashboard" element={<Navigate to="/operations" replace />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/auth" element={<AuthPage onLogin={handleLogin} />} />
          <Route path="/request" element={<RequestPage currentUser={currentUser} authToken={authToken} />} />
        </Routes>
      </main>

      <footer className="footer">Oyowaste Waste Management — Oyo State / Ibadan</footer>
    </div>
  );
}

export default App;
