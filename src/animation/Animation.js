define(function(require) {
    
    'use strict';

    var Clip = require('./Clip');
    var Base = require('../core/Base');

    var requestAnimationFrame = window.requestAnimationFrame
                                || window.msRequestAnimationFrame
                                || window.mozRequestAnimationFrame
                                || window.webkitRequestAnimationFrame
                                || function(func){setTimeout(func, 16)};

    var arraySlice = Array.prototype.slice;

    var Animation = Base.derive(function() {
        return {
            stage : null,

            _clips : [],

            _running : false,
            
            _time : 0
        }
    }, {
        addClip : function(clip) {
            this._clips.push(clip);
        },
        removeClip : function(clip) {
            var idx = this._clips.indexOf(clip);
            clip = this._clips.pop();
            this._clips[idx] = clip;
        },
        update : function() {
            
            var time = new Date().getTime();
            var delta = time - this._time;
            var clips = this._clips;
            var len = clips.length;

            var deferredEvents = [];
            var deferredClips = [];
            for (var i = 0; i < len; i++) {
                var clip = clips[i];
                var e = clip.step(time);
                // Throw out the events need to be called after
                // stage.render, like destroy
                if (e) {
                    deferredEvents.push(e);
                    deferredClips.push(clip);
                }
            }
            if (this.stage
                && this.stage.render
                && this._clips.length
            ) {
                this.stage.render();
            }

            // Remove the finished clip
            for (var i = 0; i < len;) {
                if (clips[i]._needsRemove) {
                    clips[i] = clips[len-1];
                    clips.pop();
                    len--;
                } else {
                    i++;
                }
            }

            len = deferredEvents.length;
            for (var i = 0; i < len; i++) {
                deferredClips[i].fire(deferredEvents[i]);
            }

            this._time = time;

            this.trigger('frame', delta);
        },
        start : function() {
            var self = this;

            this._running = true;
            this._time = new Date().getTime();

            function step() {
                if (self._running) {
                    
                    requestAnimationFrame(step);

                    self.update();
                }
            }

            requestAnimationFrame(step);
        },
        stop : function() {
            this._running = false;
        },
        removeClipsAll : function() {
            this._clips = [];
        },
        animate : function(target, options) {
            options = options || {};
            var deferred = new Deferred(
                target,
                options.loop,
                options.getter, 
                options.setter
            );
            deferred.animation = this;
            return deferred;
        }
    });

    function _defaultGetter(target, key) {
        return target[key];
    }
    function _defaultSetter(target, key, value) {
        target[key] = value;
    }

    function _interpolateNumber(p0, p1, percent) {
        return (p1 - p0) * percent + p0;
    }

    function _interpolateArray(p0, p1, percent, out, arrDim) {
        var len = p0.length;
        if (arrDim == 1) {
            for (var i = 0; i < len; i++) {
                out[i] = _interpolateNumber(p0[i], p1[i], percent); 
            }
        } else {
            var len2 = p0[0].length;
            for (var i = 0; i < len; i++) {
                for (var j = 0; j < len2; j++) {
                    out[i][j] = _interpolateNumber(
                        p0[i][j], p1[i][j], percent
                    );
                }
            }
        }
    }

    function _isArrayLike(data) {
        if (data === undefined) {
            return false;
        } else if (typeof(data) == 'string') {
            return false;
        } else {
            return data.length !== undefined;
        }
    }

    function _catmullRomInterpolateArray(
        p0, p1, p2, p3, t, t2, t3, out, arrDim
    ) {
        var len = p0.length;
        if (arrDim == 1) {
            for (var i = 0; i < len; i++) {
                out[i] = _catmullRomInterpolate(
                    p0[i], p1[i], p2[i], p3[i], t, t2, t3
                );
            }
        } else {
            var len2 = p0[0].length;
            for (var i = 0; i < len; i++) {
                for (var j = 0; j < len2; j++) {
                    out[i][j] = _catmullRomInterpolate(
                        p0[i][j], p1[i][j], p2[i][j], p3[i][j],
                        t, t2, t3
                    );
                }
            }
        }
    }
    
    function _catmullRomInterpolate(p0, p1, p2, p3, t, t2, t3) {
        var v0 = (p2 - p0) * 0.5;
        var v1 = (p3 - p1) * 0.5;
        return (2 * (p1 - p2) + v0 + v1) * t3 
                + (- 3 * (p1 - p2) - 2 * v0 - v1) * t2
                + v0 * t + p1;
    };
    
    function Deferred(target, loop, getter, setter) {
        this._tracks = {};
        this._target = target;

        this._loop = loop || false;

        this._getter = getter || _defaultGetter;
        this._setter = setter || _defaultSetter;

        this._clipCount = 0;

        this._delay = 0;

        this._doneList = [];

        this._onframeList = [];

        this._clipList = [];
    }

    Deferred.prototype = {
        when : function(time /* ms */, props) {
            for (var propName in props) {
                if (! this._tracks[propName]) {
                    this._tracks[propName] = [];
                    // Initialize value
                    this._tracks[propName].push({
                        time : 0,
                        value : this._getter(this._target, propName)
                    });
                }
                this._tracks[propName].push({
                    time : parseInt(time),
                    value : props[propName]
                });
            }
            return this;
        },
        during : function(callback) {
            this._onframeList.push(callback);
            return this;
        },
        start : function(easing) {

            var self = this;
            var setter = this._setter;
            var getter = this._getter;
            var onFrameListLen = self._onframeList.length;
            var useSpline = easing === 'spline';

            var ondestroy = function() {
                self._clipCount--;
                if (self._clipCount === 0) {
                    // Clear all tracks
                    self._tracks = {};

                    var len = self._doneList.length;
                    for (var i = 0; i < len; i++) {
                        self._doneList[i].call(self);
                    }
                }
            }

            var createTrackClip = function(keyframes, propName) {
                var trackLen = keyframes.length;
                if (!trackLen) {
                    return;
                }
                // Guess data type
                var firstVal = keyframes[0].value;
                var isValueArray = _isArrayLike(firstVal);

                // For vertices morphing
                var arrDim = (
                        isValueArray 
                        && _isArrayLike(firstVal[0])
                    )
                    ? 2 : 1;
                // Sort keyframe as ascending
                keyframes.sort(function(a, b) {
                    return a.time - b.time;
                });
                if (trackLen) {
                    var trackMaxTime = keyframes[trackLen-1].time;
                }else{
                    return;
                }
                // Percents of each keyframe
                var kfPercents = [];
                // Value of each keyframe
                var kfValues = [];
                for (var i = 0; i < trackLen; i++) {
                    kfPercents.push(keyframes[i].time / trackMaxTime);
                    if (isValueArray) {
                        if (arrDim == 2) {
                            kfValues[i] = [];
                            for (var j = 0; j < firstVal.length; j++) {
                                kfValues[i].push(arraySlice.call(keyframes[i].value[j]));
                            }
                        } else {
                            kfValues.push(arraySlice.call(keyframes[i].value));
                        }
                    } else {
                        kfValues.push(keyframes[i].value);
                    }
                }

                // Cache the key of last frame to speed up when 
                // animation playback is sequency
                var cacheKey = 0;
                var cachePercent = 0;
                var start;
                var i, w;
                var p0, p1, p2, p3;

                var onframe = function(target, percent) {
                    // Find the range keyframes
                    // kf1-----kf2---------current--------kf3
                    // find kf2(i) and kf3(i+1) and do interpolation
                    if (percent < cachePercent) {
                        // Start from next key
                        start = Math.min(cacheKey + 1, trackLen - 1);
                        for (i = start; i >= 0; i--) {
                            if (kfPercents[i] <= percent) {
                                break;
                            }
                        }
                        i = Math.min(i, trackLen-2);
                    } else {
                        for (i = cacheKey; i < trackLen; i++) {
                            if (kfPercents[i] > percent) {
                                break;
                            }
                        }
                        i = Math.min(i-1, trackLen-2);
                    }
                    cacheKey = i;
                    cachePercent = percent;

                    var range = (kfPercents[i+1] - kfPercents[i]);
                    if (range == 0) {
                        return;
                    } else {
                        w = (percent - kfPercents[i]) / range;
                    }
                    if (useSpline) {
                        p1 = kfValues[i];
                        p0 = kfValues[i == 0 ? i : i - 1];
                        p2 = kfValues[i > trackLen - 2 ? trackLen - 1 : i + 1];
                        p3 = kfValues[i > trackLen - 3 ? trackLen - 1 : i + 2];
                        if (isValueArray) {
                            _catmullRomInterpolateArray(
                                p0, p1, p2, p3, w, w*w, w*w*w,
                                getter(target, propName),
                                arrDim
                            );
                        } else {
                            setter(
                                target,
                                propName,
                                _catmullRomInterpolate(p0, p1, p2, p3, w, w*w, w*w*w)
                            );
                        }
                    } else {
                        if (isValueArray) {
                            _interpolateArray(
                                kfValues[i], kfValues[i+1], w,
                                getter(target, propName),
                                arrDim
                            );
                        } else {
                            setter(
                                target,
                                propName,
                                _interpolateNumber(kfValues[i], kfValues[i+1], w)
                            );
                        }
                    }

                    for (i = 0; i < onFrameListLen; i++) {
                        self._onframeList[i](target, percent);
                    }
                };

                var clip = new Clip({
                    target : self._target,
                    life : trackMaxTime,
                    loop : self._loop,
                    delay : self._delay,
                    onframe : onframe,
                    ondestroy : ondestroy
                });

                if (easing && easing !== 'spline') {
                    clip.setEasing(easing);
                }
                self._clipList.push(clip);
                self._clipCount++;
                self.animation.addClip(clip);
            }


            for (var propName in this._tracks) {
                createTrackClip(this._tracks[propName], propName);
            }
            return this;
        },
        stop : function() {
            for (var i = 0; i < this._clipList.length; i++) {
                var clip = this._clipList[i];
                this.animation.removeClip(clip);
            }
            this._clipList = [];
        },
        delay : function(time){
            this._delay = time;
            return this;
        },
        done : function(func) {
            this._doneList.push(func);
            return this;
        }
    };

    return Animation;
});
