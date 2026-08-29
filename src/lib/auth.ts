import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { pool, ensureDb } from "./postgres";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-do-not-use-in-production";

/**
 * The `userId` claim is the `users.id` UUID, never the Google `sub`. Tokens
 * issued before that switch carry a numeric Google id, so every entry point
 * checks the shape and treats a non-UUID as an expired session rather than
 * letting a `WHERE id = $1` blow up on a bad cast.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UserToken {
  tokenId: string;
  expiration: Date;
}

/**
 * Whatever the identity provider gave us. Kept as an opaque bag rather than
 * columns: the app keys off `User.id` and never reads these back, so adding a
 * second provider costs no schema change.
 */
export interface UserMeta {
  googleId?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  tokens: UserToken[];
  meta: UserMeta;
}

export function generateAuthToken(tokenId: string, userId: string, roles: string[]) {
  // Using jsonwebtoken to generate a token with token_id, roles, and user id
  return jwt.sign({ tokenId, roles, userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string): { tokenId: string; userId: string; roles: string[] } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { tokenId: string; userId: string; roles: string[] };
    if (!UUID_PATTERN.test(decoded.userId ?? "")) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Loads the session's user row, or null when the token no longer matches one. */
async function loadUserByToken(token: string | undefined, columns: string): Promise<Record<string, unknown> | null> {
  if (!token) return null;

  const decoded = verifyAuthToken(token);
  if (!decoded) return null;

  await ensureDb();
  const res = await pool.query(
    `SELECT ${columns} FROM users WHERE id = $1 AND tokens @> $2::jsonb`,
    [decoded.userId, JSON.stringify([{ tokenId: decoded.tokenId }])]
  );

  if ((res.rowCount ?? 0) === 0) return null;
  return res.rows[0];
}

export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const row = await loadUserByToken(req.cookies.get("auth_token")?.value, "id");
  return row ? (row.id as string) : null;
}

export async function getUserIdFromServer(): Promise<string | null> {
  const cookieStore = await cookies();
  const row = await loadUserByToken(cookieStore.get("auth_token")?.value, "id");
  return row ? (row.id as string) : null;
}

export async function getUserFromServer(): Promise<User | null> {
  const cookieStore = await cookies();
  const row = await loadUserByToken(
    cookieStore.get("auth_token")?.value,
    `id, email, name, roles, tokens, meta`
  );
  return row ? (row as unknown as User) : null;
}

export async function deleteSession(token: string): Promise<boolean> {
  const decoded = verifyAuthToken(token);
  if (!decoded) return false;

  await ensureDb();

  const res = await pool.query(`SELECT id, tokens FROM users WHERE id = $1`, [decoded.userId]);
  if ((res.rowCount ?? 0) === 0) return false;

  const user = res.rows[0];
  const newTokens = (user.tokens || []).filter((t: UserToken) => t.tokenId !== decoded.tokenId);

  await pool.query(
    `UPDATE users SET tokens = $1::jsonb WHERE id = $2`,
    [JSON.stringify(newTokens), user.id]
  );

  return true;
}

export async function upsertUserAndCreateSession(googleId: string, email: string, name: string) {
  await ensureDb();

  const tokenId = uuidv4();
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 30); // 30 days from now

  const userToken: UserToken = { tokenId, expiration };

  const meta: UserMeta = { googleId };

  const res = await pool.query(
    `SELECT id, roles FROM users WHERE meta->>'googleId' = $1 OR email = $2`,
    [googleId, email]
  );
  const user = res.rows[0];

  if (!user) {
    const roles = ["user"];
    const inserted = await pool.query(
      `INSERT INTO users (email, name, roles, tokens, meta) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email, name, JSON.stringify(roles), JSON.stringify([userToken]), JSON.stringify(meta)]
    );
    return { userId: inserted.rows[0].id as string, tokenId, roles };
  } else {
    const roles = user.roles || ["user"];
    await pool.query(
      `UPDATE users
       SET meta = meta || $1::jsonb, roles = $2::jsonb, tokens = tokens || $3::jsonb
       WHERE id = $4`,
      [JSON.stringify(meta), JSON.stringify(roles), JSON.stringify([userToken]), user.id]
    );
    return { userId: user.id as string, tokenId, roles };
  }
}
