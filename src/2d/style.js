/**
 * Style
 * @config  fillStyle | fill,
 * @config  strokeStyle | stroke,
 * @config  lineWidth,
 * @config  shadowColor,
 * @config  shadowOffsetX,
 * @config  shadowOffsetY,
 * @config  shadowBlur,
 * @config  globalAlpha | alpha
 * @config  shadow
 */
define(function(require){
    
    var Base = require('core/base');
    var _ = require('_');

    var _styles = ['fillStyle', 
                    'strokeStyle', 
                    'lineWidth', 
                    'shadowColor', 
                    'shadowOffsetX', 
                    'shadowOffsetY',
                    'shadowBlur',
                    'globalAlpha',
                    'font'];
    var _styleAlias = {          //extend some simplify style name
                         'fill' : 'fillStyle',
                         'stroke' : 'strokeStyle',
                         'alpha' : 'globalAlpha',
                         'shadow' : ['shadowOffsetX', 
                                    'shadowOffsetY', 
                                    'shadowBlur', 
                                    'shadowColor']
                        };

    var shadowSyntaxRegex = /([0-9\-]+)\s+([0-9\-]+)\s+([0-9]+)\s+([a-zA-Z0-9\(\)\s,#]+)/;
    
    var Style = Base.derive({}, {

        bind : function(ctx){

            var styles = _styles;
            var styleAlias = _styleAlias;

            for( var alias in styleAlias ){
                if( this.hasOwnProperty(alias) ){
                    var name = styleAlias[alias];
                    var value = this[alias];
                    // composite styles, like shadow, the value can be "0 0 10 #000"
                    if( alias == "shadow" ){
                        var res = shadowSyntaxRegex.exec(trim(value));
                        if( ! res )
                            continue;
                        value = res.slice(1);
                        _.each( value, function(item, idx){
                            if( name[idx] ){
                                ctx[ name[idx] ] = item;
                            }
                        }, this)
                    }else{
                        ctx[ name ] = value;
                    }
                }
            }
            _.each(styles, function(styleName){
                if( this.hasOwnProperty( styleName ) ){
                    ctx[styleName] = this[styleName];
                }   
            }, this)
        }
    })

    function trim(str){
        return (str || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
    }

    return Style;
})