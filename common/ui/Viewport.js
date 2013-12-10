define(function(require){

    var qpf = require("qpf");
    var qtek = require('qtek');
    var Meta = qpf.meta.Meta;
    var ko = require("knockout");

    var Viewport = Meta.derive(function(){
        return {
            tag : "div",
            stage : null
        }
    }, {
        type : 'VIEWPORT',
        css : "viewport",

        initialize : function() {
            this.stage = new qtek.Stage({
                container : this.$el[0]
            });
        },

        onResize : function() {
            if (this.stage) {
                this.stage.resize(this.width(), this.height());
            }
        }
    })

    Meta.provideBinding("viewport", Viewport);

    return Viewport;
})