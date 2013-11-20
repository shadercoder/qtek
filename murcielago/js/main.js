define(function(require) {

    var qtek = require('qtek');
    var qtek3d = qtek['3d'];
    var Atmosphere = require('common/Atmosphere');
    var IBL = require('common/IBL');

    var renderer = new qtek3d.Renderer({
        canvas : document.getElementById("Main"),
        devicePixelRatio : 1.0
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
        type :  qtek3d.Texture.FLOAT
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
            intensity : 0.3
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
        light.position.set(2, 1.0, 0);
        light.lookAt(new qtek.core.Vector3(0, 0, 0), new qtek.core.Vector3(0, 1, 1));

        scene.add(light);

        var skybox = new qtek3d.plugin.Skybox({
            renderer : renderer,
            camera : camera
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
        var GGXLookup = IBL.generateGGXLookup();
        scene.traverse(function(node) {
            if (node.geometry) {
                if (node.geometry.convertToGeometry) {
                    node.geometry = node.geometry.convertToGeometry();
                }
                node.culling = false;
            }
            if (node.material) {
                var diffuseMap = node.material.get('diffuseMap');
                var color = node.material.get('color');
                var shininess = node.material.get('shininess') || 0;
                var transparent = node.material.transparent;
                var alpha = node.material.get('alpha');
                if (shininess === 0) {
                    var roughness = 1.0;
                } else {
                    var roughness = 1 / shininess;
                    roughness*= 40;
                    roughness = Math.min(roughness, 0.9);
                }
                node.material.dispose();
                if (diffuseMap){
                    node.material = new qtek3d.Material({
                        name : node.material.name,
                        shader : IBLShader
                    });
                    node.material.set('diffuseMap', diffuseMap);
                } else {
                    node.material = new qtek3d.Material({
                        name : node.material.name,
                        shader : IBLShaderNoDiffuse
                    });
                }
                node.material.set('color', color);
                node.material.set('environmentMap', atmospherePass.mipmaps[3]);
                node.material.set('GGXLookup', GGXLookup);
                node.material.set('roughness', roughness);
                if (transparent) {
                    node.material.transparent = true;
                    node.material.set('alpha', alpha);
                    node.castShadow = false;
                }
                node.material.set('ambient', 0.3)
            }
        });
        planeMesh.material.set('roughness', 0.2);
        planeMesh.material.set('environmentMap', atmospherePass.mipmaps[5]);


        var clearAll = renderer.clear;
        animation.on('frame', function() {
            shadowMapPass.render(renderer, scene);
            renderer.render(scene, camera);
        });
    });
});