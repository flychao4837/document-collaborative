var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)


http.listen(4000, function () {
  console.log('listening on *:4000')
})

var EditorSocketIOServer = require('./build/SharedPenServer.js')
var documents = '<div class="root-elem" data-root-id="1"><p class="section">默认为从服务端取到文本信息<br></p></div>'
var server = new EditorSocketIOServer(documents, [], 1) //document, operations, docId, mayWrite

io.on('connection', function (socket) {
  server.addClient(socket)
})
