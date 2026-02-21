# GOD

GOD is a local-first, Gemini-style assistant web app with safe automation presets.

## LLM Connector

The app now supports real OpenAI-compatible chat endpoints from the sidebar settings.

- `Endpoint`: example `http://localhost:11434/v1/chat/completions` (Ollama) or your hosted compatible endpoint
- `Model`: the model name exposed by your endpoint
- `API Key`: optional for local endpoints, required for hosted providers

Presets available in app:

- Ollama (local)
- OpenAI compatible
- Gemini API (`generateContent` endpoint, default model: `gemini-1.5-flash`)

For Gemini, changing the `Model` field (for example to `gemini-1.5-flash` or `gemini-1.5-pro`) now updates requests automatically.

To provide a local default key, use `.env.local`:

```bash
VITE_GOD_API_KEY=your_key_here
```

Settings are stored in browser local storage for portability.

## Attach to Any Browser Tab

Use GOD's sidebar button `Copy Attach Bookmarklet`.

1. Open GOD in your browser.
2. Click `Copy Attach Bookmarklet`.
3. Create a bookmark in your browser and paste the copied text into the bookmark URL/location field.
4. While on any site, click that bookmark to toggle a floating GOD panel.

Note: some websites may block embedded iframes via security headers.

## Safety

This build does **not** support:

- reverse engineering third-party products
- privilege escalation or admin-right bypasses
- hidden system-level control

## Teaching Mode: Elevation Approval

For classroom troubleshooting, GOD includes a manual approval queue:

- Instructor can queue elevated actions for review
- Admin-related prompts are routed to pending approval (not auto-executed)
- Each approve/deny decision is written to a local audit log

This workflow is for transparent review and auditing only, not privilege bypass.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy on Any Browser

GOD builds as a static web app and can be deployed to any static host reachable by browsers.

1. Prepare cross-browser build:

```bash
npm install
npm run deploy:prepare
```

2. Deploy the generated `dist/` folder to any static host (GitHub Pages, Netlify, Vercel static, Nginx, Apache, S3 static website, USB static server).

3. Open the deployed URL in Chrome, Edge, Firefox, Brave, or Safari.

If your AI endpoint blocks browser CORS, use Ollama local endpoint or a backend relay.

## Portable (Flash Drive)

1. Build and package:

```bash
npm run portable
```

2. Copy the generated `portable/` folder to your USB flash drive.
3. On another Windows machine with Node.js installed, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-portable.ps1
```

Then open `http://localhost:4173`.

> Note: the target machine must be able to reach your configured model endpoint (local service or network URL).
=======
# GOD
