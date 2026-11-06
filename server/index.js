const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const serviceCities = (process.env.SERVICE_CITIES || 'Ibadan')
  .split(',')
  .map((city) => city.trim())
  .filter(Boolean);
const servicePrices = {
  Pickup: Number(process.env.PICKUP_PRICE_NGN || 5000),
  'New Waste Bin': Number(process.env.NEW_WASTE_BIN_PRICE_NGN || 5000)
};
const supportedWasteTypes = ['Household Waste', 'Recyclables', 'Garden Waste', 'Electronic Waste'];

if (!serviceCities.length || Object.values(servicePrices).some((price) => !Number.isSafeInteger(price) || price <= 0)) {
  throw new Error('Configure at least one SERVICE_CITIES value and positive whole-naira service prices.');
}

app.use(cors());

let users = [
];

let pickups = [
  {
    id: 1,
    resident: 'Aisha Bello',
    address: 'Bodija, Ibadan',
    city: 'Ibadan',
    requestType: 'Pickup',
    wasteType: 'Household Waste',
    scheduledDate: '2026-08-10',
    status: 'Scheduled',
    paymentStatus: 'Paid',
    amount: 5000,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    resident: 'Tunji Ade',
    address: 'Akobo, Ibadan',
    city: 'Ibadan',
    requestType: 'Pickup',
    wasteType: 'Plastic & Recyclables',
    scheduledDate: '2026-08-12',
    status: 'Pending',
    paymentStatus: 'Pending',
    amount: 5000,
    createdAt: new Date().toISOString()
  }
];

const operationsSessions = new Map();
const residentSessions = new Map();
const residentLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' }
});
const residentRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again in 15 minutes.' }
});
const operationsLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' }
});
const equipment = [
  { id: 'gloves', name: 'Hand gloves', required: 20, available: 20, condition: 'Good', checkedAt: null, checkedBy: '', notes: '' },
  { id: 'coveralls', name: 'Protective kit wear', required: 12, available: 12, condition: 'Good', checkedAt: null, checkedBy: '', notes: '' },
  { id: 'rainboots', name: 'Rain boots', required: 12, available: 12, condition: 'Good', checkedAt: null, checkedBy: '', notes: '' },
  { id: 'nose-masks', name: 'Nose masks', required: 20, available: 20, condition: 'Good', checkedAt: null, checkedBy: '', notes: '' }
];

const dailyTasks = [
  { id: 'morning-briefing', title: 'Hold crew safety and route briefing', status: 'To do', owner: '' },
  { id: 'vehicle-check', title: 'Inspect collection vehicles and fuel', status: 'To do', owner: '' },
  { id: 'equipment-check', title: 'Check PPE stock and condition', status: 'To do', owner: '' },
  { id: 'route-dispatch', title: 'Assign and dispatch today\'s paid requests', status: 'To do', owner: '' },
  { id: 'closeout', title: 'Record completed pickups and missed stops', status: 'To do', owner: '' }
];

function credentialHash(password, salt) {
  return crypto.scryptSync(password, salt, 32);
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function publicResident(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, city: user.city };
}

function createResidentSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  residentSessions.set(token, { userId: user.id, expiresAt });
  return { token, expiresAt };
}

function readBearerToken(req) {
  const authorization = req.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function requireResidentAccess(req, res, next) {
  const token = readBearerToken(req);
  const session = residentSessions.get(token);
  const user = session && users.find((item) => item.id === session.userId);
  if (!session || session.expiresAt <= Date.now() || !user) {
    if (token) residentSessions.delete(token);
    return res.status(401).json({ error: 'Sign in to your resident account to continue.' });
  }
  req.residentUser = user;
  req.residentToken = token;
  return next();
}

function configuredOperationsUsers() {
  const users = [];
  if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
    users.push({
      email: process.env.SUPER_ADMIN_EMAIL.toLowerCase(),
      name: process.env.SUPER_ADMIN_NAME || 'Super Administrator',
      role: 'superadmin',
      passwordHash: credentialHash(process.env.SUPER_ADMIN_PASSWORD, 'oyowaste-superadmin-v1')
    });
  }

  if (process.env.OPS_STAFF_JSON) {
    try {
      const staff = JSON.parse(process.env.OPS_STAFF_JSON);
      if (!Array.isArray(staff)) throw new Error('OPS_STAFF_JSON must be an array.');
      staff.forEach((member) => {
        if (!member.email || !member.password || !member.name) return;
        users.push({
          email: String(member.email).toLowerCase(),
          name: String(member.name),
          role: member.role === 'admin' ? 'admin' : 'official_staff',
          passwordHash: credentialHash(String(member.password), `oyowaste-staff:${String(member.email).toLowerCase()}`)
        });
      });
    } catch {
      throw new Error('OPS_STAFF_JSON is invalid. Provide a JSON array of official staff accounts.');
    }
  }
  return users;
}

function requireOperationsAccess(req, res, next) {
  const token = readBearerToken(req);
  const session = operationsSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) operationsSessions.delete(token);
    return res.status(401).json({ error: 'Sign in with an authorized operations account to continue.' });
  }
  req.operationsUser = session.user;
  req.operationsToken = token;
  return next();
}

function requireOperationsRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.operationsUser.role)) {
      return res.status(403).json({ error: 'Your operations role does not allow this action.' });
    }
    return next();
  };
}

function generateAIInsights() {
  const insights = [];
  const pendingPickups = pickups.filter((item) => item.status === 'Pending');
  const duePayments = pickups.filter((item) => item.paymentStatus === 'Pending');
  const pendingBinRequests = pickups.filter((item) => item.requestType === 'New Waste Bin' && item.paymentStatus !== 'Paid');
  const recentRequests = pickups.filter((item) => Date.now() - new Date(item.createdAt || 0).getTime() < 24 * 60 * 60 * 1000);
  const areaCounts = pickups.reduce((acc, item) => {
    const area = item.city || item.address.split(',').pop().trim();
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});
  const busiestArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0];

  if (recentRequests.length > 0) {
    insights.push({
      title: 'New customer activity',
      message: `${recentRequests.length} request(s) arrived in the last 24 hours${recentRequests[0].city ? `, including ${recentRequests[0].city}` : ''}. Review availability and confirm the next service steps.`
    });
  }

  if (pendingBinRequests.length > 0) {
    insights.push({
      title: 'Waste-bin registrations awaiting payment',
      message: `${pendingBinRequests.length} new bin request(s) are not yet paid. Keep bin allocation unconfirmed until the payment provider verifies the transaction.`
    });
  }

  if (pendingPickups.length > 0) {
    insights.push({
      title: 'Pending pickup requests',
      message: `There are ${pendingPickups.length} pending request(s) in ${pendingPickups.map((item) => item.address).join(', ')}. Dispatch a crew soon.`
    });
  }

  if (duePayments.length > 0) {
    insights.push({
      title: 'Payment follow-up needed',
      message: `${duePayments.length} request(s) have payments awaiting provider confirmation. Do not mark these as paid based on a customer screenshot alone.`
    });
  }

  if (busiestArea && busiestArea[1] >= 2) {
    insights.push({
      title: 'High service demand area',
      message: `The busiest area is ${busiestArea[0]} with ${busiestArea[1]} pickup requests. Consider offering new bin requests or sales outreach there.`
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: 'No urgent alerts',
      message: 'All pickups are on schedule and no immediate billing or bin requests are detected.'
    });
  }

  return insights;
}

async function initializeCheckout(pickup) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return { available: false, message: 'Online payment is not configured yet. Contact the service provider to complete setup.' };
  }

  const reference = `oyowaste-${pickup.id}-${crypto.randomUUID()}`;
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: pickup.email,
      amount: Math.round(Number(pickup.amount) * 100),
      reference,
      callback_url: process.env.PAYMENT_CALLBACK_URL || `${process.env.CLIENT_URL || 'http://localhost:3000'}/request`,
      metadata: { pickupId: pickup.id, requestType: pickup.requestType }
    })
  });
  const result = await response.json();
  if (!response.ok || !result.status || !result.data?.authorization_url) {
    throw new Error(result.message || 'Payment provider could not create a checkout session.');
  }

  pickup.paymentReference = reference;
  return { available: true, checkoutUrl: result.data.authorization_url, reference };
}

function markPaymentPaid(reference, paidAmount) {
  const pickup = pickups.find((item) => item.paymentReference === reference);
  if (!pickup || Math.round(Number(pickup.amount) * 100) !== Number(paidAmount)) return null;
  pickup.paymentStatus = 'Paid';
  pickup.paidAt = new Date().toISOString();
  return pickup;
}

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.get('x-paystack-signature');
  if (!secretKey || !signature || !Buffer.isBuffer(req.body)) return res.sendStatus(401);

  const expected = crypto.createHmac('sha512', secretKey).update(req.body).digest('hex');
  const suppliedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return res.sendStatus(401);
  }

  try {
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'charge.success') markPaymentPaid(event.data.reference, event.data.amount);
  } catch {
    return res.sendStatus(400);
  }
  return res.sendStatus(200);
});

app.use(express.json());

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Oyowaste API is running' });
});

app.get('/api/public-summary', (req, res) => {
  res.json({
    requests: pickups.length,
    pending: pickups.filter((pickup) => pickup.status === 'Pending').length,
    binRegistrations: pickups.filter((pickup) => pickup.requestType === 'New Waste Bin').length
  });
});

app.post('/api/operations/login', operationsLoginLimiter, (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const user = configuredOperationsUsers().find((candidate) => candidate.email === String(email).toLowerCase());
  if (!user || !crypto.timingSafeEqual(user.passwordHash, credentialHash(String(password), user.role === 'superadmin' ? 'oyowaste-superadmin-v1' : `oyowaste-staff:${user.email}`))) {
    return res.status(401).json({ error: 'Invalid operations email or password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const safeUser = { name: user.name, email: user.email, role: user.role };
  operationsSessions.set(token, { user: safeUser, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return res.json({ token, user: safeUser, expiresIn: 28800 });
});

app.post('/api/operations/logout', requireOperationsAccess, (req, res) => {
  operationsSessions.delete(req.operationsToken);
  return res.sendStatus(204);
});

app.get('/api/operations/overview', requireOperationsAccess, (req, res) => {
  res.json({
    user: req.operationsUser,
    date: new Date().toISOString().slice(0, 10),
    pickups,
    equipment,
    dailyTasks,
    insights: generateAIInsights()
  });
});

app.patch('/api/operations/requests/:id', requireOperationsAccess, (req, res) => {
  const pickup = pickups.find((item) => item.id === Number(req.params.id));
  const allowedStatuses = ['Pending', 'Scheduled', 'In Progress', 'Completed', 'Missed', 'Cancelled'];
  if (!pickup) return res.status(404).json({ error: 'Request not found.' });
  if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ error: 'Choose a valid operational status.' });
  if (req.body.status === 'Scheduled' && pickup.paymentStatus !== 'Paid') {
    return res.status(409).json({ error: 'Only provider-verified paid requests can be scheduled.' });
  }
  pickup.status = req.body.status;
  pickup.assignedCrew = typeof req.body.assignedCrew === 'string' ? req.body.assignedCrew.slice(0, 100) : pickup.assignedCrew || '';
  return res.json({ pickup });
});

app.patch('/api/operations/equipment/:id', requireOperationsAccess, requireOperationsRole('admin', 'superadmin'), (req, res) => {
  const item = equipment.find((entry) => entry.id === req.params.id);
  const { available, condition, notes } = req.body || {};
  if (!item) return res.status(404).json({ error: 'Equipment item not found.' });
  if (!Number.isInteger(Number(available)) || Number(available) < 0) return res.status(400).json({ error: 'Available stock must be a non-negative whole number.' });
  if (!['Good', 'Needs replacement', 'Out of service'].includes(condition)) return res.status(400).json({ error: 'Choose a valid equipment condition.' });
  item.available = Number(available);
  item.condition = condition;
  item.notes = typeof notes === 'string' ? notes.slice(0, 300) : '';
  item.checkedAt = new Date().toISOString();
  item.checkedBy = req.operationsUser.name;
  return res.json({ equipment: item });
});

app.patch('/api/operations/tasks/:id', requireOperationsAccess, (req, res) => {
  const task = dailyTasks.find((entry) => entry.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Daily task not found.' });
  if (!['To do', 'In progress', 'Done', 'Blocked'].includes(req.body.status)) return res.status(400).json({ error: 'Choose a valid task status.' });
  task.status = req.body.status;
  if (typeof req.body.owner === 'string') task.owner = req.body.owner.slice(0, 100);
  return res.json({ task });
});

app.get('/api/service-options', (req, res) => {
  res.json({ cities: serviceCities, prices: servicePrices, wasteTypes: supportedWasteTypes });
});

app.post('/api/auth/register', residentRegisterLimiter, (req, res) => {
  const { name, email, password, city } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedCity = typeof city === 'string' ? city.trim() : serviceCities[0];
  if (normalizedName.length < 2 || normalizedName.length > 100) {
    return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 10 and 128 characters.' });
  }
  if (!serviceCities.some((supportedCity) => supportedCity.toLowerCase() === normalizedCity.toLowerCase())) {
    return res.status(400).json({ error: 'Service is not available in that city.' });
  }
  if (users.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ error: 'A user with that email already exists.' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const newUser = {
    id: crypto.randomUUID(),
    name: normalizedName,
    email: normalizedEmail,
    passwordSalt: salt,
    passwordHash: credentialHash(password, salt).toString('hex'),
    role: 'resident',
    city: serviceCities.find((supportedCity) => supportedCity.toLowerCase() === normalizedCity.toLowerCase())
  };
  users.push(newUser);
  const session = createResidentSession(newUser);
  return res.status(201).json({ user: publicResident(newUser), ...session });
});

app.post('/api/auth/login', residentLoginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find((item) => item.email === normalizeEmail(email));
  const suppliedHash = user && typeof password === 'string'
    ? credentialHash(password, user.passwordSalt)
    : Buffer.alloc(32);
  const storedHash = user ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(32);
  if (!user || storedHash.length !== suppliedHash.length || !crypto.timingSafeEqual(storedHash, suppliedHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  return res.json({ user: publicResident(user), ...createResidentSession(user) });
});

app.get('/api/auth/me', requireResidentAccess, (req, res) => {
  return res.json({ user: publicResident(req.residentUser) });
});

app.post('/api/auth/logout', requireResidentAccess, (req, res) => {
  residentSessions.delete(req.residentToken);
  return res.sendStatus(204);
});

app.get('/api/pickups/mine', requireResidentAccess, (req, res) => {
  return res.json(pickups.filter((item) => item.userId === req.residentUser.id));
});

app.get('/api/pickups', requireOperationsAccess, (req, res) => {
  res.json(pickups);
});

app.post('/api/pickups', requireResidentAccess, async (req, res) => {
  const { city, address, requestType, wasteType, scheduledDate } = req.body || {};
  const normalizedCity = typeof city === 'string' ? city.trim() : '';
  const normalizedAddress = typeof address === 'string' ? address.trim() : '';
  const dateIsValid = typeof scheduledDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)
    && !Number.isNaN(Date.parse(`${scheduledDate}T00:00:00.000Z`))
    && new Date(`${scheduledDate}T00:00:00.000Z`).toISOString().slice(0, 10) === scheduledDate;
  if (!serviceCities.some((supportedCity) => supportedCity.toLowerCase() === normalizedCity.toLowerCase())) {
    return res.status(400).json({ error: 'Service is not available in that city.' });
  }
  if (normalizedAddress.length < 5 || normalizedAddress.length > 250) {
    return res.status(400).json({ error: 'Enter an address between 5 and 250 characters.' });
  }
  if (!Object.hasOwn(servicePrices, requestType)) {
    return res.status(400).json({ error: 'Choose a valid service request.' });
  }
  if (!supportedWasteTypes.includes(wasteType)) {
    return res.status(400).json({ error: 'Choose a supported waste type.' });
  }
  if (!dateIsValid || scheduledDate < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'Choose a valid service date that is not in the past.' });
  }

  const newPickup = {
    id: pickups.reduce((maximum, item) => Math.max(maximum, Number(item.id) || 0), 0) + 1,
    userId: req.residentUser.id,
    resident: req.residentUser.name,
    email: req.residentUser.email,
    city: serviceCities.find((supportedCity) => supportedCity.toLowerCase() === normalizedCity.toLowerCase()),
    address: normalizedAddress,
    requestType,
    wasteType,
    scheduledDate,
    amount: servicePrices[requestType],
    status: 'Pending',
    paymentStatus: 'Pending',
    createdAt: new Date().toISOString()
  };

  pickups.push(newPickup);
  try {
    const payment = await initializeCheckout(newPickup);
    return res.status(201).json({ pickup: newPickup, payment });
  } catch (error) {
    return res.status(201).json({
      pickup: newPickup,
      payment: { available: false, message: error.message || 'The request was saved, but checkout could not be started.' }
    });
  }
});

app.post('/api/payments/:pickupId/checkout', requireResidentAccess, async (req, res) => {
  const pickup = pickups.find((item) => item.id === Number(req.params.pickupId));
  if (!pickup) return res.status(404).json({ error: 'Request not found.' });
  if (pickup.userId !== req.residentUser.id) return res.status(404).json({ error: 'Request not found.' });
  if (pickup.paymentStatus === 'Paid') return res.status(409).json({ error: 'This request is already paid.' });
  try {
    const payment = await initializeCheckout(pickup);
    return res.json({ payment });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Unable to start checkout.' });
  }
});

app.get('/api/payments/verify', requireResidentAccess, async (req, res) => {
  const { reference } = req.query;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !reference) return res.status(400).json({ error: 'A payment reference is required.' });

  const pickup = pickups.find((item) => item.paymentReference === reference);
  if (!pickup) return res.status(404).json({ error: 'Payment reference was not found.' });
  if (pickup.userId !== req.residentUser.id) return res.status(404).json({ error: 'Payment reference was not found.' });
  if (pickup.paymentStatus === 'Paid') return res.json({ status: 'Paid', pickupId: pickup.id });

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const result = await response.json();
    if (!response.ok || !result.status) return res.status(502).json({ error: 'Payment verification is temporarily unavailable.' });
    const verified = result.data?.status === 'success' ? markPaymentPaid(reference, result.data.amount) : null;
    if (verified) return res.json({ status: 'Paid', pickupId: verified.id });
    return res.json({ status: result.data?.status || 'Pending', pickupId: pickup.id });
  } catch {
    return res.status(502).json({ error: 'Payment verification is temporarily unavailable.' });
  }
});

app.get('/api/dashboard', requireOperationsAccess, requireOperationsRole('admin', 'superadmin'), (req, res) => {
  res.json({ users: users.length, pickups: pickups.length, pending: pickups.filter((item) => item.status === 'Pending').length, pickups });
});

app.get('/api/ai-insights', requireOperationsAccess, requireOperationsRole('admin', 'superadmin'), (req, res) => {
  res.json({ insights: generateAIInsights() });
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Oyowaste server listening on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(Number(port) + 1);
      return;
    }
    console.error(err);
    process.exit(1);
  });
}

module.exports = app;

if (require.main === module) {
  startServer(PORT);
}
