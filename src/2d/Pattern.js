/**
 * Adapter to CanvasPattern
 *
 * @export{class} Pattern
 */
define(function(require) {

    var Base = require('../core/Base');
    var Vector2 = require("../math/Vector2");
    var Cache = require("../core/Cache");

    var Pattern = Base.derive(function(){
        return {
            image : null,
            // 'repeat', 'repeat-x', 'repeat-y', 'no-repeat'
            repetition : 'repeat'
        }
    }, function() {
        this.cache = new Cache();
    }, {
        getInstance : function(ctx){
            this.cache.use(ctx.__GUID__);
            if (this.cache.get("dirty") ||
                this.cache.miss("pattern")) {
                var pattern = ctx.createPattern(this.image, this.repetition);
                this.cache.put("pattern", pattern);
                return pattern;
            }
            return this.cache.get("pattern");
        },
    });

    return Pattern;
})