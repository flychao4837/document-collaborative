'use strict'
const TextOperation = require('./TextOperation.js')

class Client {
    constructor(revision, historyOps, document) {
        this.revision = revision // 操作步骤数，clients之间有可能重复，server端注意排序
        this.historyOps = historyOps //EditClient --(data)-data.operations
        this.state = synchronized_ // start state
        this.document = document
    }
    
    ////用服务端给的摹本，格式化编辑器
    initClientContent() {
        if (this.historyOps && this.historyOps.length) {
            var _ops = this.historyOps.map(wrappedOp => wrappedOp.wrapped)
            var initialTextOp = new TextOperation()

            // TODO ... 这部分内容是否可以放在服务端做？？？
            _ops.forEach((op) => {
                var _textOp = TextOperation.fromJSON(op)
                initialTextOp = initialTextOp.compose(_textOp)
            })

            this.applyOperation(initialTextOp)
        }
    }

    // SubClass Override this method.
    sendOperation(revision, operation) {
        throw new Error('sendOperation must be defined in child class')
    }
        
    // SubClass Override this method.
    applyOperation(operation) {
        throw new Error('applyOperation must be defined in child class')
    }

    setState(state) {
        this.state = state
    }

    // Call this method when the user changes the document.
    applyClient(operation, selection) {
        this.setState(this.state.applyClient(this, operation, selection))
    }
        
    //处理来自服务器的消息
    applyServer(operation, selection) {
        this.revision++
        this.setState(this.state.applyServer(this, operation, selection))
    }
    serverAck() {
        this.revision++
            this.setState(this.state.serverAck(this))
    }
    serverReconnect() {
        if (typeof this.state.resend === 'function') {
            this.setState(this.state.resend(this))
        }
    }

    transformSelection(selection) {
        return this.state.transformSelection(selection)
    }

    //通知服务端强制刷新页面
    applyRefresh(message) {
        alert('操作同步失败，请刷新页面');
        console.log(message)
    }
}

// 
class Synchronized {
    applyClient(client, operation, selection) {
        client.sendOperation(client.revision, operation, selection)
        return new AwaitingConfirm(operation, selection)
    }
    applyServer(client, operation, selection) {

        client.applyOperation(operation, selection)
        return this
    }
    serverAck(client) {
            throw new Error('There is no pending operation.')
        }
    transformSelection(selection) {
        return selection
    }
}

// Singleton
var synchronized_ = new Synchronized()

// 提交操作后，呀接受服务器回应，可能会有对操作的后续修改
class AwaitingConfirm {
    constructor(outstanding, selection) {
        this.outstanding = outstanding
        this.mata = selection
    }

    applyClient(client, operation) {
        return new AwaitingWithBuffer(this.outstanding, operation)
    }
    applyServer(client, operation, selection) {
        var pair = this.outstanding.transform(operation)
        client.applyOperation(pair[1], selection)
        return new AwaitingConfirm(pair[0])
    }
    serverAck(client) {
        return synchronized_
    }
    resend(client) {
        client.sendOperation(client.revision, this.outstanding, this.mata)
    }
    transformSelection(selection) {
        return selection.transform(this.outstanding)
    }
}

//TODO -- 本地操作未及时发送出去时，需要将本地所有操作合并，转换后统一发送
class AwaitingWithBuffer {
    constructor(outstanding, buffering) {
        // Save the pending operation and the user's edits since then
        this.outstanding = outstanding
        this.buffer = buffering
    }

    applyClient(client, operation) {
        var newBuffer = this.buffer.compose(operation)
        return new AwaitingWithBuffer(this.outstanding, newBuffer)
    }
    applyServer(client, operation) {
        var pair1 = this.outstanding.transform(operation)
        var pair2 = this.buffer.transform(pair1[1])
        client.applyOperation(pair2[1])
        return new AwaitingWithBuffer(pair1[0], pair2[0])
    }
    serverAck(client) {
        client.sendOperation(client.revision, this.buffer)
        return new AwaitingConfirm(this.buffer)
    }
    resend(client) {
        client.sendOperation(client.revision, this.outstanding)
    }
    transformSelection(selection) {
        return selection.transform(this.outstanding).transform(this.buffer)
    }
}

module.exports = {
    Client,
    Synchronized,
    AwaitingConfirm,
    AwaitingWithBuffer
}