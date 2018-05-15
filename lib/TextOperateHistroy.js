//histroy 记录文本操作历史
'use strict'

//最大历史记录条数，超过后要pop出旧数据，避免数组体积过大
const MAX_LIST_NUM = 100;

module.exports = class TextOperateHistroy {
    constructor(cm) {
        this.currentValue = cm.getCleanHtml() || '';
        this.changed = false; //状态机，为true时不做文本变化的判断操作直接返回null
        this.changeLists = [];
        this.charCurrentLength = this.currentValue.length || 0; //操作后实际文本长度

        //当前用户鼠标位置，文本选区区域
        this.range = {
            start: 0, //选区开始位置
            end: 0, //选区结束位置
        };
        this.versions = 0; //本地操作序号，自增,与服务端versions比对，合并多余操作;
        this.clientId; //当前客户端标识，区分用户组用户
        this.getCursorHandel = 0;
    }
    updateOperateHistroy(operation) {
        if (operation) {
            this.changeLists.push(operation);
            ++this.versions;
        } else {
            console.log(`当前操作，存储的历史记录参数不全`);
        }
    }

    //查找文本变更位置
    textChange(oldValue, newValue) {
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
        return this.setDelta(newValue, commonStart, commonEnd, removed, inserted);
    }

    //设置本地历史文本
    setCurrentValue(newValue) {
        this.currentValue = newValue;
        this.charOriginLength = this.charCurrentLength;
        this.charCurrentLength = newValue.length;
        this.changed = false;
    }

    //返回文本变更信息
    setDelta(str, start, end, removed, inserted) {
        this.currentValue = str;
        return {
            start: start,
            end: end,
            removed,
            inserted,
            text: inserted
        }
    }

    /**
     **比对上一历史文本，找出变化的位置和字符
     **可能的文本变化情况
     **1：只增加，2：只删除，3：添加的比删除的多（显示为添加操作），
     **4：添加的比删除的少（显示为删除操作）5：添加删除一样（修改，根据响应按键的情况，若时间太短，可能不会响应）
     **operateType: 'add' 增加 'delete' 删除，'modify' //修改
    */

    getDelta(html) {
        var _this = this;
        if (this.changed) {
            return null;
        }
        //"{"start":27,"end":26,"removed":"啊","inserted":"","delen":1}"
        return this.textChange(this.currentValue, html) 
    }

    /*
     ** 生成虚拟Dom树，记录DOM结构的相对位置和实际位置，能通过key-chain直接找到对应节点，能找到节点的attribute和value
     ** 保留完整的DOM结构，对节点的操作都记录下来，实现软删除，保留所有信息
     ** 记录对Dom的每一步操作，实现undo，redo
    */

    createRanderTree(html){
        
    }
}