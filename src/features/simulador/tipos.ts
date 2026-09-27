/** Data the simulator page hands to the island, prepared at build time. */
import type { CasoDeSesion } from './logic/sesion';

export interface CasoDeIsla extends CasoDeSesion {
  /**
   * Model answer as HTML, rendered at build time from our own content by
   * `lib/content/markdown.ts`. Its pipeline rejects raw HTML, unsafe code fence languages and
   * unsafe URLs, and escapes the text; that is what makes injecting it acceptable.
   */
  modeloHtml: string;
}

export interface LeccionDeRepaso {
  titulo: string;
  /** Route of the lesson, or null while it is not published. */
  href: string | null;
}

export interface DatosDelSimulador {
  casos: CasoDeIsla[];
  /** Module IDs in path order, with their titles. */
  modulos: { id: string; titulo: string }[];
  /** Every lesson a rubric point can point at, by ID. */
  lecciones: Record<string, LeccionDeRepaso>;
}
