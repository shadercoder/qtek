define(function(require) {

    var ko = require('knockout');
    ko.mapping = require('ko.mapping');
    var qtek = require('qtek');
    var $ = require('$');
    var editor = require('js/editor');
    var environment = require('js/environment');

    var shadowMapPass = new qtek.prePass.ShadowMap({
        softShadow : qtek.prePass.ShadowMap.VSM
    });

    var stage;
    if (window.location.pathname.match(/editor.html$/)) {
        editor.init();
        var viewPort = $("#ViewPort").qpf('get')[0];
        if (viewPort) {
            stage = viewPort.stage;
        } else {
            return;
        }
    } else {
        stage = new qtek.Stage({
            container : document.getElementById('App')
        });
        stage.resize(window.innerWidth, window.innerHeight);
    }
    ko.computed(function() {
        environment.km = editor.environment.km();
        environment.kr = editor.environment.kr();
        environment.time = editor.environment.time();
        environment.update();
    });

    var layer = stage.createLayer3D();
    var camera = layer.camera;
    var scene = layer.scene;
    var renderer = layer.renderer;
    renderer.setDevicePixelRatio(1.0);
    camera.position.set(2, 0.8, 5);
    camera.lookAt(scene.position);

    scene.add(environment.light);

    environment.init(renderer);
    environment.skybox.attachScene(scene);

    var GLTFLoader = new qtek.loader.GLTF();

    GLTFLoader.load("assets/murcielago.json");

    GLTFLoader.on('success', function(res) {
        var children = res.scene.children();
        for (var i = 0; i < children.length; i++) {
            scene.add(children[i]);
        }
        var control = new qtek.plugin.OrbitControl({
            target : camera,
            domElement : stage.container,
            sensitivity : 0.4,
            // maxPolarAngle : Math.PI / 2 - 0.1
        });

        var planeMat = new qtek.Material({
            name : 'Ground Mat',
            shader : qtek.shader.library.get("buildin.phong")
        });
        planeMat.set('uvRepeat', [100, 100]);
        planeMat.set('specularColor', [0.1, 0.1, 0.1]);
        planeMat.shader.enableTexture('diffuseMap');
        planeMat.shader.enableTexture('normalMap');
        // Add Plane
        var planeGeo = new qtek.geometry.Plane({
            widthSegments : 1,
            heightSegments : 1
        });
        planeGeo.boundingBox = null;
        var planeMesh = new qtek.Mesh({
            geometry : planeGeo,
            material : planeMat
        });
        planeMesh.rotation.rotateX(-Math.PI/2);
        planeMesh.scale.set(100, 100, 100);
        var groundDiffuse = new qtek.texture.Texture2D({
            wrapS : qtek.Texture.REPEAT,
            wrapT : qtek.Texture.REPEAT,
            anisotropic : 16
        });
        var groundNormal = new qtek.texture.Texture2D({
            wrapS : qtek.Texture.REPEAT,
            wrapT : qtek.Texture.REPEAT,
            anisotropic : 16
        });
        // Texture from http://www.rendertextures.com/pavers-21/
        groundDiffuse.load('assets/10_DIFFUSE.jpg');
        groundNormal.load('assets/10_NORMAL.jpg');
        planeMesh.geometry.generateTangents();
        planeMesh.material.set('diffuseMap', groundDiffuse);
        planeMesh.material.set('normalMap', groundNormal);
        scene.add(planeMesh);

        scene.traverse(function(node) {
            if (node.geometry) {
                // node.receiveShadow = false;
                node.culling = false;
                node.geometry.generateBarycentric();
            }
            if (node.material) {
                if (node.material.transparent) {
                    node.castShadow = false;
                }
                environment.applyToMaterial(node.material);
            }
        });
        planeMesh.culling = true;
        planeMat.shader.define('fragment', 'SPECULAR_SHADOW');

        editor.setMaterials(environment.getMaterialList());

        var compositor;
        var FXLoader = new qtek.loader.FX();
        FXLoader.load('../common/assets/fx/hdr.json');
        FXLoader.on('success', function(_compositor) {
            compositor = _compositor;
            var sceneNode = new qtek.compositor.SceneNode({
                name : "scene",
                scene : scene,
                camera : camera,
                outputs : {
                    color : {
                        parameters : {
                            width : renderer.width,
                            height : renderer.height,
                            type : qtek.Texture.FLOAT
                        }
                    }
                }
            });
            compositor.add(sceneNode);
        });

        var renderInfo = {
            fps : 0,
            renderTime : 0,
            frameTime : 0
        }
        var renderInfoVM = ko.mapping.fromJS(renderInfo);
        var renderInfoDom = document.getElementById('render-info')
        if (renderInfoDom) {
            ko.applyBindings(renderInfoVM, renderInfoDom);
        }
        stage.on('frame', function(frameTime) {
            control.update(frameTime);
            var start = performance.now();
            if (compositor) {
                shadowMapPass.render(renderer, scene, camera);
                compositor.render(renderer);
            }
            var renderTime = performance.now() - start;
            renderInfo.fps = Math.floor(1000 / frameTime);
            renderInfo.frameTime = frameTime;
            renderInfo.renderTime = renderTime;
            if (compositor) {
                var FXAANode = compositor.findNode('FXAA');
                if (FXAANode) {
                    FXAANode.setParameter('viewportSize', [renderer.width, renderer.height]);
                }
            }
        });

        setInterval(function() {
             ko.mapping.fromJS(renderInfo, renderInfoVM);
        }, 50);

        window.addEventListener('resize', function() {
            stage.resize(window.innerWidth, window.innerHeight);
        });
    });
});