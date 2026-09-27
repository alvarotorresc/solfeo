import { describe, expect, it } from 'vitest';
import { esPublicable, soloRevisado } from './publicables';

describe('soloRevisado', () => {
  it('is on only when SOLFEO_SOLO_REVISADO is exactly 1', () => {
    expect(soloRevisado({ SOLFEO_SOLO_REVISADO: '1' })).toBe(true);
    expect(soloRevisado({ SOLFEO_SOLO_REVISADO: '0' })).toBe(false);
    expect(soloRevisado({ SOLFEO_SOLO_REVISADO: 'true' })).toBe(false);
    expect(soloRevisado({})).toBe(false);
  });
});

describe('esPublicable', () => {
  it('publishes drafts while the filter is off', () => {
    expect(esPublicable('borrador', false)).toBe(true);
    expect(esPublicable('revisado', false)).toBe(true);
  });

  it('publishes only reviewed content when the filter is on', () => {
    expect(esPublicable('borrador', true)).toBe(false);
    expect(esPublicable('revisado', true)).toBe(true);
  });
});
