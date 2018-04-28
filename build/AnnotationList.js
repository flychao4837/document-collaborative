(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', './Utils.js'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('./Utils.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.Utils);
    global.AnnotationList = mod.exports;
  }
})(this, function (module, Utils) {
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

  var Span = function () {
    function Span(pos, length) {
      _classCallCheck(this, Span);

      this.pos = pos;
      this.length = length;
    }

    _createClass(Span, [{
      key: 'end',
      value: function end() {
        return this.pos + this.length;
      }
    }]);

    return Span;
  }();

  var OldAnnotatedSpan = function () {
    function OldAnnotatedSpan(pos, node) {
      _classCallCheck(this, OldAnnotatedSpan);

      this.pos = pos;
      this.length = node.length;
      this.annotation = node.annotation;
      this.attachedObject_ = node.attachedObject;
    }

    _createClass(OldAnnotatedSpan, [{
      key: 'getAttachedObject',
      value: function getAttachedObject() {
        return this.attachedObject_;
      }
    }]);

    return OldAnnotatedSpan;
  }();

  var NewAnnotatedSpan = function () {
    function NewAnnotatedSpan(pos, node) {
      _classCallCheck(this, NewAnnotatedSpan);

      this.pos = pos;
      this.length = node.length;
      this.annotation = node.annotation;
      this.node_ = node;
    }

    _createClass(NewAnnotatedSpan, [{
      key: 'attachObject',
      value: function attachObject(object) {
        // TextMarker
        this.node_.attachedObject = object;
      }
    }]);

    return NewAnnotatedSpan;
  }();

  var Node = function () {
    function Node(length, annotation) {
      _classCallCheck(this, Node);

      this.length = length;
      this.annotation = annotation;
      this.attachedObject = null;
      this.next = null;
    }

    _createClass(Node, [{
      key: 'clone',
      value: function clone() {
        var node = new Node(this.spanLength, this.annotation);
        node.next = this.next;
        return node;
      }
    }]);

    return Node;
  }();

  var NullAnnotation = {
    equals: function equals() {
      return false;
    }

    // TODO: Rewrite this (probably using a splay tree) to be efficient.  Right now it's based on a linked list
    // so all operations are O(n), where n is the number of spans in the list.
  };
  var AnnotationList = function () {
    function AnnotationList(changeHandler) {
      _classCallCheck(this, AnnotationList);

      // There's always a head node; to avoid special cases.
      // 单链表
      this.head_ = new Node(0, NullAnnotation);
      this.changeHandler_ = changeHandler;
    }
    /*
    在节点中插入，start 节点为当前节点，生成新链表段需要将 start 节点从插入点分裂生成两个节点，
    新插入的文本作为新 Node 节点插入其中
    */


    _createClass(AnnotationList, [{
      key: 'insertAnnotatedSpan',
      value: function insertAnnotatedSpan(span, annotation) {
        this.wrapOperation_(new Span(span.pos, 0), function (oldPos, old) {
          Utils.assert(!old || old.next === null); // should be 0 or 1 nodes.
          var toInsert = new Node(span.length, annotation);
          if (!old) {
            return toInsert;
          } else {
            Utils.assert(span.pos > oldPos && span.pos < oldPos + old.length);
            var newNodes = new Node(0, NullAnnotation);
            // Insert part of old before insertion point.
            newNodes.next = new Node(span.pos - oldPos, old.annotation);
            // Insert new node.
            newNodes.next.next = toInsert;
            // Insert part of old after insertion point.
            toInsert.next = new Node(oldPos + old.length - span.pos, old.annotation);
            return newNodes.next;
          }
        });
      }
    }, {
      key: 'removeSpan',
      value: function removeSpan(_removeSpan) {
        if (_removeSpan.length === 0) {
          return;
        }

        this.wrapOperation_(_removeSpan, function (oldPos, old) {
          Utils.assert(old !== null);
          var newNodes = new Node(0, NullAnnotation);
          var current = newNodes;
          // Add new node for part before the removed span (if any).
          if (_removeSpan.pos > oldPos) {
            current.next = new Node(_removeSpan.pos - oldPos, old.annotation);
            current = current.next;
          }

          // Skip over removed nodes.
          while (_removeSpan.end() > oldPos + old.length) {
            oldPos += old.length;
            old = old.next;
          }

          // Add new node for part after the removed span (if any).
          var afterChars = oldPos + old.length - _removeSpan.end();
          if (afterChars > 0) {
            current.next = new Node(afterChars, old.annotation);
          }

          return newNodes.next;
        });
      }
    }, {
      key: 'updateSpan',
      value: function updateSpan(span, updateFn) {
        if (span.length === 0) {
          return;
        }

        this.wrapOperation_(span, function (oldPos, old) {
          Utils.assert(old !== null);
          var newNodes = new Node(0, NullAnnotation);
          var current = newNodes;
          var currentPos = oldPos;

          // Add node for any characters before the span we're updating.
          var beforeChars = span.pos - currentPos;
          Utils.assert(beforeChars < old.length);
          if (beforeChars > 0) {
            current.next = new Node(beforeChars, old.annotation);
            current = current.next;
            currentPos += current.length;
          }

          // Add updated nodes for entirely updated nodes.
          while (old !== null && span.end() >= oldPos + old.length) {
            var length = oldPos + old.length - currentPos;
            current.next = new Node(length, updateFn(old.annotation, length));
            current = current.next;
            oldPos += old.length;
            old = old.next;
            currentPos = oldPos;
          }

          // Add updated nodes for last node.
          var updateChars = span.end() - currentPos;
          if (updateChars > 0) {
            Utils.assert(updateChars < old.length);
            current.next = new Node(updateChars, updateFn(old.annotation, updateChars));
            current = current.next;
            currentPos += current.length;

            // Add non-updated remaining part of node.
            current.next = new Node(oldPos + old.length - currentPos, old.annotation);
          }

          return newNodes.next;
        });
      }
    }, {
      key: 'forEach',
      value: function forEach(callback) {
        var current = this.head_.next;
        while (current !== null) {
          callback(current.length, current.annotation, current.attachedObject);
          current = current.next;
        }
      }
    }, {
      key: 'getSpansForPos',
      value: function getSpansForPos(pos) {
        var arr = [];
        var res = this.getAffectedNodes_(new Span(pos, 0));
        if (res.start) {
          arr.push(new Span(res.startPos, res.start.length));
        } else {
          var pos = res.predPos;
          if (res.pred) {
            arr.push(new Span(pos, res.pred.length));
            pos += res.pred.length;
          }
          if (res.succ) {
            arr.push(new Span(pos, res.succ.length));
          }
        }
        return arr;
      }
    }, {
      key: 'getAnnotatedSpansForPos',
      value: function getAnnotatedSpansForPos(pos) {
        var currentPos = 0;
        var current = this.head_.next;
        var prev = null;
        while (current !== null && currentPos + current.length <= pos) {
          currentPos += current.length;
          prev = current;
          current = current.next;
        }
        if (current === null && currentPos !== pos) {
          throw new Error('pos exceeds the bounds of the AnnotationList');
        }

        var res = [];
        if (currentPos === pos && prev) {
          res.push(new OldAnnotatedSpan(currentPos - prev.length, prev));
        }
        if (current) {
          res.push(new OldAnnotatedSpan(currentPos, current));
        }
        return res;
      }
    }, {
      key: 'getAnnotatedSpansForSpan',
      value: function getAnnotatedSpansForSpan(span) {
        if (span.length === 0) {
          return [];
        }
        var oldSpans = [];
        var res = this.getAffectedNodes_(span);
        var currentPos = res.startPos;
        var current = res.start;
        while (current !== null && currentPos < span.end()) {
          var start = Math.max(currentPos, span.pos);
          var end = Math.min(currentPos + current.length, span.end());
          var oldSpan = new Span(start, end - start);
          oldSpan.annotation = current.annotation;
          oldSpans.push(oldSpan);

          currentPos += current.length;
          current = current.next;
        }
        return oldSpans;
      }
    }, {
      key: 'wrapOperation_',
      value: function wrapOperation_(span, operationFn) {
        if (span.pos < 0) {
          throw new Error('Span start cannot be negative.');
        }
        var oldNodes = [];
        var newNodes = [];

        var res = this.getAffectedNodes_(span);

        var tail;
        if (res.start !== null) {
          tail = res.end.next;
          // Temporarily truncate list so we can pass it to operationFn.  We'll splice it back in later.
          res.end.next = null;
        } else {
          // start and end are null, because span is empty and lies on the border of two nodes.
          tail = res.succ;
        }

        // Create a new segment to replace the affected nodes.
        var newSegment = operationFn(res.startPos, res.start);

        var includePredInOldNodes = false;
        var includeSuccInOldNodes = false;
        if (newSegment) {
          this.mergeNodesWithSameAnnotations_(newSegment);

          var newPos;
          if (res.pred && res.pred.annotation.equals(newSegment.annotation)) {
            // We can merge the pred node with newSegment's first node.
            includePredInOldNodes = true;
            newSegment.length += res.pred.length;

            // Splice newSegment in after beforePred.
            res.beforePred.next = newSegment;
            newPos = res.predPos;
          } else {
            // Splice newSegment in after beforeStart.
            res.beforeStart.next = newSegment;
            newPos = res.startPos;
          }

          // Generate newNodes, but not the last one (since we may be able to merge it with succ).
          while (newSegment.next) {
            newNodes.push(new NewAnnotatedSpan(newPos, newSegment));
            newPos += newSegment.length;
            newSegment = newSegment.next;
          }

          if (res.succ && res.succ.annotation.equals(newSegment.annotation)) {
            // We can merge newSegment's last node with the succ node.
            newSegment.length += res.succ.length;
            includeSuccInOldNodes = true;

            // Splice rest of list after succ after newSegment.
            newSegment.next = res.succ.next;
          } else {
            // Splice tail after newSegment.
            newSegment.next = tail;
          }

          // Add last newSegment node to newNodes.
          newNodes.push(new NewAnnotatedSpan(newPos, newSegment));
        } else {
          // newList is empty.  Try to merge pred and succ.
          if (res.pred && res.succ && res.pred.annotation.equals(res.succ.annotation)) {
            includePredInOldNodes = true;
            includeSuccInOldNodes = true;

            // Create succ + pred merged node and splice list together.
            newSegment = new Node(res.pred.length + res.succ.length, res.pred.annotation);
            res.beforePred.next = newSegment;
            newSegment.next = res.succ.next;

            newNodes.push(new NewAnnotatedSpan(res.startPos - res.pred.length, newSegment));
          } else {
            // Just splice list back together.
            res.beforeStart.next = tail;
          }
        }

        // Build list of oldNodes.
        if (includePredInOldNodes) {
          oldNodes.push(new OldAnnotatedSpan(res.predPos, res.pred));
        }

        var oldPos = res.startPos;
        var oldSegment = res.start;
        while (oldSegment !== null) {
          oldNodes.push(new OldAnnotatedSpan(oldPos, oldSegment));
          oldPos += oldSegment.length;
          oldSegment = oldSegment.next;
        }

        if (includeSuccInOldNodes) {
          oldNodes.push(new OldAnnotatedSpan(oldPos, res.succ));
        }

        this.changeHandler_(oldNodes, newNodes);
      }
    }, {
      key: 'getAffectedNodes_',
      value: function getAffectedNodes_(span) {
        var result = {};

        var prevprev = null;
        var prev = this.head_;
        var current = prev.next;
        var currentPos = 0;
        while (current !== null && span.pos >= currentPos + current.length) {
          currentPos += current.length;
          prevprev = prev;
          prev = current;
          current = current.next;
        }
        if (current === null && !(span.length === 0 && span.pos === currentPos)) {
          throw new Error('Span start exceeds the bounds of the AnnotationList.');
        }

        result.startPos = currentPos;
        // Special case if span is empty and on the border of two nodes
        if (span.length === 0 && span.pos === currentPos) {
          result.start = null;
        } else {
          result.start = current;
        }
        result.beforeStart = prev;

        if (currentPos === span.pos && currentPos > 0) {
          result.pred = prev;
          result.predPos = currentPos - prev.length;
          result.beforePred = prevprev;
        } else {
          result.pred = null;
        }

        while (current !== null && span.end() > currentPos) {
          currentPos += current.length;
          prev = current;
          current = current.next;
        }
        if (span.end() > currentPos) {
          throw new Error('Span end exceeds the bounds of the AnnotationList.');
        }

        // Special case if span is empty and on the border of two nodes.
        if (span.length === 0 && span.end() === currentPos) {
          result.end = null;
        } else {
          result.end = prev;
        }
        result.succ = currentPos === span.end() ? current : null;

        return result;
      }
    }, {
      key: 'mergeNodesWithSameAnnotations_',
      value: function mergeNodesWithSameAnnotations_(list) {
        if (!list) {
          return;
        }
        var prev = null;
        var curr = list;
        while (curr) {
          if (prev && prev.annotation.equals(curr.annotation)) {
            prev.length += curr.length;
            prev.next = curr.next;
          } else {
            prev = curr;
          }
          curr = curr.next;
        }
      }
    }, {
      key: 'count',
      value: function count() {
        var count = 0;
        var current = this.head_.next;
        var prev = null;
        while (current !== null) {
          if (prev) {
            Utils.assert(!prev.annotation.equals(current.annotation));
          }
          prev = current;
          current = current.next;
          count++;
        }
        return count;
      }
    }]);

    return AnnotationList;
  }();

  module.exports = {
    Span: Span, AnnotationList: AnnotationList
  };
});