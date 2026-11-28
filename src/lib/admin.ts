import "server-only";
import { all, get } from "./db";

const DAY = 86_400_000;

export type AdminUser = {
  id: number;
  email: string;
  role: string;
  status: string;
  created_at: string;
  entries: number;
  last_active: number | null;
};

export async function listUsers(): Promise<AdminUser[]> {
  return all<AdminUser>(
    `SELECT u.id, u.email, u.role, u.status, u.created_at,
       (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) AS entries,
       (SELECT MAX(at) FROM events e WHERE e.user_id = u.id) AS last_active
     FROM users u
     ORDER BY CASE u.status WHEN 'pending' THEN 0 ELSE 1 END, u.created_at DESC`,
  );
}

export async function listAllowedEmails(): Promise<{ email: string; added_at: number }[]> {
  return all("SELECT email, added_at FROM allowed_emails ORDER BY added_at DESC");
}

export type Usage = {
  activeUsers7: number;
  activeUsers30: number;
  views30: number;
  viewsToday: number;
  entries30: number;
  entriesTotal: number;
  logins30: number;
  ai: {
    calls30: number;
    failed30: number;
    promptTokens30: number;
    completionTokens30: number;
    scans30: number;
    chats30: number;
    models: { model: string; calls: number }[];
  };
  daily: { day: string; views: number; ai: number }[];
};

export async function usage(): Promise<Usage> {
  const now = Date.now();
  const since30 = now - 30 * DAY;
  const since7 = now - 7 * DAY;
  const startToday = new Date(new Date().toDateString()).getTime();

  const [a7, a30, ev, entriesTotal, ai, models, dailyViews, dailyAI] = await Promise.all([
    get<{ n: number }>("SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE at >= ?", [since7]),
    get<{ n: number }>("SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE at >= ?", [since30]),
    all<{ type: string; n: number; today: number }>(
      `SELECT type, COUNT(*) AS n, SUM(CASE WHEN at >= ? THEN 1 ELSE 0 END) AS today
       FROM events WHERE at >= ? GROUP BY type`,
      [startToday, since30],
    ),
    get<{ n: number }>("SELECT COUNT(*) AS n FROM transactions"),
    get<{
      calls: number;
      failed: number;
      pt: number;
      ct: number;
      scans: number;
      chats: number;
    }>(
      `SELECT COUNT(*) AS calls,
         SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed,
         SUM(prompt_tokens) AS pt, SUM(completion_tokens) AS ct,
         SUM(CASE WHEN kind = 'scan' THEN 1 ELSE 0 END) AS scans,
         SUM(CASE WHEN kind = 'chat' THEN 1 ELSE 0 END) AS chats
       FROM ai_usage WHERE at >= ?`,
      [since30],
    ),
    all<{ model: string; calls: number }>(
      `SELECT model, COUNT(*) AS calls FROM ai_usage WHERE at >= ? AND ok = 1
       GROUP BY model ORDER BY calls DESC`,
      [since30],
    ),
    all<{ day: string; n: number }>(
      `SELECT date(at / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM events
       WHERE type = 'view' AND at >= ? GROUP BY day`,
      [since30],
    ),
    all<{ day: string; n: number }>(
      `SELECT date(at / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM ai_usage
       WHERE at >= ? GROUP BY day`,
      [since30],
    ),
  ]);

  const count = (t: string) => ev.find((e) => e.type === t);
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(now - (29 - i) * DAY).toISOString().slice(0, 10);
    return {
      day,
      views: dailyViews.find((d) => d.day === day)?.n ?? 0,
      ai: dailyAI.find((d) => d.day === day)?.n ?? 0,
    };
  });

  return {
    activeUsers7: a7?.n ?? 0,
    activeUsers30: a30?.n ?? 0,
    views30: count("view")?.n ?? 0,
    viewsToday: count("view")?.today ?? 0,
    entries30: count("entry")?.n ?? 0,
    entriesTotal: entriesTotal?.n ?? 0,
    logins30: count("login")?.n ?? 0,
    ai: {
      calls30: ai?.calls ?? 0,
      failed30: ai?.failed ?? 0,
      promptTokens30: ai?.pt ?? 0,
      completionTokens30: ai?.ct ?? 0,
      scans30: ai?.scans ?? 0,
      chats30: ai?.chats ?? 0,
      models,
    },
    daily,
  };
}
