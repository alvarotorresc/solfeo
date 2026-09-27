/**
 * Module test island. Only paints: the draw lives in `logic/test.ts`, and correcting and scoring
 * reuse the quiz rules. The server renders the start card, so the draw happens on the click and
 * never differs between the server HTML and the hydrated island.
 */
import type { Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import Pasos from '../../components/Pasos';
import TarjetaPregunta, { anuncioDeRespuesta, type PreguntaDeIsla } from '../quiz/TarjetaPregunta';
import {
  UMBRAL_APROBADO,
  avanzar,
  iniciarQuiz,
  leccionesARepasar,
  nota,
  responder,
  resultados,
} from '../quiz/logic/quiz';
import {
  PREGUNTAS_POR_TEST,
  contar,
  contarLecciones,
  explicarSorteo,
  paraAprobar,
  leccionesConEnlace,
  sortear,
  type LeccionDelTest,
} from './logic/test';

export interface PreguntaDeTest extends PreguntaDeIsla {
  leccion: string;
}

interface Props {
  /** The level's bank, already limited to published lessons. */
  preguntas: PreguntaDeTest[];
  /** Lessons of the level, to link the ones worth revisiting. */
  lecciones: LeccionDelTest[];
  caminoHref: string;
}

export default function Test({ preguntas, lecciones, caminoHref }: Props) {
  const [seleccion, setSeleccion] = useState<PreguntaDeTest[] | null>(null);
  const [estado, setEstado] = useState(() => iniciarQuiz(0));
  const [ronda, setRonda] = useState(0);
  const tarjeta = useRef<HTMLDivElement>(null);
  const primerBoton = useRef<HTMLElement>(null);
  const moverFoco = useRef(false);

  const enJuego = seleccion ?? [];
  const cantidad = seleccion ? seleccion.length : Math.min(PREGUNTAS_POR_TEST, preguntas.length);
  const minimo = Math.ceil(cantidad * UMBRAL_APROBADO);
  const numLecciones = contarLecciones(preguntas);
  const pregunta = enJuego[estado.actual];
  const elegida = estado.respuestas[estado.actual] ?? null;
  const marcas = resultados(enJuego, estado.respuestas);
  const final = nota(enJuego, estado.respuestas);
  const repasar = estado.terminado
    ? leccionesConEnlace(leccionesARepasar(enJuego, estado.respuestas), lecciones)
    : [];

  // After starting or moving on, bring the card back into view and focus its first control.
  useEffect(() => {
    if (!moverFoco.current) return;
    moverFoco.current = false;
    const caja = tarjeta.current;
    if (caja && caja.getBoundingClientRect().top < 0) caja.scrollIntoView({ block: 'start' });
    primerBoton.current?.focus({ preventScroll: true });
  }, [estado.actual, estado.terminado, ronda]);

  // Every attempt draws a new set of questions from the bank.
  const empezar = () => {
    const nuevas = sortear(preguntas);
    moverFoco.current = true;
    setSeleccion(nuevas);
    setEstado(iniciarQuiz(nuevas.length));
    setRonda((r) => r + 1);
  };
  const elegir = (i: number) => setEstado((e) => responder(e, enJuego, i));
  const seguir = () => {
    moverFoco.current = true;
    setEstado(avanzar);
  };

  const cuenta = !seleccion
    ? 'Sin empezar'
    : estado.terminado
      ? 'Terminado'
      : `Pregunta ${estado.actual + 1} de ${cantidad}`;

  let anuncio = '';
  if (estado.terminado) {
    anuncio = `Test terminado. Has acertado ${final.aciertos} de ${final.total}. ${
      final.aprobado ? 'Aprobado.' : 'No llega al aprobado.'
    }`;
  } else if (pregunta) {
    anuncio = anuncioDeRespuesta(pregunta, elegida);
  }

  return (
    <div class="quiz">
      <div class="qhead">
        <h2 id="h-test">Preguntas</h2>
        <span class="qcount">{cuenta}</span>
      </div>
      {seleccion && <Pasos marcas={marcas} actual={estado.actual} terminado={estado.terminado} />}

      <div
        class={`qcard${ronda > 0 ? ' swap' : ''}`}
        ref={tarjeta}
        key={`${ronda}-${estado.terminado ? 'fin' : estado.actual}`}
      >
        {!seleccion ? (
          <div class="summary">
            <h3>{contar(cantidad, 'pregunta', 'preguntas')} del nivel</h3>
            <p>
              {explicarSorteo(preguntas.length, numLecciones)} {paraAprobar(minimo)} Al final verás
              qué lecciones conviene repasar.
            </p>
            <div class="acts">
              <button
                class="btn btn-primary"
                type="button"
                onClick={empezar}
                ref={primerBoton as Ref<HTMLButtonElement>}
              >
                Empezar el test
                <span class="icon" aria-hidden="true">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        ) : estado.terminado ? (
          <div class="summary">
            <h3>
              Has acertado {final.aciertos} de {final.total}
            </h3>
            <p>
              {final.aprobado ? 'Aprobado.' : paraAprobar(minimo)}{' '}
              {repasar.length > 0
                ? 'Conviene repasar estas lecciones:'
                : 'Sin fallos: no hay nada que repasar.'}
            </p>
            {repasar.length > 0 && (
              <ul class="review">
                {repasar.map((leccion) => (
                  <li>
                    <span class="icon" aria-hidden="true">
                      arrow_forward
                    </span>
                    {leccion.href ? (
                      <a href={leccion.href}>{leccion.titulo}</a>
                    ) : (
                      <span>{leccion.titulo}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div class="acts">
              <a
                class="btn btn-primary"
                href={caminoHref}
                ref={primerBoton as Ref<HTMLAnchorElement>}
              >
                Volver al camino
              </a>
              <button class="btn btn-ghost" type="button" onClick={empezar}>
                <span class="icon" aria-hidden="true">
                  restart_alt
                </span>
                Repetir con otras preguntas
              </button>
            </div>
          </div>
        ) : pregunta ? (
          <TarjetaPregunta
            pregunta={pregunta}
            elegida={elegida}
            esUltima={estado.actual >= enJuego.length - 1}
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
