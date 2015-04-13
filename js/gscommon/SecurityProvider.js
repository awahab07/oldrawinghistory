/**
 * Created with JetBrains WebStorm.
 * User: jason
 * Date: 2/11/14
 * Time: 1:15 PM
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/Deferred",
    "dojo/store/Memory",
    "dojo/store/JsonRest",
    "dojo/when",
    "dojo/promise/all",
    "./utilities"
], function(declare, lang, array, Deferred, Memory, JsonRest, when, all, utils) {
    var securityStore, cacheExists, securityInfoCache;

    var initializeCache = function () {
        securityInfoCache = {};
        cacheExists = true;
    };

    return declare(null, {
        constructor: function(args) {
            lang.mixin(this, args);

            if (!cacheExists) {
                initializeCache();
            }

            var self = this;
            var headers = self.commonContext.headers;
            var securityUrl = self.services.security;

            securityStore = new JsonRest({
                target: securityUrl,
                headers: headers
            });
        },
        getSecurityInfo: function(/* Number */ hierarchyId, /* Number */ departmentId){
            /** returns secruity info for given hierarchy and department. If previously requested returns the cached
             * version
             */
            var self = this;
            var query, deferred = new Deferred();
            var cacheKey = departmentId + "_" + hierarchyId;
            var cached = securityInfoCache[cacheKey];

            if(cached){
                deferred.resolve(cached);
            }else{
                query = { hierarchies: hierarchyId,
                          departmentId: departmentId,
                          userId: self.commonContext.user.id};
                securityStore.query(query).then(function(results){
                    securityInfoCache[departmentId + "_" + hierarchyId] = results;
                    deferred.resolve(results);
                 });
            }
            return deferred.promise;
        },
        clearCache: function() {
            initializeCache();
        }
    });
});