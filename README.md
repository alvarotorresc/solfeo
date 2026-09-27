# Solfeo

> Teoría de la ingeniería de software, en español y módulo a módulo.

## Qué es

Solfeo es una web estática y gratuita para aprender la teoría de la ingeniería de software. Los
temas van en módulos, uno detrás de otro, y cada lección acaba con unas preguntas de repaso.

No hace falta registrarse. La web no tiene servidor propio y lo que llevas hecho se queda
guardado en tu navegador.

## Tech Stack

- Framework: [Astro](https://astro.build) con salida estática
- Lenguaje: TypeScript
- Tests: Vitest
- Hosting: Netlify

## Desarrollo local

### Requisitos previos

- Node.js >= 22.12
- pnpm 10 (la versión exacta está en el campo `packageManager` de `package.json`)

### Instalación

```bash
pnpm install
pnpm dev
```

La web queda en `http://localhost:4321`.

## Scripts disponibles

| Comando              | Descripción                                   |
| -------------------- | --------------------------------------------- |
| `pnpm dev`           | Servidor de desarrollo                        |
| `pnpm build`         | Build de producción en `dist/`                |
| `pnpm preview`       | Sirve el build de producción en local         |
| `pnpm lint`          | ESLint                                        |
| `pnpm format`        | Formatea el código con Prettier               |
| `pnpm format:check`  | Comprueba el formato sin cambiar nada         |
| `pnpm typecheck`     | Comprobación de tipos con `astro check`       |
| `pnpm test`          | Tests con Vitest                              |
| `pnpm test:coverage` | Tests con informe de cobertura (umbral: 85 %) |

## Licencia

Código y contenido bajo [GNU AGPL-3.0 o posterior](./LICENSE) (`AGPL-3.0-or-later`).
