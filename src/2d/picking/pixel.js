define(function(require) {

    var Base = require('core/base');

    var PixelPicking = Base.derive(function() {

        return {
            layer : null,

            downSampleRatio : 1,

            offset : 1,

            _canvas : null,
            _context : null,
            _imageData : null,

            _lookupTable : [],

        }

    }, function(){
        this.init();
    }, {
        init : function() {
            if ( ! this.layer) {
                return;
            }
            var canvas = document.createElement("canvas");
            canvas.width = this.layer.canvas.width * this.downSampleRatio;
            canvas.height = this.layer.canvas.height * this.downSampleRatio;

            this.layer.on("resize", function(){
                canvas.width = this.layer.canvas.width * this.downSampleRatio;
                canvas.height = this.layer.canvas.height * this.downSampleRatio;
            }, this);

            this._canvas = canvas;
            this._context = canvas.getContext("2d");
        },
        setPrecision : function(ratio) {
            this._canvas.width = this.layer.canvas.width * ratio;
            this._canvas.height = this.layer.canvas.height * ratio;
            this.downSampleRatio = ratio;
        },
        update : function() {
            var ctx = this._context;
            ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
            ctx.save();
            ctx.scale(this.downSampleRatio, this.downSampleRatio);
            this._lookupTable.length = 0;
            this._renderNode(this.layer, ctx);
            ctx.restore();
            // Cache the image data
            // Get image data is slow
            // http://jsperf.com/getimagedata-multi-vs-once
            var imageData = ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
            this._imageData = imageData.data;
        },
        _renderNode : function(node, ctx) {
            ctx.save();
            node.updateTransform();
            var m = node.transform._array;
            ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
            node.clip && ctx.clip();

            if (node.draw && node.enablePicking === true) {
                var lut = this._lookupTable;
                var rgb = packID(lut.length + this.offset);
                var color = 'rgb(' + rgb.join(',') + ')';
                this._lookupTable.push(node);
                
                ctx.fillStyle = color;
                ctx.strokeStyle = color;
                node.draw(ctx, true);
            }
            var renderQueue = node.getSortedRenderQueue();
            for (var i = 0; i < renderQueue.length; i++) {
                var child = renderQueue[i];
                this._renderNode(child, ctx);
            }
            ctx.restore();
        },
        pick : function(x, y) {
            var ratio = this.downSampleRatio;
            var width = this._canvas.width;
            var height = this._canvas.height;
            x = Math.ceil(ratio * x);
            y = Math.ceil(ratio * y);

            // Box sampler, to avoid the problem of anti aliasing
            var ids = [
                        this._sample(x, y),
                        this._sample(x-1, y),
                        this._sample(x+1, y),
                        this._sample(x, y-1),
                        this._sample(x, y+1),
                    ];
            var count = {};
            var max = 0;
            var maxId;
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                if (!count[id]) {
                    count[id]  = 1;
                } else {
                    count[id] ++;
                }
                if (count[id] > max) {
                    max = count[id];
                    maxId = id;
                }
            }

            var id = maxId - this.offset;

            if (id && max >=2) {
                var el = this._lookupTable[id];
                return el;
            }
        },

        _sample : function(x, y) {
            x = Math.max(Math.min(x, this._canvas.width), 1);
            y = Math.max(Math.min(y, this._canvas.height), 1);
            var offset = ((y-1) * this._canvas.width + (x-1))*4;
            var data = this._imageData;
            var r = data[offset],
                g = data[offset+1],
                b = data[offset+2];

            return unpackID(r, g, b);
        }
    });


    function packID(id){
        var r = id >> 16;
        var g = (id - (r << 8)) >> 8;
        var b = id - (r << 16) - (g<<8);
        return [r, g, b];
    }

    function unpackID(r, g, b){
        return (r << 16) + (g<<8) + b;
    }

    return PixelPicking;
})