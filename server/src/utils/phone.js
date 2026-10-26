/**
 * Normalizes a phone number by stripping whitespace, hyphens, parentheses.
 * Preserves leading + if present.
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Validates international phone number format.
 * Must start with + and contain between 8 and 15 digits (E.164 standard).
 * Country codes start with digits 1-9.
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!trimmed.startsWith('+')) return false;
  const normalized = normalizePhone(trimmed);
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}

/**
 * Converts phone number to WhatsApp JID format (e.g. 919876543210@c.us).
 * @param {string} phone
 * @returns {string}
 */
export function toWhatsAppJid(phone) {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@c.us`;
}

/**
 * Masks a phone number for UI display and logs to preserve privacy.
 * Example: "+919876543210" -> "+91 98****3210"
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const clean = phone.trim();
  if (clean.length < 8) return clean;

  const firstChars = clean.slice(0, 5);
  const lastChars = clean.slice(-4);
  return `${firstChars}****${lastChars}`;
}

export default {
  normalizePhone,
  isValidPhone,
  toWhatsAppJid,
  maskPhone
};
