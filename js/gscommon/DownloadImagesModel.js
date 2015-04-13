/**
 * Created by Jason Hornbuckle
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/Stateful",
    "dojo/Deferred",
    "dojo/promise/all",
    "dojo/request/xhr",
    "dojo/json",
    "dojo/_base/array",
    "dojo/store/Memory",
    "dijit/DialogUnderlay",
    "gscommon/utilities"
], function(declare, lang, Stateful, Deferred, all, xhr, json, array, Memory, DialogUnderlay, utils) {

    ///////////////////////////////////
    // instantiation:
    //
    //      var model = new DownloadImagesModel({
    //          app: dojoxAppInstance
    //      });
    //
    //      'mediaData' property is an array of objects.  At a minimum it should have mediaMasterId property.
    //      Would be nice to have mediaType as well but if it doesn't, model will internally go get the mediaType and
    //      add it.
    //
    //////////////////////////////////

    return declare(Stateful, {
        app: null,
        headers: null,
        mediaData: null,
        selectedSize: null,
        unavailableLabel: 'No digital media available for some of the selected records.',
        errorLabel: 'Info',
        requestToHandleNonImageMedia: false,
        _mappedMediaData: null,
        _saveDialog: null,
        _configureUrl: null,
        _downloadUrl: null,
        _mediaSimpleUrl: null,
        activities: {
            'small': 'Download 1-Small Image',
            'medium': 'Download 2-Medium Image',
            'large': 'Download 3-Large Image',
            'original': 'Download 4-Original File'
        },
        constructor: function (/*Object?*/ args) {
            var self = this;
            lang.mixin(this, args);
            this.headers = this.app.galSysSessionInfo.headers;
            this.mediaData = [];
            this._configureUrl = this.app.galSysServiceUrls.configuration;
            this._downloadUrl = this.app.galSysServiceUrls.downloadPrimary;
            this._saveDialog = new DialogUnderlay({"class": "galSysLoading"});
            this._mediaSimpleUrl = this.app.galSysServiceUrls.simpleMedia;
            this._mediaDataWatch = this.watch('mediaData', function (prop, oldVal, newVal) {
                if(newVal && newVal.length > 0){
                    if(!newVal[0].mediaType){
                        self.mapMediaTypes().then(
                            function (mappedTypes) {
                                self.set('mediaData', mappedTypes);
                            },
                            function () {

                            }
                        );
                    }
                }
            });
        },
        load: function () {
            var self = this;
        },
        getSizes: function () {
            var self, deferred, getConfig, label, url, smallDeferred, mediumDeferred, largeDeferred, configObj, labels,
                headers;

            self = this;

            configObj = {
                small: null,
                medium: null,
                large: null
            };

            labels = [
                { value: 'Media.Download.Sizes.1-Small', type: 'small'},
                { value: 'Media.Download.Sizes.2-Medium', type: 'medium'},
                { value: 'Media.Download.Sizes.3-Large', type: 'large'}
            ];

            deferred = new Deferred();

            headers = lang.clone(this.headers);
            headers['Content-Type'] = 'application/json';

            getConfig = function (/* Object */ config) {
                var label, type;

                label = config.value;
                type = config.type;
                url = self._configureUrl + '?label=' + label;

                xhr.get(url, {
                    handleAs: "json",
                    headers: headers
                }).then(function (result) {
                    configObj[type] = result.configValue;
                    if(labels.length > 0){
                        getConfig(labels.shift());
                    }else{
                        deferred.resolve(configObj);
                    }
                }, function (error) {
                    deferred.reject(error);
                });
            };

            getConfig(labels.shift());

            return deferred.promise;
        },
        mapMediaTypes: function () {
            var self = this, deferred = new Deferred(), url, getMediaType, clonedMediaData;

            self._mappedMediaData = [];
            clonedMediaData = lang.clone(this.mediaData);

            getMediaType = function (/* Object */ mediaRecord) {
                url = self._mediaSimpleUrl + mediaRecord.mediaMasterId;

                xhr.get(url, {
                    handleAs: "json",
                    headers: self.headers
                }).then(function (result) {
                    mediaRecord.mediaType = result.mediaType.mediaType;
                    self._mappedMediaData.push(mediaRecord);
                    if(clonedMediaData.length > 0 ){
                        getMediaType(clonedMediaData.shift());
                    }else{
                        deferred.resolve(self._mappedMediaData);
                    }
                }, function (error) {
                    deferred.reject(error);
                });
            };

            //only need to call getMediaType if mediaType not already provided.

            if(clonedMediaData && clonedMediaData.length > 0){
                if(!clonedMediaData[0].mediaType){
                    getMediaType(clonedMediaData.shift());
                }
            }

            return deferred.promise;
        },
        download: function () {
            var self = this, deferred = new Deferred(), url, data, headers;

            this._saveDialog.show();

            data = array.map(this.get('mediaData'), function (datum){
                return datum.mediaMasterId;
            });

            if(this.selectedSize && this.selectedSize != -1 && data.length > 0){
                url = lang.replace(this._downloadUrl, { sizeid: this.selectedSize });
                headers = lang.clone(this.headers);
                headers['Content-Type'] = 'application/json';

                xhr.put(url, {
                    handleAs: "json",
                    headers: headers,
                    data: json.stringify(data)
                }).then(
                    function (result) {
                        var downloadUrl, notAvailableIds, notAvailMsg;

                        if(self._saveDialog.open){
                            self._saveDialog.hide();
                        }

                        downloadUrl = result.downloadUrl;
                        notAvailableIds = result.mediaMasterIds;
                        if(downloadUrl){
                            window.open(downloadUrl, '_blank');
                        }

                        if(notAvailableIds.length > 0){
                            notAvailMsg = self.unavailableLabel + ': ';
                            notAvailMsg += notAvailableIds.join(',');
                            utils.messageBox(notAvailMsg, self.errorLabel);
                        }
                        deferred.resolve();
                    },
                    function (error) {
                        if(self._saveDialog.open){
                            self._saveDialog.hide();
                        }
                        deferred.reject(error);
                    }
                );
            }else{
                if(self._saveDialog.open){
                    self._saveDialog.hide();
                }
                deferred.reject('Invalid size or no image chosen');
            }

            return deferred.promise;
        },
        validate: function () {
            var validation;

            validation = {
                isValid: true,
                errors: []
            };

            validation.isValid = true;

            /////////////
            //
            //  Do custom validation and push an error object onto validation.errors for each error. Each error
            //  object can have type and message property which can be used by an outside controller for
            //  setting widget state.
            //
            /////////////

            return validation;
        },
        modified: function () {
            // summary:
            //      Return true | false when value has been modified.
            // returns: Boolean
            // implement custom
            return false;
        },
        create: function () {
            //the following is boilerplate example code only. to be replaced/changed for what you need.
            var createDeferred = new Deferred(),
                data = {},
                self = this,
                validation,
                headers;

            validation = this.validate();

            if(validation.isValid){

                if(!this._saveDialog){
                    this._saveDialog = new DialogUnderlay({"class": "galSysLoading"});
                }

                data.prop1 = parseInt(this.prop1);
                data.prop2 = parseInt(this.prop2);

                headers = lang.clone(this.headers);
                //clone in case need to override somethign for custom header settings.
                //example:
                headers['Content-Type'] = 'application/json';

                //create record.
                this._saveDialog.show();

                xhr.post(this._createUrl, {
                    handleAs: "json",
                    headers: headers,
                    data: JSON.stringify(data)
                }).then(function (newRecord) {
                    if(self._saveDialog.open){
                        self._saveDialog.hide();
                    }
                    createDeferred.resolve(newRecord);
                }, function (error) {
                    createDeferred.reject(error);
                    if(self._saveDialog.open){
                        self._saveDialog.hide();
                    }
                });

            }else{
                createDeferred.reject(validation.errors);
            }

            return createDeferred.promise;
        },
        update: function () {

        },
        remove: function () {

        },
        reset: function () {
            // summary:
            //      resets state of model
        },
        getOldValue: function () {
            // summary:
            //      Public method to return private _oldValue.
            // tags:
            //      readonly
            return this._oldValue;
        },
        destroy: function () {
            this._mediaDataWatch && this._mediaDataWatch.unwatch();
            if(this._saveDialog){ this._saveDialog.destroy(); }
        }
    });
});