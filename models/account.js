const OWNER = 'owner';
const ADMIN = 'admin';
const USER = 'user';
const BOT = 'bot';
const TREASURE = 'treasure';

const ROLES = Object.freeze({
  OWNER: OWNER,
  ADMIN: ADMIN,
  USER: USER,
  BOT: BOT,
  TREASURE: TREASURE,
});

let i = 0;
const PRIORITY = {
  [BOT]: 0,
  [TREASURE]: 0,
  [USER]: ++i,
  [ADMIN]: ++i,
  [OWNER]: ++i,
};

function isSuperuser(user) {
  return user.role === OWNER || user.role === ADMIN;
}

function canManage(target, actor) {
  return PRIORITY[target.role] < PRIORITY[actor.role];
}

function isDriven(account) {
  return account.ownedBy !== null;
}

function isDrivenBy(account, owner) {
  return account.ownedBy === owner;
}

function createAccount({
  address = null,
  role = USER,
  username = null,
  _username = null,
  name = null, // Account title
  ownedBy = null, // Driven account owner
  createdAt = new Date(),
  updatedAt = new Date(),
  deletedAt = null,
}) {
  if (username && _username === null) {
    _username = username.toLowerCase();
  }

  return {
    address,
    role,
    username,
    _username,
    name,
    ownedBy,
    createdAt,
    updatedAt,
    deletedAt,
  };
}

exports.ROLES = ROLES;
exports.PRIORITY = PRIORITY;
exports.createAccount = createAccount;
exports.canManage = canManage;
exports.isSuperuser = isSuperuser;
exports.isDriven = isDriven;
exports.isDrivenBy = isDrivenBy;
