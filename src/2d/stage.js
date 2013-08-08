define(function(require) {

    var Base = require('core/base');
    var Layer = require('./layer');
    var QEvent = require('core/event');

    var Stage = Base.derive(function() {
        return {
            container : null,

            width : 100,
            height : 100,

            _layers : [],

            _layersSorted : [],

            _mouseOverEl : null
        }
    }, function() {
        
        if (!this.container) {
            this.container = document.createElement('div');
        }
        if (this.container.style.position !== 'absolute' &&
            this.container.style.position !== 'fixed') {
            this.container.style.position = 'relative';
        }

        if (this.width) {
            this.container.style.width = this.width + 'px';
        } else {
            this.width = this.container.clientWidth;
        }
        if (this.height) {
            this.container.style.height = this.height + 'px';
        } else {
            this.height = this.container.clientHeight;
        }

        this.container.addEventListener("click", this._eventProxy.bind(this, 'click'));
        this.container.addEventListener("dblclick", this._eventProxy.bind(this, 'dblclick'));
        this.container.addEventListener("mousemove", this._mouseMoveHandler.bind(this));
        this.container.addEventListener("mousedown", this._eventProxy.bind(this, 'mousedown'));
        this.container.addEventListener("mouseup", this._eventProxy.bind(this, 'mouseup'));
        this.container.addEventListener("mouseout", this._mouseOutHandler.bind(this));
    }, {

        createLayer : function(options) {
            options = options || {};
            options.width = this.width;
            options.height = this.height;

            var layer = new Layer(options);
            this.addLayer(layer);

            return layer;
        },

        addLayer : function(layer) {
            layer.resize(this.width, this.height);

            var canvas = layer.canvas;
            canvas.style.position = 'absolute';
            canvas.style.left = '0px';
            canvas.style.top = '0px';

            this.container.appendChild(layer.canvas);

            this._layers.push(layer);
            this._layersSorted = this._layers.slice().sort(function(a, b){
                if (a.z === b.z)
                    return a.__GUID__ > b.__GUID__ ? 1 : -1;
                return a.z > b.z ? 1 : -1 ;
            });
        },

        removeLayer : function(layer) {
            this._layers.splice(this._layers.indexOf(layer), 1);

            this.container.removeChild(layer.canvas);
        },

        resize : function(width, height) {
            this.width = width;
            this.height = height;

            for (var i = 0; i < this._layers.length; i++) {
                this._layers[i].resize(width, height);
            }

            this.trigger("resize", width, height);
        },

        render : function() {
            for (var i = 0; i < this._layers.length; i++) {
                this._layers[i].render();
            }
        },

        _eventProxy : function(type, e) {
            var el = this._findTrigger(e);
            if (el) {
                QEvent.throw(type, el, this._assembleE(e));
            }
        },

        _mouseMoveHandler : function(e) {
            var el = this._findTrigger(e);
            if (el) {
                QEvent.throw('mousemove', el, this._assembleE(e));
            }

            if (this._mouseOverEl !== el) {
                if (this._mouseOverEl) {
                    QEvent.throw('mouseout', this._mouseOverEl, this._assembleE(e));
                }
                if (el) {
                    QEvent.throw('mouseover', el, this._assembleE(e));
                }
                this._mouseOverEl = el;
            }
        },

        _mouseOutHandler : function(e) {
            if (this._mouseOverEl) {
                QEvent.throw('mouseout', this._mouseOverEl, this._assembleE(e));
            }
        },

        _findTrigger : function(e) {
            var container = this.container;
            var clientRect = container.getBoundingClientRect();
            var x = e.pageX - clientRect.left - document.body.scrollLeft,
                y = e.pageY - clientRect.top - document.body.scrollTop;

            for (var i = this._layersSorted.length - 1; i >= 0 ; i--) {
                var layer = this._layersSorted[i];
                var el = layer.picking.pick(x, y);
                if (el) {
                    return el;
                }
            }
        },

        _assembleE : function(e){
            return {
                pageX : e.pageX,
                pageY : e.pageY
            }
        }

    });

    return Stage;
})