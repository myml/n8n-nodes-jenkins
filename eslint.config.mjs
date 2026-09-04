import { config } from '@n8n/node-cli/eslint';

export default [
	...config,
	{
		// This node intentionally reuses n8n's built-in `jenkinsApi` credential
		// (registered by nodes-base) instead of bundling a duplicate. The package
		// therefore lists no credentials of its own, and the runtime resolves the
		// name globally. `no-credential-reuse` is disabled for this deliberate case.
		files: ['nodes/**/*.node.ts'],
		rules: {
			'@n8n/community-nodes/no-credential-reuse': 'off',
		},
	},
	{
		// Test files and the vitest config import vitest tooling. They are not
		// shipped in the published package, so `no-restricted-imports` does not
		// apply to them.
		files: ['**/*.test.ts', 'vitest.config.ts'],
		rules: {
			'@n8n/community-nodes/no-restricted-imports': 'off',
		},
	},
];
