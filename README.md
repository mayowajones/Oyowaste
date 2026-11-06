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

## Deploying on Vercel

The frontend and backend stay in separate folders and are deployed as two Vercel projects connected to this same GitHub repository.

### Frontend project

1. Import the repository in Vercel and set **Root Directory** to `client`.
2. Use the Vite framework preset, build command `npm run build`, and output directory `dist`.
3. Add the environment variable `VITE_API_URL` with the base URL of the deployed backend, for example `https://oyowaste-api.vercel.app` (no trailing slash).
4. Deploy or redeploy after adding the environment variable. `client/vercel.json` sends frontend routes such as `/operations` back to the app entry point.

### Backend project

1. Create a second Vercel project from the same GitHub repository and set **Root Directory** to `server`.
2. Use the Node.js/Other framework preset. Vercel serves the Express application through `server/api/[...path].js`; no custom output directory is needed.
3. Add backend environment variables in the Vercel project settings. Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` for operations sign-in. Add `PAYSTACK_SECRET_KEY` only when Paystack is configured; optional settings include `CLIENT_URL`, `PAYMENT_CALLBACK_URL`, `OPS_STAFF_JSON`, and service pricing/city variables.
4. Deploy the backend, copy its public URL into the frontend's `VITE_API_URL`, then redeploy the frontend.
5. If using Paystack webhooks, configure the endpoint as `https://<backend-domain>/api/payments/webhook`.

Do not commit `.env` files or put server secrets in frontend variables. This scaffold stores users, requests, sessions, and operations data in memory, so that data is not durable or shared across serverless invocations. Add persistent database and session storage before using the deployment for real operations.

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
