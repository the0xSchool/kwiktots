import { ApiError } from './api'
import type { FieldErrors } from './components/NoteEditor'

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

export function fieldErrorsFor(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || !isValidationIssues(error.detail)) {
    return {}
  }

  const fieldErrors: FieldErrors = {}
  for (const issue of error.detail) {
    const loc = Array.isArray(issue.loc) ? issue.loc : []
    const field = loc[loc.length - 1]
    const msg = typeof issue.msg === 'string' ? issue.msg : 'Invalid value'
    if (field === 'title') {
      fieldErrors.title = msg
    } else if (field === 'body') {
      fieldErrors.body = msg
    }
  }
  return fieldErrors
}
