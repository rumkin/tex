const fs = require('fs');
const path = require('path');
const {promisify}  = require('util');

const Component = require('../lib/component');
const {decorate} = require('../lib/decorator');
const {Db} = require('../lib/imm/db');

const fsExists = promisify(fs.exists);
const fsWriteFile = promisify(fs.writeFile);
const fsReadFile = promisify(fs.readFile);

class DbAdapter extends Component {

  // # Instance params

  get dbPath() {
    return path.resolve(this.config.dbPath);
  }

  // # Component methods

  async [Component.onStart]() {
    super[Component.onStart]();

    const {dbPath} = this;
    let data;

    if (await fsExists(dbPath)) {
      this.logger.log({dbPath}, 'Db file exists');

      const rawData = await fsReadFile(dbPath);
      this.logger.info({dbPath}, 'Db file loaded');

      try {
        data = JSON.parse(rawData);
        this.logger.info('Db data parsed');
      }
      catch (err) {
        this.logger.info('Db data corrupted');
        throw new Error('Invalid db data');
      }
    }
    else {
      this.logger.info({dbPath}, 'Db file not found. Create new');

      data = {
        version: 0,
        data: {},
      };
    }

    this.db = new Db();
    this.db.open(data);
    this.logger.info('DB closed');
  }

  async [Component.onStop]() {
    super[Component.onStop]();

    // Write data on disk.
    await this.saveData(this.db.toJSON());
    this.logger.info({dbPath: this.dbPath}, 'Db file saved');

    this.db.close();
    this.db = null;

    this.logger.info('DB closed');
  }

  // # Service methods

  saveData(data) {
    return fsWriteFile(this.dbPath, JSON.stringify(data, true, 2));
  }

  async sync() {
    this.db.sync();
  }

  bucket(name) {
    return this.db.bucket(name);
  }

  get version() {
    return this.db.version;
  }
}

module.exports = decorate([
  Component.setDeps(),
  Component.setDefaults({
    dbPath: './db.json',
    autosave: true,
    autosaveInterval: 10000,
  }),
], DbAdapter);
