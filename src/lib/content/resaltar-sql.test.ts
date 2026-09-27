import { describe, expect, it } from 'vitest';
import { resaltarSql } from './resaltar-sql';

describe('resaltarSql', () => {
  it('wraps SQL tokens in Prism classes', () => {
    const html = resaltarSql('SELECT nombre FROM clientes WHERE id > 20;\n');
    expect(html).toContain('<span class="token keyword">SELECT</span>');
    expect(html).toContain('<span class="token number">20</span>');
    expect(html.endsWith('\n')).toBe(false);
  });

  it('escapes HTML inside the query', () => {
    const html = resaltarSql("SELECT '<script>' AS x;");
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script>');
  });
});
