(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', './Utils.js'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('./Utils.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.Utils);
    global.TextAction = mod.exports;
  }
})(this, function (module, Utils) {
  'use strict';

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

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

  module.exports = function () {
    // Operation are essentially lists of ops. There are three types of ops:
    //
    // * Retain ops: Advance the cursor position by a given number of characters.
    //   Represented by positive ints.
    // * Insert ops: Insert a given string at the current cursor position.
    //   Represented by strings.
    // * Delete ops: Delete the next n characters. Represented by positive ints.
    function TextAction(type) {
      _classCallCheck(this, TextAction);

      this.type = type;
      this.chars = null; // characters count
      this.text = null;
      this.attributes = null;

      if (type === 'insert') {
        this.text = arguments[1];
        Utils.assert(typeof this.text === 'string');

        this.attributes = arguments[2] || {};
        Utils.assert(_typeof(this.attributes) === 'object');
      } else if (type === 'delete') {
        this.chars = arguments[1];
        Utils.assert(typeof this.chars === 'number');
      } else if (type === 'retain') {
        this.chars = arguments[1];
        Utils.assert(typeof this.chars === 'number');

        this.attributes = arguments[2] || {};
        Utils.assert(_typeof(this.attributes) === 'object');
      }
    }

    _createClass(TextAction, [{
      key: 'isInsert',
      value: function isInsert() {
        return this.type === 'insert';
      }
    }, {
      key: 'isDelete',
      value: function isDelete() {
        return this.type === 'delete';
      }
    }, {
      key: 'isRetain',
      value: function isRetain() {
        return this.type === 'retain';
      }
    }, {
      key: 'equals',
      value: function equals(otherAction) {
        return this.type === otherAction.type || this.chars === otherAction.chars || this.text === otherAction.text || this.attributesEqual(otherAction.attributes);
      }
    }, {
      key: 'attributesEqual',
      value: function attributesEqual(otherAttributes) {
        var xAttrs = Object.getOwnPropertyNames(this.attributes);
        var yAttrs = Object.getOwnPropertyNames(otherAttributes);
        if (xAttrs.length !== yAttrs.length) {
          return false;
        }
        for (var i = 0; i < xAttrs.length; i++) {
          var prop = xAttrs[i];
          if (this.attributes[prop] !== otherAttributes[prop]) {
            return false;
          }
        }
        return true;
      }
    }, {
      key: 'hasEmptyAttributes',
      value: function hasEmptyAttributes() {
        for (var prop in this.attributes) {
          if (this.attributes.hasOwnProperty(prop)) {
            return false;
          }
        }
        return true;
      }
    }]);

    return TextAction;
  }();
});