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
    global.ClientSocketIOAdapter = mod.exports;
  }
})(this, function (module) {
  'use strict';

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
    function ClientSocketIOAdapter(socket) {
      var _this = this;

      _classCallCheck(this, ClientSocketIOAdapter);

      this.socket = socket;
      socket.on('client_join', function (clientObj) {
        _this.trigger('client_join', clientObj);
      }).on('client_left', function (clientId) {
        _this.trigger('client_left', clientId);
      }).on('set_name', function (clientId, name) {
        _this.trigger('set_name', clientId, name);
      }).on('ack', function () {
        _this.trigger('ack');
      }).on('operation', function (clientId, operation, selection) {
        _this.trigger('operation', operation);
        _this.trigger('selection', clientId, selection);
      }).on('selection', function (clientId, selection) {
        _this.trigger('selection', clientId, selection);
      }).on('disconnect', function (reason) {
        _this.trigger('disconnect', reason);
      }).on('reconnect', function () {
        _this.trigger('reconnect');
      });
    }

    _createClass(ClientSocketIOAdapter, [{
      key: 'sendOperation',
      value: function sendOperation(revision, operation, selection) {
        this.socket.emit('operation', revision, operation, selection);
      }
    }, {
      key: 'sendSelection',
      value: function sendSelection(selection) {
        this.socket.emit('selection', selection);
      }
    }, {
      key: 'registerCallbacks',
      value: function registerCallbacks(cbs) {
        this.callbacks = cbs;
      }
    }, {
      key: 'trigger',
      value: function trigger(event) {
        var action = this.callbacks && this.callbacks[event];
        if (action) {
          for (var _len = arguments.length, restArgs = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            restArgs[_key - 1] = arguments[_key];
          }

          action.apply(this, restArgs);
        }
      }
    }]);

    return ClientSocketIOAdapter;
  }();
});