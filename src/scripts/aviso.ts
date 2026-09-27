/** Shows a short message in the toast at the bottom of the page. */
let temporizador: ReturnType<typeof setTimeout> | undefined;

export function avisar(mensaje: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = mensaje;
  toast.classList.add('show');
  clearTimeout(temporizador);
  temporizador = setTimeout(() => toast.classList.remove('show'), 2600);
}
