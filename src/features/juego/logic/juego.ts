/**
 * Matching game rules, independent of the UI: which pairs can be played, drawing a round,
 * matching a concept with a definition, scoring and spotting the end of the round.
 * Randomness is injected (`azar`), so every draw can be reproduced in tests.
 */
import type { Par } from '../../../content/schemas';
import { NIVELES, type Nivel } from '../../../lib/niveles';

/**
 * Pairs drawn for a round: five keeps both columns on one screen.
 * With fewer pairs available the round uses all of them.
 */
export const TAMANO_RONDA = 5;

/** Below this many pairs there is no game worth playing: the selector disables the option. */
export const MIN_PARES_RONDA = 3;

/** «All levels» option of the selector. */
export const TODOS_LOS_NIVELES = 'todos';
export type FiltroNivel = Nivel | typeof TODOS_LOS_NIVELES;

/** Content pair as the schema defines it, reduced to what the page reads. */
export type ParDeContenido = Pick<Par, 'id' | 'concepto' | 'definicion' | 'leccion' | 'nivel'>;

/** What the island receives: a content pair without its lesson. */
export type ParJuego = Omit<ParDeContenido, 'leccion'>;

/** Only pairs whose lesson is published: drafts, or lessons that do not exist yet, stay out. */
export function paresPublicables(
  pares: readonly ParDeContenido[],
  leccionesPublicadas: ReadonlySet<string>,
): ParJuego[] {
  return pares
    .filter((par) => leccionesPublicadas.has(par.leccion))
    .map(({ id, concepto, definicion, nivel }) => ({ id, concepto, definicion, nivel }));
}

export function filtrarPorNivel(pares: readonly ParJuego[], filtro: FiltroNivel): ParJuego[] {
  return filtro === TODOS_LOS_NIVELES ? [...pares] : pares.filter((par) => par.nivel === filtro);
}

/** How many pairs each selector option offers, «all levels» included. */
export function recuentoPorNivel(pares: readonly ParJuego[]): Record<FiltroNivel, number> {
  const recuento = Object.fromEntries(
    NIVELES.map((nivel) => [nivel, pares.filter((par) => par.nivel === nivel).length]),
  ) as Record<Nivel, number>;
  return { ...recuento, [TODOS_LOS_NIVELES]: pares.length };
}

export function sePuedeJugar(pares: readonly unknown[]): boolean {
  return pares.length >= MIN_PARES_RONDA;
}

/** Selector options in the order they are shown. */
export const FILTROS: readonly FiltroNivel[] = [...NIVELES, TODOS_LOS_NIVELES];

/**
 * Option to preselect: the preferred one (the learner's level, or the previous choice) when it
 * has enough pairs; otherwise «all levels»; otherwise the first playable level. Undefined when
 * nothing can be played.
 */
export function filtroInicial(
  preferido: string | undefined,
  recuento: Record<FiltroNivel, number>,
): FiltroNivel | undefined {
  const jugable = (filtro: FiltroNivel) => recuento[filtro] >= MIN_PARES_RONDA;
  const elegido = FILTROS.find((filtro) => filtro === preferido);
  if (elegido && jugable(elegido)) return elegido;
  if (jugable(TODOS_LOS_NIVELES)) return TODOS_LOS_NIVELES;
  return FILTROS.find(jugable);
}

/** Returns a value in [0, 1), like `Math.random`. */
export type Azar = () => number;

/** Fisher–Yates shuffle into a new array; the input is left untouched. */
export function barajar<T>(elementos: readonly T[], azar: Azar = Math.random): T[] {
  const copia = [...elementos];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(azar() * (i + 1)));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}

/** Random pairs for a round: up to `tamano`, all of them when there are fewer. */
export function elegirRonda(
  pares: readonly ParJuego[],
  azar: Azar = Math.random,
  tamano: number = TAMANO_RONDA,
): ParJuego[] {
  return barajar(pares, azar).slice(0, Math.max(0, tamano));
}

export type Lado = 'concepto' | 'definicion';

export interface Intento {
  concepto: string;
  definicion: string;
  acierto: boolean;
}

export interface EstadoRonda {
  pares: ParJuego[];
  /** Pair IDs in the order the concepts are shown. */
  conceptos: string[];
  /** Pair IDs in the order the definitions are shown, shuffled apart from the concepts. */
  definiciones: string[];
  /** Matched pair IDs, in the order they were matched. */
  emparejados: string[];
  fallos: number;
  seleccion: { concepto: string | null; definicion: string | null };
  /** Last resolved attempt, so the UI can show and announce it. */
  ultimo: Intento | null;
}

/**
 * Definitions order for a round. If the shuffle lines every definition up with its concept, the
 * round would solve itself, so the list is rotated one place.
 */
function ordenDeDefiniciones(conceptos: readonly string[], azar: Azar): string[] {
  const definiciones = barajar(conceptos, azar);
  const mismoOrden = definiciones.every((id, i) => id === conceptos[i]);
  if (conceptos.length < 2 || !mismoOrden) return definiciones;
  return [...definiciones.slice(1), ...definiciones.slice(0, 1)];
}

export function iniciarRonda(pares: readonly ParJuego[], azar: Azar = Math.random): EstadoRonda {
  const conceptos = barajar(
    pares.map((par) => par.id),
    azar,
  );
  return {
    pares: [...pares],
    conceptos,
    definiciones: ordenDeDefiniciones(conceptos, azar),
    emparejados: [],
    fallos: 0,
    seleccion: { concepto: null, definicion: null },
    ultimo: null,
  };
}

export function estaEmparejado(estado: EstadoRonda, id: string): boolean {
  return estado.emparejados.includes(id);
}

export function rondaTerminada(estado: EstadoRonda): boolean {
  return estado.pares.length > 0 && estado.emparejados.length === estado.pares.length;
}

/**
 * Selects a concept or a definition, in any order. Selecting the same one again deselects it.
 * When both sides are selected the attempt is checked by pair ID: a hit locks the pair, a miss
 * adds a failure. Either way the selection is cleared.
 */
export function seleccionar(estado: EstadoRonda, lado: Lado, id: string): EstadoRonda {
  if (
    rondaTerminada(estado) ||
    !estado.pares.some((par) => par.id === id) ||
    estaEmparejado(estado, id)
  ) {
    return estado;
  }
  const actual = estado.seleccion[lado];
  const seleccion = { ...estado.seleccion, [lado]: actual === id ? null : id };
  const { concepto, definicion } = seleccion;
  if (concepto === null || definicion === null) return { ...estado, seleccion, ultimo: null };

  const acierto = concepto === definicion;
  return {
    ...estado,
    emparejados: acierto ? [...estado.emparejados, concepto] : estado.emparejados,
    fallos: acierto ? estado.fallos : estado.fallos + 1,
    seleccion: { concepto: null, definicion: null },
    ultimo: { concepto, definicion, acierto },
  };
}

export interface Puntuacion {
  aciertos: number;
  fallos: number;
  total: number;
}

/** Failures do not subtract: the score reports matches and misses side by side. */
export function puntuar(estado: EstadoRonda): Puntuacion {
  return { aciertos: estado.emparejados.length, fallos: estado.fallos, total: estado.pares.length };
}

/** First concept, in display order, still without its definition. */
export function siguienteConceptoLibre(estado: EstadoRonda): string | undefined {
  return estado.conceptos.find((id) => !estaEmparejado(estado, id));
}

/** «1 par», «2 pares». */
export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * What the live region says after each attempt. The text always changes between attempts (the
 * hit count or the miss number goes up), so a screen reader reads repeats too.
 */
export function anuncio(ronda: EstadoRonda | null): string {
  if (!ronda) return '';
  const { aciertos, fallos, total } = puntuar(ronda);
  if (rondaTerminada(ronda)) {
    return `Ronda terminada: ${plural(aciertos, 'par', 'pares')} y ${plural(fallos, 'fallo', 'fallos')}.`;
  }
  const ultimo = ronda.ultimo;
  if (!ultimo) return '';
  const concepto = ronda.pares.find((p) => p.id === ultimo.concepto)?.concepto ?? '';
  if (ultimo.acierto) return `Correcto: ${concepto}. Llevas ${aciertos} de ${total}.`;
  return `Fallo ${fallos}: esa definición no es la de ${concepto}. Prueba otra.`;
}
