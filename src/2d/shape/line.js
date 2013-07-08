define(function(require){

    var Node = require('../node');
    var util = require('../util');
    var Vector2 = require("core/vector2");

    var Line = Node.derive(function(){
        return {
            start : new Vector2(),
            end : new Vector2(),
            width : 0   //virtual width of the line for intersect computation 
        }
    }, {
        computeAABB : function(){

            this.AABB = util.computeAABB([this.start, this.end]);
            
            if(this.AABB.min.x == this.AABB.max.x){ //line is vertical
                this.AABB.min.x -= this.width/2;
                this.AABB.max.x += this.width/2;
            }
            if(this.AABB.min.y == this.AABB.max.y){ //line is horizontal
                this.AABB.min.y -= this.width/2;
                this.AABB.max.y += this.width/2;
            }
        },
        draw : function(ctx){
            
            var start = this.fixAA ? util.fixPos(this.start) : this.start,
                end = this.fixAA ? util.fixPos(this.end) : this.end;

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

        },
        intersect : function(){
            var a = new Vector2();
            var ba = new Vector2();
            var bc = new Vector2();

            return function(x, y){
                if(!this.intersectAABB(x, y)){
                    return false;
                }
                var b = this.start;
                var c = this.end;

                a.set(x, y);
                ba.copy(a).sub(b);
                bc.copy(c).sub(b);

                var bal = ba.length();
                var bcl = bc.length();

                var tmp = bal * ba.scale(1/bal).dot(bcl.scale(1/bcl));

                var distSquare = bal * bal -  tmp * tmp;
                return distance < this.width * this.width * 0.25;
            }
        }
    });

    return Line;
})