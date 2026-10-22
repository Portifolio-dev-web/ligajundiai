// SEGURANÇA (varredura, item S25): nenhum lint rodava no backend — vide o frontend, mesmo achado.
// Regras mínimas (recomendadas do próprio ESLint + ambiente Node/ES2022), sem framework: o backend
// é Express puro, sem JSX/React para precisar de um preset maior.
import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // Catch em bloco try/catch vazio de propósito (ex.: logout mesmo se a API já expirou) é um
      // padrão usado várias vezes neste código — não é erro.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Convenção já usada no código: parâmetro começando com "_" é propositalmente ignorado (ex.:
      // middlewares do Express que precisam da assinatura (error, req, res, next) inteira mesmo sem
      // usar "next"). "rest sibling" ignorado = const { campo, ...resto } = obj só para EXCLUIR
      // "campo" do resultado (toPublicAthlete em utils.js), não um esquecimento.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
]
