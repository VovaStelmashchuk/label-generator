import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./mongo";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-do-not-use-in-production";

export interface UserToken {
  tokenId: string;
  expiration: Date;
}

import type { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId;
  googleId: string;
  email: string;
  name: string;
  roles: string[];
  tokens: UserToken[];
}

export function generateAuthToken(tokenId: string, userId: string, roles: string[]) {
  // Using jsonwebtoken to generate a token with token_id, roles, and user id
  return jwt.sign({ tokenId, roles, userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string): { tokenId: string; userId: string; roles: string[] } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { tokenId: string; userId: string; roles: string[] };
  } catch (_error) {
    return null;
  }
}

export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;

  const decoded = verifyAuthToken(token);
  if (!decoded) return null;

  const db = await getDb();
  const user = await db.collection("users").findOne({
    googleId: decoded.userId,
    "tokens.tokenId": decoded.tokenId
  });

  if (!user) return null;
  return decoded.userId;
}

export async function getUserIdFromServer(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const decoded = verifyAuthToken(token);
  if (!decoded) return null;

  const db = await getDb();
  const user = await db.collection("users").findOne({
    googleId: decoded.userId,
    "tokens.tokenId": decoded.tokenId
  });

  if (!user) return null;
  return decoded.userId;
}

export async function getUserFromServer(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const decoded = verifyAuthToken(token);
  if (!decoded) return null;

  const db = await getDb();
  const user = await db.collection("users").findOne({
    googleId: decoded.userId,
    "tokens.tokenId": decoded.tokenId
  });

  return user as User | null;
}

export async function deleteSession(token: string): Promise<boolean> {
  const decoded = verifyAuthToken(token);
  if (!decoded) return false;

  const db = await getDb();
  await db.collection("users").updateOne(
    { googleId: decoded.userId },
    { $pull: { tokens: { tokenId: decoded.tokenId } } as unknown as import("mongodb").UpdateFilter<Document> }
  );
  return true;
}

export async function upsertUserAndCreateSession(googleId: string, email: string, name: string) {
  const db = await getDb();
  const usersCollection = db.collection("users");

  const tokenId = uuidv4();
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 30); // 30 days from now

  const userToken: UserToken = { tokenId, expiration };

  const user = await usersCollection.findOne({ $or: [{ googleId }, { email }] }) as User | null;

  if (!user) {
    const newUser: User = {
      googleId,
      email,
      name,
      roles: ["user"],
      tokens: [userToken],
    };
    await usersCollection.insertOne(newUser);
    return { userId: googleId, tokenId, roles: newUser.roles };
  } else {
    // Ensure the user has roles array
    const roles = user.roles || ["user"];
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $push: { tokens: userToken } as unknown as import("mongodb").UpdateFilter<Document>,
        $set: { googleId, roles } // set googleId in case it was missing
      }
    );
    return { userId: googleId, tokenId, roles };
  }
}
