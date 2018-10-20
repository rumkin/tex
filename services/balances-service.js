const Component = require('../lib/component');
const {decorate} = require('../lib/decorator');

const {InputError} = require('../lib/error');
const {at} = require('../lib/modify');
const {isDriven} = require('../models/account');

class BalancesService extends Component {
  getById(id) {
    const account = this.findById(id);

    if (! account) {
      throw new Error('Balance not found');
    }

    return account;
  }

  findByAccountId(accountId, tokenId) {
    const {Db} = this.app;

    return Db.findOne('balances', {account: accountId, token: tokenId});
  }

  listByAccountId(accountId) {
    const {Db} = this.app;

    return Db.find('balances', {account: accountId});
  }

  async transfer({actor}, {senderId, receiverId, symbol, amount}) {
    const {Db} = this.app;

    const tokens = Db.bucket('tokens');
    const balances = Db.bucket('balances');
    const accounts = Db.bucket('accounts');

    const [sender, receiver] = await Promise.all([
      accounts.findOne({id: senderId, deletedAt: null}),
      accounts.findOne({id: receiverId, deletedAt: null}),
    ]);

    if (! sender) {
      throw new InputError('not_found', {
        entity: 'account',
        senderId,
      });
    }

    if (! receiver) {
      throw new InputError('not_found', {
        entity: 'account',
        receiverId,
      });
    }

    if (isDriven(receiver) && isDriven(sender)) {

    }
    else if (isDriven(receiver)) {

    }
    else if (isDriven(sender)) {

    }

    const token = await tokens.findOne({symbol});

    if (! token) {
      throw new InputError('not_found', {
        entity: 'token',
        symbol,
      });
    }

    const balance = await balances.findOne({
      owner: senderId,
      token: token.id,
    });

    if (balance.available < amount) {
      throw new inputError('insufficient_funds', {
        available: balance.available,
        amount,
      });
    }

    const result = await Promise.all([
      // Withdraw from sender's balance.
      balances.updateOne({
        owner: senderId,
        token: token.id,
      }, [
        at('available').decrease(amount),
        at('amount').decrease(amount),
        at('updatedAt').set(new Date()),
      ]),
      // Write to receiver's balance.
      balances.updateOne({
        owner: receiverId,
        token: token.id,
      }, [
        at('available').increase(amount),
        at('amount').increase(amount),
        at('updatedAt').set(new Date()),
      ]),
    ]);

    this.logger.info({
      sender: sender.username || sender.name,
      receiver: receiver.username || receiver.name,
      amount,
      token,
    }, 'balance trasferred');

    return result;
  }
}

module.exports = decorate([
  Component.setDeps('Db'),
  Component.setDefaults({}),
], BalancesService);
