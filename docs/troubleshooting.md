# Troubleshooting

## API Does Not Start

Run:

~~~bash
npm run dev:api
~~~

Default API host/port is `127.0.0.1:8787`. Override with:

~~~bash
PORT=8790 npm run dev:api
~~~

For a LAN-visible demo, set an explicit host:

~~~bash
HOST=0.0.0.0 PORT=8787 npm run dev:api
~~~

## Web App Cannot Load State

Ensure the API is running and the web app uses the same base URL:

~~~bash
VITE_API_URL=http://localhost:8787 npm run dev:web
~~~

The web app also binds localhost by default. For LAN-visible browser testing, run Vite with an explicit host:

~~~bash
npm run dev:web -- --host 0.0.0.0
~~~

## Realtime Endpoint Returns Mock Mode

Set `OPENAI_API_KEY` for the API process:

~~~bash
npm run dev:live
~~~

`npm run dev:live` loads `.env`, verifies `OPENAI_API_KEY` is present, then starts the normal API and web dev servers. The key stays server-side. The browser should only receive an ephemeral realtime credential.

## Connect Voice Loads Slowly The First Time

The Agents SDK is lazy-loaded when **Connect voice** is clicked. This keeps the initial cockpit shell smaller and shifts the realtime transport code into a separate browser chunk.

## Playwright Browser Missing

If `npm run test:ui` reports that the Chromium executable is missing, install the browser once:

~~~bash
npx playwright install chromium
~~~

## Approval Does Not Execute

Write endpoints require the approved token produced by the approval card. Rejecting an approval leaves state unchanged by design.

## Scenario Looks Stale

Click **Reset data**, then **Run replay**. Reset restores the seed fixtures and clears generated work orders/approvals/events.
