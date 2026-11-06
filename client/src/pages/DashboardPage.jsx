import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api.js';

const formatAmount = (amount) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0
}).format(Number(amount) || 0);

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const data = await request('/api/ai-insights');
      setInsights(data.insights || []);
    } catch {
      setInsights([]);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    request('/api/dashboard')
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Unable to load dashboard.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadInsights();
  }, []);

  const renderStatusPill = (status) => {
    const className = `status-pill status-${status.toLowerCase().replaceAll(' ', '-')}`;
    return <span className={className}>{status}</span>;
  };

  const paidTotal = stats?.pickups.reduce((total, item) => total + (item.paymentStatus === 'Paid' ? Number(item.amount) || 0 : 0), 0) || 0;
  const pendingPaymentCount = stats?.pickups.filter((item) => item.paymentStatus !== 'Paid').length || 0;
  const binRequestCount = stats?.pickups.filter((item) => item.requestType === 'New Waste Bin').length || 0;

  return (
    <section className="page dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Waste Management Control Panel</p>
          <h1>Advanced Waste Operations Dashboard</h1>
        </div>
        <p>Monitor pickup demand, route status, and resident activity with a clear view of waste collection performance.</p>
      </header>

      {loading && <p>Loading dashboard...</p>}
      {error && <p className="error">{error}</p>}

      {stats && (
        <>
          <div className="dashboard-overview">
            <article className="metric-card">
              <p className="metric-label">Total Residents</p>
              <h2>{stats.users}</h2>
              <p>Registered users in the network</p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Total Pickups</p>
              <h2>{stats.pickups.length}</h2>
              <p>Collection requests received</p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Pending Requests</p>
              <h2>{stats.pending}</h2>
              <p>Pickups still awaiting dispatch</p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Scheduled Routes</p>
              <h2>{stats.pickups.filter((item) => item.status === 'Scheduled' && item.paymentStatus === 'Paid').length}</h2>
              <p>Routes planned for pickup crews</p>
            </article>
            <article className="metric-card metric-card-light">
              <p className="metric-label">Payments Verified</p>
              <h2>{formatAmount(paidTotal)}</h2>
              <p>{pendingPaymentCount} awaiting bank/provider confirmation</p>
            </article>
          </div>

          <div className="dashboard-main">
            <article className="dashboard-card activity-card">
              <div className="section-header">
                <h2>Upcoming Pickups</h2>
                <span>{stats.pickups.length} total requests</span>
              </div>
              <table className="pickup-table">
                <thead>
                  <tr>
                    <th>Resident</th>
                    <th>Address</th>
                    <th>Request</th>
                    <th>Waste Type</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.pickups.map((item) => (
                    <tr key={item.id}>
                      <td>{item.resident}</td>
                      <td>{item.address}</td>
                      <td>{item.requestType || 'Pickup'}</td>
                      <td>{item.wasteType}</td>
                      <td>{item.scheduledDate}</td>
                      <td>{renderStatusPill(item.status)}</td>
                      <td>{renderStatusPill(item.paymentStatus || 'Pending')}<small className="payment-amount">{formatAmount(item.amount)}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <aside className="dashboard-card stats-card">
              <div className="section-header">
                <h2>Collection Insights</h2>
              </div>

              <div className="mini-stat">
                <span>Daily Pickup Rate</span>
                <strong>{Math.round(stats.pickups.length / 7)} per day</strong>
              </div>
              <div className="mini-stat">
                <span>Average Route Load</span>
                <strong>{stats.pickups.length > 0 ? Math.max(1, Math.round(stats.pickups.length / 3)) : 0} stops</strong>
              </div>
              <div className="mini-stat">
                <span>New Bin Registrations</span>
                <strong>{binRequestCount} requests</strong>
              </div>
              <div className="mini-stat">
                <span>Waste Type Breakdown</span>
                <div className="waste-breakdown">
                  {Object.entries(stats.pickups.reduce((acc, item) => {
                    acc[item.wasteType] = (acc[item.wasteType] || 0) + 1;
                    return acc;
                  }, {})).map(([type, count]) => (
                    <div key={type} className="breakdown-item">
                      <strong>{count}</strong>
                      <span>{type}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="quick-actions">
                <Link className="button primary" to="/request">New Service Request</Link>
                <button className="button secondary" type="button" onClick={loadInsights}>Refresh Activity Alerts</button>
              </div>
            </aside>
          </div>

          <article className="dashboard-card ai-card">
            <div className="section-header">
              <h2>AI Demand Alerts</h2>
              <span>Service demand, bin registration, and payment signals</span>
            </div>
            {insightsLoading ? (
              <p>Reviewing recent customer activity and service demand...</p>
            ) : (
              <ul className="insight-list">
                {insights.length > 0 ? (
                  insights.map((item, index) => (
                    <li key={index}>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                    </li>
                  ))
                ) : (
                  <li>No urgent alerts at this time.</li>
                )}
              </ul>
            )}
            <button className="button secondary" type="button" onClick={loadInsights}>Refresh AI Alerts</button>
          </article>
        </>
      )}
    </section>
  );
}

export default DashboardPage;
