'use strict'
const Utils = require('./Utils.js')
const TextAction = require('./TextAction.js')

module.exports =
    class TextOperation {
        constructor(baseLength, targetLength, operation) {
            // When an operation is applied to an input string, you can think of this as
            // if an imaginary cursor runs over the entire string and skips over some
            // parts, deletes some parts and inserts characters at some positions. These
            // actions (skip/delete/insert) are stored as an array in the "ops" property.
            let arr = [];
            operation ? arr.push(operation) : arr;
            this.ops = arr;
            // An operation's baseLength is the length of every string the operation
            // can be applied to.
            this.baseLength = baseLength || 0;
            // The targetLength is the length of every string that results from applying
            // the operation on a valid input string.
            this.targetLength = targetLength || 0;
        }

        equals(other) {
            if (this.baseLength !== other.baseLength ||
                this.targetLength !== other.targetLength ||
                this.ops.length !== other.ops.length) {
                return false
            }
            for (let i = 0; i < this.ops.length; i++) {
                if (!this.ops[i].equals(other.ops[i])) {
                    return false
                }
            }
            return true
        }

        // After an operation is constructed, the user of the library can specify the
        // actions of an operation (skip/insert/delete) with these three builder
        // methods. They all return the operation for convenient chaining.

        // Skip over a given number of characters.
        retain(n) {
            //baseLength 是变化前的字符长度
            //targetLength 是变化后的字符长度
            if (typeof n !== 'number' || n < 0) {
                throw new Error('retain expects a positive integer.')
            }
            if (n === 0) {
                return this
            }
            this.baseLength += n
            this.targetLength += n
            var prevOp = (this.ops.length > 0) ? this.ops[this.ops.length - 1] : null
            if (prevOp && prevOp.isRetain()) {
                prevOp.chars += n
            } else {
                // Create a new TextAction.
                this.ops.push(new TextAction('retain', n))
            }
            return this
        }

        // Insert a string at the current position.
        insert(str) {
            if (typeof str !== 'string') {
                throw new Error('insert expects a string')
            }
            if (str === '') {
                return this
            }
            this.targetLength += str.length

            var prevOp = (this.ops.length > 0) ? this.ops[this.ops.length - 1] : null
            var prevPrevOp = (this.ops.length > 1) ? this.ops[this.ops.length - 2] : null

            if (prevOp && prevOp.isInsert()) {
                // Merge insert op.
                prevOp.text += str
            } else if (prevOp && prevOp.isDelete()) {
                // It doesn't matter when an operation is applied whether the operation
                // is delete(3), insert("something") or insert("something"), delete(3).
                // Here we enforce that in this case, the insert op always comes first.
                // This makes all operations that have the same effect when applied to
                // a document of the right length equal in respect to the `equals` method.
                //删除-插入操作，优先把插入放在前面，删除放在后面
                if (prevPrevOp && prevPrevOp.isInsert()) {
                    prevPrevOp.text += str
                } else {
                    this.ops[this.ops.length - 1] = new TextAction('insert', str)
                    this.ops.push(prevOp)
                }
            } else {
                this.ops.push(new TextAction('insert', str))
            }
            return this
        }

        // Delete a string at the current position.
        delete(n) {
            if (typeof n === 'string') {
                n = n.length
            }
            if (typeof n !== 'number' || n < 0) {
                throw new Error('delete expects a positive integer or a string')
            }
            if (n === 0) {
                return this
            }
            this.baseLength += n

            var prevOp = (this.ops.length > 0) ? this.ops[this.ops.length - 1] : null

            if (prevOp && prevOp.isDelete()) {
                prevOp.chars += n
            } else {
                this.ops.push(new TextAction('delete', n))
            }
            return this
        }

        // Tests whether this operation has no effect.
        isNoop() {
            return this.ops.length === 0 ||
                (this.ops.length === 1 && this.ops[0].isRetain() && this.ops[0].hasEmptyAttributes())
        }
            
        // clone a TextOperation
        clone() {
            var clone = new TextOperation()
                // replay the operation actions
            for (let i = 0; i < this.ops.length; i++) {
                if (this.ops[i].isRetain()) {
                    clone.retain(this.ops[i].chars, this.ops[i].attributes)
                } else if (this.ops[i].isInsert()) {
                    clone.insert(this.ops[i].text, this.ops[i].attributes)
                } else { // delete
                    clone.delete(this.ops[i].chars)
                }
            }
            return clone
        }

        // Converts operation into a JSON value.
        toJSON() {
            var ops = []
            for (let op of this.ops) {
                // We pre push ops' attributes if non-empty.
                if (!op.hasEmptyAttributes()) {
                    ops.push(op.attributes)
                }
                if (op.isRetain()) {
                    ops.push(op.chars) // retain ops using positive ints
                } else if (op.isInsert()) {
                    ops.push(op.text)
                } else if (op.isDelete()) {
                    ops.push(-op.chars) // delete ops using negative ints
                }
            }

            return ops
        }
            
        //选取一段文字设置样式后，TextOperation会将整个文本分成 样式前，样式设置，样式后三个部分
        //示例：插入文字5 [1,"5",3] //插入位置，插入的字符，NOTE--第三个参数不明（操作：当时第三者的鼠标在行首，另一人在行尾插入字符）
        static fromJSON(ops) {
            var textOperation = new TextOperation()
            for (let i = 0; i < ops.length; i++) {
                var op = ops[i]
                let attributes = {}
                if (typeof op === 'object') {
                    attributes = op
                        // both retain and insert operation can has attributes
                    i++
                    op = ops[i]
                }
                if (typeof op === 'number') {
                    if (op > 0) { // retain
                        textOperation.retain(op, attributes)
                    } else { // delete
                        textOperation.delete(-op)
                    }
                } else {
                    Utils.assert(typeof op === 'string')
                    textOperation.insert(op, attributes)
                }
            }

            return textOperation
        }

        //根据operation操作，生成一份完整的文档document缓存
        apply(str) {
            var operation = this

            if (str.length !== operation.baseLength) {
                throw new Error("The operation's base length must be equal to the string's length.")
            }
            var newStringParts = []
            var j = 0
            var k
            var attr
            var oldIndex = 0
            var ops = this.ops
            for (var i = 0, l = ops.length; i < l; i++) {
                var op = ops[i]
                if (op.isRetain()) {
                    if (oldIndex + op.chars > str.length) {
                        throw new Error("Operation can't retain more characters than are left in the string.")
                    }
                    // Copy skipped part of the retained string.
                    newStringParts[j++] = str.slice(oldIndex, oldIndex + op.chars)

                    oldIndex += op.chars
                } else if (op.isInsert()) {
                    // Insert string.
                    newStringParts[j++] = op.text

                } else { // delete op
                    oldIndex += op.chars
                }
            }
            if (oldIndex !== str.length) {
                throw new Error("The operation didn't operate on the whole string.")
            }
            var newString = newStringParts.join('')

            return newString
        }

        // Computes the inverse of an operation. The inverse of an operation is the
        // operation that reverts the effects of the operation, e.g. when you have an
        // operation 'insert("hello "); skip(6);' then the inverse is 'delete("hello ");
        // skip(6);'. The inverse should be used for implementing undo.
        invert(str) {
            var strIndex = 0
            var inverse = new TextOperation()
            var ops = this.ops
            for (var i = 0, l = ops.length; i < l; i++) {
                var op = ops[i]
                if (op.isRetain()) {
                    inverse.retain(op.chars)
                    strIndex += op.chars
                } else if (op.isInsert()) {
                    inverse['delete'](op.text.length)
                } else { // delete op
                    inverse.insert(str.slice(strIndex, strIndex + op.chars))
                    strIndex += op.chars
                }
            }
            return inverse
        }

        // apply(apply(S, A), B) = apply(S, compose(A, B)) must hold.

        //operation1是当前的操作步骤，operation2是下一步的操作的起始步骤(保留当前全部文本，再执行其他操作)，
        //对于其他人来说，需要在operation1的基础上，保留因operation1操作而多出的字符空位，模拟操作流程里就是在对应位置插入空格占位
        //这里比对操作，在端上生成最终的、符合实际操作过程的一个模拟操作过程 operation，
        //即从operation0(0,0,retain) --> operation1(0,1,insert) --> operation2(1,1,retain)的操作
        //各个用户端根据这个operation就能还原成统一的操作，不会存在版本误差和时间线错乱 operation(0,1,insert)，都统一成一次插入操作
        compose(operation2) {
            //TODO -- initClientContent时 operation2为初始化的空数据，但是在editor里是有初始化标签的('<p><br></br>')
            //导致operation1取的targetLength是操作文本区时的长度11,operation2取得是本地历史记录 0，从而报错
            var operation1 = this
            if (operation1.targetLength !== operation2.baseLength) {
                throw new Error('The base length of the second operation has to be the target length of the first operation')
            }

            var operation = new TextOperation() // the combined operation
            var ops1 = operation1.clone().ops
            var ops2 = operation2.clone().ops
                // current index into ops1 respectively ops2
            var i1 = 0
            var i2 = 0
            var op1 = ops1[i1++]
            var op2 = ops2[i2++] // current ops
            while (true) {
                // Dispatch on the type of op1 and op2
                if (typeof op1 === 'undefined' && typeof op2 === 'undefined') {
                    // end condition: both ops1 and ops2 have been processed
                    break
                }

                if (op1 && op1.isDelete()) {
                    operation.delete(op1.chars)
                    op1 = ops1[i1++]
                    continue
                }
                if (op2 && op2.isInsert()) {
                    operation.insert(op2.text)
                    op2 = ops2[i2++]
                    continue
                }

                if (typeof op1 === 'undefined') {
                    throw new Error('Cannot compose operations: first operation is too short.')
                }
                if (typeof op2 === 'undefined') {
                    throw new Error('Cannot compose operations: first operation is too long.')
                } 

                if (op1.isRetain() && op2.isRetain()) {
                    if (op1.chars > op2.chars) {
                        operation.retain(op2.chars)
                        op1.chars -= op2.chars
                        op2 = ops2[i2++]
                    } else if (op1.chars === op2.chars) {
                        operation.retain(op1.chars)
                        op1 = ops1[i1++]
                        op2 = ops2[i2++]
                    } else {
                        operation.retain(op1.chars)
                        op2.chars -= op1.chars
                        op1 = ops1[i1++]
                    }
                } else if (op1.isInsert() && op2.isDelete()) {
                    if (op1.text.length > op2.chars) {
                        op1.text = op1.text.slice(op2.chars)
                        op2 = ops2[i2++]
                    } else if (op1.text.length === op2.chars) {
                        op1 = ops1[i1++]
                        op2 = ops2[i2++]
                    } else {
                        op2.chars -= op1.text.length
                        op1 = ops1[i1++]
                    }
                } else if (op1.isInsert() && op2.isRetain()) {
                    if (op1.text.length > op2.chars) {
                        operation.insert(op1.text.slice(0, op2.chars))
                        op1.text = op1.text.slice(op2.chars)
                        op2 = ops2[i2++]
                    } else if (op1.text.length === op2.chars) {
                        operation.insert(op1.text)
                        op1 = ops1[i1++]
                        op2 = ops2[i2++]
                    } else {
                        operation.insert(op1.text)
                        op2.chars -= op1.text.length
                        op1 = ops1[i1++]
                    }
                } else if (op1.isRetain() && op2.isDelete()) {
                    if (op1.chars > op2.chars) {
                        operation['delete'](op2.chars)
                        op1.chars -= op2.chars
                        op2 = ops2[i2++]
                    } else if (op1.chars === op2.chars) {
                        operation['delete'](op2.chars)
                        op1 = ops1[i1++]
                        op2 = ops2[i2++]
                    } else {
                        operation['delete'](op1.chars)
                        op2.chars -= op1.chars
                        op1 = ops1[i1++]
                    }
                } else {
                    throw new Error(
                        "This shouldn't happen: op1: " + JSON.stringify(op1) + ', op2: ' + JSON.stringify(op2)
                    )
                }
            }
            //console.log("合并后的操作流程是：", operation);
            return operation;
        }

        // When you use ctrl-z to undo your latest changes, you expect the program not
        // to undo every single keystroke but to undo your last sentence you wrote at
        // a stretch or the deletion you did by holding the backspace key down. This
        // This can be implemented by composing operations on the undo stack. This
        // method can help decide whether two operations should be composed. It
        // returns true if the operations are consecutive insert operations or both
        // operations delete text at the same position. You may want to include other
        // factors like the time since the last change in your decision.
        shouldBeComposedWith(other) {
            if (this.isNoop() || other.isNoop()) {
                return true
            }

            var startA = getStartIndex(this)
            var startB = getStartIndex(other)
            var simpleA = getSimpleOp(this)
            var simpleB = getSimpleOp(other)
            if (!simpleA || !simpleB) {
                return false
            }

            if (simpleA.isInsert() && simpleB.isInsert()) {
                return startA + simpleA.text.length === startB
            }

            if (simpleA.isDelete() && simpleB.isDelete()) {
                // there are two possibilities to delete: with backspace and with the
                // delete key.
                return (startB + simpleB.chars === startA) || startA === startB
            }

            return false
        }

        // Decides whether two operations should be composed with each other
        // if they were inverted, that is
        // `shouldBeComposedWith(a, b) = shouldBeComposedWithInverted(b^{-1}, a^{-1})`.
        shouldBeComposedWithInverted(other) {
            if (this.isNoop() || other.isNoop()) {
                return true
            }

            var startA = getStartIndex(this)
            var startB = getStartIndex(other)
            var simpleA = getSimpleOp(this)
            var simpleB = getSimpleOp(other)
            if (!simpleA || !simpleB) {
                return false
            }

            if (simpleA.isInsert() && simpleB.isInsert()) {
                return startA + simpleA.text.length === startB || startA === startB
            }

            if (simpleA.isDelete() && simpleB.isDelete()) {
                return startB + simpleB.chars === startA
            }

            return false
        }

        static transformAttributes(attributes1, attributes2) {
            var attributes1prime = {}
            var attributes2prime = {}
            var attr
            var allAttrs = {}
            for (attr in attributes1) {
                allAttrs[attr] = true
            }
            for (attr in attributes2) {
                allAttrs[attr] = true
            }

            for (attr in allAttrs) {
                var attr1 = attributes1[attr]
                var attr2 = attributes2[attr]
                Utils.assert(attr1 != null || attr2 != null)
                if (attr1 == null) {
                    // Only modified by attributes2; keep it.
                    attributes2prime[attr] = attr2
                } else if (attr2 == null) {
                    // only modified by attributes1; keep it
                    attributes1prime[attr] = attr1
                } else if (attr1 === attr2) {
                    // Both set it to the same value.  Nothing to do.
                } else {
                    // attr1 and attr2 are different. Prefer attr1.
                    attributes1prime[attr] = attr1
                }
            }
            return [attributes1prime, attributes2prime]
        }

        static transform(operation1, operation2) {
                if (operation1.baseLength !== operation2.baseLength) {
                    throw new Error('Both operations have to have the same base length')
                }

                var operation1prime = new TextOperation()
                var operation2prime = new TextOperation()
                var ops1 = operation1.clone().ops
                var ops2 = operation2.clone().ops
                var i1 = 0
                var i2 = 0
                var op1 = ops1[i1++]
                var op2 = ops2[i2++]
                while (true) {
                    // At every iteration of the loop, the imaginary cursor that both
                    // operation1 and operation2 have that operates on the input string must
                    // have the same position in the input string.

                    if (typeof op1 === 'undefined' && typeof op2 === 'undefined') {
                        // end condition: both ops1 and ops2 have been processed
                        break
                    }

                    // next two cases: one or both ops are insert ops
                    // => insert the string in the corresponding prime operation, skip it in
                    // the other one. If both op1 and op2 are insert ops, prefer op1.
                    if (op1 && op1.isInsert()) {
                        operation1prime.insert(op1.text, op1.attributes)
                        operation2prime.retain(op1.text.length)
                        op1 = ops1[i1++]
                        continue
                    }
                    if (op2 && op2.isInsert()) {
                        operation1prime.retain(op2.text.length)
                        operation2prime.insert(op2.text, op2.attributes)
                        op2 = ops2[i2++]
                        continue
                    }

                    if (typeof op1 === 'undefined') {
                        throw new Error('Cannot transform operations: first operation is too short.')
                    }
                    if (typeof op2 === 'undefined') {
                        throw new Error('Cannot transform operations: first operation is too long.')
                    }

                    var minl
                    if (op1.isRetain() && op2.isRetain()) {
                        // Simple case: retain/retain
                        var attributesPrime = TextOperation.transformAttributes(op1.attributes, op2.attributes)
                        if (op1.chars > op2.chars) {
                            minl = op2.chars
                            op1.chars -= op2.chars
                            op2 = ops2[i2++]
                        } else if (op1.chars === op2.chars) {
                            minl = op2.chars
                            op1 = ops1[i1++]
                            op2 = ops2[i2++]
                        } else {
                            minl = op1.chars
                            op2.chars -= op1.chars
                            op1 = ops1[i1++]
                        }

                        operation1prime.retain(minl, attributesPrime[0])
                        operation2prime.retain(minl, attributesPrime[1])
                    } else if (op1.isDelete() && op2.isDelete()) {
                        // Both operations delete the same string at the same position. We don't
                        // need to produce any operations, we just skip over the delete ops and
                        // handle the case that one operation deletes more than the other.
                        if (op1.chars > op2.chars) {
                            op1.chars -= op2.chars
                            op2 = ops2[i2++]
                        } else if (op1.chars === op2.chars) {
                            op1 = ops1[i1++]
                            op2 = ops2[i2++]
                        } else {
                            op2.chars -= op1.chars
                            op1 = ops1[i1++]
                        }
                        // next two cases: delete/retain and retain/delete
                    } else if (op1.isDelete() && op2.isRetain()) {
                        if (op1.chars > op2.chars) {
                            minl = op2.chars
                            op1.chars -= op2.chars
                            op2 = ops2[i2++]
                        } else if (op1.chars === op2.chars) {
                            minl = op2.chars
                            op1 = ops1[i1++]
                            op2 = ops2[i2++]
                        } else {
                            minl = op1.chars
                            op2.chars -= op1.chars
                            op1 = ops1[i1++]
                        }
                        operation1prime.delete(minl)
                    } else if (op1.isRetain() && op2.isDelete()) {
                        if (op1.chars > op2.chars) {
                            minl = op2.chars
                            op1.chars -= op2.chars
                            op2 = ops2[i2++]
                        } else if (op1.chars === op2.chars) {
                            minl = op1.chars
                            op1 = ops1[i1++]
                            op2 = ops2[i2++]
                        } else {
                            minl = op1.chars
                            op2.chars -= op1.chars
                            op1 = ops1[i1++]
                        }
                        operation2prime.delete(minl)
                    } else {
                        throw new Error("The two operations aren't compatible")
                    }
                }

                return [operation1prime, operation2prime]
            }
            // convenience method to write transform(a, b) as a.transform(b)
        transform(other) {
            return TextOperation.transform(this, other)
        }

        // Pretty printing.
        toString() {
            // TODO...
        }
    }

// helper method
function getSimpleOp(operation) {
    var ops = operation.ops
    switch (ops.length) {
        case 1:
            return ops[0]
        case 2:
            return ops[0].isRetain() ? ops[1] : (ops[1].isRetain() ? ops[0] : null)
        case 3:
            if (ops[0].isRetain() && ops[2].isRetain()) {
                return ops[1]
            }
    }
    return null
}

function getStartIndex(operation) {
    if (operation.ops[0].isRetain()) {
        return operation.ops[0].chars
    }
    return 0
}