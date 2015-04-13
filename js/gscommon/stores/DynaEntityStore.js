/**
 * Created with JetBrains WebStorm.
 * User: olegg
 * Date: 9/9/13
 * Time: 11:31 AM
 * To change this template use File | Settings | File Templates.
 */
define([
    "dojo/_base/lang",
    "dojo/_base/declare",
    "dojo/io-query",
    "dojo/request/xhr"
], function(lang, declare, ioQuery, xhr) {

    var compileUrl = function(/*String*/ target, /*Object*/ idObject) {
        // summary:
        //      Compile url string based on target url and idObject
        var id, query, url = target;

        if (idObject && idObject.id) {
            id = ioQuery.objectToQuery(idObject.id).replace(/[&=]/g, "/");
            url = url + id + "/";
        }
        if (idObject && idObject.query) {
            query = ioQuery.objectToQuery(idObject.query);
            url = url + "?" + query;
        }
        return url;
    };

    var putOrPost = function(post, object, options, thisObject) {
        // summary:
        //		Stores or adds an object. This will trigger a PUT or POST request to the server
        // post: Boolean
        //      Specifies whether this is a new object to be added to the store
        // object: Object
        //		The object to store.
        // options: __PutDirectives
        //		Additional metadata for storing the data.  Includes an "id"
        //		property if a specific id is to be used.
        // thisObject: Object
        //      Reference to the scope object
        // returns: dojo/_base/Deferred
        var idObject, url, xhrMethod;

        options = options || {};
        if ("idObject" in options) {
            idObject = options.idObject;
        }
        url = compileUrl(thisObject.target, idObject);
        if (post) {
            xhrMethod = xhr.post;
        } else {
            xhrMethod = xhr.put;
        }
        return xhrMethod(url, {
            data: JSON.stringify(object),
            handleAs: "json",
            headers: lang.mixin({
                "Content-Type": "application/json",
                Accept: thisObject.accepts
            }, thisObject.headers, options.headers)
        });
    };

    return declare(null, {
        constructor: function(options) {
            this.headers = {};
            declare.safeMixin(this, options);
        },
        // headers: Object
        //		Additional headers to pass in all requests to the server. These can be overridden
        //		by passing additional headers to calls to the store.
        headers: {},

        // target: String
        //		The target base URL to use for all requests to the server.
        target: "",

        // idProperty: String
        //		Indicates the property to use as the identity property. The values of this
        //		property should be unique.
        idProperty: "id",

        get: function(idObject, options){
            // summary:
            //		Retrieves an object by its identity.
            // idObject: Object
            //		The identity to use to lookup the object
            // options: Object?
            //		HTTP headers. For consistency with other methods, if a `headers` key exists on this object, it will be
            //		used to provide HTTP headers instead.
            // returns: Object
            //		The object in the store that matches the given id.
            var url;

            options = options || {};
            var headers = lang.mixin({ Accept: this.accepts }, this.headers, options.headers || options);

            url = compileUrl(this.target, idObject);
            return xhr.get(url, {
                handleAs: "json",
                headers: headers
            });
        },

        // accepts: String
        //		Defines the Accept header to use on HTTP requests
        accepts: "application/javascript, application/json",

        getIdentity: function(object){
            // summary:
            //		Returns an object's identity
            // object: Object
            //		The object to get the identity from
            // returns: Number
            return object[this.idProperty];
        },

        put: function(object, options){
            // summary:
            //		Stores an object. This will trigger a PUT request to the server
            //		if the object has an id, otherwise it will trigger a POST request.
            // object: Object
            //		The object to store.
            // options: __PutDirectives?
            //		Additional metadata for storing the data.  Includes an "id"
            //		property if a specific id is to be used.
            // returns: dojo/_base/Deferred

            return putOrPost(false, object, options, this);
        },

        add: function(object, options){
            // summary:
            //		Adds an object. This will trigger a PUT request to the server
            //		if the object has an id, otherwise it will trigger a POST request.
            // object: Object
            //		The object to store.
            // options: __PutDirectives?
            //		Additional metadata for storing the data.  Includes an "id"
            //		property if a specific id is to be used.
            return putOrPost(true, object, options, this);
        },

        remove: function(idObject, options){
            // summary:
            //		Deletes an object by its identity. This will trigger a DELETE request to the server.
            // idObject: Object
            //		The identity to use to delete the object
            // options: __HeaderOptions?
            //		HTTP headers.
            var url;

            options = options || {};

            url = compileUrl(this.target, idObject);
            return xhr.del(url, {
                headers: lang.mixin({}, this.headers, options.headers)
            });
        }
    });
});