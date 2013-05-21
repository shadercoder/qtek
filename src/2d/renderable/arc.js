define(function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Arc = Node.derive( function(){
        return {
            center      : [0, 0],
            radius      : 0,
            startAngle  : 0,
            endAngle    : Math.PI*2,
            clockwise   : true
        }
    }, {
        computeAABB : function(){
            // TODO
            this.AABB = [[0, 0], [0, 0]];
        },
        draw : function(contex){

            var center = this.fixAA ? util.fixPos( this.center ) : this.center;

            ctx.beginPath();
            ctx.arc(center[0], center[1], this.radius, this.startAngle, this.endAngle,  ! this.clockwise);
            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }   
        },
        intersect : function(x, y){
            // TODO
            return false;
        }
    })

    return Arc;
});