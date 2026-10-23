// An error whose message is safe to show to the user.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Turns any error into { status, message }. Raw database messages are never sent to the browser.
export function toClientError(error) {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  if (error.code === 'ER_DUP_ENTRY') return { status: 409, message: 'That record already exists.' };
  if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || error.code === 'ER_NO_REFERENCED_ROW_2') {
    return { status: 400, message: 'Some of the values are not allowed. Please check them and try again.' };
  }
  console.error('Unexpected error:', error.code || error.message);
  return { status: 503, message: 'Something went wrong. Please try again in a moment.' };
}

// Small input checks used by the write operations.
export function requireText(value, label, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, `${label} is required.`);
  if (text.length > max) throw new HttpError(400, `${label} must be at most ${max} characters.`);
  return text;
}

export function optionalText(value, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > max) throw new HttpError(400, `Text must be at most ${max} characters.`);
  return text || null;
}

export function requireInt(value, label, { min = 1, max = 2147483647 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, `${label} must be a whole number between ${min} and ${max}.`);
  }
  return number;
}

export function requireMoney(value, label) {
  const number = Number(value);
  if (value === '' || value === null || !Number.isFinite(number) || number < 0 || number > 99999999) {
    throw new HttpError(400, `${label} must be a valid amount.`);
  }
  return Math.round(number * 100) / 100;
}
