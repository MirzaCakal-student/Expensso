import "server-only";
import { createClient, type Client, type InValue } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

// Online: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN point at the Turso database.
// Without them the app uses a local SQLite file in ./data.

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    method TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
  CREATE TABLE IF NOT EXISTS login_failures (
    email TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    until INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS passkeys (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    user_id INTEGER,
    expires_at INTEGER NOT NULL
  );
`;

const g = globalThis as unknown as { __expenseDb?: Promise<Client> };

async function open(): Promise<Client> {
  let url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    const file = process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "expenses.db");
    mkdirSync(path.dirname(file), { recursive: true });
    url = `file:${file}`;
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await client.executeMultiple(SCHEMA);
  return client;
}

function client(): Promise<Client> {
  g.__expenseDb ??= open().catch((err) => {
    g.__expenseDb = undefined; // let the next request retry
    throw err;
  });
  return g.__expenseDb;
}

type Row = Record<string, InValue>;

/** Runs a query and returns plain objects keyed by column name. */
export async function all<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
  const res = await (await client()).execute({ sql, args });
  return res.rows.map((r) => {
    const o: Row = {};
    res.columns.forEach((c, i) => {
      const v = r[i];
      o[c] = typeof v === "bigint" ? Number(v) : v;
    });
    return o as T;
  });
}

export async function get<T = Row>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: InValue[] = []): Promise<{ lastId: number }> {
  const res = await (await client()).execute({ sql, args });
  return { lastId: Number(res.lastInsertRowid ?? 0) };
}
