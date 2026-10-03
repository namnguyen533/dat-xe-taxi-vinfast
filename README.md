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

## Booking map and route estimates

The booking page opens to a nationwide Vietnam map (including Hoang Sa and Truong Sa) with major city markers and Hanoi pickup/destination defaults. Use the country overview button to return to all of Vietnam after zooming into a route or GPS location. It uses Leaflet with OpenStreetMap street tiles (and alternate public tile sources), Nominatim/Photon address search, and public OSRM-compatible driving routers. GPS is requested only after the customer chooses their current location; the browser must allow location access and the page must use HTTPS or localhost. Distance and duration come from the returned driving route and are used in the fare estimate; a booking cannot be submitted until a route is available. Public services require Internet access and have usage limits/availability requirements, so configure hosted or commercial map, geocoding, and routing providers before production use. Google Maps directions are also available as an external link and do not require an API key.

## Admin operations demo

The admin portal includes demo workflows for dispatch, drivers, fleet battery/documents, customer support, pricing/promotions, finance, staff roles, and audit history. Bookings use the same browser-local booking store as customer booking and history pages. Admin operations are stored under `taxivinfast_admin_operations`; pricing and promotions are stored under `taxivinfast_pricing_config` and are read by the customer fare calculator.

Dispatch map positions, driver onboarding/shift/wallet data, complaints, blacklist entries, settlement, and payroll are local demo data. GPS tracking, server-enforced staff permissions, payment-provider reconciliation/transfers, and multi-device synchronization require production APIs and are not provided by this front-end demo.
