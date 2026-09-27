/** Normalises a question statement so trivial differences do not hide a duplicate. */
export function normalizeStatement(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.,;:!?¿¡…]+$/u, '');
}

/** Opening verbs that usually lead to a yes or no answer instead of an explanation. */
const VERBOS_SI_NO = [
  'es',
  'son',
  'está',
  'están',
  'hay',
  'puede',
  'puedes',
  'podría',
  'podrías',
  'debe',
  'debería',
  'deberías',
  'existe',
  'existen',
  'tiene',
  'tienes',
  'sería',
  'conviene',
  'basta',
  'crees',
  'harías',
  'usarías',
];

/** First word of each question, skipping a leading «no» (`¿No es…?` asks yes or no too). */
const PREGUNTA = /¿\s*(?:no\s+)?(\p{L}+)/giu;

/**
 * Heuristic: true when any question inside the text opens with a yes/no verb (`¿Es…?`,
 * `¿Hay…?`, `¿No es…?`). Interview questions should ask how or why.
 */
export function isYesNoQuestion(texto: string): boolean {
  return [...texto.matchAll(PREGUNTA)].some(([, verbo = '']) =>
    VERBOS_SI_NO.includes(verbo.toLowerCase()),
  );
}
