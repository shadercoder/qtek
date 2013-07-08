define(function(require){

    var Node = require('../node');
    var util = require('../util');
    var Vector2 = require("core/vector2");

    var Circle = Node.derive( function() {
        return {
            center : new Vector2(),
            radius : 0   
        }

    }, {
        computeAABB : function() {
            this.AABB = {
                min : new Vector2(this.center.x-this.radius, this.center.y-this.radius),
                max : new Vector2(this.center.x+this.radius, this.center.y+this.radius)
            }
        },
        draw : function(ctx) {
            var center = this.fixAA ? util.fixPos(this.center) : this.center;

            ctx.beginPath();
            ctx.arc(center.x, center.y, this.radius, 0, 2*Math.PI, false);
            
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