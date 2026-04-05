# DevEx Despatch API server - SENG2021 26T1
## Development environment setup
See [here](https://unswcse.atlassian.net/wiki/spaces/DevEx/pages/1500414069/Development+notes) for development environment setup instructions. **NOTE:** A .env file is required to run the server locally! This is (hopefully..) not present in the public repository and will need to be created manually. See the Confluence page for the contents.

## Project structure
- `src/frontend` contains the Vite React app.
- `src/backend` contains the Express API and backend modules.
- `dist` contains production frontend build output served by Express.

## Local development workflow

### Start with realtime frontend reload (recommended)
1. Install dependencies:
	- `npm install`
2. Start both backend and frontend watchers:
	- `npm run dev`
3. Open the Vite app:
	- `http://localhost:5173`
4. Stop both servers:
	- Press `Ctrl+C` once in the same terminal.

What this does:
- Frontend runs on Vite with HMR (save a React file and the browser updates instantly).
- Backend runs with nodemon (save server files and the API restarts automatically).
- Frontend API calls to `/api/*` and `/api-docs` are proxied to the backend.

### Local environment variables

Frontend/backend proxy and port variables:
- `PORT=80`
- `HTTPS_PORT=443`
- `VITE_API_PROXY_TARGET=http://localhost:80`
- `VITE_CLOUDFLARE_TURNSTILE_SITE_KEY=1x00000000000000000000AA`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`

### Production-style local run
1. Start backend server:
	- `npm start`
	- (runs `npm run build` automatically before startup)

In this mode, Express serves the built frontend from `dist/`.

## Branch naming scheme:
name/sprint#/feature-name
- Example: thomas/sprint2/despatch-retrieval-endpoint

## > All main documentation will be in our Confluence space.