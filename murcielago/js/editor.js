define(function(require) {
    
    var qpf = require('qpf');
    var xml = require('text!../editor.xml');
    var ko = require('knockout');
    
    require('./viewport.js');

    var configVM = {
        kr : ko.observable(0.004),
        km : ko.observable(0.010),
        time : ko.observable(7),

        material : {
            baseColor : ko.observable(0xffffff),
            specularColor : ko.observable(0xffffff),

        }
    }
    return {
        init : function() {
            qpf.util.initFromXML(document.getElementById('App'), xml, configVM);
        },
        config : configVM
    }
});