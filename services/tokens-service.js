const Component = require('../lib/component');
const {decorate} = require('../lib/decorator');

const {InputError, AccessError} = require('../lib/error');
const {ROLES} = require('../models/account');

class TokensService extends Component {
  getById(id) {
    const token = this.findById(id);

    if (! token) {
      throw new InputError('not_found', {
        entity: 'token',
        id,
      });
    }

    return token;
  }

  findById(id) {
    const {Db} = this.app;

    return Db.bucket('tokens').findById(id);
  }

  findBySymbol(symbol) {
    const {Db} = this.app;

    return Db.bucket('tokens').findOne({symbol});
  }

  findOneBy(query) {
    const {Db} = this.app;

    return Db.bucket('tokens').findOne(query);
  }

  listById(ids) {
    const {Db} = this.app;

    return Db.bucket('tokens').find({
      _id: {$in: ids},
    });
  }

  listByOwner(ownerId) {
    const {Db} = this.app;

    return Db.bucket('tokens').find({
      owner: ownerId,
    });
  }

  async create({actor}, {symbol, ownerId, totalSupply, minAmount = 1, amount, isPrimary}) {
    const {Db, Accounts} = this.app;

    const tokens = Db.bucket('tokens');
    if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.OWNER) {
      if (! symbol.startsWith('@')) {
        throw new InputError('symbol_incorrect', {symbol});
      }

      if (isPrimary) {
        throw new AccessError('primary_token_creation');
      }
    }

    const symbolExists = await tokens.hasMatches({symbol});

    if (symbolExists) {
      throw new InputError('symbol_taken', {symbol});
    }

    const owner = await Accounts.findById(ownerId);

    if (! owner) {
      throw new InputError('not_found', {
        entity: 'owner',
        id: ownerId,
      });
    }

    const primaryTokens = await tokens.find({isPrimary: true});

    const token = await tokens.createOne({
      symbol,
      owner: ownerId,
      totalSupply,
      amount,
      minAmount,
      isPrimary,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    this.logger.info({symbol, isPrimary}, 'token created');

    await Db.bucket('balances').createOne({
      token: token.id,
      owner: ownerId,
      amount,
      available: amount,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const accounts = await Db.bucket('accounts')
    .find({
      id: {$ne: owner.id},
    });

    await Db.bucket('balances').create(accounts.map(({id}) => ({
      token: token.id,
      owner: id,
      amount: 0,
      available: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })));

    await Db.bucket('markets').create(primaryTokens.map((primaryToken) => ({
      symbol: `${primaryToken.symbol}-${token.symbol}`,
      primaryToken: primaryToken.id,
      secondaryToken: token.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })));

    this.logger.info({owner: owner.username, symbol, amount}, 'balance updated');

    return token;
  }
}

module.exports = decorate([
  Component.setDeps('Db', 'Accounts'),
  Component.setDefaults({}),
], TokensService);
