'use strict'
const Utils = require('./Utils.js')
const { Client, AwaitingWithBuffer } = require('./Client.js')
const UndoManager = require('./UndoManager.js')
const TextOperation = require('./TextOperation.js')
const { Range, Selection } = require('./Selection.js')
const WrappedOperation = require('./WrappedOperation.js')

class SelfMeta {
    constructor(selectionBefore, selectionAfter) {
        this.selectionBefore = selectionBefore
        this.selectionAfter = selectionAfter
    }
    invert() {
        return new SelfMeta(this.selectionAfter, this.selectionBefore)
    }
    compose(other) {
        return new SelfMeta(this.selectionBefore, other.selectionAfter)
    }
    transform(operation) {
        return new SelfMeta(
            this.selectionBefore.transform(operation),
            this.selectionAfter.transform(operation)
        )
    }
}

class OtherClient {
    constructor(editorAdapter, id, name, selection) {
        this.editorAdapter = editorAdapter
        this.id = id
        this.name = name || id
        this.setColor(name ? Utils.hueFromName(name) : Math.random())
    }
    setColor(hue) {
        this.hue = hue
        this.color = Utils.hsl2hex(hue, 0.75, 0.5) // cursor color
        this.lightColor = Utils.hsl2hex(hue, 0.5, 0.9) // selection color
    }
    setName(name) {
        if (this.name !== name) {
            this.name = name
        }

        this.setColor(Utils.hueFromName(name))
    }
    // disconnect
    remove() {
        
    }
}

module.exports =
    class EditorClient extends Client {
        constructor(data, serverAdapter, editorAdapter) {
            // data: {document, revision, clients, operations}
            // [info]:document: plain text, after operations replay, it become rich text
            super(data.revision, data.operations)
            Utils.makeEventEmitter(EditorClient, ['undoStatesChanged', 'clientsChanged'], this)

            this.serverAdapter = serverAdapter
            this.editorAdapter = editorAdapter
            this.undoManager = new UndoManager(50) // maximum history size
            this.clients = {}

            this.serverAdapter.registerCallbacks({
                client_join: (clientObj) => {
                    this.onClientJoin(clientObj)
                },
                client_left: (clientId) => {
                    this.onClientLeft(clientId)
                },
                set_name: (clientId, name) => {
                    this.getClientObject(clientId).setName(name)
                },
                ack: () => {
                    this.serverAck()
                },
                operation: (operation) => {
                    //通知client处理来自服务器的消息
                    this.applyServer(TextOperation.fromJSON(operation))
                },
                disconnect: (reason) => {
                    // TODO ... socket disconnect
                    console.log("disconnect, goto reconnect");
                    this.reconnect();
                },
                reconnect: () => {
                    this.serverReconnect()
                },
                refresh:(message)=>{
                    this.applyRefresh(message)
                }
            })

            this.editorAdapter.registerCallbacks({
                beforeChange: this.onBeforeChange.bind(this),
                change: this.onChange.bind(this),
                focus: this.onFocus.bind(this),
                blur: this.onBlur.bind(this)
            })
            this.editorAdapter.registerUndo(this.undo.bind(this))
            this.editorAdapter.registerRedo(this.redo.bind(this))

            //根据服务端消息格式化编辑器
            this.initClientContent(data)

            //Client.js 将所有的历史记录合并，,结合客户端的TextOperation.document形成当前客户端文档
            //TODO -- 页面刷新-导致本地历史记录为空，如何同步到最新的文本
            //this.initClientContent(this.editorAdapter) //2018-05-04关闭，错误中断了操作
            
            //页面刷新时会继续没有完成的operation，此时compose时operation1.targetLength为0，本地没有任何的历史记录来
            this.initOtherClients(data.clients)
        }

        // 初始化TextOperation，从Client.js copy过来的
        initClientContent() {
            //TODO -- 根据服务端保存的历史记录来初始化文本编辑器，操作记录，用户集合等
            if (this.historyOps && this.historyOps.length) {
                var _ops = this.historyOps.map(wrappedOp => wrappedOp.wrapped)
                //设置的operations参数不正确 sharedPen里 editor.txt是从0开始的
                var initialTextOp = new TextOperation()

                // TODO ...合并服务端发来的操作步骤，这部分内容是否可以放在服务端做？？？
                _ops.forEach((op) => {
                    //由数组格式数据[1,'a',3] 转成 operatios数据{retain.delete,insert} 
                    var _textOp = TextOperation.fromJSON(op)
                    initialTextOp = initialTextOp.compose(_textOp)
                })

                //在EditClient里重写了applyOperation jumpto EditClient.js
                this.applyOperation(initialTextOp,'initClientContent')
            }
        }

        initOtherClients(clients) {
            // init the exist clients
            let allKeys = Object.keys(clients)
            if (allKeys.length) {
                for (var i = 0; i < allKeys.length; i++) {
                    let clientId = allKeys[i]
                    let client = clients[clientId]
                    this.clients[clientId] = new OtherClient(this.editorAdapter, client.id, client.name /*, Selection.fromJSON(client.selection)*/)
                }
                // TODO ... 初始化的 clients 是否通过 ready 传递会更合适
                setTimeout(() => {
                    this.trigger('clientsChanged', this.parseClientsInfo())
                })
            }
        }

        sendOperation(revision, operation) {
            this.serverAdapter.sendOperation(revision, operation.toJSON())
        };

        applyOperation(operation, optTag) {
            //收到服务端数据，通知editor更新数据 -- 原型在Client.js
            console.log("applyOperation", operation)
            //optTag == 'initClientContent' 时，直接操作html填充,否则走本地单步operation
            if(optTag ==='initClientContent'){
                this.editorAdapter.modifyHtml(operation)
            }else{
                this.editorAdapter.applyOperation(operation, optTag)
            }
            //TODO -- undo，redo的数据设置,将他人协作的操作转换成各自对应的新操作
            this.undoManager.transform(new WrappedOperation(operation, null))
        }

        /** ************************* server adapter callbacks ***************************/
        onClientJoin(clientObj) {
            let clientId = clientObj.id
            console.log('User join: ', clientObj)
            this.clients[clientId] = new OtherClient(this.editorAdapter, clientId, clientObj.name)

            this.trigger('clientsChanged', this.parseClientsInfo())
        }
        onClientLeft(clientId) {
            console.log('User left: ', clientId)
            var client = this.clients[clientId]
            if (!client) {
                return
            }
            client.remove()
            delete this.clients[clientId]

            this.trigger('clientsChanged', this.parseClientsInfo())
        }
        parseClientsInfo() {
            return Object.values(this.clients).map(client => ({
                id: client.id,
                name: client.name,
                color: client.color,
                lightColor: client.lightColor
            }))
        }
        getClientObject(clientId) {
            var client = this.clients[clientId]
            if (client) {
                return client
            }
            this.clients[clientId] = new OtherClient(this.editorAdapter, clientId)
            return this.clients[clientId]
        }

        /** ************************* editor adapter callbacks ***************************/
        onBeforeChange() {
            console.log('onBeforeChange')
            this.selectionBefore = this.editorAdapter.getSelection()
        }
        onChange(textOperation, inverse) {
            console.log('--onChange--: ', textOperation)
            //textOperation 是当前操作的步骤  ，如果操作文本长度不变，那么一定是鼠标位置或选取变化了
            if (textOperation.baseLength === textOperation.targetLength) {
                this.selectionBefore = this.editorAdapter.getSelection()
            }

            var last = arr => arr[arr.length - 1]

            //合并本地redo，undo队列，保存的是WrappedOperation对象({meta:{selectionAfter,selectionBefor}},wrapped:{TextOperation})
            var compose = this.undoManager.undoStack.length > 0 && inverse.shouldBeComposedWithInverted(last(this.undoManager.undoStack).wrapped)

            this.undoManager.add(new WrappedOperation(inverse), compose)

            this.applyClient(textOperation)

            this.trigger('undoStatesChanged', {
                canUndo: this.undoManager.canUndo(),
                canRedo: this.undoManager.canRedo()
            })
        }
        onFocus() {

        }
        onBlur() {
            
        }

        undo() {
            if (!this.undoManager.canUndo()) {
                return
            }
            this.undoManager.performUndo((undoOp) => {
                this.applyUnredo(undoOp)
            })
        }
        redo() {
            if (!this.undoManager.canRedo()) {
                return
            }
            this.undoManager.performRedo((redoOp) => {
                this.applyUnredo(redoOp)
            })
        }
        applyUnredo(operation) {
            this.undoManager.add(this.editorAdapter.invertOperation(operation))
            this.editorAdapter.applyOperation(operation.wrapped)
            // send the operation to server
            this.applyClient(operation.wrapped)

            this.trigger('undoStatesChanged', {
                canUndo: this.undoManager.canUndo(),
                canRedo: this.undoManager.canRedo()
            })
        }
    }