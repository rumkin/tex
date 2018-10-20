/**
  * Decorate class constructor function.
  * @param {Array<Function>} decorators Array of decorators.
  * @param {Function} target Decorated function.
  * @param {String} [property] Decorated property name. Optional.
  * @returns {Function} Return decorated class constructor.
  **/
function decorate(decorators, target, property) {
  if (property) {
    if (Object.hasOwnProperty(target.prototype, property)) {
      throw new Error(`Property "${property}" already defined`);
    }

    let descriptor = {value: undefined};

    for (const decorator of decorators) {
      descriptor = decorator(target, property, descriptor);
    }
    Object.defineProperty(target.prototype, property, descriptor);
  }
  else {
    for (const decorator of decorators) {
      target = decorator(target);
    }
  }

  return target;
}

exports.decorate = decorate;
