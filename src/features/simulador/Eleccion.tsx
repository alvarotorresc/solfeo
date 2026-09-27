/** First screen of the simulator: what to practise. */
import type { OpcionDeSesion } from './logic/sesion';

interface Props {
  opciones: OpcionDeSesion[];
  elegida: string;
  maximo: number;
  etiqueta: (opcion: OpcionDeSesion) => string;
  onElegir: (clave: string) => void;
  onEmpezar: () => void;
}

const casos = (n: number) => (n === 1 ? '1 caso' : `${n} casos`);

export default function Eleccion({
  opciones,
  elegida,
  maximo,
  etiqueta,
  onElegir,
  onEmpezar,
}: Props) {
  return (
    <div class="qcard sim-eleccion">
      <fieldset class="sim-opciones" aria-labelledby="sim-eleccion-t">
        <legend>
          <h2 id="sim-eleccion-t" tabIndex={-1} data-foco>
            ¿Qué quieres practicar?
          </h2>
        </legend>
        {opciones.map((opcion) => (
          <label class="sim-opcion" key={opcion.clave}>
            <input
              type="radio"
              name="sim-sesion"
              value={opcion.clave}
              checked={opcion.clave === elegida}
              onChange={() => onElegir(opcion.clave)}
            />
            <span class="sim-opcion-t">{etiqueta(opcion)}</span>
            <small>{casos(opcion.casos)}</small>
          </label>
        ))}
      </fieldset>
      <p class="hint">
        Cada sesión saca hasta {maximo} casos al azar. Respondes, llegan las repreguntas y al final
        te corriges tú con la rúbrica.
      </p>
      <div class="qfoot">
        <button class="btn btn-primary" type="button" onClick={onEmpezar}>
          Empezar la sesión
          <span class="icon" aria-hidden="true">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
