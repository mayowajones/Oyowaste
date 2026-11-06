import { useEffect, useRef, useState } from 'react';
import { request } from '../api.js';

const statusOptions = ['Pending', 'Scheduled', 'In Progress', 'Completed', 'Missed', 'Cancelled'];
const taskStatuses = ['To do', 'In progress', 'Done', 'Blocked'];
const equipmentConditions = ['Good', 'Needs replacement', 'Out of service'];

function mapQuery(pickup) {
  return encodeURIComponent(`${pickup.address}, ${pickup.city || 'Oyo State'}, Nigeria`);
}

function OperationsPage() {
  const [token, setToken] = useState(() => window.sessionStorage.getItem('oyowasteOpsToken') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [overview, setOverview] = useState(null);
  const [selectedPickup, setSelectedPickup] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [approvalQueue, setApprovalQueue] = useState([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState('Voice announcements on');
  const [listening, setListening] = useState(false);
  const knownRequestIds = useRef(new Set());
  const promptedRequestIds = useRef(new Set());
  const hasLoadedRequests = useRef(false);
  const loadingOverview = useRef(false);
  const voiceEnabledRef = useRef(voiceEnabled);
  const approvalQueueRef = useRef(approvalQueue);
  const recognitionRef = useRef(null);
  voiceEnabledRef.current = voiceEnabled;
  approvalQueueRef.current = approvalQueue;

  const speak = (text) => {
    if (!voiceEnabledRef.current || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-NG';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const loadOverview = async (activeToken = token, silent = false) => {
    if (!activeToken || loadingOverview.current) return;
    loadingOverview.current = true;
    if (!silent) setBusy(true);
    setError('');
    try {
      const data = await request('/api/operations/overview', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      setOverview(data);
      setSelectedPickup((current) => data.pickups.find((pickup) => pickup.id === current?.id) || data.pickups[0] || null);
      const isFirstLoad = !hasLoadedRequests.current;
      const incoming = data.pickups.filter((pickup) => !knownRequestIds.current.has(pickup.id));
      knownRequestIds.current = new Set(data.pickups.map((pickup) => pickup.id));
      hasLoadedRequests.current = true;

      if (!isFirstLoad) {
        incoming.filter((pickup) => pickup.status === 'Pending' && pickup.paymentStatus !== 'Paid').forEach((pickup) => {
          speak(`New request from ${pickup.resident}, at ${pickup.address}, ${pickup.city}. It is waiting for payment verification.`);
        });
      }

      const eligibleRequests = data.pickups.filter((pickup) =>
        pickup.status === 'Pending' && pickup.paymentStatus === 'Paid' && !promptedRequestIds.current.has(pickup.id)
      );
      if (eligibleRequests.length) {
        eligibleRequests.forEach((pickup) => promptedRequestIds.current.add(pickup.id));
        setApprovalQueue((current) => [...current, ...eligibleRequests.filter((pickup) => !current.some((item) => item.id === pickup.id))]);
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load operations data.');
      if (loadError.message?.includes('authorized operations account')) signOut();
    } finally {
      loadingOverview.current = false;
      if (!silent) setBusy(false);
    }
  };

  useEffect(() => {
    if (!token) return undefined;
    loadOverview(token);
    const interval = window.setInterval(() => loadOverview(token, true), 15000);
    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!voiceEnabled) window.speechSynthesis?.cancel();
  }, [voiceEnabled]);

  const activeApproval = approvalQueue[0] || null;

  useEffect(() => {
    if (!activeApproval || !voiceEnabled) return;
    setSelectedPickup(activeApproval);
    speak(`Customer request from ${activeApproval.resident}, at ${activeApproval.address}, ${activeApproval.city}, for ${activeApproval.scheduledDate}. Payment is verified. Do you want to accept this request? Say yes or no.`);
  }, [activeApproval?.id, voiceEnabled]);

  const signOut = () => {
    const activeToken = token;
    window.sessionStorage.removeItem('oyowasteOpsToken');
    setToken('');
    setOverview(null);
    setSelectedPickup(null);
    if (activeToken) {
      request('/api/operations/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` }
      }).catch(() => {});
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request('/api/operations/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      window.sessionStorage.setItem('oyowasteOpsToken', result.token);
      setPassword('');
      setToken(result.token);
      setMessage(`Signed in as ${result.user.name} (${result.user.role.replaceAll('_', ' ')}).`);
    } catch (loginError) {
      setError(loginError.message || 'Operations sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const updateRequest = async (pickup, changes) => {
    setError('');
    try {
      await request(`/api/operations/requests/${pickup.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(changes)
      });
      setMessage(`Request #${pickup.id} updated.`);
      await loadOverview();
    } catch (updateError) {
      setError(updateError.message || 'Could not update request.');
    }
  };

  const decideApproval = async (approved) => {
    const pickup = approvalQueueRef.current[0];
    if (!pickup) return;
    setError('');
    try {
      await request(`/api/operations/requests/${pickup.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: approved ? 'Scheduled' : 'Cancelled' })
      });
      setMessage(approved ? `Request #${pickup.id} accepted and scheduled.` : `Request #${pickup.id} declined.`);
      setApprovalQueue((current) => current.filter((item) => item.id !== pickup.id));
      await loadOverview();
    } catch (decisionError) {
      setError(decisionError.message || 'Could not record the approval decision.');
    }
  };

  const enableVoiceControl = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus('Voice commands are unavailable in this browser. Use the Yes/No controls.');
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      setVoiceStatus('Voice announcements on');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-NG';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      const command = transcript.match(/^(yes|yeah|yep|accept|approve|no|nope|decline|reject)[.! ]*$/)?.[1];
      if (!command || !approvalQueueRef.current.length) return;
      setVoiceStatus(`Heard: ${command}`);
      decideApproval(['yes', 'yeah', 'yep', 'accept', 'approve'].includes(command));
    };
    recognition.onerror = () => {
      setListening(false);
      setVoiceStatus('Microphone unavailable. Use the Yes/No controls.');
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      setVoiceStatus('Listening for “yes” or “no”');
    } catch {
      setVoiceStatus('Could not start voice commands. Use the Yes/No controls.');
    }
  };

  const updateEquipment = async (item, form) => {
    setError('');
    try {
      await request(`/api/operations/equipment/${item.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          available: Number(form.get('available')),
          condition: form.get('condition'),
          notes: form.get('notes')
        })
      });
      setMessage(`${item.name} stock check recorded.`);
      await loadOverview();
    } catch (updateError) {
      setError(updateError.message || 'Could not save equipment check.');
    }
  };

  const updateTask = async (task, status, owner = task.owner || '') => {
    setError('');
    try {
      await request(`/api/operations/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, owner })
      });
      await loadOverview();
    } catch (updateError) {
      setError(updateError.message || 'Could not update daily task.');
    }
  };

  if (!token || !overview) {
    return (
      <section className="page operations-login-page">
        <div className="operations-login-copy">
          <p className="eyebrow">Restricted workspace</p>
          <h1>Oyo State operations</h1>
          <p>Authorized super administrators and official operations staff only.</p>
          <ul>
            <li>Customer requests and route planning</li>
            <li>Daily crew tasks and equipment checks</li>
            <li>Payment and service demand alerts</li>
          </ul>
        </div>
        <form className="operations-login-form" onSubmit={handleLogin}>
          <h2>Operations sign in</h2>
          <label>
            Official email
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="button primary" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in to operations'}</button>
        </form>
      </section>
    );
  }

  const completedTasks = overview.dailyTasks.filter((task) => task.status === 'Done').length;
  const canManageEquipment = ['admin', 'superadmin'].includes(overview.user.role);
  const selectedMap = selectedPickup ? mapQuery(selectedPickup) : '';

  return (
    <section className="page operations-page">
      <header className="operations-header">
        <div>
          <p className="eyebrow">Oyo State Management</p>
          <h1>Daily operations</h1>
          <p>{overview.date} · Signed in as {overview.user.name} · {overview.user.role.replaceAll('_', ' ')}</p>
        </div>
        <div className="operations-header-actions">
          <button className="button secondary" type="button" onClick={() => setVoiceEnabled((enabled) => !enabled)} aria-pressed={voiceEnabled}>{voiceEnabled ? 'Voice on' : 'Voice off'}</button>
          <button className="button secondary" type="button" onClick={enableVoiceControl} aria-pressed={listening}>{listening ? 'Stop listening' : 'Enable voice commands'}</button>
          <button className="button secondary" type="button" onClick={() => loadOverview()} disabled={busy}>{busy ? 'Updating...' : 'Refresh'}</button>
          <button className="button secondary" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="voice-status" role="status">{voiceStatus} · Requests refresh automatically every 15 seconds.</div>

      {error && <p className="error operations-message" role="alert">{error}</p>}
      {message && <p className="form-message operations-message" role="status">{message}</p>}

      {activeApproval && (
        <section className="approval-prompt" aria-labelledby="approval-title">
          <div>
            <p className="eyebrow">Admin decision required</p>
            <h2 id="approval-title">Accept request #{activeApproval.id}?</h2>
            <p><strong>{activeApproval.resident}</strong> · {activeApproval.requestType || 'Pickup'} · {activeApproval.wasteType}</p>
            <p>{activeApproval.address}, {activeApproval.city} · {activeApproval.scheduledDate} · Payment verified</p>
            <button className="map-link-button" type="button" onClick={() => setSelectedPickup(activeApproval)}>Show this location on map</button>
          </div>
          <div className="approval-actions">
            <button className="button primary" type="button" onClick={() => decideApproval(true)}>Yes, accept</button>
            <button className="button secondary" type="button" onClick={() => decideApproval(false)}>No, decline</button>
          </div>
        </section>
      )}

      <div className="operations-summary">
        <article><span>Requests today / all</span><strong>{overview.pickups.length}</strong></article>
        <article><span>Pending dispatch</span><strong>{overview.pickups.filter((pickup) => pickup.status === 'Pending').length}</strong></article>
        <article><span>Payments awaiting verification</span><strong>{overview.pickups.filter((pickup) => pickup.paymentStatus !== 'Paid').length}</strong></article>
        <article><span>Daily tasks completed</span><strong>{completedTasks}/{overview.dailyTasks.length}</strong></article>
      </div>

      <div className="operations-grid">
        <section className="operations-section requests-section">
          <div className="operations-section-heading">
            <div><p className="eyebrow">Dispatch desk</p><h2>Customer requests & routes</h2></div>
            <span>{overview.pickups.length} records</span>
          </div>
          <div className="operations-request-list">
            {overview.pickups.map((pickup) => (
              <article className={`operations-request ${selectedPickup?.id === pickup.id ? 'selected' : ''}`} key={pickup.id}>
                <button className="request-select" type="button" onClick={() => setSelectedPickup(pickup)}>
                  <span className="request-primary"><strong>{pickup.resident}</strong><span>#{pickup.id} · {pickup.requestType || 'Pickup'}</span></span>
                  <span className="request-address">{pickup.address}, {pickup.city}</span>
                  <span className="request-tags"><i>{pickup.status}</i><i className={pickup.paymentStatus === 'Paid' ? 'paid' : 'unpaid'}>{pickup.paymentStatus || 'Pending'} payment</i></span>
                </button>
                <div className="request-controls">
                  <label>Status
                    <select aria-label={`Request ${pickup.id} status`} value={pickup.status} onChange={(event) => updateRequest(pickup, { status: event.target.value })}>
                      {statusOptions.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>Crew
                    <input aria-label={`Request ${pickup.id} assigned crew`} defaultValue={pickup.assignedCrew || ''} placeholder="Assign crew" onBlur={(event) => {
                      if (event.target.value !== (pickup.assignedCrew || '')) updateRequest(pickup, { status: pickup.status, assignedCrew: event.target.value });
                    }} />
                  </label>
                  <a className="map-link" href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery(pickup)}`} target="_blank" rel="noreferrer">Route in Google Maps</a>
                </div>
              </article>
            ))}
          </div>
          {selectedPickup && (
            <div className="operations-map-wrap">
              <div className="map-title"><strong>Selected stop: {selectedPickup.address}</strong><a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedMap}`} target="_blank" rel="noreferrer">Open directions ↗</a></div>
              <iframe title={`Google Maps location for ${selectedPickup.resident}`} src={`https://maps.google.com/maps?q=${selectedMap}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          )}
        </section>

        {canManageEquipment && <section className="operations-section">
          <div className="operations-section-heading"><div><p className="eyebrow">Crew readiness</p><h2>Equipment inspection</h2></div></div>
          <div className="equipment-list">
            {overview.equipment.map((item) => (
              <form className="equipment-form" key={item.id} onSubmit={(event) => { event.preventDefault(); updateEquipment(item, new FormData(event.currentTarget)); }}>
                <div className="equipment-title"><strong>{item.name}</strong><span>{item.available}/{item.required} available</span></div>
                <div className="equipment-fields">
                  <label>Stock
                    <input type="number" name="available" min="0" step="1" defaultValue={item.available} required />
                  </label>
                  <label>Condition
                    <select name="condition" defaultValue={item.condition}>{equipmentConditions.map((condition) => <option key={condition}>{condition}</option>)}</select>
                  </label>
                </div>
                <label>Inspection note
                  <input name="notes" defaultValue={item.notes} placeholder="Damage, replenishment, or notes" />
                </label>
                <div className="equipment-footer"><small>{item.checkedAt ? `Checked ${new Date(item.checkedAt).toLocaleString()} by ${item.checkedBy}` : 'Not checked today'}</small><button className="button secondary" type="submit">Record check</button></div>
              </form>
            ))}
          </div>
        </section>}

        <section className="operations-section daily-section">
          <div className="operations-section-heading"><div><p className="eyebrow">Shift workflow</p><h2>Daily activity checklist</h2></div><span>{completedTasks}/{overview.dailyTasks.length} done</span></div>
          <div className="daily-task-list">
            {overview.dailyTasks.map((task) => (
              <div className="daily-task" key={task.id}>
                <span><strong>{task.title}</strong><small>{task.owner ? `Owner: ${task.owner}` : 'No owner assigned'}</small></span>
                <input aria-label={`${task.title} owner`} defaultValue={task.owner} placeholder="Assign owner" onBlur={(event) => {
                  if (event.target.value !== task.owner) updateTask(task, task.status, event.target.value);
                }} />
                <select aria-label={`${task.title} status`} value={task.status} onChange={(event) => updateTask(task, event.target.value)}>{taskStatuses.map((status) => <option key={status}>{status}</option>)}</select>
              </div>
            ))}
          </div>
        </section>

        <section className="operations-section alerts-section">
          <div className="operations-section-heading"><div><p className="eyebrow">Operations intelligence</p><h2>Service alerts</h2></div></div>
          <ul className="operations-alert-list">
            {overview.insights.map((insight) => <li key={insight.title}><strong>{insight.title}</strong><p>{insight.message}</p></li>)}
          </ul>
        </section>
      </div>
    </section>
  );
}

export default OperationsPage;
