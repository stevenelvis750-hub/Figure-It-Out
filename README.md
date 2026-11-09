# Figure It Out

A learning quiz app with a Node.js backend and static frontend.

## Run the app

1. Open the project folder in VS Code.
2. Open a terminal in the project folder.
3. Run:

```bash
npm install
npm start
```

4. Open:

```text
http://localhost:3000
```

## Real school accounts

The app now works with real teacher and student accounts tied to schools.
Teacher and student sign-up flows are supported, and the local fallback keeps the
platform functional even when the live Supabase schema is not yet migrated.

## Google and Apple sign-in

Social sign-in uses Supabase Auth. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`
in the server's `.env` file and set `APP_URL` to the public origin serving the
app (for example, `http://localhost:3000`). In Supabase, enable Google and/or
Apple under Authentication → Sign In / Providers, configure each provider's
credentials, and add `${APP_URL}/auth/callback.html` to the Supabase redirect
URL allow list. The identity-provider console must also use the callback URL
shown by Supabase. Apple sign-in requires Apple Developer credentials and must
be enabled in Supabase before the Apple button can complete authentication.

The OAuth callback exchanges a short-lived PKCE code on the server and creates
or signs in to the app's local account. School accounts still require a valid
school code and school approval; independent accounts can start learning
immediately. Never place provider secrets in frontend files or commit `.env`.

## Connect the AI learning assistant

The Ask Figure It Out screen uses Google's Gemini API. Create an API key in
[Google AI Studio](https://aistudio.google.com/apikey), then add it to the
project's root `.env` file:

```text
GEMINI_API_KEY=your-real-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

The repository includes `.env.example` with a placeholder configuration. Copy
it to `.env` if you do not already have a `.env` file, then replace the
`GEMINI_API_KEY` placeholder with your real key. Restart the server with
`npm start` after changing the file.

Keep the key on the server: do not put it in `script.js`, `index.html`, or any
other browser-side code. The Ask button sends questions to `/api/ask`, and only
the backend sends the key to Gemini. The key is not included in browser
responses. The default model is `gemini-2.5-flash`; set `GEMINI_MODEL` in the
server environment if you want to use another Gemini model available to your
API key.

The assistant requires the Node.js server; it will not work when the page is
opened directly or served only with VS Code Live Server.

## Live Server option

If you prefer VS Code Live Server:

Live Server can display the static quiz page, but API features (including the
AI assistant and question endpoints) require the Node.js server at
`http://localhost:3000`.

> The backend file is `server.js` and the app is also served on `http://localhost:3000` when using `npm start`.

## Backend endpoints

- `GET /api/health` — confirms the backend is up and responding.
- `GET /api/subjects` — returns all available subjects from the `Questions` folder.
- `GET /api/questions/:course` — returns a course's questions, optionally filtered by `?difficulty=easy&limit=20`.
- `GET /api/course/:course` — returns the full question set for a specific subject.
- `POST /api/challenge` — generates a quiz challenge payload using a course name, difficulty, and length.
- `GET /api/questions?course=Mathematics&difficulty=easy&limit=20` — filtered question lookup via query string.
- `POST /api/ask` — asks Gemini a question; requires `GEMINI_API_KEY` on the server.

Each subject has at least 250 questions at each difficulty level (easy, medium,
and hard). The app uses the questions in `Questions/` as its source and creates
additional practice variations when needed. This question expansion happens in
the Node.js backend, so run the app with `npm start`.

## Backend architecture

The project now follows a cleaner backend structure:

- `server.js` — starts the Express app and serves the frontend.
- `src/routes/api.js` — API routing layer.
- `src/services/questionService.js` — reusable business logic for loading, normalizing, and generating quiz data.
