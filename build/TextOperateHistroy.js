(function (global, factory) {
	if (typeof define === "function" && define.amd) {
		define(['module'], factory);
	} else if (typeof exports !== "undefined") {
		factory(module);
	} else {
		var mod = {
			exports: {}
		};
		factory(mod);
		global.TextOperateHistroy = mod.exports;
	}
})(this, function (module) {
	//histroy 记录文本操作历史
	'use strict';

	//最大历史记录条数，超过后要pop出旧数据，避免数组体积过大

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

	var MAX_LIST_NUM = 100;

	module.exports = function () {
		function TextOperateHistroy(cm) {
			_classCallCheck(this, TextOperateHistroy);

			this.currentValue = cm.getCleanHtml();
			this.currentIndex = 0;
			this.changed = false; //状态机，为true时不做文本变化的判断操作直接返回null
			this.changeLists = [];

			/*changes参数 [
   {start: start, //开始位置
   end: start, //结束位置
   text: text, //当前操作变化的文本
   origin: origin //操作源-编辑器，鼠标，键盘，区分操作事件
   type：'retain' //retain(10),delete(1),insert("阿凡达") 操作类型：保留多少位，删除多少，插入来什么字符，每次转换都是基于最新文本来说的。
   }]*/
			this.range = { //鼠标选取存在跨越节点的情况
				startOffset: 0, //选区开始位置
				endOffset: 0, //选区结束位置
				startContainer: { //开始的选区
					domName: '', //节点名称
					domType: '', //节点类型，1：dom，3：#text
					domDeep: '' //节点层级
				},
				endContainer: { //结束的选区
					domName: '',
					domType: '',
					domDeep: ''
				}
			};
			this.versions = 0; //本地操作序号，自增,与服务端versions比对，合并多余操作;
		}

		_createClass(TextOperateHistroy, [{
			key: 'updateOperateHistroy',
			value: function updateOperateHistroy(operation) {
				if (operation) {
					this.changeLists.push(operation);
					++this.versions;
				} else {
					console.log('\u5F53\u524D\u64CD\u4F5C\uFF0C\u5B58\u50A8\u7684\u5386\u53F2\u8BB0\u5F55\u53C2\u6570\u4E0D\u5168');
				}
			}
		}, {
			key: 'updateCursorRange',
			value: function updateCursorRange(range) {
				if (range && Object.keys(range)) {
					this.range = range;
				}
			}
		}, {
			key: 'textChange',
			value: function textChange(oldValue, newValue) {
				var commonStart = 0;
				while (commonStart < newValue.length && newValue.charAt(commonStart) == oldValue.charAt(commonStart)) {
					commonStart++;
				}
				var commonEnd = 0;
				while (commonEnd < newValue.length - commonStart && commonEnd < oldValue.length - commonStart && newValue.charAt(newValue.length - commonEnd - 1) == oldValue.charAt(oldValue.length - commonEnd - 1)) {
					commonEnd++;
				}

				var removed = oldValue.substr(commonStart, oldValue.length - commonStart - commonEnd);
				var inserted = newValue.substr(commonStart, newValue.length - commonStart - commonEnd);
				if (!(removed.length || inserted)) {
					return null;
				}

				return this.setDelta(newValue, commonStart, commonEnd, removed, inserted, removed.length, newValue.length);
			}
		}, {
			key: 'setCurrentValue',
			value: function setCurrentValue(newvalue) {
				this.currentValue = newvalue;
			}
		}, {
			key: 'setDelta',
			value: function setDelta(str, start, end, removed, inserted, delen, total) {
				this.currentValue = str;
				return {
					start: start + delen,
					end: total - end,
					removed: removed,
					inserted: inserted,
					delen: delen
				};
			}
		}, {
			key: 'getDelta',
			value: function getDelta(html) {
				var _this = this;
				//可能的文本变化情况
				//1：只增加，2：只删除，3：添加的比删除的多（显示为添加操作），
				//4：添加的比删除的少（显示为删除操作）5：添加删除一样（修改，根据响应按键的情况，若时间太短，可能不会响应）
				///operateType: 'add' 增加 'delete' 删除，'modify' //修改
				if (this.changed) {
					return null;
				}
				return this.textChange(this.currentValue, html); //"{"start":27,"end":26,"removed":"啊","inserted":"","delen":1}"
			}
		}]);

		return TextOperateHistroy;
	}();
});