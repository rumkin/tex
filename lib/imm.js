function doIn(target, path, fn) {
  if (! path.length) {
    let result = fn(target);
    if (! deepEqual(result, target)) {
      return result;
    }
    else {
      return target;
    }
  }
  else {
    const prop = path[0];

    switch (typeof prop) {
    case 'number': {
      if (! Array.isArray(target)) {
        return Object.freeze(doIn([], path, fn));
      }
      else if (target.length > prop) {
        const newItem = doIn(getArrayValue(target[prop]), path.slice(1), fn);

        if (deepEqual(newItem, target[prop])) {
          return target;
        }

        const result = target.slice(0);
        result[prop] = newItem;
        return Object.freeze(result);
      }
      else {
        let result;
        if (target.length) {
          result = target.concat(new Array(prop - (target.length - 1)));
        }
        else {
          result = new Array(prop + 1);
        }

        result[prop] = doIn(typeof path[1] === 'number' ? [] : {}, path.slice(1), fn);

        return Object.freeze(result);
      }
    }
    case 'string': {
      if (! isObject(target) || Array.isArray(target)) {
        return doIn({}, path, fn);
      }

      if (! target.hasOwnProperty(prop)) {
        const result = doIn(typeof path[1] === 'string' ? {} : [], path.slice(1), fn);
        if (result !== undefined) {
          return assign(target, {[prop]: result});
        }
        else {
          return target;
        }
      }

      const result = doIn(getObjectValue(target[prop]), path.slice(1), fn);

      if (deepEqual(target[prop], result)) {
        return target;
      }
      else if (result === undefined) {
        return Object.freeze(without(target, [prop]));
      }

      return assign(target, {
        [prop]: result,
      });
    }
    default:
      throw new Error(`Invalid prop type ${typeof prop}`);
    }
  }
}

function getArrayValue(target) {
  if (Array.isArray(target)) {
    return target;
  }
  else {
    return [];
  }
}

function getObjectValue(target) {
  if (isObject(target) && ! Array.isArray(target)) {
    return target;
  }
  else {
    return {};
  }
}

function without(target, props) {
  const notFoundProps = [...props];
  return Object.getOwnPropertyNames(target)
  .reduce((result, prop) => {
    const i = notFoundProps.indexOf(prop);
    if (i > -1) {
      notFoundProps.splice(i, 1);
      return result;
    }
    else {
      return {
        ...result,
        [prop]: target[prop],
      };
    }
  }, {});
}

function map(target, fn) {
  if (! target.length) {
    return target;
  }

  const l = target.length;
  const result = new Array(l);
  let isChanged = false;

  for (let i = 0; i < l; i++) {
    const value = target[i];
    const newValue = fn(value, i, target);

    if (! deepEqual(value, newValue)) {
      isChanged = true;
    }

    result[i] = frozenCopy(newValue);
  }

  return isChanged
    ? Object.freeze(result)
    : target;
}

function mapIn(target, path, fn) {
  return doIn(target, path, (value = []) => {
    return map(value, fn);
  });
}

function addLast(array, value) {
  return Object.freeze([
    ...array,
    frozenCopy(value),
  ]);
}

function addLastIn(target, path, value) {
  return doIn(target, path, (innerValue = []) => {
    return addLast(innerValue, value);
  });
}

function addFirst(array, value) {
  return Object.freeze([
    frozenCopy(value),
    ...array,
  ]);
}

function addFirstIn(target, path, value) {
  return doIn(target, path, (innerValue = []) => {
    return addFirst(innerValue, value);
  });
}

function removeAt(array, n) {
  return Object.freeze([
    ...array.slice(0, n),
    ...array.slice(n + 1),
  ]);
}

function removeAtIn(target, path, n) {
  return doIn(target, path, (value = []) => {
    return removeAt(value, n);
  });
}

function removeFirst(array) {
  return Object.freeze(array.slice(1));
}

function removeFirstIn(target, path, n) {
  return doIn(target, path, (value = []) => {
    return removeFirst(value, n);
  });
}

function removeLast(array) {
  return Object.freeze(array.slice(0, -1));
}

function removeLastIn(target, path, n) {
  return doIn(target, path, (value = []) => {
    return removeLast(value, n);
  });
}

function filter(target, fn) {
  if (! target.length) {
    return target;
  }

  const l = target.length;
  const result = [];
  let isChanged = false;

  for (let i = 0, n = 0; i < l; i++) {
    const value = target[i];
    const isSelected = fn(value, i, target) === true;

    if (isSelected) {
      result[n] = value;
      n += 1;
    }
    else {
      isChanged = true;
    }
  }

  return isChanged
    ? Object.freeze(result)
    : target;
}

function filterIn(target, path, fn) {
  return doIn(target, path, (value = []) => {
    return filter(value, fn);
  });
}

function get(target, prop, alt) {
  if (typeof target[prop] !== 'undefined') {
    return target[prop];
  }
  else {
    return alt;
  }
}

function getIn(target, path, alt) {
  if (! path.length) {
    return target;
  }
  else if (path.length > 1) {
    const prop = path[0];

    if (prop in target === false) {
      return null;
    }
    else {
      return getIn(target[prop], path.slice(1), alt);
    }
  }
  else {
    return get(target, path[0], alt);
  }
}

function set(target, prop, value) {
  if (prop in target === false || ! deepEqual(target[prop], value)) {
    return assign(target, {
      [prop]: frozenCopy(value),
    });
  }
  else {
    return target;
  }
}

function setIn(target, path, value) {
  if (path.length < 1) {
    return value;
  }
  else if (path.length < 2) {
    return set(target, path[0], value);
  }

  const [prop, head] = tail(path);
  return doIn(target, head, (innerTarget = {}) => {
    return set(innerTarget, prop, value);
  });
}

function update(target, prop, fn) {
  const value = target[prop];
  const newValue = fn(value);
  if (! deepEqual(value, newValue)) {
    return assign(target, {
      [prop]: frozenCopy(newValue),
    });
  }
  else {
    return target;
  }
}

function doWith(target, fn) {
  const result = fn(target);

  if (deepEqual(target, result)) {
    return target;
  }
  else {
    return result;
  }
}

function updateIn(target, path, fn) {
  if (path.length < 1) {
    return doWith(target, fn);
  }
  else if (path.length < 2) {
    return update(target, path, fn);
  }

  const [prop, head] = tail(path);
  return doIn(target, head, (innerTarget = {}) => {
    return update(innerTarget, prop, fn);
  });
}

function remove(target, prop) {
  if (target.hasOwnProperty(prop)) {
    const newValue = copy(target);
    delete newValue[prop];
    return Object.freeze(newValue);
  }
  else {
    return target;
  }
}

function removeIn(target, path) {
  if (path.length < 1) {
    return;
  }
  else if (path.length < 2) {
    return remove(target, path);
  }

  const [prop, head] = tail(path);
  return doIn(target, head, (value = {}) => {
    return remove(value, prop);
  });
}

function item(array, i, value) {
  if (array.length > i && deepEqual(array[i], value)) {
    return array;
  }

  const newArray = [...array];
  newArray[i] = frozenCopy(value);
  return Object.freeze(newArray);
}

function itemIn(target, path, value) {
  if (path.length < 1) {
    return target;
  }
  else if (path.length < 2) {
    return item(target, path, value);
  }

  const [prop, head] = tail(path);
  return doIn(target, head, (innerValue = {}) => {
    return item(innerValue, prop, value);
  });
}

function merge(target, source) {
  const result = copy(target);
  let isChanged = false;

  for (const [prop, value] of Object.entries(source)) {
    if (! target.hasOwnProperty(prop)) {
      isChanged = true;
      result[prop] = isObject(value) ? frozenCopy(value) : value;
    }
    else if (isNativeObject(value)) {
      if (isNativeObject(target[prop])) {
        result[prop] = merge(target[prop], value);
        if (result[prop] !== target[prop]) {
          isChanged = true;
        }
      }
      else {
        result[prop] = frozenCopy(value);
        isChanged = true;
      }
    }
    else {
      if (! deepEqual(target[prop], value)) {
        result[prop] = isObject(value) ? frozenCopy(value) : value;
        isChanged = true;
      }
    }
  }

  return isChanged
    ? Object.freeze(result)
    : target;
}

function mergeIn(target, path, value) {
  if (path.length < 1) {
    return assign(target, value);
  }
  else if (path.length < 2) {
    if (isObject(target[path])) {
      return set(target, path, merge(target[path], value));
    }
    else {
      return set(target, path, value);
    }
  }

  const [prop, head] = tail(path);
  return doIn(target, head, (innerTarget = {}) => {
    if (prop in innerTarget === false) {
      return assign(innerTarget, {
        [prop]: frozenCopy(value),
      });
    }
    else {
      const newValue = merge(innerTarget[prop], value);
      return set(innerTarget, prop, newValue);
    }
  });
}

const OBJ_CONSTRUCTOR = Object.toString();

function frozenCopy(target) {
  if (! target || typeof target !== 'object') {
    return target;
  }
  else if (Array.isArray(target)) {
    return Object.freeze(target.map(frozenCopy));
  }
  else if (isNativeObject(target)) {
    const duplicate = Object.getOwnPropertyNames(target)
    .reduce(function (result, name){
      result[name] = frozenCopy(target[name]);
      return result;
    }, {});

    return Object.freeze(duplicate);
  }
  else if (typeof target.clone === 'function') {
    return Object.freeze(target.clone());
  }
  else {
    return target;
  }
}

function freeze(target) {
  if (! target || typeof target !== 'object') {
    return target;
  }
  else if (Array.isArray(target)) {
    target.forEach(freeze);
    return Object.freeze(target);
  }
  else {
    Object.getOwnPropertyNames(target)
    .forEach((prop) => freeze(target[prop]));
    return Object.freeze(target);
  }
}

function copy(target) {
  if (! target || typeof target !== 'object') {
    return target;
  }
  else if (Array.isArray(target)) {
    return target.map(copy);
  }
  else if (isNativeObject(target)) {
    const duplicate = Object.getOwnPropertyNames(target)
    .reduce(function (result, name){
      result[name] = copy(target[name]);
      return result;
    }, {});

    return duplicate;
  }
  else if (typeof target.clone === 'function') {
    return target.clone();
  }
  else {
    return target;
  }
}

function assign(target, props) {
  if (target[IMMUTABLE]) {
    return target.merge(props);
  }
  else {
    return Object.freeze(
      Object.assign(copy(target), props)
    );
  }
}

function deepEqual(target, source) {
  if (target === source) {
    return true;
  }
  else if (isObject(target) && isObject(source)) {
    if (Array.isArray(target) && Array.isArray(source)) {
      const len = Math.max(target.length, source.length);

      for (let i = 0; i < len; i++) {
        if (! deepEqual(target[i], source[i])) {
          return false;
        }
      }

      return true;
    }
    else if (isNativeObject(target) && isNativeObject(source)) {
      const targetProps = Object.getOwnPropertyNames(target);
      const sourceProps = Object.getOwnPropertyNames(source);

      if (targetProps.length !== sourceProps.length) {
        return false;
      }

      let samePropsCount = 0;
      for (const prop of targetProps) {
        if (! sourceProps.includes(prop)) {
          return false;
        }
        else if (! deepEqual(target[prop], source[prop])) {
          return false;
        }
        else {
          samePropsCount += 1;
        }
      }

      return samePropsCount === targetProps.length;
    }
  }

  return false;
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function isNativeObject(value) {
  return isObject(value) && value.constructor.toString() === OBJ_CONSTRUCTOR;
}

function tail(array) {
  return [array[array.length - 1], array.slice(0, -1)];
}

const IMMUTABLE = Symbol('immutable');

exports.doIn = doIn;
exports.map = map;
exports.mapIn = mapIn;
exports.addLast = addLast;
exports.addLastIn = addLastIn;
exports.addFirst = addFirst;
exports.addFirstIn = addFirstIn;
exports.removeFirst = removeFirst;
exports.removeFirstIn = removeFirstIn;
exports.removeLast = removeLast;
exports.removeLastIn = removeLastIn;
exports.removeAt = removeAt;
exports.removeAtIn = removeAtIn;
exports.unsetAt = removeAt;
exports.unsetAtIn = removeAtIn;
exports.item = item;
exports.itemIn = itemIn;
exports.filter = filter;
exports.filterIn = filterIn;
exports.set = set;
exports.setIn = setIn;
exports.get = get;
exports.getIn = getIn;
exports.update = update;
exports.updateIn = updateIn;
exports.remove = remove;
exports.removeIn = removeIn;
exports.merge = merge;
exports.mergeIn = mergeIn;
exports.frozenCopy = frozenCopy;
exports.freeze = freeze;
exports.copy = copy;
exports.assign = assign;
exports.deepEqual = deepEqual;
exports.IMMUTABLE = IMMUTABLE;
