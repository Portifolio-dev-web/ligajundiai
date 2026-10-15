export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function notFound(message = 'Recurso não encontrado') {
  return new AppError(404, 'NOT_FOUND', message)
}

export function unauthorized(message = 'Não autenticado') {
  return new AppError(401, 'UNAUTHENTICATED', message)
}

export function forbidden(message = 'Acesso não permitido') {
  return new AppError(403, 'FORBIDDEN', message)
}
