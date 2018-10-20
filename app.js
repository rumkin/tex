const App = require('./lib/app');
const Logger = require('./lib/logger');

const DbAdapter = require('./adapters/db-adapter.js');
const AccountsService = require('./services/accounts-service.js');
const BalancesService = require('./services/balances-service.js');
const TokensService = require('./services/tokens-service.js');
const OrdersService = require('./services/orders-service.js');
// const {at} = require('./lib/modify');

const logger = new Logger();

const app = new App({
  config: {
    db: {
      dbPath: 'tmp/db.json',
    },
    accounts: {},
    tokens: {},
  },
  components: {
    Db: DbAdapter,
    Accounts: AccountsService,
    Balances: BalancesService,
    Tokens: TokensService,
    Orders: OrdersService,
  },
  scope: {logger},
});

async function main() {
  await app.start();

  const {Db, Accounts, Tokens, Orders, Balances} = app;

  let [user1, user2] = await Promise.all([
    Accounts.findByAddress('0x00000000'),
    Accounts.findByAddress('0x00000001'),
  ]);
  let driven1;
  let driven2;

  if (! user1) {
    user1 = await Accounts.create({actor: null}, {
      username: 'rumkin',
      address: '0x00000000',
      role: 'owner',
    });
    driven1 = await Accounts.createDriven({actor: user1}, {
      ownerId: user1.id,
      name: 'Shadow',
    });
    driven2 = await Accounts.createDriven({actor: user1}, {
      ownerId: user1.id,
      name: 'Treasure',
    });

    await Accounts.makeTresure({actor: user1}, {accountId: driven2.id});
  }
  else {
    [driven1, driven2] = await Accounts.listDriven(user1.id);
  }

  if (! user2) {
    user2 = await Accounts.create({actor: null}, {
      username: 'not-rumkin',
      address: '0x00000001',
      role: 'admin',
    });
  }

  let btcToken = await Tokens.findBySymbol('BTC');
  let ethToken = await Tokens.findBySymbol('ETH');

  if (! btcToken) {
    btcToken = await Tokens.create({actor: user1}, {
      ownerId: user1.id,
      symbol: 'BTC',
      totalSupply: 21000000000,
      amount: 1000,
      isPrimary: true,
    });
  }

  if (! ethToken) {
    ethToken = await Tokens.create({actor: user2}, {
      ownerId: user2.id,
      symbol: 'ETH',
      totalSupply: 21000000000000,
      amount: 1000,
      isPrimary: true,
    });
  }

  await app.Balances.transfer({actor: user1}, {
    senderId: user1.id,
    receiverId: driven1.id,
    amount: 10,
    symbol: 'BTC',
  });

  if (! await Orders.exists({owner: user2.id, symbol: 'BTC-ETH'})) {
    await Orders.create({actor: user1}, {
      symbol: 'BTC-ETH',
      type: 'buy',
      amount: 5,
      price: 10,
      ownerId: user2.id,
    });
  }

  await Orders.create({actor: user1}, {
    symbol: 'BTC-ETH',
    type: 'sell',
    amount: 1,
    price: 10,
    ownerId: driven1.id,
  });

  console.log({
    orders: await Db.bucket('orders').find({}),
    balances: await Db.bucket('balances').find({}),
  });

  await app.stop();
}

main()
.catch((error) => {
  console.error(error);
  return 1;
})
.then((code = 0) => {
  process.exit(code);
});
