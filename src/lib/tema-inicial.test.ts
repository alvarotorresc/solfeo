import { describe, expect, it } from 'vitest';
import { NIVELES } from './niveles';
import { CLAVE_PROGRESO, CLAVE_TEMA } from './claves';
import { SCRIPT_TEMA_INICIAL } from './tema-inicial';

function ejecutar(guardado: Record<string, string>, fallaLectura = false): Record<string, string> {
  const dataset: Record<string, string> = {};
  const document = { documentElement: { dataset } };
  const localStorage = {
    getItem: (clave: string) => {
      if (fallaLectura) throw new Error('SecurityError');
      return guardado[clave] ?? null;
    },
  };
  new Function('document', 'localStorage', SCRIPT_TEMA_INICIAL)(document, localStorage);
  return dataset;
}

describe('SCRIPT_TEMA_INICIAL', () => {
  it('applies the saved theme and level', () => {
    const progreso = JSON.stringify({ nivel: 'avanzado', hechas: {} });
    expect(ejecutar({ [CLAVE_TEMA]: 'dark', [CLAVE_PROGRESO]: progreso })).toEqual({
      theme: 'dark',
      nivel: 'avanzado',
    });
  });

  it('ignores unknown values and corrupt progress', () => {
    expect(ejecutar({ [CLAVE_TEMA]: 'sepia', [CLAVE_PROGRESO]: '{"nivel":"experto"}' })).toEqual(
      {},
    );
    expect(ejecutar({ [CLAVE_PROGRESO]: '{roto' })).toEqual({});
  });

  it('does nothing when storage is blocked', () => {
    expect(ejecutar({}, true)).toEqual({});
  });

  it('accepts every level', () => {
    for (const nivel of NIVELES) {
      expect(ejecutar({ [CLAVE_PROGRESO]: JSON.stringify({ nivel }) }).nivel).toBe(nivel);
    }
  });
});
