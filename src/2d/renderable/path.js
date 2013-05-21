define(function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Path = Node.derive( function(){
        return {
            segments : [],
            globalStyle : true
        }
    }, {
        computeAABB : function(){
            this.AABB = [[0, 0], [0, 0]];
        },
        draw : function(ctx){
            
            if(this.globalStyle){
                this.drawWithSameStyle(ctx);
            }else{
                this.drawWithDifferentStyle(ctx);
            }
        },
        drawWithSameStyle : function(ctx){
            
            var l = this.segments.length;
            var segs = this.segments;

            ctx.beginPath();
            ctx.moveTo(segs[0].point[0], segs[0].point[1]);
            for(var i =1; i < l; i++){

                if(segs[i-1].handleOut || segs[i].handleIn){
                    var prevHandleOut = segs[i-1].handleOut || segs[i-1].point;
                    var handleIn = segs[i].handleIn || segs[i].point;
                    ctx.bezierCurveTo(prevHandleOut[0], prevHandleOut[1],
                            handleIn[0], handleIn[1], segs[i].point[0], segs[i].point[1]);
                }
                else{
                    ctx.lineTo(segs[i].point[0], segs[i].point[1]);
                }

            }
            if(this.fill){
                ctx.fill();
            }
            if(this.stroke){
                ctx.stroke();
            }   
        },
        drawWithDifferentStyle : function(ctx){
            
            var l = this.segments.length;
            var segs = this.segments;

            for(var i =0; i < l-1; i++){

                ctx.save();
                segs[i].style && segs[i].style.bind(ctx);

                ctx.beginPath();
                ctx.moveTo(segs[i].point[0], segs[i].point[1]);

                if(segs[i].handleOut || segs[i+1].handleIn){
                    var handleOut = segs[i].handleOut || segs[i].point;
                    var nextHandleIn = segs[i+1].handleIn || segs[i+1].point;
                    ctx.bezierCurveTo(handleOut[0], handleOut[1],
                            nextHandleIn[0], nextHandleIn[1], segs[i+1].point[0], segs[i+1].point[1]);
                }
                else{
                    ctx.lineTo(segs[i+1].point[0], segs[i+1].point[1]);
                }

                if(this.stroke){
                    ctx.stroke();
                }
                if(this.fill){
                    ctx.fill();
                }
                ctx.restore();
            }
        },
        smooth : function(degree){
            var len = this.segments.length;
            var middlePoints = [];
            var segs = this.segments;

            function computeVector(a, b, c){
                var m = vec2.scale([], vec2.add([], b, c), 0.5);
                return vec2.sub([], a, m);
            }

            for(var i = 0; i < len; i++){
                var point = segs[i].point;
                var nextPoint = (i == len-1) ? segs[0].point : segs[i+1].point;
                middlePoints.push(
                        vec2.scale([], vec2.add([], point, nextPoint), 0.5));
            }

            for(var i = 0; i < len; i++){
                var point = segs[i].point;
                var middlePoint = middlePoints[i];
                var prevMiddlePoint = (i == 0) ? middlePoints[len-1] : middlePoints[i-1];
                var degree = segs[i].smoothLevel || degree || 1;
                var middleMiddlePoint = vec2.scale([], vec2.add([], middlePoint, prevMiddlePoint), 0.5);
                var v1 = vec2.sub([], middlePoint, middleMiddlePoint);
                var v2 = vec2.sub([], prevMiddlePoint, middleMiddlePoint);

                var dv = computeVector(point, prevMiddlePoint, middlePoint);
                //use degree to scale the handle length
                vec2.scale(v2, v2, degree);
                vec2.scale(v1, v1, degree);
                segs[i].handleIn = vec2.add([], vec2.add([], middleMiddlePoint, v2), dv);
                segs[i].handleOut = vec2.add([], vec2.add([], middleMiddlePoint, v1), dv);
            }
            segs[0].handleOut = segs[0].handleIn = null;
            segs[len-1].handleIn = segs[len-1].handleOut = null;
            
        },
        pushPoints : function(points){
            for(var i = 0; i < points.length; i++){
                this.segments.push({
                    point : points[i],
                    handleIn : null,
                    handleOut : null
                })
            }
        }
    })

    return Path;
})