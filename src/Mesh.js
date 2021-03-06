define(function(require) {

    'use strict';

    var Node = require("./Node");
    var glenum = require("./core/glenum");
    var Vector3 = require("./math/Vector3");
    var StaticGeometry = require('./StaticGeometry');

    // Cache
    var prevDrawID = 0;
    var prevDrawIndicesBuffer = null;
    var prevDrawIsUseFace = true;

    var needsBindAttributes;
    var currentDrawID;

    var RenderInfo = function() {
        this.faceNumber = 0;
        this.vertexNumber = 0;
        this.drawCallNumber = 0;
    }

    function DrawDetail(
        availableAttributes,
        availableAttributeSymbols,
        indicesBuffer
    ) {
        this.availableAttributes = availableAttributes;
        this.availableAttributeSymbols = availableAttributeSymbols;
        this.indicesBuffer = indicesBuffer;
    }

    var Mesh = Node.derive(function() {
        return {
            
            material : null,

            geometry : null,
            
            mode : glenum.TRIANGLES,

            // // Skinned Mesh
            skeleton : null,
            // Joints indices
            // Meshes can share the one skeleton instance
            // and each mesh can use one part of joints
            // Joints indeces indicate the index of joint in the skeleton instance
            joints : [],

            _drawCache : {},

            _renderInfo : new RenderInfo()
        }
    }, {

        visible : true,

        // Only if mode is LINES
        lineWidth : 1,
        
        // Culling
        culling : true,
        cullFace : glenum.BACK,
        frontFace : glenum.CCW,

        // Software frustum culling
        frustumCulling : true,

        receiveShadow : true,
        castShadow : true,

        isRenderable : function() {
            return this.geometry && this.material && this.material.shader && this.visible;
        },

        render : function(_gl, globalMaterial) {
            var material = globalMaterial || this.material;
            var shader = material.shader;
            var geometry = this.geometry;

            var glDrawMode = this.mode;
            
            // Set pose matrices of skinned mesh
            if (this.skeleton) {
                var skinMatricesArray = this.skeleton.getSubSkinMatrices(this.__GUID__, this.joints);
                shader.setUniformBySemantic(_gl, "SKIN_MATRIX", skinMatricesArray);
            }

            var nVertex = geometry.getVertexNumber();
            var renderInfo = this._renderInfo;
            renderInfo.vertexNumber = nVertex;
            renderInfo.faceNumber = 0;
            renderInfo.drawCallNumber = 0;
            // Draw each chunk
            needsBindAttributes = false;
            if (nVertex > geometry.chunkSize) {
                needsBindAttributes = true;
            } else {
                // Hash with shader id in case previous material has less attributes than next material
                currentDrawID = _gl.__GLID__ + '-' + geometry.__GUID__ + '-' + shader.__GUID__;
                if (currentDrawID !== prevDrawID) {
                    needsBindAttributes = true;
                    prevDrawID = currentDrawID;
                }
            }
            if (!needsBindAttributes) {
                // Direct draw
                if (prevDrawIsUseFace) {
                    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, prevDrawIndicesBuffer.buffer);
                    _gl.drawElements(glDrawMode, prevDrawIndicesBuffer.count, _gl.UNSIGNED_SHORT, 0);
                    renderInfo.faceNumber = prevDrawIndicesBuffer.count / 3;
                }
                else {
                    _gl.drawArrays(glDrawMode, 0, nVertex);
                }
                renderInfo.drawCallNumber = 1;
            } else {
                // Use the cache of static geometry
                // TODO : machanism to change to the DynamicGeometry automatically
                // when the geometry is not static any more
                var drawDetails = this._drawCache[currentDrawID];
                if (!drawDetails) {
                    var chunks = geometry.getBufferChunks(_gl);
                    if (!chunks) {  // Empty mesh
                        return;
                    }
                    drawDetails = [];
                    for (var c = 0; c < chunks.length; c++) {
                        var chunk = chunks[c];
                        var attributeBuffers = chunk.attributeBuffers;
                        var indicesBuffer = chunk.indicesBuffer;

                        var availableAttributes = [];
                        var availableAttributeSymbols = [];
                        for (var a = 0; a < attributeBuffers.length; a++) {
                            var attributeBufferInfo = attributeBuffers[a];
                            var name = attributeBufferInfo.name;
                            var semantic = attributeBufferInfo.semantic;

                            if (semantic) {
                                var semanticInfo = shader.attribSemantics[semantic];
                                var symbol = semanticInfo && semanticInfo.symbol;
                            } else {
                                var symbol = name;
                            }
                            if (symbol && shader.attributeTemplates[symbol]) {
                                availableAttributes.push(attributeBufferInfo);
                                availableAttributeSymbols.push(symbol);
                            }
                        }
                        var drawDetail = new DrawDetail(
                            availableAttributes,
                            availableAttributeSymbols,
                            indicesBuffer
                        );
                        drawDetails.push(drawDetail);
                    }
                    if (geometry.hint == glenum.STATIC_DRAW) {
                        this._drawCache[currentDrawID] = drawDetails;
                    }
                }

                for (var i = 0; i < drawDetails.length; i++) {
                    var drawDetail = drawDetails[i];
                    var availableAttributes = drawDetail.availableAttributes;
                    var availableAttributeSymbols = drawDetail.availableAttributeSymbols;
                    var indicesBuffer = drawDetail.indicesBuffer;

                    var locationList = shader.enableAttributes(_gl, availableAttributeSymbols);
                    // Setting attributes;
                    for (var a = 0; a < availableAttributes.length; a++) {
                        var location = locationList[a];
                        if (location === -1) {
                            continue;
                        }
                        var attributeBufferInfo = availableAttributes[a];
                        var buffer = attributeBufferInfo.buffer;
                        var symbol = availableAttributeSymbols[a];
                        var size = attributeBufferInfo.size;
                        var glType;
                        switch (attributeBufferInfo.type) {
                            case "float":
                                glType = _gl.FLOAT;
                                break;
                            case "byte":
                                glType = _gl.BYTE;
                                break;
                            case "ubyte":
                                glType = _gl.UNSIGNED_BYTE;
                                break;
                            case "short":
                                glType = _gl.SHORT;
                                break;
                            case "ushort":
                                glType = _gl.UNSIGNED_SHORT;
                                break;
                            default:
                                glType = _gl.FLOAT;
                                break;
                        }

                        _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
                        _gl.vertexAttribPointer(location, size, glType, false, 0, 0);
                    }
                    
                    if (glDrawMode === glenum.LINES) {
                        _gl.lineWidth(this.lineWidth);
                    }
                    
                    prevDrawIsUseFace = geometry.isUseFace();
                    prevDrawIndicesBuffer = indicesBuffer;
                    //Do drawing
                    if (prevDrawIsUseFace) {
                        _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
                        _gl.drawElements(glDrawMode, indicesBuffer.count, _gl.UNSIGNED_SHORT, 0);
                        renderInfo.faceNumber += indicesBuffer.count / 3;
                    } else {
                        _gl.drawArrays(glDrawMode, 0, nVertex);
                    }
                    renderInfo.drawCallNumber++;
                }
            }

            return renderInfo;
        },

        clone : function() {
            var mesh = Node.prototype.clone.call(this);

            mesh.geometry = this.geometry;
            mesh.material = this.material;

            return mesh;
        }
    });

    Mesh.beforeFrame = function() {
        prevDrawID = 0;
    }

    // Enums
    Mesh.POINTS = glenum.POINTS;
    Mesh.LINES = glenum.LINES;
    Mesh.LINE_LOOP = glenum.LINE_LOOP;
    Mesh.LINE_STRIP = glenum.LINE_STRIP;
    Mesh.TRIANGLES = glenum.TRIANGLES;
    Mesh.TRIANGLE_STRIP = glenum.TRIANGLE_STRIP;
    Mesh.TRIANGLE_FAN = glenum.TRIANGLE_FAN;

    Mesh.BACK = glenum.BACK;
    Mesh.FRONT = glenum.FRONT;
    Mesh.FRONT_AND_BACK = glenum.FRONT_AND_BACK;
    Mesh.CW = glenum.CW;
    Mesh.CCW = glenum.CCW;

    Mesh.RenderInfo = RenderInfo;

    return Mesh;
})