/**
 * Which lessons get published. For now drafts are published too, so they can be reviewed on the
 * deployed site; `SOLFEO_SOLO_REVISADO=1` at build time leaves only reviewed content.
 */
export type EstadoContenido = 'borrador' | 'revisado';

export function soloRevisado(entorno: Record<string, string | undefined>): boolean {
  return entorno['SOLFEO_SOLO_REVISADO'] === '1';
}

export function esPublicable(estado: EstadoContenido, soloRevisadoActivo: boolean): boolean {
  return !soloRevisadoActivo || estado === 'revisado';
}
