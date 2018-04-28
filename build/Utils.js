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
    global.Utils = mod.exports;
  }
})(this, function (module) {
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

  module.exports = function () {
    function Utils() {
      _classCallCheck(this, Utils);
    }

    _createClass(Utils, null, [{
      key: 'assert',
      value: function assert(b, msg) {
        if (!b) {
          throw new Error(msg || 'assertion error');
        }
      }
    }, {
      key: 'shallowClone',
      value: function shallowClone(source, target) {
        for (var key in source) {
          if (source.hasOwnProperty(key)) {
            target[key] = source[key];
          }
        }
      }
    }, {
      key: 'shallowEqual',
      value: function shallowEqual(objA, objB) {
        var aAttrs = Object.getOwnPropertyNames(objA);
        var bAttrs = Object.getOwnPropertyNames(objB);

        if (aAttrs.length !== bAttrs.length) {
          return false;
        }

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = aAttrs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var attr = _step.value;

            if (objA[attr] !== objB[attr]) {
              return false;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        return true;
      }
    }, {
      key: 'cmpPos',
      value: function cmpPos(a, b) {
        return a.line - b.line || a.ch - b.ch;
      }
    }, {
      key: 'posEq',
      value: function posEq(a, b) {
        return Utils.cmpPos(a, b) === 0;
      }
    }, {
      key: 'posLe',
      value: function posLe(a, b) {
        return Utils.cmpPos(a, b) <= 0;
      }
    }, {
      key: 'makeEventEmitter',
      value: function makeEventEmitter(clazz, allowedEVents, context) {
        var self = context;

        clazz.prototype._allowedEvents = allowedEVents;
        // validate event
        clazz.prototype._validateEventType = function (eventType) {
          var allowed = false;
          if (self._allowedEvents && self._allowedEvents.length) {
            allowed = self._allowedEvents.find(function (evt) {
              return evt === eventType;
            });
          }
          if (!allowed) {
            throw new Error('Unknown event "' + eventType + '"');
          }
        };
        // add event
        clazz.prototype.on = function (eventType, callback, context) {
          self._validateEventType(eventType);

          self._eventListeners = self._eventListeners || {};
          self._eventListeners[eventType] = self._eventListeners[eventType] || [];
          self._eventListeners[eventType].push({
            callback: callback,
            context: context
          });
        };
        // remove event
        clazz.prototype.off = function (eventType, callback) {
          self._validateEventType(eventType);
          if (!self._eventListeners) {
            return;
          }

          self._eventListeners = self._eventListeners || {};
          var listeners = self._eventListeners[eventType] || [];
          for (var i = 0; i < listeners.length; i++) {
            if (listeners[i].callback === callback) {
              listeners.splice(i, 1);
              return;
            }
          }
        };
        // trigger event
        clazz.prototype.trigger = function (eventType) {
          for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            data[_key - 1] = arguments[_key];
          }

          self._validateEventType(eventType);
          if (!self._eventListeners) {
            return;
          }

          var listeners = self._eventListeners[eventType] || [];
          for (var i = 0; i < listeners.length; i++) {
            var cb = listeners[i].callback;
            cb && cb.apply(listeners[i].context, data);
          }
        };
      }
    }, {
      key: 'addStyleWithCSS',
      value: function addStyleWithCSS(css) {
        if (!css && !css.length) {
          return;
        }
        var style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));

        var head = document.documentElement.getElementsByTagName('head')[0];
        head.appendChild(style);
      }
    }, {
      key: 'emptyAttributes',
      value: function emptyAttributes(attrs) {
        for (var attr in attrs) {
          return false;
        }
        return true;
      }
    }, {
      key: 'elt',
      value: function elt(tag, content, attrs) {
        var ele = document.createElement(tag);
        if (typeof content === 'string') {
          ele.innerHTML = '';
          ele.appendChild(document.createTextNode(content));
        } else if (content && content instanceof Array) {
          for (var i = 0; i < content.length; i++) {
            ele.appendChild(content[i]);
          }
        }

        for (var attr in attrs || {}) {
          ele.setAttribute(attr, attrs[attr]);
        }
        return ele;
      }
    }, {
      key: 'on',
      value: function on(emitter, type, f, capture) {
        if (emitter.addEventListener) {
          emitter.addEventListener(type, f, capture || false);
        } else if (emitter.attachEvent) {
          emitter.attachEvent('on' + type, f);
        }
      }
    }, {
      key: 'off',
      value: function off(emitter, type, f, capture) {
        if (emitter.removeEventListener) {
          emitter.removeEventListener(type, f, capture || false);
        } else if (emitter.detachEvent) {
          emitter.detachEvent('on' + type, f);
        }
      }
    }, {
      key: 'preventDefault',
      value: function preventDefault(e) {
        if (e.preventDefault) {
          e.preventDefault();
        } else {
          e.returnValue = false;
        }
      }
    }, {
      key: 'stopPropagation',
      value: function stopPropagation(e) {
        if (e.stopPropagation) {
          e.stopPropagation();
        } else {
          e.cancelBubble = true;
        }
      }
    }, {
      key: 'stopEvent',
      value: function stopEvent(e) {
        Utils.preventDefault(e);
        Utils.stopPropagation(e);
      }
    }, {
      key: 'stopEventAnd',
      value: function stopEventAnd(fn) {
        return function (e) {
          fn(e);
          Utils.stopEvent(e);
          return false;
        };
      }
    }, {
      key: 'hueFromName',
      value: function hueFromName(name) {
        var a = 1;
        for (var i = 0; i < name.length; i++) {
          a = 17 * (a + name.charCodeAt(i)) % 360;
        }
        return a / 360;
      }
    }, {
      key: 'hsl2hex',
      value: function hsl2hex(h, s, l) {
        var rgb2hex = function rgb2hex(r, g, b) {
          function digits(n) {
            var m = Math.round(255 * n).toString(16);
            return m.length === 1 ? '0' + m : m;
          }
          return '#' + digits(r) + digits(g) + digits(b);
        };

        if (s === 0) {
          return rgb2hex(l, l, l);
        }
        var var2 = l < 0.5 ? l * (1 + s) : l + s - s * l;
        var var1 = 2 * l - var2;

        var hue2rgb = function hue2rgb(hue) {
          if (hue < 0) {
            hue += 1;
          }
          if (hue > 1) {
            hue -= 1;
          }
          if (6 * hue < 1) {
            return var1 + (var2 - var1) * 6 * hue;
          }
          if (2 * hue < 1) {
            return var2;
          }
          if (3 * hue < 2) {
            return var1 + (var2 - var1) * 6 * (2 / 3 - hue);
          }
          return var1;
        };

        return rgb2hex(hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3));
      }
    }]);

    return Utils;
  }();
});