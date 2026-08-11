'use strict';

const crypto = require('crypto');

/** scrypt hashing — no bcrypt dependency, constant-time comparison. */
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, expectedHash) {
  const attempt = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return attempt.length === expected.length && crypto.timingSafeEqual(attempt, expected);
}

module.exports = { hashPassword, verifyPassword };