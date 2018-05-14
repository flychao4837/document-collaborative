const {
    Entity,
    EntityManager
} = require('./EntityManager.js')
const {
    AttributeConstants,
    SentinelConstants
} = require('./Constants.js')
const TextOperateHistroy = require('./TextOperateHistroy.js')

const StyleCache_ = {}

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

        /*填充临时内容--测试用*/
        // let text = '<p>欢迎使用<b>editor</b>富<label class="user-bg-color" style="background-color:#ff4b0c">文本编</label>辑' +
        //   '<label class="user-cursor-123" style="font-size:10px;color:blue;display: inline-block;position: relative;"><span>|</span>' +
        //   '<span style="position: absolute;top:-10px;color:#999;background-color:#f5f5f5;left: -10px;">agtros</span></label>器啊</p>' +
        //   '<p><img src="https://ss0.bdstatic.com/5aV1bjqh_Q23odCf/static/superman/img/logo_top_ca79a146.png" style="max-width:100%;"></p><p><br></p>';

        // 手动填充内容时，需要发起change请求，以便更新server上的document。
        
        // wangEditor.txt.html(text);
        this.editor = wangEditor

        //获取鼠标点击事件
        this.editor.$textContainerElem.on("click", function(e) {
            // 获取鼠标点击事件，和鼠标滑选操作
            //console.log("click")
            this.onClick();
        }.bind(this))

        //初始化历史记录
        this.TextOpHistroy = new TextOperateHistroy(this)
        this.entityManager = new EntityManager()

        this.changes = []; //未发送的操作步骤缓存

        //创建临时编辑容器，取代原有编辑器的textarea，释放当前用户的鼠标选区
        this.tempRange = null; //editor-click事件时的鼠标位置
        //编辑器自定义事件绑定
        Utils.makeEventEmitter(RichTextCodeMirror, ['change'], this)
    }
    detach() {
        this.wangEditor.off('beforeChange', this.onwangEditorBeforeChange_.bind(this))
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
        let selectionData = this.getUserCursorInfo();
        //当由编辑器focus导致的编辑器active状态变化，从而发起onchange，此时主动取消此次onchange事件
        if (!domChanges) {
            return;
        }
        //把文本变化信息放在selection里传递
        changes.removed = domChanges.removed;
        changes.inserted = domChanges.inserted;

        //如果当前操作被锁定，先暂存操作记录，后期遗弃发送
        if (!this.TextOpHistroy.isLocked) {
            ///这里触发自定义的change事件，处理operation，cursor，和本地历史记录相关 {operatios,metadata} 操作步骤和鼠标位置记录
            this.TextOpHistroy.updateOperateHistroy(delta);
            // delta记录的是文本变化，有可能一次变化来多处，所以changes应该是一个数组
            //  把编辑器的操作拆分成多个单独步(编辑器把文本样式修改合并成一个change，应该先删除，在插入)
            changes.push(domChanges);
            this.trigger('change', this, changes, selectionData);
        }else{
            this.changes.push(domChanges);
        }
    }
    onFocus() {
        //获取鼠标位置，更新，推送鼠标位置信息
    }
    onBlur(html) {
        //更新，推送鼠标位置信息
    }

    onClick() {
        //TODO滑动鼠标后在释放鼠标右键，会触发click ,选中后，再次单击，取到的range仍是上次选中的信息
        this.setUserCursor();
    }

    //TODO-获取当前用户的光标位置，用鼠标滑选中一段文字后end的值计算错误(NaN)
    setUserCursor() {
        let cursorData = this.getUserCursorInfo()
        //console.log('setUserCursor', cursorData)
        //鼠标滑选了文本，不是单纯的点击后输入
        if (!cursorData.collapsed) {
            return;
        }
        this.tempRange = cursorData;
        //同时更新editor的selection
        //TODO -- getSelectionContainerElem,获取range选取，对选区可进行操作
    }

    //将document.range的offset转换成编辑器带标签的html文本的实际位置
    getUserCursorInfo() {
        var treeNode = this.getRootRanderTree();

        //这里 rangeRootContainer 取的是$textElement,不能直接修改,从Element转成node，当前range的parent，不一定是根节点
        var rangeRootContainer = this.editor.selection.getSelectionContainerElem()[0];
        var range = this.editor.selection.getRange();

        //rootElemsBeforeCursor 获取当前光标根节点前的 所有文档根节点，和当前根节点
        var rootElemsBeforeCursor = this.getCurrentRootElemBefore(rangeRootContainer);
        var currentContainer;
        var splitText = '';
        var distance = 0,
            start, end;

        //开始节点信息
        let startContainerInfo = {}

        //结束节点信息
        let endContainerInfo = {}

        //根据相对位置，计算实际html文本长度    
        function getSplitText(rootElemsBeforeCursor, limitOption) {
            var prevRootElems = rootElemsBeforeCursor.prevRootElems;
            for (var i in prevRootElems) {
                var prNode = cleanCustromTag([prevRootElems[i]]);
                if (prNode && prNode[0]) splitText += getCharByJsonTree(prNode[0]);
            }
            //清理custrom定义的标签
            var nodes = cleanCustromTag([rootElemsBeforeCursor.currentRootElem]);
            if (nodes && nodes[0]) {
                splitText += getCharByJsonTree(nodes[0], limitOption);
            }
        }

        //在chrome和ff下，选取文本后设置样式，获取到的container是不一致的
        if (range.startContainer === range.endContainer) {
            //同一元素dom
            if (range.startOffset === range.endOffset) {
                //只单点了光标
                let startContainer = range.startContainer;
                let domDeep = this.getNodeDeepSize(startContainer);
                let nodeListIndex = getNodeIndex(startContainer, rangeRootContainer);
                let startLimitOption = {
                    nodeName: startContainer.nodeName,
                    nodeType: startContainer.nodeType,
                    nodeValue: startContainer.nodeValue,
                    domDeep,
                    startOffset: range.startOffset,
                    endOffset: range.endOffset,
                    rootNodeIndex: rootElemsBeforeCursor.prevRootElems.length,
                    container: startContainer,
                    nodeListIndex
                };
                getSplitText(rootElemsBeforeCursor, startLimitOption);

                start = end = splitText.length;
                startContainerInfo = {
                    nodeType: startLimitOption.nodeType,
                    nodeValue: startLimitOption.nodeValue,
                    startOffset: range.startOffset,
                    endOffset: range.endOffset,
                    domDeep: domDeep,
                    rootNodeIndex: startLimitOption.rootNodeIndex,
                    nodeListIndex
                };
            } else {
                //TODO -- 鼠标拖选中了文字
                let startContainer = range.startContainer;
                let domDeep = this.getNodeDeepSize(startContainer);
                let nodeListIndex = getNodeIndex(startContainer, rangeRootContainer);
                let startLimitOption = {
                    nodeName: startContainer.nodeName,
                    nodeType: startContainer.nodeType,
                    nodeValue: startContainer.nodeValue,
                    domDeep,
                    startOffset: range.startOffset,
                    endOffset: range.endOffset,
                    rootNodeIndex: rootElemsBeforeCursor.prevRootElems.length,
                    container: startContainer,
                    nodeListIndex
                };

                getSplitText(rootElemsBeforeCursor, startLimitOption);

                distance = Math.abs(range.endOffset - range.startOffset);
                start = splitText.length;
                end = start + distance;
                startContainerInfo = {
                    nodeType: startLimitOption.nodeType,
                    nodeValue: startLimitOption.nodeValue,
                    startOffset: range.startOffset,
                    endOffset: range.endOffset,
                    domDeep,
                    rootNodeIndex: startLimitOption.rootNodeIndex,
                    nodeListIndex
                };
            }
        } else {
            //TODO -- 跨元素dom,需要计算涉及的每个子元素
            let startContainer = range.startContainer;
            let domDeep = this.getNodeDeepSize(startContainer);
            let nodeListIndex = getNodeIndex(startContainer, rangeRootContainer);
            let startLimitOption = {
                nodeName: startContainer.nodeName,
                nodeType: startContainer.nodeType,
                nodeValue: startContainer.nodeValue,
                domDeep,
                startOffset: range.startOffset,
                endOffset: range.endOffset,
                rootNodeIndex: rootElemsBeforeCursor.prevRootElems.length,
                container: startContainer,
                nodeListIndex
            };
            startContainerInfo = {
                nodeType: startLimitOption.nodeType,
                nodeValue: startLimitOption.nodeValue,
                startOffset: range.startOffset,
                endOffset: range.endOffset,
                domDeep,
                rootNodeIndex: startLimitOption.rootNodeIndex,
                nodeListIndex
            };

            let endContainer = range.endContainer;
            let enddomDeep = this.getNodeDeepSize(endContainer);
            let endnodeListIndex = getNodeIndex(endContainer, rangeRootContainer);
            var endLimitOption = {
                nodeName: endContainer.nodeName,
                nodeType: endContainer.nodeType,
                nodeValue: endContainer.nodeValue,
                domDeep: enddomDeep,
                startOffset: range.startOffset,
                endOffset: range.endOffset,
                rootNodeIndex: rootElemsBeforeCursor.prevRootElems.length,
                container: endnodeListIndex,
                nodeListIndex: endnodeListIndex
            };

            endContainerInfo = {
                nodeType: endLimitOption.nodeType,
                nodeValue: endLimitOption.nodeValue,
                startOffset: range.startOffset,
                endOffset: range.endOffset,
                domDeep: enddomDeep,
                rootNodeIndex: endLimitOption.rootNodeIndex,
                nodeListIndex: endnodeListIndex
            };

            getSplitText(rootElemsBeforeCursor, startLimitOption);
            start = splitText.length;
            splitText = '';
            getSplitText(rootElemsBeforeCursor, endLimitOption);
            end = splitText.length;
        }

        //rangeData 转换位置后，传递出去的鼠标range信息
        let rangeData = {
            start, //html文本开始位置
            end, //html文本结束位置
            collapsed: range.collapsed, //选区是否重合
            startContainerInfo, //开始节点信息
            endContainerInfo, //结束节点信息
        }

        return rangeData;
    }

    //根据编辑器文本，获取对应变化的Dom节点，节点层级，位置，深度，和索引，要求能直接查找到最低粒度的单个文字文本和tag节点
    getEditorDomChangeInfo(){

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
            return cleanCustromTag(dom);
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

    setEditorContent(html) {
        //ot.changed = true;
        this.editor.txt.html(html);
        //ot.changed = false;
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

    // 根据websocket返回的消息，创建新的html并填充到编辑器中
    setEditorContentByServerMsg(data) {
        if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) !== "object") {
            alert("收到的服务器消息体格式错误");
            return;
        }
        var html = this.getCleanHtml();
        if (data.type == "del") {
            html = html.substr(0, data.end) + data.content + html.substr(data.start);
        } else {
            html = html.substr(0, data.start) + data.content + html.substr(data.end);
        }
        //TODO-同步内容时也要更新用户鼠标.  
    }

    //填充内容 ,先尝试在空节点实现删除<br>,然后在原位置插入文本节点
    insertContents(selection, changes, idx) {
        //TODO -- 根据selection 通过jquery来在指定节点插入数据，用jquery来对editor-html做序列化 ,跨根节点div.root-elem的情况怎么处理
        //selection 在initClientContent时为空
        //console.log("插入字符")
        //w-e-text 里的root-elem是没有上下文context的
        let grandNode = this.editor._serialContents();
        let correctNode;
        let start = selection.start;
        let end = selection.end;
        let collapsed = selection.collapsed;
        let startContainerInfo = selection.startContainerInfo;
        let endContainerInfo = selection.endContainerInfo;
        let path = startContainerInfo.domDeep;
        let insertText = changes.inserted;
        let removed = selection.removed;
        let index = idx;

        //先获取到div.root-elem节点
        correctNode = grandNode.children()[path[0]]

        var oldhtml = this.editor.txt.html();
        var newhtml = oldhtml.substr(0,index) +insertText +oldhtml.substr(index+changes.removedLen);
        var newCorrectNode = window.jquery(newhtml)[path[0]];

        //获取到实际变化的子节点
        if(!correctNode || !newCorrectNode || grandNode.children().length !== window.jquery(newhtml).length){
            //TODO -- 插入新节点
            if(insertText){
                let tagMatch = insertText.match(/<[^/][^>]+>/);
                if(tagMatch[0]){
                    window.jquery(insertText).insertAfter(window.jquery(grandNode.children().get(path[0]-1)));
                }else{
                    alert("添加标签，substr截取位置错误")
                }
            }
            if(removed){
                
                let tagMatch = removed.match(/<[^/][^>]+>/);
                if(tagMatch && tagMatch[0]){
                    correctNode.nextElementSibling.remove()
                }else{
                    //1：只删除了字符。2：删除的tag标签截取错误
                    console.log("删除标签，substr截取位置",removed)
                }
            }
        }else if (path && path.length) {
            for (var i = 1; i < path.length; i++) {
                let partCorrectNode = correctNode.childNodes[path[i]];
                let partNewcorrectNode = newCorrectNode.childNodes[path[i]];

                //遍历时，若节点发生变更，抛弃当前节点，取共同层级的父节点操作
                if(partCorrectNode && partNewcorrectNode){
                    correctNode = partCorrectNode
                    newCorrectNode = partNewcorrectNode
                }else{
                    break;
                }
                
            }

            //若当前的节点是一个非空的node nodeList不为空，可以用juqery操作 $(node).html('content'),
            //也可以通过 outerHTML操作 nodeList.outerHTML = '<label>什么情况</label>'
            //若是文本节点#Text nodeList 为空数组，直接设置textContent childNodes["0"].textContent = "测试"
            this.editor.selection.saveRange();//保存选区
            
            //闭合选区，只都有一个点
            if(collapsed){
                //1：在空白标签里插入第一个字符，标签里有默认的<br>
                
                if(newCorrectNode.nodeType === startContainerInfo.nodeType && newCorrectNode.nodeValue === startContainerInfo.nodeValue){
                    //2：删除了旧标签，插入了新的空白标签
                    if(newCorrectNode.parentElement === null){
                        correctNode.parentElement.innerHTML = newCorrectNode.outerHTML;
                    }else{
                        correctNode.parentElement.innerHTML = newCorrectNode.parentElement.innerHTML;
                    }
                    
                }else if(newCorrectNode.nodeType === startContainerInfo.nodeType){
                    correctNode.textContent = startContainerInfo.nodeValue;
                }
            }else{
                /*
                ** FireFox和chrome下跨文本和节点的表现方式不一样，但是操作的operation是一样的
                ** TODO -- 在不用位置，butongrange选区下插入文本的方式判断
                */
                //1：在共同父节点下操作了文本选区，改变样式了,删除文本，插入新文本及标签
                if(correctNode.nodeType === 3 && newCorrectNode.nodeType ===3 ){
                    
                    let tmp = correctNode.parentElement.innerHTML;
                    //选中文本的末尾
                    if(correctNode.textContent ===newCorrectNode.textContent+selection.removed){
                        let splitpart = tmp.split(correctNode.textContent);//以整个文本为格式划分
                        tmp = splitpart[0]+newCorrectNode.textContent+changes.inserted+splitpart[1];
                        correctNode.parentElement.innerHTML = tmp;
                    }else{
                        /*中间文本中插入*/
                        let newtmp = newCorrectNode.parentElement.innerHTML;
                        let diff = getSameText(tmp, newtmp)
                        let mergeTxt = diff.samePart +changes.inserted + diff.otherparts.substr(changes.removedLen);
                        correctNode.parentElement.innerHTML = mergeTxt;
                        //correctNode.parentElement.innerHTML = tmp.substr(0,startContainerInfo.startOffset)+ changes.inserted + tmp.substr(startContainerInfo.startOffset+changes.removedLen)
                    }
                }else if(correctNode.nodeType === 3 && newCorrectNode.nodeType ===1){
                    /*选中开头的文本*/
                    correctNode.parentElement.innerHTML = newCorrectNode.parentElement.innerHTML;
                }else if(correctNode.nodeType === 1 && newCorrectNode.nodeType ===1){
                    //选中文本的新加样式与后面相同，标签合并
                    correctNode.parentElement.innerHTML = newCorrectNode.parentElement.innerHTML;
                }else if(correctNode.nodeType === 1 && newCorrectNode.nodeType ===3){
                    //将选中的文字，由span样式还原成normal #Text
                    correctNode.parentElement.innerHTML = newCorrectNode.parentElement.innerHTML;
                }
            }
        }else{
            debugger;
        }   

        this.editor.selection.restoreSelection(); //应用选区
        //更新本地版本
        this.TextOpHistroy.setCurrentValue(this.editor.txt.html())
    }

    insertText(index, text) {
        //来自rtcmAdapter -- applyOperation
        //console.log("insertText")
        var html = this.TextOpHistroy.currentValue;
        html = html.substr(0,index) +""+ text +""+ html.substr(index);
        this.editor.txt.html(html);
        this.TextOpHistroy.setCurrentValue(this.editor.txt.html())
        // var cm = this.wangEditor
        // var cursor = cm.getCursor()
        // var resetCursor = origin === 'RTCMADAPTER' && !cm.somethingSelected() && index === cm.indexFromPos(cursor)
        // this.replaceText(index, null, text, attributes, origin)
        // if (resetCursor) cm.setCursor(cursor)
    }

    removeText(index,endindex){
        //console.log("removeText")
        var html = this.TextOpHistroy.currentValue;
        html = html.substr(0,index) +""+ html.substr(endindex);
        this.editor.txt.html(html);;
        this.TextOpHistroy.setCurrentValue(this.editor.txt.html())
    }
    // This event is fired before a change is applied, and its handler may choose to modify or cancel the change.
    onwangEditorBeforeChange_(cm, change) {
        // Remove LineSentinelCharacters from incoming input (e.g copy/pasting)
        if (change.origin === '+input' || change.origin === 'paste') {
            var newText = []
            for (var i = 0; i < change.text.length; i++) {
                var t = change.text[i]
                t = t.replace(new RegExp('[' + LineSentinelCharacter + EntitySentinelCharacter + ']', 'g'), '')
                newText.push(t)
            }
            change.update(change.from, change.to, newText)
        }
    }
}

//生成随机数
function getRandom() {
    return (Math.random() + new Date().getTime().toString()).substr(2);
}

//遍历nodeList,删除不必要的标签 数组和类数组的 nodeList、HTMLCollection
function cleanCustromTag(nodes) {
    // nodes,可能为null，需要处理
    for (var len = nodes.length, i = len - 1; i > -1; i--) {
        let curNode = nodes[i];
        if (curNode === null || curNode === undefined) {
            return;
        }
        if (curNode.nodeType === 1) {
            //node标签
            let classstr = curNode.attributes["class"];
            if (classstr && classstr.nodeValue.match("user-bg-color")) {
                //需要处理两种情况 1:只去掉用户选中文字的背景色 ；
                //1:curNode <label class="user-bg-color" style="background-color:#ff4b0c">文本编</label> 
                //这种情况需要保留文本信息  curNode.textContent '文本编'
                let txt = curNode.textContent;
                curNode.replaceWith(txt);
            } else if (classstr && classstr.nodeValue.match("user-cursor")) {
                //2:去掉插入的鼠标节点
                //<label class="user-cursor-123" style="font-size:10px......lor:#f5f5f5;left: -10px;">agtros</span></label>
                //这种情况的node直接删除
                curNode.remove();
            } else if (curNode.children.length) {
                //当节点过多或层级过深时,遍历过程要优化
                cleanCustromTag(curNode.children);
            }
        } else if (curNode.nodeType === 3) { //文本
            // 暂时不处理，部分文本样式更改，涉及到删除整个样式标签node节点
        }
    }
    return nodes;
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