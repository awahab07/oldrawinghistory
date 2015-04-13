/**
 * Widget template Created by Jason Hornbuckle
 */
define([
    "dojo/_base/declare",
    "dojo/Deferred",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/when",
    "dojo/store/Memory",
    "dgrid/OnDemandGrid",
    "dgrid/Keyboard",
    "dgrid/Selection",
    "dgrid/editor",
    "dijit/form/ToggleButton",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin"
    //Replace next line with path to your custom template.
    //"dojo/text!gscommon/[yourtemplate].html"
], function (declare, Deferred, lang, array, domStyle, domClass, when, Memory, OnDemandGrid, Keyboard, Selection,
             editor, ToggleButton, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin) {

    var LayersGrid = declare([OnDemandGrid, Keyboard, Selection]);

    return declare([_WidgetBase], {
        //templateString: template,
        baseClass: "galsysAnnotationsLayers",
        layersGrid: null,
        layersStore: null,
        layersStoreOptions: null,
        constructor: function(args) {
            lang.mixin(this, args);
            this.layersStoreOptions =  { sort: [{ attribute:"name", descending: false }] };
        },
        buildRendering: function (){
            this.inherited(arguments);

            this._layersColumns = [
                editor({
                    label: 'visible',
                    field: 'visible',
                    editor: ToggleButton,
                    editorArgs: {
                        iconClass: 'fa fa-eye',
                        showLabel: false,
                        onChange: function(value){
                            this.set('checked', value);
                        }
                    }
                }),
                {
                    label: 'name',
                    field: 'name'

                }
            ];

            this.layersGrid = new LayersGrid({
                selectionMode: "single",
                showHeader: false,
                columns: this._layersColumns
            });
            this.domNode.appendChild(this.layersGrid.domNode);
        },
        postCreate: function () {
            this.inherited(arguments);
        },
        reset: function () {
            //summary:
            //  reset state of the model.
        },
        setErrors: function (errors) {
            //example:

            // array.forEach(errors, function (error) {
            //     if(error.type == 'mediaRenditionNumber'){
            //         domClass.add(self.mediaRenditionLabel, 'galSysLabelError');
            // });
        },
        clearErrors: function () {
            // example:
            // domClass.remove(this.mediaRenditionLabel, 'galSysLabelError');
        },
        onCreateClick: function () {

        },
        onCancelClick: function () {

        },
        _setLayersStoreAttr: function (/* Object */ store) {
            this.layersGrid.set("columns", this._layersColumns);
            this.layersGrid.set("store", store, {}, this.layersStoreOptions);
            //this.layersGrid.resize();
        },
        startup: function () {
            this.inherited(arguments);
            //this.layersGrid.startup();
        },
        destroy: function () {
            this.layersGrid.destroy();
            this.inherited(arguments);
        }
    });
});
