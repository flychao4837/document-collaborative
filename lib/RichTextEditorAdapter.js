'use strict'
const Utils = require('./Utils.js')
const TextOperation = require('./TextOperation.js')
const WrappedOperation = require('./WrappedOperation.js')

function minPos (a, b) { return Utils.posLe(a, b) ? a : b }
function maxPos (a, b) { return Utils.posLe(a, b) ? b : a }

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
class RichTextEditorAdapter {
    // cmtm: instance of RichTextCodeMirror
    // cm: instance of CodeMirror
    constructor (rtcm) {
        this.rtcm = rtcm;
        this.cm = rtcm.editor;

        this.rtcm.on('change', this.onChange, this)

        this.cm.$textContainerElem.on('beforeChange', this.trigger.bind(this, 'beforeChange'))
        this.cm.$textContainerElem.on('focus', this.onFocus.bind(this))
        this.cm.$textContainerElem.on('blur', this.onBlur.bind(this))
    }
    // Removes all event listeners from the CodeMirrorror instance.
    detach () {
        this.rtcm.off('change', this.onChange)
        this.cm.off('focus', this.onFocus.bind(this))
        this.cm.off('blur', this.onBlur.bind(this))
    }
    onChange (rtcm, changes) {
        if (changes && changes.length) {
            //origin来源识别，+input时输入，其他还有toobar的变化等等
            //pair 包含正序的[0]operation 和反序的[1]inverse两部分
            var pair = RichTextEditorAdapter.operationFromEditorChanges(this.rtcm, changes)
            //发送消息 见 EditorClient-onChange
            this.trigger('change', pair[0], pair[1]) 
        }
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

    //根据编辑器传递过来的格式化变化内容，计算文本操作步骤和操作记录
    // change 可能的格式 {"start":27,"end":28,"removed":"","inserted":"1","delen":0,"text":"1"}
    static operationFromEditorChanges (cm, changes) {
        console.log("生成的changes",changes)
        var docEndLength = getTextCurrentLength(cm);
        //操作后的文本实际长度，计算文本操作点前、后需要保持的实际原始文本长度
        var operation = new TextOperation().retain(docEndLength);
        var inverse = new TextOperation().retain(docEndLength);

        for (var i = changes.length - 1; i >= 0; i--) {
            var change = changes[i];
            var fromIndex = change.start; //操作点前的文本
            var removed = change.removed;
            var inserted = change.inserted;


            //操作点后剩余的文本长度，用于比较baseLength和targetLength
            //如果在空节点'<p><br></p>'位置插入文本会变成'<p>1</p>' 删除了<br> 插入了 1，restLength会变成负数
            var restLength = docEndLength - fromIndex - change.text.length

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

    //将服务器消息传来的操作数据，传递给editor（this.rtcm），修改编辑器对应位置的文本
    applyOperation (operation, optTag) {
        
        if (operation.ops.length > 10) {
            //一次传入的操作步骤数据太多，先隐藏编辑器，等内容初始完成后在一起填充进去
            //this.rtcm.codeMirror.getWrapperElement().setAttribute('style', 'display: none')
        }
        console.log("收到操作信息",operation)

        var ops = operation.ops
        var index = 0;
        var start = 0;
        var changes = {removedLen:0, inserted:''}; //操作序列
        for (var i = 0, l = ops.length; i < l; i++) {
            var op = ops[i]
            if (op.isRetain()) {
                index += op.chars
                if(i === 0){
                    start = index;
                }
            } else if (op.isInsert()) {
                //console.log("insert text")
                // index 开始位置  op.text  插入的字符
                changes.inserted = op.text;
                index += op.text.length
            } else if (op.isDelete()) {
                //console.log("delete text")
                // index 开始位置 op.chars 删除的字符长度
                changes.removedLen = op.chars
            }
        }

        //将所有operations转成可一步执行的操作
        this.rtcm.insertContents(changes, start);
        //操作步骤太多时，先隐藏编辑器，合并完再显示
        if (operation.ops.length > 10) {

            
        }
    }

    //initClientContent，直接修改编辑器html
    modifyHtml(operation){
        var ops = operation.ops
        var index = 0 // holds the current index into CodeMirror's content
        for (var i = 0, l = ops.length; i < l; i++) {
            var op = ops[i]
            if (op.isRetain()) {

                index += op.chars
            } else if (op.isInsert()) {
                //console.log("insert text")
                this.rtcm.insertText(index, op.text)
                index += op.text.length
            } else if (op.isDelete()) {
                //console.log("delete text")
                this.rtcm.removeText(index, index + op.chars)
            }
        }
    }
    invertOperation (operation) {
        var inverse = new TextOperation()
        for (var opIndex = 0; opIndex < operation.wrapped.ops.length; opIndex++) {
            var op = operation.wrapped.ops[opIndex]
            if (op.isRetain()) {
                inverse.retain(op.chars)
            } else if (op.isInsert()) {
                inverse.delete(op.text.length)
            } else if (op.isDelete()) {
                inverse.insert(op.chars)
            }
        }

        return new WrappedOperation(inverse)
    }

}
