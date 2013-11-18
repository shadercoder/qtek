define(function(require) {

    var qtek = require('qtek');
    var qtek3d = qtek['3d'];
    var Atmosphere = require('common/Atmosphere');

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
        height : 512
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
        camera.position.set(1, 1, 4);
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

        var material = new qtek3d.Material({
            shader : shader
        });
        // Add Plane
        var plane = new qtek3d.geometry.Plane({
            widthSegments : 1,
            heightSegments : 1
        });
        var planeMesh = new qtek3d.Mesh({
            geometry : plane,
            material : material
        });
        planeMesh.rotation.rotateX(-Math.PI/2);
        planeMesh.scale.set(100, 100, 100);
        scene.add(planeMesh);

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
        light.position.set(1, 1.0, 0);
        light.lookAt(new qtek.core.Vector3(0, 0, 0), new qtek.core.Vector3(0, 1, 1));

        scene.add(light);
        scene.add(new qtek3d.light.Ambient({
            intensity : 0.1
        }));

        var skybox = new qtek3d.plugin.Skybox({
            renderer : renderer,
            camera : camera
        });
        skybox.material.set('environmentMap', envMap);
        scene.update();

        atmospherePass.light = light;
        atmospherePass.render(renderer);

        scene.traverse(function(node) {
            if (node.geometry) {
                if (node.geometry.convertToGeometry) {
                    node.geometry = node.geometry.convertToGeometry();
                }
            }
        });

        var REFLECT_MATS = {
            'Body paint' : 0.1,
            'Material #595' : 0.6,
            // 'mini_windows_002' : 0.2,
            // 'mini_headlight_gl_001' : 0.2,
            // 'DISC' : 0.2
        }
        qtek3d.Material.getMaterial('Body paint').set('color', [1.0, 1.0, 1.0]);

        for (var matName in REFLECT_MATS) {
            var mat = qtek3d.Material.getMaterial(matName);
            mat.shader = mat.shader.clone();
            mat.shader.enableTexture("environmentMap");
            mat.set({
                "environmentMap": envMap,
                "reflectivity" : REFLECT_MATS[matName]
            });
        }

        var clearAll = renderer.clear;
        animation.on('frame', function() {
            shadowMapPass.render(renderer, scene);
            renderer.render(scene, camera);
            // renderer.clear = qtek3d.Renderer.CLEAR_DEPTH;
            // shadowMapPass.renderDebug(renderer);
            // renderer.clear = clearAll;
        });
    });
});