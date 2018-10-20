const EventEmitter = require('eventemitter3');

const {decorate} = require('./decorator');

const onStart = Symbol('START');
const onStop = Symbol('STOP');
const isStarted = Symbol('IS_STARTED');

class Component extends EventEmitter {
  constructor(app, config = {}, {logger}) {
    super();

    this.app = app;
    this.config = config;
    this.logger = logger;
  }

  [onStart]() {
    if (this[isStarted]) {
      throw new Error('Component already started');
    }

    this[isStarted] = true;
  }

  [onStop]() {
    this[isStarted] = false;
  }
}

// export function params(...args) {
//   return function(target, name, descriptor) {
//     target.argsTypes = args;
//
//     return target;
//   };
// }
//
// export function result(resultType) {
//   return function(target, name, descriptor) {
//
//   };
// }

function setDeps(...dependencies) {
  return function(target) {
    target.deps = dependencies;
    return target;
  };
}

function setDefaults(configDefaults) {
  return function(target) {
    target.configDefaults = configDefaults;
    return target;
  };
}

module.exports = decorate([
  setDeps(),
  setDefaults({}),
], Component);

Component.onStart = onStart;
Component.onStop = onStop;
Component.setDeps = setDeps;
Component.setDefaults = setDefaults;
