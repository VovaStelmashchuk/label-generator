import 'server-only';

import { GridFSBucket, MongoClient, type Db } from 'mongodb';

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error('MONGO_URI environment variable is not defined');
}

// The dev server re-evaluates modules on every hot reload; caching the client on
// globalThis keeps a single connection pool instead of leaking one per reload.
const globalForMongo = globalThis as unknown as {
  __labelGeneratorMongo?: Promise<MongoClient>;
};

function connect(): Promise<MongoClient> {
  return new MongoClient(uri, {
    // Fail fast instead of hanging a request for 30s when Mongo is down.
    serverSelectionTimeoutMS: 5000,
  }).connect();
}

export function getClient(): Promise<MongoClient> {
  if (!globalForMongo.__labelGeneratorMongo) {
    globalForMongo.__labelGeneratorMongo = connect();
  }
  return globalForMongo.__labelGeneratorMongo;
}

function databaseName(): string {
  if (process.env.MONGO_DB) return process.env.MONGO_DB;
  // mongodb:// URIs put the database in the path, which may be absent.
  const path = uri.split('?')[0].split('/')[3];
  if (!path) {
    throw new Error('Database name could not be determined. Please set MONGO_DB or include it in MONGO_URI.');
  }
  return path;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(databaseName());
}

export async function getPdfBucket(): Promise<GridFSBucket> {
  const db = await getDb();
  return new GridFSBucket(db, { bucketName: 'pdfs' });
}
