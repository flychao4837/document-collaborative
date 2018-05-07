const {
    Entity,
    EntityManager
} = require('./EntityManager.js')
const {
    AttributeConstants,
    SentinelConstants
} = require('./Constants.js')
    //const {Span,AnnotationList} = require('./AnnotationList.js') //是否需要记录操作历史
const TextOperateHistroy = require('./TextOperateHistroy.js')

const StyleCache_ = {}

//传进来的时wangEditor对象实例，但是没由初始化
//这里初始化自定义事件，并创建editor
module.exports = class RichTextCodeMirror {
    constructor(wangEditor) {
        this.$ = window.jquery || jquery;
        wangEditor.customConfig.debug = true; //开启editor调试模式
        // 自定义 onchange 触发的延迟时间，默认为 200 ms
        wangEditor.customConfig.onchangeTimeout = 20 // 单位 ms
        wangEditor.customConfig.onchange = function(html) {
            // html 即变化之后的内容
            console.log(html)
            this.onChange(html)
        }.bind(this)
        wangEditor.customConfig.onfocus = function() {
            //第一次选取编辑器时会与click操作冲突
            //console.log('onfocus')
            this.onFocus()
        }.bind(this)
        wangEditor.customConfig.onblur = function(html) {
            //console.log(html)
            this.onBlur(html)
        }.bind(this)

        //生成编辑器 wangEditor.create(),把wangEditor 转成editor实例
        wangEditor.create();

        /*填充临时内容--测试用*/
        // let text = '<p>欢迎使用<b>editor</b>富<label class="user-bg-color" style="background-color:#ff4b0c">文本编</label>辑' +
        //   '<label class="user-cursor-123" style="font-size:10px;color:blue;display: inline-block;position: relative;"><span>|</span>' +
        //   '<span style="position: absolute;top:-10px;color:#999;background-color:#f5f5f5;left: -10px;">agtros</span></label>器啊</p>' +
        //   '<p><img src="https://ss0.bdstatic.com/5aV1bjqh_Q23odCf/static/superman/img/logo_top_ca79a146.png" style="max-width:100%;"></p><p><br></p>';

        // //TODO -- 手动填充内容时，需要发起change请求，以便更新server上的document。
        // wangEditor.txt.html(text);
        this.editor = wangEditor

        //获取鼠标点击事件
        this.editor.$textContainerElem.on("click", function(e) {
            //TODO--获取鼠标点击事件，和鼠标滑选操作
            console.log("click")
            this.onClick();
        }.bind(this))

        //初始化历史记录
        this.TextOpHistroy = new TextOperateHistroy(this)
        this.entityManager = new EntityManager()

        //创建临时编辑容器，取代原有编辑器的textarea，释放当前用户的鼠标选区
        this.tempEditor = null;
        this.tempInput = ''; //输入法的临时输入
        this.userInput = ''; //普通字母、数组输入，拼音输入法后选取的正确字符
        this.tempRange = null; //editor-click事件时的鼠标位置
        this.currentRange = null //输入法导致的range变化
        this.compositionEnd = true; //是否是完整的输入，拼音输入法用
        this.createTmpEditor()

        this.cursorId = Math.random().toString().substr(2,8);
        //编辑器自定义事件绑定
        Utils.makeEventEmitter(RichTextCodeMirror, ['change', 'attributesChange', 'newLine', 'realtimeTextAttrsChanged'], this)
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
        //TODO -- 正常情况是逐个删除或插入，但是存在鼠标滑动选择或者快捷键选取文字后直接输入文字替换
        //这种情况下，应该先计算删除操作，在计算插入操作，拆分成多个步骤
        let htmlElem = this.cleanHtmlElem(html);
        let txt = this.setDOMElementToStr(htmlElem);
        let delta = this.TextOpHistroy.getDelta(txt);
        console.log("onChange delta:", delta);
        let changes = [];
        //当由编辑器focus导致的编辑器active状态变化，从而发起onchange，此时主动取消此次onchange事件
        if (!delta) {
            return;
        }
        if (!this.TextOpHistroy.changed) {
            ///这里触发自定义的change事件，处理operation，cursor，和本地历史记录相关
            // {operatios,metadata} 操作步骤和鼠标位置记录
            this.TextOpHistroy.updateOperateHistroy(delta);
            //TODO--delta记录的是文本变化，有可能一次变化来多处，所以changes应该是一个数组
            //TODO -- 把编辑器的操作拆分成多个单独步(编辑器把文本样式修改合并成一个change，应该先删除，在插入)
            changes.push(delta);
            this.updateTempRange(delta, txt)
            this.trigger('change', this, changes);
        }
    }
    onFocus() {
        //TODO-获取鼠标位置，更新，推送鼠标位置信息
        //let cursorData = this.getUserCursorOffset()
    }
    onBlur(html) {
        //TODO--更新，推送鼠标位置信息
        console.log("blur");
    }

    onClick() {
        this.tempInput = '';
        this.userInput = '';
        this.setUserCursor();
    }

    //TODO-获取当前用户的光标位置，重新设置用户的模拟光标
    setUserCursor() {
        let $ = this.$;
        let cursorData = this.getUserCursorOffset()
        console.log('鼠标位置信息', cursorData)
        //鼠标滑选了文本，不是单纯的点击后输入
        if(!cursorData.collapsed){
            return;
        }
        this.tempRange = cursorData;
        this.insertTempContents();

    }

    //创建隐藏鼠标编辑区域
    createTmpEditor() {
        let $ = this.$;
        let userCursor = $(".userCursor");
        let txtBox = $(".hiddeneEditor")
        if (userCursor[0]) {
            userCursor.css({
                'top': '10px',
                'left': '10px'
            })
        } else {
            //$(".w-e-text-container").append($('<p class="userCursor" style="left:10px;top:10px">|</p>'))
        }
        if (txtBox[0]) {
            //txtBox.val("").focus();
        } else {
            let box = $('<textarea class="hiddeneEditor"></textarea>')
            $(".w-e-text-container").append(box)
            box.focus();
        }
        this.bindCustomEvent(txtBox);
    }

    //清理临时编辑器的内容并获取焦点
    cleanTempEditorInput() {
        this.tempEditor.val('').focus();
    }

    //给自定义编辑区绑定键盘，鼠标事件
    bindCustomEvent(box) {
        let $ = this.$;
        let txtBox = $(".w-e-text-container").find(".hiddeneEditor");
        if (!txtBox[0]) {
            this.createTmpEditor();
        } else {
            this.tempEditor = txtBox;
            txtBox.on("keyup", (e) => {
                e.stopPropagation();
                e.preventDefault();
                //键盘按键 1：输入 2：删除 3：ctrl、shift、Alt等组合键
                var keynum;
                var keychar;
                keynum = window.event ? e.keyCode : e.which;
                keychar = String.fromCharCode(keynum);
                console.log("keynum：", keynum)
                //console.log("this.compositionEnd:", this.compositionEnd)
                if (keynum === 46 || keynum === 8) {
                    //删除用户临时输入或range前的字符
                    this.clearTempInput();
                }if(keynum ===13){
                    //Enter回车键，如果编辑区没内容，当作插入新行，否则当成enter选取输入文字
                    if(this.compositionEnd){
                        this.insertNewLine();
                    }
                } else {
                    let val = txtBox.val()
                    if (this.compositionEnd) {
                        //TODO--拼音输入法处理
                        if (this.tempInput !== val) {
                            this.tempInput = val;
                        }
                    }
                    //console.log('keyup', txtBox.val())
                    this.insertTempContents()
                }
            })
            txtBox.on('compositionstart', () => {
                // 输入法开始输入
                this.compositionEnd = false;
                let val = txtBox.val()
                if (this.tempInput = val) {
                    return;
                }
                this.tempInput = val;
                //console.log(1)
            })
            txtBox.on('compositionend', () => {
                // 输入法结束输入
                this.compositionEnd = true;
                let val = txtBox.val()
                if (val === this.userInput) {
                    return;
                }
                this.userInput = val;
                //console.log(2)
            })
        }
    }

    //将临时编辑器的内容插入到编辑器展示区，模拟用户输入
    insertTempContents() {
        let html = this.getCleanHtml();
        let userCursorTmp = '<label class="user-cursor" data-id="'+this.cursorId+'"></label>';
        html = html.substr(0, this.tempRange.startOffset) + this.tempInput + userCursorTmp + html.substr(this.tempRange.endOffset);
        this.setEditorContent(html);
        //一次完整的输入后，清理编辑区，更新鼠标选区
        if (this.compositionEnd) {
            this.cleanTempEditorInput();
        }
        this.onChange(html);
    }

    //删除用户输入或文本
    clearTempInput() {
        let html = this.getCleanHtml();
        if (html.length < 8 || html == '<p><br></p>') {
            return;
        } else {
            if (this.compositionEnd === true) {
                html = html.substr(0, this.tempRange.startOffset - 1) + html.substr(this.tempRange.endOffset);
                this.setEditorContent(html);
                this.cleanTempEditorInput();
                this.onChange(html);
            }
        }
    }

    //由于样式变化等，导致原文本startOffset变化，维护更新本地tempRange，domType，domLevel也需要更新
    updateTempRange(delta, html) {
        //delta[retain,current,reset] 和range[startOffset,endOffset] 的区别，需要转换delta数据来得到endOffset
        //console.log("delta：",delta)
        if(!html){
            this.tempRange = delta;
            return;
        }
        //TOFix -- 到这一步时 domDeep,domLevel是错的
        if (delta.removed === "" && delta.inserted !== '') {
            //只增加字符
            this.tempRange.endOffset =  this.tempRange.startOffset = delta.start + delta.inserted.length;
        } else if (delta.removed !== "" && delta.inserted === '') {
            //只减少字符
            this.tempRange.endOffset = this.tempRange.startOffset = delta.start;
        } else if (delta.removed !== "" && delta.inserted !== '') {//修改行内样式--先删除，后增加。包括标签，样式和文本
            //修改的样式
            let tagMatch = delta.inserted.match(/<[^/][^>]+>/);
            if(tagMatch && tagMatch[0]){
                //添加的样式标签，设置完样式后取消选区选中状态，把range设置到字符串最后位置
                this.tempRange.startOffset = delta.start + tagMatch[0].length + delta.removed.length;
                this.tempRange.endOffset = this.tempRange.startOffset;
            }else{
                //选取来一段文本删除
                this.tempRange.startOffset = delta.start + delta.inserted.length;
                this.tempRange.endOffset = this.tempRange.startOffset;
            }
            

            //debugger;
        }
        this.tempEditor.focus();
        console.log("变换后的鼠标位置：",this.tempRange)
    }

    //向编辑器插入新行
    insertNewLine(){

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
            if (unCloseTag().indexOf(tag) > -1) {
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
            // 文本节点
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

    getRootNode(node) {}

    //获取传入的node相对文档根节点的层级,文档容器w-e-text，id="text-elemxxxxxxx"的层级为0
    getNodeDeepSize(node) {
        var size = 1;

        function getDeepSize(node) {
            var classValue = void 0;
            if (node.nodeType == 1) {
                classValue = node.getAttribute("class");
            }

            if (classValue && (classValue.indexOf("user-bg-color") > -1 || classValue.indexOf("user-cursor") > -1)) {
                --size;
            }
            if (!node.parentNode.attributes) {
                return;
            }
            if (node.parentNode.attributes.length) {
                var id = node.parentNode.getAttribute("id");
                if (!id || id.indexOf("text-elem") < 0) {
                    ++size;
                    getDeepSize(node.parentNode);
                }
            } else {
                ++size;
                getDeepSize(node.parentNode);
            }
        }
        getDeepSize(node);
        //console.log("节点深度", size);
        return size;
    }

    getRootRanderTree() {
        var ctx = this.getEditorCtx();
        var htmlElem = this.cleanHtmlElem(ctx);
        var json = this.getChildrenJSON(htmlElem);
        return json;
    }

    /**
     **获取当前根节点下字符的长度 对于空白标签range的startOffset=0，
     **若鼠标点击在图片后 startoffset=endOffset=1，
     ** 即图片只当成来长为1的元素，需要手动处理img的src和标签
     **/

    //获取鼠标所在节点
    //TOFix--获取根节点p错误
    getCurrentRootElem(rootSelectionElem) {
        var rootElems = this.setStrToDOMElement(this.getEditorCtx());
        var currentRootElem = null;
        var prevNodes = [];
        var result = void 0;
        for (var i = 0, len = rootElems.length; i < len; i++) {
            result = isContainElem(rootSelectionElem, rootElems[i]);
            if (result) {
                currentRootElem = rootElems[i];
                break;
            } else {
                prevNodes.push(rootElems[i]);
            }
        }
        return {
            prevNodes: prevNodes,
            currentRootElem: currentRootElem
        };
    }

    //TODO-记录用户的鼠标位置，在设置editorcontent后，将用户鼠标放到远有位置
    setUserCursorOffset() {}

    //TODO-记录用户的鼠标位置，在设置editorcontent后，将用户鼠标放到远有位置
    getUserCursorOffset() {
        var treeNode = this.getRootRanderTree();
        //这里 rangeRootContainer 取的是$textElement,不能直接修改,从Element转成node
        var rangeRootContainer = this.editor.selection.getSelectionContainerElem()[0];
        var range = this.editor.selection.getRange();

        //rootElemsBeforeCursor 是编辑器下内容根节点
        var rootElemsBeforeCursor = this.getCurrentRootElem(rangeRootContainer);
        //TODO --  rootElemsBeforeCursor包含currentContainer时，取值有错误取了rootElemsBeforeCursor里的所有值，
        //只能取节点前到当前节点的内容
        var currentContainer = void 0;
        var splitText = '';
        var startOffset = 0,
            endOffset = 0,
            distance = 0,
            domLevel = 0,
            domDeep = 0;

        function getSplitText(rootElemsBeforeCursor, limitOption) {
            var prevNodes = rootElemsBeforeCursor.prevNodes;
            for (var i in prevNodes) {
                var prevNode = cleanCustromTag([prevNodes[i]]);
                if(prevNode && prevNode[0])splitText += getCharByJsonTree(prevNode[0]);
            }
            //清理custrom定义的标签
            var nodes = cleanCustromTag([rootElemsBeforeCursor.currentRootElem]);
            if(nodes && nodes[0])splitText += getCharByJsonTree(nodes[0], limitOption);
        }
        //console.log(range);

        if (range.startContainer === range.endContainer) {
            //同一元素dom
            if (range.startOffset === range.endOffset) {
                //只单点了光标
                var _currentContainer = range.startContainer;
                var limitOption = {
                    nodeName: _currentContainer.nodeName,
                    nodeType: _currentContainer.nodeType,
                    nodeValue: _currentContainer.nodeValue,
                    domDeep: this.getNodeDeepSize(_currentContainer),
                    collapsed: range.collapsed,
                    splitIndex: range.startOffset,
                    isCrossNode: false
                };
                getSplitText(rootElemsBeforeCursor, limitOption);

                startOffset = endOffset = splitText.length;
                domLevel = _currentContainer.nodeType;
                domDeep = limitOption.domDeep;
            } else {
                //鼠标拖选中了文字
                var _currentContainer2 = range.startContainer;
                var _limitOption = {
                    nodeName: _currentContainer2.nodeName,
                    nodeType: _currentContainer2.nodeType,
                    nodeValue: _currentContainer2.nodeValue,
                    domDeep: this.getNodeDeepSize(_currentContainer2),
                    collapsed: range.collapsed,
                    splitIndex: range.startOffset,
                    isCrossNode: false
                };

                getSplitText(rootElemsBeforeCursor, _limitOption);

                distance = Math.abs(range.endOffset - range.startOffset);
                startOffset = splitText.length;
                endOffset = startOffset + distance;
                domLevel = _currentContainer2.nodeType;
                domDeep = _limitOption.domDeep;
            }
        } else {
            //跨元素dom,需要计算涉及的每个子元素
            var startContainer = range.startContainer;
            var endContainer = range.endContainer;

            var startLimitOption = {
                nodeName: startContainer.nodeName,
                nodeType: startContainer.nodeType,
                nodeValue: startContainer.nodeValue,
                collapsed: range.collapsed,
                splitIndex: range.startOffset
            };
            var endLimitOption = {
                nodeName: endContainer.nodeName,
                nodeType: endContainer.nodeType,
                nodeValue: endContainer.nodeValue,
                domDeep: this.getNodeDeepSize(endContainer),
                collapsed: range.collapsed,
                splitIndex: range.startOffset
            };
            this.getSplitText(rootElemsBeforeCursor, startLimitOption);
            startOffset = splitText.length;
            splitText = '';
            this.getSplitText(rootElemsBeforeCursor, endLimitOption);
            endOffset = splitText.length;
        }

        //console.log(splitText);
        //console.log("cursorOffset length", splitText.length);
        console.log("用户鼠标位置索引:" , splitText.length);
        let rangeData = {
            startOffset: startOffset,
            endOffset: endOffset,
            domDeep: domDeep,
            domLevel: domLevel,
            startContainer: range.startContainer,
            endContainer: range.endContainer,
            collapsed: range.collapsed,
            rangeRootContainer
        }
        this.updateTempRange(rangeData);
        return rangeData;
    }

    //TODO-根据websocket返回的消息，创建新的html并填充到编辑器中
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

    //填充内容
    setContent(html) {
        this.editor.txt.html(html);
        this.tempEditor.focus();
        //TODO -- 从第三方更新数据的话，需要更新本地的tempRange，判断插入点是在当前节点前还是节点后
    }

    getRange(start, end) {
        var from = this.wangEditor.posFromIndex(start)
        var to = this.wangEditor.posFromIndex(end)
        return this.wangEditor.getRange(from, to)
    }

    insertText(index, text, attributes, origin) {
        //来自rtcmAdapter -- applyOperation
        console.log("insertText")
        var html = this.TextOpHistroy.currentValue;
        html = html.substr(0, index) + "" + text + "" + html.substr(index);
        this.setContent(html);
        this.TextOpHistroy.setCurrentValue(html)
            // var cm = this.wangEditor
            // var cursor = cm.getCursor()
            // var resetCursor = origin === 'RTCMADAPTER' && !cm.somethingSelected() && index === cm.indexFromPos(cursor)
            // this.replaceText(index, null, text, attributes, origin)
            // if (resetCursor) cm.setCursor(cursor)
    }
    removeText(index, endindex) {
            console.log("removeText")
            var html = this.TextOpHistroy.currentValue;
            html = html.substr(0, index) + "" + html.substr(endindex);
            this.setContent(html);
            this.TextOpHistroy.setCurrentValue(html)
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

function last(arr) {
    return arr[arr.length - 1]
}

function sumLengths(strArr) {
    if (strArr.length === 0) {
        return 0
    }
    var sum = 0
    for (var i = 0; i < strArr.length; i++) {
        sum += strArr[i].length
    }
    return sum + strArr.length - 1
}

//生成随机数
function getRandom() {
    return (Math.random() + new Date().getTime().toString()).substr(2);
}

//不需要尾部闭合标签的元素
function unCloseTag() {
    return 'img input br hr'.split(/\s+/);
}

//遍历nodeList,删除不必要的标签 数组和类数组的 nodeList、HTMLCollection
function cleanCustromTag(nodes) {
    //TODO -- nodes,可能为null，需要处理
    for (var len = nodes.length, i = len - 1; i > -1; i--) {
        let curNode = nodes[i];
        if (curNode === null || curNode === undefined) {
            return;
        }
        if (curNode.nodeType === 1) {
            //node标签
            let classstr = curNode.attributes["class"];
            //console.log(classstr);
            if (classstr && classstr.nodeValue.match("user-bg-color")) {
                //需要处理两种情况 1:只去掉用户选中文字的背景色 ；
                //1:curNode <label class="user-bg-color" style="background-color:#ff4b0c">文本编</label> 
                //这种情况需要保留文本信息  curNode.textContent '文本编'
                //console.log(curNode);
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
            //TODO -- 暂时不处理，部分文本样式更改，涉及到删除整个样式标签node节点
        }
    }
    //console.log(nodes);
    return nodes;
}

//判断当前节点是否包含子节点
function isContainElem(rootSelectionElem, rootElem) {
    let result = false;
    if (!rootSelectionElem || !rootElem) {
        return result;
    }
    if (rootElem.innerHTML === rootSelectionElem.innerHTML) {
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

//遍历层级时 deep 的取值有问题，从底层遍历后没法把deep再往上还原
function getCharByJsonTree(rootElem, limitOpt) {
    var size = 0,
        tmpStr = "",
        deep = 1,
        breakStatus = false;
    //递归，闭包
    function elemMap(rootElem, limitOpt) {
        var tag = rootElem.nodeName.toLocaleLowerCase();
        var attrs = rootElem.attributes;
        deep = deep > 0 ? deep: 1;

        if (rootElem.nodeType === 1) {
            tmpStr += '<' + tag;
            for (var j = 0, len = attrs.length; j < len; j++) {
                tmpStr += ' ' + attrs[j].nodeName + '="' + attrs[j].nodeValue + '"';
            }

            if (unCloseTag().indexOf(tag) > -1) {
                tmpStr += '>';
            } else {
                tmpStr += '>';
                if (rootElem.childNodes.length > 0) {
                    limitOpt && ++deep; //遍历层级递减

                    //Img前后索引的特殊处理
                    if (limitOpt && deep && rootElem.nodeType === limitOpt.nodeType && rootElem.nodeName === limitOpt.nodeName &&
                        rootElem.nodeValue === limitOpt.nodeValue) {

                        if (rootElem.nodeType == 1) {
                            if (rootElem.innerText == "" && limitOpt.splitIndex === 1 && rootElem.childNodes.length === 1 &&
                                rootElem.childNodes[0].nodeName.toLowerCase() === "img") {
                                tmpStr += rootElem.innerHTML;
                            }
                        } else if (rootElem.nodeType == 3) {
                            tmpStr += rootElem.nodeValue.substr(0, limitOpt.splitIndex);
                        }
                        return '';
                    }
                    //遍历子元素，取到对应内容
                    //TOFix -- 多层递归导致外层的for循环无法中断--直接return 跳出函数
                    for (var _j = 0, _len2 = rootElem.childNodes.length; _j < _len2; _j++) {
                        if (breakStatus) {
                            return ;
                        }
                        if (limitOpt && limitOpt.domDeep === deep && rootElem.childNodes[_j].nodeType === limitOpt.nodeType &&
                            rootElem.childNodes[_j].nodeName === limitOpt.nodeName && rootElem.childNodes[_j].nodeValue === limitOpt.nodeValue) {

                            //Note--对于用鼠标滑动选区的文本区，取最左侧的文本。文字方向的问题后期再修复 ltr or rtl
                            tmpStr += rootElem.childNodes[_j].nodeValue.substr(0, limitOpt.splitIndex);
                            breakStatus = true;
                            return ;
                        } else {
                            elemMap(rootElem.childNodes[_j], limitOpt);
                        }
                    }
                }
                --deep;
                tmpStr += '</' + tag + '>';
            }
        } else {
            tmpStr += rootElem.nodeValue;
        }
    }
    if (limitOpt) {
        elemMap(rootElem, limitOpt);
    } else {
        elemMap(rootElem);
    }
    //console.log(tmpStr)
    return tmpStr;
}