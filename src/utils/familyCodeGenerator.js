/**
 * Family Invite Code Generator
 * Format: FAM-XXXXXX (6 alphanumeric chars, uppercase)
 */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0,O,1,I)

export const generateFamilyCode = () => {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return `FAM-${code}`;
};

export const validateFamilyCode = (code) => {
  if (!code) return false;
  const pattern = /^FAM-[A-Z2-9]{6}$/;
  return pattern.test(code.toUpperCase());
};

export const formatFamilyCode = (code) => {
  // Remove FAM- prefix if present, clean input, re-add prefix
  const cleaned = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return cleaned.length === 6 ? `FAM-${cleaned}` : code;
};