const imm = require('./imm');
const sift = require('sift');
const memoize = require('fast-memoize');

const createQuery = memoize(sift);

function modify(doc, updates) {
  let outDoc = doc;

  if (! Array.isArray(updates)) {
    updates = [updates];
  }

  for (const {path, ops, query} of updates) {
    if (! path.length) {
      throw new Error(`Path is empty for op "${op}"`);
    }

    outDoc = applyOps(outDoc, path, ops, query);
  }

  return outDoc;
}

function applyOps(doc, path, ops, query) {
  const index = path.indexOf(true);

  if (index === 0) {
    return imm.filterIn(imm.map(doc, (item) => {
      applyOps(item, path.slice(1), ops, query);
    }), path.slice(1), (item) => item !== undefined);
  }
  else if (index > 0) {
    return imm.filterIn(imm.mapIn(
      doc,
      path.slice(0, index),
      (item) => applyOps(item, path.slice(index + 1), ops, query)
    ), path.slice(0, index), (item) => item !== undefined);
  }

  if (query) {
    let sifted;
    if (path.length) {
      sifted = createQuery({[path.join('.')]: query});
    }
    else {
      sifted = createQuery(query);
    }

    if (! sifted(doc)) {
      return doc;
    }
  }

  let outDoc = doc;
  const [prop, ...tail] = path;

  for (const [op, params] of ops) {
    const value = mutate(outDoc.get(prop), tail, op, params);
    if (value === undefined) {
      outDoc = outDoc.unset(prop);
    }
    else {
      outDoc = outDoc.set(prop, value);
    }
  }

  return outDoc;
}

/* eslint-disable max-statements */
function mutate(doc, path, op, params) {
  switch (op) {
  case 'pushToSet': {
    const {value} = params;

    return imm.updateIn(doc, path, (innerDoc = []) => {
      if (innerDoc.includes(value)) {
        return innerDoc;
      }
      else {
        return [...innerDoc, value];
      }
    });
  }
  case 'pushToSetAll': {
    const {values} = params;

    return imm.updateIn(doc, path, (innerDoc = []) => {
      const newValues = values.filter(
        (value) => ! innerDoc.includes(value)
      );

      if (! newValues.length) {
        return innerDoc;
      }
      else {
        return [...innerDoc, ...newValues];
      }
    });
  }
  case 'pullFromSet': {
    const {value} = params;

    return imm.filterIn(doc, path, (innerValue) => {
      return innerValue !== value;
    });
  }
  case 'pullFromSetAll': {
    const {values} = params;

    return imm.filterIn(doc, path, (innerValue) => {
      return ! values.includes(innerValue);
    });
  }
  case 'set': {
    const {value} = params;
    return imm.setIn(doc, path, value);
  }
  case 'unset': {
    return imm.removeIn(doc, path);
  }
  case 'merge': {
    const {value} = params;
    return imm.mergeIn(doc, path, value);
  }
  case 'without': {
    const {keys} = params;
    return imm.doIn(doc, path, (innerDoc = {}) => {
      const result = {};
      for (const key of Object.getOwnPropertyNames(innerDoc)) {
        if (! keys.includes(key)) {
          result[key] = innerDoc[key];
        }
      }
      return result;
    });
  }
  case 'joinAt': {
    const {index, values} = params;
    return imm.doIn(doc, path, (innerDoc = []) => {
      if (innerDoc.length < index + 1) {
        return innerDoc;
      }

      if (index === 0) {
        return [...values, ...innerDoc];
      }
      else if (index === innderDoc.length - 1) {
        return [...innerDoc, ...values];
      }
      else {
        return [
          ...innerDoc.slice(0, index),
          ...values,
          ...innerDoc.slice(index),
        ];
      }
    });
  }
  case 'joinEnd': {
    return imm.doIn(doc, path, (innerDoc = []) => [...innerDoc, ...params.values]);
  }
  case 'joinStart': {
    return imm.doIn(doc, path, (innerDoc = []) => [...params.values, ...innerDoc]);
  }
  case 'pushAt': {
    const {index, value} = params;
    return imm.doIn(doc, path, (innerDoc = []) => {
      if (innerDoc.length < index + 1) {
        return innerDoc;
      }

      if (index === 0) {
        return [value, ...innerDoc];
      }
      else {
        return [
          ...innerDoc.slice(0, index),
          value,
          ...innerDoc.slice(index),
        ];
      }
    });
  }
  case 'pushEnd': {
    const {value} = params;
    return imm.addLastIn(doc, path, value);
  }
  case 'pushStart': {
    const {value} = params;
    return imm.addFirstIn(doc, path, value);
  }
  case 'pullAt': {
    const {index} = params;
    return imm.removeAtIn(doc, path, index);
  }
  case 'pullEnd': {
    return imm.removeLastIn(doc, path);
  }
  case 'pullStart': {
    return imm.removeFirstIn(doc, path);
  }
  case 'slice': {
    const {start, end} = params;
    return imm.doIn(doc, path, (innerDoc = []) => innerDoc.slice(start, end));
  }
  case 'remove': {
    return undefined;
  }
  case 'modify': {
    const {updates} = params;
    return imm.doIn(doc, path, (innerDoc = []) => modify(innerDoc, updates));
  }
  case 'increase': {
    const {value} = params;
    return imm.doIn(doc, path, (innerValue = 0) => {
      if (typeof innerValue === 'number') {
        return innerValue + value;
      }
      else {
        return value;
      }
    });
  }
  case 'decrease': {
    const {value} = params;
    return imm.doIn(doc, path, (innerValue = 0) => {
      if (typeof innerValue === 'number') {
        return innerValue - value;
      }
      else {
        return value;
      }
    });
  }
  case 'max': {
    const {value} = params;
    return imm.doIn(doc, path, (innerValue = 0) => {
      if (typeof innerValue === 'number') {
        return Math.max(innerValue, value);
      }
      else {
        return value;
      }
    });
  }
  case 'min': {
    const {value} = params;
    return imm.doIn(doc, path, (innerValue = 0) => {
      if (typeof innerValue === 'number') {
        return Math.min(innerValue, value);
      }
      else {
        return value;
      }
    });
  }
  default:
    throw new Error(`Unknown operation "${op}"`);
  }
}
/* eslint-enable max-statements */

class Ops {
  constructor(path, query) {
    if (typeof path === 'string') {
      path = path.split('.')
      .map((item) => {
        if (item === '*') {
          return true;
        }
        else if (/^\d+$/.test(item)) {
          return parseInt(item, 10);
        }
        else {
          return item;
        }
      });
    }

    this.path = Object.freeze([...path]);
    this.query = query ? imm.frozenCopy(query) : null;
    this.ops = [];
  }

  push(op) {
    const copy = new Ops(this.path, this.query);
    copy.ops = [...this.ops, op];
    return copy;
  }

  pushOp(op, params) {
    return this.push([op, params]);
  }

  // # Methods

  set(value) {
    return this.pushOp('set', {value});
  }

  unset() {
    return this.pushOp('unset');
  }

  merge(value) {
    return this.pushOp('merge', {value});
  }

  without(keys) {
    return this.pushOp('without', {keys});
  }

  joinAt(index, values) {
    return this.pushOp('joinAt', {index, values});
  }

  joinEnd(values) {
    return this.pushOp('joinEnd', {values});
  }

  joinStart(values) {
    return this.pushOp('joinStart', {values});
  }

  pullAt(index) {
    return this.pushOp('pullAt', {index});
  }

  pullEnd() {
    return this.pushOp('pullEnd');
  }

  pullStart() {
    return this.pushOp('pullStart');
  }

  pullFromSet(value) {
    return this.pushOp('pullFromSet', {value});
  }

  pullFromSetAll(values) {
    return this.pushOp('pullFromSetAll', {values});
  }

  pushAt(index, value) {
    return this.pushOp('pushAt', {index, value});
  }

  pushEnd(value) {
    return this.pushOp('pushEnd', {value});
  }

  pushStart(value) {
    return this.pushOp('pushStart', {value});
  }

  pushToSet(value) {
    return this.pushOp('pushToSet', {value});
  }

  pushToSetAll(values) {
    return this.pushOp('pushToSetAll', {values});
  }

  slice(start, end) {
    return this.pushOp('slice', {start, end});
  }

  remove() {
    return this.pushOp('remove');
  }

  modify(updates) {
    return this.pushOp('modify', {updates});
  }

  increase(value = 1) {
    return this.pushOp('increase', {value});
  }

  decrease(value = 1) {
    return this.pushOp('decrease', {value});
  }

  max(value) {
    return this.pushOp('max', {value});
  }

  min(value) {
    return this.pushOp('min', {value});
  }
}

function at(path, query) {
  return new Ops(path, query);
}

exports.modify = modify;
exports.at = at;
