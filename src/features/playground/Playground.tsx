/**
 * SQL playground island. Only paints: SQLite runs in `sql.worker.ts`, the worker lifecycle and the
 * time limit live in `logic/cliente.ts`, and every text comes from `logic/formato.ts`.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import EsquemaTablas from './EsquemaTablas';
import TablaResultado from './TablaResultado';
import { baseReiniciada, crearCliente, type ClienteSql, type WorkerSql } from './logic/cliente';
import { lineaEstado, mensajeDeError, type Fase, type Ultimo } from './logic/formato';
import { CONSULTA_INICIAL, LIMITE_DURO_MS, type TablaEsquema } from './logic/protocolo';

function nuevoWorker(): WorkerSql {
  const worker = new Worker(new URL('./sql.worker.ts', import.meta.url), { type: 'module' });
  return worker as unknown as WorkerSql;
}

const reloj = {
  programar: (accion: () => void, ms: number) => window.setTimeout(accion, ms),
  cancelar: (temporizador: unknown) => window.clearTimeout(temporizador as number),
};

export default function Playground() {
  const cliente = useRef<ClienteSql | null>(null);
  // Blocks a second Ctrl+Enter that arrives before the "ejecutando" render.
  const enMarcha = useRef(false);
  const [sql, setSql] = useState(CONSULTA_INICIAL);
  const [fase, setFase] = useState<Fase>('cargando');
  const [fallo, setFallo] = useState('');
  const [esquema, setEsquema] = useState<TablaEsquema[]>([]);
  const [ultimo, setUltimo] = useState<Ultimo>(null);

  const esperarBase = (esquemaListo: Promise<TablaEsquema[]>) =>
    esquemaListo.then(
      (tablas) => {
        setEsquema(tablas);
        setFase('listo');
      },
      (error: unknown) => {
        setFallo(mensajeDeError(error));
        setFase('fallo');
      },
    );

  useEffect(() => {
    const nuevo = crearCliente({ nuevoWorker, reloj, limiteMs: LIMITE_DURO_MS });
    cliente.current = nuevo;
    void esperarBase(nuevo.esquema());
    return () => nuevo.cerrar();
  }, []);

  const ejecutar = async () => {
    const actual = cliente.current;
    if (!actual || enMarcha.current || fase !== 'listo' || sql.trim() === '') return;
    enMarcha.current = true;
    setFase('ejecutando');
    const resultado = await actual
      .ejecutar(sql)
      .catch((error: unknown) => ({ tipo: 'error', mensaje: mensajeDeError(error) }) as const);
    enMarcha.current = false;
    setUltimo(resultado);
    if ('esquema' in resultado) setEsquema(resultado.esquema);
    if (baseReiniciada(resultado)) {
      // The worker is new: wait for its database and refresh the tables before the next query.
      setFase('cargando');
      void esperarBase(actual.esquema());
    } else {
      setFase('listo');
    }
  };

  const reiniciar = async () => {
    const actual = cliente.current;
    if (!actual || enMarcha.current || fase === 'ejecutando' || fase === 'cargando') return;
    setFase('cargando');
    setUltimo(null);
    setEsquema([]);
    await esperarBase(actual.reiniciar());
    setUltimo({ tipo: 'reiniciada' });
  };

  const alPulsarTecla = (evento: KeyboardEvent) => {
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault();
      void ejecutar();
    }
  };

  const ocupado = fase === 'cargando' || fase === 'ejecutando';

  return (
    <div class="pg">
      <div class="pg-main">
        <label class="pg-label" for="pg-sql">
          Consulta SQL
        </label>
        <textarea
          id="pg-sql"
          class="pg-sql"
          value={sql}
          onInput={(e) => setSql(e.currentTarget.value)}
          onKeyDown={alPulsarTecla}
          rows={8}
          spellcheck={false}
          autocomplete="off"
          autocapitalize="off"
          aria-describedby="pg-atajo"
        />
        <div class="pg-acciones">
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => void ejecutar()}
            aria-disabled={fase !== 'listo'}
          >
            Ejecutar
          </button>
          <span class="pg-atajo" id="pg-atajo">
            o <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>
          </span>
          <button
            type="button"
            class="linkbtn pg-reiniciar"
            onClick={() => void reiniciar()}
            aria-disabled={ocupado}
          >
            <span class="icon" aria-hidden="true">
              restart_alt
            </span>
            Reiniciar la base
          </button>
        </div>

        {/* The SQLite wording lives inside the live region so screen readers announce it too. */}
        <div role="status" aria-live="polite">
          <p class={`pg-estado${fase === 'fallo' || ultimo?.tipo === 'error' ? ' is-bad' : ''}`}>
            {lineaEstado(fase, ultimo, fallo)}
          </p>
          {ultimo?.tipo === 'error' && ultimo.detalle && fase !== 'ejecutando' && (
            <p class="pg-detalle">
              SQLite dice: <code>{ultimo.detalle}</code>
            </p>
          )}
        </div>

        {ultimo?.tipo === 'filas' && fase !== 'ejecutando' && (
          <TablaResultado columnas={ultimo.columnas} filas={ultimo.filas} />
        )}
      </div>
      <EsquemaTablas esquema={esquema} fallo={fase === 'fallo'} />
    </div>
  );
}
