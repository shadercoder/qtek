define(function(require){

    var Node = require('../node');
    var Vector2 = require("core/vector2");

    var Arc = Node.derive(function() {
        return {
            center      : new Vector2(),
            radius      : 0,
            startAngle  : 0,
            endAngle    : Math.PI*2,
            clockwise   : true
        }
    }, {
        computeBoundingBox : function() {
             util.computeArcBoundingBox(
                this.center, this.radius, this.startAngle, 
                this.endAngle, this.clockwise,
                this.boundingBox.min, this.boundingBox.max
            );
        },
        draw : function(contex) {

            ctx.beginPath();
            ctx.arc(this.center.x, this.center.y, this.radius, this.startAngle, this.endAngle,  ! this.clockwise);
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
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