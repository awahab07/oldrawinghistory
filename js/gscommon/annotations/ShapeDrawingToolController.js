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
    "dojo/store/Memory",
    "gscommon/utilities",
    "dojo/Stateful",
    "dojox/mvc/sync",
    "gscommon/LocalizationManager",
    "gscommon/SecurityManager",
    "dijit/DialogUnderlay",
    "gscommon/flexViews/controllers/ModelController",
    "gscommon/BasicImgViewController",
    "dojo/topic"
], function(declare, lang, when, aspect, Deferred, array, Memory, utilities, Stateful, sync, LocalizationManager, SecurityManager,
            DialogUnderlay, ModelController, BasicImgViewController, topic) {
    return declare([BasicImgViewController], {
        _setProperties: function (/*Object*/ model, /*dijit/_WidgetBase*/ widget, /*Object*/ localizationProvider,
                                  /*Object*/securityProvider) {
            var self = this, secManager, locManager;

            self._model = model;
            self._widget = widget;

            if(!self._saveDialog){
                self._saveDialog = new DialogUnderlay({"class": "galSysLoading"});
            }

            self._shapDrawingSecManHandles = [];

            //localization
            if (localizationProvider) {
                locManager = new LocalizationManager({localizationProvider: localizationProvider});

                //example:
                locManager.useLiteral(4799, widget.headerLabel, widget, true, 'headerLabel');
                locManager.useLiteral(4800, 'Comparison Mode', widget.compareBtn, true);

                self._shapDrawinglocHandle = locManager.subscribe();

                aspect.before(widget, "destroy", function() {
                    self._shapDrawinglocHandle.cancel();
                });
            }

            if (securityProvider) {
                aspect.before(model, "load", function(itemId, securityContextId, locked) {

                });
            }

            model.onLayersStoreLoaded = function () {
                self.onLayersStoreLoaded();
            };
            this.inherited(arguments);
        },
        _bindEventHandler: function (/*Object*/ model, /*dijit/_WidgetBase*/ widget, /*Object*/ localizationProvider) {
            var self = this;

            self._shapeDrawingSyncHandles = [];

            self._shapeDrawingSyncHandles.push(sync(
                model, 'annotationRecordNumber',
                widget, 'AnnotationRecordNumber'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'toolTipInfo',
                widget, 'infoToolTipLabel'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'color',
                widget.stylesToolBar, 'color'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'stroke',
                widget.stylesToolBar, 'stroke'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'lineStyleValue',
                widget.stylesToolBar, 'lineStyleValue'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'lineWidth',
                widget.stylesToolBar, 'lineWidth'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'textValue',
                widget.stylesToolBar.textSelect, 'value'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'textAuthStore',
                widget.stylesToolBar, 'textSelectStore',
                { bindDirection: sync.from }
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'textSizeValue',
                widget.stylesToolBar.textSizeSelect, 'value'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'textSizesAuthStore',
                widget.stylesToolBar, 'textSizeSelectStore',
                { bindDirection: sync.from }
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'textFill',
                widget.stylesToolBar, 'textFill'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'colorAuthStore',
                widget.stylesToolBar.swatchPicker, 'store'
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'lineWidthStore',
                widget.stylesToolBar, 'lineWidthAuthStore',
                { bindDirection: sync.from }
            ));

            self._shapeDrawingSyncHandles.push(sync(
                model, 'opacity',
                widget.stylesToolBar, 'opacity'
            ));


            self._formatsTopic = topic.subscribe("flexField/annotation/select", function (data) {
                var format;

                if(data.annotationFormat){
                    format = data.annotationFormat;
                    if(format.fillColorId){
                        model.set('color', model.colorAuthStore.get(format.fillColorId));
                    }
                    if(format.colorId){
                        model.set('stroke', model.colorAuthStore.get(format.colorId));
                    }
                    if(format.lineStyleId){
                        model.set('lineStyle', model.lineStyleAuthStore.get(format.lineStyleId));
                    }
                    if(format.shapeTypeId){
                        model.set('shapeTypeId', model.shapeTypeStore.get(format.shapeTypeId));
                    }
                    if(format.shapeTypeId){
                        widget.annotToolbar.selectTool(model.shapeTypeStore.get(format.shapeTypeId).value);
                    }
                }
            });

            widget.stylesToolBar.onSaveClick = function () {
                // Saving layers and shapes from map widget
                if(widget.saveLayers){
                    widget.saveLayers();
                }

                // Taking snapshot
                model.getPredefinedImageSize().then(function(predefinedImageSizeObj){
                    if(predefinedImageSizeObj && predefinedImageSizeObj.configValue) {
                        var base64String = widget.getBase64ForSize(parseInt(predefinedImageSizeObj.configValue));
                        base64String = base64String.replace('data:image/png;base64,', '');
                        model.updateSnapshot(base64String);
                    }
                }).then(function(){
                    model.save().then(function(){},function(){});
                });
            };

            widget.stylesToolBar.onExportAsJPGClick = function () {
                alert('need to hook into export as jpg');
            };

            widget.stylesToolBar.onExportAsPNGClick = function () {
                alert('need to hook into export as png');
            };

            widget.stylesToolBar.onZoomValueChanged = function (value) {
                widget.zoomToPercent(value);
            };

            // Binding slider to canvas zoom to update the slider when map is zoomed
            self._zoomWatchHandle = widget.watch('percentZoom', function(property, oldValue, newValue){
                widget.stylesToolBar.zoomSlider.set('value', newValue);
            });

            this.inherited(arguments);
        },
        onLayersStoreLoaded: function () {
            var self = this;

            // Setting paper and other configuration
            var confObj = self._model.getPaperConfig();
            if(confObj && confObj.paperSize && confObj.paperSize.width && confObj.paperSize.height) {
                if(confObj.orientation && confObj.orientation.toLowerCase() == "landscape") {
                    self._widget.set('paperSize', [confObj.paperSize.height, confObj.paperSize.width]);
                } else {
                    self._widget.set('paperSize', [confObj.paperSize.width, confObj.paperSize.height]);
                }
            } else {
                self._widget.set('paperSize', null);
            }

            //code for ShapeDrawingTool to load shapes.
            if(self._widget.setDataProvider) {
                self._widget.setDataProvider(self._model);
                self._widget.loadLayers();
            }
        },
        destroy: function() {
            array.forEach(this._shapDrawingSecManHandles, function (handle) {
                handle.remove();
            });
            array.forEach(this._shapeDrawingSyncHandles, function (handle) {
                handle.remove();
            });

            if(this._zoomWatchHandle) {
                this._zoomWatchHandle.unwatch();
            }

            this._formatsTopic.remove();

            this.inherited(arguments);
        }
    });
});