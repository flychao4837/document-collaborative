//togetherClient 用户端入口
'use strict'
const Utils = require('./Utils.js')
const { AttributeConstants } = require('./Constants.js')
const RichTextCodeMirror = require('./RichTextCodeMirror.js')
const RichTextCodeMirrorAdapter = require('./RichTextCodeMirrorAdapter.js')
const ClientSocketIOAdapter = require('./ClientSocketIOAdapter.js')
const EditorClient = require('./EditorClient.js')

const historyOperater = require('./historyOperater.js')


module.exports = class togetherClient {
	constructor(editorDomID,url) {
		if(!editorDomID){
			throw new Error(`initEditor error:编辑器初始化DomID错误`);
		}
		if(!window.wangEditor){
			alert(`没找到editor构造函数`);
		}
		if (!window.io) {
	      	throw new Error(`没有找到socket.io`)
	    }
	    if(window.rangy){
	    	//rangy.init();
	    }
		let Editor = window.wangEditor
		//代理，绑定编辑器相关自定义事件
		this.cm = new Editor(editorDomID);

		//给当前类绑定事件
		Utils.makeEventEmitter(togetherClient, ['ready', 'realtimeTextAttrsChanged', 'undoStatesChanged', 'clientsChanged'], this)

		//编辑器实例
		this.rtcm = new RichTextCodeMirror(this.cm); //{editor,entityMange}
		//编辑器绑定的 change，focus，blur相关事件
		this.rtcmAdapter = new RichTextCodeMirrorAdapter(this.rtcm)

		var socket = window.io(url)
		//从服务端获取数据 data --> {document,clients,operations,versions}
		socket.on('doc', (data) => {
			this.socketIOAdapter = new ClientSocketIOAdapter(socket)
			this.client = new EditorClient(data, this.socketIOAdapter, this.rtcmAdapter)
			// 监听实时文本属性变化
			this.rtcm.on('realtimeTextAttrsChanged', this.trigger.bind(this, 'realtimeTextAttrsChanged'))
			// 监听实时 canUndo/canRedo 变化
			this.client.on('undoStatesChanged', this.trigger.bind(this, 'undoStatesChanged'))
			// 监听协同用户变化
			this.client.on('clientsChanged', this.trigger.bind(this, 'clientsChanged'))
			this.trigger('ready')
		})

		//页面交互
		this.bindCustomAct();
	}

	bindCustomAct(){
		let _this = this;
		let editor = _this.rtcm;

		jquery('#btn1').on('click', function () {
			var start = +new Date();
			var ctx = editor.getEditorCtx();
			var htmlElem = editor.cleanHtmlElem(ctx);
			console.log(htmlElem);
			var json = editor.getChildrenJSON(htmlElem);
			var jsonStr = JSON.stringify(json);
			console.log(json);
			console.log(jsonStr);
		});

		jquery('#btn2').on('click', function () {
			var start = +new Date();
			var txt = editor.getCleanHtml();
			editor.setContent(txt);

			console.log("清理用时:", +new Date() - start);
			console.log("html文本字符长度:", txt.length);
		});

		jquery('#btn3').on('click', function () {
			console.log("获取当前用户鼠标选区");
			editor.getUserCursorOffset();
		});

		jquery('#btn4').on('click', function () {
			console.log("设置新的用户鼠标选区");
		});
	}
}
//生成随机数
function getRandom() {
    return (Math.random() + (new Date()).getTime().toString()).substr(2)
}