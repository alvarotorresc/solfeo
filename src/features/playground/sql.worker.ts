/**
 * SQLite worker of the playground. Only wiring: the logic lives in `logic/motor.ts`.
 * The wasm and the seed are bundled by Vite and served from our own domain, and this file is
 * only requested by the playground page.
 */
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import semilla from '../../data/tienda.sql?raw';
import { conectarWorker, type ScopeWorker } from './logic/motor';

void conectarWorker(
  self as unknown as ScopeWorker,
  () => initSqlJs({ locateFile: () => wasmUrl }),
  semilla,
);
