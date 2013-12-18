define(function(require) {
    
    var qtek = require('qtek');
    var qtek3d = qtek['3d'];

    qtek3d.Shader.import(require('text!./shader/IBL.essl'));
    var environmentMapPass = new qtek3d.prePass.EnvironmentMap();

    var animation = new qtek.animation.Animation();
    animation.start();

    var IBL = function(renderer, envMap, callback) {
        var self = this;
        this.renderer = renderer;
        this.normalDistribution = this.generateNormalDistribution();
        this.BRDFLookup = this.integrateBRDF();
        this.materials = [];
        this.mipmaps = [];

        this.environmentMap = null;
        this.diffuseEnvMap = null;
        this.downSampledEnvMap = null;
        this.downSampledEnvMap2 = null;
        if (envMap) {
            this.init(envMap, callback);
        }
    }
    IBL.prototype = {
        init : function(envMap, callback) {

            if (envMap instanceof qtek3d.texture.Texture2D) {
                this.environmentMap = this.panoramaToCubeMap(envMap);
                this.update(callback);
            } else if (envMap instanceof qtek3d.texture.TextureCube) {
                this.environmentMap = envMap;
                this.update(callback);
            } else if (typeof(envMap) === 'string') {
                var self = this;
                if (envMap.substr(-3) === 'hdr') {
                    qtek.core.request.get({
                        url : envMap,
                        responseType : 'arraybuffer',
                        onload : function(data) {
                            var texture = qtek3d.util.hdr.parseRGBE(data, null, 2.0);
                            texture.flipY = false;
                            self.environmentMap = self.panoramaToCubeMap(texture);
                            self.update(callback);
                        }
                    });
                }
            }
        },

        update : function(callback) {
            var _gl = this.renderer.gl;
            var self = this;
            if (this.downSampledEnvMap) {
                this.downSampledEnvMap.dispose(_gl);
                this.downSampledEnvMap2.dispose(_gl);
                this.diffuseEnvMap.dispose(_gl);
                for (var i = 0; i < this.mipmaps.length; i++) {
                    this.mipmaps[i].dispose(_gl);
                }
            }

            this.downSample();
            this.convolveDiffuseEnvMap();

            if (this.environmentMap) {
                this.prefilterSpecularEnvMap(function(mipmaps) {
                    self.mipmaps = mipmaps;
                    self.updateMaterials();
                    callback && callback();
                });
            }
        },

        updateMaterials : function() {
            for (var i = 0; i < this.materials.length; i++) {
                var material = this.materials[i];
                var roughness = material.get('roughness');
                var mipmaps = this.mipmaps;
                var lodLevel = Math.floor(roughness * (mipmaps.length-1));
                material.set('BRDFLookup', this.BRDFLookup);
                material.set('diffuseEnvMap', this.diffuseEnvMap);
                material.set('specularEnvMap1', mipmaps[lodLevel]);
                material.set('specularEnvMap2', mipmaps[lodLevel+1] || mipmaps[mipmaps.length - 1]);
                material.set('lodLevel', lodLevel / (mipmaps.length-1));
            }
        },

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

        panoramaToCubeMap : function(panoramaMap) {
            var skydome = new qtek3d.plugin.Skydome({
                scene : new qtek3d.Scene
            });
            skydome.material.set('diffuseMap', panoramaMap);
            var cubeMap = new qtek3d.texture.TextureCube({
                width : 512,
                height : 512,
                type : qtek3d.Texture.FLOAT
            });
            environmentMapPass.texture = cubeMap;
            environmentMapPass.render(this.renderer, skydome.scene);

            return cubeMap;
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

        // Down sample to 32x32
        downSample : function() {
            console.log('Down sample');
            this.downSampledEnvMap = new qtek3d.texture.TextureCube({
                width : 128,
                height : 128,
                type : qtek3d.Texture.FLOAT
            });
            this.downSampledEnvMap2 = new qtek3d.texture.TextureCube({
                width : 16,
                height : 16,
                type : qtek3d.Texture.FLOAT
            });

            var skybox = new qtek3d.plugin.Skybox({
                scene : new qtek3d.Scene()
            })
            skybox.material.set('environmentMap', this.environmentMap);
            environmentMapPass.texture = this.downSampledEnvMap;
            environmentMapPass.render(this.renderer, skybox.scene);
            environmentMapPass.texture = this.downSampledEnvMap2;
            environmentMapPass.render(this.renderer, skybox.scene);
            console.log('Down sample done!');
        },

        convolveDiffuseEnvMap : function() {
            console.log('Convolve diffuse environment map');
            this.diffuseEnvMap = new qtek3d.texture.TextureCube({
                width : 16,
                height : 16,
                type : qtek3d.Texture.FLOAT
            });
            var skybox = new qtek3d.plugin.Skybox({
                scene : new qtek3d.Scene()
            })
            skybox.material.attachShader(new qtek3d.Shader({
                vertex : qtek3d.Shader.source('buildin.skybox.vertex'),
                fragment : qtek3d.Shader.source('IBL.diffuse_convolution')
            }));
            skybox.material.set('environmentMap', this.downSampledEnvMap2);
            environmentMapPass.texture = this.diffuseEnvMap;
            environmentMapPass.render(this.renderer, skybox.scene);
            console.log('Convolve diffuse environment map done!');
            return this.diffuseEnvMap;
        },
        
        prefilterSpecularEnvMap : function(callback) {
            var mipmaps = [];
            var self = this;
            var envMap = this.downSampledEnvMap;
            var size = envMap.image.px ? envMap.image.px.width : envMap.width;
            var mipmapNum = Math.log(size) / Math.log(2);

            var emptyScene = new qtek3d.Scene();
            var skybox = new qtek3d.plugin.Skybox({
                scene : emptyScene
            });
            skybox.material.attachShader(new qtek3d.Shader({
                vertex : qtek3d.Shader.source('buildin.skybox.vertex'),
                fragment : qtek3d.Shader.source('IBL.prefilter_envmap')
            }));
            skybox.material.set('environmentMap', envMap);
            skybox.material.set('normalDistribution', this.normalDistribution);
            mipmaps[0] = envMap;

            var mipmapLevel = 1;

            animation.off('frame');
            console.log('Prefilter specular map');
            function onFrame() {

                if (size > 1) {
                    size /= 2;
                    roughness = mipmapLevel / mipmapNum;
                    skybox.material.set('roughness', roughness);
                    var mipmap = new qtek3d.texture.TextureCube({
                        useMipmap : false,
                        // TODO : Edge fixup when cube map has resolution 1,2,4
                        width : size,
                        height : size,
                        type : qtek3d.Texture.FLOAT,
                        minFilter : qtek3d.Texture.LINEAR
                    });
                    mipmaps[mipmapLevel++] = mipmap;
                    environmentMapPass.texture = mipmap;
                    environmentMapPass.render(self.renderer, emptyScene);
                } else {

                    console.log('Prefilter specular map done!');
                    animation.off('frame');
                    callback && callback(mipmaps);
                }
            }

            animation.on('frame', onFrame);
        },

        applyToMaterial : function(material, roughness) {
            var mipmaps = this.mipmaps;
            var lodLevel = Math.floor(roughness * (mipmaps.length-1));
            material.set('BRDFLookup', this.BRDFLookup);
            material.set('diffuseEnvMap', this.diffuseEnvMap);
            material.set('specularEnvMap1', mipmaps[lodLevel]);
            material.set('specularEnvMap2', mipmaps[lodLevel+1] || mipmaps[mipmaps.length - 1]);
            material.set('lodMix', roughness * (mipmaps.length-1) - lodLevel);
            material.set('roughness', roughness);

            if (this.materials.indexOf(material) < 0) {
                this.materials.push(material);
            }
        }
    }

    return IBL;
});