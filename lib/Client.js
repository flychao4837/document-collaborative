'use strict'
const TextOperation = require('./TextOperation.js')

class Client {
  constructor (revision, historyOps, document) {
    this.revision = revision // the next expected revision number
    this.historyOps = historyOps //Note EditClient --(data)-data.operations
    this.state = synchronized_ // start state
    this.document = document
  }
  ////用服务端给的摹本，格式变化编辑器
  initClientContent () {
    // init the editor content with historyOps
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
  sendOperation (revision, operation) {
    throw new Error('sendOperation must be defined in child class')
  }
  // SubClass Override this method.
  applyOperation (operation) {
    throw new Error('applyOperation must be defined in child class')
  }

  setState (state) {
    this.state = state
  }

  // Call this method when the user changes the document.
  applyClient (operation,selection) {
    this.setState(this.state.applyClient(this, operation, selection))
  }
  // Call this method with a new operation from the server
  applyServer (operation, selection) {
    //处理来自服务器的消息
    this.revision ++
    this.setState(this.state.applyServer(this, operation, selection))
  }
  serverAck () {
    this.revision ++
    this.setState(this.state.serverAck(this))
  }
  serverReconnect () {
    if (typeof this.state.resend === 'function') {
      this.setState(this.state.resend(this))
    }
  }

  // Transforms a selection from the latest known server state to the current
  // client state. For example, if we get from the server the information that
  // another user's cursor is at position 3, but the server hasn't yet received
  // our newest operation, an insertion of 5 characters at the beginning of the
  // document, the correct position of the other user's cursor in our current
  // document is 8.
  transformSelection (selection) {
    return this.state.transformSelection(selection)
  }

  //通知服务端强制刷新页面
  applyRefresh(message){
    alert('操作同步失败，请刷新页面');
    console.log(message)
  }
}

// In the 'Synchronized' state, there is no pending operation that the client
// has sent to the server.
class Synchronized {
  applyClient (client, operation, selection) {
    // When the user makes an edit, send the operation to the server and
    // switch to the 'AwaitingConfirm' state
    client.sendOperation(client.revision, operation, selection)
    console.log("applyClient Synchronized",client, operation, selection)
    return new AwaitingConfirm(operation, selection)
  }
  applyServer (client, operation, selection) {
    // When we receive a new operation from the server, the operation can be
    // simply applied to the current document
    client.applyOperation(operation, selection)
    return this
  }
  serverAck (client) {
    throw new Error('There is no pending operation.')
  }
  // Nothing to do because the latest server state and client state are the same.
  transformSelection (selection) {
    return selection
  }
}

// Singleton
var synchronized_ = new Synchronized()

// In the 'AwaitingConfirm' state, there's one operation the client has sent
// to the server and is still waiting for an acknowledgement.
class AwaitingConfirm {
  constructor (outstanding, selection) {
    // Save the pending operation
    this.outstanding = outstanding
    this.mata = selection
  }

  applyClient (client, operation) {
    // When the user makes an edit, don't send the operation immediately,
    // instead switch to 'AwaitingWithBuffer' state
    return new AwaitingWithBuffer(this.outstanding, operation)
  }
  applyServer (client, operation, selection) {
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
    var pair = this.outstanding.transform(operation)
    client.applyOperation(pair[1], selection)
    return new AwaitingConfirm(pair[0])
  }
  serverAck (client) {
    // The client's operation has been acknowledged
    // => switch to synchronized state
    return synchronized_
  }
  resend (client) {
    // The confirm didn't come because the client was disconnected.
    // Now that it has reconnected, we resend the outstanding operation.
    console.log("AwaitingConfirm resend",client.revision, this.outstanding, this.mata)
    client.sendOperation(client.revision, this.outstanding, this.mata)
  }
  transformSelection (selection) {
    return selection.transform(this.outstanding)
  }
}

// In the 'AwaitingWithBuffer' state, the client is waiting for an operation
// to be acknowledged by the server while buffering the edits the user makes
class AwaitingWithBuffer {
  constructor (outstanding, buffering) {
    // Save the pending operation and the user's edits since then
    this.outstanding = outstanding
    this.buffer = buffering
  }

  applyClient (client, operation) {
    // Compose the user's changes onto the buffer
    var newBuffer = this.buffer.compose(operation)
    return new AwaitingWithBuffer(this.outstanding, newBuffer)
  }
  applyServer (client, operation) {
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
    var pair1 = this.outstanding.transform(operation)
    var pair2 = this.buffer.transform(pair1[1])
    console.log("AwaitingWithBuffer applyServer 转换后",pair2[1])
    client.applyOperation(pair2[1])
    return new AwaitingWithBuffer(pair1[0], pair2[0])
  }
  serverAck (client) {
    // The pending operation has been acknowledged
    // => send buffer
    client.sendOperation(client.revision, this.buffer)
    return new AwaitingConfirm(this.buffer)
  }
  resend (client) {
    // The confirm didn't come because the client was disconnected.
    // Now that it has reconnected, we resend the outstanding operation.
    client.sendOperation(client.revision, this.outstanding)
  }
  transformSelection (selection) {
    return selection.transform(this.outstanding).transform(this.buffer)
  }
}

module.exports = {
  Client, Synchronized, AwaitingConfirm, AwaitingWithBuffer
}
