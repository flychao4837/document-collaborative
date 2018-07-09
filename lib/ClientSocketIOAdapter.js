'use strict'

module.exports =
    class ClientSocketIOAdapter {
        constructor(socket) {
            this.socket = socket
            socket
                .on('client_join', (clientObj) => {
                    this.trigger('client_join', clientObj)
                })
                .on('client_left', (clientId) => {
                    this.trigger('client_left', clientId)
                })
                .on('ack', () => {
                    console.log("-ack-ClientSocketIOAdapter")
                    this.trigger('ack')
                })
                .on('operation', (clientId, operation) => {
                    this.trigger('operation', operation)
                })
                .on('disconnect', (reason) => {
                    this.trigger('disconnect', reason)
                })
                .on('reconnect', () => {
                    this.trigger('reconnect')
                })
                .on('refresh', (message) => {
                    this.trigger('refresh', message)
                })
        }

        //发送操作给服务器
        sendOperation(revision, operation) {
            this.socket.emit('operation', revision, operation)
        }

        //注册所有自定义回调
        registerCallbacks(cbs) {
            this.callbacks = cbs
        }

        //手动触发回调
        trigger(event, ...restArgs) {
            var action = this.callbacks && this.callbacks[event]
            if (action) {
                action.apply(this, restArgs)
            }
        }
    }