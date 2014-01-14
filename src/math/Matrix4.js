define(function(require) {

    'use strict';

    var glMatrix = require("glmatrix");
    var Vector3 = require("./Vector3");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var mat3 = glMatrix.mat3;
    var quat = glMatrix.quat;

    function makeProperty(n) {
        return {
            set : function(value) {
                this._array[n] = value;
                this._dirty = true;
            },
            get : function() {
                return this._array[n];
            }
        }
    }
    var Matrix4 = function() {

        this._axisX = new Vector3();
        this._axisY = new Vector3();
        this._axisZ = new Vector3();

        this._array = mat4.create();
    };

    Matrix4.prototype = {

        constructor : Matrix4,

        get forward() {
            var el = this._array;
            this._axisZ.set(el[8], el[9], el[10]);
            return this._axisZ;
        },

        // TODO Here has a problem
        // If only set an item of vector will not work
        set forward(v) {
            var el = this._array;
            v = v._array;
            el[8] = v[0];
            el[9] = v[1];
            el[10] = v[2];
        },

        get up() {
            var el = this._array;
            this._axisY.set(el[4], el[5], el[6]);
            return this._axisY;
        },

        set up(v) {
            var el = this._array;
            v = v._array;
            el[4] = v[0];
            el[5] = v[1];
            el[6] = v[2];
        },

        get right() {
            var el = this._array;
            this._axisX.set(el[0], el[1], el[2]);
            return this._axisX;
        },

        set right(v) {
            var el = this._array;
            v = v._array;
            el[0] = v[0];
            el[1] = v[1];
            el[2] = v[2];
        },

        adjoint : function() {
            mat4.adjoint(this._array, this._array);
            return this;
        },
        clone : function() {
            return (new Matrix4()).copy(this);
        },
        copy : function(b) {
            mat4.copy(this._array, b._array);
            return this;
        },
        determinant : function() {
            return mat4.determinant(this._array);
        },
        fromQuat : function(q) {
            mat4.fromQuat(this._array, q._array);
            return this;
        },
        fromRotationTranslation : function(q, v) {
            mat4.fromRotationTranslation(this._array, q._array, v._array);
            return this;
        },
        frustum : function(left, right, bottom, top, near, far) {
            mat4.frustum(this._array, left, right, bottom, top, near, far);
            return this;
        },
        identity : function() {
            mat4.identity(this._array);
            return this;
        },
        invert : function() {
            mat4.invert(this._array, this._array);
            return this;
        },
        lookAt : function(eye, center, up) {
            mat4.lookAt(this._array, eye._array, center._array, up._array);
            return this;
        },
        mul : function(b) {
            mat4.mul(this._array, this._array, b._array);
            return this;
        },
        mulLeft : function(b) {
            mat4.mul(this._array, b._array, this._array);
            return this;
        },
        multiply : function(b) {
            mat4.multiply(this._array, this._array, b._array);
            return this;
        },
        // Apply left multiply
        multiplyLeft : function(b) {
            mat4.multiply(this._array, b._array, this._array);
            return this;
        },
        ortho : function(left, right, bottom, top, near, far) {
            mat4.ortho(this._array, left, right, bottom, top, near, far);
            return this;
        },
        perspective : function(fovy, aspect, near, far) {
            mat4.perspective(this._array, fovy, aspect, near, far);
            return this;
        },
        rotate : function(rad, axis /*Vector3*/) {
            mat4.rotate(this._array, this._array, rad, axis._array);
            return this;
        },
        rotateX : function(rad) {
            mat4.rotateX(this._array, this._array, rad);
            return this;
        },
        rotateY : function(rad) {
            mat4.rotateY(this._array, this._array, rad);
            return this;
        },
        rotateZ : function(rad) {
            mat4.rotateZ(this._array, this._array, rad);
            return this;
        },
        scale : function(v) {
            mat4.scale(this._array, this._array, v._array);
            return this;
        },
        translate : function(v) {
            mat4.translate(this._array, this._array, v._array);
            return this;
        },
        transpose : function() {
            mat4.transpose(this._array, this._array);
            return this;
        },

        // Static method
        // Decompose a matrix to SRT
        // http://msdn.microsoft.com/en-us/library/microsoft.xna.framework.matrix.decompose.aspx
        decomposeMatrix : (function() {

            var x = vec3.create();
            var y = vec3.create();
            var z = vec3.create();

            var m3 = mat3.create();

            return function(scale, rotation, position) {

                var el = this._array;
                vec3.set(x, el[0], el[1], el[2]);
                vec3.set(y, el[4], el[5], el[6]);
                vec3.set(z, el[8], el[9], el[10]);

                scale.x = vec3.length(x);
                scale.y = vec3.length(y);
                scale.z = vec3.length(z);

                position.set(el[12], el[13], el[14]);

                mat3.fromMat4(m3, el);
                // Not like mat4, mat3 in glmatrix seems to be row-based
                mat3.transpose(m3, m3);

                m3[0] /= scale.x;
                m3[1] /= scale.x;
                m3[2] /= scale.x;

                m3[3] /= scale.y;
                m3[4] /= scale.y;
                m3[5] /= scale.y;

                m3[6] /= scale.z;
                m3[7] /= scale.z;
                m3[8] /= scale.z;

                quat.fromMat3(rotation._array, m3);
                quat.normalize(rotation._array, rotation._array);

                scale._dirty = true;
                rotation._dirty = true;
                position._dirty = true;
            }
        })(),

        toString : function() {
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    // Object.defineProperty(Matrix4.prototype, 'm00', makeProperty(0));
    // Object.defineProperty(Matrix4.prototype, 'm01', makeProperty(1));
    // Object.defineProperty(Matrix4.prototype, 'm02', makeProperty(2));
    // Object.defineProperty(Matrix4.prototype, 'm03', makeProperty(3));
    // Object.defineProperty(Matrix4.prototype, 'm10', makeProperty(4));
    // Object.defineProperty(Matrix4.prototype, 'm11', makeProperty(5));
    // Object.defineProperty(Matrix4.prototype, 'm12', makeProperty(6));
    // Object.defineProperty(Matrix4.prototype, 'm13', makeProperty(7));
    // Object.defineProperty(Matrix4.prototype, 'm20', makeProperty(8));
    // Object.defineProperty(Matrix4.prototype, 'm21', makeProperty(9));
    // Object.defineProperty(Matrix4.prototype, 'm22', makeProperty(10));
    // Object.defineProperty(Matrix4.prototype, 'm23', makeProperty(11));
    // Object.defineProperty(Matrix4.prototype, 'm30', makeProperty(12));
    // Object.defineProperty(Matrix4.prototype, 'm31', makeProperty(13));
    // Object.defineProperty(Matrix4.prototype, 'm32', makeProperty(14));
    // Object.defineProperty(Matrix4.prototype, 'm33', makeProperty(15));

    return Matrix4;
})