const EventEmitter = require('eventemitter3');
const lowerFirst = require('lodash.lowerfirst');
const kebabCase = require('lodash.kebabcase');
const toposort = require('toposort');

const {onStart, onStop} = require('./component');

class App extends EventEmitter {
  constructor({config, components, scope:{logger, ...scope}} = {}) {
    super();

    this._isRunning = false;
    this._isStarting = false;
    this._isStopping = false;

    this._order = [];
    this._components = components;

    const deps = [];

    for (const [name, ctor] of Object.entries(components)) {

      this[name] = new ctor(this, {
        ...ctor.configDefaults,
        ...config[lowerFirst(name)],
      }, {
        ...scope,
        logger: logger.child(kebabCase(name)),
      });

      const componentDeps = ctor.deps;

      if (componentDeps && componentDeps.length) {
        for (const dep of componentDeps) {
          if (! components.hasOwnProperty(dep)) {
            throw new Error(`Unknown dependency "${dep}" of component "${name}."`);
          }
          deps.push([name, dep]);
        }
      }

      deps.push(['app', name]);
    }

    this._order = toposort(deps).slice(1).reverse();

    this.logger = logger;
  }

  get isRunning() {
    return this._isRunning;
  }

  get isStarting() {
    return this._isStarting;
  }

  get isStopping() {
    return this._isSopping;
  }

  async start() {
    if (this._isRunning || this.isStarting) {
      throw new Error('Already started');
    }

    this.emit('start');

    this._isStarting = true;
    this.logger.info({order: this._order}, 'Starting');

    try {
      for (const name of this._order) {
        await this[name][onStart]();
      }
    }
    finally {
      this._isStarting = false;
    }

    this._isRunning = true;

    this.logger.info('Started');
    this.emit('started');
  }

  async stop() {
    if (! this.isRunning || this.isStopping) {
      return;
    }

    this._isStopping = true;

    try {
      for (const name of this._order) {
        await this[name][onStop]();
      }
    }
    finally {
      this._isStopping = false;
    }

    this._isRunning = false;

    this.logger.info('Stopped');
    this.emit('stopped');
  }
}

module.exports = App;
