define(function(require) {

    var qtek = require('qtek');
    var qtek3d = qtek['3d'];
    var Vector3 = qtek.core.Vector3;

    var Atmosphere = require('../../common/Atmosphere');
    var IBLClazz = require('../../common/IBL');

    var IBLShader = new qtek3d.Shader({
        vertex : qtek3d.Shader.source('buildin.phong.vertex'),
        fragment : qtek3d.Shader.source('IBL.fragment')
    });
    IBLShader.enableTexture('diffuseMap');
    var IBLShaderNoDiffuse = IBLShader.clone();
    IBLShaderNoDiffuse.disableTexture('diffuseMap');
    var IBLShaderWithNormal = IBLShader.clone();
    IBLShaderWithNormal.enableTexture('normalMap');

    var atmospherePass = new Atmosphere({
        texture : this.envMap
    });

    var environment = {

        useCubeMap : false,
        // cubeMapUrl : '../../tests/assets/textures/hdr/old_industrial_hall.hdr',
        time : 8,
        kr : 0,
        km : 0,

        IBL : null,

        light : new qtek3d.light.Directional({
            shadowResolution : 512,
            shadowBias : 0.002,
            shadowCamera : {
                left : -3,
                right : 3,
                top : 3, 
                bottom : -3,
                near : 0,
                far : 30
            }
        }),
        skybox : new qtek3d.plugin.Skybox(),

        atmosphereEnvMap : new qtek3d.texture.TextureCube({
            width : 128,
            height : 128,
            type :  qtek3d.Texture.FLOAT
        }),

        materials : {},

        renderer : null,

        init : function(renderer) {
            this.IBL = new IBLClazz(renderer);
            this.renderer = renderer;
            this.update();
        },

        update : function(callback) {
            if (!this.renderer) {
                return;
            }
            var self = this;
            // Update Light
            var time = (this.time - 6) / 12;
            var angle = time * Math.PI;
            var light = this.light;
            light.position.y = Math.sin(angle) * 3;
            light.position.x = Math.cos(angle) * 3;
            light.position.z = -3;
            var intensity = Math.max(light.position.clone().normalize().dot(Vector3.UP), 0);
            intensity = Math.pow(intensity, 0.7);
            light.intensity = intensity;
            light.lookAt(Vector3.ZERO, Vector3.UP);
            light.update();
            // Prefilter environment map
            var envMap;
            if (this.useCubeMap) {
                envMap = this.cubeMapUrl
            } else {
                atmospherePass.setParameter('ESun', intensity * 20 + 3);
                atmospherePass.setParameter('km', this.km);
                atmospherePass.setParameter('kr', this.kr);
                atmospherePass.texture = this.atmosphereEnvMap;
                atmospherePass.light = light;
                atmospherePass.render(this.renderer);
                envMap = this.atmosphereEnvMap;
            }
            this.IBL.init(envMap, function() {
                self.skybox.material.set('environmentMap', self.IBL.environmentMap);
                callback && callback();
            });
        },

        applyToMaterial : function(material) {
            var diffuseMap = material.get('diffuseMap');
            var normalMap = material.get('normalMap');
            var shininess = material.get('shininess') || 0;
            if (shininess === 0) {
                var roughness = 1.0;
            } else {
                var roughness = 1 / shininess;
                roughness*= 40;
                roughness = Math.min(roughness, 0.9);
            }
            if (normalMap) {
                material.attachShader(IBLShaderWithNormal, true);
            } else if (diffuseMap) {
                material.attachShader(IBLShader, true);
            } else {
                material.attachShader(IBLShaderNoDiffuse, true);
            }

            this.IBL.applyToMaterial(material, roughness);

            this.materials[material.name] = material;
        },

        getMaterialList : function() {
            var materialList = [];
            for (var name in this.materials) {
                materialList.push(this.materials[name]);
            }
            return materialList;
        }
    }

    return environment;
});