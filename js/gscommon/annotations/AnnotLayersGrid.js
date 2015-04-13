define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojox/grid/DataGrid"
], function (declare, lang, DataGrid) {
    //TODO: consider using differente widget, like dgrd.
    return declare(DataGrid, {
        height:'90%',//TODO: properly have the height set on this.
        constructor: function (args) {
            var self = this;
            lang.mixin(self, args);
        }
    });
});