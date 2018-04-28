(function (global, factory) {
	if (typeof define === "function" && define.amd) {
		define(["exports"], factory);
	} else if (typeof exports !== "undefined") {
		factory(exports);
	} else {
		var mod = {
			exports: {}
		};
		factory(mod.exports);
		global.editorChannel = mod.exports;
	}
})(this, function (exports) {
	"use strict";

	var _typeof2 = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
		return typeof obj;
	} : function (obj) {
		return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	};

	(function (global, factory) {
		if (typeof define === "function" && define.amd) {
			define([], factory);
		} else if (typeof exports !== "undefined") {
			factory();
		} else {
			var mod = {
				exports: {}
			};
			factory();
			global.editorChannel = mod.exports;
		}
	})(undefined, function () {
		'use strict';

		var _typeof = typeof Symbol === "function" && _typeof2(Symbol.iterator) === "symbol" ? function (obj) {
			return typeof obj === "undefined" ? "undefined" : _typeof2(obj);
		} : function (obj) {
			return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj === "undefined" ? "undefined" : _typeof2(obj);
		};

		//editor-websocket-逻辑测试
		//获取编辑器编辑的状态信息,websocket数据的同步
		var E = window.wangEditor;
		var editor = new E('#editor');
		var ot = new historyOperate(editor); //创建新的历史操作记录
		var websocket = new webSocketInit('ws://127.0.0.1:8181');
		editor.customConfig.onchangeTimeout = 50;
		editor.customConfig.onchange = function (html) {
			// html 即变化之后的内容
			//var rangs = editor.selection.getRange();
			console.log("onchange");
			//ot.changed = true;
			var htmlElem = cleanHtmlElem(html);
			var txt = setDOMElementToStr(htmlElem);
			var delta = ot.getDelta(txt);
			if (!ot.changed) {
				var msg = {
					identificationID: getRandom(),
					command: "formUpdate",
					from: 0, // 0 表示发起请求,1 表示响应请求
					data: {
						userID: "1111", //用户ID
						sessionID: "1000", //用户标识,从cookie取
						start: delta.startOffset, //文本变化的开始位置
						end: delta.endOffset, //文本变化的截止位置
						type: delta.operateType, //文本操作类型add(增加),modify（原文修改）,delete（删除）
						content: delta.contents, //操作后的新文本
						domID: "node-12", //当前操作的dom的ID标识
						domDeep: 3, //当前操作的dom的层级位置,相对于文档根节点
						domLevel: 1, //当前操作的dom的nodeType级别
						timeStamp: +new Date() // 发送消息时的时间戳,毫秒精度。文档编辑会发送大量请求,对过期的消息不做响应
					}
				};
				console.log("sendMsg", JSON.stringify(msg));
				websocket.send(JSON.stringify(msg));
			}
		};
		editor.customConfig.onfocus = function () {
			var rangs = editor.selection.getRange();
			console.log("onfocus");
			var txt = getCleanHtml();
			ot.setCurrentValue(txt);
		};
		editor.customConfig.onblur = function (html) {
			// html 即编辑器中的内容
			//console.log('onblur', html)
		};
		editor.create();

		ot.changed = true;
		var text = '<p>欢迎使用<b>editor</b>富<label class="user-bg-color" style="background-color:#ff4b0c">文本编</label>辑<label class="user-cursor-123" style="font-size:10px;color:blue;display: inline-block;position: relative;"><span>|</span>' + '<span style="position: absolute;top:-10px;color:#999;background-color:#f5f5f5;left: -10px;">agtros</span></label>器啊</p>' + '<p><img src="https://ss0.bdstatic.com/5aV1bjqh_Q23odCf/static/superman/img/logo_top_ca79a146.png" style="max-width:100%;"></p><p><br></p>';
		editor.txt.html(text);
		ot.changed = false;

		var log = function log(msg) {
			$(".console").html(msg);
		};

		/*
   ** TODO-list
   ** 1:将获取的编辑器文本html清理掉人为添加鼠标位置信息,选择文本的背景色
   ** 2:用户编辑时获取光标附近的DOM节点信息,dom-id,dom深度,node-type
   ** 3:将整理好的数据websocket推送给服务器
   ** 4:响应从server传来的数据,整理好文本,光标位置,背景色后在编辑器中展示出来
   ** 5:插入图片时需要包裹一层p标签，不然取dom结构和位置报错，无法插入新的段落
   */

		/*获取编辑器当前文本信息*/
		// editor.$textElem; 是编辑器的DomElement 不能直接修改,editor.txt.html()是取的编辑器html文本,字符串格式,可以修改
		editor.customConfig.debug = true; //开启editor调试模式

		var userList = [{
			userID: '1111',
			userNmae: 'miller',
			color: '#ff4b0c',
			cursorStart: 5,
			domID: "",
			domLevel: 3,
			domDeep: 2
		}, {
			userID: '1000',
			userNmae: 'agtros',
			color: '#999999',
			cursorStart: 42,
			domID: "",
			domLevel: 1,
			domDeep: 1
		}];
		var unCloseTag = 'img input br hr'.split(/\s+/); //不需要尾部闭合标签的元素
		//生成随机数
		function getRandom() {
			return (Math.random() + new Date().getTime().toString()).substr(2);
		}

		//获取编辑器内容
		function getEditorCtx() {
			return editor.txt.html();
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

		//TODO-获取当前用户的光标位置（避免人为添加信息干扰,不取字符串位置,取node节点位置信息）
		function getCurCursor() {
			return {
				curNode: "",
				domDeep: 1,
				domLevel: 1,
				rangeStart: 1,
				rangeEnd: 1
			};
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

		//清理html文本中人为添加的鼠标,背景色信息
		function cleanHtmlElem(html) {
			if (!html || typeof html !== "string") {
				return;
			} else {
				var dom = setStrToDOMElement(html);
				return cleanCustromTag(dom);
			}
		}

		function getCleanHtml() {
			var ctx = getEditorCtx();
			var htmlElem = cleanHtmlElem(ctx);
			var htmlstr = setDOMElementToStr(htmlElem);
			return htmlstr;
		}
		// 替换 html 特殊字符
		function replaceHtmlSymbol(html) {
			if (html == null) {
				return '';
			}
			return html.replace(/</gm, '&lt;').replace(/>/gm, '&gt;').replace(/"/gm, '&quot;').replace(/(\r\n|\r|\n)/g, '<br/>');
		}

		function setEditorContent(html) {
			ot.changed = true;
			editor.txt.html(html);
			ot.changed = false;
		}
		//TOFix 合并因插入自定义标签导致原有连贯文本被打断
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

		function getRootNode(node) {}

		//获取传入的node相对文档根节点的层级,文档容器w-e-text，id="text-elemxxxxxxx"的层级为0
		function getNodeDeepSize(node) {
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

		function getRootRanderTree() {
			var ctx = getEditorCtx();
			var htmlElem = cleanHtmlElem(ctx);
			var json = getChildrenJSON(htmlElem);
			return json;
		}

		/**
   **获取当前根节点下字符的长度 对于空白标签range的startOffset=0，
   **若鼠标点击在图片后 startoffset=endOffset=1，
   ** 即图片只当成来长为1的元素，需要手动处理img的src和标签
   **/

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

					if (unCloseTag.indexOf(tag) > -1) {
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

		//判断当前节点是否包含子节点
		function isContainElem(rootSelectionElem, rootElem) {
			var result = false;
			if (rootElem.innerHTML === rootSelectionElem.innerHTML) {
				result = true;
			} else if (rootElem.childElementCount > 0) {
				for (var i = 0, len = rootElem[i].childElementCount; i < len; i++) {
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

		//获取鼠标所在节点
		//TOFix--获取根节点p错误
		function getCurrentRootElem(rootSelectionElem) {
			var rootElems = setStrToDOMElement(getEditorCtx());
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
		function setUserCursorOffset() {}
		//TODO-记录用户的鼠标位置，在设置editorcontent后，将用户鼠标放到远有位置
		function getUserCursorOffset() {
			var treeNode = getRootRanderTree();
			var rangeRootContainer = editor.selection.getSelectionContainerElem(); //这里container取的是$textElement,不能直接修改
			var range = editor.selection.getRange();

			var rootElemsBeforeCursor = getCurrentRootElem(rangeRootContainer);
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
			console.log(range);

			if (range.startContainer === range.endContainer) {
				//同一元素dom
				if (range.startOffset === range.endOffset) {
					//只单点了光标
					var _currentContainer = range.startContainer;
					var limitOption = {
						nodeName: _currentContainer.nodeName,
						nodeType: _currentContainer.nodeType,
						nodeValue: _currentContainer.nodeValue,
						domDeep: getNodeDeepSize(_currentContainer),
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
						domDeep: getNodeDeepSize(_currentContainer2),
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
					domDeep: getNodeDeepSize(endContainer),
					collapsed: range.collapsed,
					splitIndex: range.startOffset
				};
				getSplitText(rootElemsBeforeCursor, startLimitOption);
				startOffset = splitText.length;
				splitText = '';
				getSplitText(rootElemsBeforeCursor, endLimitOption);
				endOffset = splitText.length;
			}

			console.log(splitText);
			console.log("cursorOffset length", splitText.length);
			log("用户鼠标位置索引:" + splitText.length);
			return {
				startOffset: startOffset,
				endOffset: endOffset,
				domDeep: domDeep,
				domLevel: domLevel
			};
		}
		//TODO-根据websocket返回的消息，创建新的html并填充到编辑器中
		function setEditorContentByServerMsg(data) {
			if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) !== "object") {
				alert("收到的服务器消息体格式错误");
				return;
			}
			var html = getCleanHtml();
			if (data.type == "del") {
				html = html.substr(0, data.end) + data.content + html.substr(data.start);
			} else {
				html = html.substr(0, data.start) + data.content + html.substr(data.end);
			}
			//TODO-同步内容时也要更新用户鼠标.  
			//saveUserCursorPosition()
			//setEditorContent(html);
			//setUserCursorPosition()
		}

		document.getElementById('btn1').addEventListener('click', function () {
			var start = +new Date();
			var ctx = getEditorCtx();
			var htmlElem = cleanHtmlElem(ctx);
			console.log(htmlElem);
			var json = getChildrenJSON(htmlElem);
			var jsonStr = JSON.stringify(json);
			console.log(json);
			console.log(jsonStr);
		});

		document.getElementById('btn2').addEventListener('click', function () {
			var start = +new Date();
			var txt = getCleanHtml();
			editor.txt.html(txt);

			console.log("清理用时:", +new Date() - start);
			console.log("html文本字符长度:", txt.length);
		});

		document.getElementById('btn3').addEventListener('click', function () {
			console.log("获取当前用户鼠标选区");
			getUserCursorOffset();
		});

		document.getElementById('btn4').addEventListener('click', function () {
			console.log("设置新的用户鼠标选区");
		});
	});
});