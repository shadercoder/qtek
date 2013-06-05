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
define('core/vector3',['require','glmatrix'], function(require){

    var glMatrix = require("glmatrix");
    var vec3 = glMatrix.vec3;

    var Vector3 = function(x, y, z){
        
        x = x || 0;
        y = y || 0;
        z = z || 0;
        
        return Object.create(Vector3Proto, {

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

            _array : {
                writable : false,
                configurable : false,
                value : vec3.fromValues(x, y, z)
            },
            // Dirty flag is used by the Node to determine
            // if the matrix is updated to latest
            _dirty : {
                configurable : false,
                value : true
            }
        })

    }

    var Vector3Proto = {

        constructor : Vector3,

        add : function(b){
            vec3.add( this._array, this._array, b._array );
            this._dirty = true;
            return this;
        },

        set : function(x, y, z){
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._dirty = true;
            return this;
        },

        clone : function(){
            return new Vector3( this.x, this.y, this.z );
        },

        copy : function(b){
            vec3.copy( this._array, b._array );
            this._dirty = true;
            return this;
        },

        cross : function(out, b){
            vec3.cross(out._array, this._array, b._array);
            return this;
        },

        dist : function(b){
            return vec3.dist(this._array, b._array);
        },

        distance : function(b){
            return vec3.distance(this._array, b._array);
        },

        div : function(b){
            vec3.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        divide : function(b){
            vec3.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        dot : function(b){
            return vec3.dot(this._array, b._array);
        },

        len : function(){
            return vec3.len(this._array);
        },

        length : function(){
            return vec3.length(this._array);
        },
        /**
         * Perform linear interpolation between a and b
         */
        lerp : function(a, b, t){
            vec3.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        mul : function(b){
            vec3.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b){
            vec3.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        negate : function(){
            vec3.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        normalize : function(){
            vec3.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        random : function(scale){
            vec3.random(this._array, scale);
            this._dirty = true;
            return this;
        },

        scale : function(s){
            vec3.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        /**
         * add b by a scaled factor
         */
        scaleAndAdd : function(b, s){
            vec3.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },

        sqrDist : function(b){
            return vec3.sqrDist(this._array, b._array);
        },

        squaredDistance : function(b){
            return vec3.squaredDistance(this._array, b._array);
        },

        sqrLen : function(){
            return vec3.sqrLen(this._array);
        },

        squaredLength : function(){
            return vec3.squaredLength(this._array);
        },

        sub : function(b){
            vec3.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        subtract : function(b){
            vec3.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        transformMat3 : function(m){
            vec3.transformMat3(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        transformMat4 : function(m){
            vec3.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        transformQuat : function(q){
            vec3.transformQuat(this._array, this._array, q._array);
            this._dirty = true;
            return this;
        },     
        /**
         * Set euler angle from queternion
         */
        setEulerFromQuaternion : function(q){
            // var sqx = q.x * q.x;
            // var sqy = q.y * q.y;
            // var sqz = q.z * q.z;
            // var sqw = q.w * q.w;
            // this.x = Math.atan2( 2 * ( q.y * q.z + q.x * q.w ), ( -sqx - sqy + sqz + sqw ) );
            // this.y = Math.asin( -2 * ( q.x * q.z - q.y * q.w ) );
            // this.z = Math.atan2( 2 * ( q.x * q.y + q.z * q.w ), ( sqx - sqy - sqz + sqw ) );

            // return this;
        },

        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        },
    }


    function clamp( x ) {
        return Math.min( Math.max( x, -1 ), 1 );
    }

    return Vector3;

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
define('core/matrix4',['require','glmatrix','./vector3'], function(require){

    var glMatrix = require("glmatrix");
    var Vector3 = require("./vector3");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var mat3 = glMatrix.mat3;
    var quat = glMatrix.quat;

    function makeProperty(n){
        return {
            configurable : false,
            set : function(value){
                this._array[n] = value;
                this._dirty = true;
            },
            get : function(){
                return this._array[n];
            }
        }
    }
    var Matrix4 = function(){

        var axisX = new Vector3(),
            axisY = new Vector3(),
            axisZ = new Vector3();

        return Object.create(Matrix4Proto, {

            m00 : makeProperty(0),
            m01 : makeProperty(1),
            m02 : makeProperty(2),
            m03 : makeProperty(3),
            m10 : makeProperty(4),
            m11 : makeProperty(5),
            m12 : makeProperty(6),
            m13 : makeProperty(7),
            m20 : makeProperty(8),
            m21 : makeProperty(9),
            m22 : makeProperty(10),
            m23 : makeProperty(11),
            m30 : makeProperty(12),
            m31 : makeProperty(13),
            m32 : makeProperty(14),
            m33 : makeProperty(15),

            // Forward axis of local matrix, i.e. z axis
            forward : {
                configurable : false,
                get : function(){
                    var el = this._array;
                    axisZ.set(el[8], el[9], el[10]);
                    return axisZ;
                },
                // TODO Here has a problem
                // If only set an item of vector will not work
                set : function(v){
                    var el = this._array,
                        v = v._array;
                    el[8] = v[8];
                    el[9] = v[9];
                    el[10] = v[10];
                }
            },

            // Up axis of local matrix, i.e. y axis
            up : {
                configurable : false,
                enumerable : true,
                get : function(){
                    var el = this._array;
                    axisY.set(el[4], el[5], el[6]);
                    return axisY;
                },
                set : function(v){
                    var el = this._array,
                        v = v._array;
                    el[4] = v[4];
                    el[5] = v[5];
                    el[6] = v[6];
                }
            },

            // Right axis of local matrix, i.e. x axis
            right : {
                configurable : false,
                get : function(){
                    var el = this._array;
                    axisX.set(el[0], el[1], el[2]);
                    return axisX;
                },
                set : function(v){
                    var el = this._array,
                        v = v._array;
                    el[0] = v[0];
                    el[1] = v[1];
                    el[2] = v[2];
                }
            },
            
            _array : {
                writable : false,
                configurable : false,
                value : mat4.create()
            }
        })
    };

    var Matrix4Proto = {

        constructor : Matrix4,

        adjoint : function(){
            mat4.adjoint(this._array, this._array);
            return this;
        },
        clone : function(){
            return (new Matrix4()).copy(this);
        },
        copy : function(b){
            mat4.copy(this._array, b._array);
            return this;
        },
        determinant : function(){
            return mat4.determinant(this._array);
        },
        fromQuat : function(q){
            mat4.fromQuat(this._array, q._array);
            return this;
        },
        fromRotationTranslation : function(q, v){
            mat4.fromRotationTranslation(this._array, q._array, v._array);
            return this;
        },
        frustum : function(left, right, bottom, top, near, far){
            mat4.frustum(this._array, left, right, bottom, top, near, far);
            return this;
        },
        identity : function(){
            mat4.identity(this._array);
            return this;
        },
        invert : function(){
            mat4.invert(this._array, this._array);
            return this;
        },
        lookAt : function(eye, center, up){
            mat4.lookAt(this._array, eye._array, center._array, up._array);
            return this;
        },
        mul : function(b){
            mat4.mul(this._array, this._array, b._array);
            return this;
        },
        mulLeft : function(b){
            mat4.mul(this._array, b._array, this._array);
            return this;
        },
        multiply : function(b){
            mat4.multiply(this._array, this._array, b._array);
            return this;
        },
        // Apply left multiply
        multiplyLeft : function(b){
            mat4.multiply(this._array, b._array, this._array);
            return this;
        },
        ortho : function(left, right, bottom, top, near, far){
            mat4.ortho(this._array, left, right, bottom, top, near, far);
            return this;
        },
        perspective : function(fovy, aspect, near, far){
            mat4.perspective(this._array, fovy, aspect, near, far);
            return this;
        },
        rotate : function(rad, axis /*Vector3*/){
            mat4.rotate(this._array, this._array, rad, axis._array);
            return this;
        },
        rotateX : function(rad){
            mat4.rotateX(this._array, this._array, rad);
            return this;
        },
        rotateY : function(rad){
            mat4.rotateY(this._array, this._array, rad);
            return this;
        },
        rotateZ : function(rad){
            mat4.rotateZ(this._array, this._array, rad);
            return this;
        },
        scale : function(v){
            mat4.scale(this._array, this._array, v._array);
            return this;
        },
        translate : function(v){
            mat4.translate(this._array, this._array, v._array);
            return this;
        },
        transpose : function(){
            mat4.transpose(this._array, this._array);
            return this;
        },

        rotateAround : function(point, axis, angle){
            console.warn("TODO");
        },

        // Static method
        // Decompose a matrix to SRT
        // http://msdn.microsoft.com/en-us/library/microsoft.xna.framework.matrix.decompose.aspx
        decomposeMatrix : (function(){

            var x = vec3.create();
            var y = vec3.create();
            var z = vec3.create();

            var m3 = mat3.create();
            
            return function( scale, rotation, position ){

                var el = this._array;
                vec3.set(x, el[0], el[1], el[2]);
                vec3.set(y, el[4], el[5], el[6]);
                vec3.set(z, el[8], el[9], el[10]);

                scale.x = vec3.length(x);
                scale.y = vec3.length(y);
                scale.z = vec3.length(z);

                position.set(el[12], el[13], el[14]);

                mat3.fromMat4(m3, el);
                // Not like mat4, mat3 in glmatrix seems to be row-based
                mat3.transpose(m3, m3);

                m3[0] /= scale.x;
                m3[1] /= scale.x;
                m3[2] /= scale.x;

                m3[3] /= scale.y;
                m3[4] /= scale.y;
                m3[5] /= scale.y;

                m3[6] /= scale.z;
                m3[7] /= scale.z;
                m3[8] /= scale.z;

                quat.fromMat3(rotation._array, m3);
                rotation.normalize();
            }
        })(),

        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    return Matrix4;
});
define('core/matrix3',['require','glmatrix'], function(require){

    var glMatrix = require("glmatrix");
    var mat3 = glMatrix.mat3;

    function makeProperty(n){
        return {
            configurable : false,
            set : function(value){
                this._array[n] = value;
                this._dirty = true;
            },
            get : function(){
                return this._array[n];
            }
        }
    }

    var Matrix3 = function(){

        return Object.create(Matrix3Proto, {

            m00 : makeProperty(0),
            m01 : makeProperty(1),
            m02 : makeProperty(2),
            m10 : makeProperty(3),
            m11 : makeProperty(4),
            m12 : makeProperty(5),
            m20 : makeProperty(6),
            m21 : makeProperty(7),
            m22 : makeProperty(8),
            
            _array : {
                writable : false,
                configurable : false,
                value : mat3.create()
            }
        })
    };

    var Matrix3Proto = {

        constructor : Matrix3,

        adjoint : function(){
            mat3.adjoint(this._array, this._array);
            return this;
        },
        clone : function(){
            return (new Matrix3()).copy(this);
        },
        copy : function(b){
            mat3.copy(this._array, b._array);
            return this;
        },
        determinant : function(){
            return mat3.determinant(this._array);
        },
        fromMat2d : function(a){
            return mat3.fromMat2d(this._array, a._array);
        },
        fromMat4 : function(a){
            return mat3.fromMat4(this._array, a._array);
        },
        fromQuat : function(q){
            mat3.fromQuat(this._array, q._array);
            return this;
        },
        identity : function(){
            mat3.identity(this._array);
            return this;
        },
        invert : function(){
            mat3.invert(this._array, this._array);
            return this;
        },
        mul : function(b){
            mat3.mul(this._array, this._array, b._array);
            return this;
        },
        mulLeft : function(b){
            mat3.mul(this._array, b._array, this._array);
            return this;
        },
        multiply : function(b){
            mat3.multiply(this._array, this._array, b._array);
            return this;
        },
        multiplyLeft : function(b){
            mat3.multiply(this._array, b._array, this._array);
            return this;
        },
        /**
         * Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
         */
        normalFromMat4 : function(a){
            mat3.normalFromMat4(this._array, a._array);
            return a;
        },
        transpose : function(){
            mat3.transpose(this._array, this._array);
            return this;
        },
        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    return Matrix3;
});
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
define('3d/node',['require','core/base','core/vector3','core/quaternion','core/matrix4','core/matrix3','util/util','_'], function(require){
    
    var Base = require("core/base");
    var Vector3 = require("core/vector3");
    var Quaternion = require("core/quaternion");
    var Matrix4 = require("core/matrix4");
    var Matrix3 = require("core/matrix3");
    var util = require("util/util");
    var _ = require("_");

    var Node = Base.derive( function(){

        var id = util.genGUID();

        return {
            
            __GUID__ : id,

            name : 'NODE_' + id,

            visible : true,

            position : new Vector3(),

            rotation : new Quaternion(),

            scale : new Vector3(1, 1, 1),

            // Euler angles
            // https://en.wikipedia.org/wiki/Rotation_matrix
            eulerAngle : new Vector3(),
            useEuler : false,

            children : [],

            parent : null,

            worldMatrix : new Matrix4(),
            matrix : new Matrix4(),

        }
    }, {

        add : function( node ){
            if( this.children.indexOf( node ) >= 0 ){
                return;
            }
            this.children.push( node );
            node.parent = this;
        },

        remove : function( node ){
            _.without( this.children, node );
            node.parent = null;
        },

        traverse : function( callback ){
            var stopTraverse = callback && callback( this );
            if( ! stopTraverse ){
                var children = this.children;
                for( var i = 0, len = children.length; i < len; i++){
                    children[i].traverse( callback );
                }
            }
        },

        updateMatrix : function(){
            // TODO 
            // use defineSetter to set dirty when the position, rotation, scale is changed ??
            if( ! this.position._dirty &&
                ! this.scale._dirty){
                if( this.useEuler && ! this.eulerAngle._dirty){
                    return;
                }else if( ! this.rotation._dirty){
                    return;
                }
            }

            var m = this.matrix;

            m.identity();

            if( this.useEuler ){
                this.rotation.identity();
                this.rotation.rotateX( this.eulerAngle.x );
                this.rotation.rotateY( this.eulerAngle.y );
                this.rotation.rotateZ( this.eulerAngle.z );
            }
            // Transform order, scale->rotation->position
            m.fromRotationTranslation(this.rotation, this.position);

            m.scale(this.scale);

            this.rotation._dirty = false;
            this.scale._dirty = false;
            this.position._dirty = false;
            this.eulerAngle._dirty = false;
        },

        decomposeMatrix : function(){
            this.matrix.decomposeMatrix( this.scale, this.rotation, this.position );
            if( ! this.useEuler){
                this.eulerAngle.setEulerFromQuaternion(this.rotation);
            }
            
            this.rotation._dirty = false;
            this.scale._dirty = false;
            this.position._dirty = false;
            this.eulerAngle._dirty = false;
        },

        updateWorldMatrix : function(  ){

            this.updateMatrix();
            if( this.parent ){
                this.worldMatrix.copy(this.parent.worldMatrix).multiply(this.matrix);
            }else{
                this.worldMatrix.copy(this.matrix);
            }
        },
        
        // Update the node status in each frame
        update : function( _gl, silent ){

            if( ! silent){
                this.trigger( 'beforeupdate', _gl );
            }
            this.updateWorldMatrix();
            if( ! silent){
                this.trigger( 'afterupdate', _gl);
            }
            
            for(var i = 0; i < this.children.length; i++){
                var child = this.children[i];
                // Skip the hidden nodes
                if( child.visible ){
                    child.update( _gl );
                }
            }
        },

        getWorldPosition : function(){
            
            var m = this.worldMatrix._array;

            return new Vector3(m[12], m[13], m[14]);
        },

        translate : function(v){
            this.updateMatrix();
            this.translate(v);
            this.decomposeMatrix();
        },

        rotate : function(angle, axis){
            this.updateMatrix();
            this.matrix.rotate(angle, axis);
            this.decomposeMatrix();
        },
        // http://docs.unity3d.com/Documentation/ScriptReference/Transform.RotateAround.html
        rotateAround : (function(){
            
            var v = new Vector3();
            var RTMatrix = new Matrix4();

            return function(point, axis, angle){

                v.copy(this.position).subtract(point);

                this.matrix.identity();
                // parent joint
                this.matrix.translate(point);
                this.matrix.rotate(angle, axis);

                // Transform self
                if( this.useEuler ){
                    this.rotation.identity();
                    this.rotation.rotateX( this.eulerAngle.x );
                    this.rotation.rotateY( this.eulerAngle.y );
                    this.rotation.rotateZ( this.eulerAngle.z );
                }
                RTMatrix.fromRotationTranslation(this.rotation, v);
                this.matrix.multiply(RTMatrix);
                this.matrix.scale(this.scale);

                this.decomposeMatrix();
            }
        })(),

        lookAt : (function(){
            var m = new Matrix4();
            var scaleVector = new Vector3();
            return function( target, up ){
                m.lookAt(this.position, target, up || this.matrix.up ).invert();

                m.decomposeMatrix(scaleVector, this.rotation, this.position);

            }
        })(),

    });


    return Node;
});
define('3d/bone',['require','./node','core/quaternion','core/vector3','core/matrix4'],function(require){

    var Node = require("./node");
    var Quaternion = require("core/quaternion");
    var Vector3 = require("core/vector3");
    var Matrix4 = require("core/matrix4");
    
    var Bone = Node.derive(function(){
        return {
            // Index of bone
            index : -1,
            // Parent bone index
            parentIndex : -1,
            //{
            //  time : 
            //  position : 
            //  rotation :
            //  scale
            //}
            poses : []
        }
    }, {

        setPose : function(time){

            this._lerpField(time, 'position');
            this._lerpField(time, 'rotation');
            this._lerpField(time, 'scale');

        },

        _lerpField : function(time, fieldName){
            var poses = this.poses,
                len = poses.length,
                start,
                end;
            for(var i = 0; i < len; i++){
                if(poses[i].time <= time && poses[i][fieldName]){
                    start = poses[i];
                    break;
                }
            }
            i++;
            for(; i < len; i++){
                if(poses[i].time >= time && poses[i][fieldName]){
                    end = poses[i];
                    break;
                }
            }
            if(start && end){
                var percent = (time-start.time) / (end.time-start.time);
                percent = Math.max(Math.min(percent, 1), 0);
                if( fieldName === "rotation"){
                    this[fieldName].slerp(start[fieldName], end[fieldName], percent);
                }else{
                    this[fieldName].lerp(start[fieldName], end[fieldName], percent);
                }
            }
        }
    });

    return Bone;
});
define('3d/camera',['require','./node','core/matrix4'], function(require){

    var Node = require("./node");
    var Matrix4 = require("core/matrix4");

    var Camera = Node.derive(function() {
        return {
            projectionMatrix : new Matrix4(),
        }
    }, function(){
        this.update();
    }, {
        
        update : function( _gl ) {

            Node.prototype.update.call( this, _gl );
            
            this.updateProjectionMatrix();
        }
    });

    return Camera;
} );
define('3d/camera/orthographic',['require','../camera'], function(require){

    var Camera = require('../camera');

    var Orthographic = Camera.derive( function(){
        return {
            left : -1,
            right : 1,
            near : 0,
            far : 1,
            top : 1,
            bottom : -1,
        }
    }, {
        
        updateProjectionMatrix : function(){
            this.projectionMatrix.ortho(this.left, this.right, this.bottom, this.top, this.near, this.far);
        }
    });

    return Orthographic;
} );
define('3d/camera/perspective',['require','../camera'], function(require){

    var Camera = require('../camera');


    var Perspective = Camera.derive( function(){
        return {

            fov : 50,
            
            aspect : 1,
            
            near : 0.1,
            
            far : 2000
        }
    }, {
        
        updateProjectionMatrix : function(){
            var rad = this.fov / 180 * Math.PI;
            this.projectionMatrix.perspective(rad, this.aspect, this.near, this.far);
        }
    });

    return Perspective;
} );
define('3d/compositor/graph/graph',['require','core/base','_'], function( require ){

    var Base = require("core/base");
    var _ = require("_");

    var Graph = Base.derive( function(){
        return {
            nodes : []
        }
    }, {

        
        add : function( node ){

            this.nodes.push( node );

            this.dirty("graph");
        },

        remove : function( node ){
            _.without( this.nodes, node );
            this.dirty("graph");
        },

        update : function(){
            for(var i = 0; i < this.nodes.length; i++){
                this.nodes[i].clear();
            }
            // Traverse all the nodes and build the graph
            for(var i = 0; i < this.nodes.length; i++){
                var node = this.nodes[i];

                if( ! node.inputs){
                    continue;
                }
                for(var inputName in node.inputs){
                    var fromPinInfo = node.inputs[ inputName ];

                    var fromPin = this.findPin( fromPinInfo );
                    if( fromPin ){
                        node.link( inputName, fromPin.node, fromPin.pin );
                    }else{
                        console.warn("Pin of "+fromPinInfo.node+"."+fromPinInfo.pin+" not exist");
                    }
                }
            }

        },

        findPin : function( info ){
            var node;
            if( typeof(info.node) === 'string'){
                for( var i = 0; i < this.nodes.length; i++){
                    var tmp = this.nodes[i];
                    if( tmp.name === info.node ){
                        node = tmp;
                    }
                }
            }else{
                node = info.node;
            }
            if( node ){
                if( node.outputs[info.pin] ){
                    return {
                        node : node,
                        pin : info.pin
                    }
                }
            }
        },

        fromJSON : function( json ){

        }
    })
    
    return Graph;
});
define('3d/compositor',['require','./compositor/graph/graph'],function(require){

    var Graph = require("./compositor/graph/graph");

    var Compositor = Graph.derive(function(){
        return {
        }
    }, {
        render : function( renderer ){
            if( this.isDirty("graph") ){
                this.update();
                this.fresh("graph");
            }
            var finaNode;
            for(var i = 0; i < this.nodes.length; i++){
                var node = this.nodes[i];
                // Find output node
                if( ! node.outputs){
                    node.render(renderer);
                }
                // Update the reference number of each output texture
                node.updateReference();
            }
        }
    })

    return Compositor;
});
define('3d/scene',['require','./node'], function(require){

    var Node = require('./node');

    var Scene = Node.derive( function(){
        return {

            // Global material of scene
            material : null,

            // Properties to save the light information in the scene
            // Will be set in the render function
            lightNumber : {},
            lightUniforms : {},
            // Filter function.
            // Called each render pass to omit the mesh don't want
            // to be rendered on the screen
            filter : null
        }
    },{
        
    });

    return Scene;
} );
/**
 *
 * PENDING: use perfermance hint and remove the array after the data is transfered?
 * static draw & dynamic draw?
 */
define('3d/geometry',['require','core/base','util/util','glmatrix','_'], function(require) {

    var Base = require("core/base");
    var util = require("util/util");
    var glMatrix = require("glmatrix");
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;
    var mat2 = glMatrix.mat2;
    var mat4 = glMatrix.mat4;
    var _ = require("_");

    var arrSlice = Array.prototype.slice;

    var Geometry = Base.derive( function() {

        return {

            __GUID__ : util.genGUID(),
            
            attributes : {
                 position : {
                    type : 'float',
                    semantic : "POSITION",
                    size : 3,
                    value : []
                 },
                 texcoord0 : {
                    type : 'float',
                    semantic : "TEXCOORD_0",
                    size : 2,
                    value : []
                 },
                 texcoord1 : {
                    type : 'float',
                    semantic : "TEXCOORD_1",
                    size : 2,
                    value : []
                 },
                 normal : {
                    type : 'float',
                    semantic : "NORMAL",
                    size : 3,
                    value : []
                 },
                 tangent : {
                    type : 'float',
                    semantic : "TANGENT",
                    size : 4,
                    value : []
                 },
                 color : {
                    type : 'float',
                    semantic : "COLOR",
                    size : 3,
                    value : []
                 },
                 // For wireframe display
                 // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
                 barycentric : {
                    type : 'float',
                    size : 3,
                    value : []
                 },
                 // Skinning attributes
                 // Each vertex can be bind to 4 bones, because the 
                 // sum of weights is 1, so the weights is stored in vec3 and the last
                 // can be calculated by 1-w.x-w.y-w.z
                 boneWeight : {
                    type : 'float',
                    size : 3,
                    value : []
                 },
                 boneIndex : {
                    type : 'float',
                    size : 4,
                    value : []
                 }
            },

            useFaces : true,
            // Face is list of triangles, each face
            // is an array of the vertex indices of triangle
            faces : [],

            hint : 'STATIC_DRAW',

            //Max Value of Uint16, i.e. 0xfff
            chunkSize : 65535,

            _enabledAttributes : null,

            _verticesNumber : 0,

            // Save the normal type, can have face normal or vertex normal
            // Normally vertex normal is more smooth
            _normalType : "vertex",

            // Typed Array of each geometry chunk
            // [{
            //     attributeArrays:{},
            //     indicesArray : null
            // }]
            _arrayChunks : [],

            // Map of re organized vertices data
            _verticesReorganizedMap : [],
            _reorganizedFaces : []
        }
    }, {

        // Overwrite the dirty method
        dirty : function( field ) {
            if ( ! field ) {
                this.dirty("indices");
                for(var name in this.attributes){
                    this.dirty(name);
                }
                return;
            }
            for ( var contextId in this.cache._caches ) {
                this.cache._caches[ contextId ][ "dirty_"+field ] = true;
            }

            this._enabledAttributes = null;
        },

        getVerticesNumber : function() {
            this._verticesNumber = this.attributes.position.value.length;
            return this._verticesNumber;
        },

        getEnabledAttributes : function(){
            // Cache
            if( this._enabledAttributes){
                return this._enabledAttributes;
            }

            var result = {};
            var verticesNumber = this.getVerticesNumber();

            for(var name in this.attributes){
                var attrib = this.attributes[name];
                if( attrib.value &&
                    attrib.value.length ){
                    if( attrib.value.length === verticesNumber ){
                        result[name] = attrib;
                    }
                }
            }

            this._enabledAttributes = result;

            return result;
        },

        getDirtyAttributes : function( ){

            var result = {};
            var attributes = this.getEnabledAttributes();
            
            var noDirtyAttributes = true;
            for(var name in attributes ){
                var attrib = attributes[name];
                if( this.cache.get("dirty_"+name) ||
                    this.cache.miss("dirty_"+name) ){
                    result[name] = attributes[name];
                    noDirtyAttributes = false;
                }
            }
            if( ! noDirtyAttributes ){
                return result;
            }
        },

        getChunkNumber : function(){
            return this._arrayChunks.length;
        },

        getBufferChunks : function( _gl ) {

            this.cache.use(_gl.__GUID__ );

            var isDirty = this.cache.getContext();
            var dirtyAttributes = this.getDirtyAttributes();

            var isFacesDirty = this.cache.get("dirty_faces") || this.cache.miss("dirty_faces");

            if( dirtyAttributes ){
                this._updateAttributesAndIndicesArrays( dirtyAttributes, isFacesDirty );
                this._updateBuffer( _gl, dirtyAttributes, isFacesDirty );

                for (var name in dirtyAttributes ) {
                    isDirty[ "dirty_"+name ] = false ;
                }
            }
            return this.cache.get("chunks");
        },

        _updateAttributesAndIndicesArrays : function( attributes, isFacesDirty ){

            var self = this,
                cursors = {},
                verticesNumber = this.getVerticesNumber();
            
            var verticesReorganizedMap = this._verticesReorganizedMap;


            var ArrayConstructors = {};
            for(var name in attributes){
                // Type can be byte, ubyte, short, ushort, float
                switch( type ) {
                    case "byte":
                        ArrayConstructors[name] = Int8Array;
                        break;
                    case "ubyte":
                        ArrayConstructors[name] = Uint8Array;
                        break;
                    case "short":
                        ArrayConstructors[name] = Int16Array;
                        break;
                    case "ushort":
                        ArrayConstructors[name] = Uint16Array;
                        break;
                    default:
                        ArrayConstructors[name] = Float32Array;
                        break;
                }
                cursors[name] = 0;
            }

            var newChunk = function(chunkIdx){
                if( self._arrayChunks[chunkIdx] ){
                    return self._arrayChunks[chunkIdx];
                }
                var chunk = {
                    attributeArrays : {},
                    indicesArray : null
                };

                for(var name in attributes){
                    chunk.attributeArrays[name] = null;
                }

                for(var name in cursors){
                    cursors[name] = 0;
                }
                for(var i = 0; i < verticesNumber; i++){
                    verticesReorganizedMap[i] = -1;
                }
                
                self._arrayChunks.push(chunk);
                return chunk;
            }

            var attribNameList = Object.keys(attributes);
            // Split large geometry into chunks because index buffer
            // only support uint16 which means each draw call can only
             // have at most 65535 vertex data
            if( verticesNumber > this.chunkSize && this.useFaces ){
                var vertexCursor = 0,
                    chunkIdx = 0,
                    currentChunk;

                var chunkFaceStart = [0];
                var vertexUseCount = [];

                for(i = 0; i < verticesNumber; i++){
                    vertexUseCount[i] = -1;
                    verticesReorganizedMap[i] = -1;
                }
                if( isFacesDirty ){
                    if( this._reorganizedFaces.length !== this.faces.length){
                        for( i = 0; i < this.faces.length; i++){
                            this._reorganizedFaces[i] = [0, 0, 0];
                        }
                    }
                }

                currentChunk = newChunk(chunkIdx);

                for(var i = 0; i < this.faces.length; i++){
                    var face = this.faces[i];
                    var reorganizedFace = this._reorganizedFaces[i];
                    var i1 = face[0], i2 = face[1], i3 = face[2];
                    // newChunk
                    if( vertexCursor+3 > this.chunkSize){
                        chunkIdx++;
                        chunkFaceStart[chunkIdx] = i;
                        vertexCursor = 0;
                        currentChunk = newChunk(chunkIdx);
                    }
                    var newI1 = verticesReorganizedMap[i1] === -1;
                    var newI2 = verticesReorganizedMap[i2] === -1;
                    var newI3 = verticesReorganizedMap[i3] === -1;

                    for(var k = 0; k < attribNameList.length; k++){
                        var name = attribNameList[k],
                            attribArray = currentChunk.attributeArrays[name],
                            values = attributes[name].value,
                            size = attributes[name].size;
                        if( ! attribArray){
                            // Here use array to put data temporary because i can't predict
                            // the size of chunk precisely.
                            attribArray = currentChunk.attributeArrays[name] = [];
                        }
                        if( size === 1){
                            if( newI1 ){
                                attribArray[ cursors[name]++ ] = values[i1];
                            }
                            if( newI2 ){
                                attribArray[ cursors[name]++ ] = values[i2];
                            }
                            if( newI3 ){
                                attribArray[ cursors[name]++ ] = values[i3];
                            }
                        }
                        else{
                            if( newI1 ){
                                for(var j = 0; j < size; j++){
                                    attribArray[ cursors[name]++ ] = values[i1][j];
                                }
                            }
                            if( newI2 ){
                                for(var j = 0; j < size; j++){
                                    attribArray[ cursors[name]++ ] = values[i2][j];
                                }
                            }
                            if( newI3 ){
                                for(var j = 0; j < size; j++){
                                    attribArray[ cursors[name]++ ] = values[i3][j];
                                }
                            }
                        }
                    }
                    if( newI1 ){
                        verticesReorganizedMap[i1] = vertexCursor;
                        reorganizedFace[0] = vertexCursor;
                        vertexCursor++;
                    }else{
                        reorganizedFace[0] = verticesReorganizedMap[i1];
                    }
                    if( newI2 ){
                        verticesReorganizedMap[i2] = vertexCursor;
                        reorganizedFace[1] = vertexCursor;
                        vertexCursor++;
                    }else{
                        reorganizedFace[1] = verticesReorganizedMap[i2];
                    }
                    if( newI3 ){
                        verticesReorganizedMap[i3] = vertexCursor;
                        reorganizedFace[2] = vertexCursor;
                        vertexCursor++
                    }else{
                        reorganizedFace[2] = verticesReorganizedMap[i3];
                    }
                }
                //Create typedArray from existed array
                for(var c = 0; c < this._arrayChunks.length; c++){
                    var chunk = this._arrayChunks[c];
                    for(var name in chunk.attributeArrays){
                        var array = chunk.attributeArrays[name];
                        if( array instanceof Array){
                            chunk.attributeArrays[name] = new ArrayConstructors[name](array);
                        }
                    }
                }

                if( isFacesDirty ){
                    var chunkStart, chunkEnd, cursor, chunk;
                    for(var c = 0; c < this._arrayChunks.length; c++){
                        chunkStart = chunkFaceStart[c];
                        chunkEnd = chunkFaceStart[c+1] || this.faces.length;
                        cursor = 0;
                        chunk = this._arrayChunks[c];
                        var indicesArray = chunk.indicesArray;
                        if( ! indicesArray){
                            indicesArray = chunk.indicesArray = new Uint16Array( (chunkEnd-chunkStart)*3 );
                        }

                        for(var i = chunkStart; i < chunkEnd; i++){
                            indicesArray[cursor++] = this._reorganizedFaces[i][0];
                            indicesArray[cursor++] = this._reorganizedFaces[i][1];
                            indicesArray[cursor++] = this._reorganizedFaces[i][2];
                        }
                    }
                }
            }else{
                var chunk = newChunk(0);
                // Use faces
                if( this.useFaces ){
                    var indicesArray = chunk.indicesArray;
                    if( ! indicesArray){
                        indicesArray = chunk.indicesArray = new Uint16Array(this.faces.length*3);
                    }
                    var cursor = 0;
                    for(var i = 0; i < this.faces.length; i++){
                        indicesArray[cursor++] = this.faces[i][0];
                        indicesArray[cursor++] = this.faces[i][1];
                        indicesArray[cursor++] = this.faces[i][2];
                    }
                }
                for(var name in attributes){
                    var values = attributes[name].value,
                        type = attributes[name].type,
                        size = attributes[name].size,
                        attribArray = chunk.attributeArrays[name];
                    
                    if( ! attribArray){
                        attribArray = chunk.attributeArrays[name] = new ArrayConstructors[name](verticesNumber*size);
                    }

                    if( size === 1){
                        for(var i = 0; i < values.length; i++){
                            attribArray[i] = values[i];
                        }
                    }else{
                        var cursor = 0;
                        for(var i = 0; i < values.length; i++){
                            for(var j = 0; j < size; j++){
                                attribArray[cursor++] = values[i][j];
                            }
                        }
                    }
                }
            }

        },

        _updateBuffer : function( _gl, dirtyAttributes, isFacesDirty ) {

            var chunks = this.cache.get("chunks");
            if( ! chunks){
                chunks = [];
                // Intialize
                for(var i = 0; i < this._arrayChunks.length; i++){
                    chunks[i] = {
                        attributeBuffers : {},
                        indicesBuffer : null
                    }
                }
                this.cache.put("chunks", chunks);
            }
            for(var i = 0; i < chunks.length; i++){
                var chunk = chunks[i];
                if( ! chunk){
                    chunk = chunks[i] = {
                        attributeBuffers : {},
                        indicesBuffer : null
                    }
                }
                var attributeBuffers = chunk.attributeBuffers,
                    indicesBuffer = chunk.indicesBuffer;
                var arrayChunk = this._arrayChunks[i],
                    attributeArrays = arrayChunk.attributeArrays,
                    indicesArray = arrayChunk.indicesArray;

                for(var name in dirtyAttributes){
                    var attribute = dirtyAttributes[name],
                        value = attribute.value,
                        type = attribute.type,
                        semantic = attribute.semantic,
                        size = attribute.size;

                    var bufferInfo = attributeBuffers[name],
                        buffer;
                    if( bufferInfo ){
                        buffer = bufferInfo.buffer
                    }else{
                        buffer = _gl.createBuffer();
                    }
                    //TODO: Use BufferSubData?
                    _gl.bindBuffer( _gl.ARRAY_BUFFER, buffer );
                    _gl.bufferData( _gl.ARRAY_BUFFER, attributeArrays[name], _gl[ this.hint ] );

                    attributeBuffers[name] = {
                        type : type,
                        buffer : buffer,
                        size : size,
                        semantic : semantic,
                    }
                } 
                if( isFacesDirty && this.useFaces ){
                    if( ! indicesBuffer ){
                        indicesBuffer = chunk.indicesBuffer = {
                            buffer : _gl.createBuffer(),
                            count : indicesArray.length
                        }
                    }
                    _gl.bindBuffer( _gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer );
                    _gl.bufferData( _gl.ELEMENT_ARRAY_BUFFER, indicesArray, _gl[ this.hint ] );   
                }
            }
        },

        generateVertexNormals : function() {
            var faces = this.faces,
                len = faces.length,
                positions = this.attributes.position.value,
                normals = this.attributes.normal.value,
                normal = vec3.create();

                v12 = vec3.create(), v23 = vec3.create();

            var difference = positions.length - normals.length;
            for(var i = 0; i < normals.length; i++){
                vec3.set(normals[i], 0.0, 0.0, 0.0);
            }
            for(var i = normals.length; i < positions.length; i++){
                //Use array instead of Float32Array
                normals[i] = [0.0, 0.0, 0.0];
            }

            for(var f = 0; f < this.faces.length; f++){

                var face = faces[f],
                    i1 = face[0],
                    i2 = face[1],
                    i3 = face[2],
                    p1 = positions[i1],
                    p2 = positions[i2],
                    p3 = positions[i3];

                vec3.sub( v12, p1, p2 );
                vec3.sub( v23, p2, p3 );
                // Left Hand Cartesian Coordinate System
                vec3.cross( normal, v12, v23 );
                // Weighted by the triangle area
                vec3.add(normals[i1], normals[i1], normal);
                vec3.add(normals[i2], normals[i2], normal);
                vec3.add(normals[i3], normals[i3], normal);
            }
            for(var i = 0; i < normals.length; i++){
                vec3.normalize(normals[i], normals[i]);
            }

            this._normalType = "vertex";
        },

        generateFaceNormals : function() {
            if( ! this.isUniqueVertex() ){
                this.generateUniqueVertex();
            }

            var faces = this.faces,
                len = faces.length,
                positions = this.attributes.position.value,
                normals = this.attributes.normal.value,
                normal = vec3.create();

                v12 = vec3.create(), v23 = vec3.create();

            var isCopy = normals.length === positions.length;
            //   p1
            //  /  \
            // p3---p2
            for(var i = 0; i < len; i++){
                var face = faces[i],
                    i1 = face[0],
                    i2 = face[1],
                    i3 = face[2],
                    p1 = positions[i1],
                    p2 = positions[i2],
                    p3 = positions[i3];

                vec3.sub( v12, p1, p2 );
                vec3.sub( v23, p2, p3 );
                // Left Hand Cartesian Coordinate System
                vec3.cross( normal, v12, v23 );

                if( isCopy ){
                    vec3.copy(normals[i1], normal);
                    vec3.copy(normals[i2], normal);
                    vec3.copy(normals[i3], normal);
                }else{
                    normals[i1] = normals[i2] = normals[i3] = arrSlice.call(normal);
                }
            }

            this._normalType = "face";
        },
        // "Mathmatics for 3D programming and computer graphics, third edition"
        // section 7.8.2
        // http://www.crytek.com/download/Triangle_mesh_tangent_space_calculation.pdf
        generateTangents : function() {
            
            var texcoords = this.attributes.texcoord0.value,
                positions = this.attributes.position.value,
                tangents = this.attributes.tangent.value,
                normals = this.attributes.normal.value;

            var tan1 = [], tan2 = [],
                verticesNumber = this.getVerticesNumber();
            for(var i = 0; i < verticesNumber; i++){
                tan1[i] = [0.0, 0.0, 0.0];
                tan2[i] = [0.0, 0.0, 0.0];
            }

            var sdir = [0.0, 0.0, 0.0];
            var tdir = [0.0, 0.0, 0.0];
            for(var i = 0; i < this.faces.length; i++){
                var face = this.faces[i],
                    i1 = face[0],
                    i2 = face[1],
                    i3 = face[2],

                    st1 = texcoords[i1],
                    st2 = texcoords[i2],
                    st3 = texcoords[i3],

                    p1 = positions[i1],
                    p2 = positions[i2],
                    p3 = positions[i3];

                var x1 = p2[0] - p1[0],
                    x2 = p3[0] - p1[0],
                    y1 = p2[1] - p1[1],
                    y2 = p3[1] - p1[1],
                    z1 = p2[2] - p1[2],
                    z2 = p3[2] - p1[2];

                var s1 = st2[0] - st1[0],
                    s2 = st3[0] - st1[0],
                    t1 = st2[1] - st1[1],
                    t2 = st3[1] - st1[1];

                var r = 1.0 / (s1 * t2 - t1 * s2);
                sdir[0] = (t2 * x1 - t1 * x2) * r;
                sdir[1] = (t2 * y1 - t1 * y2) * r; 
                sdir[2] = (t2 * z1 - t1 * z2) * r;

                tdir[0] = (s1 * x2 - s2 * x1) * r;
                tdir[1] = (s1 * y2 - s2 * y1) * r;
                tdir[2] = (s1 * z2 - s2 * z1) * r;

                vec3.add(tan1[i1], tan1[i1], sdir);
                vec3.add(tan1[i2], tan1[i2], sdir);
                vec3.add(tan1[i3], tan1[i3], sdir);
                vec3.add(tan2[i1], tan2[i1], tdir);
                vec3.add(tan2[i2], tan2[i2], tdir);
                vec3.add(tan2[i3], tan2[i3], tdir);
            }
            var tmp = [0, 0, 0, 0];
            var nCrossT = [0, 0, 0];
            for(var i = 0; i < verticesNumber; i++){
                var n = normals[i];
                var t = tan1[i];

                // Gram-Schmidt orthogonalize
                vec3.scale(tmp, n, vec3.dot(n, t));
                vec3.sub(tmp, t, tmp);
                vec3.normalize(tmp, tmp);
                // Calculate handedness.
                vec3.cross(nCrossT, n, t);
                tmp[3] = vec3.dot( nCrossT, tan2[i] ) < 0.0 ? -1.0 : 1.0;
                tangents[i] = tmp.slice();
            }
        },

        isUniqueVertex : function() {
            if( this.faces.length && this.useFaces ){
                return this.getVerticesNumber() === this.faces.length * 3;
            }else{
                return true;
            }
        },

        generateUniqueVertex : function(){

            var vertexUseCount = [];
            // Intialize with empty value, read undefined value from array
            // is slow
            // http://jsperf.com/undefined-array-read
            for(var i = 0; i < this.getVerticesNumber(); i++){
                vertexUseCount[i] = 0;
            }

            var cursor = this.getVerticesNumber(),
                attributes = this.getEnabledAttributes(),
                faces = this.faces;

            function cloneAttribute( idx ){
                for(var name in attributes ){
                    var array = attributes[name].value;
                    var size = array[0].length || 1;
                    if( size === 1){
                        array.push( array[idx] );
                    }else{
                        array.push( arrSlice.call(array[idx]) );
                    }
                }
            }
            for(var i = 0; i < faces.length; i++){
                var face = faces[i],
                    i1 = face[0],
                    i2 = face[1],
                    i3 = face[2];
                if( vertexUseCount[i1] > 0 ){
                    cloneAttribute(i1);
                    face[0] = cursor;
                    cursor++;
                }
                if( vertexUseCount[i2] > 0 ){
                    cloneAttribute(i2);
                    face[1] = cursor;
                    cursor++;
                }
                if( vertexUseCount[i3] > 0 ){
                    cloneAttribute(i3);
                    face[2] = cursor;
                    cursor++;
                }
                vertexUseCount[i1]++;
                vertexUseCount[i2]++;
                vertexUseCount[i3]++;
            }

            this.dirty();
        },

        // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
        // http://en.wikipedia.org/wiki/Barycentric_coordinate_system_(mathematics)
        generateBarycentric : (function(){
            var a = [1, 0, 0],
                b = [0, 0, 1],
                c = [0, 1, 0];
            return function(){

                if( ! this.isUniqueVertex() ){
                    this.generateUniqueVertex();
                }

                var array = this.attributes.barycentric.value;
                // Already existed;
                if( array.length == this.faces.length * 3){
                    return;
                }
                var i1, i2, i3, face;
                for(var i = 0; i < this.faces.length; i++){
                    face = this.faces[i];
                    i1 = face[0];
                    i2 = face[1];
                    i3 = face[2];
                    array[i1] = a;
                    array[i2] = b;
                    array[i3] = c;
                }
            }
        })(),
        // TODO : tangent
        applyMatrix : function( matrix ) {
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;

            matrix = matrix._array;
            for ( var i = 0; i < positions.length; i++) {
                vec3.transformMat4( positions[i], positions[i], matrix );
            }
            // Normal Matrix
            var inverseTransposeMatrix = mat4.create();
            mat4.invert( inverseTransposeMatrix, matrix );
            mat4.transpose( inverseTransposeMatrix, inverseTransposeMatrix );

            for( var i = 0; i < normals.length; i++) {
                vec3.transformMat4( normals[i], normals[i], inverseTransposeMatrix );
            }
        },

        dispose : function(_gl) {
            
        }
    } )

    return Geometry;
} );
/*
 * From lightgl
 * https://github.com/evanw/lightgl.js/blob/master/src/mesh.js
 */
define('3d/geometry/plane',['require','../geometry'], function(require){

	var Geometry = require('../geometry');

	var Plane = Geometry.derive( function(){

		return {
			widthSegments : 1,
			heightSegments : 1
		}
	}, function(){

		var heightSegments = this.heightSegments,
			widthSegments = this.widthSegments,
			positions = this.attributes.position.value,
			texcoords = this.attributes.texcoord0.value,
			normals = this.attributes.normal.value,
			faces = this.faces;			

		for (var y = 0; y <= heightSegments; y++) {
			var t = y / heightSegments;
			for (var x = 0; x <= widthSegments; x++) {
				var s = x / widthSegments;

				positions.push([2 * s - 1, 2 * t - 1, 0]);
				if ( texcoords ) texcoords.push([s, t]);

				if ( normals ) normals.push([0, 0, 1]);
				if (x < widthSegments && y < heightSegments) {
					var i = x + y * (widthSegments + 1);
					faces.push([i, i + 1, i + widthSegments + 1]);
					faces.push([i + widthSegments + 1, i + 1, i + widthSegments + 2]);
				}
			}
		}

	})

	return Plane;
} );
/**
 * Mainly do the parse and compile of shader string
 * Support shader code chunk import and export
 * Support shader semantics
 * http://www.nvidia.com/object/using_sas.html
 * https://github.com/KhronosGroup/collada2json/issues/45
 *
 */
define('3d/shader',['require','core/base','glmatrix','util/util','_'], function(require){
    
    var Base = require("core/base"),
        glMatrix = require("glmatrix"),
        mat2 = glMatrix.mat2
        mat3 = glMatrix.mat3,
        mat4 = glMatrix.mat4,
        util = require("util/util"),
        _ = require("_");

    var uniformRegex = /uniform\s+(bool|float|int|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube)\s+(\w+)?(\[.*?\])?\s*(:\s*([\S\s]+?))?;/g;
    var attributeRegex = /attribute\s+(float|int|vec2|vec3|vec4)\s+(\w*)\s*(:\s*(\w+))?;/g;

    var uniformTypeMap = {
        "bool" : "1i",
        "int" : "1i",
        "sampler2D" : "t",
        "samplerCube" : "t",
        "float" : "1f",
        "vec2" : "2f",
        "vec3" : "3f",
        "vec4" : "4f",
        "ivec2" : "2i",
        "ivec3" : "3i",
        "ivec4" : "4i",
        "mat2" : "m2",
        "mat3" : "m3",
        "mat4" : "m4"
    }
    var uniformValueConstructor = {
        'bool' : function(){return true;},
        'int' : function(){return 0;},
        'float' : function(){return 0;},
        'sampler2D' : function(){return null;},
        'samplerCube' : function(){return null;},

        'vec2' : function(){return new Float32Array(2);},
        'vec3' : function(){return new Float32Array(3);},
        'vec4' : function(){return new Float32Array(4);},

        'ivec2' : function(){return new Int32Array(2);},
        'ivec3' : function(){return new Int32Array(3);},
        'ivec4' : function(){return new Int32Array(4);},

        'mat2' : function(){return mat2.create();},
        'mat3' : function(){return mat3.create();},
        'mat4' : function(){return mat4.create();},

        'array' : function(){return [];}
    }
    var availableSemantics = [
            'POSITION', 
            'NORMAL',
            'BINORMAL',
            'TANGENT',
            'TEXCOORD',
            'TEXCOORD_0',
            'TEXCOORD_1',
            'COLOR',
            'WORLD',
            'VIEW',
            'PROJECTION',
            'WORLDVIEW',
            'VIEWPROJECTION',
            'WORLDVIEWPROJECTION',
            'WORLDINVERSE',
            'VIEWINVERSE',
            'PROJECTIONINVERSE',
            'WORLDVIEWINVERSE',
            'VIEWPROJECTIONINVERSE',
            'WORLDVIEWPROJECTIONINVERSE',
            'WORLDTRANSPOSE',
            'VIEWTRANSPOSE',
            'PROJECTIONTRANSPOSE',
            'WORLDVIEWTRANSPOSE',
            'VIEWPROJECTIONTRANSPOSE',
            'WORLDVIEWPROJECTIONTRANSPOSE',
            'WORLDINVERSETRANSPOSE',
            'VIEWINVERSETRANSPOSE',
            'PROJECTIONINVERSETRANSPOSE',
            'WORLDVIEWINVERSETRANSPOSE',
            'VIEWPROJECTIONINVERSETRANSPOSE',
            'WORLDVIEWPROJECTIONINVERSETRANSPOSE'];
    
    var errorShader = {};

    // Enable attribute operation is global to all programs
    // Here saved the list of all enabled attribute index 
    // http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
    var enabledAttributeList = {};

    var Shader = Base.derive( function(){

        return {

            __GUID__ : util.genGUID(),

            vertex : "",
            
            fragment : "",

            precision : "mediump",
            // Properties follow will be generated by the program
            semantics : {},

            uniformTemplates : {},
            attributeTemplates : {},

            // Custom defined values in the shader
            vertexDefines : {},
            fragmentDefines : {},
            // Glue code
            // Defines the each type light number in the scene
            // AMBIENT_LIGHT
            // POINT_LIGHT
            // SPOT_LIGHT
            // AREA_LIGHT
            lightNumber : {},
            // {
            //  enabled : true
            //  shaderType : "vertex",
            // }
            _textureStatus : {},

            _vertexProcessed : "",
            _fragmentProcessed : "",

            _program : null,

        }
    }, function(){

        this.update();

    }, {

        setVertex : function(str){
            this.vertex = str;
            this.update();
        },
        setFragment : function(str){
            this.fragment = str;_caches
            this.update();
        },
        bind : function( _gl ){

            this.cache.use( _gl.__GUID__ , {
                "locations" : {},
                "attriblocations" : {}
            } );

            if( this.cache.get("dirty") || this.cache.miss("program") ){
                
                this._buildProgram( _gl, this._vertexProcessed, this._fragmentProcessed );
            
                this.cache.put("dirty", false);
            }

            _gl.useProgram( this.cache.get("program") );
        },
        // Overwrite the dirty method
        dirty : function(){
            for( var contextId in this.cache._caches){
                var context = this.cache._caches[contextId];
                context["dirty"] = true;
                context["locations"] = {};
                context["attriblocations"] = {};
            }
        },

        update : function( force ){

            if( this.vertex !== this._vertexPrev ||
                this.fragment !== this._fragmentPrev || force){

                this._parseImport();
                
                this.semantics = {};
                this._textureStatus = {};

                this._parseUniforms();
                this._parseAttributes();

                this._vertexPrev = this.vertex;
                this._fragmentPrev = this.fragment;
            }
            this._addDefine();

            this.dirty();
        },

        enableTexture : function( symbol, autoUpdate ){
            var status = this._textureStatus[ symbol ];
            if( status ){
                var isEnabled = status.enabled;
                if( isEnabled ){
                    // Do nothing
                    return;
                }else{
                    status.enabled = true;

                    var autoUpdate = typeof(autoUpdate)==="undefined" || true;
                    if(autoUpdate){
                        this.update();
                    }
                }
            }
        },

        enableTexturesAll : function(autoUpdate){
            for(var symbol in this._textureStatus){
                this._textureStatus[symbol].enabled = true;
            }

            var autoUpdate = typeof(autoUpdate)==="undefined" || true;
            if(autoUpdate){
                this.update();
            }
        },

        disableTexture : function( symbol, autoUpdate ){
            var status = this._textureStatus[ symbol ];
            if( status ){
                var isDisabled = ! status.enabled;
                if( isDisabled){
                    // Do nothing
                    return;
                }else{
                    status.enabled = false;

                    var autoUpdate = typeof(autoUpdate)==="undefined" || true;
                    if(autoUpdate){
                        this.update();
                    }
                }
            }
        },

        disableTexturesAll : function(symbol, autoUpdate){
            for(var symbol in this._textureStatus){
                this._textureStatus[symbol].enabled = false;
            }

            var autoUpdate = typeof(autoUpdate)==="undefined" || true;
            if(autoUpdate){
                this.update();
            }
        },

        setUniform : function( _gl, type, symbol, value ){

            var program = this.cache.get("program");            

            var locationsMap = this.cache.get( "locations" );
            var location = locationsMap[symbol];
            // Uniform is not existed in the shader
            if( location === null){
                return;
            }
            else if( ! location ){
                location = _gl.getUniformLocation( program, symbol );
                // Unform location is a WebGLUniformLocation Object
                // If the uniform not exist, it will return null
                if( location === null  ){
                    locationsMap[symbol] = null;
                    return;
                }
                locationsMap[symbol] = location;
            }
            switch( type ){
                case '1i':
                    _gl.uniform1i( location, value );
                    break;
                case '1f':
                    _gl.uniform1f( location, value );
                    break;
                case "1fv":
                    _gl.uniform1fv( location, value );
                    break;
                case "1iv":
                    _gl.uniform1iv( location, value );
                    break;
                case '2iv':
                    _gl.uniform2iv( location, value );
                    break;
                case '2fv':
                    _gl.uniform2fv( location, value );
                    break;
                case '3iv':
                    _gl.uniform3iv( location, value );
                    break;
                case '3fv':
                    _gl.uniform3fv( location, value );
                    break;
                case "4iv":
                    _gl.uniform4iv( location, value );
                    break;
                case "4fv":
                    _gl.uniform4fv( location, value );
                    break;
                case '2i':
                    _gl.uniform2i( location, value[0], value[1] );
                    break;
                case '2f':
                    _gl.uniform2f( location, value[0], value[1] );
                    break;
                case '3i':
                    _gl.uniform3i( location, value[0], value[1], value[2] );
                    break;
                case '3f':
                    _gl.uniform3f( location, value[0], value[1], value[2] );
                    break;
                case '4i':
                    _gl.uniform4i( location, value[0], value[1], value[2], value[3] );
                    break;
                case '4f':
                    _gl.uniform4f( location, value[0], value[1], value[2], value[3] );
                    break;
                case 'm2':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix2fv(location, false, value);
                    break;
                case 'm3':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix3fv(location, false, value);
                    break;
                case 'm4':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix4fv(location, false, value);
                    break;
                case "m2v":
                    var size = 4;
                case "m3v":
                    var size = 9;
                case 'm4v':
                    var size = 16;
                    if( value instanceof Array){
                        var array = new Float32Array(value.length * size);
                        var cursor = 0;
                        for(var i = 0; i < value.length; i++){
                            var item = value[i];
                            for(var j = 0; j < item.length; j++){
                                array[cursor++] = item[j];
                            }
                        }
                        _gl.uniformMatrix4fv(location, false, array);
                    // Raw value
                    }else if( value instanceof Float32Array){   // ArrayBufferView
                        _gl.uniformMatrix4fv(location, false, value);
                    }
                    break;
            }
        },
        /**
         * Enable the attributes passed in and disable the rest
         * Example Usage:
         * enableAttributes( _gl, "position", "texcoords")
         * OR
         * enableAttributes(_gl, ["position", "texcoors"])
         */
        enableAttributes : function( _gl, attribList ){
            
            var program = this.cache.get("program");

            var locationsMap = this.cache.get("attriblocations");

            if( typeof(attribList) === "string"){
                attribList = Array.prototype.slice.call(arguments, 1);
            }

            var enabledAttributeListInContext = enabledAttributeList[_gl.__GUID__];
            if( ! enabledAttributeListInContext ){
                enabledAttributeListInContext = enabledAttributeList[_gl.__GUID__] = [];
            }

            for(var symbol in this.attributeTemplates){
                var location = locationsMap[symbol];                        
                if( typeof(location) === "undefined" ){
                    location = _gl.getAttribLocation( program, symbol );
                    // Attrib location is a number from 0 to ...
                    if( location === -1){
                        continue;
                    }
                    locationsMap[symbol] = location;
                }

                if(attribList.indexOf(symbol) >= 0){
                    if( ! enabledAttributeListInContext[location] ){
                        _gl.enableVertexAttribArray(location);
                        enabledAttributeListInContext[location] = true;
                    }
                }else{
                    if( enabledAttributeListInContext[location]){
                        _gl.disableVertexAttribArray(location);
                        enabledAttributeListInContext[location] = false;
                    }
                }
            }
        },

        setMeshAttribute : function( _gl, symbol, info ){
            var type = info.type,
                size = info.size,
                glType;
            switch( type ){
                case "byte":
                    glType = _gl.BYTE;
                    break;
                case "ubyte":
                    glType = _gl.UNSIGNED_BYTE;
                    break;
                case "short":
                    glType = _gl.SHORT;
                    break;
                case "ushort":
                    glType = _gl.UNSIGNED_SHORT;
                    break;
                default:
                    glType = _gl.FLOAT;
                    break;
            }

            var program = this.cache.get("program");            

            var locationsMap = this.cache.get("attriblocations");
            var location = locationsMap[symbol];

            if( typeof(location) === "undefined" ){
                location = _gl.getAttribLocation( program, symbol );
                // Attrib location is a number from 0 to ...
                if( location === -1){
                    return;
                }
                locationsMap[symbol] = location;
            }

            _gl.vertexAttribPointer( location, size, glType, false, 0, 0 );
        },

        _parseImport : function(){

            this._vertexProcessedWithoutDefine = Shader.parseImport( this.vertex );
            this._fragmentProcessedWithoutDefine = Shader.parseImport( this.fragment );

        },

        _addDefine : function(){

            // Add defines
            var defineStr = [];
            _.each( this.lightNumber, function(count, lightType){
                if( count ){
                    defineStr.push( "#define "+lightType.toUpperCase()+"_NUMBER "+count );
                }
            });
            _.each( this._textureStatus, function(status, symbol){
                if( status.enabled && status.shaderType === "vertex" ){
                    defineStr.push( "#define "+symbol.toUpperCase()+"_ENABLED" );
                }
            });
            // Custom Defines
            _.each( this.vertexDefines, function(value, symbol){
                if( value === null){
                    defineStr.push("#define "+symbol);
                }else{
                    defineStr.push("#define "+symbol+" "+value.toString());
                }
            } )
            this._vertexProcessed = defineStr.join("\n") + "\n" + this._vertexProcessedWithoutDefine;

            defineStr = [];
            _.each( this.lightNumber, function( count, lightType){
                if( count ){
                    defineStr.push( "#define "+lightType+"_NUMBER "+count );
                }
            });
            _.each( this._textureStatus, function( status, symbol){
                if( status.enabled && status.shaderType === "fragment" ){
                    defineStr.push( "#define "+symbol.toUpperCase()+"_ENABLED" );
                }
            });
            // Custom Defines
            _.each( this.fragmentDefines, function(value, symbol){
                if( value === null){
                    defineStr.push("#define "+symbol);
                }else{
                    defineStr.push("#define "+symbol+" "+value.toString());
                }
            } )
            var tmp = defineStr.join("\n") + "\n" + this._fragmentProcessedWithoutDefine;
            
            // Add precision
            this._fragmentProcessed = ['precision', this.precision, 'float'].join(' ')+';\n' + tmp;
        },

        _parseUniforms : function(){
            var uniforms = {},
                self = this;
            var shaderType = "vertex";
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace( uniformRegex, _uniformParser );
            shaderType = "fragment";
            this._fragmentProcessedWithoutDefine = this._fragmentProcessedWithoutDefine.replace( uniformRegex, _uniformParser );

            function _uniformParser(str, type, symbol, isArray, semanticWrapper, semantic){
                if( type && symbol ){
                    var uniformType = uniformTypeMap[type];
                    var isConfigurable = true;
                    if( uniformType ){
                        if( type === "sampler2D" || type === "samplerCube" ){
                            // Texture is default disabled
                            self._textureStatus[symbol] = {
                                enabled : false,
                                shaderType : shaderType
                            };
                        }
                        if( isArray ){
                            uniformType += 'v';
                        }
                        if( semantic ){
                            if( availableSemantics.indexOf(semantic) < 0 ){
                                // The uniform is not configurable, which means it will not appear
                                // in the material uniform properties
                                if(semantic === "unconfigurable"){
                                    isConfigurable = false;
                                }else{
                                    var defaultValueFunc = self._parseDefaultValue( type, semantic );
                                    if( ! defaultValueFunc)
                                        console.warn('Unkown semantic "' + semantic + '"');
                                    else
                                        semantic = "";
                                }
                            }
                            else{
                                self.semantics[ semantic ] = {
                                    symbol : symbol,
                                    type : uniformType
                                }
                                isConfigurable = false;
                            }
                        }
                        if(isConfigurable){
                            uniforms[ symbol ] = {
                                type : uniformType,
                                value : isArray ? uniformValueConstructor['array'] : ( defaultValueFunc || uniformValueConstructor[ type ] ),
                                semantic : semantic || null
                            }
                        }
                    }
                    return ["uniform", type, symbol, isArray].join(" ")+";\n";
                }
            }

            this.uniformTemplates = uniforms;
        },

        _parseDefaultValue : function(type, str){
            var arrayRegex = /\[\s*(.*)\s*\]/
            if( type === "vec2" ||
                type === "vec3" ||
                type === "vec4"){
                var arrayStr = arrayRegex.exec(str)[1];
                if( arrayStr ){
                    var arr = arrayStr.split(/\s*,\s*/);
                    return function(){
                        return new Float32Array(arr);
                    }
                }else{
                    // Invalid value
                    return;
                }
            }
            else if( type === "bool" ){
                return function(){
                    return str.toLowerCase() === "true" ? true : false;
                }
            }
            else if( type === "float" ){
                return function(){
                    return parseFloat(str);
                }
            }
        },

        // Create a new uniform instance for material
        createUniforms : function(){
            var uniforms = {};
            
            _.each( this.uniformTemplates, function( uniformTpl, symbol ){
                uniforms[ symbol ] = {
                    type : uniformTpl.type,
                    value : uniformTpl.value()
                }
            } )

            return uniforms;
        },

        _parseAttributes : function(){
            var attributes = {},
                self = this;
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace( attributeRegex, _attributeParser );

            function _attributeParser( str, type, symbol, semanticWrapper, semantic ){
                if( type && symbol ){
                    var size = 1;
                    switch( type ){
                        case "vec4":
                            size = 4;
                            break;
                        case "vec3":
                            size = 3;
                            break;
                        case "vec2":
                            size = 2;
                            break;
                        case "float":
                            size = 1;
                            break;
                    }

                    attributes[ symbol ] = {
                        // Force float
                        type : "float",
                        size : size,
                        semantic : semantic || null
                    }

                    if( semantic ){
                        if( availableSemantics.indexOf(semantic) < 0 ){
                            console.warn('Unkown semantic "' + semantic + '"');
                        }else{
                            self.semantics[ semantic ] = {
                                symbol : symbol,
                                type : type
                            }
                        }
                    }
                }

                return ["attribute", type, symbol].join(" ")+";\n";
            }

            this.attributeTemplates = attributes;
        },

        _buildProgram : function(_gl, vertexShaderString, fragmentShaderString){

            if( this.cache.get("program") ){
                _gl.deleteProgram( this.cache.get("program") );
            }
            var program = _gl.createProgram();

            try{

                var vertexShader = this._compileShader(_gl, "vertex", vertexShaderString);
                var fragmentShader = this._compileShader(_gl, "fragment", fragmentShaderString);
                _gl.attachShader( program, vertexShader );
                _gl.attachShader( program, fragmentShader );

                _gl.linkProgram( program );

                if ( !_gl.getProgramParameter( program, _gl.LINK_STATUS ) ) {
                    throw new Error( "Could not initialize shader\n" + "VALIDATE_STATUS: " + _gl.getProgramParameter( program, _gl.VALIDATE_STATUS ) + ", gl error [" + _gl.getError() + "]" );
                }
            }catch(e){
                if( errorShader[ this.__GUID__] ){
                    return;
                }
                errorShader[ this.__GUID__ ] = this;
                throw e; 
            }

            _gl.deleteShader( vertexShader );
            _gl.deleteShader( fragmentShader );

            this.cache.put("program", program);
        },

        _compileShader : function(_gl, type, shaderString){
            var shader = _gl.createShader( type === "fragment" ? _gl.FRAGMENT_SHADER : _gl.VERTEX_SHADER );
            _gl.shaderSource( shader, shaderString );
            _gl.compileShader( shader );

            if ( !_gl.getShaderParameter( shader, _gl.COMPILE_STATUS ) ) {
                throw new Error( [_gl.getShaderInfoLog( shader ),
                                    addLineNumbers(shaderString) ].join("\n") );
            }
            return shader;
        },

        dispose : function(){
            
        }
    });
        
    // some util functions
    function addLineNumbers( string ){
        var chunks = string.split( "\n" );
        for ( var i = 0, il = chunks.length; i < il; i ++ ) {
            // Chrome reports shader errors on lines
            // starting counting from 1
            chunks[ i ] = ( i + 1 ) + ": " + chunks[ i ];
        }
        return chunks.join( "\n" );
    }

    var importRegex = /(@import)\s*([0-9a-zA-Z_\-\.]*)/g;
    Shader.parseImport = function( shaderStr ){
        shaderStr = shaderStr.replace( importRegex, function(str, importSymbol, importName ){
            if( _source[importName] ){
                // Recursively parse
                return Shader.parseImport( _source[ importName ] );
            }
        } )
        return shaderStr;
    }

    var exportRegex = /(@export)\s*([0-9a-zA-Z_\-\.]*)\s*\n([\s\S]*?)@end/g;
    // Import the shader to library and chunks
    Shader.import = function( shaderStr ){

        shaderStr.replace( exportRegex, function(str, exportSymbol, exportName, code){
            _source[ exportName ] = code;
            return code;
        } )
    }

    // Library to store all the loaded shader strings
    var _source = {};

    Shader.source = function( name ){
        var shaderStr = _source[name];
        if( ! shaderStr ){
            console.error( 'Shader "' + name + '" not existed in library');
            return;
        }
        return shaderStr;
    }

    return Shader;
} );
/**
 * Base class for all textures like compressed texture, texture2d, texturecube
 * TODO mapping
 */
define('3d/texture',['require','core/base','_'], function(require){

    var Base = require("core/base"),
        _ = require("_");

    var Texture = Base.derive( function(){

        return {

            // Width and height is used when the image is null and want
            // to use it as a texture attach to framebuffer( RTT )
            width : 512,
            height : 512,

            // UNSIGNED_BYTE 
            // FLOAT
            type : 'UNSIGNED_BYTE',
            // ALPHA
            // RGB
            // RGBA
            // LUMINANCE
            // LUMINANCE_ALPHA
            format : 'RGBA',
            // 'CLAMP_TO_EDGE'
            // 'REPEAT'
            // 'MIRRORED_REPEAT'
            wrapS : 'CLAMP_TO_EDGE',
            wrapT : 'CLAMP_TO_EDGE',
            // Texture min and mag filter
            // http://www.khronos.org/registry/gles/specs/2.0/es_full_spec_2.0.25.pdf
            // NEARST
            // LINEAR
            // NEAREST_MIPMAP_NEAREST
            // NEAREST_MIPMAP_LINEAR
            // LINEAR_MIPMAP_NEAREST
            // LINEAR_MIPMAP_LINEAR
            minFilter : 'LINEAR_MIPMAP_LINEAR',
            // NEARST
            // LINEAR
            magFilter : 'LINEAR',

            generateMipmaps : true,

            // http://blog.tojicode.com/2012/03/anisotropic-filtering-in-webgl.html
            anisotropic : 1,
            // pixelStorei parameters
            // http://www.khronos.org/opengles/sdk/docs/man/xhtml/glPixelStorei.xml
            flipY : true,
            unpackAlignment : 4,
            premultiplyAlpha : false,

            NPOT : false
        }
    }, {

        getWebGLTexture : function( _gl ){

            this.cache.use( _gl.__GUID__ );

            if( this.cache.miss( "webgl_texture" ) ){
                // In a new gl context, create new texture and set dirty true
                this.cache.put( "webgl_texture", _gl.createTexture() );
                this.cache.put( "dirty", true );
            }
            if( this.cache.get("dirty") ){
                this.update( _gl );
                this.cache.put("dirty", false);
            }

            return this.cache.get( "webgl_texture" );
        },

        bind : function(){},
        unbind : function(){},
        
        // Overwrite the dirty method
        dirty : function(){
            for( var contextId in this.cache._caches ){
                this.cache._caches[ contextId ][ "dirty" ] = true;
            }
        },

        update : function( _gl ){},

        // Update the common parameters of texture
        beforeUpdate : function( _gl ){
            _gl.pixelStorei( _gl.UNPACK_FLIP_Y_WEBGL, this.flipY );
            _gl.pixelStorei( _gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha );
            _gl.pixelStorei( _gl.UNPACK_ALIGNMENT, this.unpackAlignment );

            this.fallBack();
        },

        fallBack : function(){

            // Use of none-power of two texture
            // http://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences
            
            var isPowerOfTwo = this.isPowerOfTwo();

            if( this.format === "DEPTH_COMPONENT"){
                this.generateMipmaps = false;
            }

            if( ! isPowerOfTwo || ! this.generateMipmaps){
                // none-power of two flag
                this.NPOT = true;
                // Save the original value for restore
                this._minFilterOriginal = this.minFilter;
                this._magFilterOriginal = this.magFilter;
                this._wrapSOriginal = this.wrapS;
                this._wrapTOriginal = this.wrapT;

                if( this.minFilter.indexOf("NEAREST") == 0){
                    this.minFilter = 'NEAREST';
                }else{
                    this.minFilter = 'LINEAR'
                }

                if( this.magFilter.indexOf("NEAREST") == 0){
                    this.magFilter = 'NEAREST';
                }else{
                    this.magFilter = 'LINEAR'
                }

                this.wrapS = 'CLAMP_TO_EDGE';
                this.wrapT = 'CLAMP_TO_EDGE';
            }else{
                if( this._minFilterOriginal ){
                    this.minFilter = this._minFilterOriginal;
                }
                if( this._magFilterOriginal ){
                    this.magFilter = this._magFilterOriginal;
                }
                if( this._wrapSOriginal ){
                    this.wrapS = this._wrapSOriginal;
                }
                if( this._wrapTOriginal ){
                    this.wrapT = this._wrapTOriginal;
                }
            }

        },

        nextHighestPowerOfTwo : function(x) {
            --x;
            for (var i = 1; i < 32; i <<= 1) {
                x = x | x >> i;
            }
            return x + 1;
        },

        dispose : function( _gl ){
            this.cache.use(_gl.__GUID__);
            _gl.deleteTexture( this.cache.get("webgl_texture") );
        },

        isRenderable : function(){},
        
        isPowerOfTwo : function(){},
    } )

    return Texture;
} );
/**
 * @export{class} WebGLInfo
 */
define('3d/webglinfo',[], function(){


    // http://www.khronos.org/registry/webgl/extensions/
    var EXTENSION_LIST = ["OES_texture_float",
                            "OES_texture_half_float",
                            "OES_standard_derivatives",
                            "OES_vertex_array_object",
                            "OES_element_index_uint",
                            "WEBGL_compressed_texture_s3tc",
                            'WEBGL_depth_texture',
                            "EXT_texture_filter_anisotropic",
                            "EXT_draw_buffers"];

    var initialized = false;

    var extensions = {};

    var WebGLInfo = {

        initialize : function( _gl ){
            if(initialized){
                return;
            }
            // Basic info

            // Get webgl extension
            for(var i = 0; i < EXTENSION_LIST.length; i++){
                var extName = EXTENSION_LIST[i];

                var ext = _gl.getExtension(extName);
                // Try vendors
                if( ! ext){
                    ext = _gl.getExtension("MOZ_" + extName);
                }
                if( ! ext){
                    ext = _gl.getExtension("WEBKIT_" + extName);
                }

                extensions[extName] = ext;
            }

            initialized = true;
        },

        getExtension : function(name){
            return extensions[name];
        }
    }

    return WebGLInfo;
} );
/**
 *
 * @export{class} Texture2D
 */
define('3d/texture/texture2d',['require','../texture','../webglinfo'], function(require){

    var Texture = require('../texture');
    var WebGLInfo = require('../webglinfo');

    var Texture2D = Texture.derive({
        
        image : null,

        pixels : null,
    }, {
        update : function( _gl ){

            _gl.bindTexture( _gl.TEXTURE_2D, this.cache.get("webgl_texture") );
            
            this.beforeUpdate(  _gl );

            var glFormat = _gl[ this.format.toUpperCase() ],
                glType = _gl[ this.type.toUpperCase() ];

            _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl[ this.wrapS.toUpperCase() ] );
            _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl[ this.wrapT.toUpperCase() ] );

            _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl[ this.magFilter.toUpperCase() ] );
            _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl[ this.minFilter.toUpperCase() ] );
            
            var anisotropicExt = WebGLInfo.getExtension("EXT_texture_filter_anisotropic");
            if( anisotropicExt){
                _gl.texParameterf(_gl.TEXTURE_2D, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }

            if( this.image ){
                // After image is loaded
                if( this.image.complete )
                    _gl.texImage2D( _gl.TEXTURE_2D, 0, glFormat, glFormat, glType, this.image );
            }
            // Can be used as a blank texture when writing render to texture(RTT)
            else{
                _gl.texImage2D( _gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, this.pixels);
            }           
        
            if( ! this.NPOT && this.generateMipmaps ){
                _gl.generateMipmap( _gl.TEXTURE_2D );
            }
            
            _gl.bindTexture( _gl.TEXTURE_2D, null );

        },
        
        isPowerOfTwo : function(){
            if( this.image ){
                var width = this.image.width,
                    height = this.image.height;   
            }else{
                var width = this.width,
                    height = this.height;
            }
            return ( width & (width-1) ) === 0 &&
                    ( height & (height-1) ) === 0;
        },

        isRenderable : function(){
            if( this.image ){
                return this.image.complete;
            }else{
                return this.width && this.height;
            }
        },

        bind : function( _gl ){
            _gl.bindTexture( _gl.TEXTURE_2D, this.getWebGLTexture(_gl) );
        },
        unbind : function( _gl ){
            _gl.bindTexture( _gl.TEXTURE_2D, null );
        },
    })

    return Texture2D;
} );
/**
 *
 * @export{class} TextureCube
 */
define('3d/texture/texturecube',['require','../texture','../webglinfo','_'], function(require){

    var Texture = require('../texture');
    var WebGLInfo = require('../webglinfo');
    var _ = require('_');

    var targetMap = {
        'px' : 'TEXTURE_CUBE_MAP_POSITIVE_X',
        'py' : 'TEXTURE_CUBE_MAP_POSITIVE_Y',
        'pz' : 'TEXTURE_CUBE_MAP_POSITIVE_Z',
        'nx' : 'TEXTURE_CUBE_MAP_NEGATIVE_X',
        'ny' : 'TEXTURE_CUBE_MAP_NEGATIVE_Y',
        'nz' : 'TEXTURE_CUBE_MAP_NEGATIVE_Z',
    }

    var TextureCube = Texture.derive({
        image : {
            px : null,
            nx : null,
            py : null,
            ny : null,
            pz : null,
            nz : null
        },
        pixels : {
            px : null,
            nx : null,
            py : null,
            ny : null,
            pz : null,
            nz : null
        }
    }, {

        update : function( _gl ){

            _gl.bindTexture( _gl.TEXTURE_CUBE_MAP, this.cache.get("webgl_texture") );

            this.beforeUpdate( _gl );

            var glFormat = _gl[ this.format.toUpperCase() ],
                glType = _gl[ this.type.toUpperCase() ];

            _gl.texParameteri( _gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_WRAP_S, _gl[ this.wrapS.toUpperCase() ] );
            _gl.texParameteri( _gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_WRAP_T, _gl[ this.wrapT.toUpperCase() ] );

            _gl.texParameteri( _gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_MAG_FILTER, _gl[ this.magFilter.toUpperCase() ] );
            _gl.texParameteri( _gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_MIN_FILTER, _gl[ this.minFilter.toUpperCase() ] );
            
            var anisotropicExt = WebGLInfo.getExtension("EXT_texture_filter_anisotropic");
            if( anisotropicExt){
                _gl.texParameterf(_gl.TEXTURE_CUBE_MAP, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }

            _.each( this.image, function(img, target){
                if( img )
                    _gl.texImage2D( _gl[ targetMap[target] ], 0, glFormat, glFormat, glType, img );
                else
                    _gl.texImage2D( _gl[ targetMap[target] ], 0, glFormat, this.width, this.height, 0, glFormat, glType, this.pixels[target] );
            }, this);

            if( !this.NPOT && this.generateMipmaps ){
                _gl.generateMipmap( _gl.TEXTURE_CUBE_MAP );
            }

            _gl.bindTexture( _gl.TEXTURE_CUBE_MAP, null );
        },
        bind : function( _gl ){

            _gl.bindTexture( _gl.TEXTURE_CUBE_MAP, this.getWebGLTexture(_gl) );
        },
        unbind : function( _gl ){
            _gl.bindTexture( _gl.TEXTURE_CUBE_MAP, null );
        },
        // Overwrite the isPowerOfTwo method
        isPowerOfTwo : function(){
            if( this.image.px ){
                return isPowerOfTwo( this.image.px.width ) &&
                        isPowerOfTwo( this.image.px.height );
            }else{
                return isPowerOfTwo( this.width ) &&
                        isPowerOfTwo( this.height );
            }

            function isPowerOfTwo( value ){
                return value & (value-1) === 0
            }
        },
        isRenderable : function(){
            if( this.image.px ){
                return this.image.px.complete &&
                        this.image.nx.complete &&
                        this.image.py.complete &&
                        this.image.ny.complete &&
                        this.image.pz.complete &&
                        this.image.nz.complete;
            }else{
                return this.width && this.height;
            }
        }
    });

    return TextureCube;
} );
define('3d/material',['require','core/base','./shader','util/util','./texture','./texture/texture2d','./texture/texturecube','_'], function(require){

    var Base = require("core/base");
    var Shader = require("./shader");
    var util = require("util/util");
    var Texture = require('./texture');
    var Texture2D = require('./texture/texture2d');
    var TextureCube = require('./texture/texturecube');
    var _ = require("_");

    var Material = Base.derive( function(){

        var id = util.genGUID();

        return {
            __GUID__ : id,

            name : 'MATERIAL_' + id,

            //{
            // type
            // value
            // semantic
            //}
            uniforms : {},

            shader : null,

            
            depthTest : true,
            depthWrite : true,

            transparent : false,
            // Blend func is a callback function when the material 
            // have custom blending
            // The gl context will be the only argument passed in tho the
            // blend function
            // Detail of blend function in WebGL:
            // http://www.khronos.org/registry/gles/specs/2.0/es_full_spec_2.0.25.pdf
            //
            // Example :
            // function( _gl ){
            //  _gl.blendEquation( _gl.FUNC_ADD );
            //  _gl.blendFunc( _gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);
            // }
            blend : null,

            // Binding lights in the renderer automatically
            autoBindingLights : true
        }
    }, function(){
        if( this.shader ){
            this.attachShader( this.shader );
        }
    }, {

        bind : function( _gl ){

            var slot = 0;

            // Set uniforms
            _.each( this.uniforms, function( uniform, symbol ){
                if( uniform.value === null ){
                    return;
                }
                else if(uniform.value instanceof Array
                    && ! uniform.value.length){
                    return;
                }
                if( uniform.value.instanceof &&
                    uniform.value.instanceof( Texture) ){
                
                    var texture = uniform.value;
                    // Maybe texture is not loaded yet;
                    if( ! texture.isRenderable() ){
                        return;
                    }

                    _gl.activeTexture( _gl.TEXTURE0 + slot );
                    texture.bind( _gl );

                    this.shader.setUniform( _gl, '1i', symbol, slot );

                    slot++;
                }
                else if( uniform.value instanceof Array ){
                    // Texture Array
                    var exampleValue = uniform.value[0];

                    if( exampleValue && 
                        exampleValue.instanceof && 
                        exampleValue.instanceof(Texture) ){

                        var res = [];
                        for( var i = 0; i < uniform.value.length; i++){
                            var texture = uniform.value[i];
                            // Maybe texture is not loaded yet;
                            if( ! texture.isRenderable() ){
                                continue;
                            }

                            _gl.activeTexture( _gl.TEXTURE0 + slot );
                            texture.bind(_gl);

                            res.push(slot++);
                        }
                        this.shader.setUniform( _gl, '1iv', symbol, res );

                    }else{
                        this.shader.setUniform( _gl, uniform.type, symbol, uniform.value );
                    }
                }
                else{
                    
                    this.shader.setUniform( _gl, uniform.type, symbol, uniform.value );
                }

            }, this );
        },

        setUniform : function( symbol, value ){
            var uniform = this.uniforms[symbol];
            if( uniform ){
                uniform.value = value;
            }else{
                // console.warn('Uniform "'+symbol+'" not exist');
            }
        },

        setUniforms : function(obj){
            for( var symbol in obj){
                var value = obj[symbol];
                this.setUniform( symbol, value );
            }
        },

        getUniform : function(symbol){
            var uniform = this.uniforms[symbol];
            if( uniform ){
                return uniform.value;
            }else{
                // console.warn('Uniform '+symbol+' not exist');
            }
        },

        attachShader : function( shader ){
            this.uniforms = shader.createUniforms();
            this.shader = shader;
        },

        detachShader : function(){
            this.shader = null;
            this.uniforms = {};
        }

    })

    return Material;
} );
define('3d/mesh',['require','./node','_'], function(require){

    var Node = require("./node");
    var _ = require("_");

    var prevDrawID = 0;

    var Mesh = Node.derive( function() {

        return {
            
            material : null,

            geometry : null,

            // Draw mode
            mode : "TRIANGLES",
            
            receiveShadow : true,
            castShadow : true,

            // Skinned Mesh
            skeleton : null
        }
    }, {

        render : function( renderer, globalMaterial ) {

            var _gl = renderer.gl;

            this.trigger('beforerender', _gl);
            
            var material = globalMaterial || this.material;
            var shader = material.shader;
            var geometry = this.geometry;

            var glDrawMode = _gl[ this.mode.toUpperCase() ];
            
            // Set pose matrices of skinned mesh
            if(this.skeleton){
                var skinMatricesArray = this.skeleton.getBoneMatricesArray();
                shader.setUniform(_gl, "m4v", "boneMatrices", skinMatricesArray);
            }
            // Draw each chunk
            var chunks = geometry.getBufferChunks( _gl );

            for( var c = 0; c < chunks.length; c++){
                currentDrawID = _gl.__GUID__ + "_" + geometry.__GUID__ + "_" + c;

                var chunk = chunks[c],
                    attributeBuffers = chunk.attributeBuffers,
                    indicesBuffer = chunk.indicesBuffer;

                if( currentDrawID !== prevDrawID ){
                    prevDrawID = currentDrawID;
                    
                    availableAttributes = {};
                    for(var name in attributeBuffers){
                        var attributeBufferInfo = attributeBuffers[name];
                        var semantic = attributeBufferInfo.semantic;

                        if( semantic ){
                            var semanticInfo = shader.semantics[ semantic ];
                            var symbol = semanticInfo && semanticInfo.symbol;
                        }else{
                            var symbol = name;
                        }
                        if(symbol && shader.attributeTemplates[symbol] ){
                            availableAttributes[symbol] = attributeBufferInfo;
                        }
                    }
                    shader.enableAttributes(_gl, Object.keys(availableAttributes) );
                    // Setting attributes;
                    for( var symbol in availableAttributes ){
                        var attributeBufferInfo = availableAttributes[symbol];
                        var buffer = attributeBufferInfo.buffer;

                        _gl.bindBuffer( _gl.ARRAY_BUFFER, buffer );
                        shader.setMeshAttribute( _gl, symbol, attributeBufferInfo );
                    }
                }
                //Do drawing
                if( geometry.useFaces ){
                    _gl.bindBuffer( _gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer );
                    _gl.drawElements( glDrawMode, indicesBuffer.count, _gl.UNSIGNED_SHORT, 0 );
                }else{
                    _gl.drawArrays( glDrawMode, 0, geometry.vertexCount );
                }
            }

            var drawInfo = {
                faceNumber : geometry.faces.length,
                vertexNumber : geometry.getVerticesNumber(),
                drawcallNumber : chunks.length
            };
            this.trigger('afterrender', _gl, drawInfo);

            return drawInfo;
        },

        bindGeometry : function( _gl ) {

            var shader = this.material.shader;
            var geometry = this.geometry;

        }

    });

    // Called when material is changed
    // In case the material changed and geometry not changed
    // And the previous material has less attributes than next material
    Mesh.materialChanged = function(){
        prevDrawID = 0;
    }

    return Mesh;
} );
define('3d/compositor/shaders/vertex.essl',[],function () { return 'uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\n\nvarying vec2 v_Texcoord;\n\nvoid main(){\n\n    v_Texcoord = texcoord;\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n}';});

define('3d/compositor/shaders/coloradjust.essl',[],function () { return '@export buildin.compositor.coloradjust\n\nvarying vec2 v_Texcoord;\nuniform sampler2D texture;\n\nuniform float brightness : 0.0;\nuniform float contrast : 1.0;\nuniform float exposure : 0.0;\nuniform float gamma : 1.0;\nuniform float saturation : 1.0;\n\n// Values from "Graphics Shaders: Theory and Practice" by Bailey and Cunningham\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord);\n\n    // brightness\n    gl_FragColor.xyz = tex.rgb + vec3(brightness);\n    // contrast\n    gl_FragColor.xyz = (gl_FragColor.xyz-vec3(0.5))*contrast+vec3(0.5);\n    // exposure\n    gl_FragColor.xyz = gl_FragColor.xyz * pow(2.0, exposure);\n    // gamma\n    gl_FragColor.xyz = pow(gl_FragColor.xyz, vec3(gamma));\n    // saturation\n    float luminance = dot( gl_FragColor.xyz, w );\n    gl_FragColor.xyz = mix(vec3(luminance), gl_FragColor.xyz, saturation);\n\n    gl_FragColor.w = tex.w;\n}\n\n@end';});

define('3d/compositor/shaders/blur.essl',[],function () { return '/**\n *  http://www.gamerendering.com/2008/10/11/gaussian-blur-filter-shader/\n */\n\n@export buildin.compositor.gaussian_blur_v\n\nuniform sampler2D texture; // the texture with the scene you want to blur\nvarying vec2 v_Texcoord;\n \nuniform float blurSize : 3.0; \nuniform float imageWidth : 512.0;\n\nvoid main(void)\n{\n   vec4 sum = vec4(0.0);\n \n   // blur in y (vertical)\n   // take nine samples, with the distance blurSize between them\n   sum += texture2D(texture, vec2(v_Texcoord.x - 4.0*blurSize/imageWidth, v_Texcoord.y)) * 0.05;\n   sum += texture2D(texture, vec2(v_Texcoord.x - 3.0*blurSize/imageWidth, v_Texcoord.y)) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x - 2.0*blurSize/imageWidth, v_Texcoord.y)) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x - blurSize/imageWidth, v_Texcoord.y)) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y)) * 0.16;\n   sum += texture2D(texture, vec2(v_Texcoord.x + blurSize/imageWidth, v_Texcoord.y)) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x + 2.0*blurSize/imageWidth, v_Texcoord.y)) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x + 3.0*blurSize/imageWidth, v_Texcoord.y)) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x + 4.0*blurSize/imageWidth, v_Texcoord.y)) * 0.05;\n \n   gl_FragColor = sum;\n}\n\n@end\n\n@export buildin.compositor.gaussian_blur_h\n\nuniform sampler2D texture; // this should hold the texture rendered by the horizontal blur pass\nvarying vec2 v_Texcoord;\n \nuniform float blurSize : 3.0;\nuniform float imageHeight : 512.0;\n \nvoid main(void)\n{\n   vec4 sum = vec4(0.0);\n \n   // blur in y (vertical)\n   // take nine samples, with the distance blurSize between them\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y - 4.0*blurSize/imageHeight)) * 0.05;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y - 3.0*blurSize/imageHeight)) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y - 2.0*blurSize/imageHeight)) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y - blurSize/imageHeight)) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y)) * 0.16;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y + blurSize/imageHeight)) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y + 2.0*blurSize/imageHeight)) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y + 3.0*blurSize/imageHeight)) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y + 4.0*blurSize/imageHeight)) * 0.05;\n \n   gl_FragColor = sum;\n}\n\n@end\n\n@export buildin.compositor.box_blur\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 3.0;\nuniform float imageWidth : 512.0;\nuniform float imageHeight : 512.0;\n\nvoid main(void){\n\n   vec4 tex = texture2D(texture, v_Texcoord);\n   vec2 offset = vec2(blurSize/imageWidth, blurSize/imageHeight);\n\n   tex += texture2D(texture, v_Texcoord + vec2(offset.x, 0.0) );\n   tex += texture2D(texture, v_Texcoord + vec2(offset.x, offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(-offset.x, offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(0.0, offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(-offset.x, 0.0) );\n   tex += texture2D(texture, v_Texcoord + vec2(-offset.x, -offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(offset.x, -offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(0.0, -offset.y) );\n\n   tex /= 9.0;\n   return tex;\n}\n\n@end\n\n// http://www.slideshare.net/DICEStudio/five-rendering-ideas-from-battlefield-3-need-for-speed-the-run\n@export buildin.compositor.hexagonal_blur_mrt_1\n\n// MRT in chrome\n// https://www.khronos.org/registry/webgl/sdk/tests/conformance/extensions/ext-draw-buffers.html\n#extension GL_EXT_draw_buffers : require\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 2.0;\n\nuniform float imageWidth : 512.0;\nuniform float imageHeight : 512.0;\n\nvoid main(void){\n   vec2 offset = vec2(blurSize/imageWidth, blurSize/imageHeight);\n\n   vec4 color = vec4(0.0);\n   // Top\n   for(int i = 0; i < 10; i++){\n      color += 1.0/10.0 * texture2D(texture, v_Texcoord + vec2(0.0, offset.y * float(i)) );\n   }\n   gl_FragData[0] = color;\n   vec4 color2 = vec4(0.0);\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color2 += 1.0/10.0 * texture2D(texture, v_Texcoord - vec2(offset.x * float(i), offset.y * float(i)) );\n   }\n   gl_FragData[1] = (color + color2) / 2.0;\n}\n\n@end\n\n@export buildin.compositor.hexagonal_blur_mrt_2\n\nuniform sampler2D texture0;\nuniform sampler2D texture1;\n\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 2.0;\n\nuniform float imageWidth : 512.0;\nuniform float imageHeight : 512.0;\n\nvoid main(void){\n   vec2 offset = vec2(blurSize/imageWidth, blurSize/imageHeight);\n\n   vec4 color1 = vec4(0.0);\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color1 += 1.0/10.0 * texture2D(texture0, v_Texcoord - vec2(offset.x * float(i), offset.y * float(i)) );\n   }\n   vec4 color2 = vec4(0.0);\n   // Down right\n   for(int i = 0; i < 10; i++){\n      color2 += 1.0/10.0 * texture2D(texture1, v_Texcoord + vec2(offset.x * float(i), -offset.y * float(i)) );\n   }\n\n   gl_FragColor = (color1 + color2) / 2.0;\n}\n\n@end\n\n\n@export buildin.compositor.hexagonal_blur_1\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 1.0;\n\nuniform float imageWidth : 512.0;\nuniform float imageHeight : 512.0;\n\nvoid main(void){\n   vec2 offset = vec2(blurSize/imageWidth, blurSize/imageHeight);\n\n   vec4 color = vec4(0.0);\n   // Top\n   for(int i = 0; i < 10; i++){\n      color += 1.0/10.0 * texture2D(texture, v_Texcoord + vec2(0.0, offset.y * float(i)) );\n   }\n   gl_FragColor = color;\n}\n\n@end\n\n@export buildin.compositor.hexagonal_blur_2\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 1.0;\n\nuniform float imageWidth : 512.0;\nuniform float imageHeight : 512.0;\n\nvoid main(void){\n   vec2 offset = vec2(blurSize/imageWidth, blurSize/imageHeight);\n\n   vec4 color = vec4(0.0);\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color += 1.0/10.0 * texture2D(texture, v_Texcoord - vec2(offset.x * float(i), offset.y * float(i)) );\n   }\n   gl_FragColor = color;\n}\n@end\n\n@export buildin.compositor.hexagonal_blur_3\n\nuniform sampler2D texture1;\nuniform sampler2D texture2;\n\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 1.0;\n\nuniform float imageWidth : 1.0;\nuniform float imageHeight : 1.0;\n\nvoid main(void){\n   vec2 offset = vec2(blurSize/imageWidth, blurSize/imageHeight);\n\n   vec4 color1 = vec4(0.0);\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color1 += 1.0/10.0 * texture2D(texture1, v_Texcoord - vec2(offset.x * float(i), offset.y * float(i)) );\n   }\n   vec4 color2 = vec4(0.0);\n   // Down right\n   for(int i = 0; i < 10; i++){\n      color2 += 1.0/10.0 * texture2D(texture1, v_Texcoord + vec2(offset.x * float(i), -offset.y * float(i)) );\n   }\n\n   vec4 color3 = vec4(0.0);\n   // Down right\n   for(int i = 0; i < 10; i++){\n      color3 += 1.0/10.0 * texture2D(texture2, v_Texcoord + vec2(offset.x * float(i), -offset.y * float(i)) );\n   }\n\n   gl_FragColor = (color1 + color2 + color3) / 3.0;\n}\n\n@end';});

define('3d/compositor/shaders/grayscale.essl',[],function () { return '\n@export buildin.compositor.grayscale\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord );\n    float luminance = dot(tex.rgb, w);\n\n    gl_FragColor = vec4(vec3(luminance), tex.a);\n}\n\n@end';});

define('3d/compositor/shaders/lut.essl',[],function () { return '\n// https://github.com/BradLarson/GPUImage?source=c\n@export buildin.compositor.lut\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\nuniform sampler2D lookup;\n\nvoid main()\n{\n    vec4 tex = texture2D(texture, v_Texcoord);\n\n    float blueColor = tex.b * 63.0;\n    \n    vec2 quad1;\n    quad1.y = floor(floor(blueColor) / 8.0);\n    quad1.x = floor(blueColor) - (quad1.y * 8.0);\n    \n    vec2 quad2;\n    quad2.y = floor(ceil(blueColor) / 8.0);\n    quad2.x = ceil(blueColor) - (quad2.y * 8.0);\n    \n    vec2 texPos1;\n    texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.r);\n    texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.g);\n    \n    vec2 texPos2;\n    texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.r);\n    texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.g);\n    \n    vec4 newColor1 = texture2D(lookup, texPos1);\n    vec4 newColor2 = texture2D(lookup, texPos2);\n    \n    vec4 newColor = mix(newColor1, newColor2, fract(blueColor));\n    gl_FragColor = vec4(newColor.rgb, tex.w);\n}\n\n@end';});

define('3d/compositor/shaders/output.essl',[],function () { return '\n@export buildin.compositor.output\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord );\n\n    gl_FragColor = tex;\n}\n\n@end';});

define('3d/compositor/pass',['require','core/base','../scene','../camera/orthographic','../geometry/plane','../shader','../material','../mesh','../scene','./shaders/vertex.essl','../texture','../webglinfo','./shaders/coloradjust.essl','./shaders/blur.essl','./shaders/grayscale.essl','./shaders/lut.essl','./shaders/output.essl'], function(require){

    var Base = require("core/base");
    var Scene = require("../scene");
    var OrthoCamera = require('../camera/orthographic');
    var Plane = require('../geometry/plane');
    var Shader = require('../shader');
    var Material = require('../material');
    var Mesh = require('../mesh');
    var Scene = require('../scene');
    var vertexShaderString = require('./shaders/vertex.essl');
    var Texture = require('../texture');
    var WebGLInfo = require('../webglinfo');

    var planeGeo = new Plane();
    var mesh = new Mesh({
            geometry : planeGeo
        });
    var scene = new Scene();
    var camera = new OrthoCamera();
        
    scene.add(mesh);

    var Pass = Base.derive( function(){
        return {
            // Fragment shader string
            fragment : "",

            outputs : null,

            _material : null

        }
    }, function(){

        var shader = new Shader({
            vertex : vertexShaderString,
            fragment : this.fragment
        })
        var material = new Material({
            shader : shader
        });
        shader.enableTexturesAll();

        this._material = material;

    }, {

        setUniform : function(name, value){
            
            var uniform = this._material.uniforms[name];
            if( uniform ){
                uniform.value = value;
            }else{
                // console.warn('Unkown uniform "' + name + '"');
            }
        },

        bind : function( renderer, frameBuffer ){
            
            if( this.outputs ){
                for( var attachment in this.outputs){
                    var texture = this.outputs[attachment];
                    frameBuffer.attach( renderer.gl, texture, attachment );
                }
                frameBuffer.bind( renderer );
            }
        },

        unbind : function( renderer, frameBuffer ){
            frameBuffer.unbind( renderer );
        },

        render : function( renderer, frameBuffer ){

            var _gl = renderer.gl;

            mesh.material = this._material;

            if( frameBuffer ){
                this.bind( renderer, frameBuffer );
            }

            // MRT Support in chrome
            // https://www.khronos.org/registry/webgl/sdk/tests/conformance/extensions/ext-draw-buffers.html
            var ext = WebGLInfo.getExtension("EXT_draw_buffers");
            if(ext){
                var bufs = [];
                for( var attachment in this.outputs){
                    attachment = parseInt(attachment);
                    if(attachment >= _gl.COLOR_ATTACHMENT0 && attachment <= _gl.COLOR_ATTACHMENT0 + 8){
                        bufs.push(attachment);
                    }
                }
                ext.drawBuffersEXT(bufs);
            }

            renderer.render( scene, camera, true );

            if( frameBuffer ){
                this.unbind( renderer, frameBuffer );
            }
        }
    } )

    // Some build in shaders
    Shader.import( require('./shaders/coloradjust.essl') );
    Shader.import( require('./shaders/blur.essl') );
    Shader.import( require('./shaders/grayscale.essl') );
    Shader.import( require('./shaders/lut.essl') );
    Shader.import( require('./shaders/output.essl') );

    return Pass;
} );
/**
 * @export{class} FrameBuffer
 */
define('3d/framebuffer',['require','core/base','./texture/texture2d','./texture/texturecube','./webglinfo'], function(require) {
    
    var Base = require("core/base");
    var Texture2D = require("./texture/texture2d");
    var TextureCube = require("./texture/texturecube");
    var WebGLInfo = require('./webglinfo');

    var FrameBuffer = Base.derive( function(){

        return {
            depthBuffer : true,

            //Save attached texture and target
            _attachedTextures : {}
        }
    }, {

        bind : function( renderer ){

            var _gl = renderer.gl;

            _gl.bindFramebuffer( _gl.FRAMEBUFFER, this.getFrameBuffer( _gl ) );

            this.cache.put( "viewport", renderer.viewportInfo );
            renderer.setViewport( 0, 0, this.cache.get('width'), this.cache.get('height') );

            // Create a new render buffer
            if( this.cache.miss("renderbuffer") && this.depthBuffer && ! this.cache.get("depth_texture") ){
                this.cache.put( "renderbuffer", _gl.createRenderbuffer() );
            }

            if( ! this.cache.get("depth_texture") && this.depthBuffer ){

                var width = this.cache.get("width"),
                    height = this.cache.get("height"),
                    renderbuffer = this.cache.get('renderbuffer');

                if( width !== this.cache.get("renderbuffer_width")
                     || height !== this.cache.get("renderbuffer_height") ){

                    _gl.bindRenderbuffer( _gl.RENDERBUFFER, renderbuffer );
                    
                    _gl.renderbufferStorage(_gl.RENDERBUFFER, _gl.DEPTH_COMPONENT16, width, height );
                    this.cache.put("renderbuffer_width", width);
                    this.cache.put("renderbuffer_height", height);

                    _gl.bindRenderbuffer( _gl.RENDERBUFFER, null );                 
                }
                if( ! this.cache.get("renderbuffer_attached") ){
                    
                    _gl.framebufferRenderbuffer( _gl.FRAMEBUFFER, _gl.DEPTH_ATTACHMENT, _gl.RENDERBUFFER, renderbuffer );
                    this.cache.put( "renderbuffer_attached", true );

                }
            }
            
        },

        unbind : function( renderer ){
            var _gl = renderer.gl;
            
            _gl.bindFramebuffer( _gl.FRAMEBUFFER, null );

            this.cache.use( _gl.__GUID__ );
            var viewportInfo = this.cache.get("viewport");
            // Reset viewport;
            if( viewportInfo ){
                renderer.setViewport( viewportInfo.x, viewportInfo.y, viewportInfo.width, viewportInfo.height );
            }

            // Because the data of texture is changed over time,
            // Here update the mipmaps of texture each time after rendered;
            for( var attachment in this._attachedTextures ){
                var texture = this._attachedTextures[attachment];
                if( ! texture.NPOT && texture.generateMipmaps ){
                    var target = texture.instanceof(TextureCube) ? _gl.TEXTURE_CUBE_MAP : _gl.TEXTURE_2D;
                    _gl.bindTexture( target, texture.getWebGLTexture( _gl ) );
                    _gl.generateMipmap( target );
                    _gl.bindTexture( target, null );
                }
            }
        },

        getFrameBuffer : function( _gl ){

            this.cache.use( _gl.__GUID__ );

            if( this.cache.miss("framebuffer") ){
                this.cache.put( "framebuffer", _gl.createFramebuffer() );
            }

            return this.cache.get("framebuffer");
        },

        attach : function( _gl, texture, attachment, target ){

            if( ! texture.width ){
                console.error("The texture attached to color buffer is not a valid.");
                return;
            }
            if( this._renderBuffer && this.depthBuffer && ( this._width !== texture.width || this.height !== texture.height) ){
                console.warn( "Attached texture has different width or height, it will cause the render buffer recreate a storage ");
            }

            _gl.bindFramebuffer( _gl.FRAMEBUFFER, this.getFrameBuffer( _gl ) );

            this.cache.put("width", texture.width);
            this.cache.put("height", texture.height);

            target = target || _gl.TEXTURE_2D;

            // If the depth_texture extension is enabled, developers
            // Can attach a depth texture to the depth buffer
            // http://blog.tojicode.com/2012/07/using-webgldepthtexture.html
            attachment = attachment || _gl.COLOR_ATTACHMENT0;
            
            if( attachment === 'DEPTH_ATTACHMENT' ){

                var extension = WebGLInfo.getExtension("WEBGL_depth_texture");

                if( !extension ){
                    console.error( " Depth texture is not supported by the browser ");
                    return;
                }
                if( texture.format !== "DEPTH_COMPONENT" ){
                    console.error("The texture attached to depth buffer is not a valid.");
                    return;
                }
                this.cache.put("renderbuffer_attached", false);
                this.cache.put("depth_texture", true);
            }

            this._attachedTextures[ attachment ] = texture;

            _gl.framebufferTexture2D( _gl.FRAMEBUFFER, attachment, target, texture.getWebGLTexture( _gl ), 0)

            _gl.bindFramebuffer( _gl.FRAMEBUFFER, null);
        },

        detach : function(){},

        dispose : function( _gl ){

            this.cache.use( _gl.__GUID__ );

            if( this.cache.get("renderbuffer") )
                _gl.deleteRenderbuffer( this.cache.get("renderbuffer") );
            if( this.cache.get("framebuffer") )
                _gl.deleteFramebuffer( this.cache.get("framebuffer") );

            this.cache.clearContext();

        }
    } )

    return FrameBuffer;
} );
/**
 * @export{class} TexturePool
 */
define('3d/compositor/graph/texturepool',['require','../../texture/texture2d','_'], function(require){
    
    var Texture2D = require("../../texture/texture2d");
    var _ = require("_");

    var pool = {};

    var texturePool = {

        get : function( parameters ){
            var key = generateKey( parameters );
            if( ! pool.hasOwnProperty( key ) ){
                pool[key] = [];
            }
            var list = pool[key];
            if( ! list.length ){
                var texture = new Texture2D( parameters );
                return texture;
            }
            return list.pop();
        },

        put : function( texture ){
            var key = generateKey( texture );
            if( ! pool.hasOwnProperty( key ) ){
                pool[key] = [];
            }
            var list = pool[key];
            list.push( texture );
        },

        clear : function(){
            for(name in pool){
                for(var i = 0; i < pool[name].length; i++){
                    pool[name][i].dispose();
                }
            }
            pool = {};
        }
    }

    function generateKey( parameters ){
        var defaultParams = {
            width : 512,
            height : 512,
            type : 'UNSIGNED_BYTE',
            format : "RGBA",
            wrapS : "CLAMP_TO_EDGE",
            wrapT : "CLAMP_TO_EDGE",
            minFilter : "LINEAR_MIPMAP_LINEAR",
            magFilter : "LINEAR",
            generateMipmaps : true,
            anisotropy : 1,
            flipY : true,
            unpackAlignment : 4,
            premultiplyAlpha : false
        }

        _.defaults(parameters, defaultParams);
        fallBack(parameters);

        var key = "";
        for(var name in defaultParams) {
            if( parameters[name] ){
                var chunk = parameters[name].toString();
            }else{
                var chunk = defaultParams[name].toString();
            }
            key += chunk;
        }
        return key;
    }

    function fallBack(target){

        var IPOT = isPowerOfTwo(target.width, target.height);

        if( target.format === "DEPTH_COMPONENT"){
            target.generateMipmaps = false;
        }

        if( ! IPOT || ! target.generateMipmaps){
            if( target.minFilter.indexOf("NEAREST") == 0){
                target.minFilter = 'NEAREST';
            }else{
                target.minFilter = 'LINEAR'
            }

            if( target.magFilter.indexOf("NEAREST") == 0){
                target.magFilter = 'NEAREST';
            }else{
                target.magFilter = 'LINEAR'
            }
            target.wrapS = 'CLAMP_TO_EDGE';
            target.wrapT = 'CLAMP_TO_EDGE';
        }
    }

    function isPowerOfTwo(width, height){
        return ( width & (width-1) ) === 0 &&
                ( height & (height-1) ) === 0;
    }

    return texturePool
} );
/**
 * Example
 * {
 *  name : "xxx",
    shader : shader,
 *  inputs :{ 
        "texture" : {
            node : "xxx",
            pin : "diffuse"
        }
    },
    // Optional, only use for the node in group
    groupInputs : {
        // Group input pin name : node input pin name
        "texture" : "texture"
    },
    outputs : {
            diffuse : {
                attachment : "COLOR_ATTACHMENT0"
                parameters : {
                    format : "RGBA",
                    width : 512,
                    height : 512
                }
            }
        }
    },
    // Optional, only use for the node in group
    groupOutputs : {
        // Node output pin name : group output pin name
        "diffuse" : "diffuse"
    }
 * Multiple outputs is reserved for MRT support
 *
 * TODO blending 
 */
define('3d/compositor/graph/node',['require','core/base','../pass','../../framebuffer','../../shader','./texturepool'], function( require ){

    var Base = require("core/base");
    var Pass = require("../pass");
    var FrameBuffer = require("../../framebuffer");
    var Shader = require("../../shader");
    var texturePool = require("./texturepool");

    var Node = Base.derive( function(){
        return {

            name : "",

            inputs : {},
            
            outputs : null,

            shader : '',
            // Example:
            // inputName : {
            //  node : [Node],
            //  pin : 'xxxx'    
            // }
            inputLinks : {},
            // Example:
            // outputName : [{
            //  node : [Node],
            //  pin : 'xxxx'    
            // }]
            outputLinks : {},

            _textures : {},

            pass : null,

            //{
            //  name : 2
            //}
            _outputReferences : {}
        }
    }, function(){
        if( this.shader ){
            var pass = new Pass({
                fragment : this.shader
            });
            this.pass = pass;   
        }
        if(this.outputs){
            this.frameBuffer = new FrameBuffer({
                depthBuffer : false
            })
        }
    }, {

        render : function( renderer ){
            var _gl = renderer.gl;
            for( var inputName in this.inputLinks ){
                var link = this.inputLinks[inputName];
                var inputTexture = link.node.getOutput( renderer, link.pin );
                this.pass.setUniform( inputName, inputTexture );
            }
            // Output
            if( ! this.outputs){
                this.pass.outputs = null;
                this.pass.render( renderer );
            }
            else{
                this.pass.outputs = {};

                for( var name in this.outputs){

                    var outputInfo = this.outputs[name];

                    var texture = texturePool.get( outputInfo.parameters || {} );
                    this._textures[name] = texture;

                    var attachment = outputInfo.attachment || _gl.COLOR_ATTACHMENT0;
                    if(typeof(attachment) == "string"){
                        attachment = _gl[attachment];
                    }
                    this.pass.outputs[ attachment ] = texture;
                }

                this.pass.render( renderer, this.frameBuffer );
            }
            
            for( var inputName in this.inputLinks ){
                var link = this.inputLinks[inputName];
                link.node.removeReference( link.pin );
            }
        },

        setParameter : function( name, value ){
            this.pass.setUniform( name, value );
        },

        setParameters : function(obj){
            for(var name in obj){
                this.setParameter(name, obj[name]);
            }
        },

        getOutput : function( renderer, name ){
            var outputInfo = this.outputs[name];
            if( ! outputInfo){
                return ;
            }
            if( this._textures[name] ){
                // Already been rendered in this frame
                return this._textures[name];
            }

            this.render( renderer );
            
            return this._textures[name];
        },

        removeReference : function( name ){
            this._outputReferences[name]--;
            if( this._outputReferences[name] === 0){
                // Output of this node have alreay been used by all other nodes
                // Put the texture back to the pool.
                texturePool.put(this._textures[name]);
                this._textures[name] = null;
            }
        },

        link : function( inputPinName, fromNode, fromPinName){

            // The relationship from output pin to input pin is one-on-multiple
            this.inputLinks[ inputPinName ] = {
                node : fromNode,
                pin : fromPinName
            }
            if( ! fromNode.outputLinks[ fromPinName ] ){
                fromNode.outputLinks[ fromPinName ] = [];
            }
            fromNode.outputLinks[ fromPinName ].push( {
                node : this,
                pin : inputPinName
            } )
        },

        clear : function(){
            this.inputLinks = {};
            this.outputLinks = {};
        },

        updateReference : function( ){
            for( var name in this.outputLinks ){
                this._outputReferences[ name ] = this.outputLinks[name].length;
            }
        }
    })

    return Node;
});
/**
 * Node Group
 */
define('3d/compositor/graph/group',['require','./node','./graph'],function(require){

    var Node = require("./node");
    var Graph = require("./graph");

    var Group = Node.derive(function(){
        return {
            nodes : [],

            _textures : {}
        }
    }, {
        add : function(node){
            return Graph.prototype.add.call(this, node);
        },

        remove : function(node){
            return Graph.prototype.remove.call(this, node);
        },

        update : function(){
            return Graph.prototype.update.call(this);
        },

        findPin : function(info){
            return Graph.prototype.findPin.call(this, info);
        },

        render : function(renderer){
            if(this.isDirty("graph")){
                this.update();
                this.fresh("graph");
            }
            
            var groupInputTextures = {};

            for(var inputName in this.inputLinks){
                var link = this.inputLinks[inputName];
                var inputTexture = link.node.getOutput(renderer, link.pin);
                groupInputTextures[inputName] = inputTexture;
            }

            for(var i = 0; i < this.nodes.length; i++){
                var node = this.nodes[i];
                // Update the reference number of each output texture
                node.updateReference();
                // Set the input texture to portal node of group
                if(node.groupInputs){
                    this._updateGroupInputs(node, groupInputTextures);
                }
            }
            for(var i = 0; i < this.nodes.length; i++){
                var node = this.nodes[i];
                if(node.groupOutputs){
                    this._updateGroupOutputs(node, renderer);
                }
                // Direct output
                if( ! node.outputs){
                    node.render(renderer);
                }
            }
            for(var name in this.groupOutputs){
                if( ! this._textures[name]){
                    console.error('Group output pin "' + name + '" is not attached');
                }
            }

            for( var inputName in this.inputLinks ){
                var link = this.inputLinks[inputName];
                link.node.removeReference( link.pin );
            }
        },

        _updateGroupInputs : function(node, groupInputTextures){
            for(var name in groupInputTextures){
                var texture = groupInputTextures[name];
                if(node.groupInputs[name]){
                    var pin  = node.groupInputs[name];
                    node.pass.setUniform(pin, texture);
                }
            }
        },

        _updateGroupOutputs : function(node, renderer){
            for(var name in node.groupOutputs){
                var groupOutputPinName = node.groupOutputs[name];
                var texture = node.getOutput(renderer, name);
                this._textures[groupOutputPinName] = texture;
            }
        }
    });

    return Group;
});
/**
 * @export{class} SceneNode
 */
define('3d/compositor/graph/scenenode',['require','./node','../pass','../../framebuffer','./texturepool','../../webglinfo'], function( require ){

    var Node = require("./node");
    var Pass = require("../pass");
    var FrameBuffer = require("../../framebuffer");
    var texturePool = require("./texturepool");
    var WebGLInfo = require('../../webglinfo');

    var SceneNode = Node.derive( function(){
        return {
            scene : null,
            camera : null,
            material : null
        }
    }, function(){
        if(this.frameBuffer){
            this.frameBuffer.depthBuffer = true;
        }
    }, {
        render : function( renderer ){
            
            var _gl = renderer.gl;

            if( ! this.outputs){
                renderer.render( this.scene, this.camera );
            }else{
                
                var frameBuffer = this.frameBuffer;

                for( var name in this.outputs){
                    var outputInfo = this.outputs[name];
                    var texture = texturePool.get( outputInfo.parameters || {} );
                    this._textures[name] = texture;

                    var attachment = outputInfo.attachment || _gl.COLOR_ATTACHMENT0;
                    if(typeof(attachment) == "string"){
                        attachment = _gl[attachment];
                    }
                    frameBuffer.attach( renderer.gl, texture, attachment);
                }
                frameBuffer.bind( renderer );

                // MRT Support in chrome
                // https://www.khronos.org/registry/webgl/sdk/tests/conformance/extensions/ext-draw-buffers.html
                var ext = WebGLInfo.getExtension("EXT_draw_buffers");
                if(ext){
                    var bufs = [];
                    for( var attachment in this.outputs){
                        attachment = parseInt(attachment);
                        if(attachment >= _gl.COLOR_ATTACHMENT0 && attachment <= _gl.COLOR_ATTACHMENT0 + 8){
                            bufs.push(attachment);
                        }
                    }
                    ext.drawBuffersEXT(bufs);
                }

                if( this.material ){
                    this.scene.material = this.material;
                }
                renderer.render( this.scene, this.camera );
                this.scene.material = null;

                frameBuffer.unbind( renderer );
            }
        }
    })

    return SceneNode;
} );
/**
 * @export{class} TextureNode
 */
define('3d/compositor/graph/texturenode',['require','./node','../../framebuffer','./texturepool','../../shader'], function( require ){

    var Node = require("./node");
    var FrameBuffer = require("../../framebuffer");
    var texturePool = require("./texturepool");
    var Shader = require("../../shader");

    var TextureNode = Node.derive( function(){
        return {
            
            shader : Shader.source("buildin.compositor.output"),

            texture : null
        }
    }, {
        render : function( renderer ){
            var _gl = renderer.gl;
            this.pass.setUniform("texture", this.texture);
            
            if( ! this.outputs){
                this.pass.outputs = null;
                this.pass.render( renderer );
            }else{
                
                this.pass.outputs = {};

                for( var name in this.outputs){

                    var outputInfo = this.outputs[name];

                    var texture = texturePool.get( outputInfo.parameters || {} );
                    this._textures[name] = texture;

                    var attachment = outputInfo.attachment || _gl.COLOR_ATTACHMENT0;
                    if(typeof(attachment) == "string"){
                        attachment = _gl[attachment];
                    }
                    this.pass.outputs[ attachment ] = texture;

                }

                this.pass.render( renderer, this.frameBuffer );
            }
        }
    })

    return TextureNode;
} );
;
define("3d/debug/pointlight", function(){});

/**
 * @export{class} RenderInfo
 */
define('3d/debug/renderinfo',['require','core/base'], function(require){

    var Base = require("core/base");

    var RenderInfo = Base.derive( function(){
        return {
            renderer : null,

            frameTime : 0,

            vertexNumber : 0,

            faceNumber : 0,

            drawcallNumber : 0,

            meshNumber : 0,

            _startTime : 0
        }
    }, {
        enable : function(){
            this.renderer.on("beforerender", this._beforeRender, this);
            this.renderer.on("afterrender", this._afterRender, this);
            this.renderer.on("afterrender:mesh", this._afterRenderMesh, this);
        },
        disable : function(){
            this.renderer.off("beforerender", this._beforeRender);
            this.renderer.off("afterrender", this._afterRender);
            this.renderer.off("afterrender:mesh", this._afterRenderMesh);
        },
        clear : function(){
            this.vertexNumber = 0;
            this.faceNumber = 0;
            this.drawcallNumber = 0;
            this.meshNumber = 0;
            this.frameTime = 0;
        },
        _beforeRender : function(){
            this.clear();

            this._startTime = new Date().getTime();
        },

        _afterRender : function(){
            var endTime = new Date().getTime();

            this.frameTime = endTime - this._startTime;
        },

        _afterRenderMesh : function(_gl, drawInfo){
            this.vertexNumber += drawInfo.vertexNumber;
            this.faceNumber += drawInfo.faceNumber;
            this.drawcallNumber += drawInfo.drawcallNumber;
            this.meshNumber ++;
        }
    })

    return RenderInfo;
} );

define('3d/geometry/cube',['require','../geometry','./plane','core/matrix4','core/vector3','_'], function(require){

    var Geometry = require('../geometry');
    var Plane = require('./plane');
    var Matrix4 = require('core/matrix4');
    var Vector3 = require('core/vector3');
    var _ = require('_');

    var planeMatrix = new Matrix4();
    
    var Cube = Geometry.derive( function(){

        return {
            widthSegments : 1,
            heightSegments : 1,
            depthSegments : 1,
            // TODO double side material
            inside : false
        }
    }, function(){
        var planes = {
            "px" : createPlane("px", this.depthSegments, this.heightSegments),
            "nx" : createPlane("nx", this.depthSegments, this.heightSegments),
            "py" : createPlane("py", this.widthSegments, this.depthSegments),
            "ny" : createPlane("ny", this.widthSegments, this.depthSegments),
            "pz" : createPlane("pz", this.widthSegments, this.heightSegments),
            "nz" : createPlane("nz", this.widthSegments, this.heightSegments),
        };
        var cursor = 0;
        for( var pos in planes ){
            _.each(['position', 'texcoord0', 'normal'], function(attrName){
                var attrArray = planes[pos].attributes[attrName].value;
                for(var i = 0; i < attrArray.length; i++ ){
                    var value = attrArray[i];
                    if(this.inside && attrName === "normal"){
                        value[0] = -value[0];
                        value[1] = -value[1];
                        value[2] = -value[2];
                    }
                    this.attributes[attrName].value.push( value );
                }
                var plane = planes[pos];
                for(var i = 0; i < plane.faces.length; i++){
                    var face = plane.faces[i];
                    this.faces.push( [ face[0]+cursor, face[1]+cursor, face[2]+cursor ] );
                }
            }, this)
            cursor += planes[pos].getVerticesNumber();
        }
    })

    function createPlane( pos, widthSegments, heightSegments ){

        planeMatrix.identity();

        var plane = new Plane({
            widthSegments : widthSegments,
            heightSegments : heightSegments
        })

        switch( pos ){
            case "px":
                planeMatrix.translate(new Vector3(1, 0, 0) );
                planeMatrix.rotateY( Math.PI/2 );
                break;
            case "nx":
                planeMatrix.translate(new Vector3(-1, 0, 0) );
                planeMatrix.rotateY( -Math.PI/2 );
                break;
            case "py":
                planeMatrix.translate(new Vector3(0, 1, 0) );
                planeMatrix.rotateX( -Math.PI/2 );
                break;
            case "ny":
                planeMatrix.translate(new Vector3(0, -1, 0) );
                planeMatrix.rotateX( Math.PI/2 );
                break;
            case "pz":
                planeMatrix.translate(new Vector3(0, 0, 1) );
                break;
            case "nz":
                planeMatrix.translate(new Vector3(0, 0, -1) );
                planeMatrix.rotateY( Math.PI );
                break;
        }
        plane.applyMatrix( planeMatrix );
        return plane;
    }

    return Cube;
} );
define('3d/geometry/sphere',['require','../geometry','glmatrix'], function(require){

	var Geometry = require('../geometry');
    var glMatrix = require('glmatrix');
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;

	// From three.js SphereGeometry
	var Sphere = Geometry.derive( function(){

		return {
            widthSegments : 20,
            heightSegments : 20,

            phiStart : 0,
            phiLength : Math.PI * 2,

            thetaStart : 0,
            thetaLength : Math.PI,

            radius : 1
		}
	}, function(){
        
        var positions = this.attributes.position.value;
        var texcoords = this.attributes.texcoord0.value;
        var normals = this.attributes.normal.value;

        var x, y, z,
            u, v,
            i, j;
        var normal;

        var heightSegments = this.heightSegments,
            widthSegments = this.widthSegments,
            radius = this.radius,
            phiStart = this.phiStart,
            phiLength = this.phiLength,
            thetaStart = this.thetaStart,
            thetaLength = this.thetaLength,
            radius = this.radius;


        for ( j = 0; j <= heightSegments; j ++ ) {

            for ( i = 0; i <= widthSegments; i ++ ) {

                u = i / widthSegments;
                v = j / heightSegments;

                x = - radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
                y = radius * Math.cos(thetaStart + v * thetaLength);
                z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);

                positions.push( vec3.fromValues(x, y, z) );
                texcoords.push( vec2.fromValues(u, v) );

                normal = vec3.fromValues(x, y, z);
                normals.push( vec3.normalize(normal, normal) );

            }

        }

        var p1, p2, p3,
            i1, i2, i3, i4;
        var faces = this.faces;

        var len = widthSegments+1;

        for ( j = 0; j < heightSegments; j ++ ) {

            for ( i = 0; i < widthSegments; i ++ ) {

                i1 = j * len + i;
                i2 = j * len + i + 1;
                i3 = (j + 1) * len + i + 1;
                i4 = (j + 1) * len + i;

                faces.push( vec3.fromValues(i1, i2, i3) );
                faces.push( vec3.fromValues(i3, i4, i1) );
            }
        }
	})

    return Sphere;
} );
define('3d/light',['require','./node'], function(require){

    var Node = require("./node");

    var Light = Node.derive( function(){
        return {
            color : [1, 1, 1],
            intensity : 1.0,
            
            // Config for shadow map
            castShadow : true,
            shadowResolution : 512
        }
    }, {
    } );

    return Light;
} );
define('3d/light/ambient',['require','../light','../shader'], function(require){

    var Light = require('../light'),
        Shader = require('../shader');

    var SHADER_STR = [ '@export buildin.header.ambient_light',
                        'uniform vec3 ambientLightColor[ AMBIENT_LIGHT_NUMBER ] : unconfigurable;',
                        '@end;' ].join('\n');

    Shader.import(SHADER_STR);

    var AmbientLight = Light.derive(function(){
        return {
            castShadow : false
        }
    }, {

        type : 'AMBIENT_LIGHT',

        uniformTemplates : {
            'ambientLightColor' : {
                type : '3f',
                value : function( instance ){
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return AmbientLight;
} );
define('3d/light/directional',['require','../light','../shader','core/vector3'], function(require){

    var Light = require('../light');
    var Shader = require('../shader');
    var Vector3 = require('core/vector3');

    var SHADER_STR = [ '@export buildin.header.directional_light',
                        'uniform vec3 directionalLightDirection[ DIRECTIONAL_LIGHT_NUMBER ] : unconfigurable;',
                        'uniform vec3 directionalLightColor[ DIRECTIONAL_LIGHT_NUMBER ] : unconfigurable;',
                        '@end;' ].join('\n');

    Shader.import(SHADER_STR);

    var DirectionalLight = Light.derive( function(){

        return {
            // Config of orthographic camera for shadow mapping generate
            shadowCamera : {
                left : -20,
                right : 20,
                top : 20,
                bottom : -20,
                near : 0,
                far : 100
            }
        }
    }, {

        type : 'DIRECTIONAL_LIGHT',

        uniformTemplates : {
            'directionalLightDirection' : {
                type : '3f',
                value : ( function(){
                    var z = new Vector3();
                    return function( instance ){
                        // Direction is target to eye
                        return z.copy(instance.matrix.forward).negate()._array;
                    }
                })()
            },
            'directionalLightColor' : {
                type : '3f',
                value : function( instance ){
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return DirectionalLight;
} );
define('3d/light/point',['require','../light','../shader'], function(require){

    var Light = require('../light'),
        Shader = require('../shader');

    var SHADER_STR = [ '@export buildin.header.point_light',
                        
                        'uniform vec3 pointLightPosition[ POINT_LIGHT_NUMBER ] : unconfigurable;',
                        'uniform float pointLightRange[ POINT_LIGHT_NUMBER ] : unconfigurable;',
                        'uniform vec3 pointLightColor[ POINT_LIGHT_NUMBER ] : unconfigurable;',
                        '@end;' ].join('\n');

    Shader.import(SHADER_STR);

    var PointLight = Light.derive(function(){

        return {
            range : 100,

            castShadow : false,
        }
    }, {

        type : 'POINT_LIGHT',

        uniformTemplates : {
            'pointLightPosition' : {
                type : '3f',
                value : function( instance ){
                    return instance.getWorldPosition()._array;
                }
            },
            'pointLightRange' : {
                type : '1f',
                value : function( instance ){
                    return instance.range;
                }
            },
            'pointLightColor' : {
                type : '3f',
                value : function( instance ){
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return PointLight;
} );
define('3d/light/spot',['require','../light','../shader','core/vector3'], function(require){

    var Light = require('../light');
    var Shader = require('../shader');
    var Vector3 = require('core/vector3');

    var SHADER_STR = [ '@export buildin.header.spot_light',
                        'uniform vec3 spotLightPosition[SPOT_LIGHT_NUMBER] : unconfigurable;',
                        'uniform vec3 spotLightDirection[SPOT_LIGHT_NUMBER] : unconfigurable;',
                        'uniform float spotLightRange[SPOT_LIGHT_NUMBER] : unconfigurable;',
                        'uniform float spotLightUmbraAngleCosine[SPOT_LIGHT_NUMBER] : unconfigurable;',
                        'uniform float spotLightPenumbraAngleCosine[SPOT_LIGHT_NUMBER] : unconfigurable;',
                        'uniform float spotLightFalloffFactor[SPOT_LIGHT_NUMBER] : unconfigurable;',
                        'uniform vec3 spotLightColor[SPOT_LIGHT_NUMBER] : unconfigurable;',
                        '@end;' ].join('\n');

    Shader.import(SHADER_STR);

    var SpotLight = Light.derive(function() {

        return {
            range : 20,
            umbraAngle : 30,
            penumbraAngle : 45,
            falloffFactor : 2.0
        }
    },{

        type : 'SPOT_LIGHT',

        uniformTemplates : {
            'spotLightPosition' : {
                type : '3f',
                value : function( instance ){
                    return instance.getWorldPosition()._array;
                }
            },
            'spotLightRange' : {
                type : '1f',
                value : function( instance ){
                    return instance.range;
                }
            },
            'spotLightUmbraAngleCosine' : {
                type : '1f',
                value : function( instance ){
                    return Math.cos(instance.umbraAngle * Math.PI / 180);
                }
            },
            'spotLightPenumbraAngleCosine' : {
                type : '1f',
                value : function( instance ){
                    return Math.cos(instance.penumbraAngle * Math.PI / 180);
                }
            },
            'spotLightFalloffFactor' : {
                type : '1f',
                value : function( instance ){
                    return instance.falloffFactor
                }
            },
            'spotLightDirection' : {
                type : '3f',
                value : ( function(){
                    var z = new Vector3();
                    return function( instance ){
                        // Direction is target to eye
                        return z.copy(instance.matrix.forward).negate()._array;
                    }
                })()
            },
            'spotLightColor' : {
                type : '3f',
                value : function( instance ){
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return SpotLight;
} );
/**
 * @export{class} FirstPersonControl
 */
define('3d/plugin/firstpersoncontrol',['require','core/base','core/vector3','core/matrix4','core/quaternion'], function(require){

    var Base = require("core/base");
    var Vector3 = require("core/vector3");
    var Matrix4 = require("core/matrix4");
    var Quaternion = require("core/quaternion");

    var upVector = new Vector3(0, 1, 0);

    var FirstPersonControl = Base.derive(function(){
        return {
            camera : null,
            canvas : null,

            sensitivity : 1,
            speed : 0.4,

            _moveForward : false,
            _moveBackward : false,
            _moveLeft : false,
            _moveRight : false,

            _offsetPitch : 0,
            _offsetRoll : 0
        }
    }, {
        enable : function(){
            this.camera.on("beforeupdate", this._beforeUpdateCamera, this);

            this.camera.eulerOrder = ["Y", "X", "Z"];
            // Use pointer lock
            // http://www.html5rocks.com/en/tutorials/pointerlock/intro/
            var el = this.canvas;

            //Must request pointer lock after click event, can't not do it directly
            //Why ? ?
            el.addEventListener("click", this.requestPointerLock);

            document.addEventListener("pointerlockchange", bindOnce(this._lockChange, this), false);
            document.addEventListener("mozpointerlockchange", bindOnce(this._lockChange, this), false);
            document.addEventListener("webkitpointerlockchange", bindOnce(this._lockChange, this), false);

            document.addEventListener("keydown", bindOnce(this._keyDown, this), false);
            document.addEventListener("keyup", bindOnce(this._keyUp, this), false);
        },

        disable : function(){

            this.camera.off('beforeupdate', this._beforeUpdateCamera);

            var el = this.canvas;

            el.exitPointerLock = el.exitPointerLock ||
                                    el.mozExitPointerLock ||
                                    el.webkitExitPointerLock

            if( el.exitPointerLock ){
                el.exitPointerLock();
            }
            document.removeEventListener("pointerlockchange", bindOnce( this._lockChange, this ));
            document.removeEventListener("mozpointerlockchange", bindOnce( this._lockChange, this ));
            document.removeEventListener("webkitpointerlockchange", bindOnce( this._lockChange, this ));
        
        },

        requestPointerLock : function(){
            var el = this;
            el.requestPointerLock = el.requestPointerLock ||
                                    el.mozRequestPointerLock ||
                                    el.webkitRequestPointerLock;

            el.requestPointerLock();
        },

        _beforeUpdateCamera : (function(){

            var rotateQuat = new Quaternion();
            
            return function(){
                
                var camera = this.camera;

                var position = this.camera.position,
                    xAxis = camera.matrix.right.normalize(),
                    zAxis = camera.matrix.forward.normalize();

                if( this._moveForward){
                    // Opposite direction of z
                    position.scaleAndAdd(zAxis, -this.speed);
                }
                if( this._moveBackward){
                    position.scaleAndAdd(zAxis, this.speed);
                }
                if( this._moveLeft){
                    position.scaleAndAdd(xAxis, -this.speed/2);
                }
                if( this._moveRight){
                    position.scaleAndAdd(xAxis, this.speed/2);
                }


                camera.rotateAround(camera.position, upVector, -this._offsetPitch * Math.PI / 180);
                var xAxis = camera.matrix.right;
                camera.rotateAround(camera.position, xAxis, -this._offsetRoll * Math.PI / 180);

                this._offsetRoll = this._offsetPitch = 0;
            }

        })(),

        _lockChange : function(){
            if( document.pointerlockElement === this.canvas ||
                document.mozPointerlockElement === this.canvas ||
                document.webkitPointerLockElement === this.canvas){

                document.addEventListener('mousemove', bindOnce(this._mouseMove, this), false);
            }else{
                document.removeEventListener('mousemove', bindOnce(this._mouseMove, this), false);
            }
        },

        _mouseMove : function(e){
            var dx = e.movementX || 
                    e.mozMovementX ||
                    e.webkitMovementX || 0;
            var dy = e.movementY ||
                    e.mozMovementY ||
                    e.webkitMovementY || 0;

            this._offsetPitch += dx * this.sensitivity / 10;
            this._offsetRoll += dy * this.sensitivity / 10;
            
        },

        _keyDown : function(e){
            switch( e.keyCode){
                case 87: //w
                case 37: //up arrow
                    this._moveForward = true;
                    break;
                case 83: //s
                case 40: //down arrow
                    this._moveBackward = true;
                    break;
                case 65: //a
                case 37: //left arrow
                    this._moveLeft = true;
                    break;
                case 68: //d
                case 39: //right arrow
                    this._moveRight = true;
                    break; 
            }
        },

        _keyUp : function(e){
            switch( e.keyCode){
                case 87: //w
                case 37: //up arrow
                    this._moveForward = false;
                    break;
                case 83: //s
                case 40: //down arrow
                    this._moveBackward = false;
                    break;
                case 65: //a
                case 37: //left arrow
                    this._moveLeft = false;
                    break;
                case 68: //d
                case 39: //right arrow
                    this._moveRight = false;
                    break; 
            }
        }
    })

    function bindOnce( func, context){
        if( ! func.__bindfuc__){
            func.__bindfuc__ = function(){
                return func.apply(context, arguments); 
            }
        }
        return func.__bindfuc__;
    }

    return FirstPersonControl;
} );
/**
 * @export{class} OrbitControl
 */
define('3d/plugin/orbitcontrol',['require','core/base','core/vector3','core/matrix4','core/quaternion'], function(require){

    var Base = require("core/base");
    var Vector3 = require("core/vector3");
    var Matrix4 = require("core/matrix4");
    var Quaternion = require("core/quaternion");

    var upVector = new Vector3(0, 1, 0);

    var OrbitControl = Base.derive(function(){
        return {
            
            camera : null,
            canvas : null,

            sensitivity : 1,

            origin : new Vector3(),

            // Rotate around origin
            _offsetPitch : 0,
            _offsetRoll : 0,

            // Pan the origin
            _panX : 0,
            _panY : 0,

            // Offset of mouse move
            _offsetX : 0,
            _offsetY : 0,

            // Zoom with mouse wheel
            _forward : 0,

            _op : 0  //0 : ROTATE, 1 : PAN
        }
    }, {

        enable : function(){

            this.camera.on("beforeupdate", this._beforeUpdateCamera, this);

            this.canvas.addEventListener("mousedown", bindOnce(this._mouseDown, this), false);
            this.canvas.addEventListener("mousewheel", bindOnce(this._mouseWheel, this), false);
            this.canvas.addEventListener("DOMMouseScroll", bindOnce(this._mouseWheel, this), false);
        },

        disable : function(){
            this.camera.off("beforeupdate", this._beforeUpdateCamera);
            this.canvas.removeEventListener("mousedown", bindOnce(this._mouseDown, this));
            this.canvas.removeEventListener("mousewheel", bindOnce(this._mouseWheel, this));
            this.canvas.removeEventListener("DOMMouseScroll", bindOnce(this._mouseWheel, this));
            this._mouseUp();
        },

        _mouseWheel : function(e){
            var delta = e.wheelDelta // Webkit 
                        || -e.detail; // Firefox

            this._forward += delta * this.sensitivity;
        },

        _mouseDown : function(e){
            document.addEventListener("mousemove", bindOnce(this._mouseMove, this), false);
            document.addEventListener("mouseup", bindOnce(this._mouseUp, this), false);
            document.addEventListener("mouseout", bindOnce(this._mouseOut, this), false);

            this._offsetX = e.pageX;
            this._offsetY = e.pageY;

            // Rotate
            if( e.button === 0){
                this._op = 0;
            }else if( e.button === 1){
                this._op = 1;
            }
        },

        _mouseMove : function(e){
            var dx = e.pageX - this._offsetX,
                dy = e.pageY - this._offsetY;

            if(this._op === 0){
                this._offsetPitch += dx * this.sensitivity / 100;
                this._offsetRoll += dy * this.sensitivity / 100;
            }else if(this._op === 1){
                // TODO Auto fit the size of scene
                this._panX += dx * this.sensitivity / 20;
                this._panY += dy * this.sensitivity / 20;
            }

            this._offsetX = e.pageX;
            this._offsetY = e.pageY;
        },

        _mouseUp : function(){

            document.removeEventListener("mousemove", bindOnce(this._mouseMove, this));
            document.removeEventListener("mouseup", bindOnce(this._mouseUp, this));
            document.removeEventListener("mouseout", bindOnce(this._mouseOut, this));
        },

        _mouseOut : function(){
            this._mouseUp();
        },

        _beforeUpdateCamera : function(){

            var camera = this.camera;

            if( this._op === 0){
                // Rotate
                camera.rotateAround(this.origin, upVector, -this._offsetPitch);            
                var xAxis = camera.matrix.right;
                camera.rotateAround(this.origin, xAxis, -this._offsetRoll);
                this._offsetRoll = this._offsetPitch = 0;
            }
            else if( this._op === 1){
                // Pan
                var xAxis = camera.matrix.right.normalize().scale(-this._panX);
                var yAxis = camera.matrix.up.normalize().scale(this._panY);
                camera.position.add(xAxis).add(yAxis);
                this.origin.add(xAxis).add(yAxis);
                this._panX = this._panY = 0;
            }
            
            // Zoom
            var zAxis = camera.matrix.forward.normalize();
            var distance = camera.position.distance(this.origin);
            camera.position.scaleAndAdd(zAxis, distance * this._forward / 2000);
            this._forward = 0;

        }
    });

    function bindOnce( func, context){
        if( ! func.__bindfuc__){
            func.__bindfuc__ = function(){
                return func.apply(context, arguments); 
            }
        }
        return func.__bindfuc__;
    }

    return OrbitControl;
} );
define('3d/shader/source/basic.essl',[],function () { return '@export buildin.basic.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\n\nattribute vec3 barycentric;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Barycentric;\n\nvoid main(){\n\n    gl_Position = worldViewProjection * vec4( position, 1.0 );\n\n    v_Texcoord = texcoord * uvRepeat;\n    v_Barycentric = barycentric;\n}\n\n@end\n\n\n\n\n@export buildin.basic.fragment\n\nvarying vec2 v_Texcoord;\nuniform sampler2D diffuseMap;\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n@import buildin.util.edge_factor\n\nvoid main(){\n\n    gl_FragColor = vec4(color, alpha);\n    \n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D( diffuseMap, v_Texcoord );\n        gl_FragColor.rgb *= tex.rgb;\n    #endif\n    \n    if( lineWidth > 0.01){\n        gl_FragColor.xyz = gl_FragColor.xyz * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n}\n\n@end';});

define('3d/shader/source/lambert.essl',[],function () { return '/**\n * http://en.wikipedia.org/wiki/Lambertian_reflectance\n */\n\n@export buildin.lambert.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\n\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 boneWeight;\nattribute vec4 boneIndex;\n\nuniform mat4 boneMatrices[ BONE_MATRICES_NUMBER ];\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Barycentric;\n\nvoid main(){\n\n    vec3 skinnedPosition = position;\n    #ifdef SKINNING\n        mat4 skinMatrix;\n        if(boneIndex.x >= 0.0){\n            skinMatrix = boneMatrices[int(boneIndex.x)] * boneWeight.x;\n        }\n        if(boneIndex.y >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.y)] * boneWeight.y;\n        }\n        if(boneIndex.z >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.z)] * boneWeight.z;\n        }\n        if(boneIndex.w >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.w)] * (1.0-boneWeight.x-boneWeight.y-boneWeight.z);\n        }\n        skinnedPosition = (skinMatrix * vec4(position, 1.0)).xyz;\n\n        skinnedNormal = (skinMatrix * vec4(normal, 0.0)).xyz;\n        skinnedTangent = (skinMatrix * vec4(tangent.xyz, 0.0)).xyz;\n    #endif\n\n    gl_Position = worldViewProjection * vec4( skinnedPosition, 1.0 );\n\n    v_Texcoord = texcoord * uvRepeat;\n    v_Normal = normalize( ( worldInverseTranspose * vec4(normal, 0.0) ).xyz );\n    v_WorldPosition = ( world * vec4( skinnedPosition, 1.0) ).xyz;\n\n    v_Barycentric = barycentric;\n}\n\n@end\n\n\n\n\n@export buildin.lambert.fragment\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\nuniform sampler2D diffuseMap;\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_NUMBER\n@import buildin.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_NUMBER\n@import buildin.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_NUMBER\n@import buildin.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_NUMBER\n@import buildin.header.spot_light\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n// Import util functions and uniforms needed\n@import buildin.util.calculate_attenuation\n\n@import buildin.util.edge_factor\n\n@import buildin.plugin.compute_shadow_map\n\nvoid main(){\n    \n    gl_FragColor = vec4(color, alpha);\n\n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D( diffuseMap, v_Texcoord );\n        // http://freesdk.crydev.net/display/SDKDOC3/Specular+Maps\n        gl_FragColor.rgb *= tex.rgb;\n    #endif\n\n    vec3 diffuseColor = vec3(0.0, 0.0, 0.0);\n    \n    #ifdef AMBIENT_LIGHT_NUMBER\n        for(int i = 0; i < AMBIENT_LIGHT_NUMBER; i++){\n            diffuseColor += ambientLightColor[i];\n        }\n    #endif\n    // Compute point light color\n    #ifdef POINT_LIGHT_NUMBER\n        #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[POINT_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfPointLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < POINT_LIGHT_NUMBER; i++){\n\n            vec3 lightPosition = pointLightPosition[i];\n            vec3 lightColor = pointLightColor[i];\n            float range = pointLightRange[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n\n            // Calculate point light attenuation\n            float dist = length(lightDirection);\n            float attenuation = calculateAttenuation(dist, range);\n\n            // Normalize vectors\n            lightDirection /= dist;\n\n            float ndl = dot( v_Normal, lightDirection );\n\n            float shadowFallOff = 1.0;\n            #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * attenuation * shadowFallOff;\n        }\n    #endif\n    #ifdef DIRECTIONAL_LIGHT_NUMBER\n        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[DIRECTIONAL_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfDirectionalLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < DIRECTIONAL_LIGHT_NUMBER; i++){\n            vec3 lightDirection = -directionalLightDirection[i];\n            vec3 lightColor = directionalLightColor[i];\n            \n            float ndl = dot( v_Normal, normalize( lightDirection ) );\n\n            float shadowFallOff = 1.0;\n            #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * shadowFallOff;\n        }\n    #endif\n    \n    #ifdef SPOT_LIGHT_NUMBER\n        #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[SPOT_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfSpotLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < SPOT_LIGHT_NUMBER; i++){\n            vec3 lightPosition = -spotLightPosition[i];\n            vec3 spotLightDirection = -normalize( spotLightDirection[i] );\n            vec3 lightColor = spotLightColor[i];\n            float range = spotLightRange[i];\n            float umbraAngleCosine = spotLightUmbraAngleCosine[i];\n            float penumbraAngleCosine = spotLightPenumbraAngleCosine[i];\n            float falloffFactor = spotLightFalloffFactor[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n            // Calculate attenuation\n            float dist = length(lightDirection);\n            float attenuation = calculateAttenuation(dist, range); \n\n            // Normalize light direction\n            lightDirection /= dist;\n            // Calculate spot light fall off\n            float lightDirectCosine = dot(spotLightDirection, lightDirection);\n\n            float falloff;\n            if( lightDirectCosine < penumbraAngleCosine ){\n                falloff = 1.0;\n            }else if( lightDirectCosine > umbraAngleCosine ){\n                falloff = 0.0;\n            }else{\n                falloff = (lightDirectCosine-umbraAngleCosine)/(penumbraAngleCosine-umbraAngleCosine);\n                falloff = pow(falloff, falloffFactor);\n            }\n\n            float ndl = dot( v_Normal, lightDirection );\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowFallOff = 1.0;\n            #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * ndl * attenuation * (1.0-falloff) * shadowFallOff;\n\n        }\n    #endif\n\n    gl_FragColor.xyz *= diffuseColor;\n    if( lineWidth > 0.01){\n        gl_FragColor.xyz = gl_FragColor.xyz * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n\n}\n\n@end';});

define('3d/shader/source/phong.essl',[],function () { return '\n// http://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_shading_model\n\n@export buildin.phong.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\nattribute vec4 tangent : TANGENT;\n\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 boneWeight;\nattribute vec4 boneIndex;\n\nuniform mat4 boneMatrices[ BONE_MATRICES_NUMBER ];\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Barycentric;\n\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n\nvoid main(){\n    \n    vec3 skinnedPosition = position;\n    vec3 skinnedNormal = normal;\n    vec3 skinnedTangent = tangent.xyz;\n    #ifdef SKINNING\n        mat4 skinMatrix;\n        if(boneIndex.x >= 0.0){\n            skinMatrix = boneMatrices[int(boneIndex.x)] * boneWeight.x;\n        }\n        if(boneIndex.y >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.y)] * boneWeight.y;\n        }\n        if(boneIndex.z >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.z)] * boneWeight.z;\n        }\n        if(boneIndex.w >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.w)] * (1.0-boneWeight.x-boneWeight.y-boneWeight.z);\n        }\n        skinnedPosition = (skinMatrix * vec4(position, 1.0)).xyz;\n        // Normal matrix ???\n        skinnedNormal = (skinMatrix * vec4(normal, 0.0)).xyz;\n        skinnedTangent = (skinMatrix * vec4(tangent.xyz, 0.0)).xyz;\n\n    #endif\n\n    gl_Position = worldViewProjection * vec4( skinnedPosition, 1.0 );\n\n    v_Texcoord = texcoord * uvRepeat;\n    v_WorldPosition = ( world * vec4( skinnedPosition, 1.0) ).xyz;\n    v_Barycentric = barycentric;\n\n    v_Normal = normalize( ( worldInverseTranspose * vec4(skinnedNormal, 0.0) ).xyz );\n    v_Tangent = normalize( (worldInverseTranspose * vec4(skinnedTangent, 0.0) ).xyz );\n    v_Bitangent = normalize( cross(v_Normal, v_Tangent) * tangent.w );\n\n}\n\n@end\n\n\n@export buildin.phong.fragment\n\nuniform mat4 viewInverse : VIEWINVERSE;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n\nuniform sampler2D diffuseMap;\nuniform sampler2D normalMap;\nuniform sampler2D environmentMap;\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\nuniform float shininess : 30;\n\nuniform vec3 specular : [1.0, 1.0, 1.0];\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_NUMBER\n@import buildin.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_NUMBER\n@import buildin.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_NUMBER\n@import buildin.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_NUMBER\n@import buildin.header.spot_light\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n// Import util functions and uniforms needed\n@import buildin.util.calculate_attenuation\n\n@import buildin.util.edge_factor\n\n@import buildin.plugin.compute_shadow_map\n\nvoid main(){\n    \n    vec4 finalColor = vec4(color, alpha);\n\n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D( diffuseMap, v_Texcoord );\n        finalColor.rgb *= tex.rgb;\n    #endif\n\n    vec3 normal = v_Normal;\n    #ifdef NORMALMAP_ENABLED\n        normal = texture2D( normalMap, v_Texcoord ).xyz * 2.0 - 1.0;\n        mat3 tbn = mat3( v_Tangent, v_Bitangent, v_Normal );\n        normal = normalize( tbn * normal );\n    #endif\n\n    // Diffuse part of all lights\n    vec3 diffuseColor = vec3(0.0, 0.0, 0.0);\n    // Specular part of all lights\n    vec3 specularColor = vec3(0.0, 0.0, 0.0);\n    \n    vec3 eyePos = viewInverse[3].xyz;\n    vec3 viewDirection = normalize(eyePos - v_WorldPosition);\n\n    #ifdef AMBIENT_LIGHT_NUMBER\n        for(int i = 0; i < AMBIENT_LIGHT_NUMBER; i++){\n            diffuseColor += ambientLightColor[i];\n        }\n    #endif\n    #ifdef POINT_LIGHT_NUMBER\n        #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[POINT_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfPointLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < POINT_LIGHT_NUMBER; i++){\n\n            vec3 lightPosition = pointLightPosition[i];\n            vec3 lightColor = pointLightColor[i];\n            float range = pointLightRange[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n\n            // Calculate point light attenuation\n            float dist = length(lightDirection);\n            float attenuation = calculateAttenuation(dist, range); \n\n            // Normalize vectors\n            lightDirection /= dist;\n            vec3 halfVector = normalize( lightDirection + viewDirection );\n\n            float ndh = dot( normal, halfVector );\n            ndh = clamp(ndh, 0.0, 1.0);\n\n            float ndl = dot( normal,  lightDirection );\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowFallOff = 1.0;\n            #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * ndl * attenuation * shadowFallOff;\n\n            specularColor += specular * pow( ndh, shininess ) * attenuation * shadowFallOff;\n\n        }\n    #endif\n\n    #ifdef DIRECTIONAL_LIGHT_NUMBER\n        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[DIRECTIONAL_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfDirectionalLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < DIRECTIONAL_LIGHT_NUMBER; i++){\n\n            vec3 lightDirection = -normalize( directionalLightDirection[i] );\n            vec3 lightColor = directionalLightColor[i];\n\n            vec3 halfVector = normalize( lightDirection + viewDirection );\n\n            float ndh = dot( normal, halfVector );\n            ndh = clamp(ndh, 0.0, 1.0);\n\n            float ndl = dot( normal, lightDirection );\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowFallOff = 1.0;\n            #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * ndl * shadowFallOff;\n\n            specularColor += specular * pow( ndh, shininess ) * shadowFallOff;\n        }\n    #endif\n\n    #ifdef SPOT_LIGHT_NUMBER\n        #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[SPOT_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfSpotLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < SPOT_LIGHT_NUMBER; i++){\n            vec3 lightPosition = spotLightPosition[i];\n            vec3 spotLightDirection = -normalize( spotLightDirection[i] );\n            vec3 lightColor = spotLightColor[i];\n            float range = spotLightRange[i];\n            float umbraAngleCosine = spotLightUmbraAngleCosine[i];\n            float penumbraAngleCosine = spotLightPenumbraAngleCosine[i];\n            float falloffFactor = spotLightFalloffFactor[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n            // Calculate attenuation\n            float dist = length(lightDirection);\n            float attenuation = calculateAttenuation(dist, range); \n\n            // Normalize light direction\n            lightDirection /= dist;\n            // Calculate spot light fall off\n            float lightDirectCosine = dot(spotLightDirection, lightDirection);\n\n            float falloff;\n            // Fomular from real-time-rendering\n            if( lightDirectCosine < penumbraAngleCosine ){\n                falloff = 1.0;\n            }else if( lightDirectCosine > umbraAngleCosine ){\n                falloff = 0.0;\n            }else{\n                falloff = (lightDirectCosine-umbraAngleCosine)/(penumbraAngleCosine-umbraAngleCosine);\n                falloff = pow(falloff, falloffFactor);\n            }\n\n            vec3 halfVector = normalize( lightDirection + viewDirection );\n\n            float ndh = dot( normal, halfVector );\n            ndh = clamp(ndh, 0.0, 1.0);\n\n            float ndl = dot( normal, lightDirection );\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowFallOff = 1.0;\n            #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * ndl * attenuation * (1.0-falloff) * shadowFallOff;\n\n            specularColor += specular * pow( ndh, shininess ) * attenuation * (1.0-falloff) * shadowFallOff;\n\n        }\n    #endif\n\n    finalColor.rgb *= diffuseColor;\n    finalColor.rgb += specularColor;\n\n    if( lineWidth > 0.01){\n        finalColor.rgb = finalColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n\n    gl_FragColor = finalColor;\n}\n\n@end';});

define('3d/shader/source/wireframe.essl',[],function () { return '@export buildin.wireframe.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 world : WORLD;\n\nattribute vec3 position : POSITION;\nattribute vec3 barycentric;\n\nvarying vec3 v_Barycentric;\n\nvoid main(){\n\n    gl_Position = worldViewProjection * vec4( position, 1.0 );\n\n    v_Barycentric = barycentric;\n}\n\n@end\n\n\n@export buildin.wireframe.fragment\n\nuniform vec3 color : [0.0, 0.0, 0.0];\n\nuniform float alpha : 1.0;\nuniform float lineWidth : 1.5;\n\nvarying vec3 v_Barycentric;\n\n#extension GL_OES_standard_derivatives : enable\n\n@import buildin.util.edge_factor\n\nvoid main(){\n\n    gl_FragColor.rgb = color;\n    gl_FragColor.a = ( 1.0-edgeFactor(lineWidth) ) * alpha;\n}\n\n@end';});

define('3d/shader/source/util.essl',[],function () { return '// Use light attenuation formula in\n// http://blog.slindev.com/2011/01/10/natural-light-attenuation/\n@export buildin.util.calculate_attenuation\n\nuniform float attenuationFactor : 5.0;\n\nfloat calculateAttenuation(float dist, float range){\n    float attenuation = 1.0;\n    if( range > 0.0){\n        attenuation = dist*dist/(range*range);\n        float att_s = attenuationFactor;\n        attenuation = 1.0/(attenuation*att_s+1.0);\n        att_s = 1.0/(att_s+1.0);\n        attenuation = attenuation - att_s;\n        attenuation /= 1.0 - att_s;\n    }\n    return attenuation;\n}\n\n@end\n\n//http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/\n@export buildin.util.edge_factor\n\nfloat edgeFactor(float width){\n    vec3 d = fwidth(v_Barycentric);\n    vec3 a3 = smoothstep(vec3(0.0), d * width, v_Barycentric);\n    return min(min(a3.x, a3.y), a3.z);\n}\n\n@end\n\n// Pack depth\n// http://devmaster.net/posts/3002/shader-effects-shadow-mapping\n@export buildin.util.pack_depth\nvec4 packDepth( const in float depth ){\n\n    const vec4 bias = vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);\n\n    float r = depth;\n    float g = fract(r * 255.0);\n    float b = fract(g * 255.0);\n    float a = fract(b * 255.0);\n    vec4 colour = vec4(r, g, b, a);\n    \n    return colour - (colour.yzww * bias);\n}\n@end\n\n@export buildin.util.unpack_depth\nfloat unpackDepth( const in vec4 colour ){\n    const vec4 bitShifts = vec4(1.0, 1.0 / 255.0, 1.0 / (255.0 * 255.0), 1.0 / (255.0 * 255.0 * 255.0));\n    return dot(colour, bitShifts);\n}\n@end\n\n@export buildin.util.pack_depth_half\nvec2 packDepthHalf( const in float depth ){\n    const vec2 bitShifts = vec2(256.0, 1.0);\n    const vec4 bitMask = vec4(0.0, 1.0/256.0);\n\n    vec2 rg = fract(depth*bitShifts);\n    rg -= rg.xx * bitMask;\n\n    return rg;\n}\n@end\n\n@export buildin.util.unpack_depth_half\nfloat unpackDepthHalf( const in vec2 rg ){\n    const vec4 bitShifts = vec2(1.0/256.0, 1.0);\n    return dot(rg, bitShifts);\n}\n@end';});

/**
 * @export{object} library
 */
define('3d/shader/library',['require','../shader','_','./source/basic.essl','./source/lambert.essl','./source/phong.essl','./source/wireframe.essl','./source/util.essl'], function(require){

    var Shader = require("../shader");
    var _ = require("_");

    _library = {};

    _pool = {};

    // Example
    // ShaderLibrary.get("buildin.phong", "diffuse", "normal");
    // Or
    // ShaderLibrary.get("buildin.phong", ["diffuse", "normal"]);
    function get(name, enabledTextures){
        if( !enabledTextures){
            enabledTextures = [];
        }
        else if(typeof(enabledTextures) === "string"){
            enabledTextures = Array.prototype.slice.call(arguments, 1);
        }
        // Sort as first letter in increase order
        // And merge with name as a key string
        var key = name + "_" + enabledTextures.sort().join(",");
        if( _pool[key] ){
            return _pool[key];
        }else{
            var source = _library[name];
            if( ! source){
                console.error('Shader "'+name+'"'+' is not in the library');
                return;
            }
            var shader = new Shader({
                "vertex" : source.vertex,
                "fragment" : source.fragment
            })
            _.each(enabledTextures, function(symbol){
                shader.enableTexture(symbol);
            });
            _pool[key] = shader;
            return shader;
        }
    }

    function put(name, vertex, fragment){
        _library[name] = {
            vertex : vertex,
            fragment : fragment
        }
    }

    // Some build in shaders
    Shader.import( require('./source/basic.essl') );
    Shader.import( require('./source/lambert.essl') );
    Shader.import( require('./source/phong.essl') );
    Shader.import( require('./source/wireframe.essl') );
    Shader.import( require('./source/util.essl') );
    // Shader.import( require('3d/shader/source/depth.essl') );

    put("buildin.basic", Shader.source("buildin.basic.vertex"), Shader.source("buildin.basic.fragment"));
    put("buildin.lambert", Shader.source("buildin.lambert.vertex"), Shader.source("buildin.lambert.fragment"));
    put("buildin.phong", Shader.source("buildin.phong.vertex"), Shader.source("buildin.phong.fragment"));
    put("buildin.wireframe", Shader.source("buildin.wireframe.vertex"), Shader.source("buildin.wireframe.fragment"));
    // put("buildin.depth", Shader.source("buildin.depth.vertex"), Shader.source("buildin.depth.fragment"));

    return {
        get : get,
        put : put
    }
} );
define('3d/prepass/vsm.essl',[],function () { return '/**\n *  Variance Shadow Mapping\n * http://www.punkuser.net/vsm/vsm_paper.pdf\n * http://developer.download.nvidia.com/SDK/10/direct3d/Source/VarianceShadowMapping/Doc/VarianceShadowMapping.pdf\n */\n@export buildin.vsm.depth.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\nvarying vec4 v_ViewPosition;\nvoid main(){\n\n    v_ViewPosition = worldViewProjection * vec4( position, 1.0 );\n    gl_Position = worldViewProjection * vec4( position , 1.0 );\n\n}\n@end\n\n\n@export buildin.vsm.depth.fragment\n\nvarying vec4 v_ViewPosition;\n\nvoid main(){\n    float z = v_ViewPosition.z / v_ViewPosition.w;\n\n    gl_FragColor = vec4(z, z*z, 0.0, 0.0);\n}\n@end\n\n// Point light shadow mapping\n// http://http.developer.nvidia.com/GPUGems/gpugems_ch12.html\n@export buildin.vsm.distance.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 world : WORLD;\n\nattribute vec3 position : POSITION;\n\nvarying vec3 v_WorldPosition;\n\nvoid main(){\n\n    gl_Position = worldViewProjection * vec4( position , 1.0 );\n    v_WorldPosition = ( world * vec4(position, 1.0) ).xyz;\n}\n\n@end\n\n@export buildin.vsm.distance.fragment\n\nuniform vec3 lightPosition;\n\nvarying vec3 v_WorldPosition;\n\nvoid main(){\n\n    float dist = distance(lightPosition, v_WorldPosition);\n\n    gl_FragColor = vec4(dist, dist * dist, 0.0, 0.0);\n}\n@end\n\n\n@export buildin.plugin.compute_shadow_map\n\n#if defined(SPOT_LIGHT_SHADOWMAP_NUMBER) || defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER) || defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n\n#ifdef SPOT_LIGHT_SHADOWMAP_NUMBER\nuniform sampler2D spotLightShadowMap[ SPOT_LIGHT_SHADOWMAP_NUMBER ];\nuniform mat4 spotLightMatrix[ SPOT_LIGHT_SHADOWMAP_NUMBER ]; \n#endif\n\n#ifdef DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER\nuniform sampler2D directionalLightShadowMap[ DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER ];\nuniform mat4 directionalLightMatrix[ DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER ];\n#endif\n\n#ifdef POINT_LIGHT_SHADOWMAP_NUMBER\nuniform samplerCube pointLightShadowMap[ POINT_LIGHT_SHADOWMAP_NUMBER ];\n#endif\n\nuniform bool shadowEnabled : true;\n\n#if defined(DIRECTIONAL_LIGHT_NUMBER) || defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n\nvec4 vsmBoxFilter(sampler2D texture, vec2 uv){\n    vec4 tex = texture2D(texture, uv);\n    float offset = 1.0/512.0;\n    tex += texture2D(texture, uv+vec2(offset, 0.0) );\n    tex += texture2D(texture, uv+vec2(offset, offset) );\n    tex += texture2D(texture, uv+vec2(-offset, offset) );\n    tex += texture2D(texture, uv+vec2(0.0, offset) );\n    tex += texture2D(texture, uv+vec2(-offset, 0.0) );\n    tex += texture2D(texture, uv+vec2(-offset, -offset) );\n    tex += texture2D(texture, uv+vec2(offset, -offset) );\n    tex += texture2D(texture, uv+vec2(0.0, -offset) );\n\n    tex /= 9.0;\n    return tex;\n}\n\nfloat computeShadowFalloff( sampler2D map, mat4 lightVPM, vec3 position){\n    vec4 posInLightSpace = ( lightVPM * vec4(position, 1.0) );\n    posInLightSpace.xyz /= posInLightSpace.w;\n\n    float z = posInLightSpace.z;\n    // In frustum\n    if( all(greaterThan(posInLightSpace.xyz, vec3(-1.0))) &&\n        all(lessThan(posInLightSpace.xyz, vec3(1.0))) ){\n        \n        // To texture uv\n        vec2 uv = (posInLightSpace.xy+1.0) / 2.0;\n        // vec2 moments = texture2D( map, uv ).xy;\n        vec2 moments = vsmBoxFilter( map, uv ).xy;\n        \n        float variance = moments.y - moments.x * moments.x;\n\n        float mD = moments.x - z;\n        float p = variance / (variance + mD * mD);\n\n        if(moments.x + 0.002 < z){\n            return clamp(p, 0.0, 1.0);\n        }else{\n            return 1.0;\n        }\n    }\n    return 1.0;\n}\n\n#endif\n\n#ifdef POINT_LIGHT_SHADOWMAP_NUMBER\n\nvec4 vsmBoxFilterCube(samplerCube texture, vec3 direction){\n    vec4 tex = textureCube(texture, direction);\n    float offset = 0.05;\n    tex += textureCube(texture, direction + vec3(offset, 0.0, 0.0) );\n    tex += textureCube(texture, direction + vec3(offset, offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(-offset, offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(0.0, offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(-offset, 0.0, 0.0) );\n    tex += textureCube(texture, direction + vec3(-offset, -offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(offset, -offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(0.0, -offset, 0.0) );\n\n    tex /= 9.0;\n    return tex;\n}\n\nfloat computeShadowFallOfCube( samplerCube map, vec3 direction ){\n    \n    vec2 moments = vsmBoxFilterCube( map, direction).xy;\n\n    float variance = moments.y - moments.x * moments.x;\n\n    float dist = length(direction);\n    float mD = moments.x - dist;\n    float p = variance / (variance + mD * mD);\n\n    if(moments.x + 0.001 < dist){\n        return clamp(p, 0.0, 1.0);\n    }else{\n        return 1.0;\n    }\n}\n\n#endif\n\n#if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n\nvoid computeShadowFallOfSpotLights( vec3 position, inout float shadowFalloffs[SPOT_LIGHT_NUMBER]  ){\n    for( int i = 0; i < SPOT_LIGHT_SHADOWMAP_NUMBER; i++){\n        float shadowFalloff = computeShadowFalloff( spotLightShadowMap[i], spotLightMatrix[i], position );\n        shadowFalloffs[ i ] = shadowFalloff;\n    }\n    // set default fallof of rest lights\n    for( int i = SPOT_LIGHT_SHADOWMAP_NUMBER; i < SPOT_LIGHT_NUMBER; i++){\n        shadowFalloffs[i] = 1.0;\n    }\n}\n\n#endif\n\n\n#if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n\nvoid computeShadowFallOfPointLights( vec3 position, inout float shadowFalloffs[POINT_LIGHT_NUMBER]  ){\n    for( int i = 0; i < POINT_LIGHT_SHADOWMAP_NUMBER; i++){\n        vec3 lightPosition = pointLightPosition[i];\n        vec3 direction = position - lightPosition;\n        shadowFalloffs[ i ] = computeShadowFallOfCube( pointLightShadowMap[i], direction );\n    }\n    for( int i = POINT_LIGHT_SHADOWMAP_NUMBER; i < POINT_LIGHT_NUMBER; i++){\n        shadowFalloffs[i] = 1.0;\n    }\n}\n\n#endif\n\n\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n\nvoid computeShadowFallOfDirectionalLights( vec3 position, inout float shadowFalloffs[DIRECTIONAL_LIGHT_NUMBER] ){\n    for( int i = 0; i < DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER; i++){\n        float shadowFalloff = computeShadowFalloff( directionalLightShadowMap[i], directionalLightMatrix[i], position );\n        shadowFalloffs[ i ] = shadowFalloff;\n    }\n    // set default fallof of rest lights\n    for( int i = DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER; i < DIRECTIONAL_LIGHT_NUMBER; i++){\n        shadowFalloffs[i] = 1.0;\n    }\n}\n\n#endif\n\n#endif\n\n@end';});

/**
 * @export{class} ShadowMap
 */
define('3d/prepass/shadowmap',['require','core/base','core/vector3','../shader','../light','../light/spot','../light/directional','../light/point','../shader/library','../material','../framebuffer','../texture/texture2d','../texture/texturecube','../camera/perspective','../camera/orthographic','core/matrix4','_','./vsm.essl'], function(require){

    var Base = require("core/base");
    var Vector3 = require("core/vector3");
    var Shader = require("../shader");
    var Light = require("../light");
    var SpotLight = require("../light/spot");
    var DirectionalLight = require("../light/directional");
    var PointLight = require("../light/point");
    var shaderLibrary = require("../shader/library");
    var Material = require("../material");
    var FrameBuffer = require("../framebuffer");
    var Texture2d = require("../texture/texture2d");
    var TextureCube = require("../texture/texturecube");
    var PerspectiveCamera = require("../camera/perspective");
    var OrthoCamera = require("../camera/orthographic");

    var Matrix4 = require("core/matrix4");

    var _ = require("_");

    var frameBuffer = new FrameBuffer();

    Shader.import( require('./vsm.essl') );

    var ShadowMapPlugin = Base.derive(function(){
        return {
            _textures : {},

            _cameras : {},

            _shadowMapNumber : {
                'POINT_LIGHT' : 0,
                'DIRECTIONAL_LIGHT' : 0,
                'SPOT_LIGHT' : 0
            },
            _shadowMapOrder : {
                'SPOT_LIGHT' : 0,
                'DIRECTIONAL_LIGHT' : 1,
                'SPOT_LIGHT' : 2
            }

        }
    }, function(){
        this._depthMaterial =  new Material({
            shader : new Shader({
                vertex : Shader.source("buildin.vsm.depth.vertex"),
                fragment : Shader.source("buildin.vsm.depth.fragment")
            })
        });
        // Point light write the distance instance of depth projected
        // http://http.developer.nvidia.com/GPUGems/gpugems_ch12.html
        this._pointLightDepthMaterial = new Material({
            shader : new Shader({
                vertex : Shader.source("buildin.vsm.distance.vertex"),
                fragment : Shader.source("buildin.vsm.distance.fragment")
            })
        })
    }, {

        render : function( renderer, scene ){
            this._renderShadowPass( renderer, scene );
        },

        _renderShadowPass : function( renderer, scene ){

            var renderQueue = [],
                lightCastShadow = [],
                meshReceiveShadow = [];

            var _gl = renderer.gl;

            scene.update();

            scene.traverse( function(node){
                if( node.instanceof(Light) ){
                    if( node.castShadow ){
                        lightCastShadow.push(node);
                    }
                }
                if( node.material && node.material.shader ){
                    if( node.castShadow ){
                        renderQueue.push(node);
                    }
                    if( node.receiveShadow ){
                        meshReceiveShadow.push(node);

                        node.material.setUniform("shadowEnabled", 1);
                    }else{
                        node.material.setUniform("shadowEnabled", 0);
                    }
                };
            } );

            _gl.enable( _gl.DEPTH_TEST );
            _gl.disable( _gl.BLEND );

            _gl.clearColor(0.0, 0.0, 0.0, 0.0);
            _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

            var targets = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
            var targetMap = {
                'px' : _gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                'py' : _gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                'pz' : _gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                'nx' : _gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                'ny' : _gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                'nz' : _gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            }
            var cursor = 0;

            // Shadow uniforms
            var spotLightShadowMaps = [],
                spotLightMatrices = [],
                directionalLightShadowMaps = [],
                directionalLightMatrices = [],
                pointLightShadowMaps = [];

            var order = this._shadowMapOrder;
            // Store the shadow map in order
            lightCastShadow.sort(function(a, b){
                return order[a] - order[b];
            })
            // reset
            for(var name in this._shadowMapNumber){
                this._shadowMapNumber[name] = 0;
            }
            // Create textures for shadow map
            _.each( lightCastShadow, function( light ){

                if( light.instanceof(SpotLight) ||
                    light.instanceof(DirectionalLight) ){
                    
                    var texture = this._getTexture(light.__GUID__, light);
                    var camera = this._getCamera(light.__GUID__, light);

                    frameBuffer.attach( renderer.gl, texture );
                    frameBuffer.bind(renderer);

                    _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

                    renderer._scene = scene;
                    renderer.renderQueue( renderQueue, camera, this._depthMaterial, true );

                    frameBuffer.unbind(renderer);
        
                    var matrix = new Matrix4();
                    matrix.copy(camera.worldMatrix)
                        .invert()
                        .multiplyLeft(camera.projectionMatrix);

                    if( light.instanceof(SpotLight) ){
                        spotLightShadowMaps.push(texture);
                        spotLightMatrices.push(matrix._array);
                    }else{
                        directionalLightShadowMaps.push(texture);
                        directionalLightMatrices.push(matrix._array);
                    }

                }else if(light.instanceof(PointLight) ){
                    
                    var texture = this._getTexture(light.__GUID__, light);
                    pointLightShadowMaps.push( texture );

                    for(var i = 0; i < 6; i++){
                        var target = targets[i];
                        var camera = this._getCamera(light.__GUID__, light, target);

                        frameBuffer.attach( renderer.gl, texture, _gl.COLOR_ATTACHMENT0, targetMap[target] );
                        frameBuffer.bind(renderer);

                        _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

                        renderer._scene = scene;
                        this._pointLightDepthMaterial.setUniform("lightPosition", light.position._array);
                        renderer.renderQueue( renderQueue, camera, this._pointLightDepthMaterial, true );

                        frameBuffer.unbind(renderer);
                    }

                }

                this._shadowMapNumber[ light.type ] ++;
            }, this );

            for(var i = 0; i < meshReceiveShadow.length; i++){
                var mesh = meshReceiveShadow[i],
                    material = mesh.material;

                var shader = material.shader;

                var shaderNeedsUpdate = false;
                for( var name in this._shadowMapNumber ){
                    var number = this._shadowMapNumber[name];
                    var key = name + "_SHADOWMAP_NUMBER";

                    if( shader.fragmentDefines[key] !== number &&
                        number > 0){
                        shader.fragmentDefines[key] = number;
                        shaderNeedsUpdate = true;
                    }
                }
                if( shaderNeedsUpdate){
                    shader.update();
                }

                material.setUniforms({
                    "spotLightShadowMap" : spotLightShadowMaps,
                    "directionalLightShadowMap" : directionalLightShadowMaps,
                    "directionalLightMatrix" : directionalLightMatrices,
                    "pointLightShadowMap" : pointLightShadowMaps,
                    "spotLightMatrix" : spotLightMatrices,
                });
            }
        },

        _getTexture : function(key, light){
            var texture = this._textures[ key ];
            var resolution = light.shadowResolution || 512;
            var needsUpdate = false;
            if( texture ){
                if( texture.width !== resolution){
                    texture.dispose();
                    needsUpdate = true;
                }
            }else{
                needsUpdate = true;
            }
            if( needsUpdate){
                if( light.instanceof(PointLight) ){
                    texture = new TextureCube({
                        width : resolution,
                        height : resolution,
                        // minFilter : "NEAREST",
                        // magFilter : "NEAREST",
                        // generateMipmaps : false,
                        type : 'FLOAT'
                    })
                }else{
                    texture = new Texture2d({
                        width : resolution,
                        height : resolution,
                        // It seems the min filter and mag filter must
                        // be nearest in the chrome canary if the type is float
                        // minFilter : "NEAREST",
                        // magFilter : "NEAREST",
                        // generateMipmaps : false,
                        type : 'FLOAT'
                    })   
                }
                this._textures[key] = texture;
            }

            return texture;
        },

        _getCamera : function(key, light, target){
            var camera = this._cameras[ key ];
            if( target && ! camera){
                camera = this._cameras[key] = {};
            }
            if( target){
                camera = camera[target];   
            }
            if( ! camera ){
                if( light.instanceof(SpotLight) ||
                    light.instanceof(PointLight) ){
                    camera = new PerspectiveCamera({
                        near : 0.1
                    });
                }else if( light.instanceof(DirectionalLight) ){
                    camera = new OrthoCamera( light.shadowCamera );
                }
                if( target ){
                    this._cameras[key][target] = camera;
                }else{
                    this._cameras[key] = camera;
                }
            }
            if( light.instanceof(SpotLight) ){
                // Update properties
                camera.fov = light.penumbraAngle * 2;
                camera.far = light.range;
            }
            if( light.instanceof(PointLight) ){
                camera.far = light.range;
                camera.fov = 90;

                camera.position.set(0, 0, 0);
                switch(target){
                    case 'px':
                        camera.lookAt( px, ny );
                        break;
                    case 'nx':
                        camera.lookAt( nx, ny );
                        break;
                    case 'py':
                        camera.lookAt( py, pz );
                        break;
                    case 'ny':
                        camera.lookAt( ny, nz );
                        break;
                    case 'pz':
                        camera.lookAt( pz, ny );
                        break;
                    case 'nz':
                        camera.lookAt( nz, ny );
                        break;
                }
                camera.position.copy( light.position );
                camera.update();

            }else{
                camera.worldMatrix.copy(light.worldMatrix);
            }
            camera.updateProjectionMatrix();

            return camera;
        }
    });
    
    var px = new Vector3(1, 0, 0);
    var nx = new Vector3(-1, 0, 0);
    var py = new Vector3(0, 1, 0);
    var ny = new Vector3(0, -1, 0);
    var pz = new Vector3(0, 0, 1);
    var nz = new Vector3(0, 0, -1);


    function createEmptyArray(size, value){
        var arr = [];
        for(var i = 0; i < size; i++){
            arr.push(value);
        }
        return arr;
    }
    return ShadowMapPlugin;
} );
define('3d/renderer',['require','core/base','_','glmatrix','util/util','./light','./mesh','./webglinfo'], function(require){

    var Base = require("core/base");
    var _ = require("_");
    var glMatrix = require("glmatrix");
    var mat4 = glMatrix.mat4;
    var util = require("util/util");
    var Light = require("./light");
    var Mesh = require("./mesh");
    var WebGLInfo = require('./webglinfo');

    var Renderer = Base.derive( function() {
        return {

            __GUID__ : util.genGUID(),

            canvas : null,
            // Device Pixel Ratio is for high defination disply
            // like retina display
            // http://www.khronos.org/webgl/wiki/HandlingHighDPI
            devicePixelRatio : window.devicePixelRatio || 1.0,

            color : [1.0, 1.0, 1.0, 0.0],
            
            // _gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT
            clear : 16640,  

            // Settings when getting context
            // http://www.khronos.org/registry/webgl/specs/latest/#2.4
            alhpa : true,
            depth : true,
            stencil : false,
            antialias : true,
            premultipliedAlpha : true,
            preserveDrawingBuffer : false,

            gl : null,

            viewportInfo : {},

        }
    }, function(){
        if ( ! this.canvas) {
            this.canvas = document.createElement("canvas");
        }
        try {
            this.gl = this.canvas.getContext('experimental-webgl', {
                alhpa : this.alhpa,
                depth : this.depth,
                stencil : this.stencil,
                antialias : this.antialias,
                premultipliedAlpha : this.premultipliedAlpha,
                preserveDrawingBuffer : this.preserveDrawingBuffer,
            });
            this.gl.__GUID__ = this.__GUID__;

            this.resize( this.canvas.width, this.canvas.height );

            WebGLInfo.initialize(this.gl);
        }
        catch(e) {
            throw "Error creating WebGL Context";
        }
    }, {

        resize : function(width, height) {
            var canvas = this.canvas;
            // http://www.khronos.org/webgl/wiki/HandlingHighDPI
            // set the display size of the canvas.
            if( this.devicePixelRatio !== 1.0){
                canvas.style.width = width + "px";
                canvas.style.height = height + "px";
            }
             
            // set the size of the drawingBuffer
            canvas.width = width * this.devicePixelRatio;
            canvas.height = height * this.devicePixelRatio;

            this.setViewport(0, 0, canvas.width, canvas.height );
        },

        setViewport : function(x, y, width, height) {

            this.gl.viewport( x, y, width, height );

            this.viewportInfo = {
                x : x,
                y : y,
                width : width,
                height : height
            }
        },

        render : function( scene, camera, silent ) {
            
            var _gl = this.gl;
            
            if( ! silent){
                // Render plugin like shadow mapping must set the silent true
                this.trigger("beforerender", scene, camera);
            }

            var color = this.color;
            _gl.clearColor(color[0], color[1], color[2], color[3]);
            _gl.clear(this.clear);

            var opaqueQueue = [];
            var transparentQueue = [];
            var lights = [];

            camera.update();
            scene.update();

            this._scene = scene;
            var sceneMaterial = scene.material;

            // Traverse the scene and add the renderable
            // object to the render queue;
            scene.traverse( function(node) {
                if( ! node.visible){
                    return true;
                }
                if( node.instanceof( Light ) ){
                    lights.push( node );
                }
                // A node have render method and material property
                // can be rendered on the scene
                if( ! node.render ) {
                    return;
                }
                if( sceneMaterial ){
                    if( sceneMaterial.transparent ){
                        transparentQueue.push( node );
                    }else{
                        opaqueQueue.push( node );
                    }
                }else{
                    if(! node.material || ! node.material.shader){
                        return;
                    }
                    if( ! node.geometry){
                        return;
                    }
                    if( node.material.transparent ){
                        transparentQueue.push( node );
                    }else{
                        opaqueQueue.push( node );
                    }
                }
            } )
    
            if( scene.filter ){
                opaqueQueue = _.filter( opaqueQueue, scene.filter );
                transparentQueue = _.filter( transparentQueue, scene.filter );
            }

            var lightNumber = {};
            for (var i = 0; i < lights.length; i++) {
                var light = lights[i];
                if( ! lightNumber[light.type] ){
                    lightNumber[light.type] = 0;
                }
                lightNumber[light.type]++;
            }
            scene.lightNumber = lightNumber;
            this.updateLightUnforms( lights );

            // Sort material to reduce the cost of setting uniform in material
            // PENDING : sort geometry ??
            opaqueQueue.sort( this._materialSortFunc );
            transparentQueue.sort( this._materialSortFunc );

            if( ! silent){
                this.trigger("beforerender:opaque", opaqueQueue);
            }

            _gl.enable( _gl.DEPTH_TEST );
            _gl.disable( _gl.BLEND );
            this.renderQueue( opaqueQueue, camera, sceneMaterial, silent );

            if( ! silent){
                this.trigger("afterrender:opaque", opaqueQueue);
                this.trigger("beforerender:transparent", transparentQueue);
            }

            _gl.disable(_gl.DEPTH_TEST);
            _gl.enable(_gl.BLEND);
            // Default blend function
            _gl.blendEquation( _gl.FUNC_ADD );
            _gl.blendFunc( _gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);

            this.renderQueue( transparentQueue, camera, sceneMaterial, silent );

            if( ! silent){
                this.trigger("afterrender:transparent", transparentQueue);
                this.trigger("afterrender", scene, camera);
            }
        },


        updateLightUnforms : function(lights) {
            
            var lightUniforms = this._scene.lightUniforms;
            for(var symbol in lightUniforms){
                lightUniforms[symbol].value.length = 0;
            }
            for (var i = 0; i < lights.length; i++) {
                
                var light = lights[i];
                
                for ( symbol in light.uniformTemplates) {

                    var uniformTpl = light.uniformTemplates[symbol];
                    if( ! lightUniforms[symbol] ){
                        lightUniforms[ symbol] = {
                            type : "",
                            value : []
                        }
                    }
                    var value = uniformTpl.value( light );
                    var lu = lightUniforms[symbol];
                    lu.type = uniformTpl.type + "v";
                    switch(uniformTpl.type){
                        case "1i":
                        case "1f":
                            lu.value.push(value);
                            break;
                        case "2f":
                        case "3f":
                        case "4f":
                            for(var j =0; j < value.length; j++){
                                lu.value.push(value[j]);
                            }
                            break;
                        default:
                            console.error("Unkown light uniform type "+uniformTpl.type);
                    }
                }
            }
        },

        renderQueue : function( queue, camera, globalMaterial, silent ){

            // Calculate view and projection matrix
            mat4.invert( matrices['VIEW'],  camera.worldMatrix._array );
            mat4.copy( matrices['PROJECTION'], camera.projectionMatrix._array );
            mat4.multiply( matrices['VIEWPROJECTION'], camera.projectionMatrix._array, matrices['VIEW'] );
            mat4.copy( matrices['VIEWINVERSE'], camera.worldMatrix._array );
            mat4.invert( matrices['PROJECTIONINVERSE'], matrices['PROJECTION'] );
            mat4.invert( matrices['VIEWPROJECTIONINVERSE'], matrices['VIEWPROJECTION'] );

            var prevMaterialID;
            var prevShaderID;
            var _gl = this.gl;
            var scene = this._scene;
            
            for (var i =0; i < queue.length; i++) {
                var object = queue[i];
                var material = globalMaterial || object.material;
                var shader = material.shader;
                var geometry = object.geometry;
                var customBlend = material.transparent && material.blend;

                if (prevShaderID !== shader.__GUID__ ) {
                    // Set lights number
                    var lightNumberChanged = false;
                    if ( ! _.isEqual(shader.lightNumber, scene.lightNumber)) {
                        lightNumberChanged = true;
                    }
                    if ( lightNumberChanged ) {
                        for (var type in scene.lightNumber) {
                            var number = scene.lightNumber[ type ];
                            shader.lightNumber[ type ] = number;
                        }
                        shader.update();
                    }

                    shader.bind( _gl );

                    // Set lights uniforms
                    for (var symbol in scene.lightUniforms ) {
                        var lu = scene.lightUniforms[symbol];
                        shader.setUniform(_gl, lu.type, symbol, lu.value);
                    }
                    prevShaderID = shader.__GUID__;
                }
                if (prevMaterialID !== material.__GUID__) {

                    material.bind( _gl );
                    prevMaterialID = material.__GUID__;

                    Mesh.materialChanged();
                }

                if ( customBlend ){
                    customBlend( _gl );
                }

                var worldM = object.worldMatrix._array;

                // All matrices ralated to world matrix will be updated on demand;
                if ( shader.semantics.hasOwnProperty('WORLD') ||
                    shader.semantics.hasOwnProperty('WORLDTRANSPOSE') ) {
                    mat4.copy( matrices['WORLD'], worldM );
                }
                if ( shader.semantics.hasOwnProperty('WORLDVIEW') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWINVERSETRANSPOSE') ) {
                    mat4.multiply( matrices['WORLDVIEW'], matrices['VIEW'] , worldM);
                }
                if ( shader.semantics.hasOwnProperty('WORLDVIEWPROJECTION') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWPROJECTIONINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWPROJECTIONINVERSETRANSPOSE') ){
                    mat4.multiply( matrices['WORLDVIEWPROJECTION'], matrices['VIEWPROJECTION'] , worldM);
                }
                if ( shader.semantics.hasOwnProperty('WORLDINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDINVERSETRANSPOSE') ) {
                    mat4.invert( matrices['WORLDINVERSE'], worldM );
                }
                if ( shader.semantics.hasOwnProperty('WORLDVIEWINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWINVERSETRANSPOSE') ) {
                    mat4.invert( matrices['WORLDVIEWINVERSE'], matrices['WORLDVIEW'] );
                }
                if ( shader.semantics.hasOwnProperty('WORLDVIEWPROJECTIONINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWPROJECTIONINVERSETRANSPOSE') ){
                    mat4.invert( matrices['WORLDVIEWPROJECTIONINVERSE'], matrices['WORLDVIEWPROJECTION'] );
                }

                for (var semantic in matrices) {

                    if( shader.semantics.hasOwnProperty( semantic ) ){
                        var matrix = matrices[semantic];
                        var semanticInfo = shader.semantics[semantic];
                        shader.setUniform( _gl, semanticInfo.type, semanticInfo.symbol, matrix);
                    }

                    var semanticTranspose = semantic + "TRANSPOSE";
                    if( shader.semantics.hasOwnProperty( semantic + "TRANSPOSE") ) {
                        var matrixTranspose = matrices[semantic+'TRANSPOSE'];
                        var matrix = matrices[semantic];
                        var semanticTransposeInfo = shader.semantics[semantic+"TRANSPOSE"];
                        mat4.transpose( matrixTranspose, matrix);
                        shader.setUniform( _gl, semanticTransposeInfo.type, semanticTransposeInfo.symbol, matrixTranspose  );
                    }
                }

                if( ! silent){
                    this.trigger("beforerender:mesh", object);
                }
                var drawInfo = object.render( this, globalMaterial );
                if( ! silent){
                    this.trigger("afterrender:mesh", object, drawInfo);
                }
                // Restore the default blend function
                if (customBlend) {
                    _gl.blendEquation( _gl.FUNC_ADD );
                    _gl.blendFunc( _gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA );    
                }

            }
        },

        _materialSortFunc : function(x, y){
            if ( x.material.shader == y.material.shader) {
                return x.material.__GUID__ - y.material.__GUID__;
            }
            return x.material.shader.__GUID__ - y.material.__GUID__;
        }
    } )


    var matrices = {
        'WORLD' : mat4.create(),
        'VIEW' : mat4.create(),
        'PROJECTION' : mat4.create(),
        'WORLDVIEW' : mat4.create(),
        'VIEWPROJECTION' : mat4.create(),
        'WORLDVIEWPROJECTION' : mat4.create(),

        'WORLDINVERSE' : mat4.create(),
        'VIEWINVERSE' : mat4.create(),
        'PROJECTIONINVERSE' : mat4.create(),
        'WORLDVIEWINVERSE' : mat4.create(),
        'VIEWPROJECTIONINVERSE' : mat4.create(),
        'WORLDVIEWPROJECTIONINVERSE' : mat4.create(),

        'WORLDTRANSPOSE' : mat4.create(),
        'VIEWTRANSPOSE' : mat4.create(),
        'PROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDVIEWTRANSPOSE' : mat4.create(),
        'VIEWPROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDVIEWPROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDINVERSETRANSPOSE' : mat4.create(),
        'VIEWINVERSETRANSPOSE' : mat4.create(),
        'PROJECTIONINVERSETRANSPOSE' : mat4.create(),
        'WORLDVIEWINVERSETRANSPOSE' : mat4.create(),
        'VIEWPROJECTIONINVERSETRANSPOSE' : mat4.create(),
        'WORLDVIEWPROJECTIONINVERSETRANSPOSE' : mat4.create()
    };

    return Renderer;
} );
define('3d/skeleton',['require','core/base','core/matrix4'], function(require){

    var Base = require("core/base");
    var Matrix4 = require("core/matrix4");

    var Skeleton = Base.derive(function(){
        return {
            // Root bones
            roots : [],
            bones : [],
            // Poses stored in arrays

            // Matrix to joint space(inverse of indentity bone world matrix)
            _jointMatrices : [],

            // jointMatrix * currentPoseMatrix
            // worldMatrix is relative to the root bone
            // still in model space not world space
            _boneMatrices : [],

            _boneMatricesArray : null
        }
    }, function(){
        this.updateHierarchy();
        this.updateJointMatrices();
    }, {

        updateHierarchy : function(){
            this.roots = [];
            var bones = this.bones;
            for(var i = 0; i < bones.length; i++){
                var bone = bones[i];
                if(bone.parentIndex >= 0){
                    var parent = bones[bone.parentIndex];
                    parent.add(bone);
                }else{
                    this.roots.push(bone);
                }
            }
        },

        updateJointMatrices : function(){
            for(var i = 0; i < this.roots.length; i++){
                this.roots[i].update();
            }
            for(var i = 0; i < this.bones.length; i++){
                var bone = this.bones[i];
                this._jointMatrices[i] = (new Matrix4()).copy(bone.worldMatrix).invert();
                this._boneMatrices[i] = new Matrix4();
            }
        },

        update : function(){
            for(var i = 0; i < this.roots.length; i++){
                this.roots[i].update();
            }
            var boneMatricesArray = this.getBoneMatricesArray();
            var cursor = 0;
            for(var i = 0; i < this.bones.length; i++){
                var matrixCurrentPose = this.bones[i].worldMatrix;
                this._boneMatrices[i].copy(matrixCurrentPose).multiply(this._jointMatrices[i]);

                for(var j = 0; j < 16; j++){
                    var array = this._boneMatrices[i]._array;
                    boneMatricesArray[cursor++] = array[j];
                }
            }
        },

        getBoneMatricesArray : function(){
            if( ! this._boneMatricesArray ){
                this._boneMatricesArray = new Float32Array(this.bones.length * 16);
            }
            return this._boneMatricesArray;
        },

        setPose : function(time){
            for(var i = 0; i < this.bones.length; i++){
                this.bones[i].setPose(time);
            }
            this.update();
        }
    });

    return Skeleton;
} );
;
define("3d/texture/compressed2d", function(){});

;
define("3d/texture/compressedcube", function(){});

/**
 *
 * @export{object} mesh
 */
define('3d/util/mesh',['require','../geometry','../mesh','glmatrix','_'], function( require ){
    
    var Geometry = require("../geometry");
    var Mesh = require("../mesh");
    var glMatrix = require("glmatrix");
    var _ = require("_");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;

    var ret = {
        /**
         * Merge multiple meshes to one.
         * Note that these meshes must have the same material
         */
        merge : function( meshes, clone ){

            if( ! meshes.length ){
                return;
            }
            var clone = typeof(clone) === "undefined" ? true : clone;

            var templateMesh = meshes[0];
            var templateGeo = templateMesh.geometry;
            var material = templateMesh.material;

            if( _.any( meshes, function(mesh){
                return mesh.material !== material;  
            }) ){
                console.warn("Material of meshes to merge is not the same, program will use the material of first mesh by default");
            }

            var geometry = new Geometry,
                faces = geometry.faces;

            for(var name in templateGeo.attributes){
                var attr = templateGeo.attributes[name];
                // Extend custom attributes
                if( ! geometry.attributes[name] ){
                    geometry.attributes[name] = {
                        value : [],
                        type : attr.type
                    }
                }
            }


            var faceOffset = 0,
                useFaces = templateGeo.faces.length !== 0;
                
            for( var k = 0; k < meshes.length; k++){
                var mesh = meshes[k];  
                var currentGeo = mesh.geometry;

                mesh.updateMatrix();
                var vertexCount = currentGeo.getVerticesNumber();

                for(var name in currentGeo.attributes ){

                    var currentAttr = currentGeo.attributes[name];
                    var targetAttr = geometry.attributes[name];
                    // Skip the unused attributes;
                    if( ! currentAttr.value.length ){
                        continue;
                    }
                    for(var i = 0; i < vertexCount; i++){

                        // Transform position, normal and tangent
                        if( name === "position" ){
                            var newValue = cloneValue(currentAttr.value[i]);
                            vec3.transformMat4(newValue, newValue, mesh.matrix._array);
                            targetAttr.value.push( newValue );   
                        }
                        else if( name === "normal" ){
                            var newValue = cloneValue(currentAttr.value[i]);
                            targetAttr.value.push( newValue );
                        }
                        else if( name === "tangent" ){
                            var newValue = cloneValue(currentAttr.value[i]);
                            targetAttr.value.push( newValue );
                        }else{
                            targetAttr.value.push( cloneValue(currentAttr.value[i]) );
                        }

                    }
                }

                if( useFaces ){
                    var len = currentGeo.faces.length;
                    for(i =0; i < len; i++){
                        var newFace = [];
                        var face = currentGeo.faces[i];
                        newFace[0] = face[0] + faceOffset;
                        newFace[1] = face[1] + faceOffset;
                        newFace[2] = face[2] + faceOffset;

                        faces.push( newFace );
                    }
                }

                faceOffset += vertexCount;
            }

            function cloneValue( val ){
                if( ! clone ){
                    return val;
                }
                return val && Array.prototype.slice.call(val);
            }

            return new Mesh({
                material : material,
                geometry : geometry
            });
        }
    }

    return ret;
} );
/**
 * 缓动代码来自 https://github.com/sole/tween.js/blob/master/src/Tween.js
 * author: lang(shenyi01@baidu.com)
 */
define('animation/easing',[],function() {
    var Easing = {
        Linear: function(k) {
            return k;
        },

        QuadraticIn: function(k) {
            return k * k;
        },
        QuadraticOut: function(k) {
            return k * (2 - k);
        },
        QuadraticInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k;
            }
            return - 0.5 * (--k * (k - 2) - 1);
        },

        CubicIn: function(k) {
            return k * k * k;
        },
        CubicOut: function(k) {
            return --k * k * k + 1;
        },
        CubicInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k * k;
            }
            return 0.5 * ((k -= 2) * k * k + 2);
        },

        QuarticIn: function(k) {
            return k * k * k * k;
        },
        QuarticOut: function(k) {
            return 1 - (--k * k * k * k);
        },
        QuarticInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k * k * k;
            }
            return - 0.5 * ((k -= 2) * k * k * k - 2);
        },

        QuinticIn: function(k) {
            return k * k * k * k * k;
        },

        QuinticOut: function(k) {
            return --k * k * k * k * k + 1;
        },
        QuinticInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k * k * k * k;
            }
            return 0.5 * ((k -= 2) * k * k * k * k + 2);
        },

        SinusoidalIn: function(k) {
            return 1 - Math.cos(k * Math.PI / 2);
        },
        SinusoidalOut: function(k) {
            return Math.sin(k * Math.PI / 2);
        },
        SinusoidalInOut: function(k) {
            return 0.5 * (1 - Math.cos(Math.PI * k));
        },

        ExponentialIn: function(k) {
            return k === 0 ? 0 : Math.pow(1024, k - 1);
        },
        ExponentialOut: function(k) {
            return k === 1 ? 1 : 1 - Math.pow(2, - 10 * k);
        },
        ExponentialInOut: function(k) {
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if ((k *= 2) < 1) {
                return 0.5 * Math.pow(1024, k - 1);
            }
            return 0.5 * (- Math.pow(2, - 10 * (k - 1)) + 2);
        },

        CircularIn: function(k) {
            return 1 - Math.sqrt(1 - k * k);
        },
        CircularOut: function(k) {
            return Math.sqrt(1 - (--k * k));
        },
        CircularInOut: function(k) {
            if ((k *= 2) < 1) {
                return - 0.5 * (Math.sqrt(1 - k * k) - 1);
            }
            return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
        },

        ElasticIn: function(k) {
            var s, a = 0.1, p = 0.4;
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if (!a || a < 1) {
                a = 1; s = p / 4;
            }else{
                s = p * Math.asin(1 / a) / (2 * Math.PI);
            }
            return - (a * Math.pow(2, 10 * (k -= 1)) *
                        Math.sin((k - s) * (2 * Math.PI) / p));
        },
        ElasticOut: function(k) {
            var s, a = 0.1, p = 0.4;
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if (!a || a < 1) {
                a = 1; s = p / 4;
            }
            else{
                s = p * Math.asin(1 / a) / (2 * Math.PI);
            }
            return (a * Math.pow(2, - 10 * k) *
                    Math.sin((k - s) * (2 * Math.PI) / p) + 1);
        },
        ElasticInOut: function(k) {
            var s, a = 0.1, p = 0.4;
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if (!a || a < 1) {
                a = 1; s = p / 4;
            }
            else{
                s = p * Math.asin(1 / a) / (2 * Math.PI);
            }
            if ((k *= 2) < 1) {
                return - 0.5 * (a * Math.pow(2, 10 * (k -= 1))
                    * Math.sin((k - s) * (2 * Math.PI) / p));
            }
            return a * Math.pow(2, -10 * (k -= 1))
                    * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;

        },

        BackIn: function(k) {
            var s = 1.70158;
            return k * k * ((s + 1) * k - s);
        },
        BackOut: function(k) {
            var s = 1.70158;
            return --k * k * ((s + 1) * k + s) + 1;
        },
        BackInOut: function(k) {
            var s = 1.70158 * 1.525;
            if ((k *= 2) < 1) {
                return 0.5 * (k * k * ((s + 1) * k - s));
            }
            return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
        },

        BounceIn: function(k) {
            return 1 - Easing.BounceOut(1 - k);
        },
        BounceOut: function(k) {
            if (k < (1 / 2.75)) {
                return 7.5625 * k * k;
            }
            else if (k < (2 / 2.75)) {
                return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
            } else if (k < (2.5 / 2.75)) {
                return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
            } else {
                return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
            }
        },
        BounceInOut: function(k) {
            if (k < 0.5) {
                return Easing.BounceIn(k * 2) * 0.5;
            }
            return Easing.BounceOut(k * 2 - 1) * 0.5 + 0.5;
        }
    };

    return Easing;
});


define('animation/controller',['require','./easing'],function(require) {

    var Easing = require('./easing');

    var Controller = function(options) {

        this._targetPool = options.target || {};
        if (this._targetPool.constructor != Array) {
            this._targetPool = [this._targetPool];
        }

        this._life = options.life || 1000;

        this._delay = options.delay || 0;
        
        this._startTime = new Date().getTime() + this._delay;

        this._endTime = this._startTime + this._life*1000;

        this.loop = typeof(options.loop) == 'undefined'
                    ? false : options.loop;

        this.gap = options.gap || 0;

        this.easing = options.easing || 'Linear';

        this.onframe = options.onframe || null;

        this.ondestroy = options.ondestroy || null;

        this.onrestart = options.onrestart || null;
    };

    Controller.prototype = {
        step : function(time) {
            var percent = (time - this._startTime) / this._life;

            if (percent < 0) {
                return;
            }

            percent = Math.min(percent, 1);

            var easingFunc = typeof(this.easing) == 'string'
                             ? Easing[this.easing]
                             : this.easing;
            var schedule;
            if (typeof easingFunc === 'function') {
                schedule = easingFunc(percent);
            }else{
                schedule = percent;
            }
            this.fire('frame', schedule);

            if (percent == 1) {
                if (this.loop) {
                    this.restart();
                    return 'restart';

                }else{
                    // Mark this controller to be deleted
                    // In the animation.update
                    this._needsRemove = true;

                    return 'destroy';
                }
            }else{
                return null;
            }
        },
        restart : function() {
            this._startTime = new Date().getTime() + this.gap;
        },
        fire : function(eventType, arg) {
            for(var i = 0, len = this._targetPool.length; i < len; i++) {
                if (this['on' + eventType]) {
                    this['on' + eventType](this._targetPool[i], arg);
                }
            }
        }
    };
    Controller.prototype.constructor = Controller;

    return Controller;
});
define('animation/animation',['require','./controller','_'],function(require){
    
    var Controller = require('./controller');
    var _ = require("_");

    var Animation = function(options){

        options = options || {};

        this.stage = options.stage || {};

        this.fps = options.fps || 50;

        this.onframe = options.onframe || function(){};

        // private properties
        this._controllerPool = [];

        this._timer = null;
    };

    Animation.prototype = {
        add : function(controller){
            this._controllerPool.push(controller);
        },
        remove : function(controller){
            var idx = this._controllerPool.indexOf(controller);
            if (idx >= 0){
                this._controllerPool.splice(idx, 1);
            }
        },
        update : function(){
            var time = new Date().getTime();
            var cp = this._controllerPool;
            var len = cp.length;

            var deferredEvents = [];
            var deferredCtls = [];
            for(var i = 0; i < len; i++){
                var controller = cp[i];
                var e = controller.step(time);
                // Throw out the events need to be called after
                // stage.update, like destroy
                if( e ){
                    deferredEvents.push(e);
                    deferredCtls.push(controller);
                }
            }
            if (this.stage
                && this.stage.update
                && this._controllerPool.length
            ){
                this.stage.update();
            }

            // Remove the finished controller
            var newArray = [];
            for(var i = 0; i < len; i++){
                if(!cp[i]._needsRemove){
                    newArray.push(cp[i]);
                    cp[i]._needsRemove = false;
                }
            }
            this._controllerPool = newArray;

            len = deferredEvents.length;
            for(var i = 0; i < len; i++){
                deferredCtls[i].fire( deferredEvents[i] );
            }

            this.onframe();

        },
        start : function(){
            if (this._timer){
                clearInterval(this._timer);
            }
            var self = this;
            this._timer = setInterval(function(){
                self.update();
            }, 1000/this.fps);
        },
        stop : function(){
            if (this._timer){
                clearInterval(this._timer);
            }
        },
        clear : function(){
            this._controllerPool = [];
        },
        animate : function(target, loop, getter, setter){
            var deferred = new Deferred(target, loop, getter, setter);
            deferred.animation = this;
            return deferred;
        }
    };
    Animation.prototype.constructor = Animation;

    function _defaultGetter(target, key){
        return target[key];
    }
    function _defaultSetter(target, key, value){
        target[key] = value;
    }
    // Interpolate recursively
    // TODO interpolate objects
    function _interpolate(prevValue, nextValue, percent, target, propName, getter, setter){
         // 遍历数组做插值
        if (prevValue instanceof Array
            && nextValue instanceof Array
        ){
            var minLen = Math.min(prevValue.length, nextValue.length);
            var largerArray;
            var maxLen;
            var result = [];
            if (minLen === prevValue.length){
                maxLen = nextValue.length;
                largerArray = nextValue;
            }else{
                maxLen = prevValue.length;
                largerArray = prevValue.length;
            }
            for(var i = 0; i < minLen; i++){
                // target[propName] as new target,
                // i as new propName
                result.push(_interpolate(
                        prevValue[i],
                        nextValue[i],
                        percent,
                        getter(target, propName),
                        i,
                        getter,
                        setter
                ));
            }
            // Assign the rest
            for(var i = minLen; i < maxLen; i++){
                result.push(largerArray[i]);
            }

            setter(target, propName, result);
        }
        else{
            prevValue = parseFloat(prevValue);
            nextValue = parseFloat(nextValue);
            if (!isNaN(prevValue) && !isNaN(nextValue)){
                var value = (nextValue-prevValue) * percent+prevValue;
                setter(target, propName, value);
                return value;
            }
        }
    }
    function Deferred(target, loop, getter, setter){
        this._tracks = {};
        this._target = target;

        this._loop = loop || false;

        this._getter = getter || _defaultGetter;
        this._setter = setter || _defaultSetter;

        this._controllerCount = 0;

        this._doneList = [];

        this._onframeList = [];

        this._controllerList = [];
    }

    Deferred.prototype = {
        when : function(time /* ms */, props, easing){
            for(var propName in props){
                if (! this._tracks[ propName ]){
                    this._tracks[ propName ] = [];
                    // Initialize value
                    this._tracks[ propName ].push({
                        time : 0,
                        value : this._getter(this._target, propName)
                    });
                }
                this._tracks[ propName ].push({
                    time : time,
                    value : props[ propName ],
                    easing : easing
                });
            }
            return this;
        },
        during : function(callback){
            this._onframeList.push(callback);
            return this;
        },
        start : function(){
            var self = this;
            var delay;
            var track;
            var trackMaxTime;

            function createOnframe(now, next, propName){
                var prevValue = clone(now.value);
                var nextValue = clone(next.value);
                return function(target, schedule){
                    _interpolate(
                        prevValue,
                        nextValue,
                        schedule,
                        target,
                        propName,
                        self._getter,
                        self._setter
                    );
                    for(var i = 0; i < self._onframeList.length; i++){
                        self._onframeList[i](target, schedule);
                    }
                };
            }

            function ondestroy(){
                self._controllerCount--;
                if (self._controllerCount === 0){
                    var len = self._doneList.length;
                    for(var i = 0; i < len; i++){
                        self._doneList[i]();
                    }
                }
            }

            for(var propName in this._tracks){
                delay = 0;
                track = this._tracks[ propName ];
                if (track.length){
                    trackMaxTime = track[ track.length-1].time;
                }else{
                    continue;
                }
                for(var i = 0; i < track.length-1; i++){
                    var now = track[i],
                        next = track[i+1];

                    var controller = new Controller({
                        target : self._target,
                        life : next.time - now.time,
                        delay : delay,
                        loop : self._loop,
                        gap : trackMaxTime - (next.time - now.time),
                        easing : next.easing,
                        onframe : createOnframe(now, next, propName),
                        ondestroy : ondestroy
                    });
                    this._controllerList.push(controller);

                    this._controllerCount++;
                    delay = next.time;

                    self.animation.add(controller);
                }
            }
            return this;
        },
        stop : function(){
            for(var i = 0; i < this._controllerList.length; i++){
                var controller = this._controllerList[i];
                this.animation.remove(controller);
            }
        },
        done : function(func){
            this._doneList.push(func);
            return this;
        }
    };

    function clone(value){
        if (value && value instanceof Array){
            return Array.prototype.slice.call(value);
        }
        else {
            return value;
        }
    }

    return Animation;
});

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

define('core/vector4',['require','glmatrix'], function(require){

    var glMatrix = require("glmatrix");
    var vec4 = glMatrix.vec4;

    var Vector4 = function(x, y, z, w){
        
        x = x || 0;
        y = y || 0;
        z = z || 0;
        w = w || 0;

        return Object.create(Vector4Proto, {

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
                value : vec4.fromValues(x, y, z, w)
            },
            _dirty : {
                configurable : false,
                value : false
            }
        })

    }

    var Vector4Proto = {

        constructor : Vector4,

        add : function(b){
            vec4.add( this._array, this._array, b._array );
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
            return new Vector4( this.x, this.y, this.z, this.w);
        },

        copy : function(b){
            vec4.copy( this._array, b._array );
            this._dirty = true;
            return this;
        },

        cross : function(out, b){
            vec4.cross(out._array, this._array, b._array);
            return this;
        },

        dist : function(b){
            return vec4.dist(this._array, b._array);
        },

        distance : function(b){
            return vec4.distance(this._array, b._array);
        },

        div : function(b){
            vec4.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        divide : function(b){
            vec4.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        dot : function(b){
            return vec4.dot(this._array, b._array);
        },

        len : function(){
            return vec4.len(this._array);
        },

        length : function(){
            return vec4.length(this._array);
        },
        /**
         * Perform linear interpolation between a and b
         */
        lerp : function(a, b, t){
            vec4.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        mul : function(b){
            vec4.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b){
            vec4.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        negate : function(){
            vec4.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        normalize : function(){
            vec4.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        random : function(scale){
            vec4.random(this._array, scale);
            this._dirty = true;
            return this;
        },

        scale : function(s){
            vec4.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        /**
         * add b by a scaled factor
         */
        scaleAndAdd : function(b, s){
            vec4.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },

        sqrDist : function(b){
            return vec4.sqrDist(this._array, b._array);
        },

        squaredDistance : function(b){
            return vec4.squaredDistance(this._array, b._array);
        },

        sqrLen : function(){
            return vec4.sqrLen(this._array);
        },

        squaredLength : function(){
            return vec4.squaredLength(this._array);
        },

        sub : function(b){
            vec4.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        subtract : function(b){
            vec4.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        transformMat4 : function(m){
            vec4.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        transformQuat : function(q){
            vec4.transformQuat(this._array, this._array, q._array);
            this._dirty = true;
            return this;
        },     

        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    return Vector4;
} );
/**
 * Load three.js JSON Format model
 *
 * Format specification : https://github.com/mrdoob/three.js/wiki/JSON-Model-format-3.1
 * @export{class} Model
 */
define('loader/three/model',['require','core/base','core/request','3d/shader','3d/material','3d/geometry','3d/mesh','3d/node','3d/texture/texture2d','3d/texture/texturecube','3d/shader/library','3d/skeleton','3d/bone','core/vector3','core/quaternion','_','glmatrix'], function(require){

    var Base = require('core/base');

    var request = require("core/request");
    var Shader = require("3d/shader");
    var Material = require("3d/material");
    var Geometry = require("3d/geometry");
    var Mesh = require("3d/mesh");
    var Node = require("3d/node");
    var Texture2D = require("3d/texture/texture2d");
    var TextureCube = require("3d/texture/texturecube");
    var shaderLibrary = require("3d/shader/library");
    var Skeleton = require("3d/skeleton");
    var Bone = require("3d/bone");
    var Vector3 = require("core/vector3");
    var Quaternion = require("core/quaternion");
    var _ = require("_");

    var glMatrix = require("glmatrix");
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;

    var Loader = Node.derive(function(){
        return {
            textureRootPath : "",

            textureNumber : 0
        };
    }, {
        load : function(url){
            var self = this;

            this.textureNumber = 0;
            request.get({
                url : url,
                onprogress : function(percent, loaded, total){
                    self.trigger("progress", percent, loaded, total);
                },
                onerror : function(e){
                    self.trigger("error", e);
                },
                responseType : "text",
                onload : function(data){
                    self.parse( JSON.parse(data) )
                }
            })
        },
        parse : function(data){
            
            var geometryList = this.parseGeometry(data);

            var dSkinIndices = data.skinIndices,
                dSkinWeights = data.skinWeights;
            var skinned = dSkinIndices && dSkinIndices.length
                        && dSkinWeights && dSkinWeights.length;

            if(skinned){
                var skeleton = this.parseSkeleton(data);
                var boneNumber = skeleton.bones.length;
            }else{
                var boneNumber = 0;
            }

            if(skinned){
                var skeleton = this.parseSkeleton(data);
                var boneNumber = skeleton.bones.length;
            }else{
                var boneNumber = 0;
            }

            var meshList = [];
            for(var i = 0; i < data.materials.length; i++){
                var geometry = geometryList[i];
                if( geometry 
                    && geometry.faces.length 
                    && geometry.attributes.position.value.length ){
                    var material = this.parseMaterial(data.materials[i], boneNumber);
                    var mesh = new Mesh({
                        geometry : geometryList[i],
                        material : material
                    }) ;
                    if( skinned){
                        mesh.skeleton = skeleton;
                    }
                    meshList.push(mesh);
                }
            }
            
            this.trigger('load', meshList);
            return meshList;
        },

        parseGeometry : function(data){

            var geometryList = [];
            var cursorList = [];
            
            for(var i = 0; i < data.materials.length; i++){
                geometryList[i] = null;
                cursorList[i] = 0;
            }
            geometryList[0] = new Geometry;

            var faceMaterial = data.materials && data.materials.length > 1;

            var dFaces = data.faces,
                dVertices = data.vertices,
                dNormals = data.normals,
                dColors = data.colors,
                dSkinIndices = data.skinIndices,
                dSkinWeights = data.skinWeights,
                dUvs = data.uvs;

            var skinned = dSkinIndices && dSkinIndices.length
                        && dSkinWeights && dSkinWeights.length;

            var geometry = geometryList[0],
                attributes = geometry.attributes,
                positions = attributes.position.value,
                normals = attributes.normal.value,
                texcoords = [attributes.texcoord0.value,
                            attributes.texcoord1.value],
                colors = attributes.color.value,
                boneIndices = attributes.boneIndex.value,
                boneWeights = attributes.boneWeight.value,
                faces = geometry.faces;

            var nUvLayers = 0;
            if( dUvs[0] && dUvs[0].length ){
                nUvLayers++;
            }
            if( dUvs[1] && dUvs[1].length ){
                nUvLayers++;
            }

            var offset = 0;
            var len = dFaces.length;

            // Cache the reorganized index
            var newIndexMap = [];
            var geoIndexMap = [];
            for(var i = 0; i < dVertices.length; i++){
                newIndexMap[i] = -1;
                geoIndexMap[i] = -1;
            }

            var currentGeometryIndex = 0;
            var isNew = [];
            function getNewIndex(oi, faceIndex){
                if( newIndexMap[oi] >= 0){
                    // Switch to the geometry of existed index 
                    currentGeometryIndex = geoIndexMap[oi];
                    geometry = geometryList[currentGeometryIndex];
                    attributes = geometry.attributes;
                    positions = attributes.position.value;
                    normals = attributes.normal.value;
                    texcoords = [attributes.texcoord0.value,
                                attributes.texcoord1.value];
                    colors = attributes.color.value;
                    boneWeights = attributes.boneWeight.value;
                    boneIndices = attributes.boneIndex.value;

                    isNew[faceIndex] = false;
                    return newIndexMap[oi];
                }else{

                    positions.push( [ dVertices[oi*3], dVertices[oi*3+1], dVertices[oi*3+2] ] );
                    //Skin data
                    if(skinned){
                        boneWeights.push( [dSkinWeights[oi*2], dSkinWeights[oi*2+1], 0] );
                        boneIndices.push( [dSkinIndices[oi*2], dSkinIndices[oi*2+1], -1, -1] );
                    }

                    newIndexMap[oi] = cursorList[materialIndex];
                    geoIndexMap[oi] = materialIndex;

                    isNew[faceIndex] = true;
                    return cursorList[materialIndex]++;
                }
            }
            // Put the vertex data of one face here
            // Incase the program create amount of tmp arrays and cause
            // GC bottleneck
            var faceUvs = [];
            var faceNormals = [];
            var faceColors = [];
            for(var i =0; i < 4; i++){
                faceUvs[i] = [0, 0];
                faceNormals[i] = [0, 0, 0];
                faceColors[i] = [0, 0, 0];
            }
            var materialIndex = 0;

            while(offset < len){
                var type = dFaces[offset++];
                var isQuad = isBitSet( type, 0 ),
                    hasMaterial = isBitSet( type, 1 ),
                    hasFaceUv = isBitSet( type, 2 ),
                    hasFaceVertexUv = isBitSet( type, 3 ),
                    hasFaceNormal = isBitSet( type, 4 ),
                    hasFaceVertexNormal = isBitSet( type, 5 ),
                    hasFaceColor = isBitSet( type, 6 ),
                    hasFaceVertexColor = isBitSet( type, 7 );

                var nVertices = isQuad ? 4 : 3;

                if(hasMaterial){
                    materialIndex = dFaces[ offset+ (isQuad ? 4 : 3) ];
                    if( ! geometryList[materialIndex] ){
                        geometryList[materialIndex] = new Geometry;
                    }
                    geometry = geometryList[materialIndex];
                    attributes = geometry.attributes;
                    positions = attributes.position.value;
                    normals = attributes.normal.value;
                    texcoords = [attributes.texcoord0.value,
                                attributes.texcoord1.value];
                    colors = attributes.color.value;
                    boneWeights = attributes.boneWeight.value;
                    boneIndices = attributes.boneIndex.value;
                    faces = geometry.faces;
                }
                if(isQuad){
                    // Split into two triangle faces, 1-2-4 and 2-3-4
                    var i1o = dFaces[offset++],
                        i2o = dFaces[offset++],
                        i3o = dFaces[offset++],
                        i4o = dFaces[offset++];
                    // Face1
                    var i1 = getNewIndex(i1o, 0),
                        i2 = getNewIndex(i2o, 1),
                        i3 = getNewIndex(i4o, 2),
                    // Face2
                        i4 = getNewIndex(i2o, 3),
                        i5 = getNewIndex(i3o, 4),
                        i6 = getNewIndex(i4o, 5);
                    faces.push([i1, i2, i3], [i4, i5, i6]);
                }else{
                    var i1 = dFaces[offset++],
                        i2 = dFaces[offset++],
                        i3 = dFaces[offset++];
                    i1 = getNewIndex(i1, 0);
                    i2 = getNewIndex(i2, 1);
                    i3 = getNewIndex(i3, 2);
                    faces.push([i1, i2, i3]);
                }
                if(hasMaterial){
                    offset++;
                }
                if(hasFaceUv){
                    for(var i = 0; i < nUvLayers; i++){
                        var uvLayer = dUvs[i];
                        var uvIndex = faces[offset++];
                        var u = uvLayer[uvIndex*2];
                        var v = uvLayer[uvIndex*2+1];
                        if(isQuad){
                            // Random write of array seems not slow
                            // http://jsperf.com/random-vs-sequence-array-set
                            isNew[0] && (texcoords[i][i1] = [u, v]);
                            isNew[1] && (texcoords[i][i2] = [u, v]);
                            isNew[2] && (texcoords[i][i3] = [u, v]);
                            isNew[3] && (texcoords[i][i4] = [u, v]);
                            isNew[4] && (texcoords[i][i5] = [u, v]);
                            isNew[5] && (texcoords[i][i6] = [u, v]);
                        }else{
                            isNew[0] && (texcoords[i][i1] = [u, v]);
                            isNew[1] && (texcoords[i][i2] = [u, v]);
                            isNew[2] && (texcoords[i][i3] = [u, v]);
                        }
                    }
                }
                if(hasFaceVertexUv){
                    for(var i = 0; i < nUvLayers; i++){
                        var uvLayer = dUvs[i];
                        for(var j = 0; j < nVertices; j++){
                            var uvIndex = dFaces[offset++];
                            faceUvs[j][0] = uvLayer[uvIndex*2];
                            faceUvs[j][1] = uvLayer[uvIndex*2+1];
                        }
                        if(isQuad){
                            // Use array slice to clone array is incredibly faster than 
                            // Construct from Float32Array
                            // http://jsperf.com/typedarray-v-s-array-clone/2
                            isNew[0] && (texcoords[i][i1] = faceUvs[0].slice());
                            isNew[1] && (texcoords[i][i2] = faceUvs[1].slice());
                            isNew[2] && (texcoords[i][i3] = faceUvs[3].slice());
                            isNew[3] && (texcoords[i][i4] = faceUvs[1].slice());
                            isNew[4] && (texcoords[i][i5] = faceUvs[2].slice());
                            isNew[5] && (texcoords[i][i6] = faceUvs[3].slice());
                        }else{
                            isNew[0] && (texcoords[i][i1] = faceUvs[0].slice());
                            isNew[1] && (texcoords[i][i2] = faceUvs[1].slice());
                            isNew[2] && (texcoords[i][i3] = faceUvs[2].slice());
                        }
                    }
                }
                if(hasFaceNormal){
                    var normalIndex = dFaces[offset++]*3;
                    var x = dNormals[normalIndex++];
                    var y = dNormals[normalIndex++];
                    var z = dNormals[normalIndex];
                    if(isQuad){
                        isNew[0] && (normals[i1] = [x, y, z]);
                        isNew[1] && (normals[i2] = [x, y, z]);
                        isNew[2] && (normals[i3] = [x, y, z]);
                        isNew[3] && (normals[i4] = [x, y, z]);
                        isNew[4] && (normals[i5] = [x, y, z]);
                        isNew[5] && (normals[i6] = [x, y, z]);
                    }else{
                        isNew[0] && (normals[i1] = [x, y, z]);
                        isNew[1] && (normals[i2] = [x, y, z]);
                        isNew[2] && (normals[i3] = [x, y, z]);
                    }
                }
                if(hasFaceVertexNormal){
                    for(var i = 0; i < nVertices; i++){
                        var normalIndex = dFaces[offset++]*3;
                        faceNormals[i][0] = dNormals[normalIndex++];
                        faceNormals[i][1] = dNormals[normalIndex++];
                        faceNormals[i][2] = dNormals[normalIndex];
                    }
                    if(isQuad){
                        isNew[0] && (normals[i1] = faceNormals[0].slice());
                        isNew[1] && (normals[i2] = faceNormals[1].slice());
                        isNew[2] && (normals[i3] = faceNormals[3].slice());
                        isNew[3] && (normals[i4] = faceNormals[1].slice());
                        isNew[4] && (normals[i5] = faceNormals[2].slice());
                        isNew[5] && (normals[i6] = faceNormals[3].slice());
                    }else{
                        isNew[0] && (normals[i1] = faceNormals[0].slice());
                        isNew[1] && (normals[i2] = faceNormals[1].slice());
                        isNew[2] && (normals[i3] = faceNormals[2].slice());
                    }
                }
                if(hasFaceColor){
                    var colorIndex = dFaces[offset++];
                    var color = hex2rgb(dColors[colorIndex]);
                    if(isQuad){
                        // Does't clone the color here
                        isNew[0] && (colors[i1] = color);
                        isNew[1] && (colors[i2] = color);
                        isNew[2] && (colors[i3] = color);
                        isNew[3] && (colors[i4] = color);
                        isNew[4] && (colors[i5] = color);
                        isNew[5] && (colors[i6] = color);
                    }else{
                        isNew[0] && (colors[i1] = color);
                        isNew[1] && (colors[i2] = color);
                        isNew[2] && (colors[i3] = color);
                    }
                }
                if(hasFaceVertexColor){
                    for(var i = 0; i < nVertices; i++){
                        var colorIndex = dFaces[offset++];
                        faceColors[i] = hex2rgb(dColors[colorIndex]);
                    }
                    if(isQuad){
                        isNew[0] && (colors[i1] = faceColors[0].slice());
                        isNew[1] && (colors[i2] = faceColors[1].slice());
                        isNew[2] && (colors[i3] = faceColors[3].slice());
                        isNew[3] && (colors[i4] = faceColors[1].slice());
                        isNew[4] && (colors[i5] = faceColors[2].slice());
                        isNew[5] && (colors[i6] = faceColors[3].slice());
                    }else{
                        isNew[0] && (colors[i1] = faceColors[0].slice());
                        isNew[1] && (colors[i2] = faceColors[1].slice());
                        isNew[2] && (colors[i3] = faceColors[2].slice());
                    }
                }
            }

            return geometryList;
        },

        parseSkeleton : function(data){
            var bones = [];
            var dBones = data.bones;
            for( var i = 0; i < dBones.length; i++){
                var dBone = dBones[i];
                var bone = new Bone({
                    parentIndex : dBone.parent,
                    name : dBone.name,
                    position : new Vector3(dBone.pos[0], dBone.pos[1], dBone.pos[2]),
                    rotation : new Quaternion(dBone.rotq[0], dBone.rotq[1], dBone.rotq[2], dBone.rotq[3]),
                    scale : new Vector3(dBone.scl[0], dBone.scl[1], dBone.scl[2])
                });
                bones.push(bone);
            }

            var skeleton = new Skeleton({
                bones : bones
            });
            skeleton.update();

            if( data.animation){
                var dFrames = data.animation.hierarchy;

                // Parse Animations
                for(var i = 0; i < dFrames.length; i++){
                    var channel = dFrames[i];
                    var bone = bones[i];
                    for(var j = 0; j < channel.keys.length; j++){
                        var key = channel.keys[j];
                        bone.poses[j] = {};
                        var pose = bone.poses[j];
                        pose.time = parseFloat(key.time);
                        if(key.pos){
                            pose.position = new Vector3(key.pos[0], key.pos[1], key.pos[2]);
                        }
                        if(key.rot){
                            pose.rotation = new Quaternion(key.rot[0], key.rot[1], key.rot[2], key.rot[3]);
                        }
                        if(key.scl){
                            pose.scale = new Vector3(key.scl[0], key.scl[1], key.scl[2]);
                        }
                    }
                }
            }

            return skeleton;
        },

        parseMaterial : function(mConfig, boneNumber){
            var shaderName = "buildin.lambert";
            var shading = mConfig.shading && mConfig.shading.toLowerCase();
            if( shading === "phong" || shading === "lambert"){
                shaderName = "buildin." + shading;
            }
            var enabledTextures = [];
            if( mConfig.mapDiffuse ){
                enabledTextures.push("diffuseMap");
            }
            if( mConfig.mapNormal || mConfig.mapBump ){
                enabledTextures.push('normalMap');
            }
            if(boneNumber == 0){
                var shader = shaderLibrary.get(shaderName, enabledTextures);
            }else{
                // Shader for skinned mesh
                var shader = new Shader({
                    vertex : Shader.source(shaderName+".vertex"),
                    fragment : Shader.source(shaderName+".fragment")
                })
                for(var i = 0; i < enabledTextures; i++){
                    shader.enableTexture(enabledTextures[i]);
                }
                shader.vertexDefines["SKINNING"] = null;
                shader.vertexDefines["BONE_MATRICES_NUMBER"] = boneNumber;
            }

            var material = new Material({
                shader : shader
            });
            if( mConfig.colorDiffuse ){
                material.setUniform("color", mConfig.colorDiffuse );
            }else if( mConfig.DbgColor){
                material.setUniform("color", hex2rgb(mConfig.DbgColor));
            }
            if( mConfig.colorSpecular ){
                material.setUniform("specular", mConfig.colorSpecular );
            }
            if(mConfig.transparent !== undefined && mConfig.transparent){
                material.transparent = true;
            }
            if( ! _.isUndefined(mConfig.depthTest)){
                material.depthTest = mConfig.depthTest;
            }
            if( ! _.isUndefined(mConfig.depthWrite)){
                material.depthTest = mConfig.depthWrite;
            }
            
            if(mConfig.transparency && mConfig.transparency < 1){
                material.setUniform("opacity", mConfig.transparency);
            }
            if(mConfig.specularCoef){
                material.setUniform("shininess", mConfig.specularCoef);
            }

            // Textures
            if( mConfig.mapDiffuse ){
                material.setUniform("diffuseMap", this.loadTexture(mConfig.mapDiffuse, mConfig.mapDiffuseWrap) );
            }
            if( mConfig.mapBump){
                material.setUniform("normalMap", this.loadTexture(mConfig.mapBump, mConfig.mapBumpWrap) );
            }
            if( mConfig.mapNormal){
                material.setUniform("normalMap", this.loadTexture(mConfig.mapNormal, mConfig.mapBumpWrap) );
            }

            return material;
        },

        loadTexture : function(path, wrap){
            var self = this;

            var img = new Image();
            var texture = new Texture2D();
            texture.image = img;

            this.textureNumber++;

            if( wrap && wrap.length ){
                texture.wrapS = wrap[0].toUpperCase();
                texture.wrapT = wrap[1].toUpperCase();
            }
            img.onload = function(){
                self.trigger("load:texture", texture);
                texture.dirty();
            }
            img.src = this.textureRootPath + "/" + path;

            return texture;
        }
    })


    function isBitSet(value, position){
        return value & ( 1 << position );
    }


    function hex2rgb(hex){
        var r = (hex >> 16) & 0xff,
            g = (hex >> 8) & 0xff,
            b = hex & 0xff;
        return [r/255, g/255, b/255];
    }

    function translateColor(color){
        return [color[0]/255, color[1]/255, color[2]/255];
    }

    return Loader
} );
define('loader/three/scene',['require','core/base','core/request','3d/scene','./model','3d/light/ambient','3d/light/directional','3d/light/spot','3d/light/point','3d/node','3d/texture/texture2d','3d/texture/texturecube','3d/mesh','3d/material','3d/geometry'],function(require){

    var Base = require("core/base");
    var request = require("core/request");
    var Scene = require("3d/scene");
    var Model = require("./model");
    var AmbientLight = require("3d/light/ambient");
    var DirectionalLight = require("3d/light/directional");
    var SpotLight = require("3d/light/spot");
    var PointLight = require("3d/light/point");
    var Node = require("3d/node");
    var Texture2D = require("3d/texture/texture2d");
    var TextureCube = require("3d/texture/texturecube");
    var Mesh = require("3d/mesh");
    var Material = require("3d/material");
    var Geometry = require("3d/geometry");

    var SceneLoader = Base.derive(function(){
        return {
            textureRootPath : "",
            textureNumber : 0
        }
    }, {

        load : function(url){
            var self = this;

            this.textureNumber = 0;

            request.get({
                url : url,
                onprogress : function(percent, loaded, total){
                    self.trigger("progress", percent, loaded, total);
                },
                onerror : function(e){
                    self.trigger("error", e);
                },
                responseType : "text",
                onload : function(data){
                    self.parse( JSON.parse(data) );
                }
            })
        },
        parse : function(data){
            var scene = new Scene();
            this.parseHierarchy(root, scene);
        },

        parseHierarchy : function(parentObjData, parentNode){
            
            for(var name in parentObjData){
                var childData = parentObjData[name];
                if(childData.geometry && childData.material){
                    var child = new Mesh();
                }else{
                    var child = new Node();
                }
            }
        }
    })
});
define('util/color',['require'], function(require){

	
} );
define('util/xmlparser',['require'], function(require){

});
define('qtek',['require','2d/camera','2d/node','2d/renderable/arc','2d/renderable/circle','2d/renderable/image','2d/renderable/line','2d/renderable/path','2d/renderable/polygon','2d/renderable/rectangle','2d/renderable/roundedrectangle','2d/renderable/sector','2d/renderable/text','2d/renderable/textbox','2d/renderer','2d/scene','2d/style','2d/util','3d/bone','3d/camera','3d/camera/orthographic','3d/camera/perspective','3d/compositor','3d/compositor/graph/graph','3d/compositor/graph/group','3d/compositor/graph/node','3d/compositor/graph/scenenode','3d/compositor/graph/texturenode','3d/compositor/graph/texturepool','3d/compositor/pass','3d/debug/pointlight','3d/debug/renderinfo','3d/framebuffer','3d/geometry','3d/geometry/cube','3d/geometry/plane','3d/geometry/sphere','3d/light','3d/light/ambient','3d/light/directional','3d/light/point','3d/light/spot','3d/material','3d/mesh','3d/node','3d/plugin/firstpersoncontrol','3d/plugin/orbitcontrol','3d/prepass/shadowmap','3d/renderer','3d/scene','3d/shader','3d/shader/library','3d/skeleton','3d/texture','3d/texture/compressed2d','3d/texture/compressedcube','3d/texture/texture2d','3d/texture/texturecube','3d/util/mesh','3d/webglinfo','animation/animation','animation/controller','animation/easing','core/base','core/cache','core/event','core/matrix3','core/matrix4','core/mixin/derive','core/mixin/dirty','core/mixin/notifier','core/quaternion','core/request','core/vector2','core/vector3','core/vector4','loader/three/model','loader/three/scene','util/color','util/util','util/xmlparser','glmatrix'], function(require){
	
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
	"3d": {
		"Bone": require('3d/bone'),
		"Camera": require('3d/camera'),
		"camera": {
			"Orthographic": require('3d/camera/orthographic'),
			"Perspective": require('3d/camera/perspective')
		},
		"Compositor": require('3d/compositor'),
		"compositor": {
			"graph": {
				"Graph": require('3d/compositor/graph/graph'),
				"Group": require('3d/compositor/graph/group'),
				"Node": require('3d/compositor/graph/node'),
				"SceneNode": require('3d/compositor/graph/scenenode'),
				"TextureNode": require('3d/compositor/graph/texturenode'),
				"TexturePool": require('3d/compositor/graph/texturepool')
			},
			"Pass": require('3d/compositor/pass')
		},
		"debug": {
			"Pointlight": require('3d/debug/pointlight'),
			"RenderInfo": require('3d/debug/renderinfo')
		},
		"FrameBuffer": require('3d/framebuffer'),
		"Geometry": require('3d/geometry'),
		"geometry": {
			"Cube": require('3d/geometry/cube'),
			"Plane": require('3d/geometry/plane'),
			"Sphere": require('3d/geometry/sphere')
		},
		"Light": require('3d/light'),
		"light": {
			"Ambient": require('3d/light/ambient'),
			"Directional": require('3d/light/directional'),
			"Point": require('3d/light/point'),
			"Spot": require('3d/light/spot')
		},
		"Material": require('3d/material'),
		"Mesh": require('3d/mesh'),
		"Node": require('3d/node'),
		"plugin": {
			"FirstPersonControl": require('3d/plugin/firstpersoncontrol'),
			"OrbitControl": require('3d/plugin/orbitcontrol')
		},
		"prepass": {
			"ShadowMap": require('3d/prepass/shadowmap')
		},
		"Renderer": require('3d/renderer'),
		"Scene": require('3d/scene'),
		"Shader": require('3d/shader'),
		"shader": {
			"library": require('3d/shader/library')
		},
		"Skeleton": require('3d/skeleton'),
		"Texture": require('3d/texture'),
		"texture": {
			"Compressed2d": require('3d/texture/compressed2d'),
			"Compressedcube": require('3d/texture/compressedcube'),
			"Texture2D": require('3d/texture/texture2d'),
			"TextureCube": require('3d/texture/texturecube')
		},
		"util": {
			"mesh": require('3d/util/mesh')
		},
		"WebGLInfo": require('3d/webglinfo')
	},
	"animation": {
		"Animation": require('animation/animation'),
		"Controller": require('animation/controller'),
		"Easing": require('animation/easing')
	},
	"core": {
		"Base": require('core/base'),
		"Cache": require('core/cache'),
		"Event": require('core/event'),
		"Matrix3": require('core/matrix3'),
		"Matrix4": require('core/matrix4'),
		"mixin": {
			"derive": require('core/mixin/derive'),
			"Dirty": require('core/mixin/dirty'),
			"notifier": require('core/mixin/notifier')
		},
		"Quaternion": require('core/quaternion'),
		"requester": require('core/request'),
		"Vector2": require('core/vector2'),
		"Vector3": require('core/vector3'),
		"Vector4": require('core/vector4')
	},
	"loader": {
		"three": {
			"Model": require('loader/three/model'),
			"Scene": require('loader/three/scene')
		}
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
var qtek = require("qtek");

for(var name in qtek){
	_exports[name] = qtek[name];
}

})