/**
 * Created with JetBrains WebStorm.
 * User: aaron
 * Date: 7/30/13
 * Time: 3:03 PM
 * To change this template use File | Settings | File Templates.
 */

// TODO: Continue on DataView model, view and controller. Based on New finalize EA doc from Vadim.

define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/string",
    "dojo/Stateful",
    "dojo/request/xhr",
    "dojox/html/format",
    "dojo/Deferred",
    "dojo/store/Memory",
    "dojo/store/Observable",
    "gscommon/stores/OlZoomifySourceStore"
], function (declare, lang, string, Stateful, xhr, format, Deferred, Memory, Observable, OlZoomifySourceStore) {

    return declare([Stateful], {
        // _oldValue: [private readonly] string
        //      Keep a copy of pre modified value.
        _oldValue: "",
        // value: string
        //      The value[state] of this model.
        value: "",
        app: null,//requires a reference to the app object
        baseImageType: null,//static ( 0 ) or tiled ( 1 )
        baseImageUrl: null,
        baseImageMeta: null,
        hierarchyId: null,
        mediaMasterId: null,
        _sourceStore: null,
        _baseImageLayer: {}, // Reference of JSON object to wrap layer info

        _validateLayerObject: function(basicImageLayerObject) {
            var valid = true,
                message = "";

            if( typeof basicImageLayerObject != "object" ) {
                valid = false;
                message += "\nThe input layerObject must be an object literal";
            }

            if( basicImageLayerObject && !(typeof basicImageLayerObject.type == "string" && (basicImageLayerObject.type == "static" || basicImageLayerObject.type == "tile")) ){
                valid = false;
                message += "\nlayerObject.type must be a valid string, either \"static\" or \"tile\"";
            }

            if( basicImageLayerObject && typeof basicImageLayerObject.url != "string" ){
                valid = false;
                message += "\nlayerObject.url must be a valid string";
            }

            if ( typeof basicImageLayerObject.meta != "object") {
                valid = false;
                message += "\nlayerObject.meta is missing or not valid";
            }

            // @TODO Include validation tests for meta object properties needed for configuring layer, projection and view

            return {'valid': valid, 'message': message};
        },

        constructor: function (/*Object?*/ args) {
            var self = this;

            if(!args.app){
                throw 'BasicImageViewerModel requires reference to main app object';
            }

            lang.mixin(self, args);

            if(!self.hierarchyId){ self.hierarchyId = 1233; } //defaults to MediaMaster hierarchyId

            self.headers = lang.clone(self.app.galSysSessionInfo.headers);
            self._sourceStore = new OlZoomifySourceStore({
                mediaDataUrl: self.app.galSysServiceUrls.mediaReference
            });
        },
        load: function (/* number */ masterMediaId) {
            // summary:
            //      Load function to set initial value, and _oldValue.
            // tags:
            //      readonly
            var self = this, loadDeferred, dimenSubstring, imgDimension;

            loadDeferred = new Deferred();
            this.mediaMasterId = masterMediaId;

            self._sourceStore.queryMedia({
                mediaMasterId: masterMediaId,
                hierarchyId: self.hierarchyId
            }, { headers: self.headers }).then(function (result) {

                self.set('baseImageType', result.baseImageType);
                self.set('baseImageUrl', result.baseImageUrl);
                self.set('baseImageMeta', result.baseImageMeta);

                self.set('_baseImageLayer', {
                    baseImageType: self.baseImageType,
                    baseImageUrl: self.baseImageUrl,
                    baseImageMeta: self.baseImageMeta
                });

                self.set('value', self._baseImageLayer);
                self._oldValue = self.value;

                loadDeferred.resolve();

            }, function (error) {
                loadDeferred.resolve('viewer failed to load image');
            });

            return loadDeferred.promise;
        },

        validate: function () {
            // Validating input layer object literal
            var self = this;

            return self._validateLayerObject(self._baseImageLayer).valid;
        },

        modified: function () {
            // summary:
            //      Return true | false when value has been modified.
            // returns: Boolean
            //      true if value != _oldValue, false vise versa.
            // tags:
            //      readonly
            return this._oldValue != this.get('value');
        },

        getOldValue: function () {
            // summary:
            //      Public method to return private _oldValue.
            // tags:
            //      readonly
            return this._oldValue;
        },

        getBaseImageLayer: function() {
            return this._baseImageLayer;
        },

        destroy: function() {
            // summary:
            //      destroy method to remove any watchers, listneres, signals, etc..
        }

    });
});
