/** End of a session: score, weak points of each case and lessons to revisit. */
import Inline from '../../components/Inline';
import type { Resumen } from './logic/sesion';
import type { LeccionDeRepaso } from './tipos';

interface Props {
  resumen: Resumen;
  lecciones: Record<string, LeccionDeRepaso>;
  onOtra: () => void;
}

export default function ResumenSesion({ resumen, lecciones, onOtra }: Props) {
  const { total } = resumen;
  return (
    <div class="qcard summary sim-resumen">
      <h2 tabIndex={-1} data-foco>
        Has tocado {total.tocados} de {total.total} puntos
      </h2>
      <p>
        {total.tocados === total.total
          ? 'Todos los puntos de la rúbrica. Buena sesión.'
          : 'Lo que no marcaste es lo que conviene repasar.'}
      </p>

      <ol class="sim-casos">
        {resumen.casos.map((caso) => (
          <li key={caso.id}>
            <div class="sim-caso-fila">
              <b>
                <Inline texto={caso.titulo} />
              </b>
              <span class="qcount">
                {caso.puntuacion.tocados} de {caso.puntuacion.total}
              </span>
            </div>
            {caso.flojos.length > 0 && (
              <ul class="sim-flojos" aria-label="Puntos que no tocaste">
                {caso.flojos.map((punto) => (
                  <li key={punto.id}>
                    <span class="icon" aria-hidden="true">
                      close
                    </span>
                    <span>
                      <Inline texto={punto.punto} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      {resumen.lecciones.length > 0 && (
        <section class="sim-repaso" aria-labelledby="sim-repaso-t">
          <h3 id="sim-repaso-t">Lecciones para repasar</h3>
          <ul>
            {resumen.lecciones.map((id) => {
              const leccion = lecciones[id];
              return (
                <li key={id}>
                  {leccion?.href ? (
                    <a href={leccion.href}>{leccion.titulo}</a>
                  ) : (
                    <>
                      <span>{leccion?.titulo ?? id}</span>
                      <span class="soon">
                        <span class="icon" aria-hidden="true">
                          schedule
                        </span>
                        Próximamente
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div class="acts">
        <button class="btn btn-primary" type="button" onClick={onOtra}>
          <span class="icon" aria-hidden="true">
            restart_alt
          </span>
          Otra sesión
        </button>
        <a class="btn btn-ghost" href="/">
          Volver al camino
        </a>
      </div>
    </div>
  );
}
