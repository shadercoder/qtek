define(function(require) {
    
    var qtek = require('qtek');
    var qtek3d = qtek['3d'];

    qtek3d.Shader.import(require('text!./shader/IBL.essl'));

    var IBL = {
        generateGGXLookup : function() {
            // http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
            // GLSL not support bit operation, use lookup instead
            // V -> i / N, U -> roughness
            var ROUGHNESS_LEVELS = 512;
            var SAMPLE_SIZE = 512;

            var GGXLookup = new qtek3d.texture.Texture2D({
                width : ROUGHNESS_LEVELS,
                height : SAMPLE_SIZE,
                type : qtek3d.Texture.FLOAT,
                minFilter : qtek3d.Texture.NEAREST,
                magFilter : qtek3d.Texture.NEAREST,
                useMipmaps : false
            });
            var pixels = new Float32Array(SAMPLE_SIZE * ROUGHNESS_LEVELS * 4);
            for (var i = 0; i < SAMPLE_SIZE; i++) {
                var x = i / SAMPLE_SIZE;
                // http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators
                // http://stackoverflow.com/questions/1908492/unsigned-integer-in-javascript
                // http://stackoverflow.com/questions/1822350/what-is-the-javascript-operator-and-how-do-you-use-it
                var y = (i << 16 | i >>> 16) >>> 0;
                y = ((y & 1431655765) << 1 | (y & 2863311530) >>> 1) >>> 0;
                y = ((y & 858993459) << 2 | (y & 3435973836) >>> 2) >>> 0;
                y = ((y & 252645135) << 4 | (y & 4042322160) >>> 4) >>> 0;
                y = (((y & 16711935) << 8 | (y & 4278255360) >>> 8) >>> 0) / 4294967296;

                for (var j = 0; j < ROUGHNESS_LEVELS; j++) {
                    var roughness = j / ROUGHNESS_LEVELS;
                    var a = roughness * roughness;
                    var phi = 2.0 * Math.PI * x;
                    // CDF
                    var cosTheta = Math.sqrt((1 - y) / (1 + (a*a - 1.0) * y));
                    var sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);
                    var offset = (i * ROUGHNESS_LEVELS + j) * 4;
                    pixels[offset] = sinTheta * Math.cos(phi);
                    pixels[offset+1] = sinTheta * Math.sin(phi);
                    pixels[offset+2] = cosTheta;
                    pixels[offset+3] = 1.0;
                }
            }
            GGXLookup.pixels = pixels;

            return GGXLookup;
        }
    }

    return IBL;
});