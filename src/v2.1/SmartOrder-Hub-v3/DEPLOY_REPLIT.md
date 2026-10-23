# Deploy SmartOrder Hub on Replit

SmartOrder Hub is one FastAPI service that also serves the built React
frontend. Replit builds it once, then runs it on internal port **3000** and
publishes it on external port **80**.

The repository already contains the Replit files:

```
.replit                 # run, build, deployment and port mapping
replit.nix              # Python 3.11 + Node 20 system packages
scripts/build.sh        # pip install + npm install + vite build
scripts/dev.sh          # Run button: install/build if needed, then start
scripts/start.sh        # published deployment: start the built app
smartorder-hub/         # the application
```

## 1. Import the project

1. Push this repository to GitHub.
2. In Replit choose **Create App → Import from GitHub** and select the repo.
3. Replit reads `.replit` automatically. Open **Files → Show hidden files** if
   you want to inspect it.
4. Press **Run**. The first run installs Python/Node dependencies, builds the
   frontend and starts the API. Later runs reuse `node_modules` and `dist`.

If you prefer to run the build manually in the Shell:

```bash
bash scripts/build.sh
bash scripts/dev.sh
```

## 2. Add the AI key with Replit Secrets

Do **not** put the key in the repository, in `.env` committed to Git, or in a
browser input. Replit Secrets becomes an environment variable for the app.

1. Open **Tools → Secrets** in the Replit project.
2. Add one of these depending on the provider:

   **DeepSeek Flash (default):**

   | Secret | Example | Required |
   |---|---|---|
   | `DEEPSEEK_API_KEY` | your DeepSeek platform key | yes |
   | `DEEPSEEK_MODEL` | `deepseek-flash` | no |
   | `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | no |
   | `SMARTORDERHUB_INTAKE_MODE` | `rules` or `auto` | no |

   The provider is auto-detected from the key and base URL. If an old
   `AI_PROVIDER=gemini` is still present, a DeepSeek key is detected and used.

   **OpenAI-compatible endpoint (OpenAI, Azure-compatible gateway, etc.):**

   | Secret | Example | Required |
   |---|---|---|
   | `AI_PROVIDER` | `openai` | yes |
   | `AI_API_KEY` | your provider key | yes |
   | `AI_BASE_URL` | `https://api.openai.com/v1` | yes |
   | `AI_MODEL` | `gpt-4o-mini` | yes |
   | `SMARTORDERHUB_INTAKE_MODE` | `rules` or `auto` | no |

3. Restart the Run button (or republish) so the new environment variable is
   loaded.
4. Open **Settings → Connect AI API** in the app and click **Test connection**.
   A successful test shows the provider, model, latency and whether the reply
   was valid JSON.

`SMARTORDERHUB_INTAKE_MODE` defaults to `rules`, which keeps the 34-message
demo instant and independent of the AI provider. Set it to `auto` if you want
the bulk intake to use the AI provider too; individual message extraction still
falls back to rules on a timeout, rate limit or malformed response. DeepSeek
requests disable thinking mode for fast JSON extraction, and the same client
writes the short risk brief.

The AI code path is deliberately isolated:

- `smartorder-hub/backend/app/ai_client.py` — the only file that calls a
  provider (`generate_json`, `test_connection`).
- `smartorder-hub/backend/app/extraction.py` — builds the industry-aware prompt
  and maps the provider JSON into the order schema.
- `smartorder-hub/backend/app/main.py` — `GET /api/ai/status` and
  `POST /api/ai/test`.

Stock, margin, delivery feasibility and risk never call the AI provider; they
are calculated by rules in `rules.py` and `risk.py`.

## 3. Publish the demo

Replit preview URLs are temporary and private. For the hackathon submission:

1. Open **Publishing**.
2. Choose **Autoscale** (simplest) or **Reserved VM**.
3. Set the run command if Replit asks for one:

   ```bash
   bash scripts/start.sh
   ```

4. Publish, then copy the stable `*.replit.app` URL into the Technical & Tools
   Declaration and the pitch deck.

The published app uses the same FastAPI process; `frontend/dist` is served by
`main.py` at `/`.

### Port troubleshooting

`.replit` maps:

```toml
[[ports]]
localPort = 3000
externalPort = 80
```

`scripts/dev.sh` and `scripts/start.sh` listen on `PORT` or 3000. If the Replit
webview shows a connection error, confirm that the process is listening on
`0.0.0.0:3000` and that the `[[ports]]` mapping is still present. Do not run the
Vite dev server in the published deployment; FastAPI serves the built `dist`.

### Frontend troubleshooting

If `/` returns an API-only page or 404:

```bash
bash scripts/build.sh
```

Then restart. The build output must be at
`smartorder-hub/frontend/dist/index.html`.

## 4. Replit references

- App configuration (`.replit` / `replit.nix`):
  <https://docs.replit.com/features/project-setup/configuration>
- Ports and external port mapping:
  <https://docs.replit.com/features/project-setup/ports>
- Secrets:
  <https://docs.replit.com/core-concepts/project-editor/app-setup/secrets>
- Publishing:
  <https://docs.replit.com/build/publish-your-app>

## 5. Security checklist

- [ ] `.env` is not committed.
- [ ] No API key in GitHub, screenshots or the video.
- [ ] Key is stored in Replit Secrets.
- [ ] All customer/order/stock/supplier data is synthetic.
- [ ] The demo never sends a real purchase order or processes a payment.
- [ ] Every approval is made by a human and written to the activity log.
