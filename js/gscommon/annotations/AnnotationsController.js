/**
 * Created by jason on 01/21/15
 */
define([
    "dojo/_base/declare",
    "dojo/_base/array",
    "dojo/aspect",
    "gscommon/LocalizationManager",
    "gscommon/flexViews/controllers/ModelController",
    "gscommon/annotations/ShapeDrawingToolController",
    "gscommon/flexViews/controllers/ImportedViewController",
    "dojo/when"
], function(declare, array, aspect, LocalizationManager, ModelController, ShapeDrawingToolController,
            ImportedViewController, when) {

    return declare([ShapeDrawingToolController], {
        _setProperties: function (/*Object*/ model, /*dijit/_WidgetBase*/ widget, /*Object*/ localizationProvider,
                                  /*Object*/securityProvider) {
            var self = this, secManager, locManager;
            this.inherited(arguments);

            this._importedViewOneController = new ImportedViewController(
                model._importedViewModelOne,
                widget._contextViewOne,
                localizationProvider,
                securityProvider
            );

            this._importedViewTwoController = new ImportedViewController(
                model._importedViewModelTwo,
                widget._contextViewTwo,
                localizationProvider,
                securityProvider
            );

        },
        _bindEventHandler: function (/*Object*/ model, /*dijit/_WidgetBase*/ widget, /*Object*/ localizationProvider) {
            var self = this;

            this._annotationsSyncHandles = [];

            this.inherited(arguments);

            this._watches.push(model.watch('layersStore', function (prop, oldValue, newValue) {
                widget.annotationsLayers.set('layersStore', newValue)
            }));

            this._watches.push(model.watch('reportsStore', function (prop, oldValue, newValue) {
                widget.reportSelect.set('labelAttr', 'reportNumber');
                widget.reportSelect.set('store', newValue);
                if(newValue.data.length > 0){
                    widget.reportSelect.set('value', newValue.data[0].reportId);
                }
            }));

            this._watches.push(model.watch('mediaFlexViewData', function (prop, oldValue, newValue) {
                model.loadFlexView('media', newValue.mediaMasterId, newValue.departmentId);
            }));

            //override onClick to take care of saving data in flex views.
            widget._closeBtn.onClick = function () {
                self._saveDialog.show();
                self._model._importedViewModelTwo.save();
                self._model._importedViewModelOne.save().then(function(){
                    self._saveDialog.hide();
                    self._widget.onCloseClick();
                }, function(error){

                });
            };

            widget.reportSelect.onChange = function (value) {
                self._saveDialog.show();
                when(self._model._importedViewModelOne.save(), function () {
                    var reportItem = widget.reportSelect.store.get(value);
                    self._saveDialog.hide();
                    model.loadFlexView('report', reportItem.reportId, reportItem.departmentId);
                }, function (error) {

                });
            };
        },
        onLayersStoreLoaded: function () {
            this.inherited(arguments);
        },
        destroy: function() {
            array.forEach(this._annotationsSyncHandles, function (handle) {
                handle.remove();
            });
            this._importedViewOneController.destroy();
            this._importedViewTwoController.destroy();
            this._widget._contextViewOne.destroy();
            this._widget._contextViewTwo.destroy();
            this.inherited(arguments);
        }
    });
});