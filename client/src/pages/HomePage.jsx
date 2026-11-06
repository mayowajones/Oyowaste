import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api.js';

function HomePage({ currentUser }) {
  const [dashboard, setDashboard] = useState(null);
  const [apiState, setApiState] = useState('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    let active = true;

    const loadActivity = async () => {
      setRefreshing(true);
      const summaryResult = await Promise.allSettled([request('/api/public-summary')]);

      if (!active) return;
      if (summaryResult[0].status === 'fulfilled') {
        setDashboard(summaryResult[0].value);
        setApiState('online');
      } else {
        setApiState('offline');
      }
      setRefreshing(false);
    };

    loadActivity();
    const interval = window.setInterval(loadActivity, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshCounter]);

  const requestCount = dashboard?.requests;
  const pendingCount = dashboard?.pending;

  return (
    <section className="page home-page">
      <div className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Oyowaste Management System</p>
          <h1>A Cleaner Oyo State, A Better Tomorrow</h1>
          <p>Smart waste collection, easy payments, real-time tracking, and a cleaner environment for all residents.</p>
          <div className="hero-actions">
            <Link to={currentUser ? '/request' : '/auth'} className="button primary">
              {currentUser ? 'Request Pickup' : 'Sign In to Request'}
            </Link>
            <Link to="/dashboard" className="button secondary">View Dashboard</Link>
            <Link to="/about" className="button secondary">About Us</Link>
          </div>
        </div>

        <div className="hero-truck">
          <div className="hero-truck-card">
            <span className="tag">Operations in action</span>
            <h2>Truck routes, bins, and pickup crews working together.</h2>
            <p>Track real-time collection activity across Oyo State with a smarter waste management system.</p>
            <div className="truck-stat-row">
              <div>
                <strong>{dashboard ? requestCount : '--'}</strong>
                <span>Customer requests</span>
              </div>
              <div>
                <strong>{dashboard ? pendingCount : '--'}</strong>
                <span>Awaiting dispatch</span>
              </div>
            </div>
          </div>
          <div className="hero-image-grid">
            <div className="hero-truck-image large">
              <img
                src="https://images.unsplash.com/photo-1651996378349-4b76df4a2dc6?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Waste management crew working at a community site"
              />
            </div>
            <div className="hero-truck-image small">
              <img
                src="https://images.unsplash.com/photo-1612145342813-849b0c3e7f71?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8dHJhc2glMjB0cnVja3xlbnwwfHwwfHx8MA%3D%3D"
                alt="Waste truck on the road"
              />
            </div>
          </div>
        </div>
      </div>

      <section className="home-pulse" aria-labelledby="pulse-title">
        <div className="pulse-heading">
          <div>
            <p className="eyebrow">Oyo service pulse</p>
            <h2 id="pulse-title">Community activity, live</h2>
          </div>
          <div className={`api-indicator api-${apiState}`} role="status">
            <span aria-hidden="true" />
            {apiState === 'online' ? 'Service online' : apiState === 'loading' ? 'Connecting' : 'Service offline'}
          </div>
        </div>

        <div className="pulse-content">
          <div className="pulse-metrics">
            <article>
              <span>Requests received</span>
              <strong>{dashboard ? requestCount : '--'}</strong>
            </article>
            <article>
              <span>New bin registrations</span>
              <strong>{dashboard ? dashboard.binRegistrations : '--'}</strong>
            </article>
            <article>
              <span>Need attention</span>
              <strong>{dashboard ? pendingCount : '--'}</strong>
            </article>
          </div>

          <div className="pulse-alert">
            <div className="pulse-alert-icon" aria-hidden="true">!</div>
            <div>
              <strong>{apiState === 'offline' ? 'Live activity is unavailable' : 'Service activity is updating'}</strong>
              <p>{apiState === 'offline'
                ? 'Start the Oyowaste API to see current requests and service alerts.'
                : `${requestCount || 0} customer requests are recorded. Authorized operations staff can review customer locations and service alerts in the operations workspace.`}</p>
            </div>
          </div>
        </div>

        <div className="pulse-footer">
          <span>Updates automatically every 30 seconds</span>
          <button className="pulse-refresh" type="button" onClick={() => setRefreshCounter((counter) => counter + 1)} disabled={refreshing}>
            {refreshing ? 'Updating...' : 'Refresh activity'}
          </button>
          <Link to="/dashboard">Open operations dashboard</Link>
        </div>
      </section>

      <div className="feature-grid">
        <article>
          <h3>Easy Pickup</h3>
          <p>Request waste pickup in a few clicks and receive timely service.</p>
        </article>
        <article>
          <h3>Real-time Tracking</h3>
          <p>Monitor collection status and route progress across Ibadan neighborhoods.</p>
        </article>
        <article>
          <h3>Smart AI Alerts</h3>
          <p>Detect areas that need new bin requests, payment follow-ups, or sales outreach automatically.</p>
        </article>
        <article>
          <h3>Secure Payments</h3>
          <p>Pay safely using multiple methods and keep your city clean.</p>
        </article>
      </div>
    </section>
  );
}

export default HomePage;
