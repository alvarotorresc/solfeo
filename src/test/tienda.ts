import { readFileSync } from 'node:fs';
import type { Database } from 'sql.js';
import { openDatabase } from '../lib/content/open-database';

/** Seed of the sample database, shared by the playground, the validator and the lessons. */
export const TIENDA_SQL = readFileSync(new URL('../data/tienda.sql', import.meta.url), 'utf8');

/** Opens a fresh in-memory copy of the sample database, loaded from `src/data/tienda.sql`. */
export function openTienda(): Promise<Database> {
  return openDatabase(TIENDA_SQL);
}
