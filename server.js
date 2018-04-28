
var EditorSocketIOServer = require('./build/SharedPenServer.js')


var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({
        port: 8181
    });
//服务端websocket    
wss.on('connection', function(ws,wss) {
    console.log('client connected');
    var server = new EditorSocketIOServer(ws,'', [], 1);
    ws.on("open", function() {
        console.log("ws onopen");
    })
    ws.on('message', function(message) {
        console.log(message)
        if (message) {
            let data = JSON.parse(message)
            if(data.command ==="ACK"){
                let clientID = data.data.webSocketID;
                server.addClient(clientID);
            }
            if (data.command  === "formUpdate") {
                if(data.from === 1){
                    return;
                }
                let backMsg = JSON.stringify({
                        identificationID: data.identificationID,
                        command: "formUpdate",
                        from: 1, // 0 表示发起请求,1 表示响应请求
                        data: data.data
                    })
               
                console.log(data.command  + "--" + data.data.content)
                ws.send(backMsg)
            }

        } else {
            //TODO-ws异常
        }
    });
    ws.on("error", function(message) {
        ws.send(message);
        ws.close();
    })
    ws.on("close", function(message) {
        try {
            ws.close();
        } catch (e) {
            //TODO-ws异常
        }
    })
});

//生成随机数
function getRandom() {
    return (Math.random() + (new Date()).getTime().toString()).substr(2)
}

console.log("node WebSocketServer start port:8181 ")
