/**
 * Messages between the playground island and its SQLite worker, plus the playground limits.
 * The worker opens `tienda`, answers `listo` (or `fallo`), and then one message per query.
 */

/** Rows shown at most per query; the rest are cut. */
export const MAX_FILAS = 500;

/**
 * Soft limit, checked by `runQuery` between rows inside the worker: the query stops and the
 * database keeps its state.
 */
export const LIMITE_BLANDO_MS = 2_000;

/**
 * Hard limit, measured on the main thread: the worker is terminated and recreated, so a query that
 * never yields a row (an aggregate over an endless CTE) cannot freeze the page. The database goes
 * back to its initial state.
 */
export const LIMITE_DURO_MS = 5_000;

/** Query already written in the editor on first load. */
export const CONSULTA_INICIAL = `SELECT nombre, precio
FROM productos
ORDER BY precio DESC
LIMIT 10;`;

/**
 * Characters of a text cell sent to the page; longer text is cut so a query like
 * `SELECT printf('%.*c', 1e8, 'a')` cannot flood the page.
 */
export const MAX_CARACTERES = 1_000;

/**
 * A cell as the worker sends it. Long text arrives cut and BLOBs only as their size: the sample
 * database has none, but a query can build them.
 */
export type CeldaResultado =
  | string
  | number
  | null
  | { tipo: 'recortada'; texto: string; longitud: number }
  | { tipo: 'blob'; bytes: number };

export interface ColumnaEsquema {
  nombre: string;
  tipo: string;
  clave: boolean;
}

export interface TablaEsquema {
  nombre: string;
  columnas: ColumnaEsquema[];
}

export interface Peticion {
  tipo: 'ejecutar';
  id: number;
  sql: string;
}

/** Result of one query, as the island paints it. */
export type Resultado =
  | {
      tipo: 'filas';
      columnas: string[];
      filas: CeldaResultado[][];
      truncado: boolean;
      esquema: TablaEsquema[];
    }
  | { tipo: 'hecho'; cambios: number; esquema: TablaEsquema[] }
  /** `reiniciada`: the worker crashed and was replaced, so the database is back to the seed. */
  | { tipo: 'error'; mensaje: string; detalle?: string; reiniciada?: true }
  /** The hard limit cut the query and the database was reset. Never sent by the worker. */
  | { tipo: 'tiempo'; limiteMs: number };

export type Respuesta =
  | { tipo: 'listo'; esquema: TablaEsquema[] }
  | { tipo: 'fallo'; mensaje: string }
  | { tipo: 'resultado'; id: number; resultado: Exclude<Resultado, { tipo: 'tiempo' }> };

export const MENSAJE_FALLO_CARGA =
  'No se ha podido cargar SQLite en el navegador. Recarga la página para intentarlo de nuevo.';
