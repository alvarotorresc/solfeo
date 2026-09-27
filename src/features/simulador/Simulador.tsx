/**
 * Interview simulator island. Holds the session and moves the focus; the rules live in
 * `logic/sesion.ts`. Nothing leaves the page: no progress is saved and the notes are not stored.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Pasos from '../../components/Pasos';
import { NOMBRE_NIVEL } from '../../lib/camino';
import { NIVELES } from '../../lib/niveles';
import Eleccion from './Eleccion';
import PasoCaso from './PasoCaso';
import ResumenSesion from './ResumenSesion';
import {
  CASOS_POR_SESION,
  alternarPunto,
  avanzar,
  elegirCasos,
  iniciarSesion,
  opcionesDeSesion,
  puntuacionDeCaso,
  resumir,
  rotuloDePaso,
  type EstadoSesion,
  type OpcionDeSesion,
} from './logic/sesion';
import type { CasoDeIsla, DatosDelSimulador } from './tipos';

interface Sesion {
  casos: CasoDeIsla[];
  estado: EstadoSesion;
  /** Label of what is being practised, for the header. */
  etiqueta: string;
}

export default function Simulador({ casos, modulos, lecciones }: DatosDelSimulador) {
  const opciones = useMemo(
    () =>
      opcionesDeSesion(
        casos,
        modulos.map((m) => m.id),
        NIVELES,
      ),
    [casos, modulos],
  );
  const [elegida, setElegida] = useState(() => opciones[0]?.clave ?? '');
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [notas, setNotas] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const moverFoco = useRef(false);

  const etiqueta = (opcion: OpcionDeSesion): string => {
    if (opcion.filtro.tipo === 'mixta') return 'Sesión mixta, de todos los módulos y niveles';
    const { modulo, nivel } = opcion.filtro;
    const titulo = modulos.find((m) => m.id === modulo)?.titulo ?? modulo;
    return `${titulo}, ${NOMBRE_NIVEL[nivel]}`;
  };

  const estado = sesion?.estado;
  // One key per screen (choice, each case, summary); the focus key also changes with each step.
  const pantalla = !estado ? 'eleccion' : estado.terminada ? 'fin' : `caso-${estado.actual}`;
  const clavePantalla =
    estado && !estado.terminada
      ? `${pantalla}-${estado.paso.tipo}-${estado.paso.tipo === 'repregunta' ? estado.paso.indice : ''}`
      : pantalla;

  // Each new screen or follow-up takes the focus, so keyboard and screen reader users land on it.
  useEffect(() => {
    if (!moverFoco.current) return;
    moverFoco.current = false;
    raiz.current?.querySelector<HTMLElement>('[data-foco]')?.focus();
  }, [clavePantalla]);

  const empezar = () => {
    const opcion = opciones.find((o) => o.clave === elegida);
    if (!opcion) return;
    const elegidos = elegirCasos(casos, opcion.filtro);
    moverFoco.current = true;
    setNotas('');
    setSesion({
      casos: elegidos,
      estado: iniciarSesion(elegidos.length),
      etiqueta: etiqueta(opcion),
    });
  };

  const seguir = () => {
    if (!sesion) return;
    const nuevo = avanzar(sesion.estado, sesion.casos);
    if (nuevo.actual !== sesion.estado.actual) setNotas('');
    moverFoco.current = true;
    setSesion({ ...sesion, estado: nuevo });
  };

  const marcar = (puntoId: string) => {
    if (!sesion) return;
    setSesion({ ...sesion, estado: alternarPunto(sesion.estado, sesion.casos, puntoId) });
  };

  const otra = () => {
    moverFoco.current = true;
    setNotas('');
    setSesion(null);
  };

  if (opciones.length === 0) return null;

  const caso = sesion && estado ? sesion.casos[estado.actual] : undefined;

  return (
    <div class="sim" ref={raiz}>
      {sesion && estado && (
        <div class="qhead">
          <span class="qcount">{sesion.etiqueta}</span>
          <span class="qcount">{rotuloDePaso(estado, sesion.casos)}</span>
        </div>
      )}
      {sesion && estado && (
        <Pasos
          marcas={sesion.casos.map((_, i) => (i < estado.actual || estado.terminada ? true : null))}
          actual={estado.actual}
          terminado={estado.terminada}
        />
      )}

      <div class={sesion ? 'sim-pantalla swap' : 'sim-pantalla'} key={pantalla}>
        {!sesion || !estado ? (
          <Eleccion
            opciones={opciones}
            elegida={elegida}
            maximo={CASOS_POR_SESION}
            etiqueta={etiqueta}
            onElegir={setElegida}
            onEmpezar={empezar}
          />
        ) : estado.terminada ? (
          <ResumenSesion
            resumen={resumir(sesion.casos, estado.marcados)}
            lecciones={lecciones}
            onOtra={otra}
          />
        ) : caso ? (
          <PasoCaso
            caso={caso}
            paso={estado.paso}
            marcados={estado.marcados[estado.actual] ?? []}
            puntuacion={puntuacionDeCaso(caso, estado.marcados[estado.actual])}
            esUltimo={estado.actual === sesion.casos.length - 1}
            notas={notas}
            onNotas={setNotas}
            onMarcar={marcar}
            onAvanzar={seguir}
          />
        ) : null}
      </div>
    </div>
  );
}
