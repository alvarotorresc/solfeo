import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  casoSchema,
  leccionSchema,
  moduloSchema,
  parSchema,
  quizSchema,
  sqlArchivoSchema,
  temarioSchema,
  testSchema,
} from './content/schemas';

const base = './src/content';

/** Folder of an entry relative to `src/content`, e.g. `bases-de-datos/fundamentos/04-x`. */
const carpetaDe = ({ entry }: { entry: string }): string => entry.slice(0, entry.lastIndexOf('/'));

/** Reads a string field from the parsed data; the schema then rejects the entry if it is missing. */
const campo =
  (nombre: string) =>
  ({ entry, data }: { entry: string; data: Record<string, unknown> }): string => {
    const valor = data[nombre];
    return typeof valor === 'string' ? valor : entry;
  };

const modulos = defineCollection({
  loader: file('src/content/modulos.yaml'),
  schema: moduloSchema,
});

// One entry per module, keyed by the module folder.
const temarios = defineCollection({
  loader: glob({ base, pattern: '*/temario.yaml', generateId: carpetaDe }),
  schema: temarioSchema,
});

const lecciones = defineCollection({
  loader: glob({ base, pattern: '*/*/*/leccion.md', generateId: campo('id') }),
  schema: leccionSchema,
});

// Keyed by the lesson folder, since `sql.yaml` has no lesson ID of its own.
const sql = defineCollection({
  loader: glob({ base, pattern: '*/*/*/sql.yaml', generateId: carpetaDe }),
  schema: sqlArchivoSchema,
});

const quizzes = defineCollection({
  loader: glob({ base, pattern: '*/*/*/quiz.yaml', generateId: campo('leccion') }),
  schema: quizSchema,
});

// Keyed by `modulo/nivel`.
const tests = defineCollection({
  loader: glob({ base, pattern: '*/*/test.yaml', generateId: carpetaDe }),
  schema: testSchema,
});

const casos = defineCollection({
  loader: glob({ base, pattern: '*/*/casos/*.yaml', generateId: campo('id') }),
  schema: casoSchema,
});

// One entry per module, keyed by the module folder.
const pares = defineCollection({
  loader: glob({ base, pattern: '*/pares.yaml', generateId: carpetaDe }),
  schema: z.array(parSchema),
});

export const collections = { modulos, temarios, lecciones, sql, quizzes, tests, casos, pares };
