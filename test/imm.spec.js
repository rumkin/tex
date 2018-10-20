const should = require('should');

const imm = require('../lib/imm');

describe('Imm', function() {
  describe('imm.doIn()', function() {
    const {doIn} = imm;

    describe('Zero length path', function () {
      it('Should return same object when no modification occurs', function() {
        const target = {test: true};
        const result = doIn(target, [], () => ({test: true}));

        should(target).be.equal(result);
      });

      it('Should return new object when modification occurs', function() {
        const target = {test: false};
        const result = doIn(target, [], () => ({test: true}));

        should(target).be.not.equal(result);
      });

      it('Should return same array when no modification occurs', function() {
        const target = [true];
        const result = doIn(target, [], () => ([true]));

        should(target).be.equal(result);
      });

      it('Should return new array when modification occurs', function() {
        const target = [true];
        const result = doIn(target, [], () => ([false]));

        should(target).be.not.equal(result);
      });
    });

    describe('Nonzero length path', function() {
      it('Should return same object when no modification occurs', function() {
        const target = {test: [true]};
        const result = doIn(target, ['test'], () => ([true]));

        should(target).be.equal(result);
      });

      it('Should return new object when modification occurs', function() {
        const target = {test: [true]};
        const result = doIn(target, ['test'], () => ([false]));

        should(target).be.not.equal(result);
        should(result).ownProperty('test').ownProperty(0).equals(false);
      });

      it('Should remove prop from object if value is undefined', function() {
        const target = {a: 1};
        const result = doIn(target, ['a'], () => undefined);

        should(result).be.an.Object();
        should(result).not.have.ownProperty('a');
      });
    });

    describe('Number in path', function() {
      it('Should return an Array even if target is not', function() {
        const target = {};
        const result = doIn(target, [0, 9], () => true);

        should(result).be.an.Array();
        should(result).ownProperty(0).which.has.lengthOf(10);
        should(result[0]).hasOwnProperty(9).which.equals(true);
      });
    });

    describe('String in path', function() {
      it('Should return an Object even if target is not', function() {
        const target = [[true]];
        const result = doIn(target, ['test', 0], () => true);

        should(result).be.an.Object();
        should(result).ownProperty('test').which.has.lengthOf(1);
        should(result.test).hasOwnProperty(0).which.equals(true);
      });
    });

    describe('Immutable in modifier result', function() {
      it('Should return the same object', function() {
        const target = {test: {depth: true}};

        const result = doIn(target, ['test'], (value) => imm.merge(value, {depth: true}));

        should(result).be.equal(target);
      });
    });
  });
});
