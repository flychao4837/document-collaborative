(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', './Constants.js', './Utils.js'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('./Constants.js'), require('./Utils.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.Constants, global.Utils);
    global.EntityManager = mod.exports;
  }
})(this, function (module, _require, Utils) {
  'use strict';

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

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

  var AttributeConstants = _require.AttributeConstants;


  var SENTINEL = AttributeConstants.ENTITY_SENTINEL; // 'ent'
  var PREFIX = SENTINEL + '_';

  var Entity = function () {
    function Entity(type, info) {
      _classCallCheck(this, Entity);

      this.type = type;
      this.info = info;
    }
    // get attrs


    _createClass(Entity, [{
      key: 'toAttributes',
      value: function toAttributes() {
        var attrs = {};
        attrs[SENTINEL] = this.type;
        for (var attr in this.info) {
          attrs[PREFIX + attr] = this.info[attr];
        }
        return attrs;
      }
    }], [{
      key: 'fromAttributes',
      value: function fromAttributes(attributes) {
        var type = attributes[SENTINEL];
        var info = {};
        for (var attr in attributes) {
          if (attr.indexOf(PREFIX) === 0) {
            info[attr.substr(PREFIX.length)] = attributes[attr];
          }
        }
        return new Entity(type, info);
      }
    }]);

    return Entity;
  }();

  var EntityManager = function () {
    function EntityManager() {
      _classCallCheck(this, EntityManager);

      this.entities = {};

      // regist entities
      this.registImage();
    }

    _createClass(EntityManager, [{
      key: 'registImage',
      value: function registImage() {
        var attrs = ['src', 'alt', 'width', 'height', 'style', 'class'];
        this.register('img', {
          render: function render(info, entityHandler) {
            Utils.assert(info.src, "image entity should have 'src'!");
            var html = '<img ';
            for (var i = 0; i < attrs.length; i++) {
              var attr = attrs[i];
              if (attr in info) {
                html += ' ' + attr + '="' + info[attr] + '"';
              }
            }
            html += '>';
            return html;
          },
          fromElement: function fromElement(element) {
            var info = {};
            for (var i = 0; i < attrs.length; i++) {
              var attr = attrs[i];
              if (element.hasAttribute(attr)) {
                info[attr] = element.getAttribute(attr);
              }
            }
            return info;
          }
        });
      }
    }, {
      key: 'register',
      value: function register(type, options) {
        Utils.assert(options.render, "Entity options should include a 'render' function!");
        Utils.assert(options.fromElement, "Entity options should include a 'fromElement' function!");
        this.entities[type] = options;
      }
    }, {
      key: 'renderToElement',
      value: function renderToElement(entity, entityHandle) {
        return this.tryRenderToElement_(entity, 'render', entityHandle);
      }
    }, {
      key: 'exportToElement',
      value: function exportToElement(entity) {
        // Turns out 'export' is a reserved keyword, so 'getHtml' is preferable.
        var elt = this.tryRenderToElement_(entity, 'export') || this.tryRenderToElement_(entity, 'getHtml') || this.tryRenderToElement_(entity, 'render');
        elt.setAttribute('data-entity', entity.type);
        return elt;
      }
    }, {
      key: 'updateElement',
      value: function updateElement(entity, element) {
        var type = entity.type;
        var info = entity.info;
        if (this.entities[type] && typeof this.entities[type].update !== 'undefined') {
          this.entities[type].update(info, element);
        }
      }
    }, {
      key: 'fromElement',
      value: function fromElement(element) {
        var type = element.getAttribute('data-entity');

        // HACK.  This should be configurable through entity registration.
        if (!type) {
          type = element.nodeName.toLowerCase();
        }

        if (type && this.entities[type]) {
          var info = this.entities[type].fromElement(element);
          return new Entity(type, info);
        }
      }
    }, {
      key: 'tryRenderToElement_',
      value: function tryRenderToElement_(entity, renderFn, entityHandle) {
        var type = entity.type;
        var info = entity.info;
        if (this.entities[type] && this.entities[type][renderFn]) {
          var res = this.entities[type][renderFn](info, entityHandle, document);
          if (res) {
            if (typeof res === 'string') {
              var div = document.createElement('div');
              div.innerHTML = res;
              return div.childNodes[0];
            } else if ((typeof res === 'undefined' ? 'undefined' : _typeof(res)) === 'object') {
              Utils.assert(typeof res.nodeType !== 'undefined', 'Error rendering ' + type + ' entity.  render() function' + ' must return an html string or a DOM element.');
              return res;
            }
          }
        }
      }
    }, {
      key: 'entitySupportsUpdate',
      value: function entitySupportsUpdate(entityType) {
        return this.entities[entityType] && this.entities[entityType]['update'];
      }
    }]);

    return EntityManager;
  }();

  module.exports = {
    Entity: Entity, EntityManager: EntityManager
  };
});