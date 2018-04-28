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
    global.WrappedOperation = mod.exports;
  }
})(this, function (module) {
  'use strict';

  // Copy all properties from source to target.

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

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  function copy(source, target) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        target[key] = source[key];
      }
    }
  }

  function composeMeta(a, b) {
    if (a && (typeof a === 'undefined' ? 'undefined' : _typeof(a)) === 'object') {
      if (typeof a.compose === 'function') {
        return a.compose(b);
      }
      var meta = {};
      copy(a, meta);
      copy(b, meta);
      return meta;
    }
    return b;
  }

  function transformMeta(meta, operation) {
    if (meta && (typeof meta === 'undefined' ? 'undefined' : _typeof(meta)) === 'object' && typeof meta.transform === 'function') {
      return meta.transform(operation);
    }
    return meta;
  }

  module.exports = function () {
    // A WrappedOperation contains an operation and corresponing metadata.
    function WrappedOperation(operation, metadata) {
      _classCallCheck(this, WrappedOperation);

      this.wrapped = operation;
      this.meta = metadata;
    }

    _createClass(WrappedOperation, [{
      key: 'apply',
      value: function apply() {
        //TextOperation.apply(str, oldAttributes, newAttributes)
        //返回新的文本字符
        return this.wrapped.apply.apply(this.wrapped, arguments);
      }
    }, {
      key: 'invert',
      value: function invert() {
        var meta = this.meta;
        if (meta && (typeof meta === 'undefined' ? 'undefined' : _typeof(meta)) === 'object' && typeof meta.invert === 'function') {
          meta = this.meta.invert.apply(meta, arguments);
        }
        return new WrappedOperation(this.wrapped.invert.apply(this.wrapped, arguments), meta);
      }
    }, {
      key: 'compose',
      value: function compose(other) {
        return new WrappedOperation(this.wrapped.compose(other.wrapped), composeMeta(this.meta, other.meta));
      }
    }, {
      key: 'transform',
      value: function transform(other) {
        return WrappedOperation.transform(this, other);
      }
    }], [{
      key: 'transform',
      value: function transform(a, b) {
        var pair = a.wrapped.transform(b.wrapped);
        return [new WrappedOperation(pair[0], transformMeta(a.meta, b.wrapped)), new WrappedOperation(pair[1], transformMeta(b.meta, a.wrapped))];
      }
    }]);

    return WrappedOperation;
  }();
});