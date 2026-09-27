/**
 * Lesson quiz island. Only paints: the rules live in `logic/quiz.ts` and the progress in
 * `lib/progreso.ts`. SQL arrives already highlighted by Prism at build time.
 */
import type { Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { guardarProgreso, leerProgreso, marcarHecha } from '../../lib/progreso';
import Inline from '../../components/Inline';
import Pasos from '../../components/Pasos';
import TarjetaPregunta, { anuncioDeRespuesta, type PreguntaDeIsla } from './TarjetaPregunta';
import { UMBRAL_APROBADO, avanzar, iniciarQuiz, nota, responder, resultados } from './logic/quiz';

export type { PreguntaDeIsla };

interface Props {
  leccion: string;
  preguntas: PreguntaDeIsla[];
  caminoHref: string;
}

function almacen(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export default function Quiz({ leccion, preguntas, caminoHref }: Props) {
  const [estado, setEstado] = useState(() => iniciarQuiz(preguntas.length));
  const [ronda, setRonda] = useState(0);
  const [guardado, setGuardado] = useState(true);
  const tarjeta = useRef<HTMLDivElement>(null);
  const primerBoton = useRef<HTMLElement>(null);
  const moverFoco = useRef(false);

  const pregunta = preguntas[estado.actual];
  const elegida = estado.respuestas[estado.actual] ?? null;
  const marcas = resultados(preguntas, estado.respuestas);
  const final = nota(preguntas, estado.respuestas);
  const minimo = Math.ceil(preguntas.length * UMBRAL_APROBADO);

  // After moving on, bring the card back into view and focus its first control.
  useEffect(() => {
    if (!moverFoco.current) return;
    moverFoco.current = false;
    const caja = tarjeta.current;
    if (caja && caja.getBoundingClientRect().top < 0) caja.scrollIntoView({ block: 'start' });
    primerBoton.current?.focus({ preventScroll: true });
  }, [estado.actual, estado.terminado, ronda]);

  // Passing marks the lesson as done in this browser.
  useEffect(() => {
    if (!estado.terminado || !final.aprobado) return;
    const guardar = almacen();
    setGuardado(guardarProgreso(guardar, marcarHecha(leerProgreso(guardar), leccion)));
  }, [estado.terminado]);

  const elegir = (i: number) => setEstado((e) => responder(e, preguntas, i));
  const seguir = () => {
    moverFoco.current = true;
    setEstado(avanzar);
  };
  const repetir = () => {
    moverFoco.current = true;
    setEstado(iniciarQuiz(preguntas.length));
    setRonda((r) => r + 1);
  };

  const animar = estado.actual > 0 || estado.terminado || ronda > 0;
  const cuenta = estado.terminado
    ? 'Terminado'
    : `Pregunta ${estado.actual + 1} de ${preguntas.length}`;

  const anuncio = estado.terminado
    ? `Quiz terminado. Has acertado ${final.aciertos} de ${final.total}.`
    : pregunta
      ? anuncioDeRespuesta(pregunta, elegida)
      : '';

  return (
    <div class="quiz">
      <div class="qhead">
        <h2 id="h-quiz">Quiz</h2>
        <span class="qcount">{cuenta}</span>
      </div>
      <Pasos marcas={marcas} actual={estado.actual} terminado={estado.terminado} />

      <div
        class={`qcard${animar ? ' swap' : ''}`}
        ref={tarjeta}
        key={`${ronda}-${estado.terminado ? 'fin' : estado.actual}`}
      >
        {estado.terminado ? (
          <div class="summary">
            <h3>
              Has acertado {final.aciertos} de {final.total}
            </h3>
            <p>
              {final.aprobado
                ? guardado
                  ? 'La lección queda marcada como hecha en este navegador.'
                  : 'Aprobado, pero este navegador no deja guardar el progreso.'
                : `Para darla por hecha hacen falta ${minimo} aciertos.`}
              {final.aciertos < final.total ? ' Repasa las que fallaste:' : ''}
            </p>
            <ol>
              {preguntas.map((p, i) => (
                <li class={marcas[i] ? 'ok' : 'bad'}>
                  <span class={`icon${marcas[i] ? ' fill' : ''}`} aria-hidden="true">
                    {marcas[i] ? 'check' : 'close'}
                  </span>
                  <span>
                    <span class="sr">{marcas[i] ? 'Acertada: ' : 'Fallada: '}</span>
                    <Inline texto={p.enunciado} />
                  </span>
                </li>
              ))}
            </ol>
            <div class="acts">
              <a
                class="btn btn-primary"
                href={caminoHref}
                ref={primerBoton as Ref<HTMLAnchorElement>}
              >
                Volver al camino
              </a>
              <button class="btn btn-ghost" type="button" onClick={repetir}>
                <span class="icon" aria-hidden="true">
                  restart_alt
                </span>
                Repetir el quiz
              </button>
            </div>
          </div>
        ) : pregunta ? (
          <TarjetaPregunta
            pregunta={pregunta}
            elegida={elegida}
            esUltima={estado.actual >= preguntas.length - 1}
            onElegir={elegir}
            onSeguir={seguir}
            primerBoton={primerBoton}
          />
        ) : null}
      </div>
      <p class="sr" aria-live="assertive">
        {anuncio}
      </p>
    </div>
  );
}
