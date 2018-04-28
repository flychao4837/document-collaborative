(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module);
  } else {
    var mod = {
      exports: {}
    };
    factory(mod);
    global.Selection = mod.exports;
  }
})(this, function (module) {
  'use strict';

  // Range has `anchor` and `head` properties, which are zero-based indices into
  // the document. The `anchor` is the side of the selection that stays fixed,
  // `head` is the side of the selection where the cursor is. When both are
  // equal, the range represents a cursor.

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var Range = function () {
    function Range(anchor, head) {
      _classCallCheck(this, Range);

      this.anchor = anchor;
      this.head = head;
    }

    _createClass(Range, [{
      key: 'equals',
      value: function equals(other) {
        return this.anchor === other.anchor && this.head === other.head;
      }
    }, {
      key: 'isEmpty',
      value: function isEmpty() {
        // represents a cursor
        return this.anchor === this.head;
      }
    }, {
      key: 'transform',
      value: function transform(other) {
        function transformIndex(index) {
          var newIndex = index;
          var ops = other.ops;
          for (var i = 0, l = other.ops.length; i < l; i++) {
            if (ops[i].isRetain()) {
              index -= ops[i].chars;
            } else if (ops[i].isInsert()) {
              newIndex += ops[i].text.length;
            } else {
              // delete
              newIndex -= Math.min(index, ops[i].chars);
              index -= ops[i].chars;
            }
            if (index < 0) {
              break;
            }
          }
          return newIndex;
        }

        var newAnchor = transformIndex(this.anchor);
        if (this.isEmpty()) {
          return new Range(newAnchor, newAnchor);
        } else {
          var newHead = transformIndex(this.head);
          return new Range(newAnchor, newHead);
        }
      }
    }], [{
      key: 'fromJSON',
      value: function fromJSON(obj) {
        return new Range(obj.anchor, obj.head);
      }
    }]);

    return Range;
  }();

  var Selection = function () {
    function Selection(ranges) {
      _classCallCheck(this, Selection);

      this.ranges = ranges || [];
    }

    // Convenience method for creating selections only containing a single cursor
    // and no real selection range.


    _createClass(Selection, [{
      key: 'equals',
      value: function equals(other) {
        if (this.ranges.length !== other.ranges.length) {
          return false;
        }
        for (var i = 0; i < this.ranges.length; i++) {
          if (!this.ranges[i].equals(other.ranges[i])) {
            return false;
          }
        }
        return true;
      }
    }, {
      key: 'somethingSelected',
      value: function somethingSelected() {
        return this.ranges.find(function (range) {
          return !range.isEmpty();
        });
      }
    }, {
      key: 'compose',
      value: function compose(other) {
        return other;
      }
    }, {
      key: 'transform',
      value: function transform(other) {
        var newRanges = this.ranges.map(function (range) {
          return range.transform(other);
        });
        return new Selection(newRanges);
      }
    }], [{
      key: 'createCursor',
      value: function createCursor(position) {
        return new Selection([new Range(position, position)]);
      }
    }, {
      key: 'fromJSON',
      value: function fromJSON(obj) {
        var objRanges = obj.ranges || obj;
        return new Selection(objRanges.map(function (objRange) {
          return Range.fromJSON(objRange);
        }));
      }
    }]);

    return Selection;
  }();

  module.exports = {
    Range: Range, Selection: Selection
  };
});