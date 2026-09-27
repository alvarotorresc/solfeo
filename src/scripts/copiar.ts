/** Copy buttons of the code frames rendered at build time. */
import { avisar } from './aviso';

const FALLO = 'No se ha podido copiar. Selecciona el texto a mano.';

document.addEventListener('click', (evento) => {
  const boton = (evento.target as Element | null)?.closest<HTMLButtonElement>('[data-copy]');
  if (!boton) return;
  const codigo = boton.closest('figure')?.querySelector('pre')?.textContent ?? '';
  const etiqueta = boton.querySelector('.copy-label');
  if (!navigator.clipboard?.writeText) {
    avisar(FALLO);
    return;
  }
  navigator.clipboard.writeText(codigo.replace(/\n$/, '')).then(
    () => {
      if (!etiqueta) return;
      etiqueta.textContent = 'Copiado';
      setTimeout(() => {
        etiqueta.textContent = 'Copiar';
      }, 1600);
    },
    () => avisar(FALLO),
  );
});
