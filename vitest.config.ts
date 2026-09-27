/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/features/**/logic/**/*.ts', 'scripts/**/*.ts'],
      // The content:check entry point only wires files to the tested validator and prints its report.
      exclude: ['**/*.test.ts', '**/*.d.ts', 'scripts/validate-content.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
