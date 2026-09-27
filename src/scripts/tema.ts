/**
 * Manual light/dark switch on top of the system preference. The choice is applied before paint by
 * the inline script in the layout; this only handles the button.
 */
import { CLAVE_TEMA } from '../lib/claves';

const raiz = document.documentElement;
const sistemaOscuro = window.matchMedia('(prefers-color-scheme: dark)');

function esOscuro(): boolean {
  const elegido = raiz.dataset['theme'];
  return elegido ? elegido === 'dark' : sistemaOscuro.matches;
}

function pintarBoton(boton: HTMLElement): void {
  boton.setAttribute('aria-label', esOscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

const boton = document.getElementById('themeBtn');
if (boton) {
  pintarBoton(boton);
  sistemaOscuro.addEventListener('change', () => pintarBoton(boton));
  boton.addEventListener('click', () => {
    const tema = esOscuro() ? 'light' : 'dark';
    raiz.dataset['theme'] = tema;
    try {
      localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
      // Without storage the theme still changes for this page.
    }
    pintarBoton(boton);
  });
}
