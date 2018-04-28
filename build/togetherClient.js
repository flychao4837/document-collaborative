(function (global, factory) {
	if (typeof define === "function" && define.amd) {
		define(['module', './Utils.js', './Constants.js', './RichTextCodeMirror.js', './RichTextCodeMirrorAdapter.js', './ClientSocketIOAdapter.js', './EditorClient.js', './jquery-1.10.2.min.js', './historyOperater.js', 'ws.js'], factory);
	} else if (typeof exports !== "undefined") {
		factory(module, require('./Utils.js'), require('./Constants.js'), require('./RichTextCodeMirror.js'), require('./RichTextCodeMirrorAdapter.js'), require('./ClientSocketIOAdapter.js'), require('./EditorClient.js'), require('./jquery-1.10.2.min.js'), require('./historyOperater.js'), require('ws.js'));
	} else {
		var mod = {
			exports: {}
		};
		factory(mod, global.Utils, global.Constants, global.RichTextCodeMirror, global.RichTextCodeMirrorAdapter, global.ClientSocketIOAdapter, global.EditorClient, global.jquery1102Min, global.historyOperater, global.ws);
		global.togetherClient = mod.exports;
	}
})(this, function (module, Utils, _require, RichTextCodeMirror, RichTextCodeMirrorAdapter, ClientSocketIOAdapter, EditorClient, Jquery, historyOperater, ws) {
	//togetherClient 用户端入口
	'use strict';

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

	var AttributeConstants = _require.AttributeConstants;


	module.exports = function () {
		function togetherClient(editorDomID, url) {
			_classCallCheck(this, togetherClient);

			if (!editorDomID) {
				throw new Error('initEditor error:\u7F16\u8F91\u5668\u521D\u59CB\u5316DomID\u9519\u8BEF');
			}
			if (!window.wangEditor) {
				alert('\u6CA1\u627E\u5230editor\u6784\u9020\u51FD\u6570');
			}
			if (!window.io) {
				throw new Error('\u6CA1\u6709\u627E\u5230socket.io');
			}
			var Editor = window.wangEditor;
			//代理，绑定编辑器相关自定义事件
			this.cm = new Editor(editorDomID);

			//Utils.makeEventEmitter(SharedPen, ['ready', 'realtimeTextAttrsChanged', 'undoStatesChanged', 'clientsChanged'], this)

			//编辑器实例
			this.rtcm = new RichTextCodeMirror(this.cm); //{editor,entityMange}
			//编辑器绑定的 change，focus，blur相关事件
			this.rtcmAdapter = new RichTextCodeMirrorAdapter(this.rtcm);

			//创建 socket 应该放到 ClientSocketIOAdapter 是否更合适 ???
			// var socket = window.io(url)
			// socket.on('doc', (data) => {
			// 	this.socketIOAdapter = new ClientSocketIOAdapter(socket)
			// 	this.client = new EditorClient(data, this.socketIOAdapter, this.rtcmAdapter)
			// 	// 监听实时文本属性变化
			// 	this.rtcm.on('realtimeTextAttrsChanged', this.trigger.bind(this, 'realtimeTextAttrsChanged'))
			// 	// 监听实时 canUndo/canRedo 变化
			// 	this.client.on('undoStatesChanged', this.trigger.bind(this, 'undoStatesChanged'))
			// 	// 监听协同用户变化
			// 	this.client.on('clientsChanged', this.trigger.bind(this, 'clientsChanged'))
			// 	this.trigger('ready')
			// })

			//页面交互
			this.bindCustomAct(Jquery);
		}

		_createClass(togetherClient, [{
			key: 'bindCustomAct',
			value: function bindCustomAct(Jquery) {
				var _this = this;
				var editor = _this.rtcm;
				Jquery('#btn1').on('click', function () {
					var start = +new Date();
					var ctx = editor.getEditorCtx();
					var htmlElem = editor.cleanHtmlElem(ctx);
					console.log(htmlElem);
					var json = editor.getChildrenJSON(htmlElem);
					var jsonStr = JSON.stringify(json);
					console.log(json);
					console.log(jsonStr);
				});

				Jquery('#btn2').on('click', function () {
					var start = +new Date();
					var txt = editor.getCleanHtml();
					editor.setContent(txt);

					console.log("清理用时:", +new Date() - start);
					console.log("html文本字符长度:", txt.length);
				});

				Jquery('#btn3').on('click', function () {
					console.log("获取当前用户鼠标选区");
					editor.getUserCursorOffset();
				});

				Jquery('#btn4').on('click', function () {
					console.log("设置新的用户鼠标选区");
				});
			}
		}]);

		return togetherClient;
	}();
	//生成随机数
	function getRandom() {
		return (Math.random() + new Date().getTime().toString()).substr(2);
	}
});