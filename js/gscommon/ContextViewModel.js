/**
 * Created with JetBrains WebStorm.
 * User: olegg
 * Date: 8/29/13
 * Time: 11:53 AM
 * To change this template use File | Settings | File Templates.
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/when",
    "dojo/promise/all"
], function(declare, lang, array, when, all) {

    var getDynaEntityValues = function(/*Object*/ dynaEntity) {
        var results = {entities: {}, values: {}}, compResults, i, l, hierarchyId;
        if (dynaEntity) {
            if (dynaEntity["hierarchyId"]) {
                hierarchyId = dynaEntity["hierarchyId"]
                results.entities[hierarchyId] = {
                    id: dynaEntity["id"],
                    version: dynaEntity["version"],
                    referenceKeys: dynaEntity["referenceKeys"]
                };
            }
            if (dynaEntity["values"]) {
                lang.mixin(results.values, dynaEntity["values"]);
            }
            if (dynaEntity["complementedEntities"] && dynaEntity["complementedEntities"].length) {
                for (i = 0, l = dynaEntity["complementedEntities"].length; i < l; i++) {
                    compResults = getDynaEntityValues(dynaEntity["complementedEntities"][i]);
                    lang.mixin(results.entities, compResults.entities);
                    lang.mixin(results.values, compResults.values);
                }
            }
        }
        return results;
    };

    var loadDependModels = function(/*Object*/ entityInfo, /*Object*/ dependModels, /*int*/ securityContextId, /*Boolean*/ locked) {
        var values, propName;
        if (dependModels) {
            values = entityInfo["values"];
            for (propName in dependModels) {
                when(dependModels[propName], function(model) {
                    var columns, value, i, l;
                    if (model.columns && model.load) {
                        columns = model.columns();
                        if (columns && columns.length) {
                            if (columns.length > 1) {
                                // value is an object with columnIds as property names with
                                // their respective values
                                for (i = 0, l = columns.length; i < l; i++) {
                                    if (columns[i].id && values[columns[i].id]) {
                                        value = value || {};
                                        value[columns[i].id] = values[columns[i].id].value;
                                    }
                                }
                            } else {
                                // value is a simple value
                                if (columns[0].id && values[columns[0].id]) {
                                    value = values[columns[0].id].value;
                                }
                            }
                            //if (value) {
                                model.load(value, securityContextId, locked);
                            //}
                        }
                    }
                });
            }
        }
    };

    return declare(null, {
        id: null,
        version: null,
        referenceKeys: null,
        hierarchyId: null,
        securityContextId: null,
        constructor: function(args) {
            lang.mixin(this, args);
        },
        init: function(/*Integer*/ contextId, /*Object*/ modelDefinition,
                       /*Object*/ dependentModels, /*Object*/ selfUpdateModels) {

            this._contextId = contextId;
            this._modelDef = modelDefinition;
            this.hierarchyId = modelDefinition.modelInfo.hierarchyId;
            this._dependModels = dependentModels;
            this._selfUpdateModels = selfUpdateModels;
        },
        load: function(/*int*/ id, /*int*/ securityContextId, /*Boolean*/ locked) {
            var self = this, idObject;
            var headers = this.app.galSysSessionInfo && this.app.galSysSessionInfo.headers;
            if (self.app && self.app.stores && self.app.stores.dynaEntityStore) {
                idObject = {
                    id: {
                        modelcomposition: self._modelDef.id,
                        item: id
                    },
                    query: {
                        contextid: self._contextId,
                        securitycontextid: securityContextId
                    }
                };
                if (self._loadDataPromise && self._loadDataPromise.cancel) {
                    // cancel pending data load request
                    self._loadDataPromise.cancel();
                }
                self._loadDataPromise = self.app.stores.dynaEntityStore.store.get(idObject, {headers: headers});
                when(self._saveDataPromise, function(loadedDynaEntity) {
                    when(self._loadDataPromise, function(dynaEntity) {
                        var entityInfo, propName, updModel, entity;
                        entityInfo = getDynaEntityValues(dynaEntity);
                        loadDependModels(entityInfo, self._dependModels, securityContextId, locked);
                        if (self._selfUpdateModels) {
                            for (propName in self._selfUpdateModels) {
                                updModel = self._selfUpdateModels[propName];
                                if (updModel["hierarchyId"]) {
                                    entity = entityInfo["entities"][updModel["hierarchyId"]];
                                    if (entity) {
                                        updModel.id = entity.id;
                                        updModel.version = entity.version;
                                        updModel.referenceKeys = entity.referenceKeys;
                                        updModel.securityContextId = securityContextId;
                                    }
                                }
                            }
                        }
                    }, function(error) {

                    });
                });
                return all([self._saveDataPromise, self._loadDataPromise]);
            }
        },
        save: function() {
            var self = this, dynaEntity, propName, modValues, idObject;
            var headers = self.app.galSysSessionInfo && self.app.galSysSessionInfo.headers,
                store = self.app.stores.dynaEntityStore.store, saveMethod;
            if (self._dependModels && all(self._dependModels).isResolved()) {
                when(self._saveDataPromise, function(savedDynaEntity) {
                    for (propName in self._dependModels) {
                        when(self._dependModels[propName], function(model) {
                            var columns, value, oldValue, i, l;
                            model.save && model.save();
                            if (model.columns && model.modified()) {
                                columns = model.columns();
                                value = model.value;
                                oldValue = model.getOldValue();
                                if (columns && columns.length) {
                                    if (columns.length > 1) {
                                        for (i = 0, l = columns.length; i < l; i++) {
                                            if (columns[i].id) {
                                                modValues = modValues || {};
                                                modValues[columns[i].id] = {
                                                    value: value[columns[i].id],
                                                    oldValue: oldValue[columns[i].id]
                                                };
                                            }
                                        }
                                    } else {
                                        if (columns[0].id) {
                                            modValues = modValues || {};
                                            modValues[columns[0].id] = {
                                                value: value,
                                                oldValue: oldValue
                                            }
                                        }
                                    }
                                }
                            }

                        });
                    }
                    if (modValues) {
                        // !!! - do not uncomment this section - back-end service does not require all columns anymore.
                        //if (self.version === null) {
                        //    // when adding a new record as opposed to modifying an existing one
                        //    // include all column values even if they are not populated (back-end service requirement)
                        //    for (propName in self._dependModels) {
                        //        when(self._dependModels[propName], function(model) {
                        //            var columns, i, l;
                        //            if (model.columns) {
                        //                columns = model.columns();
                        //                if (columns && columns.length) {
                        //                    for (i = 0, l = columns.length; i < l; i++) {
                        //                        if (columns[i].id && !(columns[i].id in modValues)) {
                        //                            modValues[columns[i].id] = {
                        //                                value: null,
                        //                                oldValue: null
                        //                            };
                        //                        }
                        //                    }
                        //                }
                        //            }
                        //        });
                        //    }
                        //}
                        dynaEntity = {
                            id: self.id,
                            hierarchyId: self.hierarchyId,
                            version: self.version,
                            values: modValues,
                            referenceKeys: self.referenceKeys
                        };
                        idObject = {
                            id: {
                                modelcomposition: self._modelDef.id
                                //item: self.id
                            },
                            query: {
                                contextid: self._contextId,
                                securitycontextid: self.securityContextId
                            }
                        };
                        // commit data changes to the back end
                        saveMethod = lang.hitch(store, (self.version === null) ? store.add : store.put);
                        self._saveDataPromise = saveMethod(dynaEntity, {idObject: idObject, headers: headers});
                        when(self._saveDataPromise, function(dynaEntity) {
                            var entityInfo, entity;
                            entityInfo = getDynaEntityValues(dynaEntity);
                            loadDependModels(entityInfo, self._dependModels);
                            entity = entityInfo["entities"][self.hierarchyId];
                            if (entity) {
                                self.id = entity.id;
                                self.version = entity.version;
                                self.referenceKeys = entity.referenceKeys;
                            }

                        }, function(error) {

                        });
                    }
                });
                return self._saveDataPromise;
            }
        },
        validate: function() {
            return true;
        }
    });
});