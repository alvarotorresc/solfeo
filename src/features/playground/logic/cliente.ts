/**
 * Main-thread side of the playground: owns the SQLite worker, sends one query at a time and
 * enforces the hard time limit. sql.js cannot interrupt a statement, so when a query runs past the
 * limit the worker is terminated and a fresh one (with a fresh database) takes its place.
 * The worker factory and the clock are injected so all of this runs in tests without a browser.
 */
import {
  MENSAJE_FALLO_CARGA,
  type Peticion,
  type Respuesta,
  type Resultado,
  type TablaEsquema,
} from './protocolo';

/** The part of a `Worker` the client uses. */
export interface WorkerSql {
  postMessage(peticion: Peticion): void;
  terminate(): void;
  onmessage: ((evento: { data: Respuesta }) => void) | null;
  onerror: ((evento: unknown) => void) | null;
}

export interface Reloj {
  programar(accion: () => void, ms: number): unknown;
  cancelar(temporizador: unknown): void;
}

export interface OpcionesCliente {
  nuevoWorker: () => WorkerSql;
  reloj: Reloj;
  limiteMs: number;
}

export interface ClienteSql {
  /**
   * Schema of the current database, once its worker is ready. Rejects if sql.js cannot load.
   * After a result for which `baseReiniciada` is true, it follows the new worker.
   */
  esquema(): Promise<TablaEsquema[]>;
  /** Runs `sql`. Rejects only if another query is still running or the worker cannot load. */
  ejecutar(sql: string): Promise<Resultado>;
  /** Throws the current database away and opens a fresh copy of the seed. */
  reiniciar(): Promise<TablaEsquema[]>;
  cerrar(): void;
}

export const MENSAJE_WORKER_CAIDO =
  'El motor de SQLite se ha detenido. La base ha vuelto a su estado inicial.';

/** Whether the worker was replaced while answering, so the database is back to the seed. */
export function baseReiniciada(resultado: Resultado): boolean {
  return (
    resultado.tipo === 'tiempo' || (resultado.tipo === 'error' && resultado.reiniciada === true)
  );
}

interface Pendiente {
  id: number;
  temporizador: unknown;
  resolver: (resultado: Resultado) => void;
}

export function crearCliente({ nuevoWorker, reloj, limiteMs }: OpcionesCliente): ClienteSql {
  let worker: WorkerSql;
  let listo: Promise<TablaEsquema[]>;
  let pendiente: Pendiente | null = null;
  let ocupado = false;
  let siguienteId = 1;

  function terminar(resultado: Resultado): void {
    if (!pendiente) return;
    reloj.cancelar(pendiente.temporizador);
    const { resolver } = pendiente;
    pendiente = null;
    ocupado = false;
    resolver(resultado);
  }

  function arrancar(): void {
    const actual = nuevoWorker();
    worker = actual;
    listo = new Promise((resolve, reject) => {
      actual.onmessage = ({ data }) => {
        if (worker !== actual) return;
        if (data.tipo === 'listo') resolve(data.esquema);
        else if (data.tipo === 'fallo') reject(new Error(data.mensaje));
        else if (pendiente?.id === data.id) terminar(data.resultado);
      };
      actual.onerror = () => {
        if (worker !== actual) return;
        if (pendiente) {
          terminar({ tipo: 'error', mensaje: MENSAJE_WORKER_CAIDO, reiniciada: true });
          reemplazar();
        } else {
          reject(new Error(MENSAJE_FALLO_CARGA));
        }
      };
    });
    // Callers see the rejection through esquema() or ejecutar(); avoid an unhandled one here.
    listo.catch(() => undefined);
  }

  function reemplazar(): void {
    const viejo = worker;
    viejo.onmessage = null;
    viejo.onerror = null;
    viejo.terminate();
    arrancar();
  }

  arrancar();

  return {
    esquema: () => listo,

    async ejecutar(sql) {
      if (ocupado) throw new Error('Ya hay una consulta en marcha.');
      ocupado = true;
      try {
        await listo;
      } catch (error) {
        ocupado = false;
        throw error;
      }
      const id = siguienteId;
      siguienteId += 1;
      return new Promise<Resultado>((resolver) => {
        // The clock starts once the worker is ready, so loading SQLite never counts as query time.
        const temporizador = reloj.programar(() => {
          if (pendiente?.id !== id) return;
          terminar({ tipo: 'tiempo', limiteMs });
          reemplazar();
        }, limiteMs);
        pendiente = { id, temporizador, resolver };
        worker.postMessage({ tipo: 'ejecutar', id, sql });
      });
    },

    reiniciar() {
      if (ocupado) return Promise.reject(new Error('Ya hay una consulta en marcha.'));
      reemplazar();
      return listo;
    },

    cerrar() {
      if (pendiente) reloj.cancelar(pendiente.temporizador);
      pendiente = null;
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    },
  };
}
