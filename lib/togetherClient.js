//togetherClient 用户端入口
'use strict'
const Utils = require('./Utils.js')
const RichTextEditor = require('./RichTextEditor.js')
const RichTextEditorAdapter = require('./RichTextEditorAdapter.js')
const ClientSocketIOAdapter = require('./ClientSocketIOAdapter.js')
const EditorClient = require('./EditorClient.js')

const historyOperater = require('./historyOperater.js')


module.exports = class togetherClient {
	constructor(editorDomID,url) {
		if(!editorDomID){
			throw new Error(`initEditor error:编辑器初始化DomID错误`);
		}
		//绑定对应的富文本编辑器
		if(!window.wangEditor){
			alert(`没找到editor构造函数`);
		}
		if (!window.io) {
	      	throw new Error(`没有找到socket.io`)
	    }

		let Editor = window.wangEditor
		//代理，绑定编辑器相关自定义事件
		this.editor = new Editor(editorDomID);

		//给当前类绑定事件
		Utils.makeEventEmitter(togetherClient, ['ready', 'undoStatesChanged', 'clientsChanged'], this)

		//编辑器实例
		this.editorCtx = new RichTextEditor(this.editor); //{editor,entityMange}
		//编辑器绑定的 change，focus，blur相关事件
		this.editorAdapter = new RichTextEditorAdapter(this.editorCtx)

		var socket = window.io(url)
		//从服务端获取数据 data --> {document,clients,operations,versions}
		socket.on('doc', (data) => {
			console.log("收到服务端传送数据", data)
			this.socketIOAdapter = new ClientSocketIOAdapter(socket)
			this.client = new EditorClient(data, this.socketIOAdapter, this.editorAdapter)
			
			// 监听实时 canUndo/canRedo 变化
			this.client.on('undoStatesChanged', this.trigger.bind(this, 'undoStatesChanged'))
			
			// 监听协同用户变化
			this.client.on('clientsChanged', this.trigger.bind(this, 'clientsChanged'))
			this.trigger('ready')
		})
	}
}
//生成随机数
function getRandom() {
    return (Math.random() + (new Date()).getTime().toString()).substr(2)
}