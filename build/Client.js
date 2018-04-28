(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', './TextOperation.js'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('./TextOperation.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.TextOperation);
    global.Client = mod.exports;
  }
})(this, function (module, TextOperation) {
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

  var Client = function () {
    function Client(revision, historyOps) {
      _classCallCheck(this, Client);

      this.revision = revision; // the next expected revision number
      this.historyOps = historyOps;
      this.state = synchronized_; // start state
    }

    _createClass(Client, [{
      key: 'initClientContent',
      value: function initClientContent() {
        // init the editor content with historyOps
        if (this.historyOps && this.historyOps.length) {
          var _ops = this.historyOps.map(function (wrappedOp) {
            return wrappedOp.wrapped;
          });
          var initialTextOp = new TextOperation();

          // TODO ...合并服务端发来的操作步骤，这部分内容是否可以放在服务端做？？？

          _ops.forEach(function (op) {
            var _textOp = TextOperation.fromJSON(op);
            initialTextOp = initialTextOp.compose(_textOp);
          });
          //在EditClient里重写了applyOperation jumpto EditClient.js
          this.applyOperation(initialTextOp);
        }
      }
    }, {
      key: 'sendOperation',
      value: function sendOperation(revision, operation) {
        throw new Error('sendOperation must be defined in child class');
      }
    }, {
      key: 'applyOperation',
      value: function applyOperation(operation) {
        throw new Error('applyOperation must be defined in child class');
      }
    }, {
      key: 'setState',
      value: function setState(state) {
        this.state = state;
      }
    }, {
      key: 'applyClient',
      value: function applyClient(operation) {
        this.setState(this.state.applyClient(this, operation));
      }
    }, {
      key: 'applyServer',
      value: function applyServer(operation) {
        //处理来自服务器的消息
        this.revision++;
        this.setState(this.state.applyServer(this, operation));
      }
    }, {
      key: 'serverAck',
      value: function serverAck() {
        this.revision++;
        this.setState(this.state.serverAck(this));
      }
    }, {
      key: 'serverReconnect',
      value: function serverReconnect() {
        if (typeof this.state.resend === 'function') {
          this.setState(this.state.resend(this));
        }
      }
    }, {
      key: 'transformSelection',
      value: function transformSelection(selection) {
        return this.state.transformSelection(selection);
      }
    }]);

    return Client;
  }();

  var Synchronized = function () {
    function Synchronized() {
      _classCallCheck(this, Synchronized);
    }

    _createClass(Synchronized, [{
      key: 'applyClient',
      value: function applyClient(client, operation) {
        // When the user makes an edit, send the operation to the server and
        // switch to the 'AwaitingConfirm' state
        client.sendOperation(client.revision, operation);
        return new AwaitingConfirm(operation);
      }
    }, {
      key: 'applyServer',
      value: function applyServer(client, operation) {
        // When we receive a new operation from the server, the operation can be
        // simply applied to the current document
        client.applyOperation(operation);
        return this;
      }
    }, {
      key: 'serverAck',
      value: function serverAck(client) {
        throw new Error('There is no pending operation.');
      }
    }, {
      key: 'transformSelection',
      value: function transformSelection(selection) {
        return selection;
      }
    }]);

    return Synchronized;
  }();

  // Singleton
  var synchronized_ = new Synchronized();

  // In the 'AwaitingConfirm' state, there's one operation the client has sent
  // to the server and is still waiting for an acknowledgement.

  var AwaitingConfirm = function () {
    function AwaitingConfirm(outstanding) {
      _classCallCheck(this, AwaitingConfirm);

      // Save the pending operation
      this.outstanding = outstanding;
    }

    _createClass(AwaitingConfirm, [{
      key: 'applyClient',
      value: function applyClient(client, operation) {
        // When the user makes an edit, don't send the operation immediately,
        // instead switch to 'AwaitingWithBuffer' state
        return new AwaitingWithBuffer(this.outstanding, operation);
      }
    }, {
      key: 'applyServer',
      value: function applyServer(client, operation) {
        // This is another client's operation. Visualization:
        //
        //                   /\
        // this.outstanding /  \ operation
        //                 /    \
        //                 \    /
        //  pair[1]         \  / pair[0] (new outstanding)
        //  (can be applied  \/
        //  to the client's
        //  current document)
        var pair = this.outstanding.transform(operation);
        client.applyOperation(pair[1]);
        return new AwaitingConfirm(pair[0]);
      }
    }, {
      key: 'serverAck',
      value: function serverAck(client) {
        // The client's operation has been acknowledged
        // => switch to synchronized state
        return synchronized_;
      }
    }, {
      key: 'resend',
      value: function resend(client) {
        // The confirm didn't come because the client was disconnected.
        // Now that it has reconnected, we resend the outstanding operation.
        client.sendOperation(client.revision, this.outstanding);
      }
    }, {
      key: 'transformSelection',
      value: function transformSelection(selection) {
        return selection.transform(this.outstanding);
      }
    }]);

    return AwaitingConfirm;
  }();

  var AwaitingWithBuffer = function () {
    function AwaitingWithBuffer(outstanding, buffering) {
      _classCallCheck(this, AwaitingWithBuffer);

      // Save the pending operation and the user's edits since then
      this.outstanding = outstanding;
      this.buffer = buffering;
    }

    _createClass(AwaitingWithBuffer, [{
      key: 'applyClient',
      value: function applyClient(client, operation) {
        // Compose the user's changes onto the buffer
        var newBuffer = this.buffer.compose(operation);
        return new AwaitingWithBuffer(this.outstanding, newBuffer);
      }
    }, {
      key: 'applyServer',
      value: function applyServer(client, operation) {
        // Operation comes from another client
        //
        //                       /\
        //     this.outstanding /  \ operation
        //                     /    \
        //                    /\    /
        //       this.buffer /  \* / pair1[0] (new outstanding)
        //                  /    \/
        //                  \    /
        //          pair2[1] \  / pair2[0] (new buffer)
        // the transformed    \/
        // operation -- can
        // be applied to the
        // client's current
        // document
        //
        // * pair1[1]
        var pair1 = this.outstanding.transform(operation);
        var pair2 = this.buffer.transform(pair1[1]);
        client.applyOperation(pair2[1]);
        return new AwaitingWithBuffer(pair1[0], pair2[0]);
      }
    }, {
      key: 'serverAck',
      value: function serverAck(client) {
        // The pending operation has been acknowledged
        // => send buffer
        client.sendOperation(client.revision, this.buffer);
        return new AwaitingConfirm(this.buffer);
      }
    }, {
      key: 'resend',
      value: function resend(client) {
        // The confirm didn't come because the client was disconnected.
        // Now that it has reconnected, we resend the outstanding operation.
        client.sendOperation(client.revision, this.outstanding);
      }
    }, {
      key: 'transformSelection',
      value: function transformSelection(selection) {
        return selection.transform(this.outstanding).transform(this.buffer);
      }
    }]);

    return AwaitingWithBuffer;
  }();

  module.exports = {
    Client: Client, Synchronized: Synchronized, AwaitingConfirm: AwaitingConfirm, AwaitingWithBuffer: AwaitingWithBuffer
  };
});