define(function(require) {

    var Node = require('../node');
    var util = require('../util');
    var Vector2 = require("core/vector2");
    var _ = require("_");

    var _imageCache = {};
    
    var QTImage = Node.derive( function() {
        return {
            img     : null,
            start   : new Vector2(),
            size    : null,
            onload  : function() {}
        }
    }, {
        computeAABB : function() {
            if(this.size){
                this.AABB = {
                    min : this.start.clone(),
                    max : this.start.clone().add(this.size)
                }   
            }
        },
        draw : function(ctx) {

            var start = this.fixAA ? util.fixPos(this.start) : this.start;

            if (this.img) {
                this.size ? 
                    ctx.drawImage(this.img, start.x, start.y, this.size.x, this.size.y) :
                    ctx.drawImage(this.img, start.x, start.y);
            }

        },
        intersect : function(x, y) {
            return this.intersectAABB(x, y);
        }
    });

    QTImage.load = function(src, callback){
        if( _imageCache[src] ) {
            var img = _imageCache[src];
            if( img.constructor == Array ) {
                img.push(callback);
            }else{
                callback(img);
            }
        }else{
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