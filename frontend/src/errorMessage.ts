import { ApiError } from './api'

interface ValidationIssue {
  loc?: unknown
  msg?: unknown
}

function isValidationIssues(detail: unknown): detail is ValidationIssue[] {
  return Array.isArray(detail)
}

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (typeof error.detail === 'string') {
      return error.detail
    }
    if (isValidationIssues(error.detail)) {
      return error.detail
        .map((issue) => (typeof issue.msg === 'string' ? issue.msg : null))
        .filter((msg): msg is string => msg !== null)
        .join(', ')
    }
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong'
}
