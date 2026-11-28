# Expensso

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

## Accounts and admin

Anyone can create an account, but new accounts wait until the admin approves them.
The admin is the account whose email matches `ADMIN_EMAIL`; creating it also needs
`ADMIN_SETUP_CODE`, because emails are not verified. The admin panel at `/admin`
approves, adds and deletes people and shows usage, AI token use and an ad revenue estimate.

Keys live only in `.env.local` and in the hosting provider's settings, never in code.

## Ads

Set `NEXT_PUBLIC_ADSENSE_CLIENT` and `NEXT_PUBLIC_ADSENSE_SLOT` from a Google AdSense
account to show one ad on the overview. The admin never sees ads. `/ads.txt` is served
automatically.

## Data

Without `TURSO_DATABASE_URL` everything is stored in `data/expenses.db` (SQLite). With
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set, the app uses that Turso database instead,
which is what the hosted version uses. Amounts are in KM.

## Tests

```bash
npm test
```
