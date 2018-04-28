(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', './Utils.js', './Selection.js', './TextOperation.js', './WrappedOperation.js'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('./Utils.js'), require('./Selection.js'), require('./TextOperation.js'), require('./WrappedOperation.js'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.Utils, global.Selection, global.TextOperation, global.WrappedOperation);
        global.RichTextCodeMirrorAdapter = mod.exports;
    }
})(this, function (module, Utils, _require, TextOperation, WrappedOperation) {
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

    var Range = _require.Range,
        Selection = _require.Selection;


    function minPos(a, b) {
        return Utils.posLe(a, b) ? a : b;
    }
    function maxPos(a, b) {
        return Utils.posLe(a, b) ? b : a;
    }
    // codemirror current length
    function codemirrorLength(cm) {
        var lastLine = cm.lineCount() - 1;
        return cm.indexFromPos({
            line: lastLine,
            ch: cm.getLine(lastLine).length
        });
    }
    var addStyleRule = function () {
        var added = {};
        var styleSheet;

        return function (css) {
            if (added[css]) {
                return;
            }
            added[css] = true;

            if (!styleSheet) {
                var styleElement = document.createElement('style');
                var root = document.documentElement.getElementsByTagName('head')[0];
                root.appendChild(styleElement);
                styleSheet = styleElement.sheet;
            }
            styleSheet.insertRule(css, (styleSheet.cssRules || styleSheet.rules).length);
        };
    }();

    // editor adapter
    module.exports = function () {
        // cmtm: instance of RichTextCodeMirror
        // cm: instance of CodeMirror
        function RichTextCodeMirrorAdapter(rtcm) {
            _classCallCheck(this, RichTextCodeMirrorAdapter);

            this.rtcm = rtcm;
            this.cm = rtcm.editor;

            this.rtcm.on('change', this.onChange, this);
            this.rtcm.on('attributesChange', this.onAttributesChange, this);

            this.cm.$textContainerElem.on('beforeChange', this.trigger.bind(this, 'beforeChange'));
            this.cm.$textContainerElem.on('cursorActivity', this.onCursorActivity.bind(this));
            this.cm.$textContainerElem.on('focus', this.onFocus.bind(this));
            this.cm.$textContainerElem.on('blur', this.onBlur.bind(this));
        }
        // Removes all event listeners from the CodeMirrorror instance.


        _createClass(RichTextCodeMirrorAdapter, [{
            key: 'detach',
            value: function detach() {
                this.rtcm.off('change', this.onChange);
                this.rtcm.off('attributesChange', this.onAttributesChange);

                this.cm.off('cursorActivity', this.onCursorActivity.bind(this));
                this.cm.off('focus', this.onFocus.bind(this));
                this.cm.off('blur', this.onBlur.bind(this));
            }
        }, {
            key: 'onChange',
            value: function onChange(rtcm, changes) {
                if (changes && Object.keys(changes)) {
                    //origin来源识别，+input时输入，其他还有toobar的变化等等
                    //pair 包含正序的[0]operation 和反序的[1]inverse两部分
                    var pair = RichTextCodeMirrorAdapter.operationFromCodeMirrorChanges(changes, this.cm);
                    this.trigger('change', pair[0], pair[1]); //跳往EditorClient-onChange
                }
            }
        }, {
            key: 'onAttributesChange',
            value: function onAttributesChange(_, changes) {
                if (changes[0].origin !== 'RTCMADAPTER') {
                    var pair = RichTextCodeMirrorAdapter.operationFromAttributesChanges(changes, this.cm);
                    this.trigger('change', pair[0], pair[1]);
                }
            }
        }, {
            key: 'onCursorActivity',
            value: function onCursorActivity() {
                this.trigger('selectionChange');
            }
        }, {
            key: 'onFocus',
            value: function onFocus() {
                this.trigger('focus');
            }
        }, {
            key: 'onBlur',
            value: function onBlur() {
                if (!this.cm.somethingSelected()) {
                    this.trigger('blur');
                }
            }
        }, {
            key: 'trigger',
            value: function trigger(event) {
                var args = Array.prototype.slice.call(arguments, 1);
                var action = this.callbacks && this.callbacks[event];
                if (action) {
                    action.apply(this, args);
                }
            }
        }, {
            key: 'registerCallbacks',
            value: function registerCallbacks(cbs) {
                this.callbacks = cbs;
            }
        }, {
            key: 'registerUndo',
            value: function registerUndo(fn) {
                this.cm.undo = fn;
            }
        }, {
            key: 'registerRedo',
            value: function registerRedo(fn) {
                this.cm.redo = fn;
            }
        }, {
            key: 'getSelection',
            value: function getSelection() {
                var cm = this.cm;

                var selectionList = cm.listSelections();
                var ranges = [];
                for (var i = 0; i < selectionList.length; i++) {
                    ranges[i] = new Range(cm.indexFromPos(selectionList[i].anchor), cm.indexFromPos(selectionList[i].head));
                }

                return new Selection(ranges);
            }
        }, {
            key: 'setSelection',
            value: function setSelection(selection) {
                var ranges = [];
                for (var i = 0; i < selection.ranges.length; i++) {
                    var range = selection.ranges[i];
                    ranges[i] = {
                        anchor: this.cm.posFromIndex(range.anchor),
                        head: this.cm.posFromIndex(range.head)
                    };
                }
                this.cm.setSelections(ranges);
            }
        }, {
            key: 'applyOperation',
            value: function applyOperation(operation) {
                // HACK: If there are a lot of operations; hide CodeMirror so that it doesn't re-render constantly.
                //将服务器消息传来的数据，传递给editor（this.rtcm）
                if (operation.ops.length > 10) {
                    this.rtcm.codeMirror.getWrapperElement().setAttribute('style', 'display: none');
                }

                var ops = operation.ops;
                var index = 0; // holds the current index into CodeMirror's content
                for (var i = 0, l = ops.length; i < l; i++) {
                    var op = ops[i];
                    if (op.isRetain()) {
                        if (!Utils.emptyAttributes(op.attributes)) {
                            this.rtcm.updateTextAttributes(index, index + op.chars, function (attributes) {
                                for (var attr in op.attributes) {
                                    if (op.attributes[attr] === false) {
                                        delete attributes[attr];
                                    } else {
                                        attributes[attr] = op.attributes[attr];
                                    }
                                }
                            }, 'RTCMADAPTER', /* doLineAttributes= */true);
                        }
                        index += op.chars;
                    } else if (op.isInsert()) {
                        this.rtcm.insertText(index, op.text, op.attributes, 'RTCMADAPTER');
                        index += op.text.length;
                    } else if (op.isDelete()) {
                        this.rtcm.removeText(index, index + op.chars, 'RTCMADAPTER');
                    }
                }

                if (operation.ops.length > 10) {
                    this.rtcm.codeMirror.getWrapperElement().setAttribute('style', '');
                    this.rtcm.codeMirror.refresh();
                }
            }
        }, {
            key: 'invertOperation',
            value: function invertOperation(operation) {
                var pos = 0;
                var cm = this.rtcm.codeMirror;
                var spans;
                var i;
                var inverse = new TextOperation();
                for (var opIndex = 0; opIndex < operation.wrapped.ops.length; opIndex++) {
                    var op = operation.wrapped.ops[opIndex];
                    if (op.isRetain()) {
                        if (Utils.emptyAttributes(op.attributes)) {
                            inverse.retain(op.chars);
                            pos += op.chars;
                        } else {
                            spans = this.rtcm.getAttributeSpans(pos, pos + op.chars);
                            for (i = 0; i < spans.length; i++) {
                                var inverseAttributes = {};
                                for (var attr in op.attributes) {
                                    var opValue = op.attributes[attr];
                                    var curValue = spans[i].attributes[attr];

                                    if (opValue === false) {
                                        if (curValue) {
                                            inverseAttributes[attr] = curValue;
                                        }
                                    } else if (opValue !== curValue) {
                                        inverseAttributes[attr] = curValue || false;
                                    }
                                }

                                inverse.retain(spans[i].length, inverseAttributes);
                                pos += spans[i].length;
                            }
                        }
                    } else if (op.isInsert()) {
                        inverse.delete(op.text.length);
                    } else if (op.isDelete()) {
                        var text = cm.getRange(cm.posFromIndex(pos), cm.posFromIndex(pos + op.chars));

                        spans = this.rtcm.getAttributeSpans(pos, pos + op.chars);
                        var delTextPos = 0;
                        for (i = 0; i < spans.length; i++) {
                            inverse.insert(text.substr(delTextPos, spans[i].length), spans[i].attributes);
                            delTextPos += spans[i].length;
                        }

                        pos += op.chars;
                    }
                }

                return new WrappedOperation(inverse, operation.meta.invert());
            }
        }, {
            key: 'setOtherSelection',
            value: function setOtherSelection(selection, color, clientId) {
                var selectionObjects = [];
                for (var i = 0; i < selection.ranges.length; i++) {
                    var range = selection.ranges[i];
                    if (range.isEmpty()) {
                        // cursor
                        selectionObjects[i] = this.setOtherCursor(range.head, color, clientId);
                    } else {
                        // selection
                        selectionObjects[i] = this.setOtherSelectionRange(range, color, clientId);
                    }
                }
                return {
                    clear: function clear() {
                        for (var i = 0; i < selectionObjects.length; i++) {
                            selectionObjects[i].clear();
                        }
                    }
                };
            }
        }, {
            key: 'setOtherCursor',
            value: function setOtherCursor(position, color, clientId) {
                var cursorPos = this.cm.posFromIndex(position);
                var cursorCoords = this.cm.cursorCoords(cursorPos);
                var cursorEl = document.createElement('span');
                cursorEl.className = 'other-client';
                cursorEl.style.display = 'inline';
                cursorEl.style.padding = '0';
                cursorEl.style.marginLeft = cursorEl.style.marginRight = '-1px';
                cursorEl.style.borderLeftWidth = '2px';
                cursorEl.style.borderLeftStyle = 'solid';
                cursorEl.style.borderLeftColor = color;
                cursorEl.style.height = cursorCoords.bottom - cursorCoords.top + 'px';
                cursorEl.style.transform = 'translateY(2px)';
                cursorEl.style.zIndex = 0;
                cursorEl.setAttribute('data-clientid', clientId);
                return this.cm.setBookmark(cursorPos, { widget: cursorEl, insertLeft: true });
            }
        }, {
            key: 'setOtherSelectionRange',
            value: function setOtherSelectionRange(range, color, clientId) {
                var match = /^#([0-9a-fA-F]{6})$/.exec(color);
                if (!match) {
                    throw new Error('only six-digit hex colors are allowed.');
                }
                var selectionClassName = 'selection-' + match[1];
                var rule = '.' + selectionClassName + ' { background: ' + color + '; }';
                addStyleRule(rule);

                var anchorPos = this.cm.posFromIndex(range.anchor);
                var headPos = this.cm.posFromIndex(range.head);

                return this.cm.markText(minPos(anchorPos, headPos), maxPos(anchorPos, headPos), { className: selectionClassName });
            }
        }], [{
            key: 'operationFromCodeMirrorChanges',
            value: function operationFromCodeMirrorChanges(changes, cm) {
                // Approach: Replay the changes, beginning with the most recent one, and
                // construct the operation and its inverse. We have to convert the position
                // in the pre-change coordinate system to an index. We have a method to
                // convert a position in the coordinate system after all changes to an index,
                // namely CodeMirror's `indexFromPos` method. We can use the information of
                // a single change object to convert a post-change coordinate system to a
                // pre-change coordinate system. We can now proceed inductively to get a
                // pre-change coordinate system for all changes in the linked list.
                // A disadvantage of this approach is its complexity `O(n^2)` in the length
                // of the linked list of changes.
                var docEndLength = codemirrorLength(cm);
                var operation = new TextOperation().retain(docEndLength);
                var inverse = new TextOperation().retain(docEndLength);

                for (var i = changes.length - 1; i >= 0; i--) {
                    var change = changes[i];
                    var fromIndex = change.start;
                    var restLength = docEndLength - fromIndex - change.text.length;

                    //根据变化字符，生成顺序流程
                    operation = new TextOperation().retain(fromIndex).delete(change.removed.length).insert(change.text, change.attributes).retain(restLength).compose(operation);

                    //根据变化字符，生成可逆序流程  
                    inverse = inverse.compose(new TextOperation().retain(fromIndex).delete(change.text.length).insert(change.removed, change.removedAttributes).retain(restLength));

                    docEndLength += change.removed.length - change.text.length;
                }
                return [operation, inverse];
            }
        }, {
            key: 'operationFromAttributesChanges',
            value: function operationFromAttributesChanges(changes, cm) {
                var docEndLength = codemirrorLength(cm);

                var operation = new TextOperation();
                var inverse = new TextOperation();
                var pos = 0;

                for (var i = 0; i < changes.length; i++) {
                    var change = changes[i];
                    var toRetain = change.start - pos;
                    Utils.assert(toRetain >= 0); // changes should be in order and non-overlapping.
                    operation.retain(toRetain);
                    inverse.retain(toRetain);

                    var length = change.end - change.start;
                    operation.retain(length, change.attributes);
                    inverse.retain(length, change.attributesInverse);
                    pos = change.start + length;
                }

                operation.retain(docEndLength - pos);
                inverse.retain(docEndLength - pos);
                return [operation, inverse];
            }
        }]);

        return RichTextCodeMirrorAdapter;
    }();
});