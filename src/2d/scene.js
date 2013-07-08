define( function(require){

    var Node = require('./node');

    var Scene = Node.derive(function(){
        return {}
    },{
    });

    return Scene;
} )