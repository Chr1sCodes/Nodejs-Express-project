// Input validation shared by the Express routes and the browser-only demo API (client/src/demoApi.js).
// Keep this module free of Node and Express imports so it can be bundled for the browser.
import { badRequest } from './errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000 per transaction

export function validateRegistration(body) {
  const errors = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!name) errors.push('name is required');
  else if (name.length > 100) errors.push('name must be 100 characters or fewer');
  if (!EMAIL_RE.test(email) || email.length > 254) errors.push('a valid email is required');
  if (password.length < 8) errors.push('password must be at least 8 characters');
  else if (password.length > 128) errors.push('password must be 128 characters or fewer');
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    errors.push('password must contain at least one letter and one number');

  return { name, email, password, errors };
}

/** Parses a dollar amount ("12.34" or 12.34) into integer cents, avoiding float drift. */
export function parseAmount(value) {
  const str = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(str);
  if (!match) throw badRequest('amount must be a positive number with at most 2 decimal places');
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (cents <= 0) throw badRequest('amount must be greater than zero');
  if (cents > MAX_AMOUNT_CENTS) throw badRequest('amount exceeds the $1,000,000 limit');
  return cents;
}

export function parseDescription(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') throw badRequest('description must be a string');
  const trimmed = value.trim();
  if (trimmed.length > 140) throw badRequest('description must be 140 characters or fewer');
  return trimmed || fallback;
}

export function parseId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${name}`);
  return id;
}

export function parseAccountNumber(value) {
  const number = String(value ?? '').replace(/\s/g, '');
  if (!/^\d{10}$/.test(number)) throw badRequest('toAccountNumber must be 10 digits');
  return number;
}
