# Spendbook

Personal income and expense tracker: enter your salary and side income, log what you
spend (by hand or by photographing a receipt), and see where the money goes.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first account you create is the only account; after
that the app only offers log in.

To use it from your phone on the same Wi-Fi, run a production build and open
`http://<your-computer-ip>:3000` on the phone:

```bash
npm run build
npm start
```

## AI features (receipt scanning and chat)

Both use one OpenAI-compatible API. Copy `.env.example` to `.env.local`, set
`AI_API_KEY`, and restart. The defaults point at Google Gemini; set `AI_BASE_URL`
and `AI_MODEL` to use Groq, OpenRouter, OpenAI or another provider. The model must
accept images. A free Gemini key can be created at https://aistudio.google.com/apikey
(free plans have rate limits, and the default model name may need updating as Google
retires models). Without a key the rest of the app works and the AI buttons are off.

Photos you scan or send in chat go to that AI provider.

## Security

Set `OWNER_EMAIL` in `.env.local` (and in the hosting provider's settings once the
app is online). Only that address can create the account or log in. Keys live only in
`.env.local`, which git ignores; never put them in code.

## Data

Without `TURSO_DATABASE_URL` everything is stored in `data/expenses.db` (SQLite). With
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set, the app uses that Turso database instead,
which is what the hosted version uses. Amounts are in KM.

## Tests

```bash
npm test
```
