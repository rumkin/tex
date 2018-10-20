const EventEmitter = require('eventemitter3');

const NONE = 'NONE';
const ERROR = 'ERROR';
const WARNING = 'WARNING';
const LOG = 'LOG';
const INFO = 'INFO';
const DEBUG = 'DEBUG';

const LEVELS = {
  [NONE]: 0,
  [ERROR]: 10,
  [WARNING]: 20,
  [LOG]: 30,
  [INFO]: 40,
  [DEBUG]: 50,
};

function consoleReport({level, ...entry}) {
  switch (level) {
  case ERROR: {
    console.error(entry);
    break;
  }
  case INFO: {
    console.info(entry);
    break;
  }
  case WARNING: {
    console.warn(entry);
    break;
  }
  case DEBUG: {
    console.debug(entry);
    break;
  }
  default:
    console.log(entry);
  }
}

class Logger extends EventEmitter {
  constructor({
    name = 'app',
    reporters = [{
      level: DEBUG,
      report: consoleReport,
    }],
  } = {}) {
    super();

    this.name = name;
    this.reporters = reporters;
    this.on('log', (entry) => {
      for (const {level, report} of this.reporters) {
        if (LEVELS[level] >= LEVELS[entry.level]) {
          report(entry);
        }
      }
    });
  }

  child(name) {
    return new Logger({
      name: `${this.name}:${name}`,
      reporters: [...this.reporters],
    });
  }

  normalizeArgs(args) {
    let msg, params;
    if (args.length > 1) {
      params = args[0];
      msg = args[1];
    }
    else if (typeof args[0] === 'string') {
      msg = args[0];
      params = {};
    }
    else {
      params = args[0];
      msg = params.msg || '';
    }

    return {msg, params};
  }

  info(...args) {
    this.output(INFO, args);
  }

  log(...args) {
    this.output(LOG, args);
  }

  error(...args) {
    this.output(ERROR, args);
  }

  debug(...args) {
    this.output(DEBUG, args);
  }

  warn(...args) {
    this.output(WARNING, args);
  }

  output(level, args) {
    const {msg, params} = this.normalizeArgs(args);

    const entry = {
      ...params,
      name: this.name,
      msg,
      level,
      time: new Date(),
    };

    this.emit('log', entry);
  }
}

module.exports = Logger;
exports.NONE = NONE;
exports.ERROR = ERROR;
exports.WARNING = WARNING;
exports.LOG = LOG;
exports.INFO = INFO;
exports.DEBUG = DEBUG;
exports.LEVELS = LEVELS;
exports.consoleReport = consoleReport;
