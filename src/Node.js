define(function(require) {
    
    'use strict';

    var Base = require("./core/Base");
    var util = require("./core/util");
    var Vector3 = require("./math/Vector3");
    var Quaternion = require("./math/Quaternion");
    var Matrix4 = require("./math/Matrix4");
    var Matrix3 = require("./math/Matrix3");
    var glMatrix = require('glmatrix');
    var mat4 = glMatrix.mat4;

    var nameId = 0;

    var Node = Base.derive({
        
        parent : null,
        
        scene : null,

        autoUpdateLocalTransform : true,

        _needsUpdateWorldTransform : true,

        _inIterating : false,

        // Depth for transparent queue sorting
        __depth : 0

    }, function() {

        if (!this.name) {
            this.name = 'NODE_' + (nameId++);
        }

        if (!this.position) {
            this.position = new Vector3();
        }
        if (!this.rotation) {
            this.rotation = new Quaternion();
        }
        if (!this.scale) {
            this.scale = new Vector3(1, 1, 1);
        }

        this.worldTransform = new Matrix4();
        this.localTransform = new Matrix4();

        this._children = [];

    }, {
        isRenderable : function() {
            return false;
        },

        setName : function(name) {
            if (this.scene) {
                this.scene._nodeRepository[name] = null;
                this.scene._nodeRepository[newName] = this;
            }
            name = newName;
        },

        add : function(node) {
            if (this._inIterating) {
                console.warn('Add operation can cause unpredictable error when in iterating');
            }
            if (node.parent === this) {
                return;
            }
            if (node.parent) {
                node.parent.remove(node);
            }
            node.parent = this;
            this._children.push(node);

            if (this.scene && this.scene !== node.scene) {
                node.traverse(this._addSelfToScene, this);
            }
        },

        remove : function(node) {
            if (this._inIterating) {
                console.warn('Remove operation can cause unpredictable error when in iterating');
            }

            this._children.splice(this._children.indexOf(node), 1);
            node.parent = null;

            if (this.scene) {
                node.traverse(this._removeSelfFromScene, this);
            }
        },

        _removeSelfFromScene : function(descendant) {
            descendant.scene.removeFromScene(descendant);
            descendant.scene = null;
        },

        _addSelfToScene : function(descendant, parent) {
            parent.scene.addToScene(descendant);
            descendant.scene = parent.scene;
        },

        isAscendant : function(node) {
            var parent = node.parent;
            while(parent) {
                if (parent === this) {
                    return true;
                }
                parent = parent.parent;
            }
            return false;
        },

        children : function() {
            return this._children.slice();
        },

        childAt : function(idx) {
            return this._children[idx];
        },

        getChildByName : function(name) {
            for (var i = 0; i < this._children.length; i++) {
                if (this._children[i].name === name) {
                    return this._children[i];
                }
            }
        },

        getDescendantByName : function(name) {
            for (var i = 0; i < this._children.length; i++) {
                var child = this._children[i];
                if (child.name === name) {
                    return child;
                } else {
                    var res = child.getDescendantByName(name);
                    if (res) {
                        return res;
                    }
                }
            }
        },

        // pre-order traverse
        traverse : function(callback, parent, ctor) {
            
            this._inIterating = true;

            if (ctor === undefined || this.constructor === ctor) {
                callback(this, parent);
            }
            var _children = this._children;
            for(var i = 0, len = _children.length; i < len; i++) {
                _children[i].traverse(callback, this, ctor);
            }

            this._inIterating = false;
        },

        setLocalTransform : function(matrix) {
            mat4.copy(this.localTransform._array, matrix._array);
            this.decomposeLocalTransform();
        },

        decomposeLocalTransform : function() {
            this.localTransform.decomposeMatrix(this.scale, this.rotation, this.position);
        },

        setWorldTransform : function(matrix) {
            mat4.copy(this.worldTransform._array, matrix._array);
            this.decomposeWorldTransform();
        },

        decomposeWorldTransform : (function() {
            
            var tmp = mat4.create();

            return function(matrix) {
                // Assume world transform is updated
                if (this.parent) {
                    mat4.invert(tmp, this.parent.worldTransform._array);
                    mat4.multiply(this.localTransform._array, tmp, this.worldTransform._array);
                } else {
                    mat4.copy(this.localTransform._array, matrix._array);
                }
                this.localTransform.decomposeMatrix(this.scale, this.rotation, this.position);
            }
        })(),

        updateLocalTransform : function() {
            var position = this.position;
            var rotation = this.rotation;
            var scale = this.scale;

            if (position._dirty || scale._dirty || rotation._dirty) {
                var m = this.localTransform._array;

                // Transform order, scale->rotation->position
                mat4.fromRotationTranslation(m, rotation._array, position._array);

                mat4.scale(m, m, scale._array);

                rotation._dirty = false;
                scale._dirty = false;
                position._dirty = false;

                this._needsUpdateWorldTransform = true;
            }
        },

        // Update world transform individually
        // Assume its parent world transform have been updated
        updateWorldTransform : function() {
            if (this.parent) {
                mat4.multiply(
                    this.worldTransform._array,
                    this.parent.worldTransform._array,
                    this.localTransform._array
                )
            } else {
                mat4.copy(
                    this.worldTransform._array, this.localTransform._array 
                )
            }
        },

        // Update the node status in each frame
        update : function(force) {
            if (this.autoUpdateLocalTransform) {
                this.updateLocalTransform();
            } else {
                // Transform is manually setted
                force = true;
            }

            if (force || this._needsUpdateWorldTransform) {
                this.updateWorldTransform();
                force = true;
                this._needsUpdateWorldTransform = false;
            }
            
            for(var i = 0, len = this._children.length; i < len; i++) {
                this._children[i].update(force);
            }
        },

        getWorldPosition : function(out) {
            var m = this.worldTransform._array;
            if (out) {
                out._array[0] = m[12];
                out._array[1] = m[13];
                out._array[2] = m[14];
                return out;
            } else {
                return new Vector3(m[12], m[13], m[14]);
            }
        },

        clone : function() {
            // TODO Name
            var node = new this.constructor();
            node.position.copy(this.position);
            node.rotation.copy(this.rotation);
            node.scale.copy(this.scale);

            for (var i = 0; i < this._children.length; i++) {
                node.add(this._children[i].clone());
            }
            return node;
        },

        // http://docs.unity3d.com/Documentation/ScriptReference/Transform.RotateAround.html
        // TODO improve performance
        rotateAround : (function() {
            var v = new Vector3();
            var RTMatrix = new Matrix4();

            return function(point, axis, angle) {

                v.copy(this.position).subtract(point);

                this.localTransform.identity();
                // parent node
                this.localTransform.translate(point);
                this.localTransform.rotate(angle, axis);

                RTMatrix.fromRotationTranslation(this.rotation, v);
                this.localTransform.multiply(RTMatrix);
                this.localTransform.scale(this.scale);

                this.decomposeLocalTransform();
                this._needsUpdateWorldTransform = true;
            }
        })(),

        lookAt : (function() {
            var m = new Matrix4();
            var scaleVector = new Vector3();
            return function(target, up) {
                m.lookAt(this.position, target, up || this.localTransform.up).invert();
                m.decomposeMatrix(scaleVector, this.rotation, this.position);
            }
        })()
    });

    return Node;
})