define(function(require) {
    
    var qpf = require('qpf');
    var xml = require('text!../editor.xml');
    var ko = require('knockout');
    
    require('../../common/ui/Viewport.js');
    require('../../common/ui/Color.js');

    var IBL;

    var configVM = {
        kr : ko.observable(0.004),
        km : ko.observable(0.010),
        time : ko.observable(6.5),

        material : {
            baseColor : ko.observable([1, 1, 1]),
            specularColor : ko.observable([0.8, 0.8, 0.8]),
            specularFactor : ko.observable(0.44),
            diffuseFactor : ko.observable(0.19),
            roughness : ko.observable(0.04)
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
        }
    }

    ko.computed(function() {

        var currentMaterial = configVM.material;
        var specularColor = currentMaterial.specularColor();
        var baseColor = currentMaterial.baseColor();
        var roughness = currentMaterial.roughness();
        var specularFactor = currentMaterial.specularFactor();
        var diffuseFactor = currentMaterial.diffuseFactor();

        var selectedMaterial = configVM.selectedMaterial;
        if (selectedMaterial) {
            setTimeout(function() {
                selectedMaterial.set('specularColor', specularColor);
                selectedMaterial.set('specularFactor', specularFactor);
                selectedMaterial.set('diffuseFactor', diffuseFactor);
                selectedMaterial.set('color', baseColor);

                if (IBL) {
                    IBL.applyToMaterial(selectedMaterial, roughness);
                }
            });
        }
    });

    return {
        init : function() {
            qpf.util.initFromXML(document.getElementById('App'), xml, configVM);
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
        },

        setIBL : function(_IBL) {
            IBL = _IBL;
        }
    }
});