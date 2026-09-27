/** Rows of a query. Scrolls sideways inside its own box so wide results never widen the page. */
import { columnasNumericas, formatearCelda } from './logic/formato';
import type { CeldaResultado } from './logic/protocolo';

interface Props {
  columnas: string[];
  filas: CeldaResultado[][];
}

export default function TablaResultado({ columnas, filas }: Props) {
  const numericas = columnasNumericas(filas, columnas.length);
  return (
    <div class="pg-tabla" role="region" aria-label="Resultado de la consulta" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {columnas.map((columna, i) => (
              <th key={i} scope="col" class={numericas[i] ? 'is-num' : undefined}>
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((celda, j) => (
                <td
                  key={j}
                  class={celda === null ? 'is-null' : numericas[j] ? 'is-num' : undefined}
                >
                  {formatearCelda(celda)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {filas.length === 0 && <p class="pg-vacio">La consulta no devuelve filas.</p>}
    </div>
  );
}
