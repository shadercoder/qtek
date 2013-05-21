define(function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Polygon = Node.derive( function(){
        return {
            points : []
        }
    }, {
        computeAABB : function(){
            this.AABB = util.computeAABB( this.points );
        },
        draw : function(ctx){

            var points = this.fixAA ? util.fixPosArray(this.points) : this.points;

            ctx.beginPath();
            
            ctx.moveTo(points[0][0], points[0][1]);
            for(var i =1; i < points.length; i++){
                ctx.lineTo(points[i][0], points[i][1]);
            }
            ctx.closePath();
            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }
        },
        intersect : function(x, y){
    
            if(!this.intersectAABB(x, y)){
                return false;
            }

            var len = this.points.length;
            var angle = 0;
            var points = this.points;
            var vec1, vec2, j, piece;
            for(var i =0; i < len; i++){
                vec1 = vec2.normalize([], [points[i][0]-x, points[i][1]-y]);
                j = (i+1)%len;
                vec2 =  vec2.normalize([], [points[j][0]-x, points[j][1]-y]);
                piece = Math.acos(vec2.dot(vec1, vec2));
                angle += piece;
            }
            return Math.length(angle - 2*Math.PI) < 0.001;
        }
    })

    return Node;
})