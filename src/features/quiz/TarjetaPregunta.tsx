/**
 * One question on screen: statement, optional SQL, options, the explanation once answered and the
 * button to move on. Shared by the lesson quiz and the module test; the rules live in
 * `logic/quiz.ts` and each island keeps its own flow and summary.
 */
import type { Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import Inline from '../../components/Inline';
import { corregir, type OpcionQuiz } from './logic/quiz';
import { textoPlano } from '../../lib/inline';

export interface PreguntaDeIsla {
  id: string;
  enunciado: string;
  /** Prism HTML of the question's SQL, generated at build time from our own content. */
  sqlHtml?: string;
  opciones: OpcionQuiz[];
}

export const LETRAS = 'ABCD';

/** What screen readers hear right after answering. Empty while unanswered. */
export function anuncioDeRespuesta(pregunta: PreguntaDeIsla, elegida: number | null): string {
  if (elegida === null) return '';
  const resultado = corregir(pregunta, elegida);
  const explicacion =
    pregunta.opciones[resultado.acierto ? resultado.correcta : elegida]?.explicacion;
  return `${resultado.acierto ? 'Correcto' : 'Incorrecto'}. ${textoPlano(explicacion ?? '')}`;
}

interface Props {
  pregunta: PreguntaDeIsla;
  elegida: number | null;
  esUltima: boolean;
  onElegir: (i: number) => void;
  onSeguir: () => void;
  /** Receives the first option, so the island can focus it after moving on. */
  primerBoton: Ref<HTMLElement>;
}

export default function TarjetaPregunta({
  pregunta,
  elegida,
  esUltima,
  onElegir,
  onSeguir,
  primerBoton,
}: Props) {
  const [abierta, setAbierta] = useState(false);
  const siguienteBtn = useRef<HTMLButtonElement>(null);
  const resultado = elegida !== null ? corregir(pregunta, elegida) : null;

  // Open the explanation one frame after it mounts, so the row height can transition.
  useEffect(() => {
    if (elegida === null) {
      setAbierta(false);
      return;
    }
    const frame = requestAnimationFrame(() => setAbierta(true));
    const foco = setTimeout(() => siguienteBtn.current?.focus({ preventScroll: true }), 60);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(foco);
    };
  }, [elegida, pregunta.id]);

  return (
    <>
      <p class="qtext" id={`qtext-${pregunta.id}`}>
        <Inline texto={pregunta.enunciado} />
      </p>
      {pregunta.sqlHtml && (
        <pre class="qcode language-sql">
          <code class="language-sql" dangerouslySetInnerHTML={{ __html: pregunta.sqlHtml }} />
        </pre>
      )}
      <ul class="opts" aria-labelledby={`qtext-${pregunta.id}`}>
        {pregunta.opciones.map((opcion, i) => {
          const esCorrecta = resultado !== null && i === resultado.correcta;
          const esFallo = resultado !== null && i === elegida && !resultado.acierto;
          const clases = [
            'opt',
            esCorrecta && 'is-ok',
            esFallo && 'is-bad',
            resultado !== null && !esCorrecta && !esFallo && 'dim',
            i === elegida && 'picked',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li>
              <button
                class={clases}
                type="button"
                disabled={elegida !== null}
                onClick={() => onElegir(i)}
                {...(i === 0 ? { ref: primerBoton as Ref<HTMLButtonElement> } : {})}
              >
                <span class="letter" aria-hidden="true">
                  {LETRAS[i]}
                </span>
                <span>
                  <Inline texto={opcion.texto} />
                </span>
                <span class="mk">
                  {esCorrecta && (
                    <>
                      <span class="icon fill" aria-hidden="true">
                        check
                      </span>
                      <span class="mk-t">{i === elegida ? 'Tu respuesta' : 'Correcta'}</span>
                    </>
                  )}
                  {esFallo && (
                    <>
                      <span class="icon" aria-hidden="true">
                        close
                      </span>
                      <span class="mk-t">Tu respuesta</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div class={`fb${abierta ? ' open' : ''}`}>
        <div>
          {resultado && elegida !== null && (
            <div class={`fb-in ${resultado.acierto ? 'ok' : 'bad'}`}>
              {resultado.acierto ? (
                <>
                  <h3>
                    <span class="icon fill" aria-hidden="true">
                      check
                    </span>
                    Correcto
                  </h3>
                  <p>
                    <Inline texto={pregunta.opciones[resultado.correcta]?.explicacion} />
                  </p>
                </>
              ) : (
                <>
                  <h3>
                    <span class="icon" aria-hidden="true">
                      close
                    </span>
                    No es esa
                  </h3>
                  <p>
                    <Inline texto={pregunta.opciones[elegida]?.explicacion} />
                  </p>
                  <p>
                    <strong>La correcta es la {LETRAS[resultado.correcta]}.</strong>{' '}
                    <Inline texto={pregunta.opciones[resultado.correcta]?.explicacion} />
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div class="qfoot">
        {elegida !== null && (
          <button class="btn btn-primary" type="button" ref={siguienteBtn} onClick={onSeguir}>
            {esUltima ? 'Ver resultado' : 'Siguiente pregunta'}
            <span class="icon" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        )}
      </div>
    </>
  );
}
