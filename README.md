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

The admin portal includes demo workflows for dispatch, drivers, fleet battery/documents, customer support, pricing/promotions, finance, staff roles, and audit history. Bookings use the same browser-local booking store as customer booking and history pages. Admin may assign a driver or cancel a trip, but cannot mark a driver as having accepted, started, or completed it. Driver actions move trips through pending, confirmed, in progress, and completed; the customer booking receipt and admin view read those same updates. Admin operations are stored under `taxivinfast_admin_operations`; pricing and promotions are stored under `taxivinfast_pricing_config` and are read by the customer fare calculator.

Dispatch map positions, driver onboarding/shift/wallet data, complaints, blacklist entries, settlement, and payroll are local demo data. GPS tracking, server-enforced staff permissions, payment-provider reconciliation/transfers, and multi-device synchronization require production APIs and are not provided by this front-end demo.

## Driver portal demo

Sign in at the separate `driver-login.html` page, or open **Khu vực tài xế** from the home page or driver account menu. Customer login remains on `dangnhap.html` and contains no driver credentials. The portal has home/map, rides, income, and account tabs; ride actions update the same browser-local booking store used by customer booking and history pages. Customer bookings start pending, and become confirmed only after a driver accepts. The driver then records arrival, trip start, and completion. For cash rides, the driver confirms receipt and the admin sees that confirmation; online payments remain pending until an admin demo reconciliation after completion. Online payouts recorded by admin are reflected in the driver's available balance and transaction list. Keep all pages on the same browser and origin for local demo synchronization. The map uses Leaflet/OpenStreetMap, and the browser asks for location only when the driver presses the location button.

Driver profiles, availability, complaints, and withdrawal requests are stored locally per account for demonstration. The driver map opens centered on Hanoi and does not show a fabricated location marker; the driver can request a fresh, high-accuracy browser GPS fix with the location button (subject to device permission and HTTPS/localhost). The displayed net-income estimate follows the existing admin demo's 20% platform fee assumption. A completed trip does not automatically mark an unpaid online payment as received; a real payment provider, server-enforced dispatch, bank transfer, live GPS tracking, and cross-device data require trusted production APIs.

For the local demo, use `driver@taxivinfast.com` / `123456` to enter the driver portal. Customer registrations receive the `customer` role and are redirected away from the portal; drivers created by a production API must carry a trusted `driver` role. The browser-side role gate is for demo UX only and must be backed by server-side authorization before production.
