function defer(fn) {
  return new Promise((resolve, reject) => {
    const result = fn();

    if (typeof result.then === 'function') {
      result.then(resolve, reject);
    }
    else {
      resolve(result);
    }
  });
}

module.exports = defer;
