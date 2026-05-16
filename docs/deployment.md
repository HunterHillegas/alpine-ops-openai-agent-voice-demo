# Deployment Notes

This repo is local-first. Deploy only the mock demo; do not connect real CRM, SMS, billing, inventory, or dispatch systems.

## Environment

- Node 22+
- `OPENAI_API_KEY` set only on the API/server environment when live voice is needed
- `ALLOWED_ORIGIN` set to the deployed web origin
- `VITE_API_URL` set to the deployed API origin for the web build

## Vercel

Vercel is a good fit for `apps/web` as a static Vite app.

1. Set the project root to `apps/web`.
2. Build command: `npm run build -w apps/web`.
3. Output directory: `apps/web/dist`.
4. Set `VITE_API_URL` to the API host.

Run `apps/api` separately on a Node host because it mints realtime client secrets and owns the mock write state.

## Render

Render is a simple fit for `apps/api`.

1. Service type: Web Service.
2. Runtime: Node.
3. Build command: `npm install`.
4. Start command: `npm run start -w apps/api`.
5. Set `OPENAI_API_KEY` only if live voice should work.
6. Set `ALLOWED_ORIGIN` to the Vercel/static web origin.

For a single Render deployment, serve the web build separately or keep the API-only deployment and run the web locally.

## Smoke Check

After deploying:

~~~bash
curl https://your-api-host.example/health
~~~

Then open the web app, click **Reset data**, run **Dead charger after outage**, approve the work-order card, and confirm the activity rail shows tool arguments and a `Work order created` event.
