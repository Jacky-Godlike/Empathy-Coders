# Deploying OrderPilot on Replit

Replit is **compulsory** for SDC Hackathon 2026. This guide takes the repository from GitHub to a working Replit deployment and produces the proof required in the Technical & Tools Declaration.

> **Current team deployment:** https://order-pilot--microtopt.replit.app  
> The API is proxied under `/orderpilot-api` in this deployment. The frontend
> detects `*.replit.app` and uses that mount; local development uses `/api`.
>
> Official rules to keep in mind:
> - The project must use Replit as part of the solution.
> - Before submitting, the Technical & Tools Declaration must show proof of Replit use: a live deployment Replit URL, a Replit project link with project history, or finished Replit credit — from the team's own account and project.
> - The submitted GitHub repository must be public, contain an Apache 2.0 `LICENSE`, and have a genuine commit history.
> - Never commit an API key or secret.

---

## 0. What you need

- A GitHub account (preferably the team account the judges will see).
- A Replit account with the Replit Core credit provided by the organisers.
- This repository, pushed to GitHub.
- Optional but recommended for the final demo: a DeepSeek API key (the submitted demo uses DeepSeek).

---

## 1. Push the repository to GitHub

The prepared folder already has the remote set. Push the final branch:

```bash
cd ~/Downloads/github
git status
# The prepared repository already has 10 commits and the remote set.
# The existing GitHub repository has old team branches, so push the final
# project as a new branch instead of overwriting main.
git push -u origin orderpilot
```

Then, on GitHub, open **Settings → Branches** and set `orderpilot` as the
default branch, or open a pull request and merge it into `main` after checking
the old branches. Do not force-push over the team's existing `main`.

Checklist before pushing:

- [ ] `LICENSE` is the Apache License 2.0 and is committed.
- [ ] `.env` is **not** committed. `git status --ignored` should show it as ignored.
- [ ] `data/runtime/` is not committed.
- [ ] `node_modules/` is not committed.
- [ ] The README team details are filled in; add the Replit project, slide and video links after deployment.
- [ ] The commit history has several meaningful commits, not one giant commit.

> The Participant Handbook says the repository may be private during the hacking period and must be public before submission. Keep it private while building if you prefer, then switch it to public before the deadline and add the committee's designated GitHub account(s) as collaborators. Get the exact account name from Discord.

---

## 2. Import the repository into Replit

1. Sign in to Replit with the **team's own account**.
2. Click **Create Repl** (or **+ Create**).
3. Choose **Import from GitHub**.
4. Paste the repository URL `https://github.com/Jacky-Godlike/Empathy-Coders` and select the `orderpilot` branch.
5. Choose **Node.js** if Replit asks for a template.
6. Click **Import**.

Replit reads the `.replit` file:

```toml
run = "npm start"
entrypoint = "server/index.js"
modules = ["nodejs-20"]

[nix]
channel = "stable-24_05"

[deployment]
build = ["sh", "-c", "npm install"]
run = ["sh", "-c", "npm start"]
deploymentTarget = "cloudrun"
```

If Replit creates its own `.replit`, replace it with this file (or keep the run command as `npm start`).

---

## 3. Add the AI key (optional but recommended)

The app works without a key in rules-fallback mode, but the competition expects AI for order identification and extraction. The submitted demo uses DeepSeek.

1. Open the DeepSeek platform and create an API key (or use an existing team key).
2. In Replit, open your project.
3. Open the **Secrets** panel (lock icon in the Tools pane).
4. Add:

| Key | Value |
| --- | --- |
| `AI_API_KEY` | your key |
| `AI_PROVIDER` | `deepseek` |
| `AI_MODEL` | `deepseek-flash` |

5. Click **Add Secret** / save.
6. Restart the Repl.

Alternative providers:

| Provider | `AI_PROVIDER` | `AI_MODEL` example | Key |
| --- | --- | --- | --- |
| OpenAI | `openai` | `gpt-4.1-mini` | `AI_API_KEY` |
| DeepSeek | `deepseek` | `deepseek-flash` | `AI_API_KEY` |
| Anthropic | `anthropic` | `claude-sonnet-5-5` | `AI_API_KEY` |
| Any OpenAI-compatible | `openai-compatible` | your model | `AI_API_KEY` + `AI_BASE_URL` |

**Do not** put the key in `.env.example`, the README, a committed `.env`, or a screenshot. Replit Secrets are the correct place for deployment.

If the AI call fails, the app logs an `ai.fallback` activity and uses the deterministic extractor. The scan result shows the reason.

---

## 4. Run and verify

1. Click **Run**.
2. Wait for `npm install` and the server log:

```text
OrderPilot 1.0.0 — Kopi & Co. Supply
Listening on http://localhost:3000
AI mode: rules — rules fallback
Runtime data: /home/runner/.../data/runtime
```

3. Open the Webview. You should see the Order Desk with 6 seeded orders.
4. Check:
   - The sidebar shows **Order Desk 6**, **Inbox 12**.
   - The table has 6 rows with Ready / Procurement / Needs info / High risk badges.
   - Click **Scan inbox (12)**. The scan overlay should show 12 scanned, 5 created, 2 updated, 5 filtered.
   - The desk should show 11 pending orders.
   - Approve a Ready order. The row disappears; the Orders count becomes 1.
   - Open **Orders** and export CSV and Excel.
   - Open **Activity log** and see the entries.
   - Open **Settings**. If the AI key is configured, click **Test connection**.
   - Click **Reset demo data** to restore the starting state.

If the Webview is blank, open the Replit console and check the server log. See Troubleshooting below.

---

## 5. Deploy

1. Click **Deploy** in the top-right corner.
2. Choose a deployment type:
   - **Autoscale** — cost-effective; may reset the filesystem on cold starts. OrderPilot re-seeds automatically.
   - **Reserved VM** — keeps the filesystem between restarts; better if you want approvals to persist through the pitch.
3. Confirm the build command `npm install` and the run command `npm start` (from `.replit`).
4. Click **Deploy**.
5. Wait for the build to finish, then open the `.replit.app` URL.
6. Test the same flow on the live URL: scan, approve, export, reset.
7. Copy the live URL into:
   - `README.md` → Links table.
   - Your submission form.
   - The pitch deck (if it shows the demo link).

**Replit Autoscale persistence:** if the app restarts, the JSON runtime files may be reset. The app reseeds on boot, so the demo still works. For a pitch where approvals must survive a restart, use a Reserved VM or reset the demo right before presenting.

---

## 6. Proof of Replit use (required)

The Technical & Tools Declaration must include **one** of:

1. The **live deployment URL** (e.g. `https://orderpilot.<team>.replit.app`).
2. A **Replit project link** that shows the project history.
3. A screenshot of **finished Replit credit**.

The proof must show the team's own account and project.

Suggested screenshots:

1. The Replit project page with the account avatar/username, the project name
   `OrderPilot` and the file list visible.
2. The Deployment page with the deployment status and public URL visible.
3. The project history or the Replit credits/billing usage page.

Do **not** screenshot the actual API key value. Insert the three screenshots
into `submission/SDC2026_EmpathyCoders_ReplitProof.pdf`.

---

## 7. Update the README and submission links

After deployment, replace:

- `<REPLIT_PROJECT_URL>` → the Replit project URL from the address bar.
- The live deployment URL is already filled: https://order-pilot--microtopt.replit.app.
- `<YOUTUBE_URL>` / `<PITCH_VIDEO_URL>` → the 5–7 minute pitching video.
- `<SLIDE_DECK_URL>` → the slide deck.
- Team details are already filled in: Empathy Coders, Yang Jiahui, XMUM and the five members.

Then commit and push:

```bash
git add README.md
git commit -m "docs: add live Replit and submission links"
git push origin orderpilot
```

---

## 8. Troubleshooting

### The Webview is blank or shows an error

- Open the Replit **Console** and read the server log.
- Confirm `npm install` completed.
- Confirm the run command is `npm start`.
- Confirm the server listens on `0.0.0.0` and uses `process.env.PORT` (it does).
- If the log says `EADDRINUSE`, stop the old process and Run again.

### `Cannot find module 'express'`

Dependencies were not installed. Run:

```bash
npm install
```

or use Replit's **Shell**.

### The AI key does not work

- `401` / `403`: wrong key, wrong provider, or the key is not enabled for the model.
- `404`: wrong model name. Try `deepseek-flash` (or the provider's current model name).
- The scan result will show **Rules fallback** and the reason. The demo still works.
- Verify the key name is exactly `AI_API_KEY` in Secrets.
- Never put the key in a file tracked by Git.

### The data resets after a restart

Autoscale deployments may use ephemeral storage. The app reseeds the demo automatically. For persistent approvals, use a Reserved VM or reset the demo before presenting.

### The GitHub import cannot find the repository

- The repository must be public, or Replit must be granted access to the private repository.
- Check the URL and the default branch (`main`).

### The Replit proof does not show the team's account

Sign in with the team account, not a personal account. The screenshot must show the account and project the team owns.

### Google Fonts do not load

The app falls back to system fonts. Layout and functionality are unaffected. If you want to avoid the dependency entirely, replace the Google Fonts link in `public/index.html` with local font files.

---

## 9. Replit checklist

- [ ] Repository imported with the correct Node.js run command.
- [ ] `npm install` succeeds.
- [ ] App loads at the Replit Webview URL.
- [ ] AI key added in Secrets (or rules fallback deliberately used).
- [ ] Scan, approve, export and reset tested on the live URL.
- [ ] Deployment created and `.replit.app` URL copied.
- [ ] Live URL added to README and the submission.
- [ ] Replit proof screenshot taken with the team account and project visible.
- [ ] No API key or secret in the repository.
- [ ] Technical & Tools Declaration updated with the proof and the provider/model.
- [ ] Committee GitHub account(s) added as collaborators.
- [ ] Repository public before submission.

---

## 10. Useful commands

```bash
# Local
npm install
npm start
npm test
npm run reset

# Check that secrets are not tracked
git status --ignored | grep -E '\.env|data/runtime|node_modules'

# See the last commits
git log --oneline --decorate -10
```

The local reset command deletes `data/runtime` and re-seeds the demo. The Replit equivalent is **Settings → Reset demo data** (Owner only), which is also recorded in the activity log.
