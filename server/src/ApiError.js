'use strict';

/** HTTP-aware error so services can throw meaningful statuses. */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { ApiError };