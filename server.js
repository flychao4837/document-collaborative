var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
// var cors = require('cors')
// var path = require('path')

http.listen(4000, function () {
  console.log('listening on *:4000')
})

var EditorSocketIOServer = require('./build/SharedPenServer.js')
var documents = '<div class="root-elem" data-root-id="1"><p class="section"><br></p></div><div class="root-elem" data-root-id="2"><p class="section"><br></p></div>'
var server = new EditorSocketIOServer(documents, [], 1) //document, operations, docId, mayWrite

io.on('connection', function (socket) {
  server.addClient(socket)
})
