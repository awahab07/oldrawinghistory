define([
    "dojo/_base/declare",
    "dojo/aspect",
    "dojo/_base/array",
    "dojox/mvc/sync",
    "gscommon/flexViews/controllers/ModelController",
    "gscommon/LocalizationManager"
], function (declare, aspect, array, sync, ModelController, LocalizationManger) {
    return declare([ModelController], {

        _setProperties: function (/*Object*/ model, /*dijit/_WidgetBase*/ widget, /*Object*/ localizationProvider,
                                  /*Object*/securityProvider) {
            var locManager, self = this;

            self._widget = widget;
            self._model = model;
            self._adviceHandles = [];
            self._syncHandles = [];
            //TODO: Implement localization and security.

            var destroyAdvice = aspect.before(widget, "destroy", function() {
                self._locHandle && self._locHandle.cancel();
            });

            self._adviceHandles.push(destroyAdvice);

            widget.startup();

            widget.resize();
        },

        _bindEventHandler: function (/*Object*/ model, /*dijit/_WidgetBase*/ widget, /*Object*/ localizationProvider) {
            var self = this;
            var baseImageLayerSync = sync(model, "value", widget, "baseImageLayer", sync.from);
            this._watches = [];

            self._syncHandles.push(baseImageLayerSync);
        },

        destroy: function () {
            this._widget.destroy();
            this._model.destroy();
            array.forEach(self._adviceHandles, function (handle) {
                handle.remove();
            });
            array.forEach(self._syncHandles, function (handle) {
                handle.remove();
            });
            array.forEach(self._watches, function (watch) {
                watch.unwatch();
            });
            this._widget = null;
            this._model = null;
        }

    });
});
