# TaxiVinFast

## Local development

Install dependencies with `npm install`, then start the API and website in separate terminals:

```sh
npm run api
```

```sh
npm run dev
```

The API runs at `http://localhost:3000` and the Vite website at the URL printed by Vite. Registration and login use the JSON Server Auth `/register` and `/login` endpoints. New accounts are stored in the root `db.json` file; do not commit real customer data.

To use a different auth API URL, set `VITE_AUTH_API_URL` in the Vite environment before starting the website.

JSON Server Auth is intended here for local development and demos, not production authentication. Use a production-ready backend with secure deployment and account-management controls before accepting real user accounts.

## Admin operations demo

The admin portal includes demo workflows for dispatch, drivers, fleet battery/documents, customer support, pricing/promotions, finance, staff roles, and audit history. Bookings use the same browser-local booking store as customer booking and history pages. Admin operations are stored under `taxivinfast_admin_operations`; pricing and promotions are stored under `taxivinfast_pricing_config` and are read by the customer fare calculator.

Dispatch map positions, driver onboarding/shift/wallet data, complaints, blacklist entries, settlement, and payroll are local demo data. GPS tracking, server-enforced staff permissions, payment-provider reconciliation/transfers, and multi-device synchronization require production APIs and are not provided by this front-end demo.
