import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIENDA_SQL, openTienda } from '../../../test/tienda';
import {
  atenderPeticion,
  conectarWorker,
  describirEsquema,
  prepararCelda,
  type ScopeWorker,
} from './motor';
import {
  MAX_CARACTERES,
  MAX_FILAS,
  MENSAJE_FALLO_CARGA,
  type Respuesta,
  type Resultado,
} from './protocolo';

let db: Database;

beforeEach(async () => {
  db = await openTienda();
});

afterEach(() => {
  db.close();
});

function ejecutar(sql: string): Resultado {
  const respuesta = atenderPeticion(db, { tipo: 'ejecutar', id: 7, sql });
  if (respuesta.tipo !== 'resultado') throw new Error(`Respuesta inesperada: ${respuesta.tipo}`);
  expect(respuesta.id).toBe(7);
  return respuesta.resultado;
}

describe('describirEsquema', () => {
  it('lists the tables of tienda in creation order, with their columns and keys', () => {
    const esquema = describirEsquema(db);
    expect(esquema.map((t) => t.nombre)).toEqual([
      'categorias',
      'productos',
      'clientes',
      'pedidos',
      'lineas_pedido',
      'pagos',
      'empleados',
      'resenas',
    ]);
    const categorias = esquema[0];
    expect(categorias?.columnas.map((c) => c.nombre)).toEqual(['id', 'nombre', 'padre_id']);
    expect(categorias?.columnas[0]).toEqual({ nombre: 'id', tipo: 'INTEGER', clave: true });
    expect(categorias?.columnas[1]?.clave).toBe(false);
  });

  it('returns no tables for an empty database', async () => {
    const SQL = await initSqlJs();
    const vacia = new SQL.Database();
    expect(describirEsquema(vacia)).toEqual([]);
    vacia.close();
  });

  it('copes with NULL names and empty pragma answers', () => {
    // SQLite never returns these for real tables; the stub covers the defensive fallbacks.
    const falsa = {
      exec: (sql: string) =>
        sql.includes('sqlite_schema') ? [{ columns: ['name'], values: [[null]] }] : [],
    } as unknown as Database;
    expect(describirEsquema(falsa)).toEqual([{ nombre: 'null', columnas: [] }]);
  });
});

describe('prepararCelda', () => {
  it('keeps numbers, NULL and short text as they are', () => {
    expect(prepararCelda(3.5)).toBe(3.5);
    expect(prepararCelda(null)).toBeNull();
    expect(prepararCelda('Madrid')).toBe('Madrid');
    expect(prepararCelda('x'.repeat(MAX_CARACTERES))).toBe('x'.repeat(MAX_CARACTERES));
  });

  it('cuts long text and marks it', () => {
    expect(prepararCelda('x'.repeat(MAX_CARACTERES + 1))).toEqual({
      tipo: 'recortada',
      texto: 'x'.repeat(MAX_CARACTERES),
      longitud: MAX_CARACTERES + 1,
    });
  });

  it('replaces BLOBs with their length', () => {
    expect(prepararCelda(new Uint8Array(4))).toEqual({ tipo: 'blob', bytes: 4 });
  });
});

describe('atenderPeticion on tienda', () => {
  it('returns the rows of a SELECT with their column names', () => {
    const resultado = ejecutar('SELECT count(*) AS total FROM clientes');
    expect(resultado).toMatchObject({ tipo: 'filas', columnas: ['total'], filas: [[50]] });
    expect(resultado.tipo === 'filas' && resultado.truncado).toBe(false);
  });

  it('keeps the columns of a SELECT without rows', () => {
    expect(ejecutar("SELECT id, nombre FROM clientes WHERE ciudad = 'Atlantis'")).toMatchObject({
      tipo: 'filas',
      columnas: ['id', 'nombre'],
      filas: [],
    });
  });

  it('sends huge text and BLOB cells already cut, so the message stays small', () => {
    const resultado = ejecutar(
      `SELECT printf('%.*c', 100000, 'a') AS largo, zeroblob(100000) AS datos, 'corto' AS corto`,
    );
    expect(resultado).toMatchObject({
      tipo: 'filas',
      filas: [[{ tipo: 'recortada', longitud: 100000 }, { tipo: 'blob', bytes: 100000 }, 'corto']],
    });
  });

  it('cuts long results at the playground limit', () => {
    const resultado = ejecutar(
      'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT x FROM n',
    );
    expect(resultado.tipo === 'filas' && resultado.filas.length).toBe(MAX_FILAS);
    expect(resultado.tipo === 'filas' && resultado.truncado).toBe(true);
  });

  it('counts the rows changed by statements without results and updates the schema', () => {
    expect(ejecutar('DELETE FROM resenas WHERE nota < 3')).toMatchObject({ tipo: 'hecho' });
    const antes = ejecutar('SELECT count(*) FROM resenas');
    const borradas = ejecutar('DELETE FROM resenas');
    expect(borradas).toMatchObject({ tipo: 'hecho' });
    expect(borradas.tipo === 'hecho' && borradas.cambios).toBe(
      antes.tipo === 'filas' ? antes.filas[0]?.[0] : -1,
    );

    const creada = ejecutar('CREATE TABLE notas (id INTEGER PRIMARY KEY, texto TEXT)');
    expect(creada).toMatchObject({ tipo: 'hecho', cambios: 0 });
    expect(creada.tipo === 'hecho' && creada.esquema.at(-1)?.nombre).toBe('notas');
  });

  it('answers with an error, never throws, when the database itself fails', async () => {
    const SQL = await initSqlJs();
    const cerrada = new SQL.Database();
    cerrada.close();
    const respuesta = atenderPeticion(cerrada, { tipo: 'ejecutar', id: 3, sql: 'SELECT 1' });
    expect(respuesta).toMatchObject({ tipo: 'resultado', id: 3, resultado: { tipo: 'error' } });
  });

  it('returns SQLite errors translated, without throwing', () => {
    expect(ejecutar('SELECT * FROM clientez')).toEqual({
      tipo: 'error',
      mensaje: 'No existe la tabla «clientez».',
      detalle: 'no such table: clientez',
    });
    expect(ejecutar('SELEC 1')).toMatchObject({ mensaje: 'Error de sintaxis cerca de «SELEC».' });
  });
});

function scopeFalso(): ScopeWorker & { mensajes: Respuesta[] } {
  const mensajes: Respuesta[] = [];
  return { mensajes, onmessage: null, postMessage: (m) => mensajes.push(m) };
}

describe('conectarWorker', () => {
  it('opens the seed, announces the schema and answers queries', async () => {
    const scope = scopeFalso();
    await conectarWorker(scope, () => initSqlJs(), TIENDA_SQL);
    expect(scope.mensajes[0]).toMatchObject({ tipo: 'listo' });

    scope.onmessage?.({ data: { tipo: 'ejecutar', id: 1, sql: 'SELECT count(*) FROM productos' } });
    await new Promise((r) => setTimeout(r, 0));
    expect(scope.mensajes[1]).toMatchObject({
      tipo: 'resultado',
      id: 1,
      resultado: { tipo: 'filas', filas: [[40]] },
    });
  });

  it('reports a failure when sql.js cannot load', async () => {
    const scope = scopeFalso();
    await conectarWorker(scope, () => Promise.reject(new Error('wasm')), TIENDA_SQL);
    expect(scope.mensajes).toEqual([{ tipo: 'fallo', mensaje: MENSAJE_FALLO_CARGA }]);
    // A query after a failure gets an error back instead of waiting forever.
    scope.onmessage?.({ data: { tipo: 'ejecutar', id: 1, sql: 'SELECT 1' } });
    await new Promise((r) => setTimeout(r, 0));
    expect(scope.mensajes[1]).toEqual({
      tipo: 'resultado',
      id: 1,
      resultado: { tipo: 'error', mensaje: MENSAJE_FALLO_CARGA },
    });
  });

  it('ignores messages that are not a query', async () => {
    const scope = scopeFalso();
    await conectarWorker(scope, () => initSqlJs(), TIENDA_SQL);
    for (const data of [null, 'SELECT 1', { id: 1 }, { id: 'x', sql: 'SELECT 1' }]) {
      scope.onmessage?.({ data: data as never });
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(scope.mensajes).toHaveLength(1);
  });
});
