(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', './Utils.js', './Constants.js', './RichTextCodeMirror.js', './RichTextCodeMirrorAdapter.js', './ClientSocketIOAdapter.js', './EditorClient.js'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('./Utils.js'), require('./Constants.js'), require('./RichTextCodeMirror.js'), require('./RichTextCodeMirrorAdapter.js'), require('./ClientSocketIOAdapter.js'), require('./EditorClient.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.Utils, global.Constants, global.RichTextCodeMirror, global.RichTextCodeMirrorAdapter, global.ClientSocketIOAdapter, global.EditorClient);
    global.SharedPen = mod.exports;
  }
})(this, function (module, Utils, _require, RichTextCodeMirror, RichTextCodeMirrorAdapter, ClientSocketIOAdapter, EditorClient) {
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
    function SharedPen(cm, url) {
      var _this = this;

      _classCallCheck(this, SharedPen);

      if (!window.CodeMirror) {
        throw new Error('Couldn\'t find CodeMirror. Did you forget to include codemirror.js?');
      }
      if (!window.io) {
        throw new Error('Couldn\'t find SocketIO. Did you forget to include socket.io.js?');
      }

      // initialize CodeMirror
      var textarea = cm;
      if (typeof cm === 'string') {
        textarea = document.querySelector(cm);
      }
      this.cm = window.CodeMirror.fromTextArea(textarea, {
        lineNumbers: false,
        lineWrapping: true,
        cursorHeight: 0.88
      });
      var _cmWrapper = this.cm.getWrapperElement(); // . CodeMirror-wrap
      _cmWrapper.parentNode.addEventListener('click', function () {
        _this.cm.focus();
      });

      this._sharedpenWrapper = Utils.elt('div', null, { class: 'sharedpen-wrapper' });
      _cmWrapper.parentNode.replaceChild(this._sharedpenWrapper, _cmWrapper);
      this._sharedpenWrapper.appendChild(_cmWrapper);

      Utils.makeEventEmitter(SharedPen, ['ready', 'realtimeTextAttrsChanged', 'undoStatesChanged', 'clientsChanged'], this);

      // rich text codemirror
      this.rtcm = new RichTextCodeMirror(this.cm);
      // rich text codemirror adapter
      this.rtcmAdapter = new RichTextCodeMirrorAdapter(this.rtcm);

      // TODO ... 创建 socket 应该放到 ClientSocketIOAdapter 是否更合适 ???
      var socket = window.io(url);
      socket.on('doc', function (data) {
        _this.socketIOAdapter = new ClientSocketIOAdapter(socket);
        _this.client = new EditorClient(data, _this.socketIOAdapter, _this.rtcmAdapter);
        // 监听实时文本属性变化
        _this.rtcm.on('realtimeTextAttrsChanged', _this.trigger.bind(_this, 'realtimeTextAttrsChanged'));
        // 监听实时 canUndo/canRedo 变化
        _this.client.on('undoStatesChanged', _this.trigger.bind(_this, 'undoStatesChanged'));
        // 监听协同用户变化
        _this.client.on('clientsChanged', _this.trigger.bind(_this, 'clientsChanged'));
        _this.trigger('ready');
      });

      if (!window.CodeMirror.keyMap['sharedpen']) {
        this.initializeKeyMap_();
      }
      this.cm.setOption('keyMap', 'sharedpen');
    }

    _createClass(SharedPen, [{
      key: 'initializeKeyMap_',
      value: function initializeKeyMap_() {
        function binder(fn) {
          return function (cm) {
            // HACK: CodeMirror will often call our key handlers within a cm.operation(), and that
            // can mess us up (we rely on events being triggered synchronously when we make CodeMirror
            // edits).  So to escape any cm.operation(), we do a setTimeout.
            setTimeout(fn, 0);
          };
        }
        // TODO
        window.CodeMirror.keyMap['sharedpen'] = {
          // basic
          'Ctrl-B': binder(this.bold.bind(this)),
          'Cmd-B': binder(this.bold.bind(this)),
          'Ctrl-I': binder(this.italic.bind(this)),
          'Cmd-I': binder(this.italic.bind(this)),
          'Ctrl-U': binder(this.underline.bind(this)),
          'Cmd-U': binder(this.underline.bind(this)),
          'Shift-Cmd-X': binder(this.strike.bind(this)),
          'Shift-Ctrl-X': binder(this.strike.bind(this)),
          // align
          'Shift-Cmd-L': binder(this.align.bind(this, 'left')),
          'Shift-Ctrl-L': binder(this.align.bind(this, 'left')),
          'Shift-Cmd-E': binder(this.align.bind(this, 'center')),
          'Shift-Ctrl-E': binder(this.align.bind(this, 'center')),
          'Shift-Cmd-R': binder(this.align.bind(this, 'right')),
          'Shift-Ctrl-R': binder(this.align.bind(this, 'right')),
          'Shift-Cmd-J': binder(this.align.bind(this, 'justify')),
          'Shift-Ctrl-J': binder(this.align.bind(this, 'justify')),
          // list
          'Shift-Cmd-7': binder(this.orderedList.bind(this)),
          'Shift-Ctrl-7': binder(this.orderedList.bind(this)),
          'Shift-Cmd-8': binder(this.unorderedList.bind(this)),
          'Shift-Ctrl-8': binder(this.unorderedList.bind(this)),
          'Shift-Cmd-9': binder(this.todoList.bind(this)),
          'Shift-Ctrl-9': binder(this.todoList.bind(this)),
          // indent/unindent
          'Cmd-]': binder(this.indent.bind(this)),
          'Ctrl-]': binder(this.indent.bind(this)),
          'Cmd-[': binder(this.unindent.bind(this)),
          'Ctrl-[': binder(this.unindent.bind(this)),
          // insert link
          'Cmd-K': binder(this.insertLink.bind(this)),
          'Ctrl-K': binder(this.insertLink.bind(this)),
          // clear format
          'Cmd-\\': binder(this.clearFormat.bind(this)),
          'Ctrl-\\': binder(this.clearFormat.bind(this)),

          'Enter': binder(this.newline.bind(this)),
          'Delete': binder(this.deleteRight.bind(this)),
          'Backspace': binder(this.deleteLeft.bind(this)),
          'Tab': binder(this.indent.bind(this)),
          'Shift-Tab': binder(this.unindent.bind(this)),
          fallthrough: ['default']
        };
      }
    }, {
      key: 'undo',
      value: function undo() {
        this.client.undo();
      }
    }, {
      key: 'redo',
      value: function redo() {
        this.client.redo();
      }
    }, {
      key: 'format',
      value: function format() {
        this.rtcm.format();
        this.cm.focus();
      }
    }, {
      key: 'clearFormat',
      value: function clearFormat() {
        this.rtcm.clearFormat();
        this.cm.focus();
      }
    }, {
      key: 'bold',
      value: function bold() {
        this.rtcm.toggleAttribute(AttributeConstants.BOLD);
        this.cm.focus();
      }
    }, {
      key: 'italic',
      value: function italic() {
        this.rtcm.toggleAttribute(AttributeConstants.ITALIC);
        this.cm.focus();
      }
    }, {
      key: 'underline',
      value: function underline() {
        this.rtcm.toggleAttribute(AttributeConstants.UNDERLINE);
        this.cm.focus();
      }
    }, {
      key: 'strike',
      value: function strike() {
        this.rtcm.toggleAttribute(AttributeConstants.STRIKE);
        this.cm.focus();
      }
    }, {
      key: 'fontSize',
      value: function fontSize(size) {
        this.rtcm.setAttribute(AttributeConstants.FONT_SIZE, size);
        this.cm.focus();
      }
    }, {
      key: 'font',
      value: function font(_font) {
        this.rtcm.setAttribute(AttributeConstants.FONT, _font);
        this.cm.focus();
      }
    }, {
      key: 'color',
      value: function color(_color) {
        this.rtcm.setAttribute(AttributeConstants.COLOR, _color);
        this.cm.focus();
      }
    }, {
      key: 'highlight',
      value: function highlight(color) {
        // set background
        this.rtcm.toggleAttribute(AttributeConstants.BACKGROUND_COLOR, color);
        this.cm.focus();
      }
    }, {
      key: 'align',
      value: function align(alignment) {
        if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right' && alignment !== 'justify') {
          throw new Error('align() must be passed "left", "center", or "right".');
        }
        this.rtcm.setLineAttribute(AttributeConstants.LINE_ALIGN, alignment);
        this.cm.focus();
      }
    }, {
      key: 'newline',
      value: function newline() {
        this.rtcm.newline();
      }
    }, {
      key: 'deleteLeft',
      value: function deleteLeft() {
        this.rtcm.deleteLeft();
      }
    }, {
      key: 'deleteRight',
      value: function deleteRight() {
        this.rtcm.deleteRight();
      }
    }, {
      key: 'indent',
      value: function indent() {
        this.rtcm.indent();
        this.cm.focus();
      }
    }, {
      key: 'unindent',
      value: function unindent() {
        this.rtcm.unindent();
        this.cm.focus();
      }
    }, {
      key: 'orderedList',
      value: function orderedList() {
        this.rtcm.toggleLineAttribute(AttributeConstants.LIST_TYPE, 'o');
        this.cm.focus();
      }
    }, {
      key: 'unorderedList',
      value: function unorderedList() {
        this.rtcm.toggleLineAttribute(AttributeConstants.LIST_TYPE, 'u');
        this.cm.focus();
      }
    }, {
      key: 'todoList',
      value: function todoList() {
        this.rtcm.toggleTodo();
        this.cm.focus();
      }
    }, {
      key: 'insertLink',
      value: function insertLink() {}
    }, {
      key: 'insertImage',
      value: function insertImage() {}
    }, {
      key: 'insertEntity',
      value: function insertEntity(type, info, origin) {
        this.rtcm.insertEntityAtCursor(type, info, origin);
      }
    }, {
      key: 'insertEntityAt',
      value: function insertEntityAt(index, type, info, origin) {
        this.rtcm.insertEntityAt(index, type, info, origin);
      }
    }]);

    return SharedPen;
  }();
});