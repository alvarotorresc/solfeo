import { describe, expect, it, vi } from 'vitest';

const { crear, render } = vi.hoisted(() => ({ crear: vi.fn(), render: vi.fn() }));
vi.mock('@astrojs/markdown-satteri', () => ({ createSatteriMarkdownProcessor: crear }));

const { renderizarMarkdown } = await import('./markdown');

describe('renderizarMarkdown when the processor fails to start', () => {
  it('does not keep the failure cached and tries again', async () => {
    crear.mockRejectedValueOnce(new Error('sin motor'));
    crear.mockResolvedValueOnce({ render });
    render.mockResolvedValueOnce({ code: '<p>ok</p>' });

    await expect(renderizarMarkdown('x', 'prueba')).rejects.toThrow('prueba: sin motor');
    await expect(renderizarMarkdown('x', 'prueba')).resolves.toBe('<p>ok</p>');
    expect(crear).toHaveBeenCalledTimes(2);
  });

  it('names errors that are not Error objects', async () => {
    // The processor started in the previous test stays cached.
    render.mockRejectedValueOnce('roto');
    await expect(renderizarMarkdown('x', 'prueba')).rejects.toThrow('prueba: roto');
  });
});
