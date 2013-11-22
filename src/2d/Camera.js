define(function(require) {

    var Node = require('./Node');
    var Matrix2d = require("core/Matrix2d");
    var glMatrix = require('glmatrix');
    var mat2d = glMatrix.mat2d;

    var Camera = Node.derive(function() {
        return {
        }
    }, {
        getViewMatrix : function() {
            this.updateTransform();
            this.updateTransformInverse();
            return this.transformInverse;
        }
    });

    return Camera;
});