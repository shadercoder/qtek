/**
 *
 * @export{object}
 */
define(function(require){
    
    var Vector2 = require("core/vector2");

    return {
        fixPos: function(pos){
            pos.x += 0.5;
            pos.y += 0.5;
            return pos;
        },
        fixPosArray : function( poslist ){
            var len = poslist.length;
            for(var i = 0; i < len; i++){
                this.fixPos(poslist[i]);
            }
            return poslist;
        },
        computeAABB : function( points ){
            var left = points[0].x;
            var right = points[1].x;
            var top = points[0].y;
            var bottom = points[1].y;
            
            for(var i = 1; i < points.length; i++){
                var p = points[i];
                if(p.x < left){
                    left = p.x;
                }
                if(p.x > right){
                    right = p.x;
                }
                if(p.y < top){
                    top = p.y;
                }
                if(p.y > bottom){
                    bottom = p.y;
                }
            }
            return {
                min : new Vector2(left, top),
                max : new Vector2(right, bottom)
            }
        }
    }
} )