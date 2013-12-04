define(function(require) {

    var qpf = require("qpf");
    var ko = require("knockout");
    var Meta = qpf.meta.Meta;

    var palette = require("./palette");

    function rgb2hex(rgb) {
        return Math.floor(rgb[0] * 255) << 16
                | Math.floor(rgb[1] * 255) << 8
                | Math.floor(rgb[2] * 255);
    }
    function hex2rgb(hex) {
        var r = (hex >> 16) & 0xff;
        var g = (hex >> 8) & 0xff;
        var b = hex & 0xff;
        return [r / 255, g / 255, b / 255];
    }

    function hex2str(hex) {
        var str = hex.toString(16);
        for (var i = str.length; i < 6; i++) {
            str = '0' + str;
        }
        return '#' + str;
    }

    var Color = Meta.derive(function() {
        var ret = {
            color : ko.observable(0xffffff)
        }
        ret._isColorRGB = ko.computed(function() {
            return ret.color() instanceof Array;
        });
        ret._colorStr = ko.computed(function() {
            var color = ret.color();
            if (ret._isColorRGB()) {
                color = rgb2hex(color);
            }
            color = hex2str(color);
            return color;
        })
        return ret;
    }, {

        type : 'COLOR',

        css : 'color',

        template : '<div data-bind="text:_colorStr" class="qpf-color-hex"></div>\
                    <div class="qpf-color-preview" data-bind="style:{backgroundColor:_colorStr()}"></div>',

        initialize : function() {
            var self = this;

            this.$el.click(function() {
                self.showPalette();
            });
        },

        showPalette : function() {

            palette.show();

            palette.on("change", this._paletteChange, this);
            palette.on("cancel", this._paletteCancel, this);
            palette.on("apply", this._paletteApply, this);

            var color = this.color();
            if (this._isColorRGB()) {
                color = rgb2hex(color);
            }
            palette.set(color);
        },

        _paletteChange : function(hex) {
            if (this._isColorRGB()) {
                this.color(hex2rgb(hex));
            } else {
                this.color(hex);
            }
        },
        _paletteCancel : function() {
            palette.hide();
            palette.off("change");
            palette.off("apply");
            palette.off("cancel");
        },
        _paletteApply : function() {
            this._paletteCancel();
        }
    });

    Meta.provideBinding("color", Color);

    return Color;
})