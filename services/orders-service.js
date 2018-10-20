const Component = require('../lib/component');
const {decorate} = require('../lib/decorator');
const {InputError, AccessError} = require('../lib/error');
const {at} = require('../lib/modify');
const {ROLES, isDrivenBy, canManage} = require('../models/account');
const {TYPES} = require('../models/order');

class OrdersService extends Component {
  getById(id) {
    const order = this.findById(id);

    if (! order) {
      throw new InputError('not_found', {
        entity: 'order',
        id,
      });
    }

    return order;
  }

  findById(id) {
    const {Db} = this.app;

    return Db.bucket('orders').findById(id);
  }

  findOneBy(query) {
    const {Db} = this.app;

    return Db.bucket('orders').findOne(query);
  }

  listByOwner(ownerId) {
    const {Db} = this.app;

    return Db.bucket('orders').find({
      owner: ownerId,
    });
  }

  async listOwnOrders(ownerId) {
    const {Tokens} = this.app;

    const orders = await this.listByOwner(ownerId);

    if (orders.length) {
      const tokenIds = orders.map(({token}) => token)
      .reduce((ids, id) => {
        if (ids.includes(id)) {
          return ids;
        }
        else {
          return [...ids, id];
        }
      }, []);

      const tokens = await Tokens.listById(tokenIds);
      const tokensIndex = tokens.reduce((index, token) => ({
        ...index,
        [token.id]: token,
      }));

      orderds = orders.map(
        (order) => order.set('token', tokensIndex[order.token])
      );
    }

    return orders;
  }

  async exists({market, symbol, owner}, {db = this.app.Db} = {}) {
    if (symbol) {
      const existing = await db.bucket('markets').findOne({
        symbol,
      });

      if (! existing) {
        throw new inputError('not_found', {
          entity: 'market',
          symbol,
        });
      }

      market = existing.id;
    }

    return db.bucket('orders').hasMatches({
      market,
      owner,
      closedAt: null,
    });
  }

  async create({actor}, {symbol, ownerId, amount, price, type}) {
    const {Db, Tokens, Accounts} = this.app;

    const market = await Db.bucket('markets').findOne({symbol});

    if (! market) {
      throw new InputError('not_found', {
        entity: 'market',
        symbol,
      });
    }

    const [primary, secondary] = await Promise.all([
      Tokens.findById(market.primaryToken),
      Tokens.findById(market.secondaryToken),
    ]);
    let from;
    // let to;

    if (type !== TYPES.BUY && type !== TYPES.SELL) {
      throw new InputError('order_type', {
        type,
      });
    }
    else if (type === TYPES.SELL) {
      from = primary;
      // to = secondary;
      if (amount < from.minAmount) {
        throw new InputError('min_amount', {
          minAmount: from.minAmount,
          amount: amount * price,
        });
      }
    }
    else {
      from = secondary;
      // to = primary;
      if (amount * price < from.minAmount) {
        throw new InputError('min_amount', {
          minAmount: from.minAmount,
          amount: amount * price,
        });
      }
    }

    let owner;

    if (ownerId && ownerId !== actor.id) {
      owner = await Accounts.findById(ownerId);

      if (! owner) {
        throw new InputError('not_found', {
          entity: 'owner',
          id: ownerId,
        });
      }
    }
    else {
      owner = actor;
    }

    if (owner.id !== actor.id && ! isDrivenBy(owner, actor)) {
      if (! canManage(owner, actor)) {
        throw new AccessError('manage_permissions');
      }
    }

    if (await this.exists({
      market: market.id,
      owner: owner.id,
    }, {db: Db})) {
      throw new InputError('duplicate_order', {
        market: symbol,
      });
    }

    const balance = await Db.bucket('balances').findOne({
      owner: owner.id,
      token: from.id,
    });

    let available = 0;
    if (balance) {
      available = balance.available;
    }

    let supply;

    if (type === TYPES.SELL) {
      supply = amount;
    }
    else {
      supply = amount * price;
    }

    if (available < supply) {
      throw new InputError('insufficient_funds', {
        available,
        amount,
      });
    }

    let order = await Db.bucket('orders').createOne({
      owner: owner.id,
      market: market.id,
      amount,
      remain: amount,
      type,
      price,
      matches: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
    });

    if (type === TYPES.SELL) {
      return this._createSellOrder({order, market}, {db: Db});
    }
    else {
      return this._createBuyOrder({order, market}, {db: Db});
    }
  }

  async _createSellOrder({order, market}, {db}) {
    const accounts = db.bucket('accounts');
    const balances = db.bucket('balances');
    const orders = db.bucket('orders');

    const query = {
      market: order.market,
      closedAt: null,
      type: TYPES.BUY,
      price: {$lte: order.price},
    };

    while (true) {
      let matchingOrder = await orders.findOne(query);
      if (! matchingOrder) {
        break;
      }

      let primaryDelta;
      let secondaryDelta;

      let orderUpdate = [
        at('updatedAt').set(new Date()),
      ];
      let matchingOrderUpdate = [
        at('updatedAt').set(new Date()),
      ];

      if (matchingOrder.remain <= order.remain) {
        primaryDelta = matchingOrder.remain;
        secondaryDelta = primaryDelta * matchingOrder.price;

        orderUpdate.push(
          at('remain').decrease(primaryDelta),
          at('matches').pushEnd({
            order: matchingOrder.id,
            amount: matchingOrder.remain,
          }),
        );

        matchingOrderUpdate.push(
          at('remain').set(0),
          at('matches').pushEnd({
            order: order.id,
            amount: matchingOrder.remain,
          }),
          at('closedAt').set(new Date()),
        );
      }
      else {
        primaryDelta = order.remain;
        secondaryDelta = primaryDelta * matchingOrder.price;

        orderUpdate.push(
          at('remain').set(0),
          at('matches').pushEnd({
            order: matchingOrder.id,
            amount: order.remain,
          }),
          at('closedAt').set(new Date()),
        );

        matchingOrderUpdate.push(
          at('remain').decrease(primaryDelta),
          at('matches').pushEnd({
            order: order.id,
            amount: order.remain,
          }),
        );
      }

      const primaryCommission = round(primaryDelta * this.config.comissionSize, 8);
      const secondaryCommission = round(secondaryDelta * this.config.comissionSize, 8);
      const updatedAt = new Date();
      const treasure = await accounts.findOne({role: ROLES.TRESURE});

      // Update order itself
      order = await orders.updateById(order.id, orderUpdate);

      // Batch update
      await Promise.all([
        // Update matching order
        orders.updateById(matchingOrder.id, matchingOrderUpdate),
        // Decrease target order primary token balance
        balances.updateOne({
          owner: order.owner,
          token: market.primaryToken,
        }, [
          at('amount').decrease(primaryDelta),
          at('available').decrease(primaryDelta),
          at('updatedAt').set(updatedAt),
        ]),
        // Update secondary token balance
        balances.updateOne({
          owner: order.owner,
          token: market.secondaryToken,
        }, [
          at('amount').increase(secondaryDelta - secondaryCommission),
          at('available').increase(secondaryDelta - secondaryCommission),
          at('updatedAt').set(updatedAt),
        ]),
        // Increase matching order's primary token balance
        balances.updateOne({
          owner: matchingOrder.owner,
          token: market.primaryToken,
        }, [
          at('amount').increase(primaryDelta - primaryCommission),
          at('available').increase(primaryDelta - primaryCommission),
          at('updatedAt').set(updatedAt),
        ]),
        // Decrease matching order's primary token balance
        balances.updateOne({
          owner: matchingOrder.owner,
          token: market.secondaryToken,
        }, [
          at('amount').decrease(secondaryDelta),
          at('updatedAt').set(updatedAt),
        ]),
        // Increase tresure primary balance
        balances.updateOne({
          owner: treasure.id,
          token: market.primaryToken,
        }, [
          at('amount').increase(primaryCommission),
          at('available').increase(primaryCommission),
          at('updatedAt').set(updatedAt),
        ]),
        // Increase tresure secondary balance
        balances.updateOne({
          owner: treasure.id,
          token: market.secondaryToken,
        }, [
          at('amount').increase(secondaryCommission),
          at('available').increase(secondaryCommission),
          at('updatedAt').set(updatedAt),
        ]),
      ]);

      if (order.remain === 0) {
        break;
      }
    }

    if (order.remain > 0) {
      await balances.updateOne({
        owner: order.owner,
        token: market.primaryToken,
      }, [
        at('available').decrease(order.remain),
      ]);
    }

    return order;
  }

  async _createBuyOrder({order, market}, {db}) {
    const orders = db.bucket('orders');
    const balances = db.bucket('balances');

    const query = {
      market: order.market,
      closedAt: null,
      type: TYPES.SELL,
      price: {$gte: order.price},
    };

    while (true) {
      let matchingOrder = await orders.findOne(query);
      if (! matchingOrder) {
        break;
      }

      let primaryDelta;
      let secondaryDelta;

      let orderUpdate = [
        at('updatedAt').set(new Date()),
      ];
      let matchingOrderUpdate = [
        at('updatedAt').set(new Date()),
      ];

      if (matchingOrder.remain <= order.remain) {
        primaryDelta = matchingOrder.remain;
        secondaryDelta = primaryDelta * matchingOrder.price;

        orderUpdate.push(
          at('remain').decrease(primaryDelta),
          at('matches').pushEnd({
            order: matchingOrder.id,
            amount: matchingOrder.remain,
          }),
        );

        matchingOrderUpdate.push(
          at('remain').set(0),
          at('matches').pushEnd({
            order: order.id,
            amount: matchingOrder.remain,
          }),
          at('closedAt').set(new Date()),
        );
      }
      else {
        primaryDelta = order.remain;
        secondaryDelta = primaryDelta * matchingOrder.price;

        orderUpdate.push(
          at('remain').set(0),
          at('matches').pushEnd({
            order: matchingOrder.id,
            amount: order.remain,
          }),
          at('closedAt').set(new Date()),
        );

        matchingOrderUpdate.push(
          at('remain').decrease(primaryDelta),
          at('matches').pushEnd({
            order: order.id,
            amount: order.remain,
          }),
        );
      }

      const primaryCommission = round(primaryDelta * this.config.comissionSize, 8);
      const secondaryCommission = round(secondaryDelta * this.config.comissionSize, 8);
      const updatedAt = new Date();
      const treasure = await accounts.findOne({role: ROLES.TRESURE});

      // Update order itself
      order = await orders.updateById(order.id, orderUpdate);

      // Batch update
      await Promise.all([
        // Update matching order
        orders.updateById(matchingOrder.id, matchingOrderUpdate),
        // Decrease target order primary token balance
        balances.updateOne({
          owner: order.owner,
          token: market.primaryToken,
        }, [
          at('amount').increase(primaryDelta),
          at('available').increase(primaryDelta),
          at('updatedAt').set(updatedAt),
        ]),
        // Update secondary token balance
        balances.updateOne({
          owner: order.owner,
          token: market.secondaryToken,
        }, [
          at('amount').decrease(secondaryDelta),
          at('updatedAt').set(updatedAt),
        ]),
        // Increase matching order's primary token balance
        balances.updateOne({
          owner: matchingOrder.owner,
          token: market.primaryToken,
        }, [
          at('amount').decrease(primaryDelta),
          at('updatedAt').set(updatedAt),
        ]),
        // Decrease matching order's primary token balance
        balances.updateOne({
          owner: matchingOrder.owner,
          token: market.secondaryToken,
        }, [
          at('amount').increase(secondaryDelta),
          at('available').increase(secondaryDelta),
          at('updatedAt').set(updatedAt),
        ]),
        // Increase tresure primary balance
        balances.updateOne({
          owner: treasure.id,
          token: market.primaryToken,
        }, [
          at('amount').increase(primaryCommission),
          at('available').increase(primaryCommission),
          at('updatedAt').set(updatedAt),
        ]),
        // Increase tresure secondary balance
        balances.updateOne({
          owner: treasure.id,
          token: market.secondaryToken,
        }, [
          at('amount').increase(secondaryCommission),
          at('available').increase(secondaryCommission),
          at('updatedAt').set(updatedAt),
        ]),
      ]);

      if (order.remain === 0) {
        break;
      }
    }

    if (order.remain > 0) {
      await balances.updateOne({
        owner: order.owner,
        token: market.secondaryToken,
      }, [
        at('available').decrease(order.remain * order.price),
      ]);
    }

    return order;
  }
}

function round(value, decimals) {
  return parseFloat(value.toFixed(decimals), 10);
}

module.exports = decorate([
  Component.setDeps('Db', 'Accounts', 'Tokens'),
  Component.setDefaults({
    comissionSize: 0.025,
  }),
], OrdersService);
