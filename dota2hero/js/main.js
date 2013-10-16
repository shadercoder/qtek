(function(){
    
    'use strict';

    var qtek3d = qtek['3d'];

    function createDebugAxis(len) {
        var qtek3d = qtek['3d'];
        var shader = new qtek3d.Shader({
            vertex : qtek3d.Shader.source("buildin.basic.vertex"),
            fragment : qtek3d.Shader.source("buildin.basic.fragment")
        });

        var createLine = function(pos, color) {
            var mat = new qtek3d.Material({
                shader : shader
            });
            mat.set("color", color);
            var lineGeo = new qtek3d.Geometry();
            var lineGeoVertices = lineGeo.attributes.position.value;
            lineGeoVertices.push([0, 0, 0], pos);

            return new qtek3d.Mesh({
                geometry : lineGeo,
                material : mat,
                mode : qtek3d.Mesh.LINES,
                lineWidth : 1
            });
        }

        var node = new qtek3d.Node();
        node.add(createLine([len, 0, 0], [1, 0, 0]));
        node.add(createLine([0, len, 0], [0, 1, 0]));
        node.add(createLine([0, 0, len], [0, 0, 1]));

        return node
    }

    function createSkeletonDebugScene(skeleton, linkNode, qtek) {
        var qtek3d = qtek['3d'];
        var scene = new qtek3d.Scene();
        var sphereGeo = new qtek3d.geometry.Sphere({
            radius : 2
        });
        var sphereMat = new qtek3d.Material({
            shader : new qtek3d.Shader({
                vertex : qtek3d.Shader.source("buildin.basic.vertex"),
                fragment : qtek3d.Shader.source("buildin.basic.fragment")
            })
        });
        sphereMat.set("color", [0.7, 0.7, 0.7]);

        var jointDebugSpheres = [];
        skeleton.joints.forEach(function(joint) {
            var parentJoint = skeleton.joints[joint.parentIndex];
            var sphere = new qtek3d.Mesh({
                geometry : sphereGeo,
                material : sphereMat,
                autoUpdateLocalTransform : false
            });
            scene.add(sphere);

            var lineStart = new qtek.core.Vector3();
            var lineEnd = new qtek.core.Vector3();
            var lineGeo = new qtek3d.Geometry();
            var lineGeoVertices = lineGeo.attributes.position.value;
            lineGeoVertices.push(lineStart._array, lineEnd._array);
            var line = new qtek3d.Mesh({
                geometry : lineGeo,
                material : sphereMat,
                mode : qtek3d.Mesh.LINES,
                lineWidth : 2
            });
            scene.add(line);

            joint.on("afterupdate", function() {
                var parentSphere = jointDebugSpheres[joint.parentIndex];
                sphere.localTransform.copy(linkNode.worldTransform).multiply(joint.worldTransform);
                if (parentSphere) {
                    sphere.getWorldPosition(lineStart);
                    parentSphere.getWorldPosition(lineEnd);
                }
                lineGeo.dirty('position');
            });
            jointDebugSpheres.push(sphere);
        });

        return scene;
    }

    var renderer = new qtek3d.Renderer({
        canvas : document.getElementById("ViewPort")
    });
    renderer.resize($(window).width(), $(window).height());

    var GLTFLoader = new qtek.loader.GLTF();
    var matExtend, heroShaderFrag;
    $.get("ogre_magi/mat_extend.json", function(_matExtend) {
        $.get("shader/hero_frag.essl", function(_heroFrag) {
            matExtend = _matExtend;
            heroShaderFrag = _heroFrag;
            GLTFLoader.load("ogre_magi/ogre_magi.json");
        });
    });

    GLTFLoader.on("load", function(scene, cameras, skeleton) {
        var camera = cameras[Object.keys(cameras)[0]];
        if (!camera) {
            camera = new qtek3d.camera.Perspective({
                aspect : renderer.canvas.width/renderer.canvas.height,
                far : 1000
            });

            camera.position.set(20, 20, 20);
            camera.lookAt(new qtek.core.Vector3(0, 20, 0));
        }
        camera.aspect = renderer.canvas.width / renderer.canvas.height;

        var control = new qtek3d.plugin.OrbitControl({
            camera : camera,
            canvas : renderer.canvas,
            sensitivity : 0.4
        });
        // z up
        control.enable();

        var light = new qtek3d.light.Directional({
            intensity : 0.6
        });
        light.position.set(10, 10, 10);
        light.lookAt(new qtek.core.Vector3(0, 0, 0), new qtek.core.Vector3(0, 0, 1));
        scene.add(light);
        scene.add(new qtek3d.light.Ambient({
            intensity : 0.4
        }));

        var skeletonDebugScene = createSkeletonDebugScene(skeleton, scene.children[0], qtek);

        var axisScene = new qtek3d.Scene();
        for (var i = 0; i < scene.children.length; i++) {
            var node = scene.children[i];
            if (node.instanceof(qtek3d.light.Ambient)) {
                continue;
            }
            (function(node) {
                var axis = createDebugAxis(50, qtek);
                axis.autoUpdateLocalTransform = false;
                node.on("afterupdate", function() {
                    axis.localTransform.copy(node.worldTransform);
                });
                axisScene.add(axis);
            })(node);
        }
        skeleton.joints.forEach(function(node) {
            var axis = createDebugAxis(10, qtek);
            axis.autoUpdateLocalTransform = false;
            axisScene.add(axis);
            node.on('afterupdate', function() {
                axis.localTransform.copy(scene.children[0].worldTransform).multiply(node.worldTransform);
            });
        });

        skeleton.update();

        scene.rotation.rotateX(-Math.PI/2);
        scene.scale.set(0.1, 0.1, 0.1);
        scene.update();

        scene.traverse(function(node) {
            if (node.geometry) {
                node.geometry = node.geometry.convertToGeometry();
                node.geometry.generateTangents();
            }
            if (node.material) {
                var mat = node.material;
                var shader = mat.shader;
                shader.setFragment(heroShaderFrag);
                // reattach
                mat.attachShader(shader);
                shader.enableTexturesAll();
                // shader.define('fragment', 'RENDER_SPECULAR_COLOR');
            }
        });

        for (var name in matExtend) {
            var params = matExtend[name];
            var mat = qtek3d.Material.getMaterial(name);
            var Texture2D = qtek3d.texture.Texture2D;
            if (mat) {
                ['diffuseMap', 'normalMap', 'maskMap1', 'maskMap2']
                    .forEach(function(name) {
                        if (params[name] !== undefined) {
                            var texture = new Texture2D({
                                wrapS : qtek3d.Texture.REPEAT,
                                wrapT : qtek3d.Texture.REPEAT
                            });
                            texture.load(params[name]);
                            mat.set(name, texture);
                        }
                    });
                ['u_SpecularExponent', 'u_SpecularScale', 'u_SpecularColor', 'u_RimLightScale', 'u_RimLightColor']
                    .forEach(function(name) {
                        if (params[name] !== undefined) {
                            mat.set(name, params[name]);
                        }
                    });
            }
        }
        
        var clearAll = renderer.clear;

        var time = new Date().getTime();
        var frame = 0;
        var showSkeleton = false;
        var showAxis = false;

        function render() {
            var timeNow = new Date().getTime();
            var deltaTime = timeNow - time;
            time = timeNow;
            // 30fps
            frame += deltaTime / 1000 * 30;
            skeleton.setPose(frame % frameLen);

            renderer.clear = clearAll;
            renderer.render(scene, camera);
            renderer.clear = renderer.gl.DEPTH_BUFFER_BIT;
            if (showAxis) {
                renderer.render(axisScene, camera);
            }
            if (showSkeleton) {
                renderer.render(skeletonDebugScene, camera);
            }
            
            requestAnimationFrame(render);
        }

        // Animations
        var joints = {};
        for (var i = 0; i < skeleton.joints.length; i++) {
            joints[skeleton.joints[i].name] = skeleton.joints[i];
        }
        var frameLen = 0;
        $.get('ogre_magi/smd/idle.smd', function(animationData) {
            var frames = window.readSMD(animationData, qtek);
            for (var name in frames) {
                joints[name].poses = frames[name];
                frameLen = frames[name].length;
            }
        });
        $("#Actions .button").click(function() {
            var url = "ogre_magi/smd/" + this.getAttribute("data-smd");
            $.get(url, function(animationData) {
                var frames = window.readSMD(animationData, qtek);
                for (var name in frames) {
                    joints[name].poses = frames[name];
                    frameLen = frames[name].length;
                }
            });

            $("#Actions .button").removeClass('active');
            $(this).addClass('active');
        });

        $("#Shadings .button").click(function() {
            var shading = this.getAttribute("data-shading");
            scene.traverse(function(node) {
                if (node.material) {
                    node.material.shader.unDefine("fragment", "RENDER_NORMAL");
                    node.material.shader.unDefine("fragment", "RENDER_WEIGHT");
                    node.material.set('lineWidth', 0);
                    if (shading == 'normal') {
                        node.material.shader.define("fragment", "RENDER_NORMAL");
                    } else if (shading == 'weight') {
                        node.material.shader.define("fragment", "RENDER_WEIGHT");
                    } else if (shading == 'wireframe') {
                        node.material.set('lineWidth', 1);
                        node.material.set('lineColor', [0.5, 0.5, 0.5]);
                    }
                }
            });
            $("#Shadings .button").removeClass('active');
            $(this).addClass('active');
        });
        $(".checkbox").checkbox();

        $("#ShowSkeleton").click(function() {
            showSkeleton = $(this).children("input").is(':checked')
        });
        $("#ShowAxis").click(function() {
            showAxis = $(this).children("input").is(':checked')
        });
        render();
    });
})();