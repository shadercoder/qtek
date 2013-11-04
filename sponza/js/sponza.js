define(['qtek', 'knockout', 'ko.mapping'], function(qtek, ko, koMapping){

    var qtek3d = qtek['3d'];
    var Vector3 = qtek.core.Vector3;
    var Shader = qtek3d.Shader;

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
    var textureResolution = env.texture || "medium";
    var shadowResolution = parseInt(env.shadow || 512);

    var renderer = new qtek3d.Renderer({
        canvas : document.getElementById( "Main"),
        devicePixelRatio : 1.0,
        color : [0.0, 0.0, 0.0, 0.0]
    });
    renderer.resize(window.innerWidth, window.innerHeight);
    var animation = new qtek.animation.Animation();
    animation.start();

    var scene;
    var camera;
    var shadowMapPass = new qtek3d.prePass.ShadowMap();

    if( textureResolution === "high"){
        var texturePath = "assets/textures"
    }else{
        var texturePath = "assets/textures_" + textureResolution
    }
    var loader = new qtek.loader.GLTF({
        textureRootPath : texturePath
    });
    loader.load("assets/sponza.json");

    loader.on("load", function(sponzaScene, sponzaCameras){
        // camera = sponzaCameras[Object.keys(sponzaCameras)[0]];
        camera = new qtek3d.camera.Perspective({
            aspect : window.innerWidth / window.innerHeight
        });
        camera.position.set(10, 10, 0);
        camera.lookAt(new qtek.core.Vector3(0, 10, 0))
        scene = sponzaScene;
        var firstPersonControl = new qtek3d.plugin.FirstPersonControl({
            target : camera,
            domElement : renderer.canvas
        });
        firstPersonControl.enable();

        var light = new qtek3d.light.Directional({
            intensity : 0.9,
            shadowCamera : {
                left : -50,
                right : 50,
                top : 50,
                bottom : -50,
                near : 0,
                far : 200
            },
            shadowResolution : 1024,
            shadowBias : 0.01
        });
        light.position.set(0, 50, 7)
        light.lookAt(new qtek.core.Vector3(0, 0, 0));
        scene.add(light);
        scene.add(new qtek3d.light.Ambient({
            intensity : 0.3
        }));

        scene.traverse(function(node) {
            if (node.geometry) {
                node.geometry = node.geometry.convertToGeometry();
                node.geometry.generateTangents();
            }
            if (node.material) {
                // node.material.shader.define('fragment', 'RENDER_NORMAL');
            }
        })

        animation.onframe = function() {
            renderInfo.clear();
            shadowMapPass.render(renderer, scene);
            renderer.render(scene, camera);
            renderer.clear = renderer.gl.DEPTH_BUFFER_BIT;
            shadowMapPass.renderDebug(renderer);
            // Update debug render info
            koMapping.fromJS(renderInfo.log, mapping, debugInfoVM);
        };
    });


    // Show debug render info

    var renderInfo = new qtek3d.debug.RenderInfo({
        renderer : renderer,
        shadowPass : shadowMapPass
    });
    renderInfo.enable();

    var mapping = {
        "ignore" : []
    };
    var debugInfoVM = koMapping.fromJS(renderInfo.log, mapping);
    debugInfoVM.fps = ko.computed(function(){
        if(debugInfoVM.renderTime){
            var frameTime = debugInfoVM.shadowPassTime() + debugInfoVM.renderTime();
            return Math.min(Math.floor(1000 / frameTime), 50);
        }else{
            return 0;
        }
    });
    debugInfoVM.useWireframe = ko.observable(false);

    debugInfoVM.useWireframe.subscribe(function(value){
        if( value ){
            scene.traverse(function(node){
                if(node.geometry){
                    node.mode = qtek3d.Mesh.LINES
                }
            });
        }else{
            scene.traverse(function(node){
                if(node.geometry){
                    node.mode = qtek3d.Mesh.TRIANGLES
                }
            });
        }
    });

    ko.applyBindings(debugInfoVM, document.getElementById("DebugInfo"));

})
