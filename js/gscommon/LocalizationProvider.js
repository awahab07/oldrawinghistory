/**
 * Created with JetBrains WebStorm.
 * User: olegg
 * Date: 5/29/13
 * Time: 5:54 PM
 * To change this template use File | Settings | File Templates.
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
    var subscriptions = [], cachedScopes = {};
    var literalCache, columnLabelCache, tableLabelCache, customLabelCache, hierarchyLabelCache, cacheExists,
        literalStore, columnLabelStore, tableLabelStore, customLabelStore, hierarchyLabelStore;

    var initializeCache = function() {
        tableLabelCache = new Memory({});
        columnLabelCache = new Memory({});
        literalCache = new Memory({});
        hierarchyLabelCache = new Memory({});
        customLabelCache = new Memory({idProperty: "compositeId"});
        cacheExists = true;
    };

    var localizeLabels = function(/*Object*/ subscription, /*Optional String*/ scope, /*Optional Integer*/ scopeId) {
        var requestedLabels, returnedLabels, localizeCallback;

        if (subscription) {
            requestedLabels = subscription.labels;
            localizeCallback = subscription.callback;
            if (localizeCallback && requestedLabels && requestedLabels.length) {
                returnedLabels = [];
                array.forEach(requestedLabels, function(reqItem) {
                    var label, results, labelCache, itemFound, applyStandard = false;
                    if (scope && scopeId !== undefined) {
                        // get custom localization labels
                        results = customLabelCache.query(function(item) {
                            return item.id.customizationType == reqItem.type &&
                                item.id.id == reqItem.id &&
                                item.id.scope == scope &&
                                (item.id.scopeId === scopeId || item.id.scopeId === subscription.scopeId);
                        });
                        if (results && results.length) {
                            applyStandard = (results.length == 1 && results[0].id.scopeId !== scopeId)
                            if (!applyStandard) {
                                if (results.length > 1) {
                                    results = array.filter(results, function(item) {
                                        return (item.id.scopeId === scopeId);
                                    });
                                }
                                label = {
                                    type: results[0].id.customizationType,
                                    id: results[0].id.id,
                                    label: results[0].literal
                                };
                            }
                        }
                    } else {
                        applyStandard = true;
                    }
                    if (applyStandard) {
                        // get standard localization labels
                        switch (reqItem.type) {
                            case "LOCALIZATION_COLUMN":
                                labelCache = columnLabelCache;
                                break;
                            case "LOCALIZATION_TABLE":
                                labelCache = tableLabelCache;
                                break;
                            case "LOCALIZATION_LITERAL":
                                labelCache = literalCache;
                                break;
                            case "LOCALIZATION_HIERARCHY":
                                labelCache = hierarchyLabelCache;
                                break;
                        }
                        itemFound = labelCache.get(reqItem.id);
                        if (itemFound) {
                            label = {
                                type: reqItem.type,
                                id: itemFound.id,
                                label: itemFound.literal
                            };
                        } else {
                            label = {
                                type: reqItem.type,
                                id: reqItem.id,
                                label: reqItem.defaultLabel
                            }
                        }
                    }
                    if (label) {
                        returnedLabels.push(label);
                    }
                });
                if (returnedLabels.length) {
                    localizeCallback(returnedLabels, !!scope);
                }
            }
            if (scope && scopeId !== undefined) {
                subscription.scopeId = scopeId;
            }
        }
    };

    var localizeScope = function(scope, scopeId, localizationContext) {
        var contextSubscriptions = array.filter(subscriptions, function(subscription) {
            return (subscription && subscription.scope === scope && subscription.context === localizationContext);
        });
        array.forEach(contextSubscriptions, function(subscription) {
            localizeLabels(subscription, scope, scopeId);
        });
    };

    var requestStandardLabels = function(/*Array*/ requestedLabels, /*Object*/ provider) {
        var newLiterals = [], newColumnLabels = [], newTableLabels = [], newHierarchyLabels = [];
        var literalIdList, columnLabelIdList, tableLabelIdList, hierarchyLabelIdList;
        var allPromises = {}, deferred;

        array.forEach(requestedLabels, function(item) {
            switch(item.type) {
                case "LOCALIZATION_COLUMN":
                    if (!columnLabelCache.get(item.id)) {
                        newColumnLabels.push({
                            id: item.id,
                            defaultLabel: item.defaultLabel
                        });
                    }
                    break;
                case "LOCALIZATION_TABLE":
                    if (!tableLabelCache.get(item.id)) {
                        newTableLabels.push({
                            id: item.id,
                            defaultLabel: item.defaultLabel
                        });
                    }
                    break;
                case "LOCALIZATION_LITERAL":
                    if (!literalCache.get(item.id)) {
                        newLiterals.push({
                            id: item.id,
                            defaultLabel: item.defaultLabel
                        });
                    }
                    break;
                case "LOCALIZATION_HIERARCHY":
                    if (!hierarchyLabelCache.get(item.id)) {
                        newHierarchyLabels.push({
                            id: item.id,
                            defaultLabel: item.defaultLabel
                        });
                    }
                    break;
            }
        });
        if (newColumnLabels.length) {
            columnLabelIdList = array.map(newColumnLabels, function(item) {return item.id;}).join(",");
            allPromises["columnLabels"] = columnLabelStore.query({ids: columnLabelIdList}, {headers: provider.commonContext.headers});
        }
        if (newTableLabels.length) {
            tableLabelIdList = array.map(newTableLabels, function(item) {return item.id}).join(",");
            allPromises["tableLabels"] = tableLabelStore.query({ids: tableLabelIdList}, {headers: provider.commonContext.headers});
        }
        if (newLiterals.length) {
            literalIdList = array.map(newLiterals, function(item) {return item.id}).join(",");
            allPromises["literals"] = literalStore.query({ids: literalIdList}, {headers: provider.commonContext.headers});
        }
		if (newHierarchyLabels.length) {
            hierarchyLabelIdList = array.map(newHierarchyLabels, function(item) {return item.id}).join(",");
            allPromises["hierarchyLabels"] = hierarchyLabelStore.query({ids: hierarchyLabelIdList}, {headers: provider.commonContext.headers});
        }
        if (columnLabelIdList || tableLabelIdList || literalIdList || hierarchyLabelIdList) {
            deferred = new Deferred();
            when(all(allPromises), function(allResults) {
                var labelCache, labels;
                for (var labelType in allResults) {
                    switch (labelType) {
                        case "columnLabels":
                            labelCache = columnLabelCache;
                            break;
                        case "tableLabels":
                            labelCache = tableLabelCache;
                            break;
                        case "literals":
                            labelCache = literalCache;
                            break;
						case "hierarchyLabels":
                            labelCache = hierarchyLabelCache;
                            break;
                    }
                    if (labelCache) {
                        labels = allResults[labelType];
                        if (labels) {
                            for (var i = 0, l = labels.length; i < l; i++) {
                                labelCache.put(labels[i], {overwrite: true});
                            }
                        }
                    }
                }
                deferred.resolve(allResults);
            }, function(error) {
                deferred.reject(error);
            });
            return deferred.promise;
        } else {
            return null;
        }
    };

    var requestScopeLabels = function(/*String*/ scope, /*Object*/ provider) {
        var deferred;

        if (!cachedScopes[scope]) {
            cachedScopes[scope] = true;
            deferred = new Deferred();
            when(customLabelStore.get(scope, {headers: provider.commonContext.headers}), function(customLabels) {
                array.forEach(customLabels, function(customLabel) {
                    customLabelCache.put(customLabel, {
                        compositeId: customLabel.id.customizationType + customLabel.id.id + customLabel.id.scope + customLabel.id.scopeId,
                        overwrite: true
                    });
                });
                deferred.resolve(customLabels);
            }, function(error) {
                deferred.reject(error);
            });
            return deferred.promise;
        } else {
            return null;
        }
    };

    return declare(null, {
        commonContext: null,
        scope: null,
        columnLabelStore: null,
        tableLabelStore: null,
        literalStore: null,
        customLabelStore: null,
        hierarchyLabelStore: null,
        constructor: function(args) {
            lang.mixin(this, args);
            if (!cacheExists) {
                initializeCache();
            }
            columnLabelStore = columnLabelStore || this.columnLabelStore;
            tableLabelStore = tableLabelStore || this.tableLabelStore;
            literalStore = literalStore || this.literalStore;
            customLabelStore = customLabelStore || this.customLabelStore;
			hierarchyLabelStore = hierarchyLabelStore || this.hierarchyLabelStore;
        },
        localizeAll: function() {
            var self = this;
            var labelPromise, labelPromises = [];
            array.forEach(subscriptions, function(subscription) {
                if (subscription) {
                    labelPromise = requestStandardLabels(subscription.labels, self);
                    if (labelPromise) {
                        labelPromises.push(labelPromise);
                    }
                }
            });
            for (var cachedScope in cachedScopes) {
                if (cachedScopes.hasOwnProperty(cachedScope)) {
                    labelPromise = requestScopeLabels(cachedScope, this);
                    labelPromises.push(labelPromise);
                }
            }
            if (labelPromises && labelPromises.length) {
                when(all(labelPromises), function(results) {
                    array.forEach(subscriptions, function(subscription) {
                        if (subscription) {
                            localizeLabels(subscription);
                            if (subscription.scope && subscription.scopeId) {
                                localizeLabels(subscription, subscription.scope, subscription.scopeId);
                            }
                        }
                    });
                }, function(error) {
                    array.forEach(subscriptions, function(subscription) {
                        if (subscription) {
                            localizeLabels(subscription);
                            if (subscription.scope && subscription.scopeId) {
                                localizeLabels(subscription, subscription.scope, subscription.scopeId);
                            }
                        }
                    });
                });
            } else {
                array.forEach(subscriptions, function(subscription) {
                    if (subscription) {
                        localizeLabels(subscription);
                        if (subscription.scope && subscription.scopeId) {
                            localizeLabels(subscription, subscription.scope, subscription.scopeId);
                        }
                    }
                });
            }
        },
        setScope: function(/*Integer*/ scopeId, /*String*/ scope, /*String*/ localizationContext) {
            var scopePromise,
                effectiveScope = scope ? scope : this.scope;

            scopePromise = requestScopeLabels(effectiveScope, this);
            if (scopePromise) {
                when(scopePromise, function(results) {
                    localizeScope(effectiveScope, scopeId, localizationContext);
                }, function(error) {
                    localizeScope(effectiveScope, scopeId, localizationContext);
                });
            } else {
                localizeScope(effectiveScope, scopeId, localizationContext);
            }
        },
        subscribe: function(/*Array*/ requestedLabels, /*Function*/ localize, /*String*/ scope, /*String*/ localizationContext) {
            var labelPromise, self = this;

            var subscription = {
                labels: requestedLabels,
                callback: localize,
                scope: ((scope === undefined) || (localizationContext && !scope)) ? self.scope : scope,
                context: localizationContext
            };
            var subscriptionIndex = subscriptions.push(subscription) - 1;

            labelPromise = requestStandardLabels(requestedLabels, this);
            if (labelPromise) {
                when(labelPromise, function(results) {
                    localizeLabels(subscription);
                }, function(error) {
                    localizeLabels(subscription);
                });
            } else {
                localizeLabels(subscription);
            }

            return {
                cancel: function () {
                    // since we remove subscriptions by array index
                    // we should preserve array size so that the index
                    // always refers to the right subscription
                    // (using "delete" instead of "splice")
                    delete subscriptions[subscriptionIndex];
                }
            };
        },
        clearCache: function() {
            initializeCache();
            for (var prop in cachedScopes) {
                if (cachedScopes.hasOwnProperty(prop)) {
                    cachedScopes[prop] = false;
                }
            }
        }
    });
});