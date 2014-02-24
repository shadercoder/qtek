define(['qtek', 'knockout', 'ko.mapping'], function(qtek, ko, koMapping){
    var Vector3 = qtek.math.Vector3;
    var Shader = qtek.Shader;

    function getUrlVars(){
        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
        for(var i = 0; i < hashes.length; i++){
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        return vars;
    }
    var env = getUrlVars();
    var textureResolution = env.texture || "high";
    var shadowResolution = parseInt(env.shadow || 512);

    var renderer = new qtek.Renderer({
        canvas : document.getElementById( "Main"),
        // devicePixelRatio : 1.0
    });
    renderer.resize(window.innerWidth, window.innerHeight);
    var animation = new qtek.animation.Animation();
    animation.start();

    var scene;
    var camera;
    window.shadowMapPass = new qtek.prePass.ShadowMap({
        softShadow : qtek.prePass.ShadowMap.VSM
    });

    if( textureResolution === "high"){
        var texturePath = "assets/textures"
    }else{
        var texturePath = "assets/textures_" + textureResolution
    }
    var loader = new qtek.loader.GLTF({
        textureRootPath : texturePath
    });
    loader.load("assets/sponza.json");

    loader.on("success", function(res){
        camera = new qtek.camera.Perspective({
            aspect : window.innerWidth / window.innerHeight
        });
        camera.position.set(10, 10, 0);
        camera.lookAt(new qtek.math.Vector3(0, 10, 0))
        scene = res.scene;
        var firstPersonControl = new qtek.plugin.FirstPersonControl({
            target : camera,
            domElement : renderer.canvas
        });

        light = new qtek.light.Point({
            intensity : 0.5,
            castShadow : true,
            shadowResolution : 512,
            shadowBias : 0.01,
            range : 100
        });
        light.position.set(10, 20, 0);
        // light.color = [0.4, 0.2, 0.0];
        light.lookAt(new qtek.math.Vector3(0, 0, 0));
        scene.add(light);
        scene.add(new qtek.light.Ambient({
            intensity : 0.2
        }));

        scene.traverse(function(node) {
            if (node.material) {
                node.material.get('diffuseMap').anisotropic = 8;
                if (node.material.get('normapMap')) {
                    node.material.get('normapMap').anisotropic = 8;
                }
            }
        });
        var renderInfo;

        animation.on('frame', function(deltaTime) {
            firstPersonControl.update(deltaTime);
            var time = performance.now();
            shadowMapPass.render(renderer, scene);
            var shadowPassTime = performance.now() - time;
            time = performance.now();
            renderInfo = renderer.render(scene, camera, true, false);
            var renderTime = performance.now() - time;
            // shadowMapPass.renderDebug(renderer);
            // Update debug render info
            renderInfo.shadowPassTime = shadowPassTime;
            renderInfo.renderTime = renderTime;
            renderInfo.fps = Math.round(1000 / deltaTime);
        });

        setInterval(function() {
            koMapping.fromJS(renderInfo, mapping, debugInfoVM);
        }, 200);
    });


    // Show debug render info
    var mapping = {
        "ignore" : []
    };
    var debugInfoVM = koMapping.fromJS({
        faceNumber : 0,
        vertexNumber : 0,
        drawCallNumber : 0,
        renderTime : 0,
        shadowPassTime : 0,
        meshNumber : 0,
        fps : 0
    }, mapping);
    debugInfoVM.useWireframe = ko.observable(false);

    debugInfoVM.useWireframe.subscribe(function(value){
        if (value) {
            scene.traverse(function(node){
                if(node.geometry){
                    node.mode = qtek.Mesh.LINES
                }
            });
        } else {
            scene.traverse(function(node){
                if(node.geometry){
                    node.mode = qtek.Mesh.TRIANGLES
                }
            });
        }
    });

    ko.applyBindings(debugInfoVM, document.getElementById("DebugInfo"));

})
