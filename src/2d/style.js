/**
 * Style
 * @config  fillStyle | fill,
 * @config  strokeStyle | stroke,
 * @config  lineWidth,
 * @config  lineCap,
 * @config  lineJoin,
 * @config  lineDash,
 * @config  lineDashOffset,
 * @config  miterLimit,
 * @config  shadowColor,
 * @config  shadowOffsetX,
 * @config  shadowOffsetY,
 * @config  shadowBlur,
 * @config  globalAlpha | alpha,
 * @config  globalCompositeOperation,
 * @config  alpha,
 * @config  shadow
 */
define(function(require) {
    
    var Base = require('core/base');
    var _ = require('_');

    var _styles = ['fillStyle', 
                    'strokeStyle', 
                    'lineWidth', 
                    'lineCap',
                    'lineJoin',
                    'miterLimit',
                    'shadowColor', 
                    'shadowOffsetX', 
                    'shadowOffsetY',
                    'shadowBlur',
                    'globalAlpha',
                    'globalCompositeOperation',
                    'font',
                    'textAlign',
                    'textBaseline'];
    var _styleAlias = {          //extend some simplify style name
                         'fill' : 'fillStyle',
                         'stroke' : 'strokeStyle',
                         'alpha' : 'globalAlpha',
                         'composite' : 'globalCompositeOperation',
                         'shadow' : ['shadowOffsetX', 
                                    'shadowOffsetY', 
                                    'shadowBlur', 
                                    'shadowColor']
                        };

    var shadowSyntaxRegex = /([0-9\-]+)\s+([0-9\-]+)\s+([0-9]+)\s+([a-zA-Z0-9\(\)\s,#]+)/;
    
    var Style = Base.derive({}, {

        bind : function(ctx) {

            for (var alias in _styleAlias) {
                if (this[alias] || this[alias] === 0) {
                    var name = _styleAlias[alias];
                    var value = this[alias];
                    // composite styles, like shadow, the value can be "0 0 10 #000"
                    if (alias == "shadow") {
                        var res = shadowSyntaxRegex.exec(trim(value));
                        if (! res)
                            continue;
                        value = res.slice(1);
                        _.each(value, function(item, idx) {
                            if (name[idx]) {
                                ctx[ name[idx] ] = item;
                            }
                        }, this)
                    } else {
                        ctx[ name ] = value;
                    }
                }
            }
            _.each(_styles, function(styleName) {
                if (this[styleName] || this[styleName] === 0) {
                    ctx[styleName] = this[styleName];
                }
            }, this);

            // Set line dash individually
            if (this.lineDash) {
                if (ctx.setLineDash) {
                    ctx.setLineDash(this.lineDash);
                    if (typeof(this.lineDashOffset) === 'number') {
                        ctx.lineDashOffset = this.lineDashOffset;
                    }
                } else {
                    console.warn("Browser not support setLineDash method");
                }
            }
        }
    })

    function trim(str) {
        return (str || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
    }

    return Style;
})