const Component = require('../lib/component');
const {decorate} = require('../lib/decorator');

const {InputError, AccessError} = require('../lib/error');
const {at} = require('../lib/modify');
const {
  ROLES,
  createAccount,
  isSuperuser,
} = require('../models/account');
const {
  createBalance,
} = require('../models/balance');

class AccountsService extends Component {
  async [Component.onStart]() {
    const {Db} = this.app;

    const hasSuperuser = await Db.bucket('accounts').hasMatches({
      role: {$in: ['owner', 'admin']},
    });

    this.hasSuperuser = hasSuperuser;
  }

  getById(id) {
    const account = this.findById(id);

    if (! account) {
      throw new InputError('not_found', {
        entity: 'account',
        id,
      });
    }

    return account;
  }

  findById(id) {
    const {Db} = this.app;

    return Db.bucket('accounts').findById(id);
  }

  findOneBy(query) {
    const {Db} = this.app;

    return Db.bucket('accounts').findOne(query);
  }

  findByAddress(address) {
    return this.findOneBy({address});
  }

  listById(ids) {
    const {Db} = this.app;

    return Db.bucket('accounts').find({
      _id: {$in: ids},
    });
  }

  async create({actor}, {address, username, name = null, role = 'user'}) {
    const {Db} = this.app;

    const bucket = Db.bucket('accounts');

    // TODO Check signature

    const addressExists = await bucket.hasMatches({address});

    if (addressExists) {
      throw new InputError('address_taken', {address});
    }

    let _username = null;
    if (username) {
      _username = username.toLowerCase();

      const usernameExists = await bucket.hasMatches({
        _username,
      });

      if (usernameExists) {
        throw new InputError('username_taken', {username});
      }
    }

    if (! ROLES.hasOwnProperty(role.toUpperCase())) {
      throw new InputError('role_unknown', {role});
    }
    else if (role !== ROLES.USER && (! actor || ! isSuperuser(actor))) {
      if (this.hasSuperuser) {
        throw new AccessError('role_violation', {
          role,
        });
      }
    }

    const account = await bucket.createOne(createAccount({
      address,
      username,
      role,
      name,
    }));

    // Add new balances for account
    const tokens = await Db.bucket('tokens').find({
      deletedAt: null,
    });

    await Db.bucket('balances').create(tokens.map(({id}) => createBalance({
      token: id,
      owner: account.id,
    })));

    this.logger.info({username}, 'account created');
    this.emit('created', account);

    return account;
  }

  async createDriven({actor}, {ownerId, name}) {
    const {Db} = this.app;
    const bucket = Db.bucket('accounts');

    if (ownerId) {
      const ownerExists = await bucket.hasMatches({id: ownerId});

      if (! ownerExists) {
        throw new InputError('not_found', {
          entity: 'account',
          id: owner,
        });
      }
    }
    else {
      ownerId = actor.id;
    }

    const account = await bucket.createOne(createAccount({
      name,
      ownedBy: ownerId,
    }));

    // Add new balances for account
    const tokens = await Db.bucket('tokens').find({
      deletedAt: null,
    });

    await Db.bucket('balances').create(tokens.map(({id}) => createBalance({
      token: id,
      owner: account.id,
    })));

    this.logger.info({name}, 'driven account created');
    this.emit('created', account);

    return account;
  }

  listDriven(owner) {
    const {Db} = this.app;

    return Db.bucket('accounts').find({
      ownedBy: owner,
    });
  }

  async makeTresure({actor}, {accountId}) {
    const {Db} = this.app;

    if (actor.role !== ROLES.OWNER) {
      throw new AccessError('role_violation', {
        role: ROLE.TREASURE,
      });
    }

    const accounts = Db.bucket('accounts');
    let account = await accounts.findById(accountId);
    if (! account) {
      throw new InputError('not_found', {
        entity: 'account',
        accountId,
      });
    }

    [,account] = await Promise.all([
      accounts.updateOne({
        role: ROLES.TRESURE,
      }, at('role').set(ROLES.USER)),
      accounts.updateById(account.id, at('role').set(ROLES.TRESURE)),
    ]);

    return account;
  }
}

module.exports = decorate([
  Component.setDeps('Db'),
  Component.setDefaults({}),
], AccountsService);
