define( function(require){

    var Base = require('core/base');

    var Renderer = Base.derive(function(){
        return {
            canvas : null,

            context : null,

            width : 0,

            height : 0,

            clearColor : '',

            _latestRenderedScene : null
        }
    }, function(){
        
        if( ! this.canvas ){
            this.canvas = document.createElement('canvas');
        }

        this.canvas.addEventListener('click', this._clickHandler.bind(this));
        this.canvas.addEventListener('mousedown', this._mouseDownHandler.bind(this));
        this.canvas.addEventListener('mouseup', this._mouseUpHandler.bind(this));
        this.canvas.addEventListener('mousemove', this._mouseMoveHandler.bind(this));
        this.canvas.addEventListener('mouseout', this._mouseOutHandler.bind(this));
        
        if( this.width ){
            this.canvas.width = this.width;
        }else{
            this.width = this.canvas.width;
        }
        if( this.height ){
            this.canvas.height = this.height;
        }else{
            this.height = this.canvas.height;
        }
        this.context = this.canvas.getContext('2d');

    }, {

        resize : function(width, height){
            this.canvas.width = width;
            this.canvas.height = height;

            this.width = width;
            this.height = height;
        },

        render : function( scene ) {
            if (this.clearColor) {
                this.context.fillStyle = this.clearColor;
                this.context.fillRect(0, 0, this.width, this.height);
            } else {
                this.context.clearRect(0, 0, this.width, this.height);
            }

            scene.render( this.context );

            this._latestRenderedScene = scene;
        },

        _clickHandler : function(){
            var scene = this._latestRenderedScene;
        },

        _mouseDownHandler : function(){

        },

        _mouseUpHandler : function(){

        },

        _mouseMoveHandler : function(){

        },

        _mouseOutHandler : function(){

        }
    })

    return Renderer;
} )