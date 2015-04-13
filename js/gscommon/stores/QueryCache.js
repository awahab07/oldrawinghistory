/**
 * Created by oleg.gololobov on 7/16/2014.
 */
define([
    "dojo/_base/lang",
    "dojo/Deferred",
    "dojo/when",
    "dojo/store/util/QueryResults"
], function(lang, Deferred, when, QueryResults) {
    /*
    var __CacheArgs = {
        // summary:
        //		These are additional options for how caching is handled.
        // isLoaded: Function?
        //		This is a function that will be called for each item in a query response to determine
        //		if it is cacheable. If isLoaded returns true, the item will be cached, otherwise it
        //		will not be cached. If isLoaded is not provided, all items will be cached.
        // transform: Function? || Object?
        //      This option can be provided as either a function or an object.
        //
        //      If it is provided as a function then that function has to accept 2 parameters:
        //          - item: Object
        //          - reverse: Boolean?
        //      Example: transform = function(item, reverse) {return item};
        //      In the above example no actual transformation takes place. For the "transform" function to be useful
        //      it has to transform the passed item in such a way that it could be transformed back to
        //      its original state without any loss of information.
        //      One useful scenario would be to add new properties to the item with values calculated based on
        //      the existing property values. When performing reverse transformation the calculated properties
        //      have to be removed.
        //
        //      If the "transform" option is specified as an object then that object defines a set of
        //      calculated properties which will be added to the master store item before it gets cached
        //      in the caching store. All those properties will be removed when passing the item to the master store.
        //      Example:
        //              transform = {
        //                  _languageLabel: {
        //                      definePropertyGetter: false,
        //                      get: function() {return this.label}
        //                  },
        //                  _termTypeLabel: {
        //                      definePropertyGetter: true,
        //                      get: function() {return this.typeLabel}
        //                  }
        //              }
        //      If the "transform" object is defined as in the example above the transformed item
        //      will obtain 2 new properties: "_languageLabel" and "_termTypeLabel".
        //      These properties will be assigned values calculated by the "get" method.
        //      If "definePropertyGetter" is set to true the new property will be defined using Object.defineProperty()
        //      method with the provided "get" method supplied as a property getter, otherwise the new property value
        //      is going to be calculated at the time the store item is cached using the same "get" method.
        //      Notice that the "get" method scope is "hitched" to the store item - you can access store item properties
        //      by using "this".
    };
    */

    var QueryCache = function(masterStore, cachingStore, options){
        // summary:
        //		The QueryCache store wrapper takes a master store and a caching store,
        //		caches data from the master into the caching store for faster
        //		lookup. Normally one would use a memory store for the caching
        //		store and a server store like JsonRest for the master store.
        //
        //      QueryCache is based on and is similar to dojo/store/Cache with the following major differences:
        //
        //      1. "query" method queries only the caching store - in order to get any results
        //         the caching store has to be populated.
        //      2. to populate the caching store "cache" method has to be called.
        //      3. there is a new optional member in the options parameter - "transform", which is used to transform
        //         master store items to caching store items and vice versa.
        //
        // example:
        //	|	var master = new Memory(data);
        //	|	var cacher = new Memory();
        //	|	var store = new QueryCache(master, cacher);
        //
        // masterStore:
        //		This is the authoritative store, all uncached requests or non-safe requests will
        //		be made against this store.
        // cachingStore:
        //		This is the caching store that will be used to store responses for quick access.
        //		Typically this should be a local store.
        // options: __CacheArgs?
        //		These are additional options for how caching is handled.

        var transform,
            noTransform = function(object, reverse) {
                // default transform preserves the original object - no actual transformation performed
                return object;
            };

        options = options || {};
        if (options.transform) {
            if (typeof options.transform == "function") {
                // use supplied transform function
                transform = options.transform;
            } else if (typeof options.transform == "object") {
                // define transform function using supplied object as a definition for calculated properties
                transform = function(object, reverse) {
                    var propName, propValue, result, extraProps;
                    if (object && typeof object == "object") {
                        result = lang.clone(object);
                        extraProps = options.transform;
                        if (reverse) {
                            for (propName in extraProps) {
                                if (propName in result) {
                                    delete result[propName];
                                }
                            }
                        } else {
                            for (propName in extraProps) {
                                if (extraProps[propName] && typeof extraProps[propName] == "object") {
                                    if (extraProps[propName].definePropertyGetter) {
                                        Object.defineProperty(result, propName, {
                                            get: lang.hitch(result, extraProps[propName].get)
                                        });
                                    } else {
                                        propValue = lang.hitch(result, extraProps[propName].get)(result);
                                        if (typeof propValue !== "undefined") {
                                            result[propName] = propValue;
                                        }
                                    }
                                }
                            }
                        }
                        return result;
                    } else {
                        return object;
                    }
                }
            } else {
                transform = noTransform;
            }
        } else {
            transform = noTransform;
        }
        return lang.delegate(masterStore, {
            _cacheResults: null,
            cache: function(query, directives){
                this._cacheResults = masterStore.query(query, directives);
                this._cacheResults.forEach(function(object){
                    if(!options.isLoaded || options.isLoaded(object)){
                        cachingStore.put(transform(object));
                    }
                });
                return this._cacheResults;
            },
            query: function(query, directives){
                // summary:
                //		Query the caching store.
                // query: Object|String
                //		The object or string containing query information. Dependent on the query engine used.
                // directives: dojo/store/api/Store.QueryOptions?
                //		An optional keyword arguments object with additional parameters describing the query.
                // returns: dojo/store/api/Store.QueryResults
                //		A QueryResults object that can be used to iterate over.
                var self = this,
                    cacheResults = new Deferred();

                when(self._cacheResults, function() {
                    when(cachingStore.query(query, directives), function(results) {
                        cacheResults.resolve(results);
                    }, function(error) {
                        cacheResults.reject(error);
                    });
                }, function(error) {
                    cacheResults.reject(error);
                });
                cacheResults.total = cacheResults.then(function(results) {
                    return results.total;
                });
                return QueryResults(cacheResults);

            },
            // look for a queryEngine in either store
            queryEngine: masterStore.queryEngine || cachingStore.queryEngine,
            get: function(id, directives){
                // summary:
                //		Get the object with the specific id.
                // id: Number
                //		The identifier for the object in question.
                // directives: Object?
                //		Any additional parameters needed to describe how the get should be performed.
                // returns: dojo/store/api/Store.QueryResults
                //		A QueryResults object.
                return when(cachingStore.get(id), function(result){
                    return result || when(masterStore.get(id, directives), function(result){
                        var cachingStoreResult = transform(result);
                        if(cachingStoreResult){
                            cachingStore.put(cachingStoreResult, {id: id});
                        }
                        return cachingStoreResult;
                    });
                });
            },
            add: function(object, directives){
                // summary:
                //		Add the given object to the store.
                // object: Object
                //		The object to add to the store.
                // directives: dojo/store/api/Store.AddOptions?
                //		Any additional parameters needed to describe how the add should be performed.
                // returns: Number
                //		The new id for the object.
                var masterStoreObject = transform(object, true);
                return when(masterStore.add(masterStoreObject, directives), function(result){
                    // now put result in cache
                    var cachingStoreResult = transform(result);
                    cachingStore.add(typeof cachingStoreResult == "object" ? cachingStoreResult : object, directives);
                    return cachingStoreResult; // the result from the add should be dictated by the masterStore and be unaffected by the cachingStore
                });
            },
            put: function(object, directives){
                // summary:
                //		Put the object into the store (similar to an HTTP PUT).
                // object: Object
                //		The object to put to the store.
                // directives: dojo/store/api/Store.PutDirectives?
                //		Any additional parameters needed to describe how the put should be performed.
                // returns: Promise
                //		The newly added object.
                var masterStoreObject = transform(object, true);
                // first remove from the cache, so it is empty until we get a response from the master store
                cachingStore.remove((directives && directives.id) || this.getIdentity(object));
                return when(masterStore.put(masterStoreObject, directives), function(result){
                    // now put result in cache
                    var cachingStoreResult = transform(result);
                    cachingStore.add(typeof cachingStoreResult == "object" ? cachingStoreResult : object, directives);
                    return cachingStoreResult; // the result from the add should be dictated by the masterStore and be unaffected by the cachingStore
                });
            },
            remove: function(id, directives){
                // summary:
                //		Remove the object with the specific id.
                // id: Number
                //		The identifier for the object in question.
                return when(masterStore.remove(id, directives), function(result){
                    return cachingStore.remove(id, directives);
                });
            },
            evict: function(id){
                // summary:
                //		Remove the object with the given id from the underlying caching store.
                // id: Number
                //		The identifier for the object in question.
                return cachingStore.remove(id);
            },
            admit: function(object, directives) {
                // summary:
                //      Add the master store object to the caching store without adding it to the master store
                //      (useful when the master store is updated independently)
                // object: Object
                //      The object to the caching store
                var cachingStoreObject = transform(object);
                return cachingStore.add(cachingStoreObject, directives);
            }
        });
    };

    return QueryCache;

});