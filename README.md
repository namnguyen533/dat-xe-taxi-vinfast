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
