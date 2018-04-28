(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', './Utils.js', './EntityManager.js', './Constants.js', './TextOperateHistroy.js', './jquery-1.10.2.min.js'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('./Utils.js'), require('./EntityManager.js'), require('./Constants.js'), require('./TextOperateHistroy.js'), require('./jquery-1.10.2.min.js'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.Utils, global.EntityManager, global.Constants, global.TextOperateHistroy, global.jquery1102Min);
        global.RichTextCodeMirror = mod.exports;
    }
})(this, function (module, Utils, _require, _require2, TextOperateHistroy, Jquery) {
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

    var Entity = _require.Entity,
        EntityManager = _require.EntityManager;
    var AttributeConstants = _require2.AttributeConstants,
        SentinelConstants = _require2.SentinelConstants;


    var StyleCache_ = {};

    //传进来的时wangEditor对象实例，但是没由初始化
    //这里初始化自定义事件，并创建editor
    module.exports = function () {
        function RichTextCodeMirror(wangEditor) {
            _classCallCheck(this, RichTextCodeMirror);

            wangEditor.customConfig.debug = true; //开启editor调试模式
            // 自定义 onchange 触发的延迟时间，默认为 200 ms
            wangEditor.customConfig.onchangeTimeout = 100; // 单位 ms
            wangEditor.customConfig.onchange = function (html) {
                // html 即变化之后的内容
                //console.log(html)
                this.onChange(html);
            }.bind(this);
            wangEditor.customConfig.onfocus = function () {
                console.log('onfocus');
                this.onFocus();
            }.bind(this);
            wangEditor.customConfig.onblur = function (html) {
                //console.log(html)
                this.onBlur(html);
            }.bind(this);
            //生成编辑器
            wangEditor.create();
            /*填充临时内容--测试用*/

            var text = '<p>欢迎使用<b>editor</b>富<label class="user-bg-color" style="background-color:#ff4b0c">文本编</label>辑' + '<label class="user-cursor-123" style="font-size:10px;color:blue;display: inline-block;position: relative;"><span>|</span>' + '<span style="position: absolute;top:-10px;color:#999;background-color:#f5f5f5;left: -10px;">agtros</span></label>器啊</p>' + '<p><img src="https://ss0.bdstatic.com/5aV1bjqh_Q23odCf/static/superman/img/logo_top_ca79a146.png" style="max-width:100%;"></p><p><br></p>';

            wangEditor.txt.html(text);
            this.editor = wangEditor;

            //初始化历史记录
            this.TextOpHistroy = new TextOperateHistroy(this);

            this.entityManager = new EntityManager();

            //编辑器自定义事件绑定
            Utils.makeEventEmitter(RichTextCodeMirror, ['change', 'attributesChange', 'newLine', 'realtimeTextAttrsChanged'], this);
        }

        _createClass(RichTextCodeMirror, [{
            key: 'detach',
            value: function detach() {
                this.wangEditor.off('beforeChange', this.onwangEditorBeforeChange_.bind(this));
                if (parseInt(window.wangEditor.version) > 4) {
                    this.wangEditor.off('changes', this.onwangEditorChange_.bind(this));
                } else {
                    this.wangEditor.off('change', this.onwangEditorChange_.bind(this));
                }
                this.wangEditor.off('cursorActivity', this.onCursorActivity_.bind(this));
            }
        }, {
            key: 'onChange',
            value: function onChange(html) {
                var htmlElem = this.cleanHtmlElem(html);
                var txt = this.setDOMElementToStr(htmlElem);
                var delta = this.TextOpHistroy.getDelta(txt);
                //当由编辑器focus导致的编辑器active状态变化，从而发起onchange，此时主动取消此次onchange事件
                if (delta.contents == "" && delta.baseLength === delta.targetLength) {
                    return;
                }
                if (!this.TextOpHistroy.changed) {
                    ///这里触发自定义的change事件，处理operation，cursor，和本地历史记录相关
                    // {operatios,metadata} 操作步骤和鼠标位置记录
                    var changeData = this.getEditorChangeInfo();
                    this.trigger('change', this, changeData);
                }
            }
        }, {
            key: 'onFocus',
            value: function onFocus() {
                //TODO-获取鼠标位置，更新，推送鼠标位置信息
                var cursorData = this.getUserCursorOffset();
            }
        }, {
            key: 'onBlur',
            value: function onBlur(html) {
                //TODO--更新，推送鼠标位置信息
            }
        }, {
            key: 'getEditorChangeInfo',
            value: function getEditorChangeInfo() {
                //当editor内容发生变化时，触发事件
                var cm = this.editor;
                var changes = this.TextOpHistroy.changes;
                var newChanges = [];
                var html = this.getCleanHtml();
                var delta = this.TextOpHistroy.getDelta(html);
                var operation = {};
                console.log(delta);

                if (newChanges.length > 0) {
                    //
                } else {}
                return {
                    operation: operation,
                    range: range
                };
            }
        }, {
            key: 'getEditorCtx',
            value: function getEditorCtx() {
                return this.editor.txt.html();
            }
        }, {
            key: 'setStrToNodeLists',
            value: function setStrToNodeLists(str) {
                var el = document.createElement("div");
                el.setAttribute("id", getRandom());
                el.innerHTML = str;
                return el.childNodes;
            }
        }, {
            key: 'setStrToDOMElement',
            value: function setStrToDOMElement(str) {
                var el = document.createElement("div");
                el.setAttribute("id", getRandom());
                el.innerHTML = str;
                return el.children;
            }
        }, {
            key: 'setDOMElementToStr',
            value: function setDOMElementToStr(elem) {
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
        }, {
            key: 'getCurCursor',
            value: function getCurCursor() {}
            //retun ranges


            //清理html文本中人为添加的鼠标,背景色信息

        }, {
            key: 'cleanHtmlElem',
            value: function cleanHtmlElem(html) {
                if (!html || typeof html !== "string") {
                    return;
                } else {
                    var dom = this.setStrToDOMElement(html);
                    return cleanCustromTag(dom);
                }
            }
        }, {
            key: 'getCleanHtml',
            value: function getCleanHtml() {
                var ctx = this.getEditorCtx();
                var htmlElem = this.cleanHtmlElem(ctx);
                var htmlstr = this.setDOMElementToStr(htmlElem);
                return htmlstr;
            }
        }, {
            key: 'replaceHtmlSymbol',
            value: function replaceHtmlSymbol(html) {
                if (html == null) {
                    return '';
                }
                return html.replace(/</gm, '&lt;').replace(/>/gm, '&gt;').replace(/"/gm, '&quot;').replace(/(\r\n|\r|\n)/g, '<br/>');
            }
        }, {
            key: 'setEditorContent',
            value: function setEditorContent(html) {
                //ot.changed = true;
                this.editor.txt.html(html);
                //ot.changed = false;
            }
        }, {
            key: 'getChildrenJSON',
            value: function getChildrenJSON(elem) {
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
        }, {
            key: 'getRootNode',
            value: function getRootNode(node) {}
        }, {
            key: 'getNodeDeepSize',
            value: function getNodeDeepSize(node) {
                var size = 1;

                function getDeepSize(node) {
                    var classValue = void 0;
                    if (node.nodeType == 1) {
                        classValue = node.getAttribute("class");
                    }

                    if (classValue && (classValue.indexOf("user-bg-color") > -1 || classValue.indexOf("user-cursor") > -1)) {
                        --size;
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
                console.log("节点深度", size);
                return size;
            }
        }, {
            key: 'getRootRanderTree',
            value: function getRootRanderTree() {
                var ctx = this.getEditorCtx();
                var htmlElem = this.cleanHtmlElem(ctx);
                var json = this.getChildrenJSON(htmlElem);
                return json;
            }
        }, {
            key: 'getCurrentRootElem',
            value: function getCurrentRootElem(rootSelectionElem) {
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
        }, {
            key: 'setUserCursorOffset',
            value: function setUserCursorOffset() {}
        }, {
            key: 'getUserCursorOffset',
            value: function getUserCursorOffset() {
                var treeNode = this.getRootRanderTree();
                //这里 rangeRootContainer 取的是$textElement,不能直接修改,从Element转成node
                var rangeRootContainer = this.editor.selection.getSelectionContainerElem()[0];
                var range = this.editor.selection.getRange();

                var rootElemsBeforeCursor = this.getCurrentRootElem(rangeRootContainer);
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
                        splitText += getCharByJsonTree(prevNode[0]);
                    }
                    //清理custrom定义的标签
                    var nodes = cleanCustromTag([rootElemsBeforeCursor.currentRootElem]);
                    splitText += getCharByJsonTree(nodes[0], limitOption);
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
                //console.log("用户鼠标位置索引:" , splitText.length);
                return {
                    startOffset: startOffset,
                    endOffset: endOffset,
                    domDeep: domDeep,
                    domLevel: domLevel
                };
            }
        }, {
            key: 'setEditorContentByServerMsg',
            value: function setEditorContentByServerMsg(data) {
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
        }, {
            key: 'setContent',
            value: function setContent(html) {
                this.editor.txt.html(html);
            }
        }, {
            key: 'getRange',
            value: function getRange(start, end) {
                var from = this.wangEditor.posFromIndex(start);
                var to = this.wangEditor.posFromIndex(end);
                return this.wangEditor.getRange(from, to);
            }
        }, {
            key: 'insertText',
            value: function insertText(index, text, attributes, origin) {
                var cm = this.wangEditor;
                var cursor = cm.getCursor();
                var resetCursor = origin === 'RTCMADAPTER' && !cm.somethingSelected() && index === cm.indexFromPos(cursor);
                this.replaceText(index, null, text, attributes, origin);
                if (resetCursor) cm.setCursor(cursor);
            }
        }, {
            key: 'onwangEditorBeforeChange_',
            value: function onwangEditorBeforeChange_(cm, change) {
                // Remove LineSentinelCharacters from incoming input (e.g copy/pasting)
                if (change.origin === '+input' || change.origin === 'paste') {
                    var newText = [];
                    for (var i = 0; i < change.text.length; i++) {
                        var t = change.text[i];
                        t = t.replace(new RegExp('[' + LineSentinelCharacter + EntitySentinelCharacter + ']', 'g'), '');
                        newText.push(t);
                    }
                    change.update(change.from, change.to, newText);
                }
            }
        }]);

        return RichTextCodeMirror;
    }();

    function last(arr) {
        return arr[arr.length - 1];
    }

    function sumLengths(strArr) {
        if (strArr.length === 0) {
            return 0;
        }
        var sum = 0;
        for (var i = 0; i < strArr.length; i++) {
            sum += strArr[i].length;
        }
        return sum + strArr.length - 1;
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
        for (var len = nodes.length, i = len - 1; i > -1; i--) {
            var curNode = nodes[i];
            if (curNode.nodeType === 1) {
                //node标签
                var classstr = curNode.attributes["class"];
                //console.log(classstr);
                if (classstr && classstr.nodeValue.match("user-bg-color")) {
                    //需要处理两种情况 1:只去掉用户选中文字的背景色 ；
                    //1:curNode <label class="user-bg-color" style="background-color:#ff4b0c">文本编</label> 
                    //   这种情况需要保留文本信息  curNode.textContent '文本编'
                    //console.log(curNode);
                    var txt = curNode.textContent;
                    curNode.replaceWith(txt);
                } else if (classstr && classstr.nodeValue.match("user-cursor")) {
                    //2:去掉插入的鼠标节点
                    //2:<label class="user-cursor-123" style="font-size:10px......lor:#f5f5f5;left: -10px;">agtros</span></label>
                    //   这种情况的node直接删除
                    //console.log(curNode);
                    curNode.remove();
                } else if (curNode.children.length) {
                    //当节点过多或层级过深时,遍历过程要优化
                    cleanCustromTag(curNode.children);
                }
            } else if (curNode.nodeType === 3) {//文本
                //
            }
        }
        //console.log(nodes);
        return nodes;
    }

    //判断当前节点是否包含子节点
    function isContainElem(rootSelectionElem, rootElem) {
        var result = false;
        if (!rootSelectionElem || !rootElem) {
            return result;
        }
        if (rootElem.innerHTML === rootSelectionElem.innerHTML) {
            result = true;
        } else if (rootElem.childElementCount > 0) {
            for (var i = 0, len = rootElem.childElementCount; i < len; i++) {
                var rt = isContainElem(rootSelectionElem, rootElem[i]);
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

    //TOFix -- 选中自定义标签时，获取的鼠标位置和文本有错误
    function getCharByJsonTree(rootElem, limitOpt) {
        var size = 0,
            tmpStr = "",
            deep = 1,
            breakStatus = false;
        console.log(rootElem);
        //递归，闭包
        function elemMap(rootElem, limitOpt) {
            var tag = rootElem.nodeName.toLocaleLowerCase();
            var attrs = rootElem.attributes;
            deep = limitOpt ? limitOpt.domDeep : 0;

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
                        limitOpt && --limitOpt.domDeep; //遍历层级递减

                        //Img前后索引的特殊处理
                        if (limitOpt && deep && rootElem.nodeType === limitOpt.nodeType && rootElem.nodeName === limitOpt.nodeName && rootElem.nodeValue === limitOpt.nodeValue) {

                            if (rootElem.nodeType == 1) {
                                if (rootElem.innerText == "" && limitOpt.splitIndex === 1 && rootElem.childNodes.length === 1 && rootElem.childNodes[0].nodeName.toLowerCase() === "img") {
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
                                return;
                            }
                            if (limitOpt && limitOpt.domDeep === 1 && rootElem.childNodes[_j].nodeType === limitOpt.nodeType && rootElem.childNodes[_j].nodeName === limitOpt.nodeName && rootElem.childNodes[_j].nodeValue === limitOpt.nodeValue) {

                                //Note--对于用鼠标滑动选区的文本区，取最左侧的文本。文字方向的问题后期再修复 ltr or rtl
                                tmpStr += rootElem.childNodes[_j].nodeValue.substr(0, limitOpt.splitIndex);
                                breakStatus = true;
                                return;
                            } else {
                                elemMap(rootElem.childNodes[_j], limitOpt);
                            }
                        }
                    }
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
});