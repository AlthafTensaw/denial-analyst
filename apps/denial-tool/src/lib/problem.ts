/**
 * RFC 7807 problem-details parser for backend error responses.
 *
 * The denial-tool-service returns errors as `application/problem+json` per
 * the handoff doc. Standard fields plus backend-specific extensions:
 *   { type, title, status, detail, error_code, correlation_id, claim_id? }
 *
 * The action dispatcher in @tensaw/actions throws on non-2xx responses
 * with the raw body as the error message. This module wraps a parser so
 * mutation/query consumers can switch from string-sniffing (`message.includes
 * ('CONFIRM_LARGE_EXPORT_REQUIRED')`) to structured checks (`code === '...'`).
 *
 * Future home: @tensaw/runtime should ship this as a response interceptor
 * that wraps every error in a ProblemDetailsError. Filed as platform
 * handback (PR-4 README §Handback updates).
 */

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  /** Backend's stable error code, e.g. 'DENIAL_TOOL_CLASSIFICATION_NOT_FOUND'. */
  error_code: string;
  /** Correlation id for log lookup. */
  correlation_id?: string;
  /** Per-error extensions (claim_id, classification_id, etc.). */
  [key: string]: unknown;
}

/** Common backend error codes for switch-on-code patterns. */
export const ERROR_CODES = {
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  DENIAL_TOOL_CLASSIFICATION_NOT_FOUND:
    'DENIAL_TOOL_CLASSIFICATION_NOT_FOUND',
  DENIAL_TOOL_CLAIM_NOT_FOUND: 'DENIAL_TOOL_CLAIM_NOT_FOUND',
  DENIAL_TOOL_CLAIM_HAS_NO_DENIAL_EVENTS:
    'DENIAL_TOOL_CLAIM_HAS_NO_DENIAL_EVENTS',
  DENIAL_TOOL_COST_QUERY_INVALID: 'DENIAL_TOOL_COST_QUERY_INVALID',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
} as const;

/**
 * Heuristic check that an unknown payload looks like a problem-details body.
 * The action dispatcher passes us whatever it got — string, object,
 * sometimes already-parsed JSON. Be defensive.
 */
export function isProblemDetails(v: unknown): v is ProblemDetails {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.status === 'number' &&
    typeof o.error_code === 'string'
  );
}

/**
 * Parse an Error thrown by useActionMutation/useActionQuery into a
 * ProblemDetails when possible. Falls back to null when the error
 * doesn't look like one (network error, parse error, etc.).
 *
 * Action-dispatcher convention: error.message contains the response
 * body as text (sometimes JSON-stringified, sometimes a structured
 * object cast through String()). We try both.
 */
export function parseProblemDetails(err: unknown): ProblemDetails | null {
  if (isProblemDetails(err)) return err;
  if (!(err instanceof Error)) return null;

  // The dispatcher might have already parsed the body and attached it
  // to a `.cause` or `.body` field. Check those first.
  const e = err as Error & { cause?: unknown; body?: unknown };
  if (isProblemDetails(e.cause)) return e.cause;
  if (isProblemDetails(e.body)) return e.body;

  // Try to JSON-parse the message.
  try {
    const parsed = JSON.parse(err.message);
    if (isProblemDetails(parsed)) return parsed;
  } catch {
    // Not JSON — fall through.
  }
  return null;
}

/**
 * Friendlier message for known error codes. Falls back to the
 * problem-details `detail`, then the raw error message.
 */
export function friendlyErrorMessage(err: unknown): string {
  const pd = parseProblemDetails(err);
  if (pd) {
    switch (pd.error_code) {
      case ERROR_CODES.AUTH_TOKEN_MISSING:
      case ERROR_CODES.AUTH_TOKEN_INVALID:
        return 'Your session has expired. Please sign in again.';
      case ERROR_CODES.AUTH_FORBIDDEN:
        return 'You do not have permission for this action.';
      case ERROR_CODES.INVALID_STATE_TRANSITION:
        return `This row is no longer in a state where that action is allowed. ${pd.detail}`;
      case ERROR_CODES.DENIAL_TOOL_CLASSIFICATION_NOT_FOUND:
        return 'This recommendation no longer exists. The worklist may be out of date.';
      case ERROR_CODES.DENIAL_TOOL_CLAIM_NOT_FOUND:
        return pd.detail;
      case ERROR_CODES.DENIAL_TOOL_CLAIM_HAS_NO_DENIAL_EVENTS:
        return 'Cannot re-classify: this claim has no denial events.';
      case ERROR_CODES.DENIAL_TOOL_COST_QUERY_INVALID:
        return pd.detail;
      default:
        return pd.detail;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Returns true when the error indicates the user's session is gone.
 * Callers use this to trigger sign-out.
 */
export function isAuthError(err: unknown): boolean {
  const pd = parseProblemDetails(err);
  if (!pd) return false;
  return (
    pd.error_code === ERROR_CODES.AUTH_TOKEN_MISSING ||
    pd.error_code === ERROR_CODES.AUTH_TOKEN_INVALID
  );
}
