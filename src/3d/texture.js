/**
 * Base class for all textures like compressed texture, texture2d, texturecube
 * TODO mapping
 */
define(function(require) {

    var Base = require("core/base"),
        _ = require("_");

    var Texture = Base.derive(function() {

        return {

            // Width and height is used when the image is null and want
            // to use it as a texture attach to framebuffer(RTT)
            width : 512,
            height : 512,

            // UNSIGNED_BYTE 
            // FLOAT
            type : 'UNSIGNED_BYTE',
            // ALPHA
            // RGB
            // RGBA
            // LUMINANCE
            // LUMINANCE_ALPHA
            format : 'RGBA',
            // 'CLAMP_TO_EDGE'
            // 'REPEAT'
            // 'MIRRORED_REPEAT'
            wrapS : 'CLAMP_TO_EDGE',
            wrapT : 'CLAMP_TO_EDGE',
            // Texture min and mag filter
            // http://www.khronos.org/registry/gles/specs/2.0/es_full_spec_2.0.25.pdf
            // NEAREST
            // LINEAR
            // NEAREST_MIPMAP_NEAREST
            // NEAREST_MIPMAP_LINEAR
            // LINEAR_MIPMAP_NEAREST
            // LINEAR_MIPMAP_LINEAR
            minFilter : 'LINEAR_MIPMAP_LINEAR',
            // NEARST
            // LINEAR
            magFilter : 'LINEAR',

            useMipmap : true,

            // http://blog.tojicode.com/2012/03/anisotropic-filtering-in-webgl.html
            anisotropic : 1,
            // pixelStorei parameters
            // http://www.khronos.org/opengles/sdk/docs/man/xhtml/glPixelStorei.xml
            flipY : true,
            unpackAlignment : 4,
            premultiplyAlpha : false,

            // Dynamic option for texture like video
            dynamic : false,

            NPOT : false
        }
    }, {

        getWebGLTexture : function(_gl) {

            this.cache.use(_gl.__GUID__);

            if (this.cache.miss("webgl_texture")) {
                // In a new gl context, create new texture and set dirty true
                this.cache.put("webgl_texture", _gl.createTexture());
            }
            if (this.dynamic) {
                this.update(_gl);
            }
            else if (this.cache.isDirty()) {
                this.update(_gl);
                this.cache.fresh();
            }

            return this.cache.get("webgl_texture");
        },

        bind : function() {},
        unbind : function() {},
        
        // Overwrite the dirty method
        dirty : function() {
            this.cache.dirtyAll();
        },

        update : function(_gl) {},

        // Update the common parameters of texture
        beforeUpdate : function(_gl) {
            _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
            _gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
            _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, this.unpackAlignment);

            this.fallBack();
        },

        fallBack : function() {

            // Use of none-power of two texture
            // http://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences
            
            var isPowerOfTwo = this.isPowerOfTwo();

            if (this.format === "DEPTH_COMPONENT") {
                this.useMipmap = false;
            }

            if (! isPowerOfTwo || ! this.useMipmap) {
                // none-power of two flag
                this.NPOT = true;
                // Save the original value for restore
                this._minFilterOriginal = this.minFilter;
                this._magFilterOriginal = this.magFilter;
                this._wrapSOriginal = this.wrapS;
                this._wrapTOriginal = this.wrapT;

                if (this.minFilter.indexOf("NEAREST") == 0) {
                    this.minFilter = 'NEAREST';
                } else {
                    this.minFilter = 'LINEAR'
                }

                if (this.magFilter.indexOf("NEAREST") == 0) {
                    this.magFilter = 'NEAREST';
                } else {
                    this.magFilter = 'LINEAR'
                }

                this.wrapS = 'CLAMP_TO_EDGE';
                this.wrapT = 'CLAMP_TO_EDGE';
            } else {
                if (this._minFilterOriginal) {
                    this.minFilter = this._minFilterOriginal;
                }
                if (this._magFilterOriginal) {
                    this.magFilter = this._magFilterOriginal;
                }
                if (this._wrapSOriginal) {
                    this.wrapS = this._wrapSOriginal;
                }
                if (this._wrapTOriginal) {
                    this.wrapT = this._wrapTOriginal;
                }
            }

        },

        nextHighestPowerOfTwo : function(x) {
            --x;
            for (var i = 1; i < 32; i <<= 1) {
                x = x | x >> i;
            }
            return x + 1;
        },

        dispose : function(_gl) {
            this.cache.use(_gl.__GUID__);
            _gl.deleteTexture(this.cache.get("webgl_texture"));
        },

        isRenderable : function() {},
        
        isPowerOfTwo : function() {},
    })

    return Texture;
})