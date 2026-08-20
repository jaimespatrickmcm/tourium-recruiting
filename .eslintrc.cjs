// Config do ESLint. O projeto tinha o script `npm run lint` e os plugins
// instalados desde o inicio, mas nenhum arquivo de config: o lint nunca rodou de
// verdade, so falhava dizendo que nao achou configuracao.
//
// Isso custou uma queda em producao. Um useEffect adicionado abaixo de um return
// antecipado derrubou a pagina da vaga inteira com o React #310. Nem o build nem
// o tsc pegam isso, porque ordem de hooks e regra de runtime do React. A regra
// react-hooks/rules-of-hooks pega, e estava instalada aqui o tempo todo.
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  // Edge functions sao Deno (imports jsr:/npm:, Deno global) e nao passam pelo
  // parser configurado aqui. Elas tem o proprio check no deploy.
  ignorePatterns: ['dist', 'node_modules', 'supabase/functions', '*.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-refresh'],
  rules: {
    // O motivo desta config existir. Erro, nunca warning: hook fora de ordem
    // nao degrada a tela, derruba ela.
    'react-hooks/rules-of-hooks': 'error',
    // Dependencia faltando costuma ser bug de verdade, mas tem falso positivo
    // demais pra travar build num codigo que nunca foi lintado.
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Configs de build rodam em Node e usam require() de propósito
      // (tailwindcss/plugin). Nao sao codigo de aplicacao.
      files: ['tailwind.config.ts', 'vite.config.ts', 'postcss.config.js'],
      rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
  ],
};
