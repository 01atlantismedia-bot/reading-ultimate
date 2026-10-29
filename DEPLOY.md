# Aphrodite: notes for later

## How it is put together
One Cloudflare **Worker** serves the website (`dist/`, built from `web/`) **and** the API (`/api/*`). A **D1** database holds users and results. Everything runs on the free plan.

Variables (Worker → Settings → Variables and Secrets):
- `INVITE_CODE` (Secret) — students need it to join.
- `PASSWORD_PEPPER` (Secret) — extra secret mixed into password hashes.
- `TEACHER_EMAIL` (Text) — the account with this email becomes the teacher.
- `ANTHROPIC_API_KEY` (Secret, optional) — turns on the Translate button. Optional extras: `ANTHROPIC_MODEL` (Text, default `claude-haiku-5-5`) and `TRANSLATE_PER_PARAGRAPH` (Text, default `6`).

## Add more passages
1. Put the passage JSON file in `worker/passages/` (the `id` inside must match the file name, e.g. `test-2-p1`).
2. Upload it to GitHub. The build checks it (evidence sentences, answers, EN and RU explanations) and Cloudflare redeploys.
3. To make passages from a full-test HTML file: `pip install beautifulsoup4 lxml`, then `python3 tools/import_test.py 2 path/to/test2.html` (or `tools/import_full_reading.py` for the `FULL_READING.html` style). Imported tests have answer keys and anchors but no written explanations; anchors are made by a program, so low-confidence ones show a "double-check" note.

## Try it on your computer
```bash
npm install
cp worker/.dev.vars.example worker/.dev.vars     # then edit it
npm run build
cd worker && npx wrangler d1 execute aphrodite -c wrangler.dev.toml --local --persist-to .wrangler/state --file=schema.sql && cd ..
npm run dev          # http://localhost:8787
```

## Security checklist
- [ ] `INVITE_CODE` and `PASSWORD_PEPPER` are Secrets (not in any file in GitHub).
- [ ] Cloudflare account has 2FA.
- [ ] After all students have joined, change `INVITE_CODE`.
- [ ] Signed out, `https://YOUR-ADDRESS/api/passages` answers 401.
- [ ] As a student, `/api/teacher/students` answers 403.
- [ ] Passwords: PBKDF2-SHA256 with per-user salt + secret pepper. Session cookie: `__Host-session; HttpOnly; Secure; SameSite=Strict`.
- [ ] Login limits: 5 failures per account+IP and 30 per IP in 15 minutes. Signup: 8 per IP per hour.
- [ ] Signed-in students receive each passage's answer key (needed for instant coaching). Fine for a small trusted group, not for an exam.

## Privacy (UK GDPR)
Collected: name, email, password hash, practice results, and the words a student translated. No analytics. When a student taps Translate, that one word and its sentence go to Anthropic (Claude) to get the translation; nothing else. Fonts load from Google Fonts (visitors' IP goes to Google); to avoid that, self-host the fonts and remove the Google URLs from `web/index.html` and `web/_headers`. Students can delete their own account under Account. If any student is under 18, keep data minimal and tell them (and parents if under 13) what is stored.
