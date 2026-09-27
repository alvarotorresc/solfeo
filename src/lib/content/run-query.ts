import type { Database } from 'sql.js';
import type { Celda } from '../../content/schemas';
import type { QueryResult } from './compare-result';

/**
 * Defaults: 10 000 rows per statement and 2 s per call. With `truncar`, a statement that returns
 * more than `maxFilas` rows is cut there instead of throwing (the playground shows the first ones).
 */
export interface QueryLimits {
  maxFilas?: number;
  maxMs?: number;
  truncar?: boolean;
}

/** `truncado` is only present, and `true`, when `truncar` cut the rows of the returned statement. */
export interface RunQueryResult extends QueryResult {
  truncado?: true;
}

/**
 * Runs one or more SQL statements and returns the result of the last one that returns columns
 * (a SELECT, even when it matches no rows). Statements without columns (INSERT, UPDATE...) are
 * executed but yield `{ columns: [], rows: [] }` when nothing else returns columns.
 *
 * `Database.exec` from sql.js drops SELECTs with zero rows entirely, so each statement is
 * stepped by hand to keep its column names.
 *
 * A statement that returns more than `maxFilas` rows, or a call that takes longer than `maxMs`,
 * throws, so a recursive CTE without a stop cannot hang the build. The time is only checked
 * between rows: sql.js has no interrupt, so a statement that never yields a row (an aggregate
 * over an endless CTE) still cannot be stopped.
 */
export function runQuery(
  db: Database,
  sql: string,
  { maxFilas = 10_000, maxMs = 2_000, truncar = false }: QueryLimits = {},
): RunQueryResult {
  let result: RunQueryResult = { columns: [], rows: [] };
  const inicio = Date.now();

  for (const statement of db.iterateStatements(sql)) {
    try {
      const columns = statement.getColumnNames();
      const rows: Celda[][] = [];
      let truncado = false;
      while (statement.step()) {
        if (truncar && rows.length === maxFilas) {
          truncado = true;
          break;
        }
        // sql.js returns Uint8Array for BLOB values; the sample database has none.
        rows.push(statement.get() as Celda[]);
        if (rows.length > maxFilas) {
          throw new Error(`La consulta devuelve más de ${maxFilas} filas`);
        }
        if (Date.now() - inicio > maxMs) {
          throw new Error(`La consulta tarda más de ${maxMs} ms`);
        }
      }
      if (columns.length > 0) result = truncado ? { columns, rows, truncado } : { columns, rows };
    } finally {
      statement.free();
    }
  }

  return result;
}
