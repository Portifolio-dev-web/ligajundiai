import { toast } from 'sonner'

// ACESSIBILIDADE (varredura, item F1): a duração padrão da biblioteca (~4s) ficava abaixo do
// mínimo recomendado — sucesso 5s, erro 10s — arriscando que a mensagem (principalmente a de erro)
// desaparecesse antes de ser lida. toast.success/toast.error continuam disponíveis para quem
// precisar de outro comportamento; estes wrappers só fixam a duração mínima.
export const toastSuccess = (message, options) => toast.success(message, { duration: 5000, ...options })
export const toastError = (message, options) => toast.error(message, { duration: 10000, ...options })
