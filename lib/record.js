const imm = require('./imm');

class Record {
  get defaults() {
    return this.constructor.defaults;
  }

  constructor(data = {}) {
    Object.assign(this, this.defaults, imm.copy(data));

    imm.freeze(this);
  }

  clone() {
    const clone = Object.create(this.constructor.prototype);
    Object.assign(clone, this);
    imm.freeze(clone);
    return clone;
  }

  extend(params) {
    let hasChanges = false;
    for (const prop of Object.getOwnPropertyNames(params)) {
      if (! imm.deepEqual(this[prop], params[prop])) {
        hasChanges = true;
        break;
      }
    }

    if (! hasChanges) {
      return this;
    }

    const clone = Object.create(this.constructor.prototype);
    Object.assign(clone, this, params);
    imm.freeze(clone);
    return clone;
  }

  toJSON() {
    return Object.getOwnPropertyNames(this)
    .reduce((result, prop) => ({
      ...result,
      [prop]: this[prop],
    }), {});
  }
}

[
  'get',
  'getIn',
]
.forEach((method) => {
  Record.prototype[method] = function(...args) {
    return imm[method](this, ...args);
  };
});

[
  'set',
  'update',
  'merge',
]
.forEach((method) => {
  Record.prototype[method] = function(prop, ...args) {
    if (! args.length) {
      throw new Error('Property is not set');
    }
    return this[method + 'In']([prop], ...args);
  };
});

[
  'unset',
]
.forEach((method) => {
  Record.prototype[method] = function(prop) {
    if (! prop) {
      throw new Error('Property is not set');
    }

    if (! this.hasOwnProperty(prop)) {
      return this;
    }

    const newData = {...this};
    const defaults = this.defaults;
    if (defaults && defaults.hasOwnProperty(prop)) {
      newData[prop] = defaults[prop];
    }
    else {
      delete newData[prop];
    }

    return new this.constructor(newData);
  };
});

[
  'setIn',
  'updateIn',
  'unsetIn',
  'mergeIn',
  'mapIn',
  'filterIn',
  'itemIn',
  'addLastIn',
  'addFirstIn',
  'removeLastIn',
  'removeFirstIn',
  'removeAtIn',
]
.forEach((method) => {
  Record.prototype[method] = function(path, ...args) {
    if (! path.length) {
      throw new Error('Path is empty');
    }

    const result = imm[method](this[path], path.slice(1), ...args);

    if (imm.deepEqual(this[path[0]], result)) {
      return this;
    }
    else {
      return new this.constructor({
        ...this,
        [path[0]]: result,
      });
    }
  };
});

function setDefaults(defaults) {
  return function (target) {
    target.defaults = defaults;
    return target;
  };
}

module.exports = Record;

Record.setDefaults = setDefaults;
