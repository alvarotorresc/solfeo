import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

let sqlJs: Promise<SqlJsStatic> | undefined;

/** Opens a fresh in-memory SQLite database loaded with `seed`. Node only: sql.js finds its wasm. */
export async function openDatabase(seed: string): Promise<Database> {
  sqlJs ??= initSqlJs();
  const db = new (await sqlJs).Database();
  db.exec(seed);
  return db;
}
