// @ts-check
import { satteri } from '@astrojs/markdown-satteri';
import preact from '@astrojs/preact';
import { createHash } from 'node:crypto';
import { defineConfig } from 'astro/config';
import { PLUGINS_MARKDOWN, RESALTADO } from './src/lib/content/markdown-opciones.ts';
import { SCRIPT_TEMA_INICIAL } from './src/lib/tema-inicial.ts';

/**
 * CSP hash of an inline script Astro does not bundle, so it cannot hash it on its own.
 * @param {string} codigo
 * @returns {`sha256-${string}`}
 */
const hashDe = (codigo) => `sha256-${createHash('sha256').update(codigo).digest('base64')}`;

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  output: 'static',
  integrations: [preact()],
  markdown: {
    // Shiki emits inline styles, which the CSP below would block; Prism uses classes instead.
    syntaxHighlight: RESALTADO,
    processor: satteri(PLUGINS_MARKDOWN),
  },
  vite: {
    // Never inline assets as data: URIs. The icon font is under the default 4 KB limit and the
    // CSP (default-src 'self') would block it as a data: font.
    build: { assetsInlineLimit: 0 },
  },
  security: {
    // Emits a CSP <meta> per page with hashes for the scripts and styles Astro bundles.
    // Directives that a <meta> cannot carry (frame-ancestors) live in netlify.toml.
    // Fonts are self-hosted, so `default-src 'self'` covers them.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        hashes: [hashDe(SCRIPT_TEMA_INICIAL)],
      },
    },
  },
});
