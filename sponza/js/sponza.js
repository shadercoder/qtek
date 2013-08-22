define(['qtek', 'knockout', 'ko.mapping'], function(qtek, ko, koMapping){

    var qtek3d = qtek['3d'],
        Vector3 = qtek.core.Vector3,
        Shader = qtek3d.Shader;

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

    var scene;
    var camera;
    var shadowMapPass = new qtek3d.prepass.ShadowMap({
        useVSM : true
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

    loader.on("load", function(sponzaScene, sponzaCameras){
        camera = sponzaCameras[Object.keys(sponzaCameras)[0]];
        scene = sponzaScene;
        var firstPersonControl = new qtek3d.plugin.FirstPersonControl({
            camera : camera,
            canvas : renderer.canvas,
            up : new Vector3(0, 0, 1)
        });
        firstPersonControl.enable();

        var light = scene.getNode("Lamp-light");
        light.range = 30;
        // light.castShadow = true;

        // shadowMapPass.render( renderer, scene );
        setInterval(function(){
            renderer.render( scene, camera );
            // Update debug render info
            koMapping.fromJS(renderInfo, mapping, debugInfoVM);
        }, 50);
    });


    // Show debug render info

    // Put render info collection before shadow pass
    var renderInfo = new qtek3d.debug.RenderInfo({
        renderer : renderer
    });
    renderInfo.enable();

    var mapping = {
        "ignore" : ["renderer"]
    };
    var debugInfoVM = koMapping.fromJS(renderInfo, mapping);
    debugInfoVM.fps = ko.computed(function(){
        if( debugInfoVM.frameTime ){
            return Math.min( Math.floor( 1000 / debugInfoVM.frameTime() ), 50);
        }else{
            return 0;
        }
    });
    debugInfoVM.useWireframe = ko.observable(false);

    debugInfoVM.useWireframe.subscribe(function(value){
        if( value ){
            scene.traverse(function(node){
                if(node.geometry){
                    node.mode = "LINES"
                }
            });
        }else{
            scene.traverse(function(node){
                if(node.geometry){
                    node.mode = "TRIANGLES"
                }
            });
        }
    });

    ko.applyBindings(debugInfoVM, document.getElementById("DebugInfo"));

})
