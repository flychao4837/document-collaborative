'use strict'
const Utils = require('./Utils.js')

module.exports =
    class TextAction {
        // Operation are essentially lists of ops. There are three types of ops:
        //
        // * Retain ops: Advance the cursor position by a given number of characters.
        //   Represented by positive ints.
        // * Insert ops: Insert a given string at the current cursor position.
        //   Represented by strings.
        // * Delete ops: Delete the next n characters. Represented by positive ints.
        constructor(type) {
            this.type = type
            this.chars = null // characters count
            this.text = null

            if (type === 'insert') {
                this.text = arguments[1]
                Utils.assert(typeof this.text === 'string')
            } else if (type === 'delete') {
                this.chars = arguments[1]
                Utils.assert(typeof this.chars === 'number')
            } else if (type === 'retain') {
                this.chars = arguments[1]
                Utils.assert(typeof this.chars === 'number')
            }
        }
        isInsert() {
            return this.type === 'insert'
        }
        isDelete() {
            return this.type === 'delete'
        }
        isRetain() {
            return this.type === 'retain'
        }

        equals(otherAction) {
            return (this.type === otherAction.type ||
                this.chars === otherAction.chars ||
                this.text === otherAction.text)
        }
    }