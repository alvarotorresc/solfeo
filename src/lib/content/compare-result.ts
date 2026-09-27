import type { Celda, Esperado } from '../../content/schemas';

/** Result of running a query: column names and rows, as sql.js returns them. */
export interface QueryResult {
  columns: string[];
  rows: Celda[][];
}

/** Floating point noise allowed when comparing numbers (sums of prices, averages). */
const EPSILON = 1e-9;

function sameCell(a: Celda, b: Celda): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= EPSILON;
  return a === b;
}

function sameRow(a: Celda[], b: Celda[]): boolean {
  return a.length === b.length && a.every((cell, i) => sameCell(cell, b[i] ?? null));
}

/** Total order over cells (NULL, then numbers, then text) so rows can be sorted canonically. */
function compareCells(a: Celda, b: Celda): number {
  const rank = (cell: Celda): number => (cell === null ? 0 : typeof cell === 'number' ? 1 : 2);
  const byRank = rank(a) - rank(b);
  if (byRank !== 0) return byRank;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en');
}

function compareRows(a: Celda[], b: Celda[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const diff = compareCells(a[i] ?? null, b[i] ?? null);
    if (diff !== 0) return diff;
  }
  return a.length - b.length;
}

/**
 * Compares a query result against its expected value from `sql.yaml`.
 * Returns `null` when they match, or a human-readable reason (in Spanish) when they do not.
 * With `orden_importa: false` rows are compared as a multiset: duplicates still count.
 */
export function compareResult(actual: QueryResult, expected: Esperado): string | null {
  if (actual.columns.join('|') !== expected.columnas.join('|')) {
    return `Columnas distintas: se esperaba [${expected.columnas.join(', ')}] y salió [${actual.columns.join(', ')}]`;
  }

  if (expected.num_filas !== undefined) {
    return actual.rows.length === expected.num_filas
      ? null
      : `Se esperaban ${expected.num_filas} filas y salieron ${actual.rows.length}`;
  }

  const expectedRows = expected.filas ?? [];
  if (actual.rows.length !== expectedRows.length) {
    return `Se esperaban ${expectedRows.length} filas y salieron ${actual.rows.length}`;
  }

  const left = expected.orden_importa ? actual.rows : [...actual.rows].sort(compareRows);
  const right = expected.orden_importa ? expectedRows : [...expectedRows].sort(compareRows);
  const mismatch = left.findIndex((row, i) => !sameRow(row, right[i] ?? []));
  if (mismatch === -1) return null;

  return `La fila ${mismatch + 1} no coincide: se esperaba ${JSON.stringify(right[mismatch])} y salió ${JSON.stringify(left[mismatch])}`;
}
