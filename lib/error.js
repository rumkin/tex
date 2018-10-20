const Error3 = require('error3');

class TexError extends Error3 {}

class InputError extends Error3 {
  static ADDRESS_TAKEN({address}) {
    return `Address "${address}" already taken`;
  }

  static USERNAME_TAKEN({username}) {
    return `Username "${username}" already taken`;
  }
}

class AccessError extends Error3 {
  static PRIMARY_TOKEN_CREATION() {
    return 'Not enough permissions to create primary token';
  }
}

exports.TexError = TexError;
exports.InputError = InputError;
exports.AccessError = AccessError;
