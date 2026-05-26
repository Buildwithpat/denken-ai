import { ValidationResult } from './testValidator';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\d{10}$/;

export function validateSignup(body: Record<string, unknown>): ValidationResult {
  const { name, email, mobileNumber, password } = body;

  if (typeof name !== 'string' || name.trim().length < 2) {
    return { valid: false, error: '"name" must be at least 2 characters.' };
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return { valid: false, error: '"email" must be a valid email address.' };
  }
  if (typeof mobileNumber !== 'string' || !MOBILE_RE.test(mobileNumber)) {
    return { valid: false, error: '"mobileNumber" must be a 10-digit number.' };
  }
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, error: '"password" must be at least 8 characters.' };
  }

  return { valid: true };
}

export function validateLogin(body: Record<string, unknown>): ValidationResult {
  const { email, password } = body;

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return { valid: false, error: '"email" must be a valid email address.' };
  }
  if (typeof password !== 'string' || !password) {
    return { valid: false, error: '"password" is required.' };
  }

  return { valid: true };
}
