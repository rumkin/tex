const memoize = require('fast-memoize');
const sift = require('sift');
const uuid = require('uuid');
const Error3 = require('error3');

// const imm = require('./imm');
const {modify} = require('../modify');
const Record = require('../record');

const createMatcher = memoize(sift);
const createSorter = () => (a, b) => (a.id - b.id);

class DbError extends Error3 {
  static SYNC_FAILED() {
    return 'Sync process failed';
  }

  static INDEX_VALUE_LOST({name}) {
    return `Value not found in index "${name}"`;
  }
}

class QueryBuilder {
  constructor(db, bucket) {
    this._db = db;
    this._bucket = bucket;
  }

  find(query) {
    return new FindQuery(this._db, this._bucket, query);
  }

  findById(id) {
    return new FindByIdQuery(this._db, this._bucket, id);
  }

  findOne(query) {
    return new FindOneQuery(this._db, this._bucket, query);
  }

  create(docs) {
    return new CreateQuery(this._db, this._bucket, docs);
  }

  createOne(doc) {
    return new CreateOneQuery(this._db, this._bucket, doc);
  }

  update(query, modifier) {
    return new UpdateQuery(this._db, this._bucket, query, modifier);
  }

  updateById(id, modifier) {
    return new UpdateByIdQuery(this._db, this._bucket, id, modifier);
  }

  updateOne(query, modifier) {
    return new UpdateOneQuery(this._db, this._bucket, query, modifier);
  }

  remove(query) {
    return new RemoveQuery(this._db, this._bucket, query);
  }

  removeById(id) {
    return new RemoveByIdQuery(this._db, this._bucket, id);
  }

  removeOne(query) {
    return new RemoveOneQuery(this._db, this._bucket, query);
  }

  hasMatches(query) {
    return new HasMatchesQuery(this._db, this._bucket, query);
  }
}

class AbstractQuery {
  constructor(fn) {
    if (! fn) {
      fn = () => this._execute();
    }

    this._promise = new Promise((resolve,  reject) => {
      setImmediate(() => {
        fn(this).then(resolve, reject);
      });
    });
  }

  then(...args) {
    return this._promise.then(...args);
  }

  catch(...args) {
    return this._promise.catch(...args);
  }

  _execute() {
    throw new Error('Not implemented yet');
  }
}

class FindQuery extends AbstractQuery {
  constructor(db, bucket, query, skip = 0, limit = Infinity, sort = null) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._query = query;
    this._skip = skip;
    this._limit = limit;
    this._sort = sort;
  }

  _execute() {
    return Promise.resolve(this._db.find(
      this._bucket,
      this._query,
      this._skip,
      this._limit,
      this._sort,
    ));
  }

  limit(limit) {
    this._limit = limit;
    return this;
  }

  skip(skip) {
    this._skip = skip;
    return this;
  }

  sort(sort) {
    this._sort = sort;
    return this;
  }
}

class FindByIdQuery extends AbstractQuery {
  constructor(db, bucket, id) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._id = id;
  }

  _execute() {
    return Promise.resolve(
      this._db.findById(this._bucket, this._id)
    );
  }
}

class FindOneQuery extends AbstractQuery {
  constructor(db, bucket, query, skip = 0, sort = null) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._query = query;
    this._skip = skip;
    this._sort = sort;
  }

  _execute() {
    return Promise.resolve(this._db.findOne(
      this._bucket,
      this._query,
      this._skip,
      this._sort,
    ));
  }

  skip(skip) {
    this._skip = skip;
    return this;
  }

  sort(sort) {
    this._sort = sort;
    return this;
  }
}

class CreateQuery extends AbstractQuery {
  constructor(db, bucket, docs) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._docs = docs;
  }

  _execute() {
    return this._db.create(this._bucket, this._docs);
  }
}

class CreateOneQuery extends AbstractQuery {
  constructor(db, bucket, doc) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._doc = doc;
  }

  _execute() {
    return this._db.createOne(this._bucket, this._doc);
  }
}

class UpdateQuery extends AbstractQuery {
  constructor(db, bucket, query, modifier, skip = 0, limit = Infinity, sort = null) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._query = query;
    this._skip = skip;
    this._limit = limit;
    this._modifier = modifier;
    this._sort = sort;
  }

  _execute() {
    return this._db.update(
      this._bucket,
      this._query,
      this._modifier,
      this._skip,
      this._limit,
      this._sort,
    );
  }

  limit(limit) {
    this._limit = limit;
    return this;
  }

  skip(skip) {
    this._skip = skip;
    return this;
  }

  sort(sort) {
    this._sort = sort;
    return this;
  }
}

class UpdateByIdQuery extends AbstractQuery {
  constructor(db, bucket, id, modifier) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._id = id;
    this._modifier = modifier;
  }

  _execute() {
    return this._db.updateById(this._bucket, this._id, this._modifier);
  }
}

class UpdateOneQuery extends AbstractQuery {
  constructor(db, bucket, query, modifier, skip = 0, sort = null) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._query = query;
    this._skip = skip;
    this._modifier = modifier;
    this._sort = sort;
  }

  _execute() {
    return this._db.updateOne(
      this._bucket,
      this._query,
      this._modifier,
      this._skip,
      this._sort,
    );
  }

  skip(skip) {
    this._skip = skip;
    return this;
  }

  sort(sort) {
    this._sort = sort;
    return this;
  }
}

class RemoveQuery extends AbstractQuery {
  constructor(db, bucket, query, skip = 0, limit = Infinity, sort = null) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._query = query;
    this._skip = skip;
    this._limit = limit;
    this._sort = sort;
  }

  _execute() {
    return this._db.remove(
      this._bucket,
      this._query,
      this._skip,
      this._limit,
      this._sort,
    );
  }

  limit(limit) {
    this._limit = limit;
    return this;
  }

  skip(skip) {
    this._skip = skip;
    return this;
  }

  sort(sort) {
    this._sort = sort;
    return this;
  }
}

class RemoveByIdQuery extends AbstractQuery {
  constructor(db, bucket, id) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._id = id;
  }

  _execute() {
    return this._db.removeById(this._bucket, this._id);
  }
}

class RemoveOneQuery extends AbstractQuery {
  constructor(db, bucket, query, skip = 0, sort = null) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._query = query;
    this._skip = skip;
    this._sort = sort;
  }

  _execute() {
    return this._db.removeOne(
      this._bucket,
      this._query,
      this._modifier,
      this._skip,
      this._sort,
    );
  }

  skip(skip) {
    this._skip = skip;
    return this;
  }

  sort(sort) {
    this._sort = sort;
    return this;
  }
}

class HasMatchesQuery extends AbstractQuery {
  constructor(db, bucket, query) {
    super();

    this._db = db;
    this._bucket = bucket;
    this._query = query;
  }

  _execute() {
    return Promise.resolve(this._db.hasMatches(this._bucket, this._query));
  }
}

class StoreHandler {
  bucket(name) {
    return new QueryBuilder(this, name);
  }

  create(bucket, docs) {
    const out = create(this.store, bucket, docs);

    this.store.data = out.data;
    this.store.indexes = out.indexes;

    return this.sync([{
      action: 'create',
      params: {
        bucket,
        docs,
      },
    }])
    .then(() => out.result);
  }

  createOne(bucket, doc) {
    const out = createOne(this.store, bucket, doc);

    this.store.data = out.data;
    this.store.indexes = out.indexes;

    return this.sync([{
      action: 'createOne',
      params: {
        bucket,
        doc,
      },
    }])
    .then(() => out.result);
  }

  find(bucket, query, skip, limit, sort) {
    return find(this.store, bucket, query, skip, limit, sort).result;
  }

  findById(bucket, id) {
    return findById(this.store, bucket, id).result;
  }

  findOne(bucket, query, skip, limit, sort) {
    return findOne(this.store, bucket, query, skip, sort).result;
  }

  hasMatches(bucket, query) {
    return hasMatches(this.store, bucket, query).result;
  }

  remove(bucket, query, skip, limit, sort) {
    const out = remove(this.store, bucket, query, skip, limit, sort);

    this.store.data = out.data;
    this.store.indexes = out.indexes;

    return this.sync([{
      action: 'remove',
      params: {
        bucket,
        query,
        skip,
        limit,
        sort,
      },
    }])
    .then(() => out.result);
  }

  removeById(bucket, id) {
    const out = removeById(this.store, bucket, id);

    this.store.data = out.data;
    this.store.indexes = out.indexes;

    return this.sync([{
      action: 'removeById',
      params: {
        bucket,
        id,
      },
    }])
    .then(() => out.result);
  }

  removeOne(bucket, query, skip, sort) {
    const out = removeOne(this.store, bucket, query, skip, sort);

    this.store.data = out.data;
    this.store.indexes = out.indexes;

    return this.sync([{
      action: 'removeOne',
      params: {
        bucket,
        query,
        skip,
        sort,
      },
    }])
    .then(() => out.result);
  }

  update(bucket, query, modifier, skip, limit, sort) {
    const out = update(this.store, bucket, query, modifier, skip, limit, sort);

    this.store.data = out.data;
    this.store.indexes = out.indexes;

    return this.sync([{
      action: 'update',
      params: {
        bucket,
        query,
        modifier,
        skip,
        limit,
        sort,
      },
    }])
    .then(() => out.result);
  }

  updateById(bucket, id, modifier) {
    const out = updateById(this.store, bucket, id, modifier);

    this.store.data = out.data;
    this.store.indexes = out.indexes;

    return this.sync([
      {
        action: 'updateById',
        params: {
          bucket,
          id,
          modifier,
        },
      },
    ])
    .then(() => out.result);
  }

  updateOne(bucket, query, modifier, skip, sort) {
    const out = update(this.store, bucket, query, modifier, skip, 1, sort);

    this.store.data = out.data;
    this.store.indexes = out.indexes;

    const result = out.result.length
      ? out.result[0]
      : null;

    return this.sync([
      {
        action: 'updateOne',
        params: {
          bucket,
          query,
          modifier,
          skip,
          sort,
        },
      },
    ])
    .then(() => result);
  }

  sync() {
    throw new Error('Not implemented yet');
  }
}

class SyncPoint {
  get id() {
    throw new Error('No id set');
  }

  sync() {
    throw new Error('Not implemented yet');
  }
}

class Db extends StoreHandler {
  constructor({
    remotes = [],
    successLimit = 0.5,
  } = {}) {
    super();

    this.store = {
      data: {},
      indexes: {},
    };
    this.queued = [];
    this.log = [];
    this.remotes = remotes;
    this.successLimit = successLimit;
    this.isOpened = false;
    this.version = 0;
  }

  get isOnline() {
    return this.remotes.filter(({isOnline}) => isOnline).length > 0;
  }
  // # Instance params
  open({data, version}) {
    if (this.isOpened) {
      throw new DbError('is_opened');
    }

    this.version = version;
    for (const bucket of Object.getOwnPropertyNames(data)) {
      data[bucket] = data[bucket].map((record) => new Record(record));
    }

    this.store.data = data;
    this.store.indexes = this.buildIndexes(data);
    this.isOpened = true;
  }

  close() {
    if (! this.isOpened) {
      throw new DbError('not_opened');
    }

    this.queued.forEach(({reject}) => {
      reject(new DbError('db_closed'));
    });

    this.store = {
      data: {},
      indexes: {},
    };
    this.version = 0;
    this.queue = [];
    this.log = [];
    this.isOpened = false;
  }

  toJSON() {
    return {
      version: this.version,
      data: this.store.data,
    };
  }

  // # Service methods
  buildIndexes(data) {
    const indexes = {};
    for (const [col, docs] of Object.entries(data)) {
      indexes[`${col}.id`] = docs.reduce((result, doc, index) => ({
        [doc.id]: index,
        ...result,
      }), {});
    }
    return indexes;
  }

  tx(fn) {
    return this.queue(async () => {
      const tx = new Transaction(this);

      this.isLocked = true;
      try {
        return await fn(tx);
      }
      catch (err) {
        throw err;
      }
      finally {
        this.isLocked = false;
      }
    });
  }

  async queue(fn) {
    let resolve;
    let reject;

    const promise = new Promise((resolveIn, rejectIn) => {
      resolve = resolveIn;
      reject = rejectIn;
    });

    this.queued.push({
      fn,
      resolve,
      reject,
    });

    if (this.queued.length === 1) {
      this.runQueue();
    }

    return promise;
  }

  runQueue() {
    if (! this.queued.length) {
      return;
    }

    const {fn, resolve, reject} = this.queued[0];

    try {
      fn()
      .then(resolve, reject)
      .then(() => {
        this.queued.shift();
        this.runQueue();
      });
    }
    catch (error) {
      reject(error);
      this.queued.shift();
      this.runQueue();
    }
  }

  sync(log) {
    if (! this.isOnline) {
      this.log.push(...log);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let syncedCount = 0;
      let totalRemain = this.remotes.length;
      const report = {};
      const errors = [];

      this.remotes.forEach((remote) => {
        remote.sync(log)
        .then(() => {
          syncedCount += 0;
          report[remote.id] = true;
        }, (error) => {
          report[remote.id] = false;
          errors.push(error);
        })
        .then(() => {
          totalRemain -= 1;

          if (syncedCount >= this.successLimit) {
            resolve();
          }
          else if (totalRemain < 1) {
            reject(new DbError('sync_failed', {report}, errors));
          }
        });
      });
    });
  }
}

class Transaction extends StoreHandler {
  constructor(source) {
    super();

    this.source = source;
    this.store = {
      data: {},
      indexes: {},
    };

    for (const [col, docs] of Object.entries(source.store.data)) {
      this.store.data[col] = [...docs];
    }

    for (const [name, indexes] of Object.entries(source.store.indexes)) {
      this.store.indexes[name] = {...indexes};
    }

    this.log = [];
    this.isCommited = false;
    this.isRolledBack = false;
  }

  async sync(log) {
    this.log.push(...log);
  }

  async commit() {
    if (this.isRolledBack) {
      throw new DbError('rolled_back');
    }

    this.isCommited = true;
    this.source.store = this.store;

    if (! this.source.isOnline) {
      this.source.log = [...this.source.log, this.log];
    }
    else {
      this.source.sync(this.log);
    }

  }

  rollback() {
    if (this.isCommited) {
      throw new DbError('commited');
    }

    this.isRolledBack = true;
  }
}

function find({data, indexes}, bucket, query, skip, limit, sort) {
  if (! data[bucket]) {
    return {
      data,
      indexes,
      result: [],
    };
  }

  let matches = data[bucket];

  if (query !== null) {
    const matcher = createMatcher(query);
    matches = matches.filter(matcher);
  }

  if (! matches.length) {
    return {
      data,
      indexes,
      result: [],
    };
  }
  else if (matches.length === data[bucket].length) {
    return {
      data,
      indexes,
      result: matches,
    };
  }

  if (sort !== null) {
    const sorter = createSorter(sort);
    matches = matches.sort(sorter);
  }

  if (limit < Infinity || skip > 0) {
    let start = skip;
    let end = limit === Infinity ? undefined : limit;
    matches = matches.slice(start, end);
  }

  return {
    data,
    indexes,
    result: matches,
  };
}

function findById({data, indexes}, bucket, id) {
  if (! data[bucket]) {
    return {
      data,
      indexes,
      result: null,
    };
  }

  const indexName = `${bucket}.id`;
  let result = null;
  const i = indexes[indexName][id];

  if (i !== undefined) {
    result = data[bucket][i];
  }

  return {
    data,
    indexes,
    result,
  };
}

function findOne({data, indexes}, bucket, query, skip, sort) {
  const {result} = find({data, indexes}, bucket, query, skip, 1, sort);

  return {
    data,
    indexes,
    result: result.length ? result[0] : null,
  };
}

function hasMatches({data, indexes}, bucket, query) {
  let result = false;

  if (data.hasOwnProperty(bucket)) {
    if (data[bucket].findIndex(createMatcher(query)) > -1) {
      result = true;
    }
  }

  return {
    data,
    indexes,
    result,
  };
}

function update({data, indexes}, bucket, query, modifier, skip, limit, sort) {
  if (! data[bucket]) {
    return {
      data,
      indexes,
      result: [],
    };
  }

  let matches = data[bucket];

  if (query !== null) {
    const matcher = createMatcher(query);
    matches = matches.filter(matcher);
  }

  if (! matches.length) {
    return {
      data,
      indexes,
      result: [],
    };
  }

  if (sort !== null) {
    const sorter = createSorter(sort);
    matches = matches.sort(sorter);
  }

  if (limit < Infinity || skip > 0) {
    let start = skip;
    let end = limit === Infinity ? undefined : limit;
    matches = matches.slice(start, end);
  }

  const newDocs = matches.map((doc) => {
    const newDoc = safeModify(doc, modifier);
    data[bucket][indexes[`${bucket}.id`][doc.id]] = newDoc;
    return newDoc;
  });

  return {
    data,
    indexes,
    result: newDocs,
  };
}
//
// function updateOne({data, indexes}, bucket, query, modifier) {
//   let result = null;
//
//   if (! data.hasOwnProperty(bucket)) {
//     return {
//       data,
//       indexes,
//       result,
//     };
//   }
//
//   const
//
//   const matches = query === true ? () => true : createMatcher(query);
//
//   const index = data[bucket].findIndex(matches);
//
//   if (index < 0) {
//     return {
//       data,
//       indexes,
//       result,
//     };
//   }
//
//   result = safeModify(data[bucket][index], modifier);
//   data[bucket][index] = result;
//
//   return {
//     data,
//     indexes,
//     result,
//   };
// }

function updateById({data, indexes}, bucket, id, modifier) {
  const idIndex = `${bucket}.id`;
  let result;

  if (idIndex in indexes) {
    const i = indexes[idIndex][id];

    if (i !== undefined) {
      result = safeModify(data[bucket][i], modifier);
      data[bucket][i] = result;
    }
  }

  return {
    data,
    indexes,
    result,
  };
}

function create({data, indexes}, bucket, docs) {
  const indexName = `${bucket}.id`;

  if (! data[bucket]) {
    data[bucket] = [];
    indexes[indexName] = {};
  }

  const col = data[bucket];
  const index = indexes[indexName];

  let insertIndex = col.length;
  let newDocs = new Array(docs.length);

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    let newDoc;

    if (doc.id) {
      if (index.hasOwnProperty(doc.id)) {
        throw new DbError('duplicated_id', {id: doc.id});
      }

      newDoc = doc instanceof Record ? doc : new Record(doc);
    }
    else {
      newDoc = doc instanceof Record
        ? doc.extend({id: uuid()})
        : new Record({id: uuid(), ...doc});
    }

    index[newDoc.id] = (insertIndex++);
    newDocs[i] = newDoc;
  }

  col.push(...newDocs);

  return {
    data,
    indexes,
    result: newDocs,
  };
}

function createOne(db, bucket, doc) {
  const {result, ...rest} = create(db, bucket, [doc]);

  return {
    ...rest,
    result: result[0],
  };
}

function remove({data, indexes}, bucket, query, skip, limit, sort) {
  if (! data[bucket]) {
    return {
      data,
      indexes,
      result: [],
    };
  }

  let matches = data[bucket];
  const idIndex = `${bucket}.id`;

  if (query !== null) {
    const matcher = createMatcher(query);
    matches = matches.filter(matcher);
  }

  if (! matches.length) {
    return {
      data,
      indexes,
      result: [],
    };
  }

  if (sort !== null) {
    const sorter = createSorter(sort);
    matches = matches.sort(sorter);
  }

  if (limit < Infinity || skip > 0) {
    let start = skip;
    let end = limit === Infinity ? undefined : limit;
    matches = matches.slice(start, end);
  }

  if (matches.length === data[bucket].length) {
    delete data[bucket];
    delete indexes[idIndex];

    return {
      data,
      indexes,
      result: matches,
    };
  }

  const index = indexes[idIndex];
  const col = data[bucket];
  const removedItems = matches.sort((a, b) => index[a.id] - index[b.id]);
  const removedIndex = removedItems.reduce((result, {id}) => ({
    ...result,
    [id]: index[id],
  }), {});
  const startIndex = index[removedItems[0].id];
  let removedCounter = removedItems.length;

  for (let i = (col.length - 1); i >= startIndex; i--) {
    const doc = col[i];

    if (removedIndex.hasOwnProperty(doc.id)) {
      removedCounter -= 1;
      delete indexes[doc.id];
      col.splice(i, 1);
    }
    else {
      index[doc.id] = i - removedCounter;
    }
  }

  return {
    data,
    indexes,
    result: matches,
  };
}

// function removeOpitimized(
//   {data, indexes},
//   {
//     from,
//     query = null,
//     skip = 0,
//     limit = Infinity,
//     sort = false,
//   },
// ) {
//   let result = [];
//
//   if (! data[from]) {
//     return {
//       data,
//       indexes,
//       result,
//     };
//   }
//
//   const matches = query === true ? () => true : createMatcher(query);
//
//   const col = data[from];
//   const index = indexes[`${from}.id`];
//   const removedIndex = {};
//   let skipCounter = 0;
//   let limitCounter = limit;
//
//   for (let i = 0; i < col.length; i++) {
//     const doc = col[i];
//
//     if (matches(doc)) {
//       if (skipCounter >= skip) {
//         result.push(doc);
//         removedIndex[doc.id] = i;
//       }
//
//       skipCounter += 1;
//       limitCounter -= 1;
//     }
//
//     if (limitCounter === 0) {
//       break;
//     }
//   }
//
//   if (result.length) {
//     const startIndex = removedIndex[result[0].id];
//     let removedCounter = result.length;
//
//     for (let i = (col.length - 1); i >= startIndex; i--) {
//       const doc = col[i];
//       if (removedIndex.hasOwnProperty(doc.id)) {
//         removedCounter -= 1;
//         delete indexes[col[i].id];
//         col.splice(i, 1);
//       }
//       else {
//         index[col[i].id] = i - removedCounter;
//       }
//     }
//   }
//
//   return {
//     data,
//     indexes,
//     result,
//   };
// }

function removeById({data, indexes}, bucket, id) {
  let result = null;

  if (! data[bucket]) {
    return {
      data,
      indexes,
      result,
    };
  }

  const indexName = `${bucket}.id`;
  const col = data[bucket];
  const index = indexes[indexName];

  const docIndex = index[id];

  if (! index.hasOwnProperty(id)) {
    throw new DbError('index_value_lost', {name: indexName});
  }

  result = col[docIndex];
  for (let i = docIndex; i < col.length; i++) {
    index[col[i].id] = i - 1;
  }
  col.splice(docIndex, 1);
  delete index[id];

  return {
    data,
    indexes,
    result,
  };
}

function removeOne({data, indexes}, bucket, query, skip, sort) {
  const {result, ...rest} = remove({data, indexes}, bucket, query, skip, 1, sort);

  let newResult;
  if (result.length) {
    newResult = result[0];
  }
  else {
    newResult = null;
  }

  return {
    ...rest,
    result: newResult,
  };
}

function safeModify(doc, modifier) {
  const newDoc = modify(doc, modifier);

  if (newDoc.id !== doc.id) {
    throw new DbError('id_mutation', {id: doc.id});
  }

  return newDoc;
}

exports.Db = Db;
exports.Record = Record;
exports.DbError = DbError;
exports.StoreHandler = StoreHandler;
exports.SyncPoint = SyncPoint;
exports.Transaction = Transaction;
