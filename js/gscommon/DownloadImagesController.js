/**
 * Created by jason
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/when",
    "dojo/aspect",
    "dojo/Deferred",
    "dojo/_base/array",
    "dojo/dom-style",
    "dojo/store/Memory",
    "gscommon/utilities",
    "dojo/json",
    "dojo/Stateful",
    "dojox/mvc/sync",
    "gscommon/LocalizationManager",
    "gscommon/SecurityManager",
    "dijit/DialogUnderlay",
    "gscommon/flexViews/controllers/ModelController"
], function(declare, lang, when, aspect, Deferred, array, domStyle, Memory, utilities, json, Stateful, sync,
            LocalizationManager, SecurityManager, DialogUnderlay, ControllerBase) {

    ///////////////////////////////////
    // instantiation:
    //
    //      var controller = new DownloadImagesController(
    //                              downloadImagesModel,
    //                              downloadImagedWidget,
    //                              localizationProvider,
    //                              securityProvider
    //                      );
    //
    //////////////////////////////////

    return declare([ControllerBase], {
        _setProperties: function (/*Object*/ model, /*dijit/_WidgetBase*/ widget, /*Object*/ localizationProvider,
                                  /*Object*/securityProvider) {
            var self = this, secManager, locManager;

            self._model = model;
            self._widget = widget;

            self._SECURITY_CONTEXTID = -1;

            if(!self._saveDialog){
                self._saveDialog = new DialogUnderlay({"class": "galSysLoading"});
            }

            self._secManHandles = [];

            self._canDownloadSmall = new Stateful({
                disabled: true
            });

            self._canDownloadMedium = new Stateful({
                disabled: true
            });

            self._canDownloadLarge = new Stateful({
                disabled: true
            });

            self._canDownloadOriginal = new Stateful({
                disabled: true
            });

            //localization
            if (localizationProvider) {
                locManager = new LocalizationManager({localizationProvider: localizationProvider});

                locManager.useLiteral(1868, model.errorLabel, model, true, 'errorLabel');
                locManager.useLiteral(1600, model.unavailableLabel, model, true, 'unavailableLabel');

                self._locHandle = locManager.subscribe();

                aspect.before(widget, "destroy", function() {
                    self._locHandle.cancel();
                });
            }

            if (securityProvider) {
                //security is determined by functional level. download button can always be clicked.


                aspect.before(model, "load", function(itemId, securityContextId, locked) {

                });

                self._securityManager = new SecurityManager({securityProvider: securityProvider});

                self._securityManager.secureByActivity(
                    self._canDownloadSmall,
                    true,
                    model.activities.small
                );

                self._securityManager.secureByActivity(
                    self._canDownloadMedium,
                    true,
                    model.activities.medium
                );

                self._securityManager.secureByActivity(
                    self._canDownloadLarge,
                    true,
                    model.activities.large
                );

                self._securityManager.secureByActivity(
                    self._canDownloadOriginal,
                    true,
                    model.activities.original
                );

                self._securityHandle = self._securityManager.initialize();

                aspect.before(model, "load", function(securityContextId, locked) {
                    self._securityManager.apply(securityContextId, locked);
                });
            }

            model.getSizes().then(function (results) {
                widget.chooseImgWidget.setSizes(results.small, results.medium, results.large);
            });

        },
        _bindEventHandler: function (/*Object*/ model, /*dijit/_WidgetBase*/ widget, /*Object*/ localizationProvider) {
            var self = this;

            self._syncHandles = [];
            //example:
            //self._syncHandles.push(sync(model, "mediaRenditionNumber", widget.mediaRenditionNumber, "value"));

            self._canDownloadSmall.watch('disabled', function (prop, oldVal, newVal) {
                widget.chooseImgWidget.canDownload('small', !newVal);
            });

            self._canDownloadMedium.watch('disabled', function (prop, oldVal, newVal) {
                widget.chooseImgWidget.canDownload('medium', !newVal);
            });

            self._canDownloadLarge.watch('disabled', function (prop, oldVal, newVal) {
                widget.chooseImgWidget.canDownload('large', !newVal);
            });

            self._canDownloadOriginal.watch('disabled', function (prop, oldVal, newVal) {
                widget.chooseImgWidget.canDownload('original', !newVal);
            });

            widget.chooseImgWidget.downloadSizeSelect.watch('value', function (prop, oldVal, newVal) {
                model.set('selectedSize', newVal);
            });

            widget.onClick = function () {
                var hasNonImageMediaType = false;
                array.forEach(model.mediaData, function (datum) {
                    if(datum.mediaType !== 'Image'){ hasNonImageMediaType = true; }
                });

                if(model.requestToHandleNonImageMedia){
                    if(hasNonImageMediaType){
                        widget.onRequestAltMediaDownload(model.mediaData);
                    }else{
                        widget.showChooseImageDialog();
                    }
                }else{
                    widget.showChooseImageDialog();
                }

            };

            widget.onDownloadRequest = function () {
                //get media type.
                model.download().then(
                    function () {
                        widget.closeDialog();
                    },
                    function (error) {
                    }
                );
            };

        },
        init: function () {
            this._widget.startup();
            this._model.load(this._SECURITY_CONTEXTID, false);
        },
        destroy: function() {
            //remove sync handles.
            if(this._syncHandles.length > 0){
                array.forEach(this._syncHandles, function (handle) {
                    handle.remove();
                });
            }

            //remove security.
            if (this._securityHandle) {
                this._securityHandle.cancel();
            }

            model.destroy();
            widget.destroy();
            this.inherited(arguments);
        }
    });
});