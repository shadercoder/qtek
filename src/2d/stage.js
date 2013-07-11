define(function(require) {

    var Base = require('core/base');
    var Layer = require('./layer');

    var Stage = Base.derive(function() {
        return {
            container : null,

            width : 100,
            height : 100,

            _layers : []
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
        },

        render : function() {
            for (var i = 0; i < this._layers.length; i++) {
                this._layers[i].render();
            }
        }
    })

    return Stage;
})