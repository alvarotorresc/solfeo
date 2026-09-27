import { describe, expect, it } from 'vitest';
import { extractSqlBlocks, parseFenceInfo } from './sql-blocks';

describe('parseFenceInfo', () => {
  it('reads the language and bare, quoted and flag attributes', () => {
    const { lang, attrs } = parseFenceInfo('SQL id=q1 no-ejecutar motivo="Solo PostgreSQL"');
    expect(lang).toBe('sql');
    expect(attrs.get('id')).toBe('q1');
    expect(attrs.get('no-ejecutar')).toBe(true);
    expect(attrs.get('motivo')).toBe('Solo PostgreSQL');
  });

  it('handles an empty info string', () => {
    expect(parseFenceInfo('')).toEqual({ lang: '', attrs: new Map() });
  });
});

describe('extractSqlBlocks', () => {
  const markdown = [
    '# Título',
    '',
    '```sql id=q1',
    'SELECT 1;',
    '```',
    '',
    '```js',
    'const a = 1;',
    '```',
    '',
    '~~~sql no-ejecutar motivo="PostgreSQL"',
    'SELECT now()::date;',
    '~~~',
    '',
    '```sql',
    'SELECT 2;',
    '```',
  ].join('\n');

  it('returns only sql blocks, with their attributes and line', () => {
    expect(extractSqlBlocks(markdown)).toEqual([
      { id: 'q1', executable: true, code: 'SELECT 1;', line: 3 },
      { executable: false, reason: 'PostgreSQL', code: 'SELECT now()::date;', line: 11 },
      { executable: true, code: 'SELECT 2;', line: 15 },
    ]);
  });

  it('keeps a block that is never closed until the end of the document', () => {
    expect(extractSqlBlocks('```sql id=q2\nSELECT 3;\n')).toEqual([
      { id: 'q2', executable: true, code: 'SELECT 3;', line: 1 },
    ]);
  });

  it('does not treat a longer fence as closed by a shorter one', () => {
    const nested = '````sql id=q1\nSELECT 1;\n```\n````';
    expect(extractSqlBlocks(nested)[0]?.code).toBe('SELECT 1;\n```');
  });
});
