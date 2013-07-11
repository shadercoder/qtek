define(function(require) {

    var Node = require('../node');
    var Vector2 = require("core/vector2");
    var _ = require("_");

    var _imageCache = {};
    
    var QTImage = Node.derive(function() {
        return {
            img     : null,
            start   : new Vector2(),
            size    : null,
            onload  : function() {}
        }
    }, {
        computeBoundingBox : function() {
            if (this.size){
                this.boundingBox = {
                    min : this.start.clone(),
                    max : this.start.clone().add(this.size)
                }   
            }
        },
        draw : function(ctx) {
            if (this.img) {
                this.size ? 
                    ctx.drawImage(this.img, this.start.x, this.start.y, this.size.x, this.size.y) :
                    ctx.drawImage(this.img, this.start.x, this.start.y);
            }
        },
        intersect : function(x, y) {
            return this.intersectBoundingBox(x, y);
        }
    });

    QTImage.load = function(src, callback){
        if (_imageCache[src]) {
            var img = _imageCache[src];
            if (img.constructor == Array) {
                img.push(callback);
            } else {
                callback(img);
            }
        } else {
            _imageCache[src] = [callback];
            var img = new Image();
            img.onload = function() {
                _.each( _imageCache[src], function(cb) {
                    cb( img );
                });
                _imageCache[src] = img;

                img.onload = null;
            }
            img.src = src;
        }
    }
    
    return QTImage;
});