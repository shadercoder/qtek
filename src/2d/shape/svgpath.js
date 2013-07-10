/**
 * 
 * @export{class} SVGPath
 */
define(function(require){

    var Node = require("2d/node");

    var availableCommands = {'m':1,'M':1,'z':1,'Z':1,'l':1,'L':1,'h':1,'H':1,'v':1,'V':1,'c':1,'C':1,'s':1,'S':1,'q':1,'Q':1,'t':1,'T':1,'a':1,'A':1}

    var SVGPath = Node.derive({
        description : ''
    }, {
        draw : function(ctx) {
            // point x, y
            var x = 0;
            var y = 0;
            // control point 1(in cube bezier curve and quadratic bezier curve)
            var x1 = 0;
            var y1 = 0;
            // control point 2(in cube bezier curve)
            var x2 = 0;
            var y2 = 0;

            // pre process
            var d = this.description.replace(/\s*,\s*/g, ' ');
            d = d.replace(/(-)/g, ' $1');
            d = d.replace(/([mMzZlLhHvVcCsSqQtTaA])/g, ' $1 ');
            d = d.split(/\s+/);

            var command = "";
            // Save the previous command specially for shorthand/smooth curveto(s/S, t/T)
            var prevCommand = "";
            var offset = 0;
            var len = d.length;
            var next = d[0];

            ctx.beginPath();
            while (offset <= len) {
                // Skip empty
                if(!next){
                    next = d[++offset];
                    continue;
                }
                if (availableCommands[next]) {
                    prevCommand = command;
                    command = next;
                    offset++;
                }
                // http://www.w3.org/TR/SVG/paths.html
                switch(command) {
                    case "m":
                        x = pickValue() + x;
                        y = pickValue() + y;
                        ctx.moveTo(x, y);
                        break;
                    case "M":
                        x = pickValue();
                        y = pickValue();
                        ctx.moveTo(x, y);
                        break;
                    case "z":
                    case "Z":
                        ctx.closePath();
                        if (this.fill) {
                            ctx.fill();
                        }
                        if (this.stroke) {
                            ctx.stroke();
                        }
                        next = d[offset];
                        ctx.beginPath();
                        break;
                    case "l":
                        x = pickValue() + x;
                        y = pickValue() + y;
                        ctx.lineTo(x, y);
                        break;
                    case "L":
                        x = pickValue();
                        y = pickValue();
                        ctx.lineTo(x, y);
                        break;
                    case "h":
                        x = pickValue() + x;
                        ctx.lineTo(x, y);
                        break;
                    case "H":
                        x = pickValue();
                        ctx.lineTo(x, y);
                        break;
                    case "v":
                        y = pickValue() + y;
                        ctx.lineTo(x, y);
                        break;
                    case "V":
                        y = pickValue();
                        ctx.lineTo(x, y);
                        break;
                    case "c":
                        x1 = pickValue() + x;
                        y1 = pickValue() + y;
                        x2 = pickValue() + x;
                        y2 = pickValue() + y;
                        x = pickValue() + x;
                        y = pickValue() + y;
                        ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
                        break;
                    case "C":
                        x1 = pickValue();
                        y1 = pickValue();
                        x2 = pickValue();
                        y2 = pickValue();
                        x = pickValue();
                        y = pickValue();
                        ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
                        break;
                    case "s":
                        if (prevCommand === "c" || prevCommand === "C" ||
                            prevCommand === "s" || prevCommand === "S") {
                            // Reflection of the second control point on the previous command
                            x1 = x * 2 - x2;
                            y1 = y * 2 - y2;
                        } else {
                            x1 = x;
                            y1 = y;
                        }
                        x2 = pickValue() + x;
                        y2 = pickValue() + y;
                        x = pickValue() + x;
                        y = pickValue() + y;
                        ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
                        break;
                    case "S":
                        if (prevCommand === "c" || prevCommand === "C" ||
                            prevCommand === "s" || prevCommand === "S") {
                            // Reflection of the second control point on the previous command
                            x1 = x * 2 - x2; 
                            y1 = y * 2 - y2;
                        } else {
                            x1 = x;
                            y1 = y;
                        }
                        x2 = pickValue();
                        y2 = pickValue();
                        x = pickValue();
                        y = pickValue();
                        ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
                        break;
                    case "q":
                        x1 = pickValue() + x;
                        y1 = pickValue() + y;
                        x = pickValue() + x;
                        y = pickValue() + y;
                        ctx.quadraticBezierCurveTo(x1, y1, x, y);
                        break;
                    case "Q":
                        x1 = pickValue();
                        y1 = pickValue();
                        x = pickValue();
                        y = pickValue();
                        ctx.quadraticBezierCurveTo(x1, y1, x, y);
                        break;
                    case "t":
                        if (prevCommand === "q" || prevCommand === "Q" ||
                            prevCommand === "t" || prevCommand === "T") {
                            // Reflection of the second control point on the previous command
                            x1 = x * 2 - x1; 
                            y1 = y * 2 - y1;
                        } else {
                            x1 = x;
                            y1 = y;
                        }
                        x = pickValue() + x;
                        y = pickValue() + y;
                        ctx.quadraticBezierCurveTo(x1, y1, x, y);
                        break;
                    case "T":
                        if (prevCommand === "q" || prevCommand === "Q" ||
                            prevCommand === "t" || prevCommand === "T") {
                            // Reflection of the second control point on the previous command
                            x1 = x * 2 - x1; 
                            y1 = y * 2 - y1;
                        } else {
                            x1 = x;
                            y1 = y;
                        }
                        x = pickValue();
                        y = pickValue();
                        ctx.quadraticBezierCurveTo(x1, y1, x, y);
                        break;
                    case "a":
                    case "A":
                        console.warn("Elliptical arc is not supported yet");
                        break;
                    default:
                        pick();
                        continue;
                }
            }
            
            if (this.fill) {
                ctx.fill();
            }
            if (this.stroke) {
                ctx.stroke();
            }
            
            function pick() {
                next = d[offset+1];
                return d[offset++];
            }

            var _val;
            function pickValue() {
                next = d[offset+1];
                _val = d[offset++];
                return parseFloat(_val);
            }
        }
    });

    return SVGPath;
})