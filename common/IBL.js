define(function(require) {
    
    var qtek = require('qtek');
    var qtek3d = qtek['3d'];

    qtek3d.Shader.import(require('text!./shader/IBL.essl'));

    var IBL = function(renderer, envMap, callback) {
        var self = this;
        this.renderer = renderer;
        this.envMap = envMap;
        this.normalDistribution = this.generateNormalDistribution();
        this.BRDFLookup = this.integrateBRDF();
        if (this.envMap) {
            this.prefilterEnvMap(this.envMap, function(mipmaps) {
                self.mipmaps = mipmaps;
                callback && callback();
            });
        }
    }
    IBL.prototype = {
        generateNormalDistribution : function() {
            // http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
            // GLSL not support bit operation, use lookup instead
            // V -> i / N, U -> roughness
            var ROUGHNESS_LEVELS = 256;
            var SAMPLE_SIZE = 1024;

            var normalDistribution = new qtek3d.texture.Texture2D({
                width : ROUGHNESS_LEVELS,
                height : SAMPLE_SIZE,
                type : qtek3d.Texture.FLOAT,
                minFilter : qtek3d.Texture.NEAREST,
                magFilter : qtek3d.Texture.NEAREST,
                useMipmap : false
            });
            var pixels = new Float32Array(SAMPLE_SIZE * ROUGHNESS_LEVELS * 4);
            for (var i = 0; i < SAMPLE_SIZE; i++) {
                var x = i / SAMPLE_SIZE;
                // http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators
                // http://stackoverflow.com/questions/1908492/unsigned-integer-in-javascript
                // http://stackoverflow.com/questions/1822350/what-is-the-javascript-operator-and-how-do-you-use-it
                var y = (i << 16 | i >>> 16) >>> 0;
                y = ((y & 1431655765) << 1 | (y & 2863311530) >>> 1) >>> 0;
                y = ((y & 858993459) << 2 | (y & 3435973836) >>> 2) >>> 0;
                y = ((y & 252645135) << 4 | (y & 4042322160) >>> 4) >>> 0;
                y = (((y & 16711935) << 8 | (y & 4278255360) >>> 8) >>> 0) / 4294967296;

                for (var j = 0; j < ROUGHNESS_LEVELS; j++) {
                    var roughness = j / ROUGHNESS_LEVELS;
                    var a = roughness * roughness;
                    var phi = 2.0 * Math.PI * x;
                    // CDF
                    var cosTheta = Math.sqrt((1 - y) / (1 + (a*a - 1.0) * y));
                    var sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);
                    var offset = (i * ROUGHNESS_LEVELS + j) * 4;
                    pixels[offset] = sinTheta * Math.cos(phi);
                    pixels[offset+1] = sinTheta * Math.sin(phi);
                    pixels[offset+2] = cosTheta;
                    pixels[offset+3] = 1.0;
                }
            }
            normalDistribution.pixels = pixels;

            return normalDistribution;
        },


        integrateBRDF : function() {
            var frameBuffer = new qtek3d.FrameBuffer();
            var pass = new qtek3d.compositor.Pass({
                fragment : qtek3d.Shader.source('IBL.integrate_BRDF')
            });

            var texture = new qtek3d.texture.Texture2D({
                width : 512,
                height : 256,
                type : qtek3d.Texture.FLOAT,
                minFilter : qtek3d.Texture.NEAREST,
                magFilter : qtek3d.Texture.NEAREST,
                useMipmap : false
            });
            pass.setUniform('normalDistribution', this.normalDistribution);
            pass.setUniform('viewportSize', [512, 256]);
            pass.attachOutput(texture);
            pass.render(this.renderer, frameBuffer);

            return texture;
        },
        
        prefilterEnvMap : function(envMap, callback) {
            var mipmaps = [];
            var self = this;
            var size = envMap.image.px ? envMap.image.px.width : envMap.width;
            var mipmapNum = Math.log(size) / Math.log(2);
            var emptyScene = new qtek3d.Scene();
            var skybox = new qtek3d.plugin.Skybox({
                scene : emptyScene
            });
            var environmentMapPass = new qtek3d.prePass.EnvironmentMap();

            skybox.material.attachShader(new qtek3d.Shader({
                vertex : qtek3d.Shader.source('buildin.skybox.vertex'),
                fragment : qtek3d.Shader.source('IBL.prefilter_envmap')
            }));
            skybox.material.set('environmentMap', envMap);
            skybox.material.set('normalDistribution', this.normalDistribution);
            mipmaps[0] = envMap;

            var mipmapLevel = 1;

            function onFrame() {

                if (size > 1) {
                    size /= 2;
                    roughness = mipmapLevel / mipmapNum;
                    skybox.material.set('roughness', roughness);
                    var mipmap = new qtek3d.texture.TextureCube({
                        useMipmap : false,
                        width : Math.max(size, 16),
                        height : Math.max(size, 16),
                        // type : qtek3d.Texture.FLOAT
                    });
                    mipmaps[mipmapLevel++] = mipmap;
                    environmentMapPass.texture = mipmap;
                    environmentMapPass.render(self.renderer, emptyScene);

                    setTimeout(onFrame, 20);
                } else {
                    callback && callback(mipmaps);
                }
            }

            setTimeout(onFrame, 20);
        },

        applyToMaterial : function(material, roughness) {
            var mipmaps = this.mipmaps;
            var lodLevel = Math.floor(roughness * (mipmaps.length-1));
            material.set('BRDFLookup', this.BRDFLookup);
            material.set('environmentMap1', mipmaps[lodLevel]);
            material.set('environmentMap2', mipmaps[lodLevel+1] || mipmaps[mipmaps.length - 1]);
            material.set('lodLevel', lodLevel / (mipmaps.length-1));
            material.set('roughness', roughness);
        }
    }

    return IBL;
});