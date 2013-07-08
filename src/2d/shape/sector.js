define(function(require){

    var Node = require('../node');
    var util = require('../util');
    var Vector2 = require("core/vector2");

    var Sector = Node.derive( function(){
        return {
            center      : new Vector2(),
            innerRadius : 0,
            outerRadius : 0,
            startAngle  : 0,
            endAngle    : 0,
            clockwise   : true
        }
    }, {
        computeAABB : function(){
            // TODO
            this.AABB = {
                min : new Vector2(),
                max : new Vector2()
            }
        },
        intersect : function(x, y){

            var startAngle = this.startAngle;
            var endAngle = this.endAngle;
            var r1 = this.innerRadius;
            var r2 = this.outerRadius;
            var c = this.center;
            var v = new Vector2(x, y).sub(c);
            var r = v.length();
            var pi2 = Math.PI * 2;

            if(r < r1 || r > r2){
                return false;
            }
            var angle = Math.atan2(v.y, v.x);

            //need to constraint the angle between 0 - 360
            if(angle < 0){
                angle = angle+pi2;
            }
            
            if(this.clockwise){
                return angle < endAngle && angle > startAngle;
            }else{
                startAngle =  pi2 - startAngle;
                endAngle = pi2 - endAngle;
                return angle > endAngle && angle < startAngle;
            }   
        },
        draw : function(ctx){

            var startAngle = this.startAngle;
            var endAngle = this.endAngle;
            var r1 = this.innerRadius;
            var r2 = this.outerRadius;
            var c = this.fixAA ? util.fixPos( this.center ) : this.center;

            if( ! this.clockwise ){
                startAngle =  Math.PI*2 - startAngle;
                endAngle =  Math.PI*2 - endAngle;
            }

            var startInner = new Vector2(r1 * Math.cos(startAngle), r1 * Math.sin(startAngle)).add(c);
            var startOuter = new Vector2(r2 * Math.cos(startAngle), r2 * Math.sin(startAngle)).add(c);
            var endInner = new Vector2(r1 * Math.cos(endAngle), r1 * Math.sin(endAngle)).add(c);
            var endOuter = new Vector2(r2 * Math.cos(endAngle), r2 * Math.sin(endAngle)).add(c);

            ctx.beginPath();
            ctx.moveTo(startInner.x, startInner.y);
            ctx.lineTo(startOuter.x, startOuter.y);
            ctx.arc(c.x, c.y, r2, startAngle, endAngle, ! this.clockwise);
            ctx.lineTo(endInner.x, endInner.y);
            ctx.arc(c.x, c.y, r1, endAngle, startAngle, this.clockwise);
            ctx.endPath();

            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }
        }
    })

    return Sector;
})