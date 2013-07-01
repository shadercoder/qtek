define(function(require) {

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;
    var _ = require("_");

    var _imageCache = {};
    
    var QTImage = Node.derive( function() {
        return {
            img     : null,
            start   : [0, 0],
            size    : 0,
            onload  : function() {}
        }
    }, {
        computeAABB : function() {

            this.AABB = util.computeAABB([this.start, [this.start[0]+this.size[0], this.start[1]+this.size[1]]]);
        },
        draw : function(ctx) {

            var start = this.fixAA ? util.fixPos(this.start) : this.start;

            if (this.img) {
                this.size ? 
                    ctx.drawImage(this.img, start[0], start[1], this.size[0], this.size[1]) :
                    ctx.drawImage(this.img, start[0], start[1]);
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