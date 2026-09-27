/** Text the playground shows: cells, SQLite errors in Spanish and the status line. */
import { baseReiniciada } from './cliente';
import type { CeldaResultado, Resultado } from './protocolo';

export function formatearCelda(celda: CeldaResultado): string {
  if (celda === null) return 'NULL';
  if (typeof celda !== 'object') return String(celda);
  if (celda.tipo === 'blob') return `BLOB (${celda.bytes} bytes)`;
  return `${celda.texto}…`;
}

/**
 * Columns whose values are all numbers (NULLs aside), so the table can align them, header included,
 * to the right. A column with no values at all is not numeric.
 */
export function columnasNumericas(filas: CeldaResultado[][], total: number): boolean[] {
  return Array.from({ length: total }, (_, i) => {
    const valores = filas.map((fila) => fila[i] ?? null).filter((celda) => celda !== null);
    return valores.length > 0 && valores.every((celda) => typeof celda === 'number');
  });
}

/** Text of anything thrown: the message of an Error, or the value itself as a string. */
export function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const TRADUCCIONES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^no such table: (.+)$/, (m) => `No existe la tabla «${m[1]}».`],
  [/^no such column: (.+)$/, (m) => `No existe la columna «${m[1]}».`],
  [/^no such function: (.+)$/, (m) => `No existe la función «${m[1]}».`],
  [/^near "(.+)": syntax error$/, (m) => `Error de sintaxis cerca de «${m[1]}».`],
  [
    /^incomplete input$/,
    () => 'La consulta está incompleta. ¿Falta cerrar un paréntesis o una comilla?',
  ],
  [
    /^ambiguous column name: (.+)$/,
    (m) => `La columna «${m[1]}» está en varias tablas: indica cuál, como tabla.${m[1]}.`,
  ],
  [/^UNIQUE constraint failed: (.+)$/, (m) => `Ya hay una fila con ese valor en «${m[1]}».`],
  [/^NOT NULL constraint failed: (.+)$/, (m) => `«${m[1]}» no puede quedar a NULL.`],
  [/^FOREIGN KEY constraint failed$/, () => 'La operación rompería una clave foránea.'],
  [/^table (.+) already exists$/, (m) => `La tabla «${m[1]}» ya existe.`],
];

/**
 * Turns an error thrown by sql.js into a message in Spanish. Known SQLite messages are translated
 * and keep the original text as `detalle`, so the learner also sees the real SQLite wording.
 */
export function formatearError(error: unknown): { mensaje: string; detalle?: string } {
  const original = mensajeDeError(error).trim();
  for (const [patron, traducir] of TRADUCCIONES) {
    const m = original.match(patron);
    if (m) return { mensaje: traducir(m), detalle: original };
  }
  return { mensaje: original || 'Error desconocido de SQLite.' };
}

function filas(n: number): string {
  return n === 1 ? '1 fila' : `${n} filas`;
}

/** Status line announced through aria-live after each query. */
export function textoEstado(resultado: Resultado): string {
  switch (resultado.tipo) {
    case 'filas':
      return resultado.truncado
        ? `Más de ${filas(resultado.filas.length)}: se muestran las ${resultado.filas.length} primeras.`
        : `${filas(resultado.filas.length)}.`;
    case 'hecho':
      return resultado.cambios === 0
        ? 'Hecho. Ninguna fila modificada.'
        : `Hecho. ${resultado.cambios === 1 ? '1 fila modificada' : `${resultado.cambios} filas modificadas`}.`;
    case 'error':
      return `Error: ${resultado.mensaje}`;
    case 'tiempo':
      return `La consulta tardó más de ${resultado.limiteMs / 1000} s y se ha cortado. La base ha vuelto a su estado inicial.`;
  }
}

/** What the playground is doing; only `listo` accepts a new query. */
export type Fase = 'cargando' | 'listo' | 'ejecutando' | 'fallo';

/** Last thing that happened, shown below the editor until the next action. */
export type Ultimo = Resultado | { tipo: 'reiniciada' } | null;

const CARGANDO = 'Cargando la base de ejemplo…';

/**
 * Whole status line: the phase while busy, otherwise the last result. While the database reloads
 * after a hard stop or a crash, the reason stays in front of the loading notice.
 */
export function lineaEstado(fase: Fase, ultimo: Ultimo, fallo = ''): string {
  if (fase === 'cargando') {
    return ultimo !== null && ultimo.tipo !== 'reiniciada' && baseReiniciada(ultimo)
      ? `${textoEstado(ultimo)} ${CARGANDO}`
      : CARGANDO;
  }
  if (fase === 'ejecutando') return 'Ejecutando…';
  if (fase === 'fallo') return fallo;
  if (ultimo === null) return 'Base lista.';
  if (ultimo.tipo === 'reiniciada') return 'Base reiniciada con los datos de ejemplo.';
  return textoEstado(ultimo);
}
