 (function(factory){
 	// AMD
 	if( typeof define !== "undefined" && define["amd"] ){
 		define( ["exports"], factory.bind(window) );
 	// No module loader
 	}else{
 		factory( window["qtek"] = {} );
 	}

})(function(_exports){

/**
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../build/almond", function(){});

;
define("2d/camera", function(){});

define('core/mixin/derive',[],function(){

/**
 * derive a sub class from base class
 * @makeDefaultOpt [Object|Function] default option of this sub class, 
                        method of the sub can use this.xxx to access this option
 * @initialize [Function](optional) initialize after the sub class is instantiated
 * @proto [Object](optional) prototype methods/property of the sub class
 *
 * @export{object}
 */
function derive(makeDefaultOpt, initialize/*optional*/, proto/*optional*/){

    if( typeof initialize == "object"){
        proto = initialize;
        initialize = null;
    }

    // extend default prototype method
    var extendedProto = {
        // instanceof operator cannot work well,
        // so we write a method to simulate it
        'instanceof' : function(constructor){
            var selfConstructor = sub;
            while(selfConstructor){
                if( selfConstructor === constructor ){
                    return true;
                }
                selfConstructor = selfConstructor.__super__;
            }
        }
    }

    var _super = this;

    var sub = function(options){

        // call super constructor
        _super.call( this );

        // call defaultOpt generate function each time
        // if it is a function, So we can make sure each 
        // property in the object is fresh
        _.extend( this, typeof makeDefaultOpt == "function" ?
                        makeDefaultOpt.call(this) : makeDefaultOpt );

        _.extend( this, options );

        if( this.constructor == sub){
            // find the base class, and the initialize function will be called 
            // in the order of inherit
            var base = sub,
                initializeChain = [initialize];
            while(base.__super__){
                base = base.__super__;
                initializeChain.unshift( base.__initialize__ );
            }
            for(var i = 0; i < initializeChain.length; i++){
                if( initializeChain[i] ){
                    initializeChain[i].call( this );
                }
            }
        }
    };
    // save super constructor
    sub.__super__ = _super;
    // initialize function will be called after all the super constructor is called
    sub.__initialize__ = initialize;

    // extend prototype function
    _.extend( sub.prototype, _super.prototype, extendedProto, proto);

    sub.prototype.constructor = sub;
    
    // extend the derive method as a static method;
    sub.derive = _super.derive;


    return sub;
}

return {
    derive : derive
}

});
/**
 * Event interface
 *
 * @method on(eventName, handler[, context])
 * @method trigger(eventName[, arg1[, arg2]])
 * @method off(eventName[, handler])
 * @method has(eventName)
 * @export{object}
 */
define('core/mixin/notifier',[],function(){

    return{
        trigger : function(){
            if( ! this.__handlers__){
                return;
            }
            var name = arguments[0];
            var params = Array.prototype.slice.call( arguments, 1 );

            var handlers = this.__handlers__[ name ];
            if( handlers ){
                for( var i = 0; i < handlers.length; i+=2){
                    var handler = handlers[i],
                        context = handlers[i+1];
                    handler.apply(context || this, params);
                }
            }
        },
        
        on : function( target, handler, context/*optional*/ ){

            if( ! target){
                return;
            }
            var handlers = this.__handlers__ || ( this.__handlers__={} );
            if( ! handlers[target] ){
                handlers[target] = [];
            }
            if( handlers[target].indexOf(handler) == -1){
                // structure in list
                // [handler,context,handler,context,handler,context..]
                handlers[target].push( handler );
                handlers[target].push( context );
            }

            return handler;
        },

        off : function( target, handler ){
            
            var handlers = this.__handlers__ || ( this.__handlers__={} );

            if( handlers[target] ){
                if( handler ){
                    var arr = handlers[target];
                    // remove handler and context
                    var idx = arr.indexOf(handler);
                    if( idx >= 0)
                        arr.splice( idx, 2 );
                }else{
                    handlers[target] = [];
                }
            }
        },

        has : function( target, handler ){
            if( ! this.__handlers__ ||
                ! this.__handlers__[target] ){
                return false;
            }
            if( ! handler){
                return this.__handlers__[target].length;
            }else{
                return this.__handlers__[target].indexOf( handler ) !== -1;
            }
        }
    }
    
});
define('core/mixin/dirty', {

    dirty : function(propName){
        if( ! this._dirtyFlag ){
            this._dirtyFlag = {};
        }
        this._dirtyFlag[propName] = true;
    },
    
    fresh : function(propName){
        if( ! this._dirtyFlag ){
            this._dirtyFlag = {};
        }
        this._dirtyFlag[propName] = false;
    },

    
    isDirty : function(propName){
        if( ! this._dirtyFlag){
            this._dirtyFlag = {};
        }
        if(typeof(this._dirtyFlag[propName]) === "undefined"){
            return true;
        }
        return this._dirtyFlag[propName];
    },

} );
define('core/cache',[], function(){
    var Cache = function(){

        this._contextId = "",

        this._caches = {},

        this._context = {}

    }

    Cache.prototype = {

        use : function( contextId, documentSchema ){

            if( ! this._caches.hasOwnProperty( contextId ) ){
                this._caches[ contextId ] = {};

                if( documentSchema){
                    for(var name in documentSchema){
                        this._caches[contextId][ name ] = documentSchema[name];
                    }   
                }
            }
            this._contextId = contextId;

            this._context = this._caches[ contextId ];
        },

        put : function(key, value){

            this._context[ key ] = value;
        },

        get : function(key){

            return this._context[ key ];
        },

        clearContext : function(){
            this._caches[ this._contextId ] = {};
            this._context = {};
        },

        'delete' : function( key ){
            delete this._context[ key ];
        },

        clearAll : function(){
            this._caches = {};
        },

        getContext : function(){
            return this._context;
        },

        miss : function( key ){
            return ! this._context.hasOwnProperty( key );
        }
    }

    Cache.prototype.constructor = Cache;

    return Cache;

} );
/**
 * @license
 * Lo-Dash 1.2.0 (Custom Build) lodash.com/license
 * Build: `lodash modern -o ./dist/lodash.js`
 * Underscore.js 1.4.4 underscorejs.org/LICENSE
 */
;(function(n){function t(o){function f(n){if(!n||re.call(n)!=S)return a;var t=n.valueOf,e=typeof t=="function"&&(e=Yt(t))&&Yt(e);return e?n==e||Yt(n)==e:X(n)}function q(n,t,e){if(!n||!F[typeof n])return n;t=t&&typeof e=="undefined"?t:M.createCallback(t,e);for(var r=-1,u=F[typeof n]?me(n):[],o=u.length;++r<o&&(e=u[r],!(t(n[e],e,n)===a)););return n}function D(n,t,e){var r;if(!n||!F[typeof n])return n;t=t&&typeof e=="undefined"?t:M.createCallback(t,e);for(r in n)if(t(n[r],r,n)===a)break;return n}function z(n,t,e){var r,u=n,a=u;
if(!u)return a;for(var o=arguments,i=0,f=typeof e=="number"?2:o.length;++i<f;)if((u=o[i])&&F[typeof u]){var c=u.length;if(r=-1,he(u))for(;++r<c;)"undefined"==typeof a[r]&&(a[r]=u[r]);else for(var l=-1,p=F[typeof u]?me(u):[],c=p.length;++l<c;)r=p[l],"undefined"==typeof a[r]&&(a[r]=u[r])}return a}function P(n,t,e){var r,u=n,a=u;if(!u)return a;var o=arguments,i=0,f=typeof e=="number"?2:o.length;if(3<f&&"function"==typeof o[f-2])var c=M.createCallback(o[--f-1],o[f--],2);else 2<f&&"function"==typeof o[f-1]&&(c=o[--f]);
for(;++i<f;)if((u=o[i])&&F[typeof u]){var l=u.length;if(r=-1,he(u))for(;++r<l;)a[r]=c?c(a[r],u[r]):u[r];else for(var p=-1,s=F[typeof u]?me(u):[],l=s.length;++p<l;)r=s[p],a[r]=c?c(a[r],u[r]):u[r]}return a}function K(n){var t,e=[];if(!n||!F[typeof n])return e;for(t in n)Zt.call(n,t)&&e.push(t);return e}function M(n){return n&&typeof n=="object"&&!he(n)&&Zt.call(n,"__wrapped__")?n:new Q(n)}function U(n){var t=n.length,e=t>=s;if(e)for(var r={},u=-1;++u<t;){var a=p+n[u];(r[a]||(r[a]=[])).push(n[u])}return function(t){if(e){var u=p+t;
return r[u]&&-1<Ct(r[u],t)}return-1<Ct(n,t)}}function V(n){return n.charCodeAt(0)}function G(n,t){var e=n.b,r=t.b;if(n=n.a,t=t.a,n!==t){if(n>t||typeof n=="undefined")return 1;if(n<t||typeof t=="undefined")return-1}return e<r?-1:1}function H(n,t,e,r){function a(){var r=arguments,l=i?this:t;return o||(n=t[f]),e.length&&(r=r.length?(r=ve.call(r),c?r.concat(e):e.concat(r)):e),this instanceof a?(W.prototype=n.prototype,l=new W,W.prototype=u,r=n.apply(l,r),at(r)?r:l):n.apply(l,r)}var o=ut(n),i=!e,f=t;if(i){var c=r;
e=t}else if(!o){if(!r)throw new Ut;t=n}return a}function J(n){return"\\"+R[n]}function L(n){return be[n]}function Q(n){this.__wrapped__=n}function W(){}function X(n){var t=a;if(!n||re.call(n)!=S)return t;var e=n.constructor;return(ut(e)?e instanceof e:1)?(D(n,function(n,e){t=e}),t===a||Zt.call(n,t)):t}function Y(n,t,e){t||(t=0),typeof e=="undefined"&&(e=n?n.length:0);var r=-1;e=e-t||0;for(var u=Ft(0>e?0:e);++r<e;)u[r]=n[t+r];return u}function Z(n){return de[n]}function nt(n,t,r,u,o,i){var f=n;if(typeof t=="function"&&(u=r,r=t,t=a),typeof r=="function"){if(r=typeof u=="undefined"?r:M.createCallback(r,u,1),f=r(f),typeof f!="undefined")return f;
f=n}if(u=at(f)){var c=re.call(f);if(!B[c])return f;var l=he(f)}if(!u||!t)return u?l?Y(f):P({},f):f;switch(u=ge[c],c){case E:case I:return new u(+f);case N:case $:return new u(f);case A:return u(f.source,b.exec(f))}for(o||(o=[]),i||(i=[]),c=o.length;c--;)if(o[c]==n)return i[c];return f=l?u(f.length):{},l&&(Zt.call(n,"index")&&(f.index=n.index),Zt.call(n,"input")&&(f.input=n.input)),o.push(n),i.push(f),(l?gt:q)(n,function(n,u){f[u]=nt(n,t,r,e,o,i)}),f}function tt(n){var t=[];return D(n,function(n,e){ut(n)&&t.push(e)
}),t.sort()}function et(n){for(var t=-1,e=me(n),r=e.length,u={};++t<r;){var a=e[t];u[n[a]]=a}return u}function rt(n,t,e,o,i,f){var c=e===l;if(typeof e=="function"&&!c){e=M.createCallback(e,o,2);var p=e(n,t);if(typeof p!="undefined")return!!p}if(n===t)return 0!==n||1/n==1/t;var s=typeof n,v=typeof t;if(n===n&&(!n||"function"!=s&&"object"!=s)&&(!t||"function"!=v&&"object"!=v))return a;if(n==u||t==u)return n===t;if(v=re.call(n),s=re.call(t),v==x&&(v=S),s==x&&(s=S),v!=s)return a;switch(v){case E:case I:return+n==+t;
case N:return n!=+n?t!=+t:0==n?1/n==1/t:n==+t;case A:case $:return n==Mt(t)}if(s=v==O,!s){if(Zt.call(n,"__wrapped__")||Zt.call(t,"__wrapped__"))return rt(n.__wrapped__||n,t.__wrapped__||t,e,o,i,f);if(v!=S)return a;var v=n.constructor,g=t.constructor;if(v!=g&&(!ut(v)||!(v instanceof v&&ut(g)&&g instanceof g)))return a}for(i||(i=[]),f||(f=[]),v=i.length;v--;)if(i[v]==n)return f[v]==t;var y=0,p=r;if(i.push(n),f.push(t),s){if(v=n.length,y=t.length,p=y==n.length,!p&&!c)return p;for(;y--;)if(s=v,g=t[y],c)for(;s--&&!(p=rt(n[s],g,e,o,i,f)););else if(!(p=rt(n[y],g,e,o,i,f)))break;
return p}return D(t,function(t,r,u){return Zt.call(u,r)?(y++,p=Zt.call(n,r)&&rt(n[r],t,e,o,i,f)):void 0}),p&&!c&&D(n,function(n,t,e){return Zt.call(e,t)?p=-1<--y:void 0}),p}function ut(n){return typeof n=="function"}function at(n){return n?F[typeof n]:a}function ot(n){return typeof n=="number"||re.call(n)==N}function it(n){return typeof n=="string"||re.call(n)==$}function ft(n,t,e){var r=arguments,u=0,a=2;if(!at(n))return n;if(e===l)var o=r[3],i=r[4],c=r[5];else i=[],c=[],typeof e!="number"&&(a=r.length),3<a&&"function"==typeof r[a-2]?o=M.createCallback(r[--a-1],r[a--],2):2<a&&"function"==typeof r[a-1]&&(o=r[--a]);
for(;++u<a;)(he(r[u])?gt:q)(r[u],function(t,e){var r,u,a=t,p=n[e];if(t&&((u=he(t))||f(t))){for(a=i.length;a--;)if(r=i[a]==t){p=c[a];break}if(!r){var s;o&&(a=o(p,t),s=typeof a!="undefined")&&(p=a),s||(p=u?he(p)?p:[]:f(p)?p:{}),i.push(t),c.push(p),s||(p=ft(p,t,l,o,i,c))}}else o&&(a=o(p,t),typeof a=="undefined"&&(a=t)),typeof a!="undefined"&&(p=a);n[e]=p});return n}function ct(n){for(var t=-1,e=me(n),r=e.length,u=Ft(r);++t<r;)u[t]=n[e[t]];return u}function lt(n,t,e){var r=-1,u=n?n.length:0,o=a;return e=(0>e?ce(0,u+e):e)||0,typeof u=="number"?o=-1<(it(n)?n.indexOf(t,e):Ct(n,t,e)):q(n,function(n){return++r<e?void 0:!(o=n===t)
}),o}function pt(n,t,e){var u=r;t=M.createCallback(t,e),e=-1;var a=n?n.length:0;if(typeof a=="number")for(;++e<a&&(u=!!t(n[e],e,n)););else q(n,function(n,e,r){return u=!!t(n,e,r)});return u}function st(n,t,e){var r=[];t=M.createCallback(t,e),e=-1;var u=n?n.length:0;if(typeof u=="number")for(;++e<u;){var a=n[e];t(a,e,n)&&r.push(a)}else q(n,function(n,e,u){t(n,e,u)&&r.push(n)});return r}function vt(n,t,e){t=M.createCallback(t,e),e=-1;var r=n?n.length:0;if(typeof r!="number"){var u;return q(n,function(n,e,r){return t(n,e,r)?(u=n,a):void 0
}),u}for(;++e<r;){var o=n[e];if(t(o,e,n))return o}}function gt(n,t,e){var r=-1,u=n?n.length:0;if(t=t&&typeof e=="undefined"?t:M.createCallback(t,e),typeof u=="number")for(;++r<u&&t(n[r],r,n)!==a;);else q(n,t);return n}function yt(n,t,e){var r=-1,u=n?n.length:0;if(t=M.createCallback(t,e),typeof u=="number")for(var a=Ft(u);++r<u;)a[r]=t(n[r],r,n);else a=[],q(n,function(n,e,u){a[++r]=t(n,e,u)});return a}function ht(n,t,e){var r=-1/0,u=r;if(!t&&he(n)){e=-1;for(var a=n.length;++e<a;){var o=n[e];o>u&&(u=o)
}}else t=!t&&it(n)?V:M.createCallback(t,e),gt(n,function(n,e,a){e=t(n,e,a),e>r&&(r=e,u=n)});return u}function mt(n,t){var e=-1,r=n?n.length:0;if(typeof r=="number")for(var u=Ft(r);++e<r;)u[e]=n[e][t];return u||yt(n,t)}function bt(n,t,e,r){if(!n)return e;var u=3>arguments.length;t=M.createCallback(t,r,4);var o=-1,i=n.length;if(typeof i=="number")for(u&&(e=n[++o]);++o<i;)e=t(e,n[o],o,n);else q(n,function(n,r,o){e=u?(u=a,n):t(e,n,r,o)});return e}function dt(n,t,e,r){var u=n?n.length:0,o=3>arguments.length;
if(typeof u!="number")var i=me(n),u=i.length;return t=M.createCallback(t,r,4),gt(n,function(r,f,c){f=i?i[--u]:--u,e=o?(o=a,n[f]):t(e,n[f],f,c)}),e}function _t(n,t,e){var r;t=M.createCallback(t,e),e=-1;var u=n?n.length:0;if(typeof u=="number")for(;++e<u&&!(r=t(n[e],e,n)););else q(n,function(n,e,u){return!(r=t(n,e,u))});return!!r}function kt(n){for(var t=-1,e=n?n.length:0,r=Wt.apply(Vt,ve.call(arguments,1)),r=U(r),u=[];++t<e;){var a=n[t];r(a)||u.push(a)}return u}function wt(n,t,e){if(n){var r=0,a=n.length;
if(typeof t!="number"&&t!=u){var o=-1;for(t=M.createCallback(t,e);++o<a&&t(n[o],o,n);)r++}else if(r=t,r==u||e)return n[0];return Y(n,0,le(ce(0,r),a))}}function jt(n,t,e,r){var o=-1,i=n?n.length:0,f=[];for(typeof t!="boolean"&&t!=u&&(r=e,e=t,t=a),e!=u&&(e=M.createCallback(e,r));++o<i;)r=n[o],e&&(r=e(r,o,n)),he(r)?ne.apply(f,t?r:jt(r)):f.push(r);return f}function Ct(n,t,e){var r=-1,u=n?n.length:0;if(typeof e=="number")r=(0>e?ce(0,u+e):e||0)-1;else if(e)return r=Ot(n,t),n[r]===t?r:-1;for(;++r<u;)if(n[r]===t)return r;
return-1}function xt(n,t,e){if(typeof t!="number"&&t!=u){var r=0,a=-1,o=n?n.length:0;for(t=M.createCallback(t,e);++a<o&&t(n[a],a,n);)r++}else r=t==u||e?1:ce(0,t);return Y(n,r)}function Ot(n,t,e,r){var u=0,a=n?n.length:u;for(e=e?M.createCallback(e,r,1):At,t=e(t);u<a;)r=u+a>>>1,e(n[r])<t?u=r+1:a=r;return u}function Et(n,t,e,r){var o=-1,i=n?n.length:0,f=[],c=f;typeof t!="boolean"&&t!=u&&(r=e,e=t,t=a);var l=!t&&i>=s;if(l)var v={};for(e!=u&&(c=[],e=M.createCallback(e,r));++o<i;){r=n[o];var g=e?e(r,o,n):r;
if(l)var y=p+g,y=v[y]?!(c=v[y]):c=v[y]=[];(t?!o||c[c.length-1]!==g:y||0>Ct(c,g))&&((e||l)&&c.push(g),f.push(r))}return f}function It(n,t){for(var e=-1,r=n?n.length:0,u={};++e<r;){var a=n[e];t?u[a]=t[e]:u[a[0]]=a[1]}return u}function Nt(n,t){return ye.fastBind||ue&&2<arguments.length?ue.call.apply(ue,arguments):H(n,t,ve.call(arguments,2))}function St(n){var t=ve.call(arguments,1);return ee(function(){n.apply(e,t)},1)}function At(n){return n}function $t(n){gt(tt(n),function(t){var e=M[t]=n[t];M.prototype[t]=function(){var n=this.__wrapped__,t=[n];
return ne.apply(t,arguments),t=e.apply(M,t),n&&typeof n=="object"&&n==t?this:new Q(t)}})}function Bt(){return this.__wrapped__}o=o?T.defaults(n.Object(),o,T.pick(n,C)):n;var Ft=o.Array,Rt=o.Boolean,Tt=o.Date,qt=o.Function,Dt=o.Math,zt=o.Number,Pt=o.Object,Kt=o.RegExp,Mt=o.String,Ut=o.TypeError,Vt=Ft(),Gt=Pt(),Ht=o._,Jt=Kt("^"+Mt(Gt.valueOf).replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/valueOf|for [^\]]+/g,".+?")+"$"),Lt=Dt.ceil,Qt=o.clearTimeout,Wt=Vt.concat,Xt=Dt.floor,Yt=Jt.test(Yt=Pt.getPrototypeOf)&&Yt,Zt=Gt.hasOwnProperty,ne=Vt.push,te=o.setImmediate,ee=o.setTimeout,re=Gt.toString,ue=Jt.test(ue=re.bind)&&ue,ae=Jt.test(ae=Ft.isArray)&&ae,oe=o.isFinite,ie=o.isNaN,fe=Jt.test(fe=Pt.keys)&&fe,ce=Dt.max,le=Dt.min,pe=o.parseInt,se=Dt.random,ve=Vt.slice,Dt=Jt.test(o.attachEvent),Dt=ue&&!/\n|true/.test(ue+Dt),ge={};
ge[O]=Ft,ge[E]=Rt,ge[I]=Tt,ge[S]=Pt,ge[N]=zt,ge[A]=Kt,ge[$]=Mt;var ye=M.support={};ye.fastBind=ue&&!Dt,M.templateSettings={escape:/<%-([\s\S]+?)%>/g,evaluate:/<%([\s\S]+?)%>/g,interpolate:d,variable:"",imports:{_:M}},Q.prototype=M.prototype;var he=ae||function(n){return n?typeof n=="object"&&re.call(n)==O:a},me=fe?function(n){return at(n)?fe(n):[]}:K,be={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},de=et(be);return Dt&&i&&typeof te=="function"&&(St=Nt(te,o)),Rt=8==pe("08")?pe:function(n,t){return pe(it(n)?n.replace(_,""):n,t||0)
},M.after=function(n,t){return 1>n?t():function(){return 1>--n?t.apply(this,arguments):void 0}},M.assign=P,M.at=function(n){for(var t=-1,e=Wt.apply(Vt,ve.call(arguments,1)),r=e.length,u=Ft(r);++t<r;)u[t]=n[e[t]];return u},M.bind=Nt,M.bindAll=function(n){for(var t=1<arguments.length?Wt.apply(Vt,ve.call(arguments,1)):tt(n),e=-1,r=t.length;++e<r;){var u=t[e];n[u]=Nt(n[u],n)}return n},M.bindKey=function(n,t){return H(n,t,ve.call(arguments,2),l)},M.compact=function(n){for(var t=-1,e=n?n.length:0,r=[];++t<e;){var u=n[t];
u&&r.push(u)}return r},M.compose=function(){var n=arguments;return function(){for(var t=arguments,e=n.length;e--;)t=[n[e].apply(this,t)];return t[0]}},M.countBy=function(n,t,e){var r={};return t=M.createCallback(t,e),gt(n,function(n,e,u){e=Mt(t(n,e,u)),Zt.call(r,e)?r[e]++:r[e]=1}),r},M.createCallback=function(n,t,e){if(n==u)return At;var r=typeof n;if("function"!=r){if("object"!=r)return function(t){return t[n]};var o=me(n);return function(t){for(var e=o.length,r=a;e--&&(r=rt(t[o[e]],n[o[e]],l)););return r
}}return typeof t!="undefined"?1===e?function(e){return n.call(t,e)}:2===e?function(e,r){return n.call(t,e,r)}:4===e?function(e,r,u,a){return n.call(t,e,r,u,a)}:function(e,r,u){return n.call(t,e,r,u)}:n},M.debounce=function(n,t,e){function o(){f=p=u,s&&(c=n.apply(l,i))}var i,f,c,l,p,s=r;if(e===r)var v=r,s=a;else e&&F[typeof e]&&(v=e.leading,s="trailing"in e?e.trailing:s);return function(){return i=arguments,l=this,Qt(p),!f&&v?(f=r,c=n.apply(l,i)):p=ee(o,t),c}},M.defaults=z,M.defer=St,M.delay=function(n,t){var r=ve.call(arguments,2);
return ee(function(){n.apply(e,r)},t)},M.difference=kt,M.filter=st,M.flatten=jt,M.forEach=gt,M.forIn=D,M.forOwn=q,M.functions=tt,M.groupBy=function(n,t,e){var r={};return t=M.createCallback(t,e),gt(n,function(n,e,u){e=Mt(t(n,e,u)),(Zt.call(r,e)?r[e]:r[e]=[]).push(n)}),r},M.initial=function(n,t,e){if(!n)return[];var r=0,a=n.length;if(typeof t!="number"&&t!=u){var o=a;for(t=M.createCallback(t,e);o--&&t(n[o],o,n);)r++}else r=t==u||e?1:t||r;return Y(n,0,le(ce(0,a-r),a))},M.intersection=function(n){var t=arguments,e=t.length,r={0:{}},u=-1,a=n?n.length:0,o=a>=s,i=[],f=i;
n:for(;++u<a;){var c=n[u];if(o)var l=p+c,l=r[0][l]?!(f=r[0][l]):f=r[0][l]=[];if(l||0>Ct(f,c)){o&&f.push(c);for(var v=e;--v;)if(!(r[v]||(r[v]=U(t[v])))(c))continue n;i.push(c)}}return i},M.invert=et,M.invoke=function(n,t){var e=ve.call(arguments,2),r=-1,u=typeof t=="function",a=n?n.length:0,o=Ft(typeof a=="number"?a:0);return gt(n,function(n){o[++r]=(u?t:n[t]).apply(n,e)}),o},M.keys=me,M.map=yt,M.max=ht,M.memoize=function(n,t){var e={};return function(){var r=p+(t?t.apply(this,arguments):arguments[0]);
return Zt.call(e,r)?e[r]:e[r]=n.apply(this,arguments)}},M.merge=ft,M.min=function(n,t,e){var r=1/0,u=r;if(!t&&he(n)){e=-1;for(var a=n.length;++e<a;){var o=n[e];o<u&&(u=o)}}else t=!t&&it(n)?V:M.createCallback(t,e),gt(n,function(n,e,a){e=t(n,e,a),e<r&&(r=e,u=n)});return u},M.omit=function(n,t,e){var r=typeof t=="function",u={};if(r)t=M.createCallback(t,e);else var a=Wt.apply(Vt,ve.call(arguments,1));return D(n,function(n,e,o){(r?!t(n,e,o):0>Ct(a,e))&&(u[e]=n)}),u},M.once=function(n){var t,e;return function(){return t?e:(t=r,e=n.apply(this,arguments),n=u,e)
}},M.pairs=function(n){for(var t=-1,e=me(n),r=e.length,u=Ft(r);++t<r;){var a=e[t];u[t]=[a,n[a]]}return u},M.partial=function(n){return H(n,ve.call(arguments,1))},M.partialRight=function(n){return H(n,ve.call(arguments,1),u,l)},M.pick=function(n,t,e){var r={};if(typeof t!="function")for(var u=-1,a=Wt.apply(Vt,ve.call(arguments,1)),o=at(n)?a.length:0;++u<o;){var i=a[u];i in n&&(r[i]=n[i])}else t=M.createCallback(t,e),D(n,function(n,e,u){t(n,e,u)&&(r[e]=n)});return r},M.pluck=mt,M.range=function(n,t,e){n=+n||0,e=+e||1,t==u&&(t=n,n=0);
var r=-1;t=ce(0,Lt((t-n)/e));for(var a=Ft(t);++r<t;)a[r]=n,n+=e;return a},M.reject=function(n,t,e){return t=M.createCallback(t,e),st(n,function(n,e,r){return!t(n,e,r)})},M.rest=xt,M.shuffle=function(n){var t=-1,e=n?n.length:0,r=Ft(typeof e=="number"?e:0);return gt(n,function(n){var e=Xt(se()*(++t+1));r[t]=r[e],r[e]=n}),r},M.sortBy=function(n,t,e){var r=-1,u=n?n.length:0,a=Ft(typeof u=="number"?u:0);for(t=M.createCallback(t,e),gt(n,function(n,e,u){a[++r]={a:t(n,e,u),b:r,c:n}}),u=a.length,a.sort(G);u--;)a[u]=a[u].c;
return a},M.tap=function(n,t){return t(n),n},M.throttle=function(n,t,e){function o(){l=u,v&&(p=new Tt,f=n.apply(c,i))}var i,f,c,l,p=0,s=r,v=r;return e===a?s=a:e&&F[typeof e]&&(s="leading"in e?e.leading:s,v="trailing"in e?e.trailing:v),function(){var e=new Tt;!l&&!s&&(p=e);var r=t-(e-p);return i=arguments,c=this,0<r?l||(l=ee(o,r)):(Qt(l),l=u,p=e,f=n.apply(c,i)),f}},M.times=function(n,t,e){n=-1<(n=+n)?n:0;var r=-1,u=Ft(n);for(t=M.createCallback(t,e,1);++r<n;)u[r]=t(r);return u},M.toArray=function(n){return n&&typeof n.length=="number"?Y(n):ct(n)
},M.union=function(n){return he(n)||(arguments[0]=n?ve.call(n):Vt),Et(Wt.apply(Vt,arguments))},M.uniq=Et,M.unzip=function(n){for(var t=-1,e=n?n.length:0,r=e?ht(mt(n,"length")):0,u=Ft(r);++t<e;)for(var a=-1,o=n[t];++a<r;)(u[a]||(u[a]=Ft(e)))[t]=o[a];return u},M.values=ct,M.where=st,M.without=function(n){return kt(n,ve.call(arguments,1))},M.wrap=function(n,t){return function(){var e=[n];return ne.apply(e,arguments),t.apply(this,e)}},M.zip=function(n){for(var t=-1,e=n?ht(mt(arguments,"length")):0,r=Ft(e);++t<e;)r[t]=mt(arguments,t);
return r},M.zipObject=It,M.collect=yt,M.drop=xt,M.each=gt,M.extend=P,M.methods=tt,M.object=It,M.select=st,M.tail=xt,M.unique=Et,$t(M),M.clone=nt,M.cloneDeep=function(n,t,e){return nt(n,r,t,e)},M.contains=lt,M.escape=function(n){return n==u?"":Mt(n).replace(w,L)},M.every=pt,M.find=vt,M.findIndex=function(n,t,e){var r=-1,u=n?n.length:0;for(t=M.createCallback(t,e);++r<u;)if(t(n[r],r,n))return r;return-1},M.findKey=function(n,t,e){var r;return t=M.createCallback(t,e),q(n,function(n,e,u){return t(n,e,u)?(r=e,a):void 0
}),r},M.has=function(n,t){return n?Zt.call(n,t):a},M.identity=At,M.indexOf=Ct,M.isArguments=function(n){return re.call(n)==x},M.isArray=he,M.isBoolean=function(n){return n===r||n===a||re.call(n)==E},M.isDate=function(n){return n?typeof n=="object"&&re.call(n)==I:a},M.isElement=function(n){return n?1===n.nodeType:a},M.isEmpty=function(n){var t=r;if(!n)return t;var e=re.call(n),u=n.length;return e==O||e==$||e==x||e==S&&typeof u=="number"&&ut(n.splice)?!u:(q(n,function(){return t=a}),t)},M.isEqual=rt,M.isFinite=function(n){return oe(n)&&!ie(parseFloat(n))
},M.isFunction=ut,M.isNaN=function(n){return ot(n)&&n!=+n},M.isNull=function(n){return n===u},M.isNumber=ot,M.isObject=at,M.isPlainObject=f,M.isRegExp=function(n){return n?typeof n=="object"&&re.call(n)==A:a},M.isString=it,M.isUndefined=function(n){return typeof n=="undefined"},M.lastIndexOf=function(n,t,e){var r=n?n.length:0;for(typeof e=="number"&&(r=(0>e?ce(0,r+e):le(e,r-1))+1);r--;)if(n[r]===t)return r;return-1},M.mixin=$t,M.noConflict=function(){return o._=Ht,this},M.parseInt=Rt,M.random=function(n,t){return n==u&&t==u&&(t=1),n=+n||0,t==u&&(t=n,n=0),n+Xt(se()*((+t||0)-n+1))
},M.reduce=bt,M.reduceRight=dt,M.result=function(n,t){var r=n?n[t]:e;return ut(r)?n[t]():r},M.runInContext=t,M.size=function(n){var t=n?n.length:0;return typeof t=="number"?t:me(n).length},M.some=_t,M.sortedIndex=Ot,M.template=function(n,t,u){var a=M.templateSettings;n||(n=""),u=z({},u,a);var o,i=z({},u.imports,a.imports),a=me(i),i=ct(i),f=0,c=u.interpolate||k,l="__p+='",c=Kt((u.escape||k).source+"|"+c.source+"|"+(c===d?m:k).source+"|"+(u.evaluate||k).source+"|$","g");n.replace(c,function(t,e,u,a,i,c){return u||(u=a),l+=n.slice(f,c).replace(j,J),e&&(l+="'+__e("+e+")+'"),i&&(o=r,l+="';"+i+";__p+='"),u&&(l+="'+((__t=("+u+"))==null?'':__t)+'"),f=c+t.length,t
}),l+="';\n",c=u=u.variable,c||(u="obj",l="with("+u+"){"+l+"}"),l=(o?l.replace(v,""):l).replace(g,"$1").replace(y,"$1;"),l="function("+u+"){"+(c?"":u+"||("+u+"={});")+"var __t,__p='',__e=_.escape"+(o?",__j=Array.prototype.join;function print(){__p+=__j.call(arguments,'')}":";")+l+"return __p}";try{var p=qt(a,"return "+l).apply(e,i)}catch(s){throw s.source=l,s}return t?p(t):(p.source=l,p)},M.unescape=function(n){return n==u?"":Mt(n).replace(h,Z)},M.uniqueId=function(n){var t=++c;return Mt(n==u?"":n)+t
},M.all=pt,M.any=_t,M.detect=vt,M.foldl=bt,M.foldr=dt,M.include=lt,M.inject=bt,q(M,function(n,t){M.prototype[t]||(M.prototype[t]=function(){var t=[this.__wrapped__];return ne.apply(t,arguments),n.apply(M,t)})}),M.first=wt,M.last=function(n,t,e){if(n){var r=0,a=n.length;if(typeof t!="number"&&t!=u){var o=a;for(t=M.createCallback(t,e);o--&&t(n[o],o,n);)r++}else if(r=t,r==u||e)return n[a-1];return Y(n,ce(0,a-r))}},M.take=wt,M.head=wt,q(M,function(n,t){M.prototype[t]||(M.prototype[t]=function(t,e){var r=n(this.__wrapped__,t,e);
return t==u||e&&typeof t!="function"?r:new Q(r)})}),M.VERSION="1.2.0",M.prototype.toString=function(){return Mt(this.__wrapped__)},M.prototype.value=Bt,M.prototype.valueOf=Bt,gt(["join","pop","shift"],function(n){var t=Vt[n];M.prototype[n]=function(){return t.apply(this.__wrapped__,arguments)}}),gt(["push","reverse","sort","unshift"],function(n){var t=Vt[n];M.prototype[n]=function(){return t.apply(this.__wrapped__,arguments),this}}),gt(["concat","slice","splice"],function(n){var t=Vt[n];M.prototype[n]=function(){return new Q(t.apply(this.__wrapped__,arguments))
}}),M}var e,r=!0,u=null,a=!1,o=typeof exports=="object"&&exports,i=typeof module=="object"&&module&&module.exports==o&&module,f=typeof global=="object"&&global;(f.global===f||f.window===f)&&(n=f);var c=0,l={},p=+new Date+"",s=200,v=/\b__p\+='';/g,g=/\b(__p\+=)''\+/g,y=/(__e\(.*?\)|\b__t\))\+'';/g,h=/&(?:amp|lt|gt|quot|#39);/g,m=/\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g,b=/\w*$/,d=/<%=([\s\S]+?)%>/g,_=/^0+(?=.$)/,k=/($^)/,w=/[&<>"']/g,j=/['\n\r\t\u2028\u2029\\]/g,C="Array Boolean Date Function Math Number Object RegExp String _ attachEvent clearTimeout isFinite isNaN parseInt setImmediate setTimeout".split(" "),x="[object Arguments]",O="[object Array]",E="[object Boolean]",I="[object Date]",N="[object Number]",S="[object Object]",A="[object RegExp]",$="[object String]",B={"[object Function]":a};
B[x]=B[O]=B[E]=B[I]=B[N]=B[S]=B[A]=B[$]=r;var F={"boolean":a,"function":r,object:r,number:a,string:a,undefined:a},R={"\\":"\\","'":"'","\n":"n","\r":"r","	":"t","\u2028":"u2028","\u2029":"u2029"},T=t();typeof define=="function"&&typeof define.amd=="object"&&define.amd?(n._=T,define('_',[],function(){return T})):o&&!o.nodeType?i?(i.exports=T)._=T:o._=T:n._=T})(this);
define('core/base',['require','./mixin/derive','./mixin/notifier','./mixin/dirty','./cache','_'],function(require){

    var deriveMixin = require("./mixin/derive");
    var notifierMixin = require("./mixin/notifier");
    var dirtyMixin = require("./mixin/dirty");
    var Cache = require("./cache");
    var _ = require("_");

    var Base = function(){
        this.cache = new Cache();
    }
    _.extend(Base, deriveMixin);
    _.extend(Base.prototype, notifierMixin);
    _.extend(Base.prototype, dirtyMixin);

    return Base;
});
/**
 * @fileoverview gl-matrix - High performance matrix and vector operations
 * @author Brandon Jones
 * @author Colin MacKenzie IV
 * @version 2.2.0
 */
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
(function(e){var t={};typeof exports=="undefined"?typeof define=="function"&&typeof define.amd=="object"&&define.amd?(t.exports={},define('glmatrix',[],function(){return t.exports})):t.exports=typeof window!="undefined"?window:e:t.exports=exports,function(e){if(!t)var t=1e-6;if(!n)var n=typeof Float32Array!="undefined"?Float32Array:Array;if(!r)var r=Math.random;var i={};i.setMatrixArrayType=function(e){n=e},typeof e!="undefined"&&(e.glMatrix=i);var s={};s.create=function(){var e=new n(2);return e[0]=0,e[1]=0,e},s.clone=function(e){var t=new n(2);return t[0]=e[0],t[1]=e[1],t},s.fromValues=function(e,t){var r=new n(2);return r[0]=e,r[1]=t,r},s.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e},s.set=function(e,t,n){return e[0]=t,e[1]=n,e},s.add=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e},s.subtract=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e},s.sub=s.subtract,s.multiply=function(e,t,n){return e[0]=t[0]*n[0],e[1]=t[1]*n[1],e},s.mul=s.multiply,s.divide=function(e,t,n){return e[0]=t[0]/n[0],e[1]=t[1]/n[1],e},s.div=s.divide,s.min=function(e,t,n){return e[0]=Math.min(t[0],n[0]),e[1]=Math.min(t[1],n[1]),e},s.max=function(e,t,n){return e[0]=Math.max(t[0],n[0]),e[1]=Math.max(t[1],n[1]),e},s.scale=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e},s.scaleAndAdd=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e},s.distance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1];return Math.sqrt(n*n+r*r)},s.dist=s.distance,s.squaredDistance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1];return n*n+r*r},s.sqrDist=s.squaredDistance,s.length=function(e){var t=e[0],n=e[1];return Math.sqrt(t*t+n*n)},s.len=s.length,s.squaredLength=function(e){var t=e[0],n=e[1];return t*t+n*n},s.sqrLen=s.squaredLength,s.negate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e},s.normalize=function(e,t){var n=t[0],r=t[1],i=n*n+r*r;return i>0&&(i=1/Math.sqrt(i),e[0]=t[0]*i,e[1]=t[1]*i),e},s.dot=function(e,t){return e[0]*t[0]+e[1]*t[1]},s.cross=function(e,t,n){var r=t[0]*n[1]-t[1]*n[0];return e[0]=e[1]=0,e[2]=r,e},s.lerp=function(e,t,n,r){var i=t[0],s=t[1];return e[0]=i+r*(n[0]-i),e[1]=s+r*(n[1]-s),e},s.random=function(e,t){t=t||1;var n=r()*2*Math.PI;return e[0]=Math.cos(n)*t,e[1]=Math.sin(n)*t,e},s.transformMat2=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i,e[1]=n[1]*r+n[3]*i,e},s.transformMat2d=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i+n[4],e[1]=n[1]*r+n[3]*i+n[5],e},s.transformMat3=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[3]*i+n[6],e[1]=n[1]*r+n[4]*i+n[7],e},s.transformMat4=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[4]*i+n[12],e[1]=n[1]*r+n[5]*i+n[13],e},s.forEach=function(){var e=s.create();return function(t,n,r,i,s,o){var u,a;n||(n=2),r||(r=0),i?a=Math.min(i*n+r,t.length):a=t.length;for(u=r;u<a;u+=n)e[0]=t[u],e[1]=t[u+1],s(e,e,o),t[u]=e[0],t[u+1]=e[1];return t}}(),s.str=function(e){return"vec2("+e[0]+", "+e[1]+")"},typeof e!="undefined"&&(e.vec2=s);var o={};o.create=function(){var e=new n(3);return e[0]=0,e[1]=0,e[2]=0,e},o.clone=function(e){var t=new n(3);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t},o.fromValues=function(e,t,r){var i=new n(3);return i[0]=e,i[1]=t,i[2]=r,i},o.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e},o.set=function(e,t,n,r){return e[0]=t,e[1]=n,e[2]=r,e},o.add=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e[2]=t[2]+n[2],e},o.subtract=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e[2]=t[2]-n[2],e},o.sub=o.subtract,o.multiply=function(e,t,n){return e[0]=t[0]*n[0],e[1]=t[1]*n[1],e[2]=t[2]*n[2],e},o.mul=o.multiply,o.divide=function(e,t,n){return e[0]=t[0]/n[0],e[1]=t[1]/n[1],e[2]=t[2]/n[2],e},o.div=o.divide,o.min=function(e,t,n){return e[0]=Math.min(t[0],n[0]),e[1]=Math.min(t[1],n[1]),e[2]=Math.min(t[2],n[2]),e},o.max=function(e,t,n){return e[0]=Math.max(t[0],n[0]),e[1]=Math.max(t[1],n[1]),e[2]=Math.max(t[2],n[2]),e},o.scale=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e[2]=t[2]*n,e},o.scaleAndAdd=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e[2]=t[2]+n[2]*r,e},o.distance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return Math.sqrt(n*n+r*r+i*i)},o.dist=o.distance,o.squaredDistance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return n*n+r*r+i*i},o.sqrDist=o.squaredDistance,o.length=function(e){var t=e[0],n=e[1],r=e[2];return Math.sqrt(t*t+n*n+r*r)},o.len=o.length,o.squaredLength=function(e){var t=e[0],n=e[1],r=e[2];return t*t+n*n+r*r},o.sqrLen=o.squaredLength,o.negate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e},o.normalize=function(e,t){var n=t[0],r=t[1],i=t[2],s=n*n+r*r+i*i;return s>0&&(s=1/Math.sqrt(s),e[0]=t[0]*s,e[1]=t[1]*s,e[2]=t[2]*s),e},o.dot=function(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]},o.cross=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=n[0],u=n[1],a=n[2];return e[0]=i*a-s*u,e[1]=s*o-r*a,e[2]=r*u-i*o,e},o.lerp=function(e,t,n,r){var i=t[0],s=t[1],o=t[2];return e[0]=i+r*(n[0]-i),e[1]=s+r*(n[1]-s),e[2]=o+r*(n[2]-o),e},o.random=function(e,t){t=t||1;var n=r()*2*Math.PI,i=r()*2-1,s=Math.sqrt(1-i*i)*t;return e[0]=Math.cos(n)*s,e[1]=Math.sin(n)*s,e[2]=i*t,e},o.transformMat4=function(e,t,n){var r=t[0],i=t[1],s=t[2];return e[0]=n[0]*r+n[4]*i+n[8]*s+n[12],e[1]=n[1]*r+n[5]*i+n[9]*s+n[13],e[2]=n[2]*r+n[6]*i+n[10]*s+n[14],e},o.transformMat3=function(e,t,n){var r=t[0],i=t[1],s=t[2];return e[0]=r*n[0]+i*n[3]+s*n[6],e[1]=r*n[1]+i*n[4]+s*n[7],e[2]=r*n[2]+i*n[5]+s*n[8],e},o.transformQuat=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=n[0],u=n[1],a=n[2],f=n[3],l=f*r+u*s-a*i,c=f*i+a*r-o*s,h=f*s+o*i-u*r,p=-o*r-u*i-a*s;return e[0]=l*f+p*-o+c*-a-h*-u,e[1]=c*f+p*-u+h*-o-l*-a,e[2]=h*f+p*-a+l*-u-c*-o,e},o.forEach=function(){var e=o.create();return function(t,n,r,i,s,o){var u,a;n||(n=3),r||(r=0),i?a=Math.min(i*n+r,t.length):a=t.length;for(u=r;u<a;u+=n)e[0]=t[u],e[1]=t[u+1],e[2]=t[u+2],s(e,e,o),t[u]=e[0],t[u+1]=e[1],t[u+2]=e[2];return t}}(),o.str=function(e){return"vec3("+e[0]+", "+e[1]+", "+e[2]+")"},typeof e!="undefined"&&(e.vec3=o);var u={};u.create=function(){var e=new n(4);return e[0]=0,e[1]=0,e[2]=0,e[3]=0,e},u.clone=function(e){var t=new n(4);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t},u.fromValues=function(e,t,r,i){var s=new n(4);return s[0]=e,s[1]=t,s[2]=r,s[3]=i,s},u.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e},u.set=function(e,t,n,r,i){return e[0]=t,e[1]=n,e[2]=r,e[3]=i,e},u.add=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e[2]=t[2]+n[2],e[3]=t[3]+n[3],e},u.subtract=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e[2]=t[2]-n[2],e[3]=t[3]-n[3],e},u.sub=u.subtract,u.multiply=function(e,t,n){return e[0]=t[0]*n[0],e[1]=t[1]*n[1],e[2]=t[2]*n[2],e[3]=t[3]*n[3],e},u.mul=u.multiply,u.divide=function(e,t,n){return e[0]=t[0]/n[0],e[1]=t[1]/n[1],e[2]=t[2]/n[2],e[3]=t[3]/n[3],e},u.div=u.divide,u.min=function(e,t,n){return e[0]=Math.min(t[0],n[0]),e[1]=Math.min(t[1],n[1]),e[2]=Math.min(t[2],n[2]),e[3]=Math.min(t[3],n[3]),e},u.max=function(e,t,n){return e[0]=Math.max(t[0],n[0]),e[1]=Math.max(t[1],n[1]),e[2]=Math.max(t[2],n[2]),e[3]=Math.max(t[3],n[3]),e},u.scale=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e[2]=t[2]*n,e[3]=t[3]*n,e},u.scaleAndAdd=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e[2]=t[2]+n[2]*r,e[3]=t[3]+n[3]*r,e},u.distance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2],s=t[3]-e[3];return Math.sqrt(n*n+r*r+i*i+s*s)},u.dist=u.distance,u.squaredDistance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2],s=t[3]-e[3];return n*n+r*r+i*i+s*s},u.sqrDist=u.squaredDistance,u.length=function(e){var t=e[0],n=e[1],r=e[2],i=e[3];return Math.sqrt(t*t+n*n+r*r+i*i)},u.len=u.length,u.squaredLength=function(e){var t=e[0],n=e[1],r=e[2],i=e[3];return t*t+n*n+r*r+i*i},u.sqrLen=u.squaredLength,u.negate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e[3]=-t[3],e},u.normalize=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n*n+r*r+i*i+s*s;return o>0&&(o=1/Math.sqrt(o),e[0]=t[0]*o,e[1]=t[1]*o,e[2]=t[2]*o,e[3]=t[3]*o),e},u.dot=function(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]+e[3]*t[3]},u.lerp=function(e,t,n,r){var i=t[0],s=t[1],o=t[2],u=t[3];return e[0]=i+r*(n[0]-i),e[1]=s+r*(n[1]-s),e[2]=o+r*(n[2]-o),e[3]=u+r*(n[3]-u),e},u.random=function(e,t){return t=t||1,e[0]=r(),e[1]=r(),e[2]=r(),e[3]=r(),u.normalize(e,e),u.scale(e,e,t),e},u.transformMat4=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3];return e[0]=n[0]*r+n[4]*i+n[8]*s+n[12]*o,e[1]=n[1]*r+n[5]*i+n[9]*s+n[13]*o,e[2]=n[2]*r+n[6]*i+n[10]*s+n[14]*o,e[3]=n[3]*r+n[7]*i+n[11]*s+n[15]*o,e},u.transformQuat=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=n[0],u=n[1],a=n[2],f=n[3],l=f*r+u*s-a*i,c=f*i+a*r-o*s,h=f*s+o*i-u*r,p=-o*r-u*i-a*s;return e[0]=l*f+p*-o+c*-a-h*-u,e[1]=c*f+p*-u+h*-o-l*-a,e[2]=h*f+p*-a+l*-u-c*-o,e},u.forEach=function(){var e=u.create();return function(t,n,r,i,s,o){var u,a;n||(n=4),r||(r=0),i?a=Math.min(i*n+r,t.length):a=t.length;for(u=r;u<a;u+=n)e[0]=t[u],e[1]=t[u+1],e[2]=t[u+2],e[3]=t[u+3],s(e,e,o),t[u]=e[0],t[u+1]=e[1],t[u+2]=e[2],t[u+3]=e[3];return t}}(),u.str=function(e){return"vec4("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+")"},typeof e!="undefined"&&(e.vec4=u);var a={};a.create=function(){var e=new n(4);return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e},a.clone=function(e){var t=new n(4);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t},a.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e},a.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e},a.transpose=function(e,t){if(e===t){var n=t[1];e[1]=t[2],e[2]=n}else e[0]=t[0],e[1]=t[2],e[2]=t[1],e[3]=t[3];return e},a.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n*s-i*r;return o?(o=1/o,e[0]=s*o,e[1]=-r*o,e[2]=-i*o,e[3]=n*o,e):null},a.adjoint=function(e,t){var n=t[0];return e[0]=t[3],e[1]=-t[1],e[2]=-t[2],e[3]=n,e},a.determinant=function(e){return e[0]*e[3]-e[2]*e[1]},a.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=n[0],a=n[1],f=n[2],l=n[3];return e[0]=r*u+i*f,e[1]=r*a+i*l,e[2]=s*u+o*f,e[3]=s*a+o*l,e},a.mul=a.multiply,a.rotate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a+i*u,e[1]=r*-u+i*a,e[2]=s*a+o*u,e[3]=s*-u+o*a,e},a.scale=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=n[0],a=n[1];return e[0]=r*u,e[1]=i*a,e[2]=s*u,e[3]=o*a,e},a.str=function(e){return"mat2("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+")"},typeof e!="undefined"&&(e.mat2=a);var f={};f.create=function(){var e=new n(6);return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e[4]=0,e[5]=0,e},f.clone=function(e){var t=new n(6);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t[4]=e[4],t[5]=e[5],t},f.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4],e[5]=t[5],e},f.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e[4]=0,e[5]=0,e},f.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=n*s-r*i;return a?(a=1/a,e[0]=s*a,e[1]=-r*a,e[2]=-i*a,e[3]=n*a,e[4]=(i*u-s*o)*a,e[5]=(r*o-n*u)*a,e):null},f.determinant=function(e){return e[0]*e[3]-e[1]*e[2]},f.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=n[0],l=n[1],c=n[2],h=n[3],p=n[4],d=n[5];return e[0]=r*f+i*c,e[1]=r*l+i*h,e[2]=s*f+o*c,e[3]=s*l+o*h,e[4]=f*u+c*a+p,e[5]=l*u+h*a+d,e},f.mul=f.multiply,f.rotate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=Math.sin(n),l=Math.cos(n);return e[0]=r*l+i*f,e[1]=-r*f+i*l,e[2]=s*l+o*f,e[3]=-s*f+l*o,e[4]=l*u+f*a,e[5]=l*a-f*u,e},f.scale=function(e,t,n){var r=n[0],i=n[1];return e[0]=t[0]*r,e[1]=t[1]*i,e[2]=t[2]*r,e[3]=t[3]*i,e[4]=t[4]*r,e[5]=t[5]*i,e},f.translate=function(e,t,n){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4]+n[0],e[5]=t[5]+n[1],e},f.str=function(e){return"mat2d("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+", "+e[4]+", "+e[5]+")"},typeof e!="undefined"&&(e.mat2d=f);var l={};l.create=function(){var e=new n(9);return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=1,e[5]=0,e[6]=0,e[7]=0,e[8]=1,e},l.fromMat4=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[4],e[4]=t[5],e[5]=t[6],e[6]=t[8],e[7]=t[9],e[8]=t[10],e},l.clone=function(e){var t=new n(9);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t[4]=e[4],t[5]=e[5],t[6]=e[6],t[7]=e[7],t[8]=e[8],t},l.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e},l.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=1,e[5]=0,e[6]=0,e[7]=0,e[8]=1,e},l.transpose=function(e,t){if(e===t){var n=t[1],r=t[2],i=t[5];e[1]=t[3],e[2]=t[6],e[3]=n,e[5]=t[7],e[6]=r,e[7]=i}else e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8];return e},l.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=l*o-u*f,h=-l*s+u*a,p=f*s-o*a,d=n*c+r*h+i*p;return d?(d=1/d,e[0]=c*d,e[1]=(-l*r+i*f)*d,e[2]=(u*r-i*o)*d,e[3]=h*d,e[4]=(l*n-i*a)*d,e[5]=(-u*n+i*s)*d,e[6]=p*d,e[7]=(-f*n+r*a)*d,e[8]=(o*n-r*s)*d,e):null},l.adjoint=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8];return e[0]=o*l-u*f,e[1]=i*f-r*l,e[2]=r*u-i*o,e[3]=u*a-s*l,e[4]=n*l-i*a,e[5]=i*s-n*u,e[6]=s*f-o*a,e[7]=r*a-n*f,e[8]=n*o-r*s,e},l.determinant=function(e){var t=e[0],n=e[1],r=e[2],i=e[3],s=e[4],o=e[5],u=e[6],a=e[7],f=e[8];return t*(f*s-o*a)+n*(-f*i+o*u)+r*(a*i-s*u)},l.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=n[0],p=n[1],d=n[2],v=n[3],m=n[4],g=n[5],y=n[6],b=n[7],w=n[8];return e[0]=h*r+p*o+d*f,e[1]=h*i+p*u+d*l,e[2]=h*s+p*a+d*c,e[3]=v*r+m*o+g*f,e[4]=v*i+m*u+g*l,e[5]=v*s+m*a+g*c,e[6]=y*r+b*o+w*f,e[7]=y*i+b*u+w*l,e[8]=y*s+b*a+w*c,e},l.mul=l.multiply,l.translate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=n[0],p=n[1];return e[0]=r,e[1]=i,e[2]=s,e[3]=o,e[4]=u,e[5]=a,e[6]=h*r+p*o+f,e[7]=h*i+p*u+l,e[8]=h*s+p*a+c,e},l.rotate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=Math.sin(n),p=Math.cos(n);return e[0]=p*r+h*o,e[1]=p*i+h*u,e[2]=p*s+h*a,e[3]=p*o-h*r,e[4]=p*u-h*i,e[5]=p*a-h*s,e[6]=f,e[7]=l,e[8]=c,e},l.scale=function(e,t,n){var r=n[0],i=n[1];return e[0]=r*t[0],e[1]=r*t[1],e[2]=r*t[2],e[3]=i*t[3],e[4]=i*t[4],e[5]=i*t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e},l.fromMat2d=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=0,e[3]=t[2],e[4]=t[3],e[5]=0,e[6]=t[4],e[7]=t[5],e[8]=1,e},l.fromQuat=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n+n,u=r+r,a=i+i,f=n*o,l=n*u,c=n*a,h=r*u,p=r*a,d=i*a,v=s*o,m=s*u,g=s*a;return e[0]=1-(h+d),e[3]=l+g,e[6]=c-m,e[1]=l-g,e[4]=1-(f+d),e[7]=p+v,e[2]=c+m,e[5]=p-v,e[8]=1-(f+h),e},l.normalFromMat4=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=t[9],h=t[10],p=t[11],d=t[12],v=t[13],m=t[14],g=t[15],y=n*u-r*o,b=n*a-i*o,w=n*f-s*o,E=r*a-i*u,S=r*f-s*u,x=i*f-s*a,T=l*v-c*d,N=l*m-h*d,C=l*g-p*d,k=c*m-h*v,L=c*g-p*v,A=h*g-p*m,O=y*A-b*L+w*k+E*C-S*N+x*T;return O?(O=1/O,e[0]=(u*A-a*L+f*k)*O,e[1]=(a*C-o*A-f*N)*O,e[2]=(o*L-u*C+f*T)*O,e[3]=(i*L-r*A-s*k)*O,e[4]=(n*A-i*C+s*N)*O,e[5]=(r*C-n*L-s*T)*O,e[6]=(v*x-m*S+g*E)*O,e[7]=(m*w-d*x-g*b)*O,e[8]=(d*S-v*w+g*y)*O,e):null},l.str=function(e){return"mat3("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+", "+e[4]+", "+e[5]+", "+e[6]+", "+e[7]+", "+e[8]+")"},typeof e!="undefined"&&(e.mat3=l);var c={};c.create=function(){var e=new n(16);return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},c.clone=function(e){var t=new n(16);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t[4]=e[4],t[5]=e[5],t[6]=e[6],t[7]=e[7],t[8]=e[8],t[9]=e[9],t[10]=e[10],t[11]=e[11],t[12]=e[12],t[13]=e[13],t[14]=e[14],t[15]=e[15],t},c.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e[9]=t[9],e[10]=t[10],e[11]=t[11],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15],e},c.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},c.transpose=function(e,t){if(e===t){var n=t[1],r=t[2],i=t[3],s=t[6],o=t[7],u=t[11];e[1]=t[4],e[2]=t[8],e[3]=t[12],e[4]=n,e[6]=t[9],e[7]=t[13],e[8]=r,e[9]=s,e[11]=t[14],e[12]=i,e[13]=o,e[14]=u}else e[0]=t[0],e[1]=t[4],e[2]=t[8],e[3]=t[12],e[4]=t[1],e[5]=t[5],e[6]=t[9],e[7]=t[13],e[8]=t[2],e[9]=t[6],e[10]=t[10],e[11]=t[14],e[12]=t[3],e[13]=t[7],e[14]=t[11],e[15]=t[15];return e},c.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=t[9],h=t[10],p=t[11],d=t[12],v=t[13],m=t[14],g=t[15],y=n*u-r*o,b=n*a-i*o,w=n*f-s*o,E=r*a-i*u,S=r*f-s*u,x=i*f-s*a,T=l*v-c*d,N=l*m-h*d,C=l*g-p*d,k=c*m-h*v,L=c*g-p*v,A=h*g-p*m,O=y*A-b*L+w*k+E*C-S*N+x*T;return O?(O=1/O,e[0]=(u*A-a*L+f*k)*O,e[1]=(i*L-r*A-s*k)*O,e[2]=(v*x-m*S+g*E)*O,e[3]=(h*S-c*x-p*E)*O,e[4]=(a*C-o*A-f*N)*O,e[5]=(n*A-i*C+s*N)*O,e[6]=(m*w-d*x-g*b)*O,e[7]=(l*x-h*w+p*b)*O,e[8]=(o*L-u*C+f*T)*O,e[9]=(r*C-n*L-s*T)*O,e[10]=(d*S-v*w+g*y)*O,e[11]=(c*w-l*S-p*y)*O,e[12]=(u*N-o*k-a*T)*O,e[13]=(n*k-r*N+i*T)*O,e[14]=(v*b-d*E-m*y)*O,e[15]=(l*E-c*b+h*y)*O,e):null},c.adjoint=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=t[9],h=t[10],p=t[11],d=t[12],v=t[13],m=t[14],g=t[15];return e[0]=u*(h*g-p*m)-c*(a*g-f*m)+v*(a*p-f*h),e[1]=-(r*(h*g-p*m)-c*(i*g-s*m)+v*(i*p-s*h)),e[2]=r*(a*g-f*m)-u*(i*g-s*m)+v*(i*f-s*a),e[3]=-(r*(a*p-f*h)-u*(i*p-s*h)+c*(i*f-s*a)),e[4]=-(o*(h*g-p*m)-l*(a*g-f*m)+d*(a*p-f*h)),e[5]=n*(h*g-p*m)-l*(i*g-s*m)+d*(i*p-s*h),e[6]=-(n*(a*g-f*m)-o*(i*g-s*m)+d*(i*f-s*a)),e[7]=n*(a*p-f*h)-o*(i*p-s*h)+l*(i*f-s*a),e[8]=o*(c*g-p*v)-l*(u*g-f*v)+d*(u*p-f*c),e[9]=-(n*(c*g-p*v)-l*(r*g-s*v)+d*(r*p-s*c)),e[10]=n*(u*g-f*v)-o*(r*g-s*v)+d*(r*f-s*u),e[11]=-(n*(u*p-f*c)-o*(r*p-s*c)+l*(r*f-s*u)),e[12]=-(o*(c*m-h*v)-l*(u*m-a*v)+d*(u*h-a*c)),e[13]=n*(c*m-h*v)-l*(r*m-i*v)+d*(r*h-i*c),e[14]=-(n*(u*m-a*v)-o*(r*m-i*v)+d*(r*a-i*u)),e[15]=n*(u*h-a*c)-o*(r*h-i*c)+l*(r*a-i*u),e},c.determinant=function(e){var t=e[0],n=e[1],r=e[2],i=e[3],s=e[4],o=e[5],u=e[6],a=e[7],f=e[8],l=e[9],c=e[10],h=e[11],p=e[12],d=e[13],v=e[14],m=e[15],g=t*o-n*s,y=t*u-r*s,b=t*a-i*s,w=n*u-r*o,E=n*a-i*o,S=r*a-i*u,x=f*d-l*p,T=f*v-c*p,N=f*m-h*p,C=l*v-c*d,k=l*m-h*d,L=c*m-h*v;return g*L-y*k+b*C+w*N-E*T+S*x},c.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=t[9],p=t[10],d=t[11],v=t[12],m=t[13],g=t[14],y=t[15],b=n[0],w=n[1],E=n[2],S=n[3];return e[0]=b*r+w*u+E*c+S*v,e[1]=b*i+w*a+E*h+S*m,e[2]=b*s+w*f+E*p+S*g,e[3]=b*o+w*l+E*d+S*y,b=n[4],w=n[5],E=n[6],S=n[7],e[4]=b*r+w*u+E*c+S*v,e[5]=b*i+w*a+E*h+S*m,e[6]=b*s+w*f+E*p+S*g,e[7]=b*o+w*l+E*d+S*y,b=n[8],w=n[9],E=n[10],S=n[11],e[8]=b*r+w*u+E*c+S*v,e[9]=b*i+w*a+E*h+S*m,e[10]=b*s+w*f+E*p+S*g,e[11]=b*o+w*l+E*d+S*y,b=n[12],w=n[13],E=n[14],S=n[15],e[12]=b*r+w*u+E*c+S*v,e[13]=b*i+w*a+E*h+S*m,e[14]=b*s+w*f+E*p+S*g,e[15]=b*o+w*l+E*d+S*y,e},c.mul=c.multiply,c.translate=function(e,t,n){var r=n[0],i=n[1],s=n[2],o,u,a,f,l,c,h,p,d,v,m,g;return t===e?(e[12]=t[0]*r+t[4]*i+t[8]*s+t[12],e[13]=t[1]*r+t[5]*i+t[9]*s+t[13],e[14]=t[2]*r+t[6]*i+t[10]*s+t[14],e[15]=t[3]*r+t[7]*i+t[11]*s+t[15]):(o=t[0],u=t[1],a=t[2],f=t[3],l=t[4],c=t[5],h=t[6],p=t[7],d=t[8],v=t[9],m=t[10],g=t[11],e[0]=o,e[1]=u,e[2]=a,e[3]=f,e[4]=l,e[5]=c,e[6]=h,e[7]=p,e[8]=d,e[9]=v,e[10]=m,e[11]=g,e[12]=o*r+l*i+d*s+t[12],e[13]=u*r+c*i+v*s+t[13],e[14]=a*r+h*i+m*s+t[14],e[15]=f*r+p*i+g*s+t[15]),e},c.scale=function(e,t,n){var r=n[0],i=n[1],s=n[2];return e[0]=t[0]*r,e[1]=t[1]*r,e[2]=t[2]*r,e[3]=t[3]*r,e[4]=t[4]*i,e[5]=t[5]*i,e[6]=t[6]*i,e[7]=t[7]*i,e[8]=t[8]*s,e[9]=t[9]*s,e[10]=t[10]*s,e[11]=t[11]*s,e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15],e},c.rotate=function(e,n,r,i){var s=i[0],o=i[1],u=i[2],a=Math.sqrt(s*s+o*o+u*u),f,l,c,h,p,d,v,m,g,y,b,w,E,S,x,T,N,C,k,L,A,O,M,_;return Math.abs(a)<t?null:(a=1/a,s*=a,o*=a,u*=a,f=Math.sin(r),l=Math.cos(r),c=1-l,h=n[0],p=n[1],d=n[2],v=n[3],m=n[4],g=n[5],y=n[6],b=n[7],w=n[8],E=n[9],S=n[10],x=n[11],T=s*s*c+l,N=o*s*c+u*f,C=u*s*c-o*f,k=s*o*c-u*f,L=o*o*c+l,A=u*o*c+s*f,O=s*u*c+o*f,M=o*u*c-s*f,_=u*u*c+l,e[0]=h*T+m*N+w*C,e[1]=p*T+g*N+E*C,e[2]=d*T+y*N+S*C,e[3]=v*T+b*N+x*C,e[4]=h*k+m*L+w*A,e[5]=p*k+g*L+E*A,e[6]=d*k+y*L+S*A,e[7]=v*k+b*L+x*A,e[8]=h*O+m*M+w*_,e[9]=p*O+g*M+E*_,e[10]=d*O+y*M+S*_,e[11]=v*O+b*M+x*_,n!==e&&(e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15]),e)},c.rotateX=function(e,t,n){var r=Math.sin(n),i=Math.cos(n),s=t[4],o=t[5],u=t[6],a=t[7],f=t[8],l=t[9],c=t[10],h=t[11];return t!==e&&(e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[4]=s*i+f*r,e[5]=o*i+l*r,e[6]=u*i+c*r,e[7]=a*i+h*r,e[8]=f*i-s*r,e[9]=l*i-o*r,e[10]=c*i-u*r,e[11]=h*i-a*r,e},c.rotateY=function(e,t,n){var r=Math.sin(n),i=Math.cos(n),s=t[0],o=t[1],u=t[2],a=t[3],f=t[8],l=t[9],c=t[10],h=t[11];return t!==e&&(e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[0]=s*i-f*r,e[1]=o*i-l*r,e[2]=u*i-c*r,e[3]=a*i-h*r,e[8]=s*r+f*i,e[9]=o*r+l*i,e[10]=u*r+c*i,e[11]=a*r+h*i,e},c.rotateZ=function(e,t,n){var r=Math.sin(n),i=Math.cos(n),s=t[0],o=t[1],u=t[2],a=t[3],f=t[4],l=t[5],c=t[6],h=t[7];return t!==e&&(e[8]=t[8],e[9]=t[9],e[10]=t[10],e[11]=t[11],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[0]=s*i+f*r,e[1]=o*i+l*r,e[2]=u*i+c*r,e[3]=a*i+h*r,e[4]=f*i-s*r,e[5]=l*i-o*r,e[6]=c*i-u*r,e[7]=h*i-a*r,e},c.fromRotationTranslation=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=r+r,a=i+i,f=s+s,l=r*u,c=r*a,h=r*f,p=i*a,d=i*f,v=s*f,m=o*u,g=o*a,y=o*f;return e[0]=1-(p+v),e[1]=c+y,e[2]=h-g,e[3]=0,e[4]=c-y,e[5]=1-(l+v),e[6]=d+m,e[7]=0,e[8]=h+g,e[9]=d-m,e[10]=1-(l+p),e[11]=0,e[12]=n[0],e[13]=n[1],e[14]=n[2],e[15]=1,e},c.fromQuat=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n+n,u=r+r,a=i+i,f=n*o,l=n*u,c=n*a,h=r*u,p=r*a,d=i*a,v=s*o,m=s*u,g=s*a;return e[0]=1-(h+d),e[1]=l+g,e[2]=c-m,e[3]=0,e[4]=l-g,e[5]=1-(f+d),e[6]=p+v,e[7]=0,e[8]=c+m,e[9]=p-v,e[10]=1-(f+h),e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},c.frustum=function(e,t,n,r,i,s,o){var u=1/(n-t),a=1/(i-r),f=1/(s-o);return e[0]=s*2*u,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=s*2*a,e[6]=0,e[7]=0,e[8]=(n+t)*u,e[9]=(i+r)*a,e[10]=(o+s)*f,e[11]=-1,e[12]=0,e[13]=0,e[14]=o*s*2*f,e[15]=0,e},c.perspective=function(e,t,n,r,i){var s=1/Math.tan(t/2),o=1/(r-i);return e[0]=s/n,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=s,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=(i+r)*o,e[11]=-1,e[12]=0,e[13]=0,e[14]=2*i*r*o,e[15]=0,e},c.ortho=function(e,t,n,r,i,s,o){var u=1/(t-n),a=1/(r-i),f=1/(s-o);return e[0]=-2*u,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=-2*a,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=2*f,e[11]=0,e[12]=(t+n)*u,e[13]=(i+r)*a,e[14]=(o+s)*f,e[15]=1,e},c.lookAt=function(e,n,r,i){var s,o,u,a,f,l,h,p,d,v,m=n[0],g=n[1],y=n[2],b=i[0],w=i[1],E=i[2],S=r[0],x=r[1],T=r[2];return Math.abs(m-S)<t&&Math.abs(g-x)<t&&Math.abs(y-T)<t?c.identity(e):(h=m-S,p=g-x,d=y-T,v=1/Math.sqrt(h*h+p*p+d*d),h*=v,p*=v,d*=v,s=w*d-E*p,o=E*h-b*d,u=b*p-w*h,v=Math.sqrt(s*s+o*o+u*u),v?(v=1/v,s*=v,o*=v,u*=v):(s=0,o=0,u=0),a=p*u-d*o,f=d*s-h*u,l=h*o-p*s,v=Math.sqrt(a*a+f*f+l*l),v?(v=1/v,a*=v,f*=v,l*=v):(a=0,f=0,l=0),e[0]=s,e[1]=a,e[2]=h,e[3]=0,e[4]=o,e[5]=f,e[6]=p,e[7]=0,e[8]=u,e[9]=l,e[10]=d,e[11]=0,e[12]=-(s*m+o*g+u*y),e[13]=-(a*m+f*g+l*y),e[14]=-(h*m+p*g+d*y),e[15]=1,e)},c.str=function(e){return"mat4("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+", "+e[4]+", "+e[5]+", "+e[6]+", "+e[7]+", "+e[8]+", "+e[9]+", "+e[10]+", "+e[11]+", "+e[12]+", "+e[13]+", "+e[14]+", "+e[15]+")"},typeof e!="undefined"&&(e.mat4=c);var h={};h.create=function(){var e=new n(4);return e[0]=0,e[1]=0,e[2]=0,e[3]=1,e},h.rotationTo=function(){var e=o.create(),t=o.fromValues(1,0,0),n=o.fromValues(0,1,0);return function(r,i,s){var u=o.dot(i,s);return u<-0.999999?(o.cross(e,t,i),o.length(e)<1e-6&&o.cross(e,n,i),o.normalize(e,e),h.setAxisAngle(r,e,Math.PI),r):u>.999999?(r[0]=0,r[1]=0,r[2]=0,r[3]=1,r):(o.cross(e,i,s),r[0]=e[0],r[1]=e[1],r[2]=e[2],r[3]=1+u,h.normalize(r,r))}}(),h.setAxes=function(){var e=l.create();return function(t,n,r,i){return e[0]=r[0],e[3]=r[1],e[6]=r[2],e[1]=i[0],e[4]=i[1],e[7]=i[2],e[2]=n[0],e[5]=n[1],e[8]=n[2],h.normalize(t,h.fromMat3(t,e))}}(),h.clone=u.clone,h.fromValues=u.fromValues,h.copy=u.copy,h.set=u.set,h.identity=function(e){return e[0]=0,e[1]=0,e[2]=0,e[3]=1,e},h.setAxisAngle=function(e,t,n){n*=.5;var r=Math.sin(n);return e[0]=r*t[0],e[1]=r*t[1],e[2]=r*t[2],e[3]=Math.cos(n),e},h.add=u.add,h.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=n[0],a=n[1],f=n[2],l=n[3];return e[0]=r*l+o*u+i*f-s*a,e[1]=i*l+o*a+s*u-r*f,e[2]=s*l+o*f+r*a-i*u,e[3]=o*l-r*u-i*a-s*f,e},h.mul=h.multiply,h.scale=u.scale,h.rotateX=function(e,t,n){n*=.5;var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a+o*u,e[1]=i*a+s*u,e[2]=s*a-i*u,e[3]=o*a-r*u,e},h.rotateY=function(e,t,n){n*=.5;var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a-s*u,e[1]=i*a+o*u,e[2]=s*a+r*u,e[3]=o*a-i*u,e},h.rotateZ=function(e,t,n){n*=.5;var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a+i*u,e[1]=i*a-r*u,e[2]=s*a+o*u,e[3]=o*a-s*u,e},h.calculateW=function(e,t){var n=t[0],r=t[1],i=t[2];return e[0]=n,e[1]=r,e[2]=i,e[3]=-Math.sqrt(Math.abs(1-n*n-r*r-i*i)),e},h.dot=u.dot,h.lerp=u.lerp,h.slerp=function(e,t,n,r){var i=t[0],s=t[1],o=t[2],u=t[3],a=n[0],f=n[1],l=n[2],c=n[3],h,p,d,v,m;return p=i*a+s*f+o*l+u*c,p<0&&(p=-p,a=-a,f=-f,l=-l,c=-c),1-p>1e-6?(h=Math.acos(p),d=Math.sin(h),v=Math.sin((1-r)*h)/d,m=Math.sin(r*h)/d):(v=1-r,m=r),e[0]=v*i+m*a,e[1]=v*s+m*f,e[2]=v*o+m*l,e[3]=v*u+m*c,e},h.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n*n+r*r+i*i+s*s,u=o?1/o:0;return e[0]=-n*u,e[1]=-r*u,e[2]=-i*u,e[3]=s*u,e},h.conjugate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e[3]=t[3],e},h.length=u.length,h.len=h.length,h.squaredLength=u.squaredLength,h.sqrLen=h.squaredLength,h.normalize=u.normalize,h.fromMat3=function(){var e=typeof Int8Array!="undefined"?new Int8Array([1,2,0]):[1,2,0];return function(t,n){var r=n[0]+n[4]+n[8],i;if(r>0)i=Math.sqrt(r+1),t[3]=.5*i,i=.5/i,t[0]=(n[7]-n[5])*i,t[1]=(n[2]-n[6])*i,t[2]=(n[3]-n[1])*i;else{var s=0;n[4]>n[0]&&(s=1),n[8]>n[s*3+s]&&(s=2);var o=e[s],u=e[o];i=Math.sqrt(n[s*3+s]-n[o*3+o]-n[u*3+u]+1),t[s]=.5*i,i=.5/i,t[3]=(n[u*3+o]-n[o*3+u])*i,t[o]=(n[o*3+s]+n[s*3+o])*i,t[u]=(n[u*3+s]+n[s*3+u])*i}return t}}(),h.str=function(e){return"quat("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+")"},typeof e!="undefined"&&(e.quat=h)}(t.exports)})(this);

/**
 * Style
 * @config  fillStyle | fill,
 * @config  strokeStyle | stroke,
 * @config  lineWidth,
 * @config  shadowColor,
 * @config  shadowOffsetX,
 * @config  shadowOffsetY,
 * @config  shadowBlur,
 * @config  globalAlpha | alpha
 * @config  shadow
 */
define('2d/style',['require','core/base','_'],function(require){
    
    var Base = require('core/base');
    var _ = require('_');

    var _styles = ['fillStyle', 
                    'strokeStyle', 
                    'lineWidth', 
                    'shadowColor', 
                    'shadowOffsetX', 
                    'shadowOffsetY',
                    'shadowBlur',
                    'globalAlpha',
                    'font'];
    var _styleAlias = {          //extend some simplify style name
                         'fill' : 'fillStyle',
                         'stroke' : 'strokeStyle',
                         'alpha' : 'globalAlpha',
                         'shadow' : ['shadowOffsetX', 
                                    'shadowOffsetY', 
                                    'shadowBlur', 
                                    'shadowColor']
                        };

    var shadowSyntaxRegex = /([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([a-zA-Z0-9\(\)\s,#]+)/;
    
    var Style = Base.derive({}, {

        bind : function(ctx){

            var styles = _styles;
            var styleAlias = _styleAlias;

            for( var alias in styleAlias ){
                if( this.hasOwnProperty(alias) ){
                    var name = styleAlias[alias];
                    var value = this[alias];
                    // composite styles, like shadow, the value can be "0 0 10 #000"
                    if( alias == "shadow" ){
                        var res = shadowSyntaxRegex.exec(trim(value));
                        if( ! res )
                            continue;
                        value = res.slice(1);
                        _.each( value, function(item, idx){
                            if( name[idx] ){
                                ctx[ name[idx] ] = item;
                            }
                        }, this)
                    }else{
                        ctx[ name ] = value;
                    }
                }
            }
            _.each(styles, function(styleName){
                if( this.hasOwnProperty( styleName ) ){
                    ctx[styleName] = this[styleName];
                }   
            }, this)
        }
    })

    function trim(str){
        return (str || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
    }

    return Style;
});
/**
 * Node of the scene tree
 * And it is the base class of all elements
 */
define('2d/node',['require','core/base','glmatrix','./style'],function(require){
    
    var Base = require("core/base");
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;
    var mat2d = glmatrix.mat2d;
    var Style = require("./style");

    var Node = Base.derive( function(){
        return {
            //a flag to judge if mouse is over the element
            __mouseover__ : false,
            
            id : 0,
            
            //Axis Aligned Bounding Box
            AABB : [vec2.fromValues(0, 0), vec2.fromValues(0, 0)],
            // z index
            z : 0,
            // GooJS.Style
            style : null,
            
            position : vec2.fromValues(0, 0),
            rotation : 0,
            scale : vec2.fromValues(1, 1),

            _transform : mat2d.create(),
            // inverse matrix of transform matrix
            _transformInverse : mat2d.create(),

            // visible flag
            visible : true,

            children : {},
            // virtual width of the stroke line for intersect
            intersectLineWidth : 0,

            // Clip flag
            // If it is true, this element can be used as a mask
            // and all the children will be clipped in its shape
            //
            // TODO: add an other mask flag to distinguish with the clip?
            clip : false,

            // flag of fill when drawing the element
            fill : true,
            // flag of stroke when drawing the element
            stroke : true,
            // fix aa problem
            // https://developer.mozilla.org/en-US/docs/HTML/Canvas/Tutorial/Applying_styles_and_colors?redirectlocale=en-US&redirectslug=Canvas_tutorial%2FApplying_styles_and_colors#section_8
            fixAA : true
        }
    }, function(){
        
        this.__GUID__ = genGUID();

    }, {
        updateTransform : function(){
            var transform = this._transform;
            mat2d.identity( transform );
            if( this.scale)
                mat2d.scale(transform, transform, this.scale);
            if( this.rotation)
                mat2d.rotate(transform, transform, this.rotation);
            if( this.position)
                mat2d.translate(transform, transform, this.position);
            
            return transform;
        },
        updateTransformInverse : function(){
            mat2d.invert(this._transformInverse, this._transformInverse);
        },
        // intersect with the bounding box
        intersectAABB : function(x, y){
            var AABB = this.AABB;
            return  (AABB[0][0] < x && x < AABB[1][0]) && (AABB[0][1] < y && y< AABB[1][1]);
        },

        add : function(elem){
            if( elem ){
                this.children[elem.__GUID__] = elem;
                elem.parent = this;
            }
        },
        remove : function(elem){
            this.children[elem.__GUID__] = null;
            elem.parent = null;
        },

        draw : function(context){},

        render : function(context){
            
            var renderQueue = this._getSortedRenderQueue();
            context.save();
            if( this.style ){
                if( ! this.style instanceof Style ){
                    for(var name in this.style ){
                        this.style[ name ].bind(context);
                    }
                }else{
                    this.style.bind(context);
                }
            }
            var m = this.updateTransform();
            context.transform( m[0], m[1], m[2], m[3], m[4], m[5]);

            this.draw( context );

            //clip from current path;
            this.clip && context.clip();

            for(var i = 0; i < renderQueue.length; i++){
                renderQueue[i].render( context );
            }
            context.restore();
        },

        traverse : function(callback){
            var stopTraverse = callback && callback( this );
            if( ! stopTraverse ){
                var children = this.children;
                for( var i = 0, len = children.length; i < len; i++){
                    children[i].traverse( callback );
                }
            }
        },

        intersect : function(x, y, eventName){

        },

        _getSortedRenderQueue : function(){
            var renderQueue = [];
            for(var guid in this.children ){
                renderQueue.push( this.children[guid] );
            }
            renderQueue.sort( function(x, y){
                if( x.z === y.z)
                    return x.__GUID__ > y.__GUID__ ? 1 : -1;
                return x.z > y.z ? 1 : -1 ;
            } );
            return renderQueue; 
        }
    })

    var genGUID = (function(){
        var guid = 0;
        
        return function(){
            return ++guid;
        }
    })()

    return Node;
});
/**
 *
 * @export{object}
 */
define('2d/util',['require'], function(require){

    return {
        fixPos: function( pos ){
            return [pos[0]+0.5, pos[1]+0.5];
        },
        fixPosArray : function( poslist ){
            var ret = [];
            var len = poslist.length;
            for(var i = 0; i < len; i++){
                ret.push( this.fixPos(poslist[i]) );
            }
            return ret;
        },
        computeAABB : function( points ){
            var left = points[0][0];
            var right = points[0][0];
            var top = points[0][1];
            var bottom = points[0][1];
            
            for(var i = 1; i < points.length; i++){
                left = points[i][0] < left ? points[i][0] : left;
                right = points[i][0] > right ? points[i][0] : right;
                top = points[i][1] < top ? points[i][1] : top;
                bottom = points[i][1] > bottom ? points[i][1] : bottom;
            }
            return [[left, top], [right, bottom]];
        }
    }
} );
define('2d/renderable/arc',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Arc = Node.derive( function(){
        return {
            center      : [0, 0],
            radius      : 0,
            startAngle  : 0,
            endAngle    : Math.PI*2,
            clockwise   : true
        }
    }, {
        computeAABB : function(){
            // TODO
            this.AABB = [[0, 0], [0, 0]];
        },
        draw : function(contex){

            var center = this.fixAA ? util.fixPos( this.center ) : this.center;

            ctx.beginPath();
            ctx.arc(center[0], center[1], this.radius, this.startAngle, this.endAngle,  ! this.clockwise);
            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }   
        },
        intersect : function(x, y){
            // TODO
            return false;
        }
    })

    return Arc;
});
define('2d/renderable/circle',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Circle = Node.derive( function() {
        return {
            center : [0, 0],
            radius : 0   
        }

    }, {
        computeAABB : function() {
            this.AABB = [[this.center[0]-this.radius, this.center[1]-this.radius],
                         [this.center[0]+this.radius, this.center[1]+this.radius]];
        },
        draw : function(ctx) {
            var center = this.fixAA ? util.fixPos( this.center ) : this.center;

            ctx.beginPath();
            ctx.arc(center[0], center[1], this.radius, 0, 2*Math.PI, false);
            
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }
        },
        intersect : function() {

            return vec2.len([this.center[0]-x, this.center[1]-y]) < this.radius;
        }
    } )

    return Circle;
});
define('2d/renderable/image',['require','../node','../util','glmatrix'],function(require) {

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var _imageCache = {};
    
    var Image = Node.derive( function() {
        return {
            img     : '',
            start   : [0, 0],
            size    : 0,
            onload  : function() {}
        }
    }, function() {
        if(typeof this.img == 'string') {
            var self = this;
            
            this.load( this.img, function(img) {
                self.img = img;
                self.onload.call( self );
            })
        }
    }, {
        computeAABB : function() {

            this.AABB = util.computeAABB([this.start, [this.start[0]+this.size[0], this.start[1]+this.size[1]]]);
        },
        draw : function(ctx) {

            var start = this.fixAA ? util.fixPos(this.start) : this.start;

            if(typeof this.img != 'string') {
                this.size ? 
                    ctx.drawImage(this.img, start[0], start[1], this.size[0], this.size[1]) :
                    ctx.drawImage(this.img, start[0], start[1]);
            }

        },
        intersect : function(x, y) {

            return this.intersectAABB(x, y);
        },
        load : function( src, callback ) {

            if( _imageCache[src] ) {
                var img = _imageCache[src];
                if( img.constructor == Array ) {
                    img.push( callback );
                }else{
                    callback(img);
                }
            }else{
                _imageCache[src] = [callback];
                var img = new Image();
                img.onload = function() {
                    each( _imageCache[src], function(cb) {
                        cb( img );
                    })
                    _imageCache[src] = img;
                }
                img.src = src;
            }
        }
    })
    
    return Image;
});
define('2d/renderable/line',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Line = Node.derive(function(){
        return {
            start : [0, 0],
            end : [0, 0],
            width : 0   //virtual width of the line for intersect computation 
        }
    }, {
        computeAABB : function(){

            this.AABB = util.computeAABB([this.start, this.end]);
            
            if(this.AABB[0][0] == this.AABB[1][0]){ //line is vertical
                this.AABB[0][0] -= this.width/2;
                this.AABB[1][0] += this.width/2;
            }
            if(this.AABB[0][1] == this.AABB[1][1]){ //line is horizontal
                this.AABB[0][1] -= this.width/2;
                this.AABB[1][1] += this.width/2;
            }
        },
        draw : function(ctx){
            
            var start = this.fixAA ? util.fixPos(this.start) : this.start,
                end = this.fixAA ? util.fixPos(this.end) : this.end;

            ctx.beginPath();
            ctx.moveTo(start[0], start[1]);
            ctx.lineTo(end[0], end[1]);
            ctx.stroke();

        },
        intersect : function(x, y){
            
            if(!this.intersectAABB(x, y)){
                return false;
            }
            //计算投影点
            var a = [x, y]
                b = this.start,
                c = this.end,
                ba = vec2.sub([], a, b),
                bc = vec2.sub([], c, b);
            
            var dd = vec2.dot(bc, ba);  //ba在bc上的投影长度
            vec2.normalize(bc, bc);
            
            var d = vec2.add(b, vec2.scale(bc, dd));        //投影点   
            var distance = vec2.length(vec2.sub(a, a, d));
            return distance < this.width/2;
        }
    });

    return Line;
});
define('2d/renderable/path',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Path = Node.derive( function(){
        return {
            segments : [],
            globalStyle : true
        }
    }, {
        computeAABB : function(){
            this.AABB = [[0, 0], [0, 0]];
        },
        draw : function(ctx){
            
            if(this.globalStyle){
                this.drawWithSameStyle(ctx);
            }else{
                this.drawWithDifferentStyle(ctx);
            }
        },
        drawWithSameStyle : function(ctx){
            
            var l = this.segments.length;
            var segs = this.segments;

            ctx.beginPath();
            ctx.moveTo(segs[0].point[0], segs[0].point[1]);
            for(var i =1; i < l; i++){

                if(segs[i-1].handleOut || segs[i].handleIn){
                    var prevHandleOut = segs[i-1].handleOut || segs[i-1].point;
                    var handleIn = segs[i].handleIn || segs[i].point;
                    ctx.bezierCurveTo(prevHandleOut[0], prevHandleOut[1],
                            handleIn[0], handleIn[1], segs[i].point[0], segs[i].point[1]);
                }
                else{
                    ctx.lineTo(segs[i].point[0], segs[i].point[1]);
                }

            }
            if(this.fill){
                ctx.fill();
            }
            if(this.stroke){
                ctx.stroke();
            }   
        },
        drawWithDifferentStyle : function(ctx){
            
            var l = this.segments.length;
            var segs = this.segments;

            for(var i =0; i < l-1; i++){

                ctx.save();
                segs[i].style && segs[i].style.bind(ctx);

                ctx.beginPath();
                ctx.moveTo(segs[i].point[0], segs[i].point[1]);

                if(segs[i].handleOut || segs[i+1].handleIn){
                    var handleOut = segs[i].handleOut || segs[i].point;
                    var nextHandleIn = segs[i+1].handleIn || segs[i+1].point;
                    ctx.bezierCurveTo(handleOut[0], handleOut[1],
                            nextHandleIn[0], nextHandleIn[1], segs[i+1].point[0], segs[i+1].point[1]);
                }
                else{
                    ctx.lineTo(segs[i+1].point[0], segs[i+1].point[1]);
                }

                if(this.stroke){
                    ctx.stroke();
                }
                if(this.fill){
                    ctx.fill();
                }
                ctx.restore();
            }
        },
        smooth : function(degree){
            var len = this.segments.length;
            var middlePoints = [];
            var segs = this.segments;

            function computeVector(a, b, c){
                var m = vec2.scale([], vec2.add([], b, c), 0.5);
                return vec2.sub([], a, m);
            }

            for(var i = 0; i < len; i++){
                var point = segs[i].point;
                var nextPoint = (i == len-1) ? segs[0].point : segs[i+1].point;
                middlePoints.push(
                        vec2.scale([], vec2.add([], point, nextPoint), 0.5));
            }

            for(var i = 0; i < len; i++){
                var point = segs[i].point;
                var middlePoint = middlePoints[i];
                var prevMiddlePoint = (i == 0) ? middlePoints[len-1] : middlePoints[i-1];
                var degree = segs[i].smoothLevel || degree || 1;
                var middleMiddlePoint = vec2.scale([], vec2.add([], middlePoint, prevMiddlePoint), 0.5);
                var v1 = vec2.sub([], middlePoint, middleMiddlePoint);
                var v2 = vec2.sub([], prevMiddlePoint, middleMiddlePoint);

                var dv = computeVector(point, prevMiddlePoint, middlePoint);
                //use degree to scale the handle length
                vec2.scale(v2, v2, degree);
                vec2.scale(v1, v1, degree);
                segs[i].handleIn = vec2.add([], vec2.add([], middleMiddlePoint, v2), dv);
                segs[i].handleOut = vec2.add([], vec2.add([], middleMiddlePoint, v1), dv);
            }
            segs[0].handleOut = segs[0].handleIn = null;
            segs[len-1].handleIn = segs[len-1].handleOut = null;
            
        },
        pushPoints : function(points){
            for(var i = 0; i < points.length; i++){
                this.segments.push({
                    point : points[i],
                    handleIn : null,
                    handleOut : null
                })
            }
        }
    })

    return Path;
});
define('2d/renderable/polygon',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Polygon = Node.derive( function(){
        return {
            points : []
        }
    }, {
        computeAABB : function(){
            this.AABB = util.computeAABB( this.points );
        },
        draw : function(ctx){

            var points = this.fixAA ? util.fixPosArray(this.points) : this.points;

            ctx.beginPath();
            
            ctx.moveTo(points[0][0], points[0][1]);
            for(var i =1; i < points.length; i++){
                ctx.lineTo(points[i][0], points[i][1]);
            }
            ctx.closePath();
            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }
        },
        intersect : function(x, y){
    
            if(!this.intersectAABB(x, y)){
                return false;
            }

            var len = this.points.length;
            var angle = 0;
            var points = this.points;
            var vec1, vec2, j, piece;
            for(var i =0; i < len; i++){
                vec1 = vec2.normalize([], [points[i][0]-x, points[i][1]-y]);
                j = (i+1)%len;
                vec2 =  vec2.normalize([], [points[j][0]-x, points[j][1]-y]);
                piece = Math.acos(vec2.dot(vec1, vec2));
                angle += piece;
            }
            return Math.length(angle - 2*Math.PI) < 0.001;
        }
    })

    return Node;
});
define('2d/renderable/rectangle',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node'),
        util = require('../util'),
        glmatrix = require('glmatrix'),
        vec2 = glmatrix.vec2;

    var Rectangle = Node.derive( function(){
        return {
            start : [0, 0],
            size : [0, 0]
        }
    }, {
        computeAABB : function(){
            var end = vec2.add([], this.start, this.size);
            this.AABB = util.computeAABB([this.start, end]);
        },
        draw : function(ctx){

            var start = this.fixAA ? util.fixPos(this.start) : this.start;

            ctx.beginPath();
            ctx.rect(start[0], start[1], this.size[0], this.size[1]);
            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }
        },
        intersect : function(x, y){
            
            return this.intersectAABB(x, y);
        }
    })

    return Rectangle;
});
/**
 * @export{class} RoundedRectangle
 */
define('2d/renderable/roundedrectangle',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var RoundedRectange = Node.derive( function(){
        return {
            start   : [0, 0],
            size    : [0, 0],
            radius  : 0
        }
    }, {
        computeAABB : function(){
            var end = vec2.add([], this.start, this.size);
            this.AABB = util.computeAABB([this.start, end]);
        },
        draw : function(ctx){

            if( this.radius.constructor == Number){
                // topleft, topright, bottomright, bottomleft
                var radius = [this.radius, this.radius, this.radius, this.radius];
            }else if( this.radius.length == 2){
                var radius = [this.radius[0], this.radius[1], this.radius[0], this.radius[1]];
            }else{
                var radius = this.radius;
            }

            var start = this.fixAA ? util.fixPos(this.start) : this.start;
            var size = this.size;
            var v1 = vec2.add([], start, [radius[0], 0]);   //left top
            var v2 = vec2.add([], start, [size[0], 0]);     //right top
            var v3 = vec2.add([], start, size);             //right bottom
            var v4 = vec2.add([], start, [0, size[1]]);     //left bottom
            ctx.beginPath();
            ctx.moveTo( v1[0], v1[1] );
            radius[1] ? 
                ctx.arcTo( v2[0], v2[1], v3[0], v3[1], radius[1]) :
                ctx.lineTo( v2[0], v2[1] );
            radius[2] ?
                ctx.arcTo( v3[0], v3[1], v4[0], v4[1], radius[2]) :
                ctx.lineTo( v3[0], v3[1] );
            radius[3] ?
                ctx.arcTo( v4[0], v4[1], start[0], start[1], radius[3]) :
                ctx.lineTo( v4[0], v4[1] );
            radius[0] ? 
                ctx.arcTo( start[0], start[1], v2[0], v2[1], radius[0]) :
                ctx.lineTo( start[0], start[1]);
            
            if( this.stroke ){
                ctx.stroke();
            }
            if( this.fill ){
                ctx.fill();
            }
        },
        intersect : function(x, y){
            // TODO
            return false;
        }
    })

    return RoundedRectange;
});
define('2d/renderable/sector',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Sector = Node.derive( function(){
        return {
            center      : [0, 0],
            innerRadius : 0,
            outerRadius : 0,
            startAngle  : 0,
            endAngle    : 0,
            clockwise   : true
        }
    }, {
        computeAABB : function(){
            // TODO
            this.AABB = [0, 0];
        },
        intersect : function(x, y){

            var startAngle = this.startAngle;
            var endAngle = this.endAngle;
            var r1 = this.innerRadius;
            var r2 = this.outerRadius;
            var c = this.center;
            var v = vec2.sub([], [x, y], c);
            var r = vec2.length(v);
            var pi2 = Math.PI * 2;

            if(r < r1 || r > r2){
                return false;
            }
            var angle = Math.atan2(v[1], v[0]);

            //need to constraint the angle between 0 - 360
            if(angle < 0){
                angle = angle+pi2;
            }
            
            if(this.clockwise){
                
                return angle < endAngle && angle > startAngle;
            }else{
                startAngle =  pi2 - startAngle;
                endAngle = pi2 - endAngle;
                return angle > endAngle && angle < startAngle;
            }   
        },
        draw : function(ctx){

            var startAngle = this.startAngle;
            var endAngle = this.endAngle;
            var r1 = this.innerRadius;
            var r2 = this.outerRadius;
            var c = this.fixAA ? util.fixPos( this.center ) : this.center;

            if( ! this.clockwise ){
                startAngle =  Math.PI*2 - startAngle;
                endAngle =  Math.PI*2 - endAngle;
            }

            var startInner = vec2.add([], c, [r1 * Math.cos(startAngle), r1 * Math.sin(startAngle)]);
            var startOuter = vec2.add([], c, [r2 * Math.cos(startAngle), r2 * Math.sin(startAngle)]);
            var endInner = vec2.add([], c, [r1 * Math.cos(endAngle), r1 * Math.sin(endAngle)]);
            var endOuter = vec2.add([], c, [r2 * Math.cos(endAngle), r2 * Math.sin(endAngle)]);

            ctx.beginPath();
            ctx.moveTo(startInner[0], startInner[1]);
            ctx.lineTo(startOuter[0], startOuter[1]);
            ctx.arc(c[0], c[1], r2, startAngle, endAngle, ! this.clockwise);
            ctx.lineTo(endInner[0], endInner[1]);
            ctx.arc(c[0], c[1], r1, endAngle, startAngle, this.clockwise);
            ctx.endPath();

            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }
        }
    })

    return Sector;
});
define('2d/renderable/text',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Text = Node.derive( function(){
        return {
            text : '',
            start : [0, 0],
            size : [0, 0],
            font : '',
            textAlign : '',
            textBaseline : ''
        }
    }, {
        computeAABB : function(){
            this.AABB = util.computeAABB( [this.start, [this.start[0]+this.size[0], this.start[1]+this.size[1]]] );
        },
        draw : function(ctx){
            var start = this.fixAA ? util.fixPos(this.start) : this.start;
            if(this.font){
                ctx.font = this.font;
            }
            if(this.textAlign){
                ctx.textAlign = this.textAlign;
            }
            if(this.textBaseline){
                ctx.textBaseline = this.textBaseline
            }
            if(this.fill){
                this.size.length && this.size[0] ?
                    ctx.fillText(this.text, start[0], start[1], this.size[0]) :
                    ctx.fillText(this.text, start[0], start[1]);
            }
            if(this.stroke){
                this.size.length && this.size[0] ?
                    ctx.strokeText(this.text, start[0], start[1], this.size[0]) :
                    ctx.strokeText(this.text, start[0], start[1]);
            }
        },
        resize : function(ctx){
            if(! this.size[0] || this.needResize){
                this.size[0] = ctx.measureText(this.text).width;
                this.size[1] = ctx.measureText('m').width;
            }
        },
        intersect : function(x, y){
            return this.intersectAABB(x, y);
        }
    })

    return Text;
});
/**
 * Text Box
 * Support word wrap and word break
 * Drawing is based on the Text
 * @export{class} TextBox
 *
 * TODO: support word wrap of non-english text
 *      shift first line by (lineHeight-fontSize)/2
 */
define('2d/renderable/textbox',['require','../node','../util','glmatrix','./text','_'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;
    var Text = require('./text');
    var _ = require('_');

    var TextBox = Node.derive( function(){
        return {
            text            : '',
            textAlign       : '',
            textBaseline    : 'top',
            font            : '',

            start           : [0, 0],
            width           : 0,
            wordWrap        : false,
            wordBreak       : false,
            lineHeight      : 0,
            stroke          : false,
            // private prop, save Text instances
            _texts          : []
        }
    }, function(){
        // to verify if the text is changed
        this._oldText = "";
    }, {
        computeAABB : function(){
            // TODO
        },
        draw : function(ctx){
            if( this.text != this._oldText){
                this._oldText = this.text;

                //set font for measureText
                if( this.font ){
                    ctx.font = this.font;
                }
                if( this.wordBreak){
                    this._texts = this.computeWordBreak( ctx );
                }
                else if(this.wordWrap){
                    this._texts = this.computeWordWrap( ctx );
                }
                else{
                    var txt = new Text({
                        text : this.text,
                        textBaseline : this.textBaseline
                    })
                    this.extendCommonProperties(txt);
                    this._texts = [txt]
                }
            }
            _.each(this._texts, function(_text){
                _text.draw(ctx);
            })
        },
        computeWordWrap : function( ctx ){
            if( ! this.text){
                return;
            }
            var words = this.text.split(' ');
            var len = words.length;
            var lineWidth = 0;
            var wordWidth;
            var wordText;
            var texts = [];
            var txt;

            for( var i = 0; i < len; i++){
                wordText = i == len-1 ? words[i] : words[i]+' ';
                wordWidth = ctx.measureText( wordText ).width;
                if( lineWidth + wordWidth > this.width ||
                    ! txt ){    //first line
                    // create a new text line and put current word
                    // in the head of new line
                    txt = new Text({
                        text : wordText, //append last word
                        start : vec2.add([], this.start, [0, this.lineHeight*texts.length])
                    })
                    this.extendCommonProperties(txt);
                    texts.push( txt );

                    lineWidth = wordWidth;
                }else{
                    lineWidth += wordWidth;
                    txt.text += wordText;
                }
            }
            return texts;
        },
        computeWordBreak : function( ctx ){
            if( ! this.text){
                return;
            }
            var len = this.text.length;
            var letterWidth;
            var letter;
            var lineWidth = ctx.measureText(this.text[0]).width;
            var texts = [];
            var txt;
            for(var i = 0; i < len; i++){
                letter = this.text[i];
                letterWidth = ctx.measureText( letter ).width;
                if( lineWidth + letterWidth > this.width || 
                    ! txt ){    //first line
                    var txt = new Text({
                        text : letter,
                        start : vec2.add([], this.start, [0, this.lineHeight*texts.length])
                    });
                    this.extendCommonProperties(txt);
                    texts.push(txt);
                    // clear prev line states
                    lineWidth = letterWidth;
                }else{
                    lineWidth += letterWidth;
                    txt.text += letter;
                }
            }
            return texts;
        },
        extendCommonProperties : function(txt){
            var props = {};
            _.extend(txt, {
                textAlign : this.textAlign,
                textBaseline : this.textBaseline,
                style : this.style,
                font : this.font,
                fill : this.fill,
                stroke : this.stroke
            })
        },
        intersect : function(x, y){
            
        }
    } )

    return TextBox;
});
define('2d/renderer',['require','core/base'], function(require){

    var Base = require('core/base');

    var Renderer = Base.derive(function(){
        return {
            canvas : null,

            context : null,

            width : 0,

            height : 0,

            _latestRenderedScene : null
        }
    }, function(){
        
        if( ! this.canvas ){
            this.canvas = document.createElement('canvas');
        }

        this.canvas.addEventListener('click', this._clickHandler.bind(this));
        this.canvas.addEventListener('mousedown', this._mouseDownHandler.bind(this));
        this.canvas.addEventListener('mouseup', this._mouseUpHandler.bind(this));
        this.canvas.addEventListener('mousemove', this._mouseMoveHandler.bind(this));
        this.canvas.addEventListener('mouseout', this._mouseOutHandler.bind(this));
        
        if( this.width ){
            this.canvas.width = this.width;
        }else{
            this.width = this.canvas.width;
        }
        if( this.height ){
            this.canvas.height = this.height;
        }else{
            this.height = this.canvas.height;
        }
        this.context = this.canvas.getContext('2d');

    }, {

        resize : function(width, height){
            this.canvas.width = width;
            this.canvas.height = height
        },

        render : function( scene ){
            this.context.clearRect(0, 0, this.width, this.height);

            scene.render( this.context );

            this._latestRenderedScene = scene;
        },

        _clickHandler : function(){
            var scene = this._latestRenderedScene;
        },

        _mouseDownHandler : function(){

        },

        _mouseUpHandler : function(){

        },

        _mouseMoveHandler : function(){

        },

        _mouseOutHandler : function(){

        }
    })

    return Renderer;
} );
define('2d/scene',['require','./node'], function(require){

    var Node = require('./node');

    var Scene = Node.derive(function(){
        return {}
    },{

    });

    return Scene;
} );
define('core/event',['require','./base'], function(require){

    var Base = require('./base');

    var Event = Base.derive({
        cancelBubble : false
    }, {
        stopPropagation : function(){
            this.cancelBubble = true;
        }
    })

    Event.throw = function(eventType, target, props){
        var e = new MouseEvent(props);
        e.sourceTarget = target;

        // enable bubble
        while(target && !e.cancelBubble ){
            e.target = target;
            target.trigger(eventType, e);

            target = target.parent;
        }
    }
} );
define('core/quaternion',['require','glmatrix'], function(require){

    var glMatrix = require("glmatrix");
    var quat = glMatrix.quat;

    var Quaternion = function(x, y, z, w){

        x = x || 0;
        y = y || 0;
        z = z || 0;
        w = typeof(w) === "undefined" ? 1 : w;
                
        return Object.create(QuaternionProto, {

            x : {
                configurable : false,
                set : function(value){
                    this._array[0] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[0];
                }
            },
            y : {
                configurable : false,
                set : function(value){
                    this._array[1] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[1];
                }
            },
            z : {
                configurable : false,
                set : function(value){
                    this._array[2] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[2];
                }
            },
            w : {
                configurable : false,
                set : function(value){
                    this._array[2] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[2];
                }
            },

            _array :{
                writable : false,
                configurable : false,
                value : quat.fromValues(x, y, z, w)
            },
            _dirty : {
                configurable : false,
                value : false
            }
        })

    }

    var QuaternionProto = {

        constructor : Quaternion,

        add : function(b){
            quat.add( this._array, this._array, b._array );
            this._dirty = true;
            return this;
        },

        calculateW : function(){
            quat.calculateW(this._array, this._array);
            this._dirty = true;
            return this;
        },

        set : function(x, y, z, w){
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._array[3] = w;
            this._dirty = true;
            return this;
        },

        clone : function(){
            return new Quaternion( this.x, this.y, this.z, this.w );
        },

        /**
         * Calculates the conjugate of a quat If the quaternion is normalized, 
         * this function is faster than quat.inverse and produces the same result.
         */
        conjugate : function(){
            quat.conjugate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        copy : function(b){
            quat.copy( this._array, b._array );
            this._dirty = true;
            return this;
        },

        dot : function(b){
            return quat.dot(this._array, b._array);
        },

        fromMat3 : function(m){
            quat.fromMat3(this._array, m._array);
            this._dirty = true;
            return this;
        },

        fromMat4 : (function(){
            var mat3 = glMatrix.mat3;
            var m3 = mat3.create();
            return function(m){
                mat3.fromMat4(m3, m._array);
                // Not like mat4, mat3 in glmatrix seems to be row-based
                mat3.transpose(m3, m3);
                quat.fromMat3(this._array, m3);
                this._dirty = true;
                return this;
            }
        })(),

        identity : function(){
            quat.identity(this._array);
            this._dirty = true;
            return this;
        },

        invert : function(){
            quat.invert(this._array, this._array);
            this._dirty = true;
            return this;
        },

        len : function(){
            return quat.len(this._array);
        },

        length : function(){
            return quat.length(this._array);
        },

        /**
         * Perform linear interpolation between a and b
         */
        lerp : function(a, b, t){
            quat.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        mul : function(b){
            quat.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b){
            quat.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        normalize : function(){
            quat.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        rotateX : function(rad){
            quat.rotateX(this._array, this._array, rad); 
            this._dirty = true;
            return this;
        },

        rotateY : function(rad){
            quat.rotateY(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },

        rotateZ : function(rad){
            quat.rotateZ(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },

        setAxisAngle : function(axis /*Vector3*/, rad){
            quat.setAxisAngle(this._array, axis._array, rad);
            this._dirty = true;
            return this;
        },

        slerp : function(a, b, t){
            quat.slerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        sqrLen : function(){
            return quat.sqrLen(this._array);
        },

        squaredLength : function(){
            return quat.squaredLength(this._array);
        },
        /**
         * Set quaternion from euler angle
         */
        setFromEuler : function(v){
            
        },

        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    return Quaternion;
} );
/**
 *  @export{object} requester
 */
define('core/request',['require'], function(require){

    function get(options){

        var xhr = new XMLHttpRequest();

        xhr.open("get", options.url);
        // With response type set browser can get and put binary data
        // https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Sending_and_Receiving_Binary_Data
        // Defautl is text, and it can be set
        // arraybuffer, blob, document, json, text
        xhr.responseType = options.responseType || "text";

        if(options.onprogress){
            //https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Using_XMLHttpRequest
            xhr.onprogress = function(e){
                if(e.lengthComputable){
                    var percent = e.loaded / e.total;
                    options.onprogress(percent, e.loaded, e.total);
                }else{
                    options.onprogress(null);
                }
            }
        }
        xhr.onload = function(e){
            options.onload && options.onload(xhr.response);
        }
        if(options.onerror){
            xhr.onerror = options.onerror;
        }
        xhr.send(null);
    }

    function put(options){

    }

    return {
        get : get,
        put : put
    }
} );
;
define("core/vector2", function(){});

define('util/color',['require'], function(require){

	
} );
define('util/util',['require'], function(require){

	return {

		genGUID : (function(){
			var guid = 0;
			
			return function(){
				return ++guid;
			}
		})()
	}
} );
define('util/xmlparser',['require'], function(require){

});
define('qtek2d',['require','2d/camera','2d/node','2d/renderable/arc','2d/renderable/circle','2d/renderable/image','2d/renderable/line','2d/renderable/path','2d/renderable/polygon','2d/renderable/rectangle','2d/renderable/roundedrectangle','2d/renderable/sector','2d/renderable/text','2d/renderable/textbox','2d/renderer','2d/scene','2d/style','2d/util','core/base','core/cache','core/event','core/mixin/derive','core/mixin/dirty','core/mixin/notifier','core/quaternion','core/request','core/vector2','util/color','util/util','util/xmlparser','glmatrix'], function(require){
    
    var exportsObject =  {
    "2d": {
        "Camera": require('2d/camera'),
        "Node": require('2d/node'),
        "renderable": {
            "Arc": require('2d/renderable/arc'),
            "Circle": require('2d/renderable/circle'),
            "Image": require('2d/renderable/image'),
            "Line": require('2d/renderable/line'),
            "Path": require('2d/renderable/path'),
            "Polygon": require('2d/renderable/polygon'),
            "Rectangle": require('2d/renderable/rectangle'),
            "RoundedRectangle": require('2d/renderable/roundedrectangle'),
            "Sector": require('2d/renderable/sector'),
            "Text": require('2d/renderable/text'),
            "TextBox": require('2d/renderable/textbox')
        },
        "Renderer": require('2d/renderer'),
        "Scene": require('2d/scene'),
        "Style": require('2d/style'),
        "util": require('2d/util')
    },
    "core": {
        "Base": require('core/base'),
        "Cache": require('core/cache'),
        "Event": require('core/event'),
        "mixin": {
            "derive": require('core/mixin/derive'),
            "Dirty": require('core/mixin/dirty'),
            "notifier": require('core/mixin/notifier')
        },
        "Quaternion": require('core/quaternion'),
        "requester": require('core/request'),
        "Vector2": require('core/vector2'),
    },
    "util": {
        "Color": require('util/color'),
        "Util": require('util/util'),
        "Xmlparser": require('util/xmlparser')
    }
};

    var glMatrix = require('glmatrix');
    exportsObject.math = glMatrix;
    
    return exportsObject;
});
var qtek = require("qtek2d");

for(var name in qtek){
    _exports[name] = qtek[name];
}

})