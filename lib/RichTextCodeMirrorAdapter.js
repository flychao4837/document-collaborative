'use strict'
const Utils = require('./Utils.js')
const { Range, Selection } = require('./Selection.js')
const TextOperation = require('./TextOperation.js')
const WrappedOperation = require('./WrappedOperation.js')

function minPos (a, b) { return Utils.posLe(a, b) ? a : b }
function maxPos (a, b) { return Utils.posLe(a, b) ? b : a }
// codemirror current length
function getTextOriginLength(cm) {
    return cm.TextOpHistroy.charOriginLength;
}
function getTextCurrentLength(cm) {
    return cm.TextOpHistroy.charCurrentLength;
}
var addStyleRule = (function () {
    var added = {}
    var styleSheet

    return function (css) {
        if (added[css]) { return }
        added[css] = true

        if (!styleSheet) {
            var styleElement = document.createElement('style')
            var root = document.documentElement.getElementsByTagName('head')[0]
            root.appendChild(styleElement)
            styleSheet = styleElement.sheet
        }
        styleSheet.insertRule(css, (styleSheet.cssRules || styleSheet.rules).length)
    }
}())

// editor adapter
module.exports =
class RichTextCodeMirrorAdapter {
    // cmtm: instance of RichTextCodeMirror
    // cm: instance of CodeMirror
    constructor (rtcm) {
        this.rtcm = rtcm;
        this.cm = rtcm.editor;

        this.rtcm.on('change', this.onChange, this)

        this.cm.$textContainerElem.on('beforeChange', this.trigger.bind(this, 'beforeChange'))
        this.cm.$textContainerElem.on('cursorActivity', this.onCursorActivity.bind(this))
        this.cm.$textContainerElem.on('focus', this.onFocus.bind(this))
        this.cm.$textContainerElem.on('blur', this.onBlur.bind(this))
    }
    // Removes all event listeners from the CodeMirrorror instance.
    detach () {
        this.rtcm.off('change', this.onChange)

        this.cm.off('cursorActivity', this.onCursorActivity.bind(this))
        this.cm.off('focus', this.onFocus.bind(this))
        this.cm.off('blur', this.onBlur.bind(this))
    }
    onChange (rtcm, changes) {
        if (changes && changes.length) {//origin来源识别，+input时输入，其他还有toobar的变化等等
            //pair 包含正序的[0]operation 和反序的[1]inverse两部分
            var pair = RichTextCodeMirrorAdapter.operationFromCodeMirrorChanges(changes, this.rtcm)
            this.trigger('change', pair[0], pair[1]) //跳往EditorClient-onChange
        }
    }
    onCursorActivity () {
        this.trigger('selectionChange')
    }
    onFocus () {
        this.trigger('focus')
    }
    onBlur () {
        if (!this.cm.somethingSelected()) {
            this.trigger('blur')
        }
    }
    trigger (event) {
        var args = Array.prototype.slice.call(arguments, 1)
        var action = this.callbacks && this.callbacks[event]
        if (action) {
            action.apply(this, args)
        }
    }

    registerCallbacks (cbs) {
        this.callbacks = cbs
    }
    registerUndo (fn) {
        this.cm.undo = fn
    }
    registerRedo (fn) {
        this.cm.redo = fn
    }

    getSelection () {
        //TODO -- 获取鼠标位置信息
        var cm = this.cm
        // var selectionList = cm.listSelections()
        // var ranges = []
        // for (var i = 0; i < selectionList.length; i++) {
        //     ranges[i] = new Range(
        //         cm.indexFromPos(selectionList[i].anchor),
        //         cm.indexFromPos(selectionList[i].head)
        //     )
        // }

        // return new Selection(ranges)
    }
    setSelection (selection) {
        //TODO -- 设置鼠标信息
        // var ranges = []
        // for (var i = 0; i < selection.ranges.length; i++) {
        //     var range = selection.ranges[i]
        //     ranges[i] = {
        //         anchor: this.cm.posFromIndex(range.anchor),
        //         head: this.cm.posFromIndex(range.head)
        //     }
        // }
        // this.cm.setSelections(ranges)
    }

    // Converts a CodeMirror change object into a TextOperation and its inverse
    // and returns them as a two-element array.
    //TODO--根据编辑器传递过来的格式化变化内容，计算文本操作步骤和操作记录
    // change 可能的格式 {"start":27,"end":28,"removed":"","inserted":"1","delen":0,"text":"1"}
    static operationFromCodeMirrorChanges (changes, cm) {
        //Note -- 第一次输入时 changes[0]的起止位置start、end都是0；text是当前的输入文本.
        var docEndLength = getTextCurrentLength(cm)  //操作后的文本实际长度，计算文本操作点前、后需要保持的实际原始文本长度
        var operation = new TextOperation().retain(docEndLength)
        var inverse = new TextOperation().retain(docEndLength)

        for (var i = changes.length - 1; i >= 0; i--) {
            var change = changes[i];
            var fromIndex = change.start; //操作点前的文本
            var removed = change.removed;
            var inserted = change.inserted;
            //var restLength = fromIndex + change.delen; //操作点后的文本，排除被删除的文本
            //Note -- 操作点后剩余的文本长度，用于比较baseLength和targetLength
            //如果在空节点'<p><br></p>'位置插入文本会变成'<p>1</p>' 删除了<br> 插入了 1，restLength会变成负数
            var restLength = docEndLength - fromIndex - change.text.length
            //特殊情况下的delta由 start: start + delen, end: total - end, 变成start: start, end: end

            //根据变化字符，生成顺序流程
            operation = new TextOperation()
              .retain(fromIndex)
              .delete(change.removed.length)
              .insert(change.text)
              .retain(restLength)
              .compose(operation)
            
            //根据变化字符，生成可逆序流程  
            inverse = inverse.compose(
                new TextOperation()
                  .retain(fromIndex)
                  .delete(change.text.length)
                  .insert(change.removed)
                  .retain(restLength)
            )

            //变化前的原始长度
            docEndLength += change.removed.length - change.text.length 
        }
        return [operation, inverse]
    }
    // Converts an attributes changed object to an operation and its inverse.
    static operationFromAttributesChanges (changes, cm) {
        var docEndLength = getTextOriginLength(cm)

        var operation = new TextOperation()
        var inverse = new TextOperation()
        var pos = 0

        for (var i = 0; i < changes.length; i++) {
            var change = changes[i]
            var toRetain = change.start - pos
            Utils.assert(toRetain >= 0) // changes should be in order and non-overlapping.
            operation.retain(toRetain)
            inverse.retain(toRetain)

            var length = change.end - change.start
            operation.retain(length, change.attributes)
            inverse.retain(length, change.attributesInverse)
            pos = change.start + length
        }

        operation.retain(docEndLength - pos)
        inverse.retain(docEndLength - pos)
        return [operation, inverse]
    }

    // Apply an operation to a CodeMirror instance.
    applyOperation (operation) {
        // HACK: If there are a lot of operations; hide CodeMirror so that it doesn't re-render constantly.
        //将服务器消息传来的数据，传递给editor（this.rtcm）
        if (operation.ops.length > 10) {
            //一次传入的操作步骤数据太多，先隐藏编辑器，等内容初始完成后在一起填充进去
            //this.rtcm.codeMirror.getWrapperElement().setAttribute('style', 'display: none')
        }

        var ops = operation.ops
        var index = 0 // holds the current index into CodeMirror's content
        for (var i = 0, l = ops.length; i < l; i++) {
            var op = ops[i]
            if (op.isRetain()) {

                index += op.chars
            } else if (op.isInsert()) {
                console.log("insert text")
                this.rtcm.insertText(index, op.text)
                //index += op.text.length
            } else if (op.isDelete()) {
                console.log("delete text")
                //this.rtcm.removeText(index, index + op.chars)
            }
        }

        if (operation.ops.length > 10) {
            //this.rtcm.codeMirror.getWrapperElement().setAttribute('style', '')
            //this.rtcm.codeMirror.refresh()
        }
    }
    invertOperation (operation) {
        var pos = 0
        var cm = this.rtcm.codeMirror
        var spans
        var i
        var inverse = new TextOperation()
        for (var opIndex = 0; opIndex < operation.wrapped.ops.length; opIndex++) {
            var op = operation.wrapped.ops[opIndex]
            if (op.isRetain()) {
                if (Utils.emptyAttributes(op.attributes)) {
                    inverse.retain(op.chars)
                    pos += op.chars
                } else {
                    spans = this.rtcm.getAttributeSpans(pos, pos + op.chars)
                    for (i = 0; i < spans.length; i++) {
                        var inverseAttributes = {}
                        for (var attr in op.attributes) {
                            var opValue = op.attributes[attr]
                            var curValue = spans[i].attributes[attr]

                            if (opValue === false) {
                                if (curValue) {
                                    inverseAttributes[attr] = curValue
                                }
                            } else if (opValue !== curValue) {
                                inverseAttributes[attr] = curValue || false
                            }
                        }

                        inverse.retain(spans[i].length, inverseAttributes)
                        pos += spans[i].length
                    }
                }
            } else if (op.isInsert()) {
                inverse.delete(op.text.length)
            } else if (op.isDelete()) {
                var text = cm.getRange(cm.posFromIndex(pos), cm.posFromIndex(pos + op.chars))

                spans = this.rtcm.getAttributeSpans(pos, pos + op.chars)
                var delTextPos = 0
                for (i = 0; i < spans.length; i++) {
                    inverse.insert(text.substr(delTextPos, spans[i].length), spans[i].attributes)
                    delTextPos += spans[i].length
                }

                pos += op.chars
            }
        }

        return new WrappedOperation(inverse, operation.meta.invert())
    }

    setOtherSelection (selection, color, clientId) {
        var selectionObjects = []
        for (var i = 0; i < selection.ranges.length; i++) {
            var range = selection.ranges[i]
            if (range.isEmpty()) { // cursor
                selectionObjects[i] = this.setOtherCursor(range.head, color, clientId)
            } else { // selection
                selectionObjects[i] = this.setOtherSelectionRange(range, color, clientId)
            }
        }
        return {
          clear: function () {
              for (var i = 0; i < selectionObjects.length; i++) {
                //TODO -- 暂时没有clear方法
                  //selectionObjects[i].clear()
              }
          }
        }
    }
    setOtherCursor (position, color, clientId) {
        // var cursorPos = this.cm.posFromIndex(position)
        // var cursorCoords = this.cm.cursorCoords(cursorPos)
        // var cursorEl = document.createElement('span')
        // cursorEl.className = 'other-client'
        // cursorEl.style.display = 'inline'
        // cursorEl.style.padding = '0'
        // cursorEl.style.marginLeft = cursorEl.style.marginRight = '-1px'
        // cursorEl.style.borderLeftWidth = '2px'
        // cursorEl.style.borderLeftStyle = 'solid'
        // cursorEl.style.borderLeftColor = color
        // cursorEl.style.height = (cursorCoords.bottom - cursorCoords.top) + 'px'
        // cursorEl.style.transform = 'translateY(2px)'
        // cursorEl.style.zIndex = 0
        // cursorEl.setAttribute('data-clientid', clientId)
        // return this.cm.setBookmark(cursorPos, { widget: cursorEl, insertLeft: true })
    }
    setOtherSelectionRange (range, color, clientId) {
        var match = /^#([0-9a-fA-F]{6})$/.exec(color)
        if (!match) { throw new Error('only six-digit hex colors are allowed.') }
        var selectionClassName = 'selection-' + match[1]
        var rule = '.' + selectionClassName + ' { background: ' + color + '; }'
        addStyleRule(rule)

        var anchorPos = this.cm.posFromIndex(range.anchor)
        var headPos = this.cm.posFromIndex(range.head)

        return this.cm.markText(
            minPos(anchorPos, headPos),
            maxPos(anchorPos, headPos),
            { className: selectionClassName }
        )
    }
}
