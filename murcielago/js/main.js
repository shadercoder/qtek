define(function(require) {

    var ko = require('knockout');
    ko.mapping = require('ko.mapping');
    var qtek = require('qtek');
    var qtek3d = qtek['3d'];
    var Atmosphere = require('common/Atmosphere');
    var IBLClazz = require('common/IBL');

    var renderer = new qtek3d.Renderer({
        canvas : document.getElementById("Main"),
        devicePixelRatio : 1.0,
        antialias : false
    });
    renderer.resize(window.innerWidth, window.innerHeight);
    var animation = new qtek.animation.Animation();
    animation.start();
    var shadowMapPass = new qtek3d.prePass.ShadowMap({
        useVSM : true
    });

    var envMap = new qtek3d.texture.TextureCube({
        width : 512,
        height : 512,
        type :  qtek3d.Texture.FLOAT,
        useMipmap : false
    })
    var atmospherePass = new Atmosphere({
        texture : envMap
    });

    var GLTFLoader = new qtek.loader.GLTF();

    GLTFLoader.load("assets/murcielago.json");

    GLTFLoader.on("load", function(scene, cameras) {
        var camera = new qtek3d.camera.Perspective({
            aspect : renderer.canvas.width/renderer.canvas.height,
            far : 1000
        });
        camera.position.set(2, 0.8, 5);
        camera.lookAt(scene.position);
        camera.aspect = renderer.canvas.width / renderer.canvas.height;

        var control = new qtek3d.plugin.OrbitControl({
            target : camera,
            domElement : renderer.canvas,
            sensitivity : 0.4,
            minRollAngle : 0.1
        });
        // z up
        control.up.set(0, 1, 0);
        control.enable();

        var shader = qtek3d.shader.library.get("buildin.lambert");

        var planeMat = new qtek3d.Material({
            shader : shader
        });
        // Add Plane
        var planeGeo = new qtek3d.geometry.Plane({
            widthSegments : 1,
            heightSegments : 1
        });
        var planeMesh = new qtek3d.Mesh({
            geometry : planeGeo,
            material : planeMat
        });
        planeMesh.rotation.rotateX(-Math.PI/2);
        planeMesh.scale.set(100, 100, 100);
        scene.add(planeMesh);

        var light = new qtek3d.light.Directional({
            intensity : 0.6
        });
        light.shadowCamera = {
            left : -3,
            right : 3,
            top : 3, 
            bottom : -3,
            near : 0,
            far : 30
        };
        light.shadowResolution = 512;
        light.shadowBias = 0.002;   
        light.position.set(2, 2, -1);
        light.lookAt(new qtek.core.Vector3(0, 0, 0), new qtek.core.Vector3(0, 1, 0));

        scene.add(light);

        var aidLight = new qtek3d.light.Directional({
            intensity : 0.1,
            castShadow : false
        });
        // scene.add(aidLight);
        aidLight.position.set(-0.5, 2, -1);
        aidLight.lookAt(new qtek.core.Vector3(0, 0, 0), new qtek.core.Vector3(0, 1, 0));

        var skybox = new qtek3d.plugin.Skybox({
            scene : scene
        });
        skybox.material.set('environmentMap', envMap);
        scene.update();

        atmospherePass.light = light;
        atmospherePass.render(renderer);

        var IBLShader = new qtek3d.Shader({
            vertex : qtek3d.Shader.source('buildin.phong.vertex'),
            fragment : qtek3d.Shader.source('IBL.fragment')
        });
        IBLShader.enableTexture('diffuseMap');
        var IBLShaderNoDiffuse = IBLShader.clone();
        IBLShaderNoDiffuse.disableTexture('diffuseMap');
        var materials = {};
        scene.traverse(function(node) {
            if (node.geometry) {
                node.culling = false;
            }
            if (node.material) {
                materials[node.material.name] = node.material;

                if (node.material.transparent) {
                    node.castShadow = false;
                }
            }
        });
        
        var startRenderering = false;
        IBL = new IBLClazz(renderer, envMap, function() {
            for (var name in materials) {
                var material = materials[name];
                var diffuseMap = material.get('diffuseMap');
                var color = material.get('color');
                var shininess = material.get('shininess') || 0;
                if (shininess === 0) {
                    var roughness = 1.0;
                } else {
                    var roughness = 1 / shininess;
                    roughness*= 40;
                    roughness = Math.min(roughness, 0.9);
                }
                if (diffuseMap){
                    material.attachShader(IBLShader, true);
                } else {
                    material.attachShader(IBLShaderNoDiffuse, true);
                }
                material.set('ambient', 0.5);

                IBL.applyToMaterial(material, roughness);
            }
            // planeMesh.material.attachShader(qtek3d.shader.library.get('buildin.phong'));
            IBL.applyToMaterial(planeMesh.material, 0.2);
            planeMesh.material.set('uvRepeat', [100, 100]);
            planeMesh.material.set('specularColor', [0.3, 0.3, 0.3]);
            planeMesh.material.shader = planeMesh.material.shader.clone();
            planeMesh.material.set('ambient', 0.5);
            planeMesh.material.shader.enableTexture('diffuseMap');
            planeMesh.material.shader.enableTexture('normalMap');
            // planeMesh.material.shader.define('fragment', 'SAMPLE_NUMBER', 128);
            var groundDiffuse = new qtek3d.texture.Texture2D({
                wrapS : qtek3d.Texture.REPEAT,
                wrapT : qtek3d.Texture.REPEAT,
                anisotropic : 8
            });
            var groundNormal = new qtek3d.texture.Texture2D({
                wrapS : qtek3d.Texture.REPEAT,
                wrapT : qtek3d.Texture.REPEAT,
                anisotropic : 8
            });
            groundDiffuse.load('assets/10_DIFFUSE.jpg');
            groundNormal.load('assets/10_NORMAL.jpg');
            planeMesh.geometry.generateTangents();
            planeMesh.material.set('diffuseMap', groundDiffuse);
            planeMesh.material.set('normalMap', groundNormal);

            qtek3d.Material.getMaterial('Body paint').set('color', [1.0, 1.0, 1.0]);

            startRenderering = true;
        });

        var renderInfo = {
            fps : 0,
            renderTime : 0,
            frameTime : 0
        }
        var renderInfoVM = ko.mapping.fromJS(renderInfo);
        ko.applyBindings(renderInfoVM, document.getElementById('render-info'));
        var simpleMaterial = new qtek3d.Material({
            shader : qtek3d.shader.library.get('buildin.basic')
        });

        var compositor;

        var FXLoader = new qtek.loader.FX();
        FXLoader.load('assets/fx.json');
        FXLoader.on('load', function(_compositor) {
            compositor = _compositor;
            var sceneNode = new qtek3d.compositor.SceneNode({
                name : "scene",
                scene : scene,
                camera : camera,
                outputs : {
                    color : {
                        parameters : {
                            width : window.innerWidth,
                            height : window.innerHeight
                        }
                    }
                }
            });
            compositor.add(sceneNode);

            compositor.findNode('FXAA').setParameter('viewportSize', [window.innerWidth, window.innerHeight])
        });

        animation.on('frame', function(frameTime) {
            if (startRenderering) {
                var start = performance.now();
                if (compositor) {
                    shadowMapPass.render(renderer, scene);
                    compositor.render(renderer);
                }
                var renderTime = performance.now() - start;
                renderInfo.fps = Math.floor(1000 / frameTime);
                renderInfo.frameTime = frameTime;
                renderInfo.renderTime = renderTime;
            }
        });

        setInterval(function() {
            ko.mapping.fromJS(renderInfo, renderInfoVM);
        }, 500);
    });
});