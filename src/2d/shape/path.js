/**
 *
 * Inspired by path in paper.js
 */
define(function(require) {

    var Node = require('../node');
    var util = require('../util');
    var Vector2 = require("core/vector2");

    var minTmp = new Vector2();
    var maxTmp = new Vector2();

    var Path = Node.derive(function() {
        return {
            segments : [],
            closePath : false
        }
    }, {
        computeBoundingBox : function() {
            var l = this.segments.length;
            var segs = this.segments;

            var min = this.boundingBox.min;
            var max = this.boundingBox.max;
            min.set(999999, 999999);
            max.set(-999999, -999999);
            
            for (var i = 1; i < l; i++) {
                if (segs[i-1].handleOut || segs[i].handleIn) {
                    var bb = util.computeCubeBezierBoundingBox(
                                segs[i-1].point,
                                segs[i-1].handleOut || segs[i-1].point,
                                segs[i].handleIn || segs[i].point,
                                segs[i].point,
                                minTmp, maxTmp
                            );
                    min.min(minTmp);
                    max.max(maxTmp);
                } else {
                    min.min(segs[i-1].point);
                    min.min(segs[i].point);

                    max.max(segs[i-1].point);
                    max.max(segs[i].point);
                }
            }
        },
        draw : function(ctx) {
            
            var l = this.segments.length;
            var segs = this.segments;
            
            ctx.beginPath();
            ctx.moveTo(segs[0].point.x, segs[0].point.y);
            for (var i = 1; i < l; i++) {
                if (segs[i-1].handleOut || segs[i].handleIn) {
                    var prevHandleOut = segs[i-1].handleOut || segs[i-1].point;
                    var handleIn = segs[i].handleIn || segs[i].point;
                    ctx.bezierCurveTo(prevHandleOut.x, prevHandleOut.y,
                            handleIn.x, handleIn.y, segs[i].point.x, segs[i].point.y);
                } else {
                    ctx.lineTo(segs[i].point.x, segs[i].point.y);
                }
            }
            if (this.closePath) {
                if (segs[l-1].handleOut || segs[0].handleIn) {
                    var prevHandleOut = segs[l-1].handleOut || segs[l-1].point;
                    var handleIn = segs[0].handleIn || segs[0].point;
                    ctx.bezierCurveTo(prevHandleOut.x, prevHandleOut.y,
                            handleIn.x, handleIn.y, segs[0].point.x, segs[0].point.y);
                } else {
                    ctx.lineTo(segs[0].point.x, segs[0].point.y);
                }
            }
            if (this.fill) {
                ctx.fill();
            }
            if (this.stroke) {
                ctx.stroke();
            }
        },
        smooth : function(degree) {

            var len = this.segments.length;
            var middlePoints = [];
            var segs = this.segments;

            var m = new Vector2();
            function computeVector(a, b, c) {
                m.copy(b).add(c).scale(0.5);
                return m.sub(a).negate();
            }

            for (var i = 0; i < len; i++) {
                var point = segs[i].point;
                var nextPoint = (i == len-1) ? segs[0].point : segs[i+1].point;
                middlePoints.push(new Vector2().copy(point).add(nextPoint).scale(0.5));
            }

            var middleMiddlePoint = new Vector2();
            var v1 = new Vector2();
            var v2 = new Vector2();
            for (var i = 0; i < len; i++) {
                var point = segs[i].point;
                var middlePoint = middlePoints[i];
                var prevMiddlePoint = (i == 0) ? middlePoints[len-1] : middlePoints[i-1];
                var degree = segs[i].smoothLevel || degree || 1;
                middleMiddlePoint.copy(middlePoint).add(prevMiddlePoint).scale(0.5);
                v1.copy(middlePoint).sub(middleMiddlePoint);
                v2.copy(prevMiddlePoint).sub(middleMiddlePoint);

                var dv = computeVector(point, prevMiddlePoint, middlePoint);
                //use degree to scale the handle length
                v2.scale(degree);
                v1.scale(degree);
                if (!segs[i].handleIn) {
                    segs[i].handleIn = middleMiddlePoint.clone().add(v2).add(dv);
                } else {
                    segs[i].handleIn.copy(middleMiddlePoint).add(v2).add(dv);
                }
                if (!segs[i].handleOut) {
                    segs[i].handleOut = middleMiddlePoint.clone().add(v1).add(dv);
                } else {
                    segs[i].handleOut.copy(middleMiddlePoint).add(v1).add(dv);
                }
            }
        },
        pushPoints : function(points) {
            for (var i = 0; i < points.length; i++) {
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