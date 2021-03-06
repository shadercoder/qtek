define(function(require) {

    var Base = require("./core/Base");
    var util = require("./core/util");
    var Light = require("./Light");
    var Mesh = require("./Mesh");
    var Texture = require("./Texture");
    var glinfo = require('./core/glinfo');
    var glenum = require('./core/glenum');
    var BoundingBox = require('./math/BoundingBox');
    var Matrix4 = require('./math/Matrix4');
    var Shader = require('./Shader');
    var shaderLibrary = require('./shader/library');
    var Material = require('./Material');
    var Vector3 = require('./math/Vector3');
    var Vector2 = require('./math/Vector2');

    var glMatrix = require("glmatrix");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var vec4 = glMatrix.vec4;

    var glid = 0;

    var preZPassShader = shaderLibrary.get('buildin.prez');
    var preZPassMaterial = new Material({
        shader : preZPassShader
    });

    var Renderer = Base.derive(function() {
        return {

            canvas : null,
            width : 100,
            height : 100,
            // Device Pixel Ratio is for high defination disply
            // like retina display
            // http://www.khronos.org/webgl/wiki/HandlingHighDPI
            devicePixelRatio : window.devicePixelRatio || 1.0,

            color : [0.0, 0.0, 0.0, 0.0],
            
            // _gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT | _gl.STENCIL_BUFFER_BIT
            clear : 17664,  

            // Settings when getting context
            // http://www.khronos.org/registry/webgl/specs/latest/#2.4
            alhpa : true,
            depth : true,
            stencil : false,
            antialias : true,
            premultipliedAlpha : true,
            preserveDrawingBuffer : false,

            gl : null,

            viewport : {},

            _viewportSettings : [],
            _clearSettings : [],

            _sceneRendering : null
        }
    }, function() {

        if (! this.canvas) {
            this.canvas = document.createElement("canvas");
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        try {
            this.gl = this.canvas.getContext('experimental-webgl', {
                alhpa : this.alhpa,
                depth : this.depth,
                stencil : this.stencil,
                antialias : this.antialias,
                premultipliedAlpha : this.premultipliedAlpha,
                preserveDrawingBuffer : this.preserveDrawingBuffer,
            });
            this.gl.__GLID__ = glid++;

            this.width = this.canvas.width; 
            this.height = this.canvas.height;
            this.resize(this.width, this.height);

            glinfo.initialize(this.gl);
        }
        catch(e) {
            throw "Error creating WebGL Context";
        }
    }, {

        resize : function(width, height) {
            var canvas = this.canvas;
            // http://www.khronos.org/webgl/wiki/HandlingHighDPI
            // set the display size of the canvas.
            // if (this.devicePixelRatio !== 1.0) {
                canvas.style.width = width + "px";
                canvas.style.height = height + "px";
            // }
             
            // set the size of the drawingBuffer
            canvas.width = width * this.devicePixelRatio;
            canvas.height = height * this.devicePixelRatio;

            this.width = width;
            this.height = height;

            this.setViewport(0, 0, canvas.width, canvas.height);
        },

        setDevicePixelRatio : function(devicePixelRatio) {
            this.devicePixelRatio = devicePixelRatio;
            this.resize(this.width, this.height);
        },

        setViewport : function(x, y, width, height) {

            if (typeof(x) === "object") {
                var obj = x;
                x = obj.x;
                y = obj.y;
                width = obj.width;
                height = obj.height;
            }
            this.gl.viewport(x, y, width, height);

            this.viewport = {
                x : x,
                y : y,
                width : width,
                height : height
            }
        },

        saveViewport : function() {
            this._viewportSettings.push(this.viewport);
        },

        restoreViewport : function() {
            if (this._viewportSettings.length > 0) {
                this.setViewport(this._viewportSettings.pop());
            }
        },

        saveClear : function() {
            this._clearSettings.push(this.clear);
        },

        restoreClear : function() {
            if (this._clearSettings.length > 0) {
                this.clear = this._clearSettings.pop();   
            }
        },

        render : function(scene, camera, notUpdateScene, preZ) {
            var _gl = this.gl;

            this._sceneRendering = scene;

            var color = this.color;
            _gl.clearColor(color[0], color[1], color[2], color[3]);
            _gl.clear(this.clear);

            // If the scene have been updated in the prepass like shadow map
            // There is no need to update it again
            if (!notUpdateScene) {
                scene.update(false);
            }
            if (!camera.scene) {
                camera.update(true);
            }

            var opaqueQueue = scene.opaqueQueue;
            var transparentQueue = scene.transparentQueue;
            var sceneMaterial = scene.material;

            scene.trigger('beforerender', this, scene, camera);
            // Sort render queue
            // Calculate the object depth
            if (transparentQueue.length > 0) {
                var worldViewMat = mat4.create();
                var posViewSpace = vec3.create();
                for (var i = 0; i < transparentQueue.length; i++) {
                    var node = transparentQueue[i];
                    mat4.multiply(worldViewMat, camera.viewMatrix._array, node.worldTransform._array);
                    vec3.transformMat4(posViewSpace, node.position._array, worldViewMat);
                    node.__depth = posViewSpace[2];
                }
            }
            opaqueQueue.sort(Renderer.opaqueSortFunc);
            transparentQueue.sort(Renderer.transparentSortFunc);

            // Render Opaque queue
            scene.trigger("beforerender:opaque", this, opaqueQueue);

            // Reset the scene bounding box;
            camera.sceneBoundingBoxLastFrame.min.set(Infinity, Infinity, Infinity);
            camera.sceneBoundingBoxLastFrame.max.set(-Infinity, -Infinity, -Infinity);

            _gl.disable(_gl.BLEND);
            _gl.enable(_gl.DEPTH_TEST);
            var opaqueRenderInfo = this.renderQueue(opaqueQueue, camera, sceneMaterial, preZ);

            scene.trigger("afterrender:opaque", this, opaqueQueue, opaqueRenderInfo);
            scene.trigger("beforerender:transparent", this, transparentQueue);

            // Render Transparent Queue
            _gl.enable(_gl.BLEND);
            var transparentRenderInfo = this.renderQueue(transparentQueue, camera, sceneMaterial);

            scene.trigger("afterrender:transparent", this, transparentQueue, transparentRenderInfo);
            var renderInfo = {}
            for (name in opaqueRenderInfo) {
                renderInfo[name] = opaqueRenderInfo[name] + transparentRenderInfo[name];
            }

            scene.trigger('afterrender', this, scene, camera, renderInfo);
            return renderInfo;
        },

        renderQueue : function(queue, camera, globalMaterial, preZ) {
            var renderInfo = {
                faceNumber : 0,
                vertexNumber : 0,
                drawCallNumber : 0,
                meshNumber : 0
            };

            // Calculate view and projection matrix
            mat4.copy(matrices.VIEW, camera.viewMatrix._array);
            mat4.copy(matrices.PROJECTION, camera.projectionMatrix._array);
            mat4.multiply(matrices.VIEWPROJECTION, camera.projectionMatrix._array, matrices.VIEW);
            mat4.copy(matrices.VIEWINVERSE, camera.worldTransform._array);
            mat4.invert(matrices.PROJECTIONINVERSE, matrices.PROJECTION);
            mat4.invert(matrices.VIEWPROJECTIONINVERSE, matrices.VIEWPROJECTION);

            var _gl = this.gl;
            var scene = this._sceneRendering;
            
            var prevMaterialID;
            var prevShaderID;
                
            // Status 
            var depthTest, depthMask;
            var culling, cullFace, frontFace;

            var culledRenderQueue;
            if (preZ) {
                culledRenderQueue = [];
                preZPassShader.bind(_gl);
                _gl.colorMask(false, false, false, false);
                _gl.depthMask(true);
                for (var i = 0; i < queue.length; i++) {
                    var renderable = queue[i];
                    var worldM = renderable.worldTransform._array;
                    var geometry = renderable.geometry;
                    mat4.multiply(matrices.WORLDVIEW, matrices.VIEW , worldM);
                    mat4.multiply(matrices.WORLDVIEWPROJECTION, matrices.VIEWPROJECTION , worldM);

                    if (geometry.boundingBox) {
                        if (!this._frustumCulling(renderable, camera)) {
                            continue;
                        }
                    }
                    if (renderable.skeleton) {  // Skip skinned mesh
                        continue;
                    }
                    if (renderable.cullFace !== cullFace) {
                        cullFace = renderable.cullFace;
                        _gl.cullFace(cullFace);
                    }
                    if (renderable.frontFace !== frontFace) {
                        frontFace = renderable.frontFace;
                        _gl.frontFace(frontFace);
                    }
                    if (renderable.culling !== culling) {
                        culling = renderable.culling;
                        culling ? _gl.enable(_gl.CULL_FACE) : _gl.disable(_gl.CULL_FACE)
                    }

                    var semanticInfo = preZPassShader.matrixSemantics.WORLDVIEWPROJECTION;
                    preZPassShader.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, matrices.WORLDVIEWPROJECTION);
                    renderable.render(_gl, preZPassMaterial);
                    culledRenderQueue.push(renderable);
                }
                _gl.depthFunc(_gl.LEQUAL);
                _gl.colorMask(true, true, true, true);
                _gl.depthMask(false);
            } else {
                culledRenderQueue = queue;
            }

            for (var i =0; i < culledRenderQueue.length; i++) {
                var renderable = culledRenderQueue[i];
                var material = globalMaterial || renderable.material;
                var shader = material.shader;
                var geometry = renderable.geometry;

                var worldM = renderable.worldTransform._array;
                // All matrices ralated to world matrix will be updated on demand;
                mat4.copy(matrices.WORLD, worldM);
                mat4.multiply(matrices.WORLDVIEW, matrices.VIEW , worldM);
                mat4.multiply(matrices.WORLDVIEWPROJECTION, matrices.VIEWPROJECTION , worldM);
                if (shader.matrixSemantics.WORLDINVERSE ||
                    shader.matrixSemantics.WORLDINVERSETRANSPOSE) {
                    mat4.invert(matrices.WORLDINVERSE, worldM);
                }
                if (shader.matrixSemantics.WORLDVIEWINVERSE ||
                    shader.matrixSemantics.WORLDVIEWINVERSETRANSPOSE) {
                    mat4.invert(matrices.WORLDVIEWINVERSE, matrices.WORLDVIEW);
                }
                if (shader.matrixSemantics.WORLDVIEWPROJECTIONINVERSE ||
                    shader.matrixSemantics.WORLDVIEWPROJECTIONINVERSETRANSPOSE) {
                    mat4.invert(matrices.WORLDVIEWPROJECTIONINVERSE, matrices.WORLDVIEWPROJECTION);
                }
                if (geometry.boundingBox && ! preZ) {
                    if (!this._frustumCulling(renderable, camera)) {
                        continue;
                    }
                }

                if (prevShaderID !== shader.__GUID__) {
                    // Set lights number
                    if (scene && scene.isShaderLightNumberChanged(shader)) {
                        scene.setShaderLightNumber(shader);
                    }

                    shader.bind(_gl);

                    // Set lights uniforms
                    // TODO needs optimized
                    if (scene) {
                        for (var symbol in scene.lightUniforms) {
                            var lu = scene.lightUniforms[symbol];
                            shader.setUniform(_gl, lu.type, symbol, lu.value);
                        }
                    }
                    prevShaderID = shader.__GUID__;
                }
                if (prevMaterialID !== material.__GUID__) {
                    if (!preZ) {
                        if (material.depthTest !== depthTest) {
                            material.depthTest ? 
                                _gl.enable(_gl.DEPTH_TEST) : 
                                _gl.disable(_gl.DEPTH_TEST);
                            depthTest = material.depthTest;
                        }
                        if (material.depthMask !== depthMask) {
                            _gl.depthMask(material.depthMask);
                            depthMask = material.depthMask;
                        }
                    }
                    material.bind(_gl);
                    prevMaterialID = material.__GUID__;

                    if (material.transparent) {
                        if (material.blend) {
                            material.blend(_gl);
                        } else {    // Default blend function
                            _gl.blendEquationSeparate(_gl.FUNC_ADD, _gl.FUNC_ADD);
                            _gl.blendFuncSeparate(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA, _gl.ONE, _gl.ONE_MINUS_SRC_ALPHA);
                        } 
                    }
                }

                var matrixSemanticKeys = shader.matrixSemanticKeys;
                for (var k = 0; k < matrixSemanticKeys.length; k++) {
                    var semantic = matrixSemanticKeys[k];
                    var semanticInfo = shader.matrixSemantics[semantic];
                    var matrix = matrices[semantic];
                    if (semanticInfo.isTranspose) {
                        var matrixNoTranspose = matrices[semanticInfo.semanticNoTranspose];
                        mat4.transpose(matrix, matrixNoTranspose);
                    }
                    shader.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, matrix);
                }

                if (renderable.cullFace !== cullFace) {
                    cullFace = renderable.cullFace;
                    _gl.cullFace(cullFace);
                }
                if (renderable.frontFace !== frontFace) {
                    frontFace = renderable.frontFace;
                    _gl.frontFace(frontFace);
                }
                if (renderable.culling !== culling) {
                    culling = renderable.culling;
                    culling ? _gl.enable(_gl.CULL_FACE) : _gl.disable(_gl.CULL_FACE)
                }

                var objectRenderInfo = renderable.render(_gl, globalMaterial);

                if (objectRenderInfo) {
                    renderInfo.faceNumber += objectRenderInfo.faceNumber;
                    renderInfo.vertexNumber += objectRenderInfo.vertexNumber;
                    renderInfo.drawCallNumber += objectRenderInfo.drawCallNumber;
                    renderInfo.meshNumber ++;
                }
            }

            return renderInfo;
        },

        _frustumCulling : (function() {
            // Frustum culling
            // http://www.cse.chalmers.se/~uffe/vfc_bbox.pdf
            var cullingBoundingBox = new BoundingBox();
            var cullingMatrix = new Matrix4();
            return function(renderable, camera) {
                var geoBBox = renderable.geometry.boundingBox;
                cullingMatrix._array = matrices.WORLDVIEW;
                cullingBoundingBox.copy(geoBBox);
                cullingBoundingBox.applyTransform(cullingMatrix);

                // Passingly update the scene bounding box
                // TODO : exclude very large mesh like ground plane or terrain ?
                camera.sceneBoundingBoxLastFrame.union(cullingBoundingBox);

                if (renderable.frustumCulling)  {
                    if (!cullingBoundingBox.intersectBoundingBox(camera.frustum.boundingBox)) {
                        return false;
                    }

                    cullingMatrix._array = matrices.PROJECTION;
                    if (
                        cullingBoundingBox.max._array[2] > 0 &&
                        cullingBoundingBox.min._array[2] < 0
                    ) {
                        // Clip in the near plane
                        cullingBoundingBox.max._array[2] = -1e-20;
                    }
                    
                    cullingBoundingBox.applyProjection(cullingMatrix);

                    var min = cullingBoundingBox.min._array;
                    var max = cullingBoundingBox.max._array;
                    
                    if (
                        max[0] < -1 || min[0] > 1
                        || max[1] < -1 || min[1] > 1
                        || max[2] < -1 || min[2] > 1
                    ) {
                        return false;
                    }   
                }
                return true;
            }
        })(),

        disposeScene : function(scene) {
            this.disposeNode(scene);
            scene.dispose();
        },

        disposeNode : function(root) {
            var materials = {};
            var _gl = this.gl;

            root.traverse(function(node) {
                if (node.geometry) {
                    node.geometry.dispose(_gl);
                }
                if (node.material) {
                    materials[node.material.__GUID__] = node.material;
                }
                if (node.dispose) {
                    node.dispose(_gl);
                }
            });
            for (var guid in materials) {
                var mat = materials[guid];
                mat.shader.dispose(_gl);
                for (var name in mat.uniforms) {
                    var val = mat.uniforms[name].value;
                    if (!val ) {
                        continue;
                    }
                    if (val instanceof Texture) {
                        val.dispose(_gl);
                    }
                    else if (val instanceof Array) {
                        for (var i = 0; i < val.length; i++) {
                            if (val[i] instanceof Texture) {
                                val[i].dispose(_gl);
                            }
                        }
                    }
                }
            }
            root._children = [];
        },

        disposeShader : function(shader) {
            shader.dispose(this.gl);
        },

        disposeGeometry : function(geometry) {
            geometry.dispose(this.gl);
        },

        disposeTexture : function(texture) {
            texture.dispose(this.gl);
        },

        disposeFrameBuffer : function(frameBuffer) {
            frameBuffer.dispose(this.gl);
        },

        screenToNdc : function(x, y, out) {
            if (!out) {
                out = new Vector2();
            }
            // Invert y;
            y = this.height - y;

            out._array[0] = (x - this.viewport.x) / this.viewport.width;
            out._array[0] = out._array[0] * 2 - 1;
            out._array[1] = (y - this.viewport.y) / this.viewport.height;
            out._array[1] = out._array[1] * 2 - 1;

            return out;
        }
    })

    Renderer.opaqueSortFunc = function(x, y) {
        // Priority shader -> material -> geometry
        if (x.material.shader === y.material.shader) {
            if (x.material === y.material) {
                return x.geometry.__GUID__ - y.geometry.__GUID__;
            }
            return x.material.__GUID__ - y.material.__GUID__;
        }
        return x.material.shader.__GUID__ - y.material.shader.__GUID__;
    }
    Renderer.transparentSortFunc = function(x, y) {
        // Priority depth -> shader -> material -> geometry
        if (x.__depth === y.__depth) {
            if (x.material.shader === y.material.shader) {
                if (x.material === y.material) {
                    return x.geometry.__GUID__ - y.geometry.__GUID__;
                }
                return x.material.__GUID__ - y.material.__GUID__;
            }
            return x.material.shader.__GUID__ - y.material.shader.__GUID__;
        }
        // Depth is negative
        // So farther object has smaller depth value
        return x.__depth - y.__depth
    }

    // Temporary variables
    var matrices = {
        'WORLD' : mat4.create(),
        'VIEW' : mat4.create(),
        'PROJECTION' : mat4.create(),
        'WORLDVIEW' : mat4.create(),
        'VIEWPROJECTION' : mat4.create(),
        'WORLDVIEWPROJECTION' : mat4.create(),

        'WORLDINVERSE' : mat4.create(),
        'VIEWINVERSE' : mat4.create(),
        'PROJECTIONINVERSE' : mat4.create(),
        'WORLDVIEWINVERSE' : mat4.create(),
        'VIEWPROJECTIONINVERSE' : mat4.create(),
        'WORLDVIEWPROJECTIONINVERSE' : mat4.create(),

        'WORLDTRANSPOSE' : mat4.create(),
        'VIEWTRANSPOSE' : mat4.create(),
        'PROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDVIEWTRANSPOSE' : mat4.create(),
        'VIEWPROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDVIEWPROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDINVERSETRANSPOSE' : mat4.create(),
        'VIEWINVERSETRANSPOSE' : mat4.create(),
        'PROJECTIONINVERSETRANSPOSE' : mat4.create(),
        'WORLDVIEWINVERSETRANSPOSE' : mat4.create(),
        'VIEWPROJECTIONINVERSETRANSPOSE' : mat4.create(),
        'WORLDVIEWPROJECTIONINVERSETRANSPOSE' : mat4.create()
    };

    Renderer.COLOR_BUFFER_BIT = glenum.COLOR_BUFFER_BIT
    Renderer.DEPTH_BUFFER_BIT = glenum.DEPTH_BUFFER_BIT
    Renderer.STENCIL_BUFFER_BIT = glenum.STENCIL_BUFFER_BIT

    return Renderer;
})