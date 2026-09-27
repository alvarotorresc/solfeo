import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { runQuery } from './run-query';

describe('runQuery', () => {
  it('returns the last result set, or nothing for statements without results', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    expect(runQuery(db, 'CREATE TABLE t (a INTEGER); INSERT INTO t VALUES (1), (2);')).toEqual({
      columns: [],
      rows: [],
    });
    expect(runQuery(db, 'SELECT 0 AS x; SELECT a FROM t ORDER BY a DESC;')).toEqual({
      columns: ['a'],
      rows: [[2], [1]],
    });
    db.close();
  });

  it('keeps the columns of a SELECT that matches no rows', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    expect(runQuery(db, 'CREATE TABLE t (a INTEGER); SELECT a FROM t WHERE a = NULL;')).toEqual({
      columns: ['a'],
      rows: [],
    });
    db.close();
  });

  it('reports SQL errors', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    expect(() => runQuery(db, 'SELECT * FROM no_existe')).toThrow(/no such table/);
    db.close();
  });

  const INFINITA =
    'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT x FROM c';

  it('stops a query that returns too many rows', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    expect(() => runQuery(db, INFINITA)).toThrow(/más de 10000 filas/);
    db.close();
  });

  it('stops a query that takes too long', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    expect(() => runQuery(db, INFINITA, { maxFilas: Infinity, maxMs: 20 })).toThrow(/más de 20 ms/);
    db.close();
  });

  it('cuts the rows instead of throwing when asked to truncate', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    expect(runQuery(db, INFINITA, { maxFilas: 3, truncar: true })).toEqual({
      columns: ['x'],
      rows: [[1], [2], [3]],
      truncado: true,
    });
    db.close();
  });

  it('does not flag a result that fits exactly within the row limit', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    expect(
      runQuery(db, 'SELECT 1 AS x UNION ALL SELECT 2', { maxFilas: 2, truncar: true }),
    ).toEqual({ columns: ['x'], rows: [[1], [2]] });
    db.close();
  });
});
