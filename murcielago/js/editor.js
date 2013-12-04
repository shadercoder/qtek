define(function(require) {
    
    var qpf = require('qpf');
    var xml = require('text!../editor.xml');
    var ko = require('knockout');
    
    require('../../common/ui/Viewport.js');
    require('../../common/ui/Color.js');

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
        }
    }
    return {
        init : function() {
            qpf.util.initFromXML(document.getElementById('App'), xml, configVM);
        },
        config : configVM
    }
});