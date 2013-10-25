/**
 * https://developer.mozilla.org/en-US/docs/HTML/Canvas/Drawing_DOM_objects_into_a_canvas
 * @export{class} HTML
 */
define(function(require){

    var Node = require("../Node");

    var tpl = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">\
                    <foreignObject>\
                        {html}\
                    </foreignObject>';

    var HTML = Node.derive(function() {
        return {
            // html string
            html : '',

            _img : null
        }
    }, {
        draw : function(ctx){
            
            var html = this.html;
            var svg = tpl.replace('{html}', html);

            if (!this._img) {
                this.update();
            }

            if (this._img.complete) {
                ctx.drawImage(this._img, 0, 0);
            }
        },

        update : function(){
            var _blob = new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
            var img = new Image();
            var URL = window.URL || window.webkitURL || window;
            var url = URL.createObjectURL(_blob);

            img.onload = function(){
                this.trigger("load");
                URL.revokeObjectURL(url);
            }

            img.src = url;
        }
    });

    return HTML;
})