/** Stable codes of the content validator. Errors fail `content:check`; warnings do not. */
export type CodigoError =
  | 'esquema'
  | 'id-duplicado'
  | 'ruta-incoherente'
  | 'temario-incoherente'
  | 'referencia-rota'
  | 'enunciado-duplicado'
  | 'bloque-sin-marca'
  | 'esperado-ausente'
  | 'esperado-sobrante'
  | 'sql-fallido'
  | 'sql-resultado'
  | 'muta-no-declarada'
  | 'markdown-inseguro'
  | 'par-repetido'
  | 'archivo-desconocido'
  | 'symlink';

export type CodigoAviso = 'cobertura-test' | 'pregunta-si-no';

export interface Hallazgo<C extends string> {
  codigo: C;
  /** Path relative to the content root, with forward slashes. */
  archivo: string;
  mensaje: string;
}

/** A SQL block marked `no-ejecutar`, listed so skipped SQL never goes unnoticed. */
export interface NoEjecutable {
  archivo: string;
  /** Where the block is inside the file, e.g. `línea 12`. */
  lugar: string;
  motivo: string;
}

export interface Informe {
  errores: Hallazgo<CodigoError>[];
  avisos: Hallazgo<CodigoAviso>[];
  noEjecutables: NoEjecutable[];
}

function seccion<T>(titulo: string, items: T[], linea: (item: T) => string): string[] {
  return items.length === 0 ? [] : ['', `${titulo} (${items.length})`, ...items.map(linea)];
}

const hallazgo = ({ codigo, archivo, mensaje }: Hallazgo<string>): string =>
  `  [${codigo}] ${archivo}\n      ${mensaje}`;

/** Human-readable report for the terminal, in Spanish. */
export function formatReport(informe: Informe): string {
  const { errores, avisos, noEjecutables } = informe;
  const resumen =
    errores.length === 0
      ? `Contenido válido: 0 errores, ${avisos.length} avisos.`
      : `Contenido NO válido: ${errores.length} errores, ${avisos.length} avisos.`;
  return [
    resumen,
    ...seccion('Errores', errores, hallazgo),
    ...seccion('Avisos', avisos, hallazgo),
    ...seccion(
      'Bloques SQL no ejecutables',
      noEjecutables,
      ({ archivo, lugar, motivo }) => `  ${archivo} (${lugar}): ${motivo}`,
    ),
  ].join('\n');
}
