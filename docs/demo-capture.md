# Demo Capture

The app is designed for a short OSS walkthrough. Use seeded mock data only; do not connect real CRM, SMS, calendar, billing, refund, or dispatch systems.

## Static Screenshot

1. Start the app:

~~~bash
npm run dev:api
npm run dev:web
~~~

2. Open `http://localhost:5173`.
3. Select **Dead charger after outage**.
4. Click **Run replay**.
5. Approve the work order in the drawer.
6. Capture the full page with browser tooling.

Recommended filename: `docs/media/alpine-fieldops-console.png`.

## GIF Walkthrough

Suggested sequence:

1. Show the dashboard before replay.
2. Click **Connect voice** to show mock or live status.
3. Click **Run replay**.
4. Pause on the activity rail.
5. Approve the work order.
6. Switch to **Unclear audio / exact ID recovery** and run replay.
7. End on the guardrail event.

Keep the GIF under 20 seconds for README use. If recording live voice, use fake seeded prompts only.

## Browser Smoke Evidence

For automated UI proof, run:

~~~bash
npm run test:ui
~~~

The test suite covers initial render, replay, approval execution, mock voice fallback, unclear-ID guardrail, and scenario-focused workspace.
