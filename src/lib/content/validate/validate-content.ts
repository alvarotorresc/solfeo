/**
 * Content validator: checks every file under a content root against the contract in
 * `content/schemas.ts`, cross-checks IDs and references between files, and runs every SQL query
 * against a fresh copy of the seed database. Markdown goes through the same pipeline and sanitiser
 * as the build, so unsafe Markdown fails here instead of publishing an empty page. Pure library: `scripts/validate-content.ts` prints
 * the report and sets the exit code.
 *
 * A file that fails its schema is reported once and skipped by every check that depends on it,
 * so one mistake never cascades into a list of unrelated errors.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'astro/zod';
import { load } from 'js-yaml';
import type { Database } from 'sql.js';
import {
  LETRA_NIVEL,
  casoSchema,
  leccionSchema,
  moduloSchema,
  parSchema,
  quizSchema,
  sqlArchivoSchema,
  temarioSchema,
  testSchema,
  type Esperado,
  type Leccion,
  type Nivel,
  type Tema,
  type Test,
} from '../../../content/schemas';
import { compareResult } from '../compare-result';
import { renderizarMarkdown } from '../markdown';
import { openDatabase } from '../open-database';
import { runQuery } from '../run-query';
import { extractSqlBlocks, type SqlBlock } from '../sql-blocks';
import { classify, listFiles, type Ubicacion } from './layout';
import type { CodigoAviso, CodigoError, Informe } from './report';
import { isYesNoQuestion, normalizeStatement } from './text';

export interface ValidateOptions {
  /** Content root, laid out like `src/content`. */
  raiz: string;
  /** SQL that creates and fills the sample database. */
  semilla: string;
}

/** Each lesson present in the level should have at least this many questions in its test. */
export const MIN_PREGUNTAS_TEST_POR_LECCION = 2;

type Ubicado<T extends Ubicacion['tipo']> = Extract<Ubicacion, { tipo: T }> & { archivo: string };

interface CarpetaLeccion {
  nivel: Nivel;
  carpeta: string;
  tipos: Set<'leccion' | 'quiz' | 'sql'>;
}

/** What the checks of one module share: prefix, syllabus, and the IDs and statements seen. */
interface Modulo {
  id: string;
  /** Undefined when `modulos.yaml` is invalid: prefix checks are skipped. */
  prefijo: string | undefined;
  /** Undefined when the syllabus is missing or invalid: reference checks are skipped. */
  temas: Map<string, Tema> | undefined;
  ids: Map<string, string>;
  /** Normalised statement → question that first used it, across the module's quizzes and tests. */
  enunciados: Map<string, string>;
}

const mensajeDe = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';

function frontmatter(markdown: string): { datos: unknown; cuerpo: string; desplazamiento: number } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  if (!match) return { datos: {}, cuerpo: markdown, desplazamiento: 0 };
  return {
    datos: load(match[1] ?? ''),
    cuerpo: markdown.slice(match[0].length),
    desplazamiento: match[0].split('\n').length - 1,
  };
}

/**
 * Rows changed so far and schema version: differs after any INSERT, UPDATE, DELETE or DDL.
 * `getRowsModified()` only counts the last statement, so it would miss `DELETE ...; SELECT ...`.
 */
function huella(db: Database): string {
  return JSON.stringify(
    db.exec('SELECT total_changes(), schema_version FROM pragma_schema_version')[0]?.values,
  );
}

/** Each value that appears more than once, listed once. */
function duplicados(valores: readonly string[]): string[] {
  return [...new Set(valores.filter((valor, i) => valores.indexOf(valor) !== i))];
}

class Validador {
  readonly informe: Informe = { errores: [], avisos: [], noEjecutables: [] };
  private readonly raiz: string;
  private readonly semilla: string;
  private base: Promise<Database> | undefined;

  constructor({ raiz, semilla }: ValidateOptions) {
    this.raiz = raiz;
    this.semilla = semilla;
  }

  async validar(): Promise<void> {
    const porModulo = new Map<
      string,
      Ubicado<Exclude<Ubicacion['tipo'], 'codigo' | 'modulos'>>[]
    >();
    let hayModulos = false;
    const { archivos, simbolicos } = listFiles(this.raiz);
    for (const enlace of simbolicos) {
      this.error('symlink', enlace, 'Es un enlace simbólico: no se sigue ni se carga');
    }
    for (const archivo of archivos) {
      const ubicacion = classify(archivo);
      if (!ubicacion) {
        this.error(
          'archivo-desconocido',
          archivo,
          'No encaja en la estructura del contenido y no se cargaría',
        );
      } else if (ubicacion.tipo === 'modulos') {
        hayModulos = true;
      } else if (ubicacion.tipo !== 'codigo') {
        const lista = porModulo.get(ubicacion.modulo) ?? [];
        lista.push({ ...ubicacion, archivo });
        porModulo.set(ubicacion.modulo, lista);
      }
    }

    const prefijos = this.modulos(hayModulos);
    for (const [id, archivos] of porModulo) {
      const prefijo = prefijos?.get(id);
      if (prefijos && prefijo === undefined) {
        this.error(
          'ruta-incoherente',
          `${id}/`,
          `La carpeta «${id}» no es un módulo de modulos.yaml`,
        );
        continue;
      }
      await this.modulo(
        { id, prefijo, temas: undefined, ids: new Map(), enunciados: new Map() },
        archivos,
      );
    }
  }

  async cerrar(): Promise<void> {
    if (this.base) (await this.base).close();
  }

  // --- Informe ----------------------------------------------------------------------------------

  private error(codigo: CodigoError, archivo: string, mensaje: string): void {
    this.informe.errores.push({ codigo, archivo, mensaje });
  }

  private aviso(codigo: CodigoAviso, archivo: string, mensaje: string): void {
    this.informe.avisos.push({ codigo, archivo, mensaje });
  }

  // --- Lectura ----------------------------------------------------------------------------------

  private leer(archivo: string): string {
    return readFileSync(join(this.raiz, archivo), 'utf8');
  }

  /** Checks data against a schema; on failure reports every issue once and returns undefined. */
  private cargar<T extends z.ZodType>(
    schema: T,
    archivo: string,
    datos: unknown,
  ): z.infer<T> | undefined {
    const resultado = schema.safeParse(datos);
    if (resultado.success) return resultado.data;
    const detalle = resultado.error.issues
      .map((issue) => {
        const ruta = issue.path.map(String).join('.');
        return ruta ? `${ruta}: ${issue.message}` : issue.message;
      })
      .join('; ');
    this.error('esquema', archivo, detalle);
    return undefined;
  }

  private yaml<T extends z.ZodType>(schema: T, archivo: string): z.infer<T> | undefined {
    let datos: unknown;
    try {
      datos = load(this.leer(archivo));
    } catch (error) {
      this.error('esquema', archivo, `YAML no válido: ${mensajeDe(error)}`);
      return undefined;
    }
    return this.cargar(schema, archivo, datos);
  }

  // --- SQL --------------------------------------------------------------------------------------

  /**
   * Runs a query and compares it; mutating queries get a fresh copy of the database. A query on
   * the shared database that changes rows or the schema without `muta: true` is reported, and the
   * shared database is reopened so it does not leak into the next queries.
   */
  private async comprobarSql(
    archivo: string,
    donde: string,
    sql: string,
    esperado: Esperado,
  ): Promise<void> {
    const db = esperado.muta ? await openDatabase(this.semilla) : await this.compartida();
    const antes = esperado.muta ? '' : huella(db);
    try {
      const fallo = compareResult(runQuery(db, sql), esperado);
      if (fallo) this.error('sql-resultado', archivo, `${donde}: ${fallo}`);
    } catch (error) {
      this.error('sql-fallido', archivo, `${donde}: ${mensajeDe(error)}`);
    } finally {
      if (esperado.muta) {
        db.close();
      } else if (huella(db) !== antes) {
        this.error(
          'muta-no-declarada',
          archivo,
          `${donde}: modifica la base y no declara «muta: true»`,
        );
        db.close();
        this.base = undefined;
      }
    }
  }

  /** Smoke test: the query must run on a clean database; its result is not compared. */
  private async ejecutarSinComparar(archivo: string, donde: string, sql: string): Promise<void> {
    const db = await openDatabase(this.semilla);
    try {
      runQuery(db, sql);
    } catch (error) {
      this.error('sql-fallido', archivo, `${donde}: ${mensajeDe(error)}`);
    } finally {
      db.close();
    }
  }

  // --- Markdown ---------------------------------------------------------------------------------

  /** Renders the text like the build does; any rejection of the sanitiser is an error. */
  private async markdown(archivo: string, donde: string, texto: string): Promise<void> {
    try {
      await renderizarMarkdown(texto, donde);
    } catch (error) {
      this.error('markdown-inseguro', archivo, mensajeDe(error));
    }
  }

  private compartida(): Promise<Database> {
    this.base ??= openDatabase(this.semilla);
    return this.base;
  }

  private noEjecutable(archivo: string, lugar: string, bloque: SqlBlock): void {
    const motivo = bloque.reason?.trim();
    if (motivo) this.informe.noEjecutables.push({ archivo, lugar, motivo });
    else this.error('bloque-sin-marca', archivo, `Bloque «no-ejecutar» sin motivo (${lugar})`);
  }

  // --- Módulos y temario ------------------------------------------------------------------------

  private modulos(existe: boolean): Map<string, string> | undefined {
    const archivo = 'modulos.yaml';
    if (!existe) {
      this.error('esquema', archivo, 'Falta la lista de módulos');
      return undefined;
    }
    const modulos = this.yaml(moduloSchema.array(), archivo);
    if (!modulos) return undefined;
    for (const id of duplicados(modulos.map((modulo) => modulo.id))) {
      this.error('id-duplicado', archivo, `Módulo repetido: ${id}`);
    }
    for (const prefijo of duplicados(modulos.map((modulo) => modulo.prefijo))) {
      this.error('id-duplicado', archivo, `Prefijo repetido: ${prefijo}`);
    }
    for (const orden of duplicados(modulos.map((modulo) => String(modulo.orden)))) {
      this.error('id-duplicado', archivo, `Orden repetido: ${orden}`);
    }
    return new Map(modulos.map((modulo) => [modulo.id, modulo.prefijo]));
  }

  private async modulo(
    modulo: Modulo,
    archivos: Ubicado<Exclude<Ubicacion['tipo'], 'codigo' | 'modulos'>>[],
  ): Promise<void> {
    const temario = archivos.find((archivo) => archivo.tipo === 'temario');
    if (temario) modulo.temas = this.temario(modulo, temario.archivo);
    else
      this.error('referencia-rota', `${modulo.id}/temario.yaml`, 'Al módulo le falta el temario');

    const carpetas = new Map<string, CarpetaLeccion>();
    const lecciones: { nivel: Nivel; leccion: Leccion }[] = [];
    const tests: { nivel: Nivel; archivo: string; test: Test }[] = [];

    for (const ubicado of archivos) {
      if (ubicado.tipo === 'leccion' || ubicado.tipo === 'quiz' || ubicado.tipo === 'sql') {
        const clave = `${ubicado.nivel}/${ubicado.carpeta}`;
        const carpeta: CarpetaLeccion = carpetas.get(clave) ?? {
          nivel: ubicado.nivel,
          carpeta: ubicado.carpeta,
          tipos: new Set(),
        };
        carpeta.tipos.add(ubicado.tipo);
        carpetas.set(clave, carpeta);
      }
    }
    for (const carpeta of carpetas.values()) {
      const leccion = await this.carpetaLeccion(modulo, carpeta);
      if (leccion) lecciones.push({ nivel: carpeta.nivel, leccion });
    }

    for (const ubicado of archivos) {
      if (ubicado.tipo === 'test') {
        const test = await this.test(modulo, ubicado);
        if (test) tests.push({ nivel: ubicado.nivel, archivo: ubicado.archivo, test });
      } else if (ubicado.tipo === 'caso') {
        await this.caso(modulo, ubicado);
      } else if (ubicado.tipo === 'pares') {
        this.pares(modulo, ubicado.archivo);
      }
    }

    for (const { nivel, archivo, test } of tests) {
      for (const { leccion } of lecciones.filter((entrada) => entrada.nivel === nivel)) {
        const n = test.preguntas.filter((pregunta) => pregunta.leccion === leccion.id).length;
        if (n < MIN_PREGUNTAS_TEST_POR_LECCION) {
          this.aviso(
            'cobertura-test',
            archivo,
            `La lección ${leccion.id} tiene ${n} preguntas en el test; debería tener al menos ${MIN_PREGUNTAS_TEST_POR_LECCION}`,
          );
        }
      }
    }
  }

  private temario(modulo: Modulo, archivo: string): Map<string, Tema> | undefined {
    const temario = this.yaml(temarioSchema, archivo);
    if (!temario) return undefined;
    if (temario.modulo !== modulo.id) {
      this.error('ruta-incoherente', archivo, `Declara el módulo «${temario.modulo}»`);
    }
    for (const tema of temario.lecciones) this.idEnRuta(modulo, tema.id, tema.nivel, archivo);
    return new Map(temario.lecciones.map((tema) => [tema.id, tema]));
  }

  /** IDs start with the module prefix and the level letter, e.g. `bd-f-`. */
  private idEnRuta(modulo: Modulo, id: string, nivel: Nivel, archivo: string): void {
    const esperado = `${modulo.prefijo ?? ''}-${LETRA_NIVEL[nivel]}-`;
    if (modulo.prefijo !== undefined && !id.startsWith(esperado)) {
      this.error('ruta-incoherente', archivo, `El ID «${id}» debería empezar por «${esperado}»`);
    }
  }

  private registrar(modulo: Modulo, id: string, archivo: string): void {
    const previo = modulo.ids.get(id);
    if (previo) this.error('id-duplicado', archivo, `El ID «${id}» ya se usa en ${previo}`);
    else modulo.ids.set(id, archivo);
  }

  /** The lesson's `leccion` exists in the syllabus and belongs to `nivel`. */
  private leccionDelNivel(
    modulo: Modulo,
    leccion: string,
    nivel: Nivel,
    archivo: string,
    quien: string,
  ): void {
    if (!modulo.temas) return;
    const tema = modulo.temas.get(leccion);
    if (!tema) {
      this.error(
        'referencia-rota',
        archivo,
        `${quien} apunta a ${leccion}, que no está en el temario`,
      );
    } else if (tema.nivel !== nivel) {
      this.error(
        'referencia-rota',
        archivo,
        `${quien} es de ${nivel} y apunta a ${leccion}, que es de ${tema.nivel}`,
      );
    }
  }

  // --- Lección, sql.yaml y quiz -----------------------------------------------------------------

  private async carpetaLeccion(
    modulo: Modulo,
    { nivel, carpeta, tipos }: CarpetaLeccion,
  ): Promise<Leccion | undefined> {
    const base = `${modulo.id}/${nivel}/${carpeta}`;
    if (!tipos.has('leccion')) {
      this.error('referencia-rota', `${base}/`, 'La carpeta no tiene leccion.md');
      return undefined;
    }

    const archivo = `${base}/leccion.md`;
    let partes: ReturnType<typeof frontmatter>;
    try {
      partes = frontmatter(this.leer(archivo));
    } catch (error) {
      this.error('esquema', archivo, `Frontmatter no válido: ${mensajeDe(error)}`);
      return undefined;
    }

    await this.markdown(archivo, 'Cuerpo de la lección', partes.cuerpo);
    const leccion = this.cargar(leccionSchema, archivo, partes.datos);
    if (leccion) this.leccionEnSuSitio(modulo, leccion, nivel, carpeta, archivo);
    await this.bloquesDeLeccion(base, partes.cuerpo, partes.desplazamiento, tipos.has('sql'));
    if (tipos.has('quiz')) await this.quiz(modulo, `${base}/quiz.yaml`, leccion);
    return leccion;
  }

  private leccionEnSuSitio(
    modulo: Modulo,
    leccion: Leccion,
    nivel: Nivel,
    carpeta: string,
    archivo: string,
  ): void {
    this.registrar(modulo, leccion.id, archivo);
    if (leccion.modulo !== modulo.id || leccion.nivel !== nivel) {
      this.error(
        'ruta-incoherente',
        archivo,
        `Declara ${leccion.modulo}/${leccion.nivel} y está en ${modulo.id}/${nivel}`,
      );
    }
    if (!modulo.temas) return;
    const tema = modulo.temas.get(leccion.id);
    if (!tema) {
      this.error('temario-incoherente', archivo, `La lección ${leccion.id} no está en el temario`);
      return;
    }
    if (tema.nivel !== nivel || tema.carpeta !== carpeta) {
      this.error(
        'ruta-incoherente',
        archivo,
        `El temario la coloca en ${tema.nivel}/${tema.carpeta}`,
      );
    }
    if (tema.titulo !== leccion.titulo || tema.orden !== leccion.orden) {
      this.error(
        'temario-incoherente',
        archivo,
        `El temario dice «${tema.titulo}», orden ${tema.orden}; la lección dice «${leccion.titulo}», orden ${leccion.orden}`,
      );
    }
  }

  private async bloquesDeLeccion(
    base: string,
    cuerpo: string,
    desplazamiento: number,
    hayArchivoSql: boolean,
  ): Promise<void> {
    const archivo = `${base}/leccion.md`;
    const lugar = (bloque: SqlBlock): string => `línea ${bloque.line + desplazamiento}`;
    const ejecutables = new Map<string, SqlBlock>();

    for (const bloque of extractSqlBlocks(cuerpo)) {
      if (!bloque.executable) {
        this.noEjecutable(archivo, lugar(bloque), bloque);
      } else if (bloque.id === undefined) {
        this.error(
          'bloque-sin-marca',
          archivo,
          `Bloque sql sin «id=» ni «no-ejecutar motivo="..."» (${lugar(bloque)})`,
        );
      } else if (ejecutables.has(bloque.id)) {
        this.error(
          'id-duplicado',
          archivo,
          `El bloque «${bloque.id}» se repite (${lugar(bloque)})`,
        );
      } else {
        ejecutables.set(bloque.id, bloque);
      }
    }

    const archivoSql = `${base}/sql.yaml`;
    const esperados = hayArchivoSql ? this.yaml(sqlArchivoSchema, archivoSql) : {};
    if (!esperados) return;
    for (const [id, bloque] of ejecutables) {
      const esperado = esperados[id];
      if (esperado) {
        await this.comprobarSql(archivo, `bloque ${id} (${lugar(bloque)})`, bloque.code, esperado);
      } else {
        this.error(
          'esperado-ausente',
          archivoSql,
          `Falta el resultado esperado del bloque «${id}» (${lugar(bloque)})`,
        );
      }
    }
    for (const id of Object.keys(esperados).filter((clave) => !ejecutables.has(clave))) {
      this.error(
        'esperado-sobrante',
        archivoSql,
        `«${id}» no es ningún bloque ejecutable de la lección`,
      );
    }
  }

  private async quiz(modulo: Modulo, archivo: string, leccion: Leccion | undefined): Promise<void> {
    const quiz = this.yaml(quizSchema, archivo);
    if (!quiz) return;
    if (leccion && quiz.leccion !== leccion.id) {
      this.error(
        'referencia-rota',
        archivo,
        `Es de la lección ${quiz.leccion} y está en la carpeta de ${leccion.id}`,
      );
    }
    await this.preguntas(modulo, archivo, quiz.preguntas);
  }

  private async preguntas(
    modulo: Modulo,
    archivo: string,
    preguntas: readonly {
      id: string;
      enunciado: string;
      sql?: string | undefined;
      esperado?: Esperado | undefined;
    }[],
  ): Promise<void> {
    for (const pregunta of preguntas) {
      this.registrar(modulo, pregunta.id, archivo);
      const clave = normalizeStatement(pregunta.enunciado);
      const previa = modulo.enunciados.get(clave);
      if (previa) {
        this.error(
          'enunciado-duplicado',
          archivo,
          `El enunciado de ${pregunta.id} repite el de ${previa}`,
        );
      } else {
        modulo.enunciados.set(clave, `${pregunta.id} (${archivo})`);
      }
      if (pregunta.sql && pregunta.esperado) {
        await this.comprobarSql(
          archivo,
          `pregunta ${pregunta.id}`,
          pregunta.sql,
          pregunta.esperado,
        );
      }
    }
  }

  // --- Test, casos y pares ----------------------------------------------------------------------

  private async test(
    modulo: Modulo,
    { archivo, nivel }: Ubicado<'test'>,
  ): Promise<Test | undefined> {
    const test = this.yaml(testSchema, archivo);
    if (!test) return undefined;
    for (const pregunta of test.preguntas) {
      this.idEnRuta(modulo, pregunta.id, nivel, archivo);
      this.leccionDelNivel(modulo, pregunta.leccion, nivel, archivo, `La pregunta ${pregunta.id}`);
    }
    await this.preguntas(modulo, archivo, test.preguntas);
    return test;
  }

  private async caso(modulo: Modulo, { archivo, nivel, nombre }: Ubicado<'caso'>): Promise<void> {
    const caso = this.yaml(casoSchema, archivo);
    if (!caso) return;
    this.registrar(modulo, caso.id, archivo);
    this.idEnRuta(modulo, caso.id, caso.nivel, archivo);
    if (caso.id !== nombre) {
      this.error('ruta-incoherente', archivo, `El archivo debería llamarse ${caso.id}.yaml`);
    }
    if (caso.modulo !== modulo.id || caso.nivel !== nivel) {
      this.error(
        'ruta-incoherente',
        archivo,
        `Declara ${caso.modulo}/${caso.nivel} y está en ${modulo.id}/${nivel}`,
      );
    }
    for (const punto of caso.rubrica) {
      for (const leccion of punto.lecciones) {
        if (modulo.temas && !modulo.temas.has(leccion)) {
          this.error(
            'referencia-rota',
            archivo,
            `El punto ${punto.id} de la rúbrica apunta a ${leccion}, que no está en el temario`,
          );
        }
      }
    }

    await this.markdown(archivo, 'respuesta_modelo', caso.respuesta_modelo);
    if (caso.sql && caso.esperado) {
      await this.comprobarSql(archivo, 'sql del caso', caso.sql, caso.esperado);
    }
    for (const bloque of extractSqlBlocks(caso.respuesta_modelo)) {
      const lugar = `respuesta_modelo, línea ${bloque.line}`;
      if (bloque.executable) await this.ejecutarSinComparar(archivo, lugar, bloque.code);
      else this.noEjecutable(archivo, lugar, bloque);
    }

    const preguntas = [
      ['pregunta', caso.pregunta],
      ...caso.repreguntas.map((texto, i) => [`repregunta ${i + 1}`, texto]),
    ] as const;
    for (const [campo, texto] of preguntas) {
      if (isYesNoQuestion(texto)) {
        this.aviso(
          'pregunta-si-no',
          archivo,
          `La ${campo} parece de sí o no; mejor pedir cómo o por qué`,
        );
      }
    }
  }

  private pares(modulo: Modulo, archivo: string): void {
    const pares = this.yaml(parSchema.array(), archivo);
    // Two cards with the same text look identical in the game, so picking the "wrong" one of the
    // two would count as a miss.
    const vistos = { concepto: new Map<string, string>(), definicion: new Map<string, string>() };
    for (const par of pares ?? []) {
      this.registrar(modulo, par.id, archivo);
      this.idEnRuta(modulo, par.id, par.nivel, archivo);
      this.leccionDelNivel(modulo, par.leccion, par.nivel, archivo, `El par ${par.id}`);
      for (const campo of ['concepto', 'definicion'] as const) {
        const clave = normalizeStatement(par[campo]);
        const previo = vistos[campo].get(clave);
        if (previo) {
          this.error('par-repetido', archivo, `El ${campo} de ${par.id} repite el de ${previo}`);
        } else {
          vistos[campo].set(clave, par.id);
        }
      }
    }
  }
}

/** Validates the content tree under `raiz`. Never throws for bad content: it reports it. */
export async function validateContent(opciones: ValidateOptions): Promise<Informe> {
  const validador = new Validador(opciones);
  try {
    await validador.validar();
  } finally {
    await validador.cerrar();
  }
  return validador.informe;
}
