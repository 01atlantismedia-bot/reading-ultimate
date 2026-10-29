# Aphrodite — private IELTS Academic Reading practice

- `web/` — front end (plain JavaScript, no build step). Open it with any static server for **offline mode** (data stays in the browser).
- `worker/` — Cloudflare Worker API, D1 schema, private passage JSON (`worker/passages/`).
- `scripts/` — passage checker/bundler and site builder.
- `tools/import_test.py` — turns a full-test HTML file into 3 passage files.
- `tools/import_full_reading.py` — same, for the `FULL_READING.html` style (data inside the page's JavaScript).
- `START-HERE.md` — how to put it online (GitHub → Cloudflare).
- `DEPLOY.md` — adding passages, local testing, security notes.

Quick look (no accounts): `cd web && python3 -m http.server 8000` → http://localhost:8000
