/**
 * Home page: paints the saved progress on the path, handles the level selector and the two-step
 * progress reset. The markup comes from the server; this only toggles classes and texts.
 */
import { NOMBRE_NIVEL } from '../lib/camino';
import { NIVELES, type Nivel } from '../lib/niveles';
import {
  borrarLecciones,
  cambiarNivel,
  contarHechas,
  estaHecha,
  guardarProgreso,
  hechasSeguidas,
  leerProgreso,
  siguientePendiente,
  type Progreso,
} from '../lib/progreso';
import { avisar } from './aviso';

const raiz = document.documentElement;
const almacen = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

let progreso = leerProgreso(almacen);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const modulo = $('moduloActivo');
const tituloModulo = modulo?.dataset['titulo'] ?? '';

function listaDe(nivel: Nivel): HTMLOListElement | null {
  return document.querySelector<HTMLOListElement>(`.lessons[data-nivel="${nivel}"]`);
}

function leccionesDe(nivel: Nivel): HTMLLIElement[] {
  return [...(listaDe(nivel)?.querySelectorAll<HTMLLIElement>('.lesson[data-id]') ?? [])];
}

function guardar(nuevo: Progreso): void {
  progreso = nuevo;
  if (!guardarProgreso(almacen, progreso)) {
    const aviso = $('storageHint');
    if (aviso) aviso.textContent = 'Este navegador no deja guardar el progreso.';
  }
}

function pintarLista(nivel: Nivel): void {
  const items = leccionesDe(nivel);
  const publicadas = items.filter((li) => li.dataset['href']).map((li) => li.dataset['id'] ?? '');
  const actual = siguientePendiente(progreso, publicadas);
  for (const li of items) {
    const id = li.dataset['id'] ?? '';
    const hecha = estaHecha(progreso, id);
    li.classList.toggle('done', hecha);
    li.classList.toggle('current', id === actual);
    const estado = li.querySelector('.state');
    if (estado && li.dataset['href']) {
      estado.textContent = hecha ? 'Hecha' : id === actual ? 'Sigue aquí' : '';
    }
  }
  const total = items.length || 1;
  const seguidas = hechasSeguidas(
    progreso,
    items.map((li) => li.dataset['id'] ?? ''),
  );
  listaDe(nivel)?.style.setProperty('--fill', String(Math.min(seguidas / total, 1)));
}

function pintarResumen(): void {
  const nivel = progreso.nivel;
  const items = leccionesDe(nivel);
  const total = items.length || 1;
  const ids = items.map((li) => li.dataset['id'] ?? '');
  const hechas = contarHechas(progreso, ids);

  $('ring')?.style.setProperty('--p', String(hechas / total));
  modulo?.querySelector<HTMLElement>('.node')?.style.setProperty('--p', String(hechas / total));
  const numero = $('ringNum');
  if (numero) numero.textContent = String(hechas);
  const titulo = $('progTitle');
  if (titulo)
    titulo.textContent = hechas === 0 ? 'Aún sin empezar' : `${hechas} de ${total} lecciones`;
  const sub = $('progSub');
  if (sub) sub.textContent = `${tituloModulo}, nivel ${NOMBRE_NIVEL[nivel]}`;

  const publicadas = items.filter((li) => li.dataset['href']);
  const siguiente = siguientePendiente(
    progreso,
    publicadas.map((li) => li.dataset['id'] ?? ''),
  );
  const destino = publicadas.find((li) => li.dataset['id'] === siguiente);
  const boton = $<HTMLAnchorElement>('continueBtn');
  const etiqueta = $('continueLabel');
  const hecho = $('continueDone');
  if (boton && etiqueta && hecho) {
    boton.hidden = !destino;
    hecho.hidden = Boolean(destino) || publicadas.length === 0;
    if (destino) {
      boton.href = destino.dataset['href'] ?? '/';
      const verbo = contarHechas(progreso, ids) === 0 ? 'Empezar por' : 'Seguir con';
      etiqueta.textContent = `${verbo} «${destino.dataset['titulo'] ?? ''}»`;
    }
  }
}

function pintarTodo(): void {
  for (const nivel of NIVELES) pintarLista(nivel);
  pintarResumen();
}

// --- Selector de nivel ---
const selector = $('levelSeg');
const radio = selector?.querySelector<HTMLInputElement>(`input[value="${progreso.nivel}"]`);
if (radio) radio.checked = true;
raiz.dataset['nivel'] = progreso.nivel;

const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
let cambio: ReturnType<typeof setTimeout> | undefined;

selector?.addEventListener('change', (evento) => {
  const nivel = (evento.target as HTMLInputElement).value as Nivel;
  if (!NIVELES.includes(nivel)) return;
  const anterior = listaDe(progreso.nivel);
  guardar(cambiarNivel(progreso, nivel));
  pintarResumen();
  clearTimeout(cambio);
  // Fade the old list out, swap, fade the new one in. The thumb moves by CSS on data-nivel.
  anterior?.classList.add('swap');
  const siguiente = listaDe(nivel);
  const intercambiar = () => {
    anterior?.classList.remove('swap');
    siguiente?.classList.add('swap');
    raiz.dataset['nivel'] = nivel;
    requestAnimationFrame(() => requestAnimationFrame(() => siguiente?.classList.remove('swap')));
  };
  if (reducirMovimiento.matches) intercambiar();
  else cambio = setTimeout(intercambiar, 170);
});

// --- Borrar progreso en dos pasos ---
const borrar = $<HTMLButtonElement>('resetBtn');
const confirmar = $<HTMLButtonElement>('resetConfirm');
let esperaConfirmacion: ReturnType<typeof setTimeout> | undefined;

borrar?.addEventListener('click', () => {
  if (!confirmar) return;
  confirmar.hidden = false;
  confirmar.focus();
  clearTimeout(esperaConfirmacion);
  esperaConfirmacion = setTimeout(() => {
    confirmar.hidden = true;
  }, 5000);
});

confirmar?.addEventListener('click', () => {
  guardar(borrarLecciones(progreso));
  confirmar.hidden = true;
  pintarTodo();
  avisar('Progreso borrado de este navegador.');
  borrar?.focus();
});

// Another tab may finish a lesson, and the back button may restore this page from the cache
// after a quiz: read the progress again in both cases.
function releer(): void {
  progreso = leerProgreso(almacen);
  raiz.dataset['nivel'] = progreso.nivel;
  const marcado = selector?.querySelector<HTMLInputElement>(`input[value="${progreso.nivel}"]`);
  if (marcado) marcado.checked = true;
  pintarTodo();
}
window.addEventListener('storage', releer);
window.addEventListener('pageshow', (evento) => {
  if (evento.persisted) releer();
});

pintarTodo();
