/**
 * Created by muhammad.shahzad on 9/18/2014.
 */
define(["dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/Deferred",
    "dojo/store/Memory",
    "dojo/store/JsonRest",
    "dojo/when",
    "dojo/promise/all",
    "dojo/request/xhr",
    "dojo/io-query"
], function (declare, lang, array, Deferred, Memory, JsonRest, when, all, xhr, ioQuery) {
    var cacheExists, departmentMap, securityGroupMap,deferredsCache;
    var initializeCache = function () {
        departmentMap = {};
        securityGroupMap = {};
        cacheExists = true;
        deferredsCache=[];
    };
    return declare(null, {
        app: null,
        constructor: function (args) {
            //this.app = {};
            //lang.mixin(this.app, args);
            lang.mixin(this, args);

            if (!cacheExists) {
                initializeCache();
            }
        },
        getCRUDRights: function (/* Number */ departmentId, /* string */ hierarchyId) {
            var self = this;
            var deferred = new Deferred();
            var securityGroupPromise = self.getSecurityGroup(departmentId, hierarchyId);
            when(securityGroupPromise, function (securityGroup) {
                var result = self.processSecurityGroup(securityGroup, hierarchyId);
                deferred.resolve(result);
            }, function (error) {
                deferred.reject(error);
            });
            return deferred.promise;
        },
        getFunctionalPermissions: function (/* String */ activity, /* Number */ departmentId) {
            var self = this;
            var deferred = new Deferred();
            var functionalSecurityExists = false;
            var securityGroupId = departmentMap[departmentId];
            var securityGroup = securityGroupMap[securityGroupId];
            if (securityGroup) {
                var functionalSecurities = securityGroup.functionalSecurities;
                for (var i = 0, l = functionalSecurities.length; i < l; i++) {
                    if (activity == functionalSecurities[i].activity) {
                        functionalSecurityExists = true;
                    }
                }
                deferred.resolve(functionalSecurityExists);
                return deferred.promise;
            } else {
                var securityGroupPromise = self.getSecurityGroup(departmentId, "3");
                when(securityGroupPromise, function (securityGroup) {
                    var functionalSecurities = securityGroup.functionalSecurities;
                    for (var i = 0, l = functionalSecurities.length; i < l; i++) {
                        if (activity == functionalSecurities[i].activity) {
                            functionalSecurityExists = true;
                        }
                    }
                    deferred.resolve(functionalSecurityExists);
                }, function (error) {
                    deferred.reject(error);
                });
                return deferred.promise;
            }

        },
        getSecurityGroup: function (/* Number */ departmentId, /* String */ hierarchyId) {
            var self = this;
            var hierarchyObj;
            var deferred = new Deferred();
            var securityGroupId = departmentMap[departmentId];
            var securityGroup = securityGroupMap[securityGroupId];
            if (securityGroup) {
                var tableAccess = securityGroup.tableAccess;
                hierarchyObj = tableAccess[hierarchyId];
                if (hierarchyObj) {
                    deferred.resolve(securityGroup);
                    return deferred.promise;
                }
            }
            if (!securityGroup || !hierarchyObj) {
                var securityQuery = {
                    userId: self.app.galSysSessionInfo.user.id,
                    hierarchies: hierarchyId
                };
                if (departmentId >= 0) {
                    securityQuery.departmentId = departmentId;
                }
                var queryString = ioQuery.objectToQuery(securityQuery);
                for(var d= 0,l=deferredsCache.length;d<l;d++){
                    if(deferredsCache[d].departmentId==departmentId&&deferredsCache[d].hierarchyId==hierarchyId&& deferredsCache[d].userId==self.app.galSysSessionInfo.user.id){
                        return deferredsCache[d].promise;
                    }
                }
                xhr(self.app.galSysServiceUrls.security + "?" + queryString, {
                    handleAs: "json",
                    headers: self.app.galSysSessionInfo.headers,
                    sync: false
                }).then(function (response) {
                    var securityGroupId = departmentMap[departmentId];
                    var securityGroup = securityGroupMap[securityGroupId];
                    if (securityGroup) {
                        var tableAccess = securityGroup.tableAccess;
                        hierarchyObj = tableAccess[hierarchyId];
                    }
                    if (securityGroup && !hierarchyObj) {
                        securityGroupMap[response.id].tableAccess[hierarchyId] = response.tableAccess[hierarchyId];
                    } else {
                        departmentMap[departmentId] = response.id;
                        if(securityGroupMap[response.id]){
                            securityGroupMap[response.id].tableAccess[hierarchyId]=response.tableAccess[hierarchyId];
                        }else
                        securityGroupMap[response.id] = response;
                    }
                    deferred.resolve(securityGroupMap[response.id]);
                }, function (error) {
                    deferred.reject(error);
                });
                deferred["departmentId"]=departmentId;
                deferred["hierarchyId"]=hierarchyId;
                deferred["userId"]=self.app.galSysSessionInfo.user.id;
                deferredsCache.push(deferred);
                return deferred.promise;
            }
        },
        processSecurityGroup: function (securityGroup, hierarchyId) {
            var result = {};
            var mapObj = {};
            var tableAccess = securityGroup.tableAccess;
            var hierarchyObj = tableAccess[hierarchyId];
            result["hierarchyAccess"] = hierarchyObj.accessInfo;
            var columnAccess = hierarchyObj.columnAccess;
            for (var col in columnAccess) {
                mapObj[col] = {"read": columnAccess[col].readable, "write": columnAccess[col].writable};
            }
            result["columnMap"] = mapObj;
            return result;
        },
        clearCache: function () {
            initializeCache();
        }
    });
});
