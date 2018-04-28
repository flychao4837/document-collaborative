(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', './Utils.js', './Client.js', './UndoManager.js', './TextOperation.js', './Selection.js', './WrappedOperation.js'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('./Utils.js'), require('./Client.js'), require('./UndoManager.js'), require('./TextOperation.js'), require('./Selection.js'), require('./WrappedOperation.js'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.Utils, global.Client, global.UndoManager, global.TextOperation, global.Selection, global.WrappedOperation);
        global.EditorClient = mod.exports;
    }
})(this, function (module, Utils, _require, UndoManager, TextOperation, _require2, WrappedOperation) {
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

    var Client = _require.Client,
        AwaitingWithBuffer = _require.AwaitingWithBuffer;
    var Range = _require2.Range,
        Selection = _require2.Selection;

    var SelfMeta = function () {
        function SelfMeta(selectionBefore, selectionAfter) {
            _classCallCheck(this, SelfMeta);

            this.selectionBefore = selectionBefore;
            this.selectionAfter = selectionAfter;
        }

        _createClass(SelfMeta, [{
            key: 'invert',
            value: function invert() {
                return new SelfMeta(this.selectionAfter, this.selectionBefore);
            }
        }, {
            key: 'compose',
            value: function compose(other) {
                return new SelfMeta(this.selectionBefore, other.selectionAfter);
            }
        }, {
            key: 'transform',
            value: function transform(operation) {
                return new SelfMeta(this.selectionBefore.transform(operation), this.selectionAfter.transform(operation));
            }
        }]);

        return SelfMeta;
    }();

    var OtherClient = function () {
        function OtherClient(editorAdapter, id, name, selection) {
            _classCallCheck(this, OtherClient);

            this.editorAdapter = editorAdapter;
            this.id = id;
            this.name = name || id;
            this.setColor(name ? Utils.hueFromName(name) : Math.random());

            this.selection = selection || new Selection([new Range(0, 0)]);
            // setTimeout(() => {
            this.updateSelection(this.selection);
            // })
        }

        _createClass(OtherClient, [{
            key: 'setColor',
            value: function setColor(hue) {
                this.hue = hue;
                this.color = Utils.hsl2hex(hue, 0.75, 0.5); // cursor color
                this.lightColor = Utils.hsl2hex(hue, 0.5, 0.9); // selection color
            }
        }, {
            key: 'setName',
            value: function setName(name) {
                if (this.name !== name) {
                    this.name = name;
                }

                this.setColor(Utils.hueFromName(name));
            }
        }, {
            key: 'updateSelection',
            value: function updateSelection(selection) {
                this.removeSelection();
                this.selection = selection;
                this.mark = this.editorAdapter.setOtherSelection(selection,
                // cursor color: this.color
                // selection color: this.lightColor
                selection.somethingSelected() ? this.lightColor : this.color, this.id);
            }
        }, {
            key: 'removeSelection',
            value: function removeSelection() {
                if (this.mark) {
                    this.mark.clear();
                    this.mark = null;
                }
            }
        }, {
            key: 'remove',
            value: function remove() {
                this.removeSelection();
            }
        }]);

        return OtherClient;
    }();

    module.exports = function (_Client) {
        _inherits(EditorClient, _Client);

        function EditorClient(data, serverAdapter, editorAdapter) {
            _classCallCheck(this, EditorClient);

            var _this = _possibleConstructorReturn(this, (EditorClient.__proto__ || Object.getPrototypeOf(EditorClient)).call(this, data.revision, data.operations));

            Utils.makeEventEmitter(EditorClient, ['undoStatesChanged', 'clientsChanged'], _this);

            _this.serverAdapter = serverAdapter;
            _this.editorAdapter = editorAdapter;
            _this.undoManager = new UndoManager(50); // maximum history size
            _this.clients = {};

            _this.serverAdapter.registerCallbacks({
                client_join: function client_join(clientObj) {
                    _this.onClientJoin(clientObj);
                },
                client_left: function client_left(clientId) {
                    _this.onClientLeft(clientId);
                },
                set_name: function set_name(clientId, name) {
                    _this.getClientObject(clientId).setName(name);
                },
                ack: function ack() {
                    _this.serverAck();
                },
                operation: function operation(_operation) {
                    //通知client处理来自服务器的消息
                    _this.applyServer(TextOperation.fromJSON(_operation));
                },
                selection: function selection(clientId, _selection) {
                    if (_selection) {
                        _this.getClientObject(clientId).updateSelection(_this.transformSelection(Selection.fromJSON(_selection)));
                    } else {
                        _this.getClientObject(clientId).removeSelection();
                    }
                },
                disconnect: function disconnect(reason) {
                    // TODO ... socket disconnect
                    console.log("disconnect");
                },
                reconnect: function reconnect() {
                    _this.serverReconnect();
                }
            });

            _this.editorAdapter.registerCallbacks({
                beforeChange: _this.onBeforeChange.bind(_this),
                change: _this.onChange.bind(_this),
                selectionChange: _this.onSelectionChange.bind(_this),
                focus: _this.onFocus.bind(_this),
                blur: _this.onBlur.bind(_this)
            });
            _this.editorAdapter.registerUndo(_this.undo.bind(_this));
            _this.editorAdapter.registerRedo(_this.redo.bind(_this));

            _this.initClientContent(); //Client.js 将所有的历史记录合并，形成当前客户端文档
            _this.initOtherClients(data.clients);
            _this._simultaneousFlag = false;
            return _this;
        }

        _createClass(EditorClient, [{
            key: 'initOtherClients',
            value: function initOtherClients(clients) {
                var _this2 = this;

                // init the exist clients
                var allKeys = Object.keys(clients);
                if (allKeys.length) {
                    for (var i = 0; i < allKeys.length; i++) {
                        var clientId = allKeys[i];
                        var client = clients[clientId];
                        this.clients[clientId] = new OtherClient(this.editorAdapter, client.id, client.name, Selection.fromJSON(client.selection));
                    }
                    // TODO ... 初始化的 clients 是否通过 ready 传递会更合适
                    setTimeout(function () {
                        _this2.trigger('clientsChanged', _this2.parseClientsInfo());
                    });
                }
            }
        }, {
            key: 'sendOperation',
            value: function sendOperation(revision, operation) {
                this.serverAdapter.sendOperation(revision, operation.toJSON(), this.selection);
            }
        }, {
            key: 'applyOperation',
            value: function applyOperation(operation) {
                //收到服务端数据，通知editor更新数据
                console.log("applyOperation", operation);
                this.editorAdapter.applyOperation(operation);
                this.updateSelection();
                this.undoManager.transform(new WrappedOperation(operation, null));
            }
        }, {
            key: 'onClientJoin',
            value: function onClientJoin(clientObj) {
                var clientId = clientObj.id;
                console.log('User join: ', clientId);
                this.clients[clientId] = new OtherClient(this.editorAdapter, clientId, clientObj.name, Selection.fromJSON(clientObj.selection));

                this.trigger('clientsChanged', this.parseClientsInfo());
            }
        }, {
            key: 'onClientLeft',
            value: function onClientLeft(clientId) {
                console.log('User left: ', clientId);
                var client = this.clients[clientId];
                if (!client) {
                    return;
                }
                client.remove();
                delete this.clients[clientId];

                this.trigger('clientsChanged', this.parseClientsInfo());
            }
        }, {
            key: 'parseClientsInfo',
            value: function parseClientsInfo() {
                return Object.values(this.clients).map(function (client) {
                    return {
                        id: client.id,
                        name: client.name,
                        color: client.color,
                        lightColor: client.lightColor
                    };
                });
            }
        }, {
            key: 'getClientObject',
            value: function getClientObject(clientId) {
                var client = this.clients[clientId];
                if (client) {
                    return client;
                }
                this.clients[clientId] = new OtherClient(this.editorAdapter, clientId);
                return this.clients[clientId];
            }
        }, {
            key: 'onBeforeChange',
            value: function onBeforeChange() {
                console.log('onBeforeChange');
                this.selectionBefore = this.editorAdapter.getSelection();
            }
        }, {
            key: 'onChange',
            value: function onChange(textOperation, inverse) {
                console.log('--onChange--: ', textOperation);
                // 设置富文本属性，需要重新更新一下 selectionBefore
                if (textOperation.baseLength === textOperation.targetLength) {
                    this.selectionBefore = this.editorAdapter.getSelection();
                }

                var last = function last(arr) {
                    return arr[arr.length - 1];
                };
                //合并本地缓存队列中的操作，统一发送
                var compose = this.undoManager.undoStack.length > 0 && inverse.shouldBeComposedWithInverted(last(this.undoManager.undoStack).wrapped);
                var inverseMeta = new SelfMeta(this.selection, this.selectionBefore);

                // if multi-ranges' attributes changed simultaneously,
                // we need to compose them together when push to undo stack, so we can undo them one click
                this.undoManager.add(new WrappedOperation(inverse, inverseMeta), compose || this._simultaneousFlag);

                var length = this.editorAdapter.rtcm.codeMirror.doc.listSelections().length;
                if (textOperation.baseLength === textOperation.targetLength && length >= 2) {
                    this._simultaneousFlag = true;
                } else {
                    this._simultaneousFlag = false;
                }
                // SuperClass Client method: send the operation to server
                this.applyClient(textOperation);

                this.trigger('undoStatesChanged', {
                    canUndo: this.undoManager.canUndo(),
                    canRedo: this.undoManager.canRedo()
                });
            }
        }, {
            key: 'updateSelection',
            value: function updateSelection() {
                console.log("updateSelection");
                this.selection = this.editorAdapter.getSelection();
            }
        }, {
            key: 'onSelectionChange',
            value: function onSelectionChange() {
                var oldSelection = this.selection;
                this.updateSelection();
                if (oldSelection && this.selection.equals(oldSelection)) {
                    return;
                }
                this.sendSelection(this.selection);
            }
        }, {
            key: 'sendSelection',
            value: function sendSelection(selection) {
                if (this.state instanceof AwaitingWithBuffer) {
                    return;
                }
                this.serverAdapter.sendSelection(selection);
            }
        }, {
            key: 'onFocus',
            value: function onFocus() {
                this.onSelectionChange();
            }
        }, {
            key: 'onBlur',
            value: function onBlur() {
                this.selection = null;
                this.sendSelection(null);
            }
        }, {
            key: 'undo',
            value: function undo() {
                var _this3 = this;

                if (!this.undoManager.canUndo()) {
                    return;
                }
                this.undoManager.performUndo(function (undoOp) {
                    _this3.applyUnredo(undoOp);
                });
            }
        }, {
            key: 'redo',
            value: function redo() {
                var _this4 = this;

                if (!this.undoManager.canRedo()) {
                    return;
                }
                this.undoManager.performRedo(function (redoOp) {
                    _this4.applyUnredo(redoOp);
                });
            }
        }, {
            key: 'applyUnredo',
            value: function applyUnredo(operation) {
                this.undoManager.add(this.editorAdapter.invertOperation(operation));
                this.editorAdapter.applyOperation(operation.wrapped);
                this.selection = operation.meta.selectionAfter;
                if (this.selection) {
                    this.editorAdapter.setSelection(this.selection);
                }
                // send the operation to server
                this.applyClient(operation.wrapped);

                this.trigger('undoStatesChanged', {
                    canUndo: this.undoManager.canUndo(),
                    canRedo: this.undoManager.canRedo()
                });
            }
        }]);

        return EditorClient;
    }(Client);
});