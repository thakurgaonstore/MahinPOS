/**
 * Password verification helper with backward-compatible hashing
 */

export async function hashPassword(plainText) {
  if (!plainText) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error("Hash error:", err);
    return plainText;
  }
}

export async function verifyPassword(plainText, storedPassword) {
  if (!plainText || !storedPassword) return { matches: false };
  
  // Direct match for legacy / plain
  if (plainText === storedPassword) {
    return { matches: true, isLegacy: true };
  }

  // SHA-256 match
  const hashed = await hashPassword(plainText);
  if (hashed.toLowerCase() === storedPassword.toLowerCase()) {
    return { matches: true, isLegacy: false };
  }

  return { matches: false };
}
