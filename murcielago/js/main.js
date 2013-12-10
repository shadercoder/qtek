define(function(require) {

    var ko = require('knockout');
    ko.mapping = require('ko.mapping');
    var qtek = require('qtek');
    var qtek3d = qtek['3d'];
    var Atmosphere = require('../../common/Atmosphere');
    var IBLClazz = require('../../common/IBL');
    var $ = require('$');
    var editor = require('js/editor');

    var Vector3 = qtek.core.Vector3;

    var shadowMapPass = new qtek3d.prePass.ShadowMap({
        useVSM : true
    });

    var envMap = new qtek3d.texture.TextureCube({
        width : 128,
        height : 128,
        type :  qtek3d.Texture.FLOAT
    })
    var atmospherePass = new Atmosphere({
        texture : envMap
    });
    var startRendering = false;

    var stage;
    var IBL;
    if (window.location.pathname.match(/editor.html$/)) {
        editor.init();
        var viewPort = $("#ViewPort").qpf('get')[0];
        if (viewPort) {
            stage = viewPort.stage;
        } else {
            return;
        }
        var atmosphereRenderTimeout;
        var filterTimeout;
        ko.computed(function() {
            atmospherePass.setParameter('km', editor.environment.km());
            atmospherePass.setParameter('kr', editor.environment.kr());
            var time = (editor.environment.time() - 6) / 12;
            var angle = time * Math.PI;
            if (light) {
                light.position.y = Math.sin(angle) * 3;
                light.position.x = Math.cos(angle) * 3;
                light.position.z = -3;
                light.intensity = light.position.clone().normalize().dot(Vector3.UP);
                light.lookAt(Vector3.ZERO, Vector3.UP);
                atmospherePass.setParameter('ESun', light.intensity * 20 + 3);
            }
            clearTimeout(atmosphereRenderTimeout);
            atmosphereRenderTimeout = setTimeout(function() {
                if (renderer) {
                    atmospherePass.render(renderer);
                }
                if (!startRendering) {
                    return;
                }
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(function() {
                    if (IBL) {
                        IBL.update(function() {
                            IBL.updateMaterials();
                        });
                    }
                }, 200);
            }, 20);
        });
    } else {
        stage = new qtek.Stage({
            container : document.getElementById('App')
        });
        stage.resize(window.innerWidth, window.innerHeight);
    }
    var layer = stage.createLayer3D();
    var camera = layer.camera;
    var scene = layer.scene;
    var renderer = layer.renderer;
    renderer.setDevicePixelRatio(1.0);
    camera.position.set(2, 0.8, 5);
    camera.lookAt(scene.position);
    var light = new qtek3d.light.Directional();
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
    light.position.set(4, 1, -3);
    light.lookAt(new Vector3(0, 0, 0), Vector3.UP);
    light.intensity = light.position.normalize().dot(Vector3.UP);

    scene.add(light);

    var GLTFLoader = new qtek.loader.GLTF();

    GLTFLoader.load("assets/murcielago.json");

    GLTFLoader.on("load", function(_scene) {
        var children = _scene.children();
        for (var i = 0; i < children.length; i++) {
            scene.add(children[i]);
        }
        var control = new qtek3d.plugin.OrbitControl({
            target : camera,
            domElement : stage.container,
            sensitivity : 0.4,
            // maxPolarAngle : Math.PI / 2 - 0.1
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

        var skybox = new qtek3d.plugin.Skybox({
            scene : scene
        });
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
                // node.receiveShadow = false;
                node.culling = false;
                node.geometry.generateBarycentric();
            }
            if (node.material) {
                materials[node.material.name] = node.material;
                if (node.material.transparent) {
                    node.castShadow = false;
                }
            }
        });
        planeMesh.culling = true;
        planeMesh.receiveShadow = true;
            
        var materialList = [];
        for (var name in materials) {
            materialList.push(materials[name]);
        }
        editor.setMaterials(materialList);
        envMap = '../../tests/assets/textures/hdr/night.hdr';
        IBL = new IBLClazz(renderer, envMap, function() {
            skybox.material.set('environmentMap', IBL.environmentMap);
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

                IBL.applyToMaterial(material, roughness);
            }
            // planeMesh.material.attachShader(qtek3d.shader.library.get('buildin.phong'));
            IBL.applyToMaterial(planeMesh.material, 0.2);
            planeMesh.material.set('uvRepeat', [100, 100]);
            planeMesh.material.set('specularColor', [0.1, 0.1, 0.1]);
            planeMesh.material.shader = planeMesh.material.shader.clone();
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

            planeMesh.material.shader.define('fragment', 'SPECULAR_SHADOW');

            var bodyPaintMat = qtek3d.Material.getMaterial('Body paint');
            bodyPaintMat.set('color', [1.0, 1.0, 1.0]);
            IBL.applyToMaterial(bodyPaintMat, 0.1);

            startRendering = true;

            editor.setIBL(IBL);
        });

        var compositor;

        var FXLoader = new qtek.loader.FX();
        FXLoader.load('assets/hdr.json');
        FXLoader.on('load', function(_compositor) {
            compositor = _compositor;
            var sceneNode = new qtek3d.compositor.SceneNode({
                name : "scene",
                scene : scene,
                camera : camera,
                outputs : {
                    color : {
                        parameters : {
                            width : renderer.width,
                            height : renderer.height,
                            type : qtek3d.Texture.FLOAT
                        }
                    }
                }
            });
            compositor.add(sceneNode);
            var tonemappingNode = compositor.findNode('tonemapping');
            if (tonemappingNode) {
                tonemappingNode.outputs.color.parameters.width = window.innerWidth;
                tonemappingNode.outputs.color.parameters.height = window.innerHeight;
            }
        });

        var renderInfo = {
            fps : 0,
            renderTime : 0,
            frameTime : 0,
            drawCallNumber : 0
        }
        // var renderInfoVM = ko.mapping.fromJS(renderInfo);
        // ko.applyBindings(renderInfoVM, document.getElementById('render-info'));
        stage.on('frame', function(frameTime) {
            if (startRendering) {
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
            if (compositor) {
                var FXAANode = compositor.findNode('FXAA');
                if (FXAANode) {
                    FXAANode.setParameter('viewportSize', [renderer.width, renderer.height]);
                }
            }
        });

        setInterval(function() {
            // ko.mapping.fromJS(renderInfo, renderInfoVM);
        }, 500);
    });
});