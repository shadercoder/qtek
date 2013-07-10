define(function(require){

    var Node = require('../node');
    var util = require('../util');
    var Vector2 = require("core/vector2");

    var Ellipse = Node.derive( function() {
        return {
            center : new Vector2(),
            radius : new Vector2()   
        }

    }, {
        computeAABB : function() {
            this.AABB = {
                min : this.center.clone().sub(this.radius),
                max : this.center.clone().add(this.radius)
            }
        },
        draw : function(ctx) {
            var center = this.fixAA ? util.fixPos(this.center) : this.center;

            ctx.save();
            ctx.scale(1, this.radius.y / this.radius.x);
            ctx.beginPath();
            ctx.arc(center.x, center.y, this.radius.x, 0, 2*Math.PI, false);
            
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }
            ctx.restore();
        },
        intersect : function() {

            return vec2.len([this.center[0]-x, this.center[1]-y]) < this.radius;
        }
    } )

    return Ellipse;
});