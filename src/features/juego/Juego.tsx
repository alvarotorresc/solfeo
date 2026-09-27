/**
 * Matching game island. Only paints: the rules live in `logic/juego.ts`. Playable with keyboard
 * and screen reader: every card is a button, a concept and a definition are picked one after the
 * other in any order, and each attempt is announced. Nothing is stored.
 */
import type { Ref } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Pasos from '../../components/Pasos';
import { NOMBRE_NIVEL } from '../../lib/camino';
import {
  FILTROS,
  MIN_PARES_RONDA,
  TAMANO_RONDA,
  TODOS_LOS_NIVELES,
  anuncio,
  elegirRonda,
  estaEmparejado,
  filtrarPorNivel,
  filtroInicial,
  iniciarRonda,
  plural,
  puntuar,
  recuentoPorNivel,
  rondaTerminada,
  seleccionar,
  siguienteConceptoLibre,
  type EstadoRonda,
  type FiltroNivel,
  type Lado,
  type ParJuego,
} from './logic/juego';

export interface ModuloDeJuego {
  id: string;
  titulo: string;
  pares: ParJuego[];
}

interface Props {
  /** Modules with enough published pairs, in path order. Never empty: the page checks it. */
  modulos: ModuloDeJuego[];
}

const nombreFiltro = (filtro: FiltroNivel) =>
  filtro === TODOS_LOS_NIVELES ? 'Todos los niveles' : NOMBRE_NIVEL[filtro];

export default function Juego({ modulos }: Props) {
  const [moduloId, setModuloId] = useState(modulos[0]?.id ?? '');
  const modulo = modulos.find((m) => m.id === moduloId) ?? modulos[0];
  const pares = modulo?.pares ?? [];
  const recuento = useMemo(() => recuentoPorNivel(pares), [pares]);
  const [preferido, setPreferido] = useState<string | undefined>(TODOS_LOS_NIVELES);
  const filtro = filtroInicial(preferido, recuento);

  const [ronda, setRonda] = useState<EstadoRonda | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const moverFoco = useRef<'inicio' | 'eleccion' | null>(null);
  const empezarBtn = useRef<HTMLButtonElement>(null);
  const primerAccion = useRef<HTMLButtonElement>(null);
  const botones = useRef(new Map<string, HTMLButtonElement>());

  // The learner's level, set on <html> before the first paint. Read after hydration so the
  // server markup and the first client render agree.
  useEffect(() => {
    const nivel = document.documentElement.dataset['nivel'];
    if (nivel) setPreferido(nivel);
  }, []);

  const terminada = ronda !== null && rondaTerminada(ronda);

  // Focus follows the game: first concept on start, next free concept after a hit, the first
  // action at the end, the start button when going back to the selector.
  useEffect(() => {
    if (moverFoco.current === 'eleccion') {
      moverFoco.current = null;
      empezarBtn.current?.focus();
      return;
    }
    if (!ronda) return;
    if (terminada) {
      primerAccion.current?.focus();
      return;
    }
    if (moverFoco.current === 'inicio' || ronda.ultimo?.acierto) {
      moverFoco.current = null;
      const siguiente = siguienteConceptoLibre(ronda);
      if (siguiente) botones.current.get(`concepto:${siguiente}`)?.focus();
    }
  }, [ronda, terminada]);

  const empezar = () => {
    if (!filtro) return;
    moverFoco.current = 'inicio';
    setRonda(iniciarRonda(elegirRonda(filtrarPorNivel(pares, filtro))));
    setVuelta((v) => v + 1);
  };
  const volver = () => {
    moverFoco.current = 'eleccion';
    setRonda(null);
  };
  const elegir = (lado: Lado, id: string) => setRonda((r) => (r ? seleccionar(r, lado, id) : r));

  const contexto = filtro && modulo ? `${modulo.titulo} · ${nombreFiltro(filtro)}` : '';

  return (
    <div class="juego">
      {ronda === null ? (
        <form
          class="juego-card juego-eleccion"
          onSubmit={(e) => {
            e.preventDefault();
            empezar();
          }}
        >
          {modulos.length > 1 && (
            <fieldset class="juego-grupo">
              <legend>Módulo</legend>
              <div class="juego-radios">
                {modulos.map((m) => (
                  <label key={m.id}>
                    <input
                      type="radio"
                      name="modulo"
                      value={m.id}
                      checked={m.id === modulo?.id}
                      onChange={() => setModuloId(m.id)}
                    />
                    <span>{m.titulo}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {modulos.length === 1 && modulo && (
            <p class="juego-modulo">
              Módulo: <strong>{modulo.titulo}</strong>
            </p>
          )}
          <fieldset class="juego-grupo">
            <legend>Nivel</legend>
            <div class="juego-radios">
              {FILTROS.map((opcion) => {
                const cuantos = recuento[opcion];
                const corto = cuantos < MIN_PARES_RONDA;
                return (
                  <label key={opcion} class={corto ? 'off' : ''}>
                    <input
                      type="radio"
                      name="nivel"
                      value={opcion}
                      checked={opcion === filtro}
                      disabled={corto}
                      onChange={() => setPreferido(opcion)}
                    />
                    <span>
                      {nombreFiltro(opcion)}
                      <small>
                        {corto
                          ? cuantos === 0
                            ? 'Aún sin pares'
                            : `Solo ${plural(cuantos, 'par', 'pares')}`
                          : plural(cuantos, 'par', 'pares')}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p class="hint">
            Cada ronda tiene hasta {TAMANO_RONDA} pares. Los fallos se cuentan, pero no restan, y no
            hay reloj.
          </p>
          <button class="btn btn-primary" type="submit" ref={empezarBtn} disabled={!filtro}>
            Empezar ronda
            <span class="icon" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        </form>
      ) : terminada ? (
        <Resumen
          ronda={ronda}
          contexto={contexto}
          vuelta={vuelta}
          primerAccion={primerAccion}
          onOtra={empezar}
          onVolver={volver}
        />
      ) : (
        <Tablero
          ronda={ronda}
          contexto={contexto}
          vuelta={vuelta}
          botones={botones.current}
          onElegir={elegir}
          onVolver={volver}
        />
      )}
      <p class="sr" aria-live="polite">
        {anuncio(ronda)}
      </p>
    </div>
  );
}

interface TableroProps {
  ronda: EstadoRonda;
  contexto: string;
  vuelta: number;
  botones: Map<string, HTMLButtonElement>;
  onElegir: (lado: Lado, id: string) => void;
  onVolver: () => void;
}

function Tablero({ ronda, contexto, vuelta, botones, onElegir, onVolver }: TableroProps) {
  const { aciertos, fallos, total } = puntuar(ronda);
  const porId = new Map(ronda.pares.map((p) => [p.id, p]));
  const numeroDe = (id: string) => ronda.emparejados.indexOf(id) + 1;

  const tarjeta = (lado: Lado, id: string) => {
    const par = porId.get(id);
    if (!par) return null;
    const emparejado = estaEmparejado(ronda, id);
    const elegido = ronda.seleccion[lado] === id;
    const fallado = ronda.ultimo !== null && !ronda.ultimo.acierto && ronda.ultimo[lado] === id;
    const texto = lado === 'concepto' ? par.concepto : par.definicion;
    const clases = [
      'juego-carta',
      `juego-${lado}`,
      emparejado && 'is-ok',
      elegido && 'is-sel',
      fallado && 'is-bad',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <li key={id}>
        <button
          class={clases}
          type="button"
          aria-pressed={emparejado ? undefined : elegido}
          aria-disabled={emparejado ? 'true' : undefined}
          onClick={() => onElegir(lado, id)}
          ref={(el) => {
            if (el) botones.set(`${lado}:${id}`, el);
            else botones.delete(`${lado}:${id}`);
          }}
        >
          <span class="juego-texto">{texto}</span>
          {emparejado && (
            <span class="juego-marca ok">
              <span class="icon fill" aria-hidden="true">
                check
              </span>
              <span class="sr">Emparejado, </span>
              Pareja {numeroDe(id)}
            </span>
          )}
          {elegido && (
            <span class="juego-marca sel" aria-hidden="true">
              Elegido
            </span>
          )}
          {fallado && (
            <span class="juego-marca bad">
              <span class="icon" aria-hidden="true">
                close
              </span>
              No es esa
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div class="juego-card juego-tablero juego-entra" key={vuelta}>
      <div class="juego-cabeza">
        <p class="juego-contexto">{contexto}</p>
        <p class="juego-cuenta">
          {aciertos} de {total} · {plural(fallos, 'fallo', 'fallos')}
        </p>
      </div>
      <Pasos marcas={ronda.pares.map((_, i) => (i < aciertos ? true : null))} />
      <p class="juego-ayuda">Elige un concepto y después su definición. También vale al revés.</p>
      <div class="juego-columnas">
        <section aria-labelledby="h-conceptos">
          <h2 id="h-conceptos">Conceptos</h2>
          <ul class="juego-lista juego-lista-conceptos">
            {ronda.conceptos.map((id) => tarjeta('concepto', id))}
          </ul>
        </section>
        <section aria-labelledby="h-definiciones">
          <h2 id="h-definiciones">Definiciones</h2>
          <ul class="juego-lista">{ronda.definiciones.map((id) => tarjeta('definicion', id))}</ul>
        </section>
      </div>
      <div class="juego-pie">
        <button class="linkbtn" type="button" onClick={onVolver}>
          <span class="icon" aria-hidden="true">
            arrow_back
          </span>
          Cambiar módulo o nivel
        </button>
      </div>
    </div>
  );
}

interface ResumenProps {
  ronda: EstadoRonda;
  contexto: string;
  vuelta: number;
  primerAccion: Ref<HTMLButtonElement>;
  onOtra: () => void;
  onVolver: () => void;
}

function Resumen({ ronda, contexto, vuelta, primerAccion, onOtra, onVolver }: ResumenProps) {
  const { aciertos, fallos } = puntuar(ronda);
  const porId = new Map(ronda.pares.map((p) => [p.id, p]));
  return (
    <div class="juego-card juego-resumen juego-entra" key={`fin-${vuelta}`}>
      <p class="juego-contexto">{contexto}</p>
      <h2>
        {fallos === 0
          ? `${plural(aciertos, 'par', 'pares')}, sin un fallo`
          : `${plural(aciertos, 'par', 'pares')} y ${plural(fallos, 'fallo', 'fallos')}`}
      </h2>
      <p>Así quedan emparejados:</p>
      <ol class="juego-repaso">
        {ronda.emparejados.map((id) => {
          const par = porId.get(id);
          return (
            par && (
              <li key={id}>
                <strong>{par.concepto}</strong>
                <span>{par.definicion}</span>
              </li>
            )
          );
        })}
      </ol>
      <div class="juego-acciones">
        <button class="btn btn-primary" type="button" ref={primerAccion} onClick={onOtra}>
          <span class="icon" aria-hidden="true">
            restart_alt
          </span>
          Otra ronda
        </button>
        <button class="btn btn-ghost" type="button" onClick={onVolver}>
          Cambiar módulo o nivel
        </button>
      </div>
    </div>
  );
}
