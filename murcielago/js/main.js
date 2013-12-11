define(function(require) {

    var ko = require('knockout');
    ko.mapping = require('ko.mapping');
    var qtek = require('qtek');
    var qtek3d = qtek['3d'];
    var $ = require('$');
    var editor = require('js/editor');
    var environment = require('js/environment');

    var shadowMapPass = new qtek3d.prePass.ShadowMap({
        useVSM : true
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

        var planeMat = new qtek3d.Material({
            name : 'Ground Mat',
            shader : qtek3d.shader.library.get("buildin.lambert")
        });
        planeMat.set('uvRepeat', [100, 100]);
        planeMat.set('specularColor', [0.1, 0.1, 0.1]);
        planeMat.shader.enableTexture('diffuseMap');
        planeMat.shader.enableTexture('normalMap');
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
            var start = performance.now();
            if (compositor) {
                shadowMapPass.render(renderer, scene);
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
                var tonemappingNode = compositor.findNode('tonemapping');
                var sceneNode  = compositor.findNode('scene');
                if (tonemappingNode) {
                    var colorTex = tonemappingNode.getOutput('color');
                    if (colorTex) {
                        colorTex.dispose(renderer.gl);
                    }
                    colorTex = sceneNode.getOutput('color');
                    if (colorTex) {
                        colorTex.dispose(renderer.gl);
                    }
                    tonemappingNode.outputs.color.parameters.width = renderer.width;
                    tonemappingNode.outputs.color.parameters.height = renderer.height;
                    sceneNode.outputs.color.parameters.width = renderer.width;
                    sceneNode.outputs.color.parameters.height = renderer.height;
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