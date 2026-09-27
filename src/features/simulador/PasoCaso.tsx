/**
 * One case on screen: scenario, question, the follow-ups asked so far, the learner's optional
 * notes and, at the end, the model answer with the rubric to mark.
 */
import Inline from '../../components/Inline';
import { textoParaAvanzar, type Paso, type Puntuacion } from './logic/sesion';
import type { CasoDeIsla } from './tipos';

interface Props {
  caso: CasoDeIsla;
  paso: Paso;
  marcados: readonly string[];
  puntuacion: Puntuacion;
  esUltimo: boolean;
  notas: string;
  onNotas: (texto: string) => void;
  onMarcar: (puntoId: string) => void;
  onAvanzar: () => void;
}

export default function PasoCaso({
  caso,
  paso,
  marcados,
  puntuacion,
  esUltimo,
  notas,
  onNotas,
  onMarcar,
  onAvanzar,
}: Props) {
  const vistas =
    paso.tipo === 'pregunta'
      ? 0
      : paso.tipo === 'repregunta'
        ? paso.indice + 1
        : caso.repreguntas.length;
  const enRubrica = paso.tipo === 'rubrica';
  const notasId = `sim-notas-${caso.id}`;

  return (
    <div class="qcard sim-caso">
      <h2
        class="sim-titulo"
        tabIndex={-1}
        {...(paso.tipo === 'pregunta' ? { 'data-foco': '' } : {})}
      >
        <Inline texto={caso.titulo} />
      </h2>
      <p class="sim-escenario">
        <Inline texto={caso.escenario} />
      </p>

      <ol class="sim-turnos">
        <li class="sim-turno">
          <span class="sim-quien">Pregunta</span>
          <p>
            <Inline texto={caso.pregunta} />
          </p>
        </li>
        {caso.repreguntas.slice(0, vistas).map((repregunta, i) => (
          <li
            class="sim-turno repregunta"
            key={i}
            tabIndex={-1}
            {...(paso.tipo === 'repregunta' && paso.indice === i ? { 'data-foco': '' } : {})}
          >
            <span class="sim-quien">
              Repregunta {i + 1} de {caso.repreguntas.length}
            </span>
            <p>
              <Inline texto={repregunta} />
            </p>
          </li>
        ))}
      </ol>

      <div class="sim-notas">
        <label for={notasId}>Tu respuesta, si quieres escribirla</label>
        <textarea
          id={notasId}
          rows={enRubrica ? 4 : 6}
          value={notas}
          onInput={(evento) => onNotas(evento.currentTarget.value)}
          aria-describedby={`${notasId}-ayuda`}
        />
        <small id={`${notasId}-ayuda`}>
          Puedes responder de cabeza. Lo que escribas no se envía ni se guarda: se borra al pasar de
          caso.
        </small>
      </div>

      {enRubrica && (
        <>
          <section class="sim-modelo" aria-labelledby={`sim-modelo-${caso.id}`}>
            <h3 id={`sim-modelo-${caso.id}`} tabIndex={-1} data-foco>
              Respuesta modelo
            </h3>
            {/* Build-time HTML from our content, sanitised by its pipeline (see tipos.ts). */}
            <div class="prose" dangerouslySetInnerHTML={{ __html: caso.modeloHtml }} />
          </section>

          <fieldset class="sim-rubrica">
            <legend>
              <span class="sim-rubrica-t">Rúbrica</span>
              <span class="sim-rubrica-sub">Marca los puntos que tocaste en tu respuesta.</span>
            </legend>
            <ul>
              {caso.rubrica.map((punto) => {
                const id = `sim-${caso.id}-${punto.id}`;
                return (
                  <li key={punto.id}>
                    <label class="sim-punto" for={id}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={marcados.includes(punto.id)}
                        onChange={() => onMarcar(punto.id)}
                      />
                      <span class="sim-check" aria-hidden="true">
                        <span class="icon">check</span>
                      </span>
                      <span>
                        <Inline texto={punto.punto} />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p class="sim-cuenta" aria-live="polite">
              {puntuacion.tocados} de {puntuacion.total} puntos marcados
            </p>
          </fieldset>
        </>
      )}

      <div class="qfoot">
        <button class="btn btn-primary" type="button" onClick={onAvanzar}>
          {textoParaAvanzar(caso, paso, esUltimo)}
          <span class="icon" aria-hidden="true">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
