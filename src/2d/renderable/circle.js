define(function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Circle = Node.derive( function() {
        return {
            center : [0, 0],
            radius : 0   
        }

    }, {
        computeAABB : function() {
            this.AABB = [[this.center[0]-this.radius, this.center[1]-this.radius],
                         [this.center[0]+this.radius, this.center[1]+this.radius]];
        },
        draw : function(ctx) {
            var center = this.fixAA ? util.fixPos( this.center ) : this.center;

            ctx.beginPath();
            ctx.arc(center[0], center[1], this.radius, 0, 2*Math.PI, false);
            
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }
        },
        intersect : function() {

            return vec2.len([this.center[0]-x, this.center[1]-y]) < this.radius;
        }
    } )

    return Circle;
});