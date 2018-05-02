//histroy 记录文本操作历史
'use strict'

//最大历史记录条数，超过后要pop出旧数据，避免数组体积过大
const MAX_LIST_NUM = 100;

module.exports = class TextOperateHistroy {
    constructor(cm) {
        this.currentValue = cm.getCleanHtml() || '';
        this.currentIndex = 0;
        this.changed = false; //状态机，为true时不做文本变化的判断操作直接返回null
        this.changeLists = [];
        this.charCurrentLength = this.currentValue.length || 0; //操作后实际文本长度
        this.charOriginLength = this.currentValue.length || 0; //操作前实际文本长度 charCurrentLength = charOriginLength + 变化的文本长度
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
    updateOperateHistroy(operation) {
        if (operation) {
            this.changeLists.push(operation);
            ++this.versions;
        } else {
            console.log(`当前操作，存储的历史记录参数不全`);
        }
    }
    updateCursorRange(range) {
        if (range && Object.keys(range)) {
            this.range = range;
        }
    }
    textChange(oldValue, newValue) {
        //TODO -- 正常情况是逐个删除或插入，但是存在鼠标滑动选择或者快捷键选取文字后直接输入文字替换
        //这种情况下，应该先计算删除操作，在计算插入操作，拆分成多个步骤
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
        if (!(removed.length || inserted)) {
            return null;
        }

        this.setCurrentValue(newValue);
        return this.setDelta(newValue, commonStart, commonEnd, removed, inserted, removed.length, newValue.length);
    }
    setCurrentValue(newValue) {
        this.currentValue = newValue;
        this.charOriginLength = this.charCurrentLength;
        this.charCurrentLength = newValue.length;
    }
    setDelta(str, start, end, removed, inserted, delen, total) {
        this.currentValue = str;
        return {
            start: start,
            end: end,
            removed,
            inserted,
            delen,
            total,
            text: inserted
        }
    }

    //比对上一历史文本，找出变化的位置和字符
    getDelta(html) {
        var _this = this;
        //可能的文本变化情况
        //1：只增加，2：只删除，3：添加的比删除的多（显示为添加操作），
        //4：添加的比删除的少（显示为删除操作）5：添加删除一样（修改，根据响应按键的情况，若时间太短，可能不会响应）
        ///operateType: 'add' 增加 'delete' 删除，'modify' //修改
        if (this.changed) {
            return null;
        }
        return this.textChange(this.currentValue, html) //"{"start":27,"end":26,"removed":"啊","inserted":"","delen":1}"
    }
}