define(function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Text = Node.derive( function(){
        return {
            text : '',
            start : [0, 0],
            size : [0, 0],
            font : '',
            textAlign : '',
            textBaseline : ''
        }
    }, {
        computeAABB : function(){
            this.AABB = util.computeAABB( [this.start, [this.start[0]+this.size[0], this.start[1]+this.size[1]]] );
        },
        draw : function(ctx){
            var start = this.fixAA ? util.fixPos(this.start) : this.start;
            if(this.font){
                ctx.font = this.font;
            }
            if(this.textAlign){
                ctx.textAlign = this.textAlign;
            }
            if(this.textBaseline){
                ctx.textBaseline = this.textBaseline
            }
            if(this.fill){
                this.size.length && this.size[0] ?
                    ctx.fillText(this.text, start[0], start[1], this.size[0]) :
                    ctx.fillText(this.text, start[0], start[1]);
            }
            if(this.stroke){
                this.size.length && this.size[0] ?
                    ctx.strokeText(this.text, start[0], start[1], this.size[0]) :
                    ctx.strokeText(this.text, start[0], start[1]);
            }
        },
        resize : function(ctx){
            if(! this.size[0] || this.needResize){
                this.size[0] = ctx.measureText(this.text).width;
                this.size[1] = ctx.measureText('m').width;
            }
        },
        intersect : function(x, y){
            return this.intersectAABB(x, y);
        }
    })

    return Text;
})