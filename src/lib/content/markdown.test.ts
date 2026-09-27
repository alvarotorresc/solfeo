import { describe, expect, it } from 'vitest';
import { renderizarMarkdown } from './markdown';

describe('renderizarMarkdown', () => {
  it('renders prose and inline code', async () => {
    const html = await renderizarMarkdown('**Faltan** clientes: usa `LEFT JOIN`.', 'prueba');
    expect(html).toContain('<strong>Faltan</strong>');
    expect(html).toContain('<code>LEFT JOIN</code>');
  });

  it('frames SQL blocks and highlights them with Prism', async () => {
    const html = await renderizarMarkdown(
      "```sql\nSELECT nombre FROM clientes WHERE ciudad = '<b>';\n```",
      'prueba',
    );
    expect(html).toContain('<figure class="code">');
    expect(html).toContain('data-copy');
    expect(html).toContain('class="token keyword"');
    // The code is escaped, never parsed as markup.
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('emits no inline styles, which the CSP would block: table alignment becomes a class', async () => {
    const html = await renderizarMarkdown(
      '| a | b | c | d |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |\n\n```sql\nSELECT 1;\n```',
      'prueba',
    );
    expect(html).toContain('<table>');
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).toContain('<th class="align-left">a</th>');
    expect(html).toContain('<td class="align-center">2</td>');
    expect(html).toContain('<td class="align-right">3</td>');
    expect(html).toContain('<td>4</td>');
  });

  it('rejects raw HTML and names the content', async () => {
    await expect(
      renderizarMarkdown('Hola\n\n<script>alert(1)</script>', 'bd-f-caso-99'),
    ).rejects.toThrow(/bd-f-caso-99: El Markdown no admite HTML crudo: <script>/);
    await expect(renderizarMarkdown('Texto <b onclick="x()">x</b>', 'prueba')).rejects.toThrow(
      /HTML crudo/,
    );
  });

  it.each([
    ['a language that breaks out of the attribute', '```"><svg/onload=alert(1)>\nx\n```'],
    ['a language that adds attributes', '```sql"onmouseover="alert(1)\nx\n```'],
    ['a javascript: link', '[x](javascript:alert(1))'],
    ['a javascript: link written with entities', '[x](java&#x73;cript:alert(1))'],
    ['an uppercase JavaScript: link', '[x](JavaScript:alert(1))'],
    ['a javascript: autolink', '<javascript:alert(1)>'],
    ['a javascript: reference definition', '[x][r]\n\n[r]: javascript:alert(1)'],
    ['a javascript: image', '![i](javascript:alert(1))'],
    ['a vbscript: link', '[x](vbscript:msgbox(1))'],
    ['a data: link', '[x](data:text/html,x)'],
    ['a data: image', '![i](data:image/png;base64,AAAA)'],
    ['an HTML comment', 'Texto\n\n<!-- x -->'],
  ])('rejects %s', async (_, markdown) => {
    await expect(renderizarMarkdown(markdown, 'prueba')).rejects.toThrow(/^prueba: /);
  });

  it('accepts relative, https, mailto and anchor links and plain SQL blocks', async () => {
    const html = await renderizarMarkdown(
      '[a](/ruta) [b](https://example.com) [c](#ancla) [d](mailto:a@b.es) [e](otra/pagina)\n\n' +
        '```sql\nSELECT 1;\n```',
      'prueba',
    );
    expect(html).toContain('href="/ruta"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="#ancla"');
    expect(html).toContain('href="mailto:a@b.es"');
    expect(html).toContain('href="otra/pagina"');
    expect(html).toContain('data-language="sql"');
  });

  it('accepts the lesson fence meta and never writes it to the HTML', async () => {
    const html = await renderizarMarkdown(
      '```sql id=q1\nSELECT 1;\n```\n\n' +
        '```sql no-ejecutar motivo="\\"><script>alert(1)</script>"\nSELECT 2;\n```',
      'prueba',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('q1');
    expect(html).not.toContain('motivo');
    expect(html.match(/<figure class="code">/g)).toHaveLength(2);
  });
});
