import { describe, expect, it } from 'vitest';
import { SITE_NAME, buildPageTitle } from './page-title';

describe('buildPageTitle', () => {
  it('should return the site name when no page title is given', () => {
    expect(buildPageTitle()).toBe(SITE_NAME);
  });

  it('should return the site name when the page title is blank', () => {
    expect(buildPageTitle('   ')).toBe(SITE_NAME);
  });

  it('should prefix the site name with the page title', () => {
    expect(buildPageTitle('Playground')).toBe('Playground · Solfeo');
  });

  it('should trim surrounding whitespace from the page title', () => {
    expect(buildPageTitle('  Juego  ')).toBe('Juego · Solfeo');
  });
});
