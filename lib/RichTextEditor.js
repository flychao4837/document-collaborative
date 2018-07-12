
const TextOperateHistroy = require('./TextOperateHistroy.js')

//不需要闭合的标签，单独计算长度
let unCloseTag = ['img', 'input', 'br', 'hr'];
let rootNodeClass = 'root-elem';
let editorBoxClass = 'w-e-text';

function last(arr) {
    return arr[arr.length - 1]
}

//这里初始化自定义事件，并创建editor
module.exports = class RichTextCodeMirror {
    constructor(wangEditor) {
        wangEditor.customConfig.debug = true; //开启editor调试模式
        // 自定义 onchange 触发的延迟时间，默认为 200 ms
        wangEditor.customConfig.onchangeTimeout = 100 // 单位 ms
        wangEditor.customConfig.onchange = function(html) {
            // html 即变化之后的内容
            //console.log(html)
            this.onChange(html)
        }.bind(this)
        wangEditor.customConfig.onfocus = function() {
            //第一次选取编辑器时会与click操作冲突
            //console.log('onfocus')
            //this.onFocus()
        }.bind(this)
        wangEditor.customConfig.onblur = function(html) {
            //console.log("onblur")
            //this.onBlur(html)
        }.bind(this)

        //生成编辑器 wangEditor.create(),把wangEditor 转成editor实例
        wangEditor.create();

        this.editor = wangEditor

        //获取鼠标点击事件
        this.editor.$textContainerElem.on("click", function(e) {
            // 获取鼠标点击事件，和鼠标滑选操作
            //console.log("click")
            this.onClick();
        }.bind(this))

        //初始化历史记录
        this.TextOpHistroy = new TextOperateHistroy(this)

        this.changes = []; //未发送的操作步骤缓存

        //创建临时编辑容器，取代原有编辑器的textarea，释放当前用户的鼠标选区
        this.tempRange = null; //editor-click事件时的鼠标位置
        //编辑器自定义事件绑定
        Utils.makeEventEmitter(RichTextCodeMirror, ['change'], this)
    }
    detach() {
        if (parseInt(window.wangEditor.version) > 4) {
            this.wangEditor.off('changes', this.onwangEditorChange_.bind(this))
        } else {
            this.wangEditor.off('change', this.onwangEditorChange_.bind(this))
        }
        this.wangEditor.off('cursorActivity', this.onCursorActivity_.bind(this))
    }

    //编辑器文本由变化
    onChange(html) {
        // 正常情况是逐个删除或插入，但是存在鼠标滑动选择或者快捷键选取文字后直接输入文字替换
        // 这种情况下，应该先计算删除操作，在计算插入操作，拆分成多个步骤
        let domChanges = this.getEditorDomChangeInfo();
        //当由编辑器focus导致的编辑器active状态变化，从而发起onchange，此时主动取消此次onchange事件
        if (!domChanges) {
            return;
        }

        //如果当前操作被锁定，先暂存操作记录，后期遗弃发送
        if (!this.TextOpHistroy.isLocked) {
            ///这里触发自定义的change事件，处理operation和本地历史记录相关 {operatios} 操作步骤和鼠标位置记录
            //  把编辑器的操作拆分成多个单独步(编辑器把文本样式修改合并成一个change，应该先删除，在插入)
            this.changes.push(domChanges);
            this.trigger('change', this, this.changes);
        }else{
            //如果文本暂时不能修改，保存操作，后期再发送
            this.changes.push(domChanges);
            setTimeOut(function(){
                this.trigger('change', this, this.changes);
            }.bind(this),0);
        }
    }
    onFocus() {
        //获取鼠标位置，更新，推送鼠标位置信息
    }
    onBlur(html) {
        //更新，推送鼠标位置信息
    }

    onClick() {

    }

    //根据编辑器文本，获取对应变化的Dom节点，节点层级，位置，深度，和索引，要求能直接查找到最低粒度的单个文字文本和tag节点
    getEditorDomChangeInfo(){
        let html = this.getEditorCtx();
        let domChangeInfo = this.TextOpHistroy.getDelta(html)
        return domChangeInfo;
        
    }

    //获取编辑器内容
    getEditorCtx() {
        return this.editor.txt.html();
    }

    //html文本转成nodeLists
    setStrToNodeLists(str) {
        var el = document.createElement("div");
        el.setAttribute("id", getRandom());
        el.innerHTML = str;
        return el.childNodes;
    }

    //html文本转成HTMLcollection
    setStrToDOMElement(str) {
        var el = document.createElement("div");
        el.setAttribute("id", getRandom());
        el.innerHTML = str;
        return el.children;
    }

    //从HTMLCollection中取第一层的innerHTML，拼成完整的html
    setDOMElementToStr(elem) {
        var tmpStr = '';
        for (var i = 0, len = elem.length; i < len; i++) {
            var item = elem[i];
            var innerHtml = item.innerHTML;
            var tag = item.tagName.toLocaleLowerCase();
            var attrs = item.attributes;
            tmpStr += '<' + tag;
            for (var j = 0, _len = attrs.length; j < _len; j++) {
                tmpStr += ' ' + attrs[j].nodeName + '="' + attrs[j].nodeValue + '"';
            }
            if (unCloseTag.indexOf(tag) > -1) {
                tmpStr += '>';
            } else {
                tmpStr += '>' + innerHtml + '</' + tag + '>';
            }
        }
        return tmpStr;
    }

    //清理html文本中人为添加的鼠标,背景色信息
    cleanHtmlElem(html) {
        if (!html || typeof html !== "string") {
            return;
        } else {
            var dom = this.setStrToDOMElement(html);
            return dom;
        }
    }

    //获取干净的文本字符串
    getCleanHtml() {
        var ctx = this.getEditorCtx();
        var htmlElem = this.cleanHtmlElem(ctx);
        var htmlstr = this.setDOMElementToStr(htmlElem);
        return htmlstr;
    }

    // 替换 html 特殊字符
    replaceHtmlSymbol(html) {
        if (html == null) {
            return '';
        }
        return html.replace(/</gm, '&lt;').replace(/>/gm, '&gt;').replace(/"/gm, '&quot;').replace(/(\r\n|\r|\n)/g, '<br/>');
    }

    //TOFix 合并因插入自定义标签导致原有连贯文本被打断
    getChildrenJSON(elem) {
        var result = [];
        for (var i = 0, len = elem.length; i < len; i++) {
            var curElem = elem[i];
            var elemResult = void 0;
            var nodeType = curElem.nodeType;
            var classstr = curElem.attributes && curElem.attributes["class"];
            if (classstr && (classstr.nodeValue.match("user-bg-color") || classstr.nodeValue.match("user-cursor"))) {
                break;
            }
            // 文本节点 textContent可改写，nodeValue是只读的
            if (nodeType === 3) {
                elemResult = curElem.textContent;
                elemResult = this.replaceHtmlSymbol(elemResult);
            }

            // 普通 DOM 节点
            if (nodeType === 1) {
                elemResult = {};

                // tag
                elemResult.tag = curElem.nodeName.toLowerCase();
                // attr
                var attrData = [];
                var attrList = curElem.attributes || {};
                var attrListLength = attrList.length || 0;
                for (var _i = 0; _i < attrListLength; _i++) {
                    var attr = attrList[_i];
                    attrData.push({
                        name: attr.name,
                        value: attr.value
                    });
                }
                elemResult.attrs = attrData;
                elemResult.content = curElem.textContent;
                // children（递归）
                elemResult.children = this.getChildrenJSON(curElem.childNodes);
            }

            result.push(elemResult);
        };
        return result;
    }

    //获取传入的node相对文档根节点的层级,文档容器w-e-text，id="text-elemxxxxxxx"的层级为0,跳过自定义背景、鼠标样式节点
    getNodeDeepSize(node) {
        var size = [];
        var child = node;


        function getDeepSize(child) {
            var child = child;
            var parent = child.parentElement;
            if (parent.nodeType === 1) {
                let classValue = parent.getAttribute("class");
                if (classValue && (classValue.indexOf("user-bg-color") > -1 || classValue.indexOf("user-cursor") > -1)) {
                    return;
                } else if (!parent.getAttribute("id") || parent.getAttribute("id").indexOf("text-elem") < 0) {
                    size.unshift(getNodeIndex(child, parent))
                } else if (parent.getAttribute("id") && parent.getAttribute("id").indexOf("text-elem") > -1) {
                    size.unshift(getNodeIndex(child, parent))
                    return;
                } else {
                    return; //跳出递归
                }

            } else if (parent.nodeType === 3) {
                //parent都是 #Text 节点，这就由有问题了
                alert("父节点不可能是文本节点")
            }
            getDeepSize(parent);
        }
        getDeepSize(child);
        //console.log('size',size)
        return size;
    }

    getRootRanderTree() {
        var ctx = this.getEditorCtx();
        var htmlElem = this.cleanHtmlElem(ctx);
        var json = this.getChildrenJSON(htmlElem);
        return json;
    }

    //获取鼠标所在节点，和前面的所有根父节点
    getCurrentRootElemBefore(rootSelectionElem) {
        // 获取当前光标根节点前的所有div.root-elem
        var rootElems = this.editor.$textElem[0].childNodes;
        var currentRootElem = null;
        var prevRootElems = [];
        var result = void 0;
        for (var i = 0, len = rootElems.length; i < len; i++) {
            result = isContainElem(rootSelectionElem, rootElems[i]);
            if (result) {
                currentRootElem = rootElems[i];
                break;
            } else {
                prevRootElems.push(rootElems[i]);
            }
        }
        return {
            prevRootElems: prevRootElems,
            currentRootElem: currentRootElem
        };
    }

    //填充内容 ,先尝试在空节点实现删除<br>,然后在原位置插入文本节点
    insertContents(changes, idx) {
        //协同版本2-单人操作，不涉及多人，不需要设置鼠标位置了
        let insertText = changes.inserted;
        let index = idx;
        this.insertText(index, insertText)
    }

    insertText(index, text) {
        //来自rtcmAdapter -- applyOperation
        //console.log("insertText")
        var html = this.TextOpHistroy.currentValue;
        html = html.substr(0,index) +""+ text +""+ html.substr(index);
        this.editor.txt.html(html);
        this.TextOpHistroy.setCurrentValue(this.editor.txt.html())
    }

    removeText(index,endindex){
        //console.log("removeText")
        var html = this.TextOpHistroy.currentValue;
        html = html.substr(0,index) +""+ html.substr(endindex);
        this.editor.txt.html(html);;
        this.TextOpHistroy.setCurrentValue(this.editor.txt.html())
    }
}

//生成随机数
function getRandom() {
    return (Math.random() + new Date().getTime().toString()).substr(2);
}


//判断当前节点是否包含子节点
function isContainElem(rootSelectionElem, rootElem) {
    let result = false;
    if (!rootSelectionElem || !rootElem) {
        return result;
    }
    if (rootElem === rootSelectionElem) {
        result = true;
    } else if (rootElem.childElementCount > 0) {
        for (let i = 0, len = rootElem.childElementCount; i < len; i++) {
            let rt = isContainElem(rootSelectionElem, rootElem.children[i]);
            if (rt) {
                result = true;
                break;
            }
        }
    } else {
        result = false;
    }
    return result;
}

//获取给定node的带标签的完整HTML
function getWholeHTML(elem) {
    let tmpStr = elem.outerHTML
    return tmpStr
}

//从开始获取文本相同的部分,同时返回相同部分和，原始文本剩余部分
function getSameText(oldValue, newValue) {
    var commonStart = 0;
    while (commonStart < newValue.length &&
        newValue.charAt(commonStart) == oldValue.charAt(commonStart)) {
        commonStart++;
    }
    var commonEnd = 0;
    while (commonEnd < (newValue.length - commonStart) &&
        commonEnd < (oldValue.length - commonStart) &&
        newValue.charAt(newValue.length - commonEnd - 1) ==
        oldValue.charAt(oldValue.length - commonEnd - 1)) {
        commonEnd++;
    }

    var removed = oldValue.substr(commonStart, oldValue.length - commonStart - commonEnd);
    var inserted = newValue.substr(commonStart, newValue.length - commonStart - commonEnd);

    var samePart = oldValue.substr(0,commonStart);
    var otherparts = oldValue.substr(commonStart);

    return {samePart,otherparts}
}
//获取当前node在nodeList中的位置,若是空标签，child === parent
function getNodeIndex(child, parent) {
    var index = 0
    if (child && parent) {
        index = Array.prototype.indexOf.call(parent.childNodes, child);
        if (index < 0) {
            index = child === parent ? 0 : -1;
        }
    }
    return index;
}

/**
 **获取当前根节点下字符的长度 对于空白标签range的startOffset=0，
 **若鼠标点击在图片后 startoffset=endOffset=1，
 ** 即图片只当成来长为1的元素，需要手动处理img的src和标签
// TODO --嵌套的node 需要判断到实际位置，不能单纯判断nodetype和deep <p>1{|}}<span>22</span>1{|}<p> 1后的limitOpt是一样的，导致取值一样
// TOFix node.previousSibling, previousSibling.parentElement.previousSibling.parentElement 这种递归，找到完整的节点，在截取字符
**/
function getCharByJsonTree(rootElem, limitOpt) {
    let size = 0;
    let tmpStr = "";
    let deep = 1;
    let breakStatus = false;
    var limitOpt = limitOpt; 
    //获取标签的前半部分html
    function getFirstPart(elem) {
        var tag = elem.nodeName.toLocaleLowerCase();
        var attrs = elem.attributes;
        var tmpStr = '';
        if (elem.nodeType === 1) {
            //遍历到文本节点
            tmpStr += '<' + tag;
            for (var j = 0, len = attrs.length; j < len; j++) {
                tmpStr += ' ' + attrs[j].nodeName + '="' + attrs[j].nodeValue + '"';
            }

            //类似</br> 以及可闭合也可以不闭合的标签<img /> <img>
            if (unCloseTag.indexOf(tag) > -1) {
                tmpStr += '>';
            } else {
                tmpStr += '>';
            }
        }
        return tmpStr;
    }

    function elemMap(rootElem, deep, index) {
        //TOFix -- 可能直接点到 div.root-elem上了 导致能取到.root-elem的index，却没有点击到p.section
        // 这时deep只有1层

        let val = deep.shift();
        if (val !== undefined) {
            let nodeLists = rootElem.childNodes;
            let temp = "";
            for (let i = 0; i < val; i++) {
                let item = nodeLists[i];
                if (item.nodeType === 1) {
                    temp += item.outerHTML;
                } else if (item.nodeType === 3) {
                    temp += item.textContent;
                }
            }
            let last = nodeLists[val];
            let str = getFirstPart(rootElem);
            tmpStr += str + temp;
            elemMap(last, deep, index);
        } else if (!val) {
            if (rootElem.nodeType === 1) {
                tmpStr += getFirstPart(rootElem);
            } else if (rootElem.nodeType === 3) {
                tmpStr += rootElem.nodeValue.substr(0, index);
            }
        } else {
            //层级遍历完，跳出递归
            return;
        }
    }

    //存在节点查找限制信息的，需要取遍历节点，否则直接去取完整节点
    if (limitOpt) {
        if (limitOpt.domDeep && limitOpt.domDeep.length > 0) {
            //数组要重新拷贝一份
            let deep = [].concat(limitOpt.domDeep).splice(1);
            let index = limitOpt.startOffset;
            elemMap(rootElem, deep, index);
        } else {
            console.log("domDeep 层级深度错误")
        }
    } else {
        tmpStr += rootElem.outerHTML
    }
    return tmpStr;
}