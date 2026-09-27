/**
 * Interview simulator rules, independent of the UI: which cases a session draws, how it walks
 * through question, follow-ups and rubric, and how the self-assessment is scored and summarised.
 * There is no automatic correction: the learner marks the rubric points they covered.
 */
import type { Nivel } from '../../../lib/niveles';

/** Cases drawn per session. */
export const CASOS_POR_SESION = 3;

export interface PuntoDeRubrica {
  id: string;
  punto: string;
  /** Lessons worth revisiting when the point is missed. */
  lecciones: string[];
}

export interface CasoDeSesion {
  id: string;
  modulo: string;
  nivel: Nivel;
  titulo: string;
  escenario: string;
  pregunta: string;
  repreguntas: string[];
  rubrica: PuntoDeRubrica[];
}

/**
 * What the session practises: one module at one level, or every available case ("mixta").
 */
export type Filtro = { tipo: 'nivel'; modulo: string; nivel: Nivel } | { tipo: 'mixta' };

export interface OpcionDeSesion {
  /** Stable value for a form control, e.g. `bases-de-datos/fundamentos` or `mixta`. */
  clave: string;
  filtro: Filtro;
  /** Cases available with this filter. */
  casos: number;
}

export function claveDeFiltro(filtro: Filtro): string {
  return filtro.tipo === 'mixta' ? 'mixta' : `${filtro.modulo}/${filtro.nivel}`;
}

/**
 * Sessions the learner can start: every module and level with cases, modules in the given order
 * and levels from basic to advanced, plus a mixed one when there is more than one to mix.
 */
export function opcionesDeSesion(
  casos: readonly CasoDeSesion[],
  ordenModulos: readonly string[],
  niveles: readonly Nivel[],
): OpcionDeSesion[] {
  const posicion = (modulo: string) => {
    const i = ordenModulos.indexOf(modulo);
    return i === -1 ? ordenModulos.length : i;
  };
  const cuentas = new Map<string, OpcionDeSesion>();
  for (const caso of casos) {
    const filtro: Filtro = { tipo: 'nivel', modulo: caso.modulo, nivel: caso.nivel };
    const clave = claveDeFiltro(filtro);
    const previa = cuentas.get(clave);
    cuentas.set(clave, { clave, filtro, casos: (previa?.casos ?? 0) + 1 });
  }
  const opciones = [...cuentas.values()].sort((a, b) => {
    if (a.filtro.tipo !== 'nivel' || b.filtro.tipo !== 'nivel') return 0;
    return (
      posicion(a.filtro.modulo) - posicion(b.filtro.modulo) ||
      a.filtro.modulo.localeCompare(b.filtro.modulo) ||
      niveles.indexOf(a.filtro.nivel) - niveles.indexOf(b.filtro.nivel)
    );
  });
  if (opciones.length > 1) {
    opciones.push({ clave: 'mixta', filtro: { tipo: 'mixta' }, casos: casos.length });
  }
  return opciones;
}

/** Random number in [0, 1), injectable so tests can fix the draw. */
export type Azar = () => number;

export function casosDelFiltro<T extends CasoDeSesion>(casos: readonly T[], filtro: Filtro): T[] {
  if (filtro.tipo === 'mixta') return [...casos];
  return casos.filter((caso) => caso.modulo === filtro.modulo && caso.nivel === filtro.nivel);
}

/** Fisher–Yates shuffle. A random source that returns 1 or more is clamped to the last index. */
export function barajar<T>(elementos: readonly T[], azar: Azar): T[] {
  const copia = [...elementos];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.max(0, Math.floor(azar() * (i + 1))));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}

/** Cases of a new session: the filter's cases in random order, at most `maximo`. */
export function elegirCasos<T extends CasoDeSesion>(
  casos: readonly T[],
  filtro: Filtro,
  azar: Azar = Math.random,
  maximo: number = CASOS_POR_SESION,
): T[] {
  return barajar(casosDelFiltro(casos, filtro), azar).slice(0, Math.max(0, maximo));
}

// --- Pasos ---------------------------------------------------------------------------------------

/** Where the learner is inside the current case. */
export type Paso =
  { tipo: 'pregunta' } | { tipo: 'repregunta'; indice: number } | { tipo: 'rubrica' };

export interface EstadoSesion {
  /** Index of the case on screen. */
  actual: number;
  paso: Paso;
  /** IDs of the rubric points marked in each case. */
  marcados: string[][];
  terminada: boolean;
}

export function iniciarSesion(total: number): EstadoSesion {
  return {
    actual: 0,
    paso: { tipo: 'pregunta' },
    marcados: Array.from({ length: total }, () => []),
    terminada: total === 0,
  };
}

/**
 * Next step: question, each follow-up one by one, the rubric, then the next case. After the last
 * case's rubric the session ends.
 */
export function avanzar(estado: EstadoSesion, casos: readonly CasoDeSesion[]): EstadoSesion {
  const caso = casos[estado.actual];
  if (estado.terminada || !caso) return estado;
  const { paso } = estado;
  if (paso.tipo !== 'rubrica') {
    const siguiente = paso.tipo === 'pregunta' ? 0 : paso.indice + 1;
    const nuevo: Paso =
      siguiente < caso.repreguntas.length
        ? { tipo: 'repregunta', indice: siguiente }
        : { tipo: 'rubrica' };
    return { ...estado, paso: nuevo };
  }
  if (estado.actual + 1 >= casos.length) return { ...estado, terminada: true };
  return { ...estado, actual: estado.actual + 1, paso: { tipo: 'pregunta' } };
}

/** Marks or unmarks a point of the current case. Only while its rubric is on screen. */
export function alternarPunto(
  estado: EstadoSesion,
  casos: readonly CasoDeSesion[],
  puntoId: string,
): EstadoSesion {
  const caso = casos[estado.actual];
  if (estado.terminada || !caso || estado.paso.tipo !== 'rubrica') return estado;
  if (!caso.rubrica.some((punto) => punto.id === puntoId)) return estado;
  const actuales = estado.marcados[estado.actual] ?? [];
  const nuevos = actuales.includes(puntoId)
    ? actuales.filter((id) => id !== puntoId)
    : [...actuales, puntoId];
  const marcados = [...estado.marcados];
  marcados[estado.actual] = nuevos;
  return { ...estado, marcados };
}

/** Step label for the counter and screen reader announcements. */
export function rotuloDePaso(estado: EstadoSesion, casos: readonly CasoDeSesion[]): string {
  if (estado.terminada) return 'Resumen';
  const caso = casos[estado.actual];
  const base = `Caso ${estado.actual + 1} de ${casos.length}`;
  if (!caso) return base;
  const { paso } = estado;
  if (paso.tipo === 'pregunta') return `${base}, pregunta`;
  if (paso.tipo === 'repregunta') {
    return `${base}, repregunta ${paso.indice + 1} de ${caso.repreguntas.length}`;
  }
  return `${base}, rúbrica`;
}

/** Label of the button that moves on from the given step. */
export function textoParaAvanzar(caso: CasoDeSesion, paso: Paso, esUltimo: boolean): string {
  if (paso.tipo === 'rubrica') return esUltimo ? 'Ver el resumen' : 'Siguiente caso';
  if (paso.tipo === 'pregunta') {
    return caso.repreguntas.length > 0 ? 'Pasar a la repregunta' : 'Ver la respuesta modelo';
  }
  return paso.indice + 1 < caso.repreguntas.length
    ? 'Siguiente repregunta'
    : 'Ver la respuesta modelo';
}

// --- Puntuación y resumen -------------------------------------------------------------------------

/** Every rubric point weighs the same. */
export interface Puntuacion {
  tocados: number;
  total: number;
}

export function puntuacionDeCaso(
  caso: CasoDeSesion,
  marcados: readonly string[] | undefined,
): Puntuacion {
  const marcadosSet = new Set(marcados ?? []);
  const tocados = caso.rubrica.filter((punto) => marcadosSet.has(punto.id)).length;
  return { tocados, total: caso.rubrica.length };
}

export interface ResumenDeCaso {
  id: string;
  titulo: string;
  puntuacion: Puntuacion;
  /** Points not marked, in rubric order. */
  flojos: PuntoDeRubrica[];
}

export interface Resumen {
  casos: ResumenDeCaso[];
  total: Puntuacion;
  /** Lessons of the missed points, without repeats, in the order they first appear. */
  lecciones: string[];
}

export function resumir(
  casos: readonly CasoDeSesion[],
  marcados: readonly (readonly string[])[],
): Resumen {
  const porCaso = casos.map((caso, i): ResumenDeCaso => {
    const marcadosSet = new Set(marcados[i] ?? []);
    return {
      id: caso.id,
      titulo: caso.titulo,
      puntuacion: puntuacionDeCaso(caso, marcados[i]),
      flojos: caso.rubrica.filter((punto) => !marcadosSet.has(punto.id)),
    };
  });
  const total = porCaso.reduce<Puntuacion>(
    (suma, caso) => ({
      tocados: suma.tocados + caso.puntuacion.tocados,
      total: suma.total + caso.puntuacion.total,
    }),
    { tocados: 0, total: 0 },
  );
  const lecciones = porCaso.flatMap((caso) => caso.flojos.flatMap((punto) => punto.lecciones));
  return { casos: porCaso, total, lecciones: [...new Set(lecciones)] };
}
