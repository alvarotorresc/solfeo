import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { TIENDA_SQL } from '../../../test/tienda';
import {
  MENSAJE_WORKER_CAIDO,
  baseReiniciada,
  crearCliente,
  type Reloj,
  type WorkerSql,
} from './cliente';
import { conectarWorker, type ScopeWorker } from './motor';
import { MENSAJE_FALLO_CARGA, type Peticion, type Respuesta } from './protocolo';

/** Worker double: records what it receives and lets the test answer by hand. */
class WorkerFalso implements WorkerSql {
  onmessage: WorkerSql['onmessage'] = null;
  onerror: WorkerSql['onerror'] = null;
  recibidas: Peticion[] = [];
  terminado = false;
  postMessage(peticion: Peticion) {
    this.recibidas.push(peticion);
  }
  terminate() {
    this.terminado = true;
  }
  responder(data: Respuesta) {
    this.onmessage?.({ data });
  }
}

/** Manual clock: timers only fire when the test calls `avanzar`. */
function relojFalso() {
  const timers = new Map<number, () => void>();
  let siguiente = 0;
  const reloj: Reloj = {
    programar(accion) {
      siguiente += 1;
      timers.set(siguiente, accion);
      return siguiente;
    },
    cancelar(id) {
      timers.delete(id as number);
    },
  };
  return {
    reloj,
    pendientes: () => timers.size,
    avanzar() {
      const acciones = [...timers.values()];
      timers.clear();
      acciones.forEach((accion) => accion());
    },
  };
}

function montar() {
  const workers: WorkerFalso[] = [];
  const reloj = relojFalso();
  const cliente = crearCliente({
    nuevoWorker: () => {
      const w = new WorkerFalso();
      workers.push(w);
      return w;
    },
    reloj: reloj.reloj,
    limiteMs: 5000,
  });
  const ultimo = () => workers.at(-1) as WorkerFalso;
  return { cliente, workers, reloj, ultimo };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const ESQUEMA = [{ nombre: 't', columnas: [{ nombre: 'a', tipo: 'INTEGER', clave: true }] }];

describe('baseReiniciada', () => {
  it('is true only for results after which the worker was replaced', () => {
    expect(baseReiniciada({ tipo: 'tiempo', limiteMs: 5000 })).toBe(true);
    expect(baseReiniciada({ tipo: 'error', mensaje: 'x', reiniciada: true })).toBe(true);
    expect(baseReiniciada({ tipo: 'error', mensaje: 'x' })).toBe(false);
    expect(baseReiniciada({ tipo: 'hecho', cambios: 0, esquema: [] })).toBe(false);
  });
});

describe('crearCliente', () => {
  it('rejects a second query while the first one is still waiting for the worker', async () => {
    const { cliente, ultimo } = montar();
    const primera = cliente.ejecutar('SELECT 1');
    await expect(cliente.ejecutar('SELECT 2')).rejects.toThrow(/en marcha/);
    ultimo().responder({ tipo: 'listo', esquema: ESQUEMA });
    await tick();
    expect(ultimo().recibidas).toEqual([{ tipo: 'ejecutar', id: 1, sql: 'SELECT 1' }]);
    ultimo().responder({ tipo: 'resultado', id: 1, resultado: { tipo: 'error', mensaje: 'a' } });
    await expect(primera).resolves.toMatchObject({ mensaje: 'a' });
  });

  it('waits for the worker to be ready before sending a query', async () => {
    const { cliente, ultimo } = montar();
    const resultado = cliente.ejecutar('SELECT 1');
    await tick();
    expect(ultimo().recibidas).toEqual([]);

    ultimo().responder({ tipo: 'listo', esquema: ESQUEMA });
    await expect(cliente.esquema()).resolves.toEqual(ESQUEMA);
    await tick();
    expect(ultimo().recibidas).toEqual([{ tipo: 'ejecutar', id: 1, sql: 'SELECT 1' }]);

    ultimo().responder({
      tipo: 'resultado',
      id: 1,
      resultado: { tipo: 'hecho', cambios: 0, esquema: ESQUEMA },
    });
    await expect(resultado).resolves.toEqual({ tipo: 'hecho', cambios: 0, esquema: ESQUEMA });
  });

  it('runs one query at a time and cancels the timer when the answer arrives', async () => {
    const { cliente, ultimo, reloj } = montar();
    ultimo().responder({ tipo: 'listo', esquema: ESQUEMA });
    const primera = cliente.ejecutar('SELECT 1');
    await expect(cliente.ejecutar('SELECT 2')).rejects.toThrow(/en marcha/);
    await expect(cliente.reiniciar()).rejects.toThrow(/en marcha/);
    await tick();
    expect(reloj.pendientes()).toBe(1);

    // Answers for other ids (a stale query) are ignored.
    ultimo().responder({ tipo: 'resultado', id: 99, resultado: { tipo: 'error', mensaje: 'x' } });
    ultimo().responder({ tipo: 'resultado', id: 1, resultado: { tipo: 'error', mensaje: 'y' } });
    await expect(primera).resolves.toEqual({ tipo: 'error', mensaje: 'y' });
    expect(reloj.pendientes()).toBe(0);

    const segunda = cliente.ejecutar('SELECT 2');
    await tick();
    expect(ultimo().recibidas.at(-1)).toEqual({ tipo: 'ejecutar', id: 2, sql: 'SELECT 2' });
    ultimo().responder({ tipo: 'resultado', id: 2, resultado: { tipo: 'error', mensaje: 'z' } });
    await expect(segunda).resolves.toMatchObject({ mensaje: 'z' });
  });

  it('terminates and replaces the worker when a query runs past the hard limit', async () => {
    const { cliente, workers, ultimo, reloj } = montar();
    ultimo().responder({ tipo: 'listo', esquema: ESQUEMA });
    const colgada = cliente.ejecutar('SELECT count(*) FROM infinita');
    await tick();

    reloj.avanzar();
    await expect(colgada).resolves.toEqual({ tipo: 'tiempo', limiteMs: 5000 });
    expect(workers).toHaveLength(2);
    expect(workers[0]?.terminado).toBe(true);

    // esquema() now follows the new worker, so the page can refresh its tables.
    const nuevo: typeof ESQUEMA = [];
    const esquema = cliente.esquema();

    // A late answer from the dead worker changes nothing.
    workers[0]?.responder({ tipo: 'resultado', id: 1, resultado: { tipo: 'error', mensaje: 'x' } });

    // The new worker serves the next query once it is ready.
    const siguiente = cliente.ejecutar('SELECT 1');
    ultimo().responder({ tipo: 'listo', esquema: nuevo });
    await expect(esquema).resolves.toBe(nuevo);
    await tick();
    expect(ultimo().recibidas).toEqual([{ tipo: 'ejecutar', id: 2, sql: 'SELECT 1' }]);
    ultimo().responder({ tipo: 'resultado', id: 2, resultado: { tipo: 'error', mensaje: 'ok' } });
    await expect(siguiente).resolves.toMatchObject({ mensaje: 'ok' });
  });

  it('ignores a timer that fires after its query already finished', async () => {
    // A clock that never cancels, so the timer of a finished query still fires.
    let disparar: (() => void) | undefined;
    const workers: WorkerFalso[] = [];
    const cliente = crearCliente({
      nuevoWorker: () => {
        const w = new WorkerFalso();
        workers.push(w);
        return w;
      },
      reloj: { programar: (accion) => (disparar = accion), cancelar: () => undefined },
      limiteMs: 10,
    });
    workers[0]?.responder({ tipo: 'listo', esquema: ESQUEMA });
    const consulta = cliente.ejecutar('SELECT 1');
    await tick();
    workers[0]?.responder({ tipo: 'resultado', id: 1, resultado: { tipo: 'error', mensaje: 'a' } });
    await consulta;
    disparar?.();
    expect(workers).toHaveLength(1);
    expect(workers[0]?.terminado).toBe(false);
  });

  it('resets the database by replacing the worker', async () => {
    const { cliente, workers, ultimo } = montar();
    ultimo().responder({ tipo: 'listo', esquema: ESQUEMA });
    const reinicio = cliente.reiniciar();
    expect(workers[0]?.terminado).toBe(true);
    ultimo().responder({ tipo: 'listo', esquema: [] });
    await expect(reinicio).resolves.toEqual([]);
  });

  it('rejects when sql.js cannot load, and recovers after a reset', async () => {
    const { cliente, ultimo } = montar();
    ultimo().responder({ tipo: 'fallo', mensaje: MENSAJE_FALLO_CARGA });
    await expect(cliente.esquema()).rejects.toThrow(MENSAJE_FALLO_CARGA);
    await expect(cliente.ejecutar('SELECT 1')).rejects.toThrow(MENSAJE_FALLO_CARGA);

    const reinicio = cliente.reiniciar();
    ultimo().responder({ tipo: 'listo', esquema: ESQUEMA });
    await expect(reinicio).resolves.toEqual(ESQUEMA);
  });

  it('treats a worker error before it is ready as a load failure', async () => {
    const { cliente, ultimo } = montar();
    ultimo().onerror?.(new Event('error'));
    await expect(cliente.esquema()).rejects.toThrow(MENSAJE_FALLO_CARGA);
  });

  it('answers a crash during a query with an error and a fresh worker', async () => {
    const { cliente, workers, ultimo, reloj } = montar();
    ultimo().responder({ tipo: 'listo', esquema: ESQUEMA });
    const consulta = cliente.ejecutar('SELECT 1');
    await tick();
    ultimo().onerror?.(new Event('error'));
    await expect(consulta).resolves.toEqual({
      tipo: 'error',
      mensaje: MENSAJE_WORKER_CAIDO,
      reiniciada: true,
    });
    expect(workers).toHaveLength(2);
    const esquema = cliente.esquema();
    ultimo().responder({ tipo: 'listo', esquema: [] });
    await expect(esquema).resolves.toEqual([]);
    expect(reloj.pendientes()).toBe(0);
    // Errors from the replaced worker are ignored.
    workers[0]?.onerror?.(new Event('error'));
    expect(workers).toHaveLength(2);
  });

  it('closes the worker and its timer', async () => {
    const { cliente, ultimo, reloj } = montar();
    ultimo().responder({ tipo: 'listo', esquema: ESQUEMA });
    void cliente.ejecutar('SELECT 1');
    await tick();
    cliente.cerrar();
    expect(ultimo().terminado).toBe(true);
    expect(reloj.pendientes()).toBe(0);
  });
});

/**
 * Integration: the real client and the real worker logic, joined in memory, against tienda.sql.
 * Only the browser Worker and the timer are replaced.
 */
function workerEnMemoria(): WorkerSql {
  const worker: WorkerSql = {
    onmessage: null,
    onerror: null,
    postMessage: (peticion) => scope.onmessage?.({ data: peticion }),
    terminate: () => undefined,
  };
  const scope: ScopeWorker = {
    onmessage: null,
    postMessage: (respuesta) => worker.onmessage?.({ data: respuesta }),
  };
  void conectarWorker(scope, () => initSqlJs(), TIENDA_SQL);
  return worker;
}

describe('playground end to end in Node', () => {
  it('queries tienda, changes it and gets a fresh copy after a reset', async () => {
    const reloj: Reloj = { programar: () => 0, cancelar: () => undefined };
    const cliente = crearCliente({ nuevoWorker: workerEnMemoria, reloj, limiteMs: 5000 });

    expect((await cliente.esquema()).map((t) => t.nombre)).toContain('productos');
    await expect(cliente.ejecutar('SELECT count(*) AS n FROM productos')).resolves.toMatchObject({
      tipo: 'filas',
      columnas: ['n'],
      filas: [[40]],
    });
    await expect(cliente.ejecutar('DELETE FROM lineas_pedido')).resolves.toMatchObject({
      tipo: 'hecho',
    });
    await expect(cliente.ejecutar('SELECT count(*) FROM lineas_pedido')).resolves.toMatchObject({
      filas: [[0]],
    });
    await expect(cliente.ejecutar('SELECT * FROM nada')).resolves.toMatchObject({
      tipo: 'error',
      mensaje: 'No existe la tabla «nada».',
    });

    await cliente.reiniciar();
    const tras = await cliente.ejecutar('SELECT count(*) > 0 FROM lineas_pedido');
    expect(tras).toMatchObject({ filas: [[1]] });
    cliente.cerrar();
  });
});
