/**
 *
 * @export{object}
 */
define( function(require){

    return {
        fixPos: function( pos ){
            return [pos[0]+0.5, pos[1]+0.5];
        },
        fixPosArray : function( poslist ){
            var ret = [];
            var len = poslist.length;
            for(var i = 0; i < len; i++){
                ret.push( this.fixPos(poslist[i]) );
            }
            return ret;
        },
        computeAABB : function( points ){
            var left = points[0][0];
            var right = points[0][0];
            var top = points[0][1];
            var bottom = points[0][1];
            
            for(var i = 1; i < points.length; i++){
                left = points[i][0] < left ? points[i][0] : left;
                right = points[i][0] > right ? points[i][0] : right;
                top = points[i][1] < top ? points[i][1] : top;
                bottom = points[i][1] > bottom ? points[i][1] : bottom;
            }
            return [[left, top], [right, bottom]];
        }
    }
} )