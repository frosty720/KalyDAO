import { defineConfig } from 'vitest/config';
import path from 'path';

// Standalone Vitest config so the test runner doesn't pull in the app's
// Vite/Tempo plugins. Unit tests target pure logic under src/.
export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
	},
});
