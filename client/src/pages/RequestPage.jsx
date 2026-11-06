import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { request } from '../api.js';

function RequestPage({ currentUser, authToken }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    city: currentUser?.city || '',
    address: '',
    requestType: 'Pickup',
    wasteType: 'Household Waste',
    scheduledDate: ''
  });
  const [serviceOptions, setServiceOptions] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    request('/api/service-options')
      .then((options) => {
        setServiceOptions(options);
        setForm((previous) => ({
          ...previous,
          city: options.cities.includes(previous.city) ? previous.city : options.cities[0]
        }));
      })
      .catch((err) => setError(err.message || 'Unable to load available services.'));
  }, []);

  useEffect(() => {
    const reference = searchParams.get('reference');
    if (!reference) return;

    request(`/api/payments/verify?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then((result) => {
        setMessage(result.status === 'Paid'
          ? 'Payment confirmed by the bank. Your request is now queued for dispatch.'
          : 'The payment is not confirmed yet. Your request remains pending while the provider completes verification.');
      })
      .catch((err) => setError(err.message || 'Unable to verify the payment yet.'));
  }, [searchParams, authToken]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    if (!currentUser) {
      setError('You must be signed in to request pickup.');
      setSubmitting(false);
      return;
    }

    try {
      const result = await request('/api/pickups', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(form)
      });

      if (result.payment?.available && result.payment.checkoutUrl) {
        window.location.assign(result.payment.checkoutUrl);
        return;
      }

      setMessage(`Your ${form.requestType.toLowerCase()} request was saved with payment pending. ${result.payment?.message || 'Complete payment once online checkout is available.'}`);
      setForm((prev) => ({
        ...prev,
        address: '',
        requestType: 'Pickup',
        wasteType: 'Household Waste',
        scheduledDate: ''
      }));
    } catch (err) {
      setError(err.message || 'Unable to submit the request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <section className="page request-page">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Pickup Request</p>
            <h1>Sign in to request waste collection and payment.</h1>
          </div>
          <p>Please log in first so we can store your pickup request and payment details.</p>
        </header>
        <button className="button primary" type="button" onClick={() => navigate('/auth')}>Sign In</button>
      </section>
    );
  }

  return (
    <section className="page request-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Pickup Request</p>
          <h1>Request a pickup or register for a waste bin.</h1>
        </div>
        <p>Submit your service details, then pay securely by bank transfer or online banking through our payment provider.</p>
      </header>

      <form className="request-form" onSubmit={handleSubmit}>
        <p className="payment-note">Requesting as {currentUser.name} ({currentUser.email})</p>
        <div className="form-grid">
          <label>
            City
            <select name="city" value={form.city} onChange={handleChange} required disabled={!serviceOptions}>
              {(serviceOptions?.cities || []).map((city) => <option key={city}>{city}</option>)}
            </select>
          </label>
          <label>
            Address for pickup
            <input name="address" value={form.address} onChange={handleChange} placeholder="123 Main Street" required />
          </label>
          <label>
            Service request
            <select name="requestType" value={form.requestType} onChange={handleChange}>
              <option>Pickup</option>
              <option>New Waste Bin</option>
            </select>
          </label>
          <label>
            Waste type
            <select name="wasteType" value={form.wasteType} onChange={handleChange}>
              <option>Household Waste</option>
              <option>Recyclables</option>
              <option>Garden Waste</option>
              <option>Electronic Waste</option>
            </select>
          </label>
          <label>
            Scheduled date
            <input type="date" name="scheduledDate" value={form.scheduledDate} onChange={handleChange} required />
          </label>
        </div>

        <p className="payment-note">Service price: {serviceOptions
          ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(serviceOptions.prices[form.requestType])
          : 'Loading approved price...'}</p>
        <p className="payment-note">Payment is only marked complete after the bank/provider confirms it. Your service request stays pending until verification.</p>
        {error && <p className="error">{error}</p>}
        {message && <p className="form-message">{message}</p>}

        <button className="button primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit request and continue to payment'}
        </button>
        <Link className="payment-help-link" to="/about">Payment and service information</Link>
      </form>
    </section>
  );
}

export default RequestPage;
