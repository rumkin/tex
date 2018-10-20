const should = require('should');

const Record = require('../lib/record');

describe('Record', function() {
  describe('Record#extend()', function() {
    it('Should return record instance', function() {
      const target = new Record({
        a: 1,
      });

      const result = target.extend({b: 2});

      should(result).be.instanceOf(Record);
    });

    it('Should return same object if no modification has been done', function() {
      const target = new Record({
        a: 1,
      });

      const result = target.extend({});
      should(result).be.equal(target);
    });

    it('Should return new object on modification', function() {
      const target = new Record({
        a: 1,
      });

      const result = target.extend({b: 1});

      should(result).not.be.equal(target);
      should(result).ownProperty('b');
    });
  });

  describe('Record#merge()', function() {
    it('Should not create new instance when no changes occur', function() {
      const target = new Record({
        test: {
          a: true,
        },
      });

      const result = target.merge('test', {a: true});
      should(target).be.equal(result);
    });

    it('Should create new instance when changes occur', function() {
      const target = new Record({
        test: {
          a: false,
        },
      });

      const result = target.merge('test', {a: true});
      should(target).be.not.equal(result);
      should(result.test).has.ownProperty('a').which.equals(true);
    });
  });

  describe('Record#unset()', function() {
    it('Should remove prop', function() {
      const target = new Record({
        test: true,
      });

      const result = target.unset('test');
      should(result).has.not.ownProperty('test');
    });

    it('Should overwrite prop with default value', function() {
      class ExtendedRecord extends Record {
        static get defaults() {
          return {
            test: true,
          };
        }
      }

      const target = new ExtendedRecord({
        test: false,
      });

      const result = target.unset('test');
      should(result).has.ownProperty('test').which.equals(true);
    });
  });
});
