/**
 * Utility to extract user-facing, actionable error messages from Axios / API errors.
 * Explicitly distinguishes HTTP status codes (401, 403, 404, 409, 422, 429, 500)
 * from genuine network or server connectivity failures.
 */
export function formatApiErrorMessage(error: any, defaultContext: string = 'Operation failed'): string {
  if (!error) return defaultContext;

  // No HTTP response received (Network failure, CORS rejection, or Render cold start timeout)
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'Request timed out. The backend server might be cold-starting on Render. Please retry in a moment.';
    }
    if (error.message === 'Network Error') {
      return 'Network Error: Unable to reach backend service. Please check your internet connection or backend server status.';
    }
    return error.message || `${defaultContext}: Network connection error`;
  }

  const { status, data } = error.response;
  const detail = data?.detail;

  // Format Pydantic 422 validation errors array
  let formattedDetail = '';
  if (Array.isArray(detail)) {
    formattedDetail = detail
      .map((d: any) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((l: any) => l !== 'body').join('.') : '';
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join('; ');
  } else if (typeof detail === 'string') {
    formattedDetail = detail;
  } else if (typeof data?.message === 'string') {
    formattedDetail = data.message;
  }

  switch (status) {
    case 400:
      return formattedDetail || `${defaultContext}: Invalid request parameters.`;
    case 401:
      return formattedDetail || 'Session expired or unauthenticated. Please log in again.';
    case 403:
      return formattedDetail || 'Access denied: You do not have permission to perform this action.';
    case 404:
      return formattedDetail || 'Requested resource was not found.';
    case 409:
      return formattedDetail || 'Conflict: This record or resource already exists.';
    case 422:
      return formattedDetail ? `Validation error: ${formattedDetail}` : 'Validation failed: Check input fields.';
    case 429:
      return 'Rate limit exceeded. Please wait a few moments before retrying.';
    case 500:
    case 502:
    case 503:
    case 504:
      return formattedDetail ? `Server error: ${formattedDetail}` : 'Backend server error. The engineering team has been notified.';
    default:
      return formattedDetail || error.message || defaultContext;
  }
}
