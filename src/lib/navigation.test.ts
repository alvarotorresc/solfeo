import { describe, expect, it } from 'vitest';
import { isCurrentPath } from './navigation';

describe('isCurrentPath', () => {
  it('should match identical paths', () => {
    expect(isCurrentPath('/juego', '/juego')).toBe(true);
  });

  it('should match when the current path has a trailing slash', () => {
    expect(isCurrentPath('/juego/', '/juego')).toBe(true);
  });

  it('should match the root path', () => {
    expect(isCurrentPath('/', '/')).toBe(true);
  });

  it('should not match a different path', () => {
    expect(isCurrentPath('/juego/', '/simulador')).toBe(false);
  });

  it('should not treat the root as a prefix of other paths', () => {
    expect(isCurrentPath('/juego/', '/')).toBe(false);
  });
});
