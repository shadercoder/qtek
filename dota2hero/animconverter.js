var glMatrix = require('gl-matrix')
var glob = require('glob');
var fs = require('fs');

glob('**/*.smd', function(err, files) {

    files.forEach(function(file) {
        var content = fs.readFileSync(file, 'utf-8');
        var lines = content.split('\n');

        var joints = [];
        var frames = [];
        var currentFrame = 0;

        var handler = null;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            switch(line) {
                case 'nodes':
                    handler = handleJoint
                    break;
                case 'skeleton':
                    handler = handleAnimation
                    break;
                case 'end':
                    hanler = null;
                    break;
                default:
                    if (handler) {
                        handler(line)
                    }
            }
        }

        function handleJoint(line) {
            var items = line.split(/\s+/);
            if (items.length == 3) {
                var idx = parseInt(items[0]);
                var name = items[1].replace(/"/g, '');
                var parentIdx = items[2];
                joints[idx] = name;
            }
        }

        function handleAnimation(line) {
            var items = line.split(/\s+/);
            if (items[0] == 'time') {
                currentFrame = parseInt(items[1]);
            } else if(items.length == 7) {
                var idx = parseInt(items[0]);
                if (! frames[idx]) {
                    frames[idx] = []
                }
                var jointFrames = frames[idx];
                var frame = {
                    time : currentFrame,
                    position : [
                        parseFloat(items[1]),
                        parseFloat(items[2]),
                        parseFloat(items[3]),
                    ],
                    rotation : [
                        parseFloat(items[4]),
                        parseFloat(items[5]),
                        parseFloat(items[6])
                    ],
                    scale : [1, 1, 1]
                }
                var quat = glMatrix.quat.create();
                glMatrix.quat.rotateZ(quat, quat, parseFloat(items[6]));
                glMatrix.quat.rotateY(quat, quat, parseFloat(items[5]));
                glMatrix.quat.rotateX(quat, quat, parseFloat(items[4]));
                // frame.rotation = quat;
                jointFrames.push(frame);
            }
        }

        var ret = {};
        joints.forEach(function(joint, idx) {
            ret[joint] = frames[idx];
        });

        console.log(ret['thigh_L']);
    });
})