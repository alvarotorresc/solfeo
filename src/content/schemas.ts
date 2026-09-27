/**
 * Single content contract. Imported by `src/content.config.ts` and by the content validator, so it
 * must only depend on `astro/zod` and plain constants (no `astro:content` virtual modules).
 *
 * Every object is strict: an unknown or misspelled key is an error instead of being dropped.
 */
import { z } from 'astro/zod';
import { LETRA_NIVEL, NIVELES, PATRON_LECCION_ID, type Nivel } from '../lib/niveles';

export { LETRA_NIVEL, NIVELES, type Nivel };

/**
 * Content is open: lessons, questions, cases and pairs are added over time, so the contract sets
 * minimums and no maximums.
 */
export const MIN_PREGUNTAS_POR_QUIZ = 3;

const texto = z.string().trim().min(1);
const nivel = z.enum(NIVELES);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Debe ir en minúsculas y con guiones');

/**
 * Lesson ID: module prefix, level letter and a number of two or more digits, e.g. `bd-f-04`. The
 * number is a stable name, not the position: a lesson inserted later keeps the next free number
 * and takes its place in the path through `orden`.
 */
export const leccionIdSchema = z
  .string()
  .regex(PATRON_LECCION_ID, 'ID de lección con formato «bd-f-04»');

/** Adds an issue for every repeated key, pointing at the item that repeats it. */
function comprobarUnicos(
  ctx: z.RefinementCtx,
  claves: readonly string[],
  mensaje: (clave: string) => string,
  path: (i: number) => PropertyKey[],
): void {
  const vistas = new Set<string>();
  claves.forEach((clave, i) => {
    if (vistas.has(clave)) ctx.addIssue({ code: 'custom', message: mensaje(clave), path: path(i) });
    vistas.add(clave);
  });
}

function comprobarIdConNivel(
  ctx: z.RefinementCtx,
  id: string,
  nivelDeclarado: Nivel,
  path: PropertyKey[] = ['id'],
): void {
  const letra = id.split('-')[1];
  if (letra !== LETRA_NIVEL[nivelDeclarado]) {
    ctx.addIssue({
      code: 'custom',
      message: `El ID «${id}» no corresponde al nivel «${nivelDeclarado}»`,
      path,
    });
  }
}

// --- Módulos y temario -------------------------------------------------------------------------

export const moduloSchema = z.strictObject({
  id: slug,
  prefijo: z.string().regex(/^[a-z]+$/, 'Prefijo en minúsculas, sin guiones'),
  orden: z.number().int().min(1),
  titulo: texto,
  disponible: z.boolean(),
});
export type Modulo = z.infer<typeof moduloSchema>;

export const temaSchema = z
  .strictObject({
    id: leccionIdSchema,
    nivel,
    /** Position in the level's path. Independent of the ID number. */
    orden: z.number().int().min(1),
    carpeta: z
      .string()
      .regex(/^[0-9]{2,}-[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Carpeta con formato «04-nombre»'),
    titulo: texto,
  })
  .superRefine((tema, ctx) => {
    comprobarIdConNivel(ctx, tema.id, tema.nivel);
    // The folder carries the ID number, not the order, so inserting a lesson renames nothing.
    const numeroId = tema.id.split('-')[2];
    if (tema.carpeta.split('-')[0] !== numeroId) {
      ctx.addIssue({
        code: 'custom',
        message: `La carpeta no empieza por el número del ID (${numeroId ?? ''})`,
        path: ['carpeta'],
      });
    }
  });
export type Tema = z.infer<typeof temaSchema>;

export const temarioSchema = z
  .strictObject({
    modulo: slug,
    lecciones: z.array(temaSchema).min(1),
  })
  .superRefine((temario, ctx) => {
    const { lecciones } = temario;
    comprobarUnicos(
      ctx,
      lecciones.map((tema) => tema.id),
      (id) => `ID repetido: ${id}`,
      (i) => ['lecciones', i, 'id'],
    );
    comprobarUnicos(
      ctx,
      lecciones.map((tema) => `${tema.nivel}/${tema.carpeta}`),
      (clave) => `Carpeta repetida: ${clave}`,
      (i) => ['lecciones', i, 'carpeta'],
    );
    comprobarUnicos(
      ctx,
      lecciones.map((tema) => `${tema.nivel}/${tema.orden}`),
      (clave) => `Orden repetido en el nivel: ${clave}`,
      (i) => ['lecciones', i, 'orden'],
    );
  });
export type Temario = z.infer<typeof temarioSchema>;

// --- Lección ------------------------------------------------------------------------------------

export const fuenteSchema = z.strictObject({
  titulo: texto,
  url: z.url({ protocol: /^https$/, hostname: z.regexes.domain }),
});

export const leccionSchema = z
  .strictObject({
    id: leccionIdSchema,
    modulo: slug,
    nivel,
    orden: z.number().int().min(1),
    titulo: texto,
    resumen: texto,
    fuentes: z.array(fuenteSchema).min(1),
    estado: z.enum(['borrador', 'revisado']),
  })
  .superRefine((leccion, ctx) => {
    comprobarIdConNivel(ctx, leccion.id, leccion.nivel);
  });
export type Leccion = z.infer<typeof leccionSchema>;

// --- Resultados esperados de SQL ----------------------------------------------------------------

/**
 * A result cell. Dates must be quoted in YAML: the parser would otherwise turn them into `Date`
 * objects, which are rejected here.
 */
export const celdaSchema = z.union([z.string(), z.number(), z.null()]);
export type Celda = z.infer<typeof celdaSchema>;

export const esperadoSchema = z
  .strictObject({
    columnas: z.array(z.string().min(1)),
    filas: z.array(z.array(celdaSchema)).optional(),
    num_filas: z.number().int().min(0).optional(),
    orden_importa: z.boolean(),
    muta: z.boolean().default(false),
  })
  .superRefine((esperado, ctx) => {
    const tieneFilas = esperado.filas !== undefined;
    const tieneNumero = esperado.num_filas !== undefined;
    if (tieneFilas === tieneNumero) {
      ctx.addIssue({ code: 'custom', message: 'Hace falta «filas» o «num_filas», uno de los dos' });
    }
    esperado.filas?.forEach((fila, i) => {
      if (fila.length !== esperado.columnas.length) {
        ctx.addIssue({
          code: 'custom',
          message: `La fila tiene ${fila.length} celdas y hay ${esperado.columnas.length} columnas`,
          path: ['filas', i],
        });
      }
    });
  });
export type Esperado = z.infer<typeof esperadoSchema>;

/** `sql.yaml`: one expected result per executable SQL block of the lesson (`q1`, `q2`...). */
export const sqlArchivoSchema = z.record(
  z.string().regex(/^q[0-9]+$/, 'Clave «q1», «q2»...'),
  esperadoSchema,
);
export type SqlArchivo = z.infer<typeof sqlArchivoSchema>;

/** Optional SQL attached to a question or case: both keys or neither. */
function comprobarSqlConEsperado(
  valor: { sql?: string | undefined; esperado?: Esperado | undefined },
  ctx: z.RefinementCtx,
): void {
  if ((valor.sql === undefined) !== (valor.esperado === undefined)) {
    ctx.addIssue({ code: 'custom', message: '«sql» y «esperado» van juntos' });
  }
}

// --- Quiz y test --------------------------------------------------------------------------------

export const opcionSchema = z.strictObject({
  texto,
  correcta: z.boolean().default(false),
  explicacion: texto,
});

const preguntaBase = {
  enunciado: texto,
  sql: texto.optional(),
  esperado: esperadoSchema.optional(),
  opciones: z.array(opcionSchema).min(3).max(4),
};

function comprobarPregunta(
  pregunta: {
    opciones: { correcta: boolean }[];
    sql?: string | undefined;
    esperado?: Esperado | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const correctas = pregunta.opciones.filter((opcion) => opcion.correcta).length;
  if (correctas !== 1) {
    ctx.addIssue({
      code: 'custom',
      message: `Tiene que haber exactamente una opción correcta y hay ${correctas}`,
      path: ['opciones'],
    });
  }
  comprobarSqlConEsperado(pregunta, ctx);
}

export const preguntaQuizSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z]+-[fia]-[0-9]{2,}-q[1-9][0-9]*$/, 'ID con formato «bd-f-04-q1»'),
    ...preguntaBase,
  })
  .superRefine(comprobarPregunta);

export const quizSchema = z
  .strictObject({
    leccion: leccionIdSchema,
    preguntas: z.array(preguntaQuizSchema).min(MIN_PREGUNTAS_POR_QUIZ),
  })
  .superRefine((quiz, ctx) => {
    comprobarUnicos(
      ctx,
      quiz.preguntas.map((pregunta) => pregunta.id),
      (id) => `ID repetido: ${id}`,
      (i) => ['preguntas', i, 'id'],
    );
    quiz.preguntas.forEach((pregunta, i) => {
      if (!pregunta.id.startsWith(`${quiz.leccion}-`)) {
        ctx.addIssue({
          code: 'custom',
          message: `La pregunta «${pregunta.id}» no es de la lección ${quiz.leccion}`,
          path: ['preguntas', i, 'id'],
        });
      }
    });
  });
export type Quiz = z.infer<typeof quizSchema>;

export const preguntaTestSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z]+-[fia]-t[0-9]{2,}$/, 'ID con formato «bd-f-t01»'),
    leccion: leccionIdSchema,
    ...preguntaBase,
  })
  .superRefine(comprobarPregunta);

/**
 * `test.yaml`: the level's question bank. It grows over time and need not cover every lesson; the
 * module test will draw from it.
 */
export const testSchema = z
  .strictObject({
    preguntas: z.array(preguntaTestSchema).min(1),
  })
  .superRefine((test, ctx) => {
    comprobarUnicos(
      ctx,
      test.preguntas.map((pregunta) => pregunta.id),
      (id) => `ID repetido: ${id}`,
      (i) => ['preguntas', i, 'id'],
    );
  });
export type Test = z.infer<typeof testSchema>;

// --- Caso del simulador -------------------------------------------------------------------------

export const puntoRubricaSchema = z.strictObject({
  id: z.string().regex(/^p[0-9]+$/, 'ID con formato «p1»'),
  punto: texto,
  lecciones: z.array(leccionIdSchema).min(1),
});

export const casoSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z]+-[fia]-caso-[0-9]{2,}$/, 'ID con formato «bd-f-caso-01»'),
    modulo: slug,
    nivel,
    titulo: texto,
    escenario: texto,
    pregunta: texto,
    repreguntas: z.array(texto).min(2).max(3),
    respuesta_modelo: texto,
    rubrica: z.array(puntoRubricaSchema).min(4).max(8),
    sql: texto.optional(),
    esperado: esperadoSchema.optional(),
  })
  .superRefine((caso, ctx) => {
    comprobarIdConNivel(ctx, caso.id, caso.nivel);
    comprobarSqlConEsperado(caso, ctx);
  });
export type Caso = z.infer<typeof casoSchema>;

// --- Pares del juego ----------------------------------------------------------------------------

export const parSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z]+-[fia]-par-[0-9]{2,}$/, 'ID con formato «bd-f-par-01»'),
    concepto: texto,
    definicion: texto,
    leccion: leccionIdSchema,
    nivel,
  })
  .superRefine((par, ctx) => {
    comprobarIdConNivel(ctx, par.id, par.nivel);
    comprobarIdConNivel(ctx, par.leccion, par.nivel, ['leccion']);
  });
export type Par = z.infer<typeof parSchema>;
