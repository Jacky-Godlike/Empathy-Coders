# Empathy-Coders — SmartOrder Hub

**Active version: V2.0**

The current application lives in [`src/v2.0/`](src/v2.0/). The previous V1.0
project remains preserved in [`src/v1.0/`](src/v1.0/).

V2.0 adds multilingual order management, channel integrations, order-risk
analysis, inventory and activity tracking. See the [V2.0 guide](src/v2.0/readme.md)
for product details and the [technical guide](src/v2.0/smartorder-hub/README.md)
for architecture and API information.

## Run on Windows

Start the backend in one PowerShell terminal:

```powershell
cd src\v2.0\smartorder-hub\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Start the frontend in a second terminal:

```powershell
cd src\v2.0\smartorder-hub\frontend
npm install --no-package-lock
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend proxies API
requests to the backend on port 8000.
