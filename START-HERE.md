# Start here (GitHub → Cloudflare, free, no terminal)

## 1. GitHub
1. Create a **new private repository**.
2. Unzip this folder on your computer.
3. In the repo: **Add file → Upload files**. Drag in **everything inside the folder** (all files and all folders: `web`, `worker`, `scripts`, `tools`, `package.json`, `wrangler.jsonc`, …).
4. Click **Commit changes**.

## 2. Cloudflare
1. dash.cloudflare.com → **Workers & Pages → Create → Import a repository** → choose your repo.
2. Project name: `aphrodite` (must stay the same as `"name"` in `wrangler.jsonc`).
3. Build command: `npm run build`
4. Deploy command: `npx wrangler deploy`
5. Click **Save and deploy**. The database is created automatically.

## 3. Add the three variables
Open the new Worker → **Settings → Variables and Secrets → Add**:

| Name | Type | Value |
|---|---|---|
| `INVITE_CODE` | Secret | the code students type to join |
| `PASSWORD_PEPPER` | Secret | 40+ random characters (keep a copy!) |
| `TEACHER_EMAIL` | Text | your email, all lowercase |
| `ANTHROPIC_API_KEY` | Secret | optional: turns on the **Translate** button (see below) |

Click **Deploy** after adding them.

## 4. First sign-in
Open `https://aphrodite.<your-name>.workers.dev` → **Join** with the `TEACHER_EMAIL` address and the invite code. That account is the teacher. Send students the address and the invite code.

## Translate button (Claude), optional
Students select a word in **Practice** mode and tap **Translate**. Claude gives the Russian meaning. Limit: **6 different words per paragraph** per student (the same word again is free).

It needs an API key. Your Claude chat plan cannot be linked: the API is a separate, pay-as-you-go account.
1. Go to **console.anthropic.com** and sign in.
2. **Billing**: add a small credit, and set a **monthly spend limit**.
3. **API keys → Create key**. Copy it.
4. In Cloudflare, add it as the Secret `ANTHROPIC_API_KEY`, then **Deploy**.

Without the key everything else works; Translate just says it is not set up.
Only the selected word and its sentence are sent to Claude. The Privacy page tells students this.

## Good to know
- Every change you upload to GitHub redeploys automatically.
- Never change `PASSWORD_PEPPER` later: every password would stop working.
- If sign-in shows "Exceeded CPU", lower `PBKDF2_ITERATIONS` to `10000` in `wrangler.jsonc`.
- If the site shows an error: Worker → **Deployments** (or **Builds**) → open the newest one → read the log.
