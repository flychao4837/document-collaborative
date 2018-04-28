(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', './WrappedOperation.js'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('./WrappedOperation.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.WrappedOperation);
    global.UndoManager = mod.exports;
  }
})(this, function (module, WrappedOperation) {
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

  var NORMAL_STATE = 'normal';
  var UNDOING_STATE = 'undoing';
  var REDOING_STATE = 'redoing';

  module.exports = function () {
    // Create a new UndoManager with an optional maximum history size.
    function UndoManager(maxItems) {
      _classCallCheck(this, UndoManager);

      this.maxItems = maxItems || 50;
      this.state = NORMAL_STATE;

      this.dontCompose = false;
      // array of WrappedOperation instances
      this.undoStack = [];
      this.redoStack = [];
    }
    // Add an operation to the undo or redo stack, depending on the current state
    // of the UndoManager. The operation added must be the inverse of the last
    // edit. When `compose` is true, compose the operation with the last operation
    // unless the last operation was alread pushed on the redo stack or was hidden
    // by a newer operation on the undo stack.


    _createClass(UndoManager, [{
      key: 'add',
      value: function add(operation, compose) {
        if (this.state === UNDOING_STATE) {
          this.redoStack.push(operation);
          this.dontCompose = true;
        } else if (this.state === REDOING_STATE) {
          this.undoStack.push(operation);
          this.dontCompose = true;
        } else {
          var undoStack = this.undoStack;
          if (!this.dontCompose && compose && undoStack.length > 0) {
            undoStack.push(operation.compose(undoStack.pop()));
          } else {
            undoStack.push(operation);
            if (undoStack.length > this.maxItems) {
              undoStack.shift();
            }
          }
          this.dontCompose = false;
          this.redoStack = [];
        }
      }
    }, {
      key: 'transform',
      value: function transform(operation) {
        this.undoStack = this._transformStack(this.undoStack, operation);
        this.redoStack = this._transformStack(this.redoStack, operation);
      }
    }, {
      key: '_transformStack',
      value: function _transformStack(stack, operation) {
        var newStack = [];
        for (var i = stack.length - 1; i >= 0; i--) {
          var pair = WrappedOperation.transform(stack[i], operation);
          if (typeof pair[0].isNoop !== 'function' || !pair[0].isNoop()) {
            newStack.push(pair[0]);
          }
          operation = pair[1];
        }
        return newStack.reverse();
      }
    }, {
      key: 'performUndo',
      value: function performUndo(fn) {
        this.state = UNDOING_STATE;
        if (!this.canUndo()) {
          throw new Error('can not undo, undo stack is empty');
        }
        fn(this.undoStack.pop());
        this.state = NORMAL_STATE;
      }
    }, {
      key: 'performRedo',
      value: function performRedo(fn) {
        this.state = REDOING_STATE;
        if (!this.canRedo()) {
          throw new Error('can not redo, redo stack is empty');
        }
        fn(this.redoStack.pop());
        this.state = NORMAL_STATE;
      }
    }, {
      key: 'canUndo',
      value: function canUndo() {
        return !!this.undoStack.length;
      }
    }, {
      key: 'canRedo',
      value: function canRedo() {
        return !!this.redoStack.length;
      }
    }, {
      key: 'isUndoing',
      value: function isUndoing() {
        return this.state === UNDOING_STATE;
      }
    }, {
      key: 'isRedoing',
      value: function isRedoing() {
        return this.state === REDOING_STATE;
      }
    }]);

    return UndoManager;
  }();
});