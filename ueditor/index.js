/*文档操作*/
$(function() {
    var editor = UE.getEditor('container');

    function getContent() {
        return editor.getContent();
    }

    //将element转成json
    function getChildrenJSON(elem) {
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
                elemResult = replaceHtmlSymbol(elemResult);
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
                elemResult.children = getChildrenJSON(curElem.childNodes);
            }

            result.push(elemResult);
        };
        return result;
    }

    //不需要尾部闭合标签的元素
    var unCloseTag = 'img input br hr'.split(/\s+/);
    //生成随机数
    function getRandom() {
        return (Math.random() + new Date().getTime().toString()).substr(2);
    }

    // 替换 html 特殊字符
    function replaceHtmlSymbol(html) {
        if (html == null) {
            return '';
        }
        return html.replace(/</gm, '&lt;').replace(/>/gm, '&gt;').replace(/"/gm, '&quot;').replace(/(\r\n|\r|\n)/g, '<br/>');
    }

    //html文本转成nodeLists
    function setStrToNodeLists(str) {
        var el = document.createElement("div");
        el.setAttribute("id", getRandom());
        el.innerHTML = str;
        return el.childNodes;
    }

    //html文本转成HTMLcollection
    function setStrToDOMElement(str) {
        var el = document.createElement("div");
        el.setAttribute("id", getRandom());
        el.innerHTML = str;
        return el.children;
    }

    //从HTMLCollection中取第一层的innerHTML，拼成完整的html
    function setDOMElementToStr(elem) {
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
            } else if (curNode.nodeType === 3) { //文本
                //
            }
        }
        //console.log(nodes);
        return nodes;
    }


    let rangeText;
    editor.addListener('selectionchange', function(type) {
        console.log('选区发生改变');
        var range = editor.selection.getRange();
	    range.select();
        rangeText = editor.selection.getText();
    })

    editor.addListener('contentChange', function(type) {
        console.log('contentChange');
        let plainTest = editor.getPlainTxt();
        //console.log('plainTest', plainTest)
        let content = editor.getContent();
        //console.log("content", content)
    })

    //插入指定代码
	function insertHtml() {
	    var value = prompt('插入html代码', '');
	    editor.execCommand('insertHtml', value)
	}

	$("#btn1").on("click", function() {
	    var html = editor.getContent();
	    var dom = setStrToDOMElement(html);
	    var htmlElem = cleanCustromTag(dom);
		console.log(htmlElem);
		var json = getChildrenJSON(htmlElem);
		var jsonStr = JSON.stringify(json);
		console.log(json);
		console.log(jsonStr);
	})

	//插入手动元素和内容
	$("#btn2").on("click", function(){
		insertHtml();
	})

	$("#btn3").on("click", function(){
		var range = editor.selection.getRange();
	    range.select();
        rangeText = editor.selection.getText();
        console.log('range',range)

        //给选定的range范围插入行内标签和属性,标签和属性必须在白名单内
        range.applyInlineStyle("span",{"class":getRandom()})
	})
})

