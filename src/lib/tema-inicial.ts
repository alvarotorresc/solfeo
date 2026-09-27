/**
 * Inline script that applies the saved theme and level before the first paint, so neither
 * flashes. Kept as a string so the layout can inline it and `astro.config.mjs` can add its hash
 * to the content security policy: Astro only hashes the scripts it bundles itself.
 * Plain ES5 on purpose and wrapped in try/catch: storage may be blocked or hold anything.
 */
import { NIVELES } from './niveles';
import { CLAVE_PROGRESO, CLAVE_TEMA } from './claves';

export const SCRIPT_TEMA_INICIAL = `try {
  var raiz = document.documentElement;
  var tema = localStorage.getItem('${CLAVE_TEMA}');
  if (tema === 'light' || tema === 'dark') raiz.dataset.theme = tema;
  var progreso = JSON.parse(localStorage.getItem('${CLAVE_PROGRESO}') || 'null');
  if (progreso && ${JSON.stringify(NIVELES)}.indexOf(progreso.nivel) >= 0) {
    raiz.dataset.nivel = progreso.nivel;
  }
} catch (e) {}`;
