# Oyowaste Waste Management System

A React + Node.js project scaffold for a waste management application built for Oyo State / Ibadan.

## Project structure

- `client/` - React + Vite frontend
- `server/` - Express backend API

These are separate frontend and backend folders inside the Desktop `Oyowaste` project. The root scripts run either side independently or start both together.

## Setup

1. Open the folder in VS Code: `c:\Users\USER\Desktop\Oyowaste`
2. Install dependencies:

```bash
npm run install-all
```

3. Start development servers from the root:

```bash
npm run dev
```

4. Or start only one side:

```bash
npm run dev:server
npm run dev:client
```

5. Open the frontend at `http://localhost:3000`

## Folder details

- Frontend uses Vite, React, and React Router.
- Backend uses Express and CORS.
- API requests are proxied through Vite to `http://localhost:4000`.

## Notes

- This scaffold runs in memory and is ready to extend with database support.
- Add MongoDB, PostgreSQL, or another persistence layer as needed.
- Hosted checkout uses Paystack. Set `PAYSTACK_SECRET_KEY` on the server only, configure the company's settlement bank account in Paystack, and optionally set `CLIENT_URL` and `PAYMENT_CALLBACK_URL` for the deployed frontend. Never expose the secret key through a `VITE_` variable.
- Configure the Paystack webhook URL as `https://<your-api-host>/api/payments/webhook`. The app verifies successful charges before marking a request paid; payment references and requests are currently held in memory, so production deployment requires persistent storage before relying on webhook reconciliation.
- The restricted operations workspace is available at `/operations`. Its customer requests, route updates, equipment inspections, daily checklist, and service alerts require an operations bearer session. The old `/dashboard` URL redirects to this protected workspace.
- Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in the backend environment before signing into operations. Optional official staff accounts can be supplied using `OPS_STAFF_JSON`, for example: `[{"name":"Operations Officer","email":"officer@example.com","password":"use-a-unique-long-password","role":"official_staff"}]`. Keep both credentials out of source control and use long, unique passwords.
- Operations sessions last eight hours and are held in memory. Requests, equipment records, and daily task updates are also in memory in this scaffold; configure persistent storage and HTTPS before production use. Google Maps links and the embedded selected stop use address search and do not require a browser API key.
