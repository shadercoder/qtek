/**
 * https://developer.mozilla.org/en-US/docs/HTML/Canvas/Drawing_DOM_objects_into_a_canvas
 * @export{class} HTML
 */
define(function(require){

    var Node = require("../node");

    var HTML = Node.derive(function() {
        return {
            // html string or dom object
            html : null
        }
    }, {
        draw : function(){
            
        }
    })
})