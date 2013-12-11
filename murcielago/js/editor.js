define(function(require) {
    
    var qpf = require('qpf');
    var xml = require('text!../editor.xml');
    var ko = require('knockout');
    
    require('../../common/ui/Viewport.js');
    require('../../common/ui/Color.js');

    var remoteMaterials = JSON.parse(require('text!../assets/materials.json'));

    var environment = require('./environment');

    var configVM = {
        kr : ko.observable(0.003),
        km : ko.observable(0.0077),
        time : ko.observable(8),

        material : {
            baseColor : ko.observable([1, 1, 1]),
            specularColor : ko.observable([0.8, 0.8, 0.8]),
            specularFactor : ko.observable(0.44),
            diffuseFactor : ko.observable(0.19),
            roughness : ko.observable(0.04),
            transparent : ko.observable(true)
        },

        materialList : ko.observableArray(),

        selectedMaterial : null,

        selectMaterial : function(data) {
            var materialList = configVM.materialList();
            for (var i = 0; i < materialList.length; i++) {
                materialList[i].material.set('lineWidth', 0);
            }
            
            var materialVM = configVM.material;
            var material = data[0].material;
            material.set('lineWidth', 1);
            configVM.selectedMaterial = material;

            materialVM.baseColor(Array.prototype.slice.call(material.get('color')));
            materialVM.specularColor(Array.prototype.slice.call(material.get('specularColor')));
            materialVM.roughness(material.get('roughness'));
            materialVM.specularFactor(material.get('specularFactor'));
            materialVM.diffuseFactor(material.get('diffuseFactor'));
            materialVM.transparent(material.transparent);
        }
    }

    ko.computed(function() {

        var currentMaterial = configVM.material;
        var specularColor = currentMaterial.specularColor();
        var baseColor = currentMaterial.baseColor();
        var roughness = currentMaterial.roughness();
        var specularFactor = currentMaterial.specularFactor();
        var diffuseFactor = currentMaterial.diffuseFactor();
        var transparent = currentMaterial.transparent();

        var selectedMaterial = configVM.selectedMaterial;
        if (selectedMaterial) {
            setTimeout(function() {
                selectedMaterial.set('specularColor', specularColor);
                selectedMaterial.set('specularFactor', specularFactor);
                selectedMaterial.set('diffuseFactor', diffuseFactor);
                selectedMaterial.set('color', baseColor);
                selectedMaterial.transparent = transparent;

                if (environment.IBL) {
                    environment.IBL.applyToMaterial(selectedMaterial, roughness);
                }
            });
        }
    });

    return {
        init : function() {
            qpf.util.initFromXML(document.getElementById('App'), xml, configVM);
            var self = this;
            setInterval(function() {
                self.save()
            }, 1000);
        },

        environment : {
            kr : configVM.kr,
            km : configVM.km,
            time : configVM.time
        },

        setMaterials : function(materials) {
            var dataSource = [];
            for (var i = 0; i < materials.length; i++) {
                dataSource.push({
                    title : materials[i].name,
                    material : materials[i]
                })
            }
            configVM.materialList(dataSource);

            this.load(remoteMaterials);
            var localMaterials = localStorage.getItem('materials');
            if (localMaterials) {
                this.load(JSON.parse(localMaterials));
            }
        },

        save : function() {
            var materialsData = {};

            var materialList = configVM.materialList();
            materialList.forEach(function(item) {
                var material = item.material;
                materialsData[item.title] = {
                    color : material.get('color'),
                    specularColor : material.get('specularColor'),
                    specularFactor : material.get('specularFactor'),
                    diffuseFactor : material.get('diffuseFactor'),
                    roughness : material.get('roughness'),
                    transparent : material.transparent
                };
            });
            localStorage.setItem('materials', JSON.stringify(materialsData));
        },

        load : function(materialsData) {
            var materialList = configVM.materialList();
            materialList.forEach(function(item) {
                var material = item.material;
                var matData = materialsData[item.title];
                if (matData) {
                    material.set('color', matData.color);
                    material.set('specularColor', matData.specularColor);
                    material.set('specularFactor', matData.specularFactor);
                    material.set('diffuseFactor', matData.diffuseFactor);
                    material.set('roughness', matData.roughness);
                    material.transparent = matData.transparent;                
                }
            });
        }
    }
});