/**
 * Worker side of the playground: opens `tienda` and answers each query. The worker file only
 * wires this to `self` and to the bundled sql.js, so everything here runs in Node tests too.
 */
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { runQuery } from '../../../lib/content/run-query';
import { formatearError } from './formato';
import {
  LIMITE_BLANDO_MS,
  MAX_CARACTERES,
  MAX_FILAS,
  MENSAJE_FALLO_CARGA,
  type Peticion,
  type Respuesta,
  type CeldaResultado,
  type Resultado,
  type TablaEsquema,
} from './protocolo';

/** Tables of the database in creation order, with their columns, to help the learner find them. */
export function describirEsquema(db: Database): TablaEsquema[] {
  const tablas =
    db.exec(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
    )[0]?.values ?? [];
  return tablas.map(([nombre]) => {
    const columnas =
      db.exec('SELECT name, type, pk FROM pragma_table_info(?) ORDER BY cid', [nombre ?? ''])[0]
        ?.values ?? [];
    return {
      nombre: String(nombre),
      columnas: columnas.map(([columna, tipo, pk]) => ({
        nombre: String(columna),
        tipo: String(tipo),
        clave: Number(pk) > 0,
      })),
    };
  });
}

/** Cell ready to send to the page: long text cut to `MAX_CARACTERES`, BLOBs as their size. */
export function prepararCelda(celda: SqlValue): CeldaResultado {
  if (celda instanceof Uint8Array) return { tipo: 'blob', bytes: celda.length };
  if (typeof celda === 'string' && celda.length > MAX_CARACTERES) {
    return { tipo: 'recortada', texto: celda.slice(0, MAX_CARACTERES), longitud: celda.length };
  }
  return celda;
}

function totalCambios(db: Database): number {
  return Number(db.exec('SELECT total_changes()')[0]?.values[0]?.[0] ?? 0);
}

/** Runs one query with the playground limits. SQL errors come back as a message, never thrown. */
export function atenderPeticion(db: Database, { id, sql }: Peticion): Respuesta {
  return { tipo: 'resultado', id, resultado: ejecutar(db, sql) };
}

function ejecutar(db: Database, sql: string): Exclude<Resultado, { tipo: 'tiempo' }> {
  try {
    const antes = totalCambios(db);
    const resultado = runQuery(db, sql, {
      maxFilas: MAX_FILAS,
      maxMs: LIMITE_BLANDO_MS,
      truncar: true,
    });
    const esquema = describirEsquema(db);
    if (resultado.columns.length > 0) {
      return {
        tipo: 'filas',
        columnas: resultado.columns,
        // runQuery types rows for the content checks; sql.js may still hand back BLOBs here.
        filas: resultado.rows.map((fila) => (fila as SqlValue[]).map(prepararCelda)),
        truncado: resultado.truncado === true,
        esquema,
      };
    }
    return { tipo: 'hecho', cambios: totalCambios(db) - antes, esquema };
  } catch (error) {
    return { tipo: 'error', ...formatearError(error) };
  }
}

/** The part of a worker's global scope the playground uses. */
export interface ScopeWorker {
  postMessage(respuesta: Respuesta): void;
  onmessage: ((evento: { data: unknown }) => void) | null;
}

/** Messages come from our own page, but the worker only trusts what it can check. */
function esPeticion(data: unknown): data is Peticion {
  if (typeof data !== 'object' || data === null) return false;
  const { id, sql } = data as Partial<Record<keyof Peticion, unknown>>;
  return typeof id === 'number' && typeof sql === 'string';
}

/**
 * Loads sql.js, opens a fresh database with `semilla` and answers queries on `scope`.
 * Announces `listo` with the schema, or `fallo` if sql.js cannot load.
 */
export async function conectarWorker(
  scope: ScopeWorker,
  cargarSqlJs: () => Promise<SqlJsStatic>,
  semilla: string,
): Promise<void> {
  const base = cargarSqlJs().then((SQL) => {
    const db = new SQL.Database();
    db.exec(semilla);
    return db;
  });
  scope.onmessage = ({ data }) => {
    if (!esPeticion(data)) return;
    base.then(
      (db) => scope.postMessage(atenderPeticion(db, data)),
      () =>
        scope.postMessage({
          tipo: 'resultado',
          id: data.id,
          resultado: { tipo: 'error', mensaje: MENSAJE_FALLO_CARGA },
        }),
    );
  };
  try {
    scope.postMessage({ tipo: 'listo', esquema: describirEsquema(await base) });
  } catch {
    scope.postMessage({ tipo: 'fallo', mensaje: MENSAJE_FALLO_CARGA });
  }
}
