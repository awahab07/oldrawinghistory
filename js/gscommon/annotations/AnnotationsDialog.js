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
    "dijit/Dialog",
    "dojo/_base/fx",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin"
    //Replace next line with path to your custom template.
    //"dojo/text!gscommon/[yourtemplate].html"
], function (declare, Deferred, lang, array, domStyle, domClass, when, Memory, Dialog, fx, _WidgetBase, _TemplatedMixin,
             _WidgetsInTemplateMixin) {

    return declare([Dialog], {
        constructor: function(args) {
            lang.mixin(this, args);
        },
        buildRendering: function (){
            this.inherited(arguments);
            domClass.add(this.domNode, 'galSysAnnotationsDialog');
        },
        postCreate: function () {
            this.inherited(arguments);
        },
        reset: function () {
            //summary:
            //  reset state of the model.
        },
        onCreateClick: function () {

        },
        onCancelClick: function () {

        },
        startup: function () {
            this.inherited(arguments);
        },
        destroy: function () {
            this.inherited(arguments);
        },
        resize: function () {

        }
    });
});
