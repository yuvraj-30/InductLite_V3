/**
 * Password hashing utilities using argon2
 *
 * Uses argon2id which is recommended for password hashing as it provides
 * both side-channel resistance (argon2i) and GPU cracking resistance (argon2d)
 */

import * as argon2 from "argon2";

// Argon2 configuration following OWASP recommendations
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 parallel threads
};

/**
 * Hash a password using argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a password against a hash
 * Returns true if password matches, false otherwise
 */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Invalid hash format or other error
    return false;
  }
}

/**
 * Check if a password hash needs to be rehashed
 * (e.g., if we upgrade our hashing parameters)
 */
export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
  } catch {
    return true;
  }
}
