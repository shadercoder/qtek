define(function(require) {

    var qtek = require('qtek');
    var qtek3d = qtek['3d'];

    qtek3d.Shader.import(require('text!./shader/atmosphere.essl'));
    var sphereGeo = new qtek3d.geometry.Sphere({
        widthSegments : 100,
        heightSegments : 100
    });
    var environmentMapPass = new qtek3d.prePass.EnvironmentMap();

    var Atmosphere = qtek.core.Base.derive(function() {
        return {
            texture : null,
            // Directional light
            light : null,

            mipmaps : [],
            // Configs
            outerRadius : 10.25,
            innerRadius : 10.00,
            kr : 0.0025,
            km : 0.0010,
            ESun : 20,
            g : 0.99,

            _mesh : null,
            _scene : null,
            _camera : null
        }
    }, function() {
        var material = new qtek3d.Material({
            shader : new qtek3d.Shader({
                vertex : qtek3d.Shader.source('atmosphere.vertex'),
                fragment : qtek3d.Shader.source('atmosphere.fragment')
            })
        });
        this._mesh = new qtek3d.Mesh({
            geometry : sphereGeo,
            material : material
        });
        this._mesh.culling = false;
        this._mesh.scale.set(this.outerRadius, this.outerRadius, this.outerRadius);

        this._scene = new qtek3d.Scene();
        this._scene.add(this._mesh);

        this._camera = new qtek3d.camera.Perspective();
        this._camera.position.set(0, 10.01, 0);
    }, {
        render : function(renderer) {
            if (!this.light || !this.texture) {
                return;
            }
            this._mesh.material.set('lightDirection', this.light.worldTransform.forward._array);
            this._mesh.material.set('cameraPos', this._camera.position._array);
            this._mesh.material.set('invWavelength', [1 / Math.pow(0.65, 4), 1 / Math.pow(0.57, 4), 1 / Math.pow(0.475, 4)]);
            environmentMapPass.texture = this.texture;
            environmentMapPass.position.copy(this._camera.position);
            environmentMapPass.render(renderer, this._scene);
            // renderer.render(this._scene, this._camera);
        }
    });

    return Atmosphere;
});