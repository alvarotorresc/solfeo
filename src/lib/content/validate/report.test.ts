import { describe, expect, it } from 'vitest';
import { formatReport } from './report';

describe('formatReport', () => {
  it('summarises a valid report and lists the non-executable blocks', () => {
    const texto = formatReport({
      errores: [],
      avisos: [],
      noEjecutables: [
        { archivo: 'a/leccion.md', lugar: 'línea 3', motivo: 'Sintaxis de PostgreSQL' },
      ],
    });
    expect(texto).toBe(
      [
        'Contenido válido: 0 errores, 0 avisos.',
        '',
        'Bloques SQL no ejecutables (1)',
        '  a/leccion.md (línea 3): Sintaxis de PostgreSQL',
      ].join('\n'),
    );
  });

  it('prints errors and warnings with their code, file and message', () => {
    const texto = formatReport({
      errores: [{ codigo: 'sql-fallido', archivo: 'a/quiz.yaml', mensaje: 'no such table: x' }],
      avisos: [{ codigo: 'pregunta-si-no', archivo: 'a/caso.yaml', mensaje: 'La pregunta...' }],
      noEjecutables: [],
    });
    expect(texto).toBe(
      [
        'Contenido NO válido: 1 errores, 1 avisos.',
        '',
        'Errores (1)',
        '  [sql-fallido] a/quiz.yaml',
        '      no such table: x',
        '',
        'Avisos (1)',
        '  [pregunta-si-no] a/caso.yaml',
        '      La pregunta...',
      ].join('\n'),
    );
  });
});
