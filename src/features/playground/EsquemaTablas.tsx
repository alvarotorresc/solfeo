/** Tables of the current database with their columns, so the learner knows what to query. */
import type { TablaEsquema } from './logic/protocolo';

interface Props {
  esquema: TablaEsquema[];
  /** SQLite did not load, so there are no tables to wait for. */
  fallo: boolean;
}

export default function EsquemaTablas({ esquema, fallo }: Props) {
  return (
    <aside class="pg-esquema panel" aria-labelledby="pg-esquema-titulo">
      <h2 id="pg-esquema-titulo">Tablas</h2>
      {esquema.length === 0 ? (
        <p class="hint">{fallo ? 'No disponibles: la base no ha cargado.' : 'Cargando…'}</p>
      ) : (
        <ul>
          {esquema.map((tabla) => (
            <li key={tabla.nombre}>
              <details>
                <summary>
                  <code>{tabla.nombre}</code>
                  <span class="pg-ncol">{tabla.columnas.length} columnas</span>
                </summary>
                <ul class="pg-columnas">
                  {tabla.columnas.map((columna) => (
                    <li key={columna.nombre}>
                      <code>{columna.nombre}</code>
                      <span class="pg-tipo">
                        {[columna.tipo, columna.clave ? 'clave' : ''].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
