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
    global.Constants = mod.exports;
  }
})(this, function (module) {
  'use strict';

  var AttributeConstants = {
    BOLD: 'b',
    ITALIC: 'i',
    UNDERLINE: 'u',
    STRIKE: 's',
    FONT: 'f',
    FONT_SIZE: 'fs',
    COLOR: 'c',
    BACKGROUND_COLOR: 'bc',
    ENTITY_SENTINEL: 'ent',

    // Line Attributes
    LINE_SENTINEL: 'l',
    LINE_INDENT: 'li',
    LINE_ALIGN: 'la',
    // list: ordered list, unordered list, todo list
    // ordered list: lt-o
    // unordered list: lt-u
    // todo list: lt-t(unchecked), lt-tc(checked)
    LIST_TYPE: 'lt'
  };

  var SentinelConstants = {
    // A special character we insert at the beginning of lines so we can attach attributes to it to represent
    // "line attributes."  E000 is from the unicode "private use" range.
    LINE_SENTINEL_CHARACTER: '\uE000',

    // A special character used to represent any "entity" inserted into the document (e.g. an image).
    ENTITY_SENTINEL_CHARACTER: '\uE001'
  };

  module.exports = { AttributeConstants: AttributeConstants, SentinelConstants: SentinelConstants };
});