(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', './Selection.js', './TextOperation.js', './WrappedOperation.js'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('./Selection.js'), require('./TextOperation.js'), require('./WrappedOperation.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.Selection, global.TextOperation, global.WrappedOperation);
    global.SharedPenServer = mod.exports;
  }
})(this, function (module, _require, TextOperation, WrappedOperation) {
  'use strict';

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

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

  var Range = _require.Range,
      Selection = _require.Selection;

  var Server = function () {
    // Constructor. Takes the current document as a string and optionally the array of all operations.
    function Server(document, operations) {
      _classCallCheck(this, Server);

      this.document = document;
      this.operations = operations || [];
    }
    // Call this method whenever you receive an operation from a client.


    _createClass(Server, [{
      key: 'receiveOperation',
      value: function receiveOperation(revision, operation) {
        //这里的operation是从客户端收到的操作记录
        if (revision < 0 || this.operations.length < revision) {
          // TODO ...
          throw new Error('operation revision not in history');
        }
        // Find all operations that the client didn't know of when it sent the
        // operation ...
        //this.operations服务端记录的operation操作队列
        //根据用户端传来的revision，来决定要从什么位置开始遍历操作
        var concurrentOperations = this.operations.slice(revision);

        // ... and transform the operation against all these operations ...
        //如果用户的操作落后于当前服务器记录，需要对流程进行遍历前溯，追赶进度。
        for (var i = 0; i < concurrentOperations.length; i++) {
          operation = WrappedOperation.transform(operation, concurrentOperations[i])[0];
        }

        // ... and apply that on the document.
        this.document = operation.apply(this.document);
        // Store operation in history.
        this.operations.push(operation);

        // It's the caller's responsibility to send the operation to all connected
        // clients and an acknowledgement to the creator.
        return operation;
      }
    }]);

    return Server;
  }();

  module.exports = function (_Server) {
    _inherits(SharedPenServer, _Server);

    function SharedPenServer(document, operations, docId, mayWrite) {
      _classCallCheck(this, SharedPenServer);

      var _this = _possibleConstructorReturn(this, (SharedPenServer.__proto__ || Object.getPrototypeOf(SharedPenServer)).call(this, document, operations));

      _this.docId = docId;
      _this.clients = {};
      // TODO ... 文档权限控制
      if (mayWrite) {
        _this.mayWrite = mayWrite;
      } else {
        _this.mayWrite = function (_, cb) {
          var vle = true;
          cb && cb(vle);
        };
      }
      return _this;
    }

    _createClass(SharedPenServer, [{
      key: 'addClient',
      value: function addClient(socket) {
        var _this2 = this;

        socket.join(this.docId).emit('doc', {
          document: this.document,
          revision: this.operations.length,
          clients: this.clients,
          // replay the operations on the clients, so the rich text will show correctly
          operations: this.operations
        })
        //服务器收到operation，响应操作
        .on('operation', function (revision, operation, selection) {
          _this2.mayWrite(socket, function (mayWrite) {
            if (!mayWrite) {
              console.log("User doesn't have the right to edit.");
              return;
            }
            _this2.onOperation(socket, revision, operation, selection);
          });
        }).on('selection', function (obj) {
          _this2.mayWrite(socket, function (mayWrite) {
            if (!mayWrite) {
              console.log("User doesn't have the right to edit.");
              return;
            }
            _this2.updateSelection(socket, obj && Selection.fromJSON(obj));
          });
        }).on('disconnect', function () {
          console.log('Disconnect');
          socket.leave(_this2.docId);
          _this2.onDisconnect(socket);
          // TODO ...
          // if (
          //   (socket.manager && socket.manager.sockets.clients(this.docId).length === 0) || // socket.io <= 0.9
          //   (socket.ns && Object.keys(socket.ns.connected).length === 0) // socket.io >= 1.0
          // ) {
          //   this.emit('empty-room');
          // }
        });

        this.clients[socket.id] = {
          id: socket.id,
          name: socket.id,
          selection: new Selection([new Range(0, 0)])
        };
        socket.broadcast['in'](this.docId).emit('client_join', this.clients[socket.id]);
      }
    }, {
      key: 'onOperation',
      value: function onOperation(socket, revision, operation, selection) {
        var wrapped;
        //Note- TextOperation 生成操作类型及步骤，selection获取用户鼠标操作位置
        try {
          wrapped = new WrappedOperation(TextOperation.fromJSON(operation), selection && Selection.fromJSON(selection));
        } catch (exc) {
          console.error('Invalid operation received: ' + exc);
          return;
        }

        try {
          var clientId = socket.id;
          var wrappedPrime = this.receiveOperation(revision, wrapped);
          console.log('new operation: ', wrapped);
          this.getClient(clientId).selection = wrappedPrime.meta;
          socket.emit('ack'); //发送数据前，发起ack查询，询问socket是否连接着
          //找到对应的socket连接（socket.broadcast['in'](this.docId)）向用户广播同步信息
          socket.broadcast['in'](this.docId).emit('operation', clientId, wrappedPrime.wrapped.toJSON(), wrappedPrime.meta);
        } catch (exc) {
          console.error(exc);
        }
      }
    }, {
      key: 'updateSelection',
      value: function updateSelection(socket, selection) {
        var clientId = socket.id;
        if (selection) {
          this.getClient(clientId).selection = selection;
        }
        socket.broadcast['in'](this.docId).emit('selection', clientId, selection);
      }
    }, {
      key: 'setName',
      value: function setName(socket, name) {
        var clientId = socket.id;
        this.getClient(clientId).name = name;
        socket.broadcast['in'](this.docId).emit('set_name', clientId, name);
      }
    }, {
      key: 'getClient',
      value: function getClient(clientId) {
        return this.clients[clientId] || (this.clients[clientId] = {});
      }
    }, {
      key: 'onDisconnect',
      value: function onDisconnect(socket) {
        var clientId = socket.id;
        delete this.clients[clientId];
        socket.broadcast['in'](this.docId).emit('client_left', clientId);
      }
    }]);

    return SharedPenServer;
  }(Server);
});