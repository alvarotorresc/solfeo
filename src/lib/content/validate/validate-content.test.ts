import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { Informe } from './report';
import { validateContent } from './validate-content';

const FIXTURES = new URL('../../../test/fixtures/', import.meta.url);
const BASE = fileURLToPath(new URL('content/', FIXTURES));
const SEMILLA = readFileSync(new URL('semilla.sql', FIXTURES), 'utf8');

const LECCION = 'demo/fundamentos/01-primera/leccion.md';
const SQL = 'demo/fundamentos/01-primera/sql.yaml';
const QUIZ = 'demo/fundamentos/01-primera/quiz.yaml';
const TEST = 'demo/fundamentos/test.yaml';
const CASO = 'demo/fundamentos/casos/dm-f-caso-01.yaml';
const PARES = 'demo/pares.yaml';
const TEMARIO = 'demo/temario.yaml';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Copies the good fixture to a temporary folder and applies `romper` to it. */
async function validarVariante(romper: (dir: string) => void): Promise<Informe> {
  const dir = mkdtempSync(join(tmpdir(), 'solfeo-contenido-'));
  temporales.push(dir);
  cpSync(BASE, dir, { recursive: true });
  romper(dir);
  return validateContent({ raiz: dir, semilla: SEMILLA });
}

/** Replaces `buscar` in a file of the variant; fails loudly if the fixture changed. */
const reemplazar =
  (archivo: string, buscar: string | RegExp, poner: string) =>
  (dir: string): void => {
    const ruta = join(dir, archivo);
    const texto = readFileSync(ruta, 'utf8');
    const cambiado = texto.replace(buscar, poner);
    if (cambiado === texto) throw new Error(`«${String(buscar)}» no está en ${archivo}`);
    writeFileSync(ruta, cambiado);
  };

const escribir =
  (archivo: string, contenido: string) =>
  (dir: string): void => {
    writeFileSync(join(dir, archivo), contenido);
  };

const codigos = (hallazgos: { codigo: string }[]): string[] =>
  [...new Set(hallazgos.map((hallazgo) => hallazgo.codigo))].sort();

describe('validateContent on the good fixture', () => {
  it('reports no errors and no warnings', async () => {
    const informe = await validateContent({ raiz: BASE, semilla: SEMILLA });
    expect(informe.errores).toEqual([]);
    expect(informe.avisos).toEqual([]);
  });

  it('lists every non-executable block with its real line and reason', async () => {
    const informe = await validateContent({ raiz: BASE, semilla: SEMILLA });
    expect(informe.noEjecutables).toEqual([
      { archivo: LECCION, lugar: 'línea 20', motivo: 'Sintaxis de otro gestor' },
      { archivo: CASO, lugar: 'respuesta_modelo, línea 9', motivo: 'Sintaxis de otro gestor' },
    ]);
  });
});

describe('validateContent errors', () => {
  const casos: [string, string, (dir: string) => void][] = [
    [
      'esquema',
      'a question with two correct options',
      reemplazar(QUIZ, 'Uno.', 'Uno.\n        correcta: true'),
    ],
    ['esquema', 'YAML that does not parse', escribir(QUIZ, 'preguntas: [\n')],
    [
      'esquema',
      'a lesson frontmatter that does not parse',
      reemplazar(LECCION, 'orden: 1', 'orden: ['),
    ],
    ['esquema', 'a missing modulos.yaml', (dir) => unlinkSync(join(dir, 'modulos.yaml'))],
    [
      'id-duplicado',
      'two pairs with the same ID',
      reemplazar(
        PARES,
        '- id: dm-i-par-01',
        '- id: dm-f-par-01\n  concepto: FROM\n  definicion: Elige la tabla.\n  leccion: dm-f-01\n  nivel: fundamentos\n- id: dm-i-par-01',
      ),
    ],
    [
      'id-duplicado',
      'two modules with the same prefix',
      reemplazar(
        'modulos.yaml',
        '',
        '- id: otro\n  prefijo: dm\n  orden: 2\n  titulo: Otro\n  disponible: false\n',
      ),
    ],
    [
      'id-duplicado',
      'two modules with the same order',
      reemplazar(
        'modulos.yaml',
        '',
        '- id: otro\n  prefijo: ot\n  orden: 1\n  titulo: Otro\n  disponible: false\n',
      ),
    ],
    [
      'id-duplicado',
      'two modules with the same id',
      reemplazar(
        'modulos.yaml',
        '',
        '- id: demo\n  prefijo: ot\n  orden: 2\n  titulo: Otro\n  disponible: false\n',
      ),
    ],
    [
      'id-duplicado',
      'two lesson blocks with the same id',
      reemplazar(LECCION, '```text', '```sql id=q1\nSELECT 1;\n```\n\n```text'),
    ],
    [
      'ruta-incoherente',
      'a lesson that declares another module',
      reemplazar(LECCION, 'modulo: demo', 'modulo: otro'),
    ],
    [
      'ruta-incoherente',
      'a case that declares another module',
      reemplazar(CASO, 'modulo: demo', 'modulo: otro'),
    ],
    [
      'ruta-incoherente',
      'a case that declares another level',
      (dir) => {
        reemplazar(CASO, 'nivel: fundamentos', 'nivel: intermedio')(dir);
        reemplazar(CASO, 'id: dm-f-caso-01', 'id: dm-i-caso-01')(dir);
        renameSync(join(dir, CASO), join(dir, 'demo/fundamentos/casos/dm-i-caso-01.yaml'));
      },
    ],
    [
      'ruta-incoherente',
      'a case file not named after its ID',
      (dir) => {
        cpSync(join(dir, CASO), join(dir, 'demo/fundamentos/casos/dm-f-caso-02.yaml'));
        unlinkSync(join(dir, CASO));
      },
    ],
    [
      'ruta-incoherente',
      'a test question with another module prefix',
      reemplazar(TEST, 'dm-f-t02', 'xx-f-t02'),
    ],
    [
      'ruta-incoherente',
      'a module folder missing from modulos.yaml',
      reemplazar('modulos.yaml', 'id: demo', 'id: otro'),
    ],
    [
      'ruta-incoherente',
      'a syllabus that declares another module',
      reemplazar(TEMARIO, 'modulo: demo', 'modulo: otro'),
    ],
    [
      'ruta-incoherente',
      'a lesson in a folder the syllabus does not give it',
      reemplazar(TEMARIO, 'carpeta: 01-primera', 'carpeta: 01-movida'),
    ],
    [
      'temario-incoherente',
      'a lesson title that differs from the syllabus',
      reemplazar(LECCION, 'titulo: Primera lección', 'titulo: Otra'),
    ],
    [
      'temario-incoherente',
      'a lesson missing from the syllabus',
      (dir) => {
        mkdirSync(join(dir, 'demo/fundamentos/03-tercera'));
        const leccion = readFileSync(join(dir, LECCION), 'utf8');
        writeFileSync(
          join(dir, 'demo/fundamentos/03-tercera/leccion.md'),
          leccion.replace('id: dm-f-01', 'id: dm-f-03').split('Texto de la lección.')[0] ?? '',
        );
      },
    ],
    [
      'referencia-rota',
      'a test question pointing to a lesson of another level',
      reemplazar(TEST, 'leccion: dm-f-01', 'leccion: dm-i-01'),
    ],
    [
      'referencia-rota',
      'a rubric pointing to a lesson not in the syllabus',
      reemplazar(CASO, 'lecciones: [dm-f-02]', 'lecciones: [dm-f-09]'),
    ],
    [
      'referencia-rota',
      'a pair pointing to a lesson not in the syllabus',
      reemplazar(PARES, 'leccion: dm-i-01', 'leccion: dm-i-09'),
    ],
    ['referencia-rota', 'a quiz from another lesson', reemplazar(QUIZ, /dm-f-01/g, 'dm-f-02')],
    [
      'referencia-rota',
      'a lesson folder without leccion.md',
      (dir) => unlinkSync(join(dir, LECCION)),
    ],
    ['referencia-rota', 'a module without syllabus', (dir) => unlinkSync(join(dir, TEMARIO))],
    [
      'enunciado-duplicado',
      'a test statement that repeats a quiz one',
      reemplazar(TEST, '¿Qué hace un filtro WHERE?', '¿Cuántos   productos tiene la TIENDA'),
    ],
    [
      'par-repetido',
      'two pairs with the same concept',
      reemplazar(PARES, 'concepto: Otra', 'concepto: where.'),
    ],
    [
      'par-repetido',
      'two pairs with the same definition',
      reemplazar(
        PARES,
        'definicion: Un par del nivel intermedio.',
        'definicion: filtra las filas   que cumplen una condición',
      ),
    ],
    [
      'bloque-sin-marca',
      'a sql block without id',
      reemplazar(LECCION, 'Texto de la lección.', '```sql\nSELECT 1;\n```'),
    ],
    [
      'bloque-sin-marca',
      'a no-ejecutar block without reason',
      reemplazar(LECCION, ' motivo="Sintaxis de otro gestor"', ''),
    ],
    ['esperado-ausente', 'an executable block without expected result', escribir(SQL, '{}\n')],
    ['esperado-ausente', 'a lesson with SQL and no sql.yaml', (dir) => unlinkSync(join(dir, SQL))],
    [
      'esperado-sobrante',
      'an expected result without block',
      reemplazar(SQL, 'q1:', 'q9:\n  columnas: [n]\n  num_filas: 1\n  orden_importa: false\nq1:'),
    ],
    [
      'sql-fallido',
      'a lesson block on a missing table',
      reemplazar(LECCION, 'FROM productos WHERE', 'FROM nada WHERE'),
    ],
    [
      'sql-fallido',
      'a model answer with broken SQL',
      reemplazar(CASO, 'SELECT count(*) FROM productos;', 'SELEC 1;'),
    ],
    [
      'sql-fallido',
      'a recursive CTE without a stop',
      reemplazar(
        TEST,
        'SELECT nombre FROM productos ORDER BY precio DESC LIMIT 1;',
        'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT x AS nombre FROM c;',
      ),
    ],
    [
      'sql-resultado',
      'a lesson block with a wrong expected row',
      reemplazar(SQL, "['Mochila']", "['Bolso']"),
    ],
    [
      'sql-resultado',
      'a mutating case with a wrong row count',
      reemplazar(CASO, 'filas: [[2]]', 'filas: [[3]]'),
    ],
    [
      'muta-no-declarada',
      'a quiz query that deletes rows without declaring muta',
      reemplazar(QUIZ, '      muta: true\n', ''),
    ],
    [
      'muta-no-declarada',
      'a test query that creates a table without declaring muta',
      reemplazar(TEST, 'SELECT nombre FROM', 'CREATE TABLE x (a); SELECT nombre FROM'),
    ],
    [
      'markdown-inseguro',
      'a lesson link with a javascript: URL',
      reemplazar(LECCION, 'Texto de la lección.', '[x](javascript:alert(1))'),
    ],
    [
      'markdown-inseguro',
      'raw HTML in a lesson',
      reemplazar(LECCION, 'Texto de la lección.', '<script>alert(1)</script>'),
    ],
    [
      'markdown-inseguro',
      'a lesson code block with a malicious language',
      reemplazar(LECCION, '```text', '```text"onmouseover=alert(1)'),
    ],
    [
      'markdown-inseguro',
      'a model answer with a javascript: URL',
      reemplazar(CASO, 'Primero contaría las filas:', 'Primero [contaría](javascript:alert(1)):'),
    ],
    [
      'archivo-desconocido',
      'a stray file in a lesson folder',
      escribir('demo/fundamentos/01-primera/notas.txt', 'x'),
    ],
    ['archivo-desconocido', 'a hidden file', escribir('demo/.DS_Store', 'x')],
    [
      'archivo-desconocido',
      'a file in an unknown level',
      (dir) => {
        mkdirSync(join(dir, 'demo/basico'));
        writeFileSync(join(dir, 'demo/basico/test.yaml'), 'x');
      },
    ],
    [
      'symlink',
      'a symlink to a file',
      (dir) => symlinkSync(join(dir, TEST), join(dir, 'demo/intermedio-test.yaml')),
    ],
    [
      'symlink',
      'a symlink to a directory outside the root',
      (dir) => symlinkSync(tmpdir(), join(dir, 'demo/fuera')),
    ],
  ];

  it.each(casos)('reports only «%s» for %s', async (codigo, _descripcion, romper) => {
    const informe = await validarVariante(romper);
    expect(codigos(informe.errores), JSON.stringify(informe.errores, null, 2)).toEqual([codigo]);
  });
});

describe('validateContent on unsafe Markdown', () => {
  it('names the file and the reason of the rejection', async () => {
    const informe = await validarVariante(
      reemplazar(LECCION, 'Texto de la lección.', '[x](javascript:alert(1))'),
    );
    expect(informe.errores).toEqual([
      {
        codigo: 'markdown-inseguro',
        archivo: LECCION,
        mensaje: 'Cuerpo de la lección: El Markdown no admite la URL «javascript:alert(1)»',
      },
    ]);
  });
});

describe('validateContent on repeated values', () => {
  it('reports a value repeated three times once', async () => {
    const informe = await validarVariante(
      reemplazar(
        'modulos.yaml',
        '',
        '- id: otro\n  prefijo: ot\n  orden: 1\n  titulo: Otro\n  disponible: false\n' +
          '- id: tercero\n  prefijo: te\n  orden: 1\n  titulo: Tercero\n  disponible: false\n',
      ),
    );
    expect(informe.errores.map(({ codigo, mensaje }) => [codigo, mensaje])).toEqual([
      ['id-duplicado', 'Orden repetido: 1'],
    ]);
  });
});

describe('validateContent across modules', () => {
  it('allows the same statement in two modules', async () => {
    const informe = await validarVariante((dir) => {
      const otro = join(dir, 'otro');
      cpSync(join(dir, 'demo'), otro, { recursive: true });
      for (const archivo of readdirSync(otro, { recursive: true, encoding: 'utf8' })) {
        if (!/\.(md|yaml)$/.test(archivo)) continue;
        const ruta = join(otro, archivo);
        const texto = readFileSync(ruta, 'utf8');
        writeFileSync(
          ruta,
          texto.replaceAll('dm-', 'ot-').replaceAll('modulo: demo', 'modulo: otro'),
        );
      }
      renameSync(
        join(otro, 'fundamentos/casos/dm-f-caso-01.yaml'),
        join(otro, 'fundamentos/casos/ot-f-caso-01.yaml'),
      );
      reemplazar(
        'modulos.yaml',
        '',
        '- id: otro\n  prefijo: ot\n  orden: 2\n  titulo: Otro\n  disponible: false\n',
      )(dir);
    });
    expect(informe.errores).toEqual([]);
  });
});

describe('validateContent warnings', () => {
  it('warns when a lesson of the level has fewer than two test questions', async () => {
    const informe = await validarVariante(reemplazar(TEST, 'leccion: dm-f-01', 'leccion: dm-f-02'));
    expect(informe.errores).toEqual([]);
    expect(informe.avisos).toEqual([
      {
        codigo: 'cobertura-test',
        archivo: TEST,
        mensaje: 'La lección dm-f-01 tiene 1 preguntas en el test; debería tener al menos 2',
      },
    ]);
  });

  it('warns about yes/no questions in a case and still passes', async () => {
    const informe = await validarVariante(
      reemplazar(CASO, '¿Cómo evitarías que vuelva a pasar?', '¿Es buena idea borrar sin WHERE?'),
    );
    expect(informe.errores).toEqual([]);
    expect(informe.avisos.map(({ codigo, mensaje }) => [codigo, mensaje])).toEqual([
      ['pregunta-si-no', 'La repregunta 1 parece de sí o no; mejor pedir cómo o por qué'],
    ]);
  });
});
