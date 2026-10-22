// SEGURANÇA (varredura, item S25): nenhum lint rodava em lugar nenhum — nem local, nem no CI, nem
// no build ("next build" sem ESLint instalado não checa regra de código nenhuma, só faz parecer que
// checa). Formato "flat config" (eslint.config.mjs) porque é o que o ESLint 9 usa por padrão;
// FlatCompat só serve para reaproveitar o preset "next/core-web-vitals" (ainda publicado no formato
// antigo) dentro desse formato novo.
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: ['.next/**', 'node_modules/**', 'backend/**'],
  },
]

export default eslintConfig
