module.exports = {
	'root': true,
	'ignorePatterns': ['src/app/3D/lib', 'bin/', '*.js'],
	'parser': '@typescript-eslint/parser',
	'parserOptions': {
		'ecmaVersion': 'latest',
		'sourceType': 'module'
	},
	'env': {
		'node': true,
		'es2020': true,
		'browser': true
	},
	'rules': {
		'@typescript-eslint/no-explicit-any': ['warn', { 'ignoreRestArgs': true }],
		'@typescript-eslint/no-inferrable-types': 'off',
		'@typescript-eslint/type-annotation-spacing': 'warn',
		'@typescript-eslint/space-infix-ops': 'warn',
		'@typescript-eslint/explicit-function-return-type': 'warn',
		'no-debugger': 'warn',
		'indent': ['error', 'tab', { 'SwitchCase': 1 }],
		'linebreak-style': ['error', process.platform === 'win32' ? 'windows' : 'unix'],
		'quotes': ['error', 'single'],
		'semi': ['error', 'always'],
		'space-before-blocks': 'error',
		'brace-style': ['error', '1tbs'],
		'curly': [2, 'multi-or-nest', 'consistent'],
		'no-trailing-spaces': 'error',
		'keyword-spacing': 'error'
	},
	'plugins': [
		'vue',
		'@typescript-eslint'
	],
	'extends': [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:vue/base'
	]
};