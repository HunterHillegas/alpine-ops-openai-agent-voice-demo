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
4. Click **Run replay** and show the seeded transcript playback.
5. Approve the work order in the drawer and show the part inventory drop.
6. Approve the queued customer-message save card, then approve the mocked send card.
7. Capture the full page with browser tooling.

Recommended filename: `docs/media/alpine-fieldops-console.png`.

For the MacOS 8 reference theme, open `http://localhost:5173/?theme=platinum` before capture. The first viewport should show the Finder-style menu bar, patterned desktop wallpaper, right-side desktop icons, striped window title bars, and bottom launcher strip around the same operations cockpit.

Recommended filename: `docs/media/alpine-fieldops-console-platinum.png`.

## GIF Walkthrough

Suggested sequence:

1. Show the dashboard before replay.
2. Click **Connect voice** to show mock or live status.
3. Click **Run replay**.
4. Pause on the replay transcript and activity rail.
5. Approve the work order, the customer-message save card, and the mocked send card.
6. Switch to **Unclear audio / exact ID recovery** and run replay.
7. End on the guardrail event.

Keep the GIF under 20 seconds for README use. If recording live voice, use fake seeded prompts only.

## Browser Smoke Evidence

For automated UI proof, run:

~~~bash
npm run test:ui
~~~

The test suite covers initial render, replay transcript playback, approval execution, mock voice fallback, text fallback replay, unclear-ID guardrail, scenario-focused workspace, and Platinum theme desktop chrome from the `?theme=platinum` deep link.
