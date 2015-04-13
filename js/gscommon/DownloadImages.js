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
    "dojo/store/Observable",
    "dijit/form/Button",
    "dijit/Dialog",
    "dijit/form/Select",
    "dijit/form/CheckBox",
    "dojo/_base/window",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!gscommon/ChooseImgToDownload.html",
    "gscommon/LocalizationManager"
], function ( declare, Deferred, lang, array, domStyle, domClass, when, Memory, Observable, Button, Dialog, CheckBox,
              Select, win, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, template, LocalizationManager) {

    ///////////////////////////////////
    // instantiation:
    //
    //      var widget = new DownloadImages();
    //
    //////////////////////////////////

    var ChooseDownloadWidget = declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: template,
        galSysStarted: false,
        localizationProvider: null,
        noPermissionMessageNode: null,
        downloadBtn: null,
        downloadBtnLabel: 'Download',
        downloadSizeSelect: null,
        downloadOptions: null,
        smallSizeLabel: null,
        mediumSizeLabel: null,
        largeSizeLabel: null,
        originalSizeLabel: 'original size',
        selectImgLabel: 'Select Size',
        _store: null,
        _sizesSetDeferred: null,
        constructor: function () {
            this.inherited(arguments);
            this._sizesSetDeferred = new Deferred();
        },
        buildRendering: function () {
            this.inherited(arguments);

            domStyle.set(this.downloadSizeCont, 'visibility', 'hidden');

            this._store = Observable( new Memory({
                data: [{ id: -1, label: this.selectImgLabel }]
            }));

            this.downloadSizeSelect.set('labelAttr', 'label');
            this.downloadSizeSelect.set('store', this._store);
            this.downloadSizeSelect.set('value', -1);
            this.downloadSizeSelect.set('disabled', true);
            this.downloadBtn.set('disabled', true);
        },
        postCreate: function () {
            var self = this;

            this.localize();
            this.downloadSizeSelect.onChange = function (value) {
                if(value == -1){
                    self.downloadBtn.set('disabled', true);
                }else{
                    self.downloadBtn.set('disabled', false);
                }
            };
        },
        canDownload: function (/* string */ size, /* boolean */ canDownload) {
            var self = this;

            when(this._sizesSetDeferred, function () {
                if(canDownload){
                    self._store.add(self.downloadOptions[size]);
                    self.downloadSizeSelect.set('disabled', false);
                    domStyle.set(self.noPermissionMessageNode, 'display', 'none');
                    domStyle.set(self.downloadSizeCont, 'visibility', 'visible');
                }else{
                    self._store.remove(self.downloadOptions[size].id);
                }
            });
        },
        setSizes: function (/*string*/small, /*string*/medium, /*string*/ large) {

            this.smallSizeLabel = small + ' x ' + small;
            this.mediumSizeLabel = medium + ' x ' + medium;
            this.largeSizeLabel = large + ' x ' + large;

            this.downloadOptions = {
                'label': { id: -1, label: this.selectImgLabel },
                'small': { id: 1, label: this.smallSizeLabel },
                'medium': { id: 2, label: this.mediumSizeLabel },
                'large': { id: 3, label: this.largeSizeLabel },
                'original': { id: 4, label: this.originalSizeLabel }
            };

            this._sizesSetDeferred.resolve();
        },
        localize: function () {

            var self = this, locManager;

            this.inherited(arguments);

            if (this.localizationProvider) {
                locManager = new LocalizationManager({localizationProvider: self.localizationProvider});

                locManager.useLiteral(4738, self.downloadBtnLabel, this.downloadBtn, true, 'label');
                locManager.useLiteral(4739, self.originalSizeLabel, this, true, 'originalSizeLabel');
                locManager.useLiteral(4741, self.selectImgLabel, this, true, 'selectImgLabel');
                locManager.useLiteral(
                    2089,
                    'You have no security permission to perform this action.',
                    self.noPermissionMessageNode, false
                );
                this._locHandle = locManager.subscribe();
            }
        },
        startup: function () {
            this.inherited(arguments);
            this.set('galSysStarted', true);
        },
        reset: function () {
            this.downloadSizeSelect.set('value', -1);
        },
        _updateLabel: function (/* string */ label) {
            var self = this;

            when(this._sizesSetDeferred, function () {
                var origOpt = self._store.get(self.downloadOptions[label].id);

                if(label === 'original'){
                    self.downloadOptions[label] = { id: 4, label: self.originalSizeLabel };
                }else if(label === 'label'){
                    self.downloadOptions[label] = { id: -1, label: self.selectImgLabel };
                }

                if(origOpt){
                    origOpt = self.downloadOptions[label];
                    self._store.put(origOpt);
                }

            });
        },
        _setOriginalSizeLabelAttr: function (/* string */ value) {
            var self = this;
            this.originalSizeLabel = value;
            this._updateLabel('original');

        },
        _setSelectImgLabelAttr: function (/* string */ value) {
            var self = this;
            this.selectImgLabel = value;
            this._updateLabel('label');
        },
        destroy: function () {
            this._locHandle && this._locHandle.cancel();
            this.inherited(arguments);
        }
    });

    return declare([Button], {
        //templateString: template,
        //style property for _downloadBtn if passed on instantiation.
        style: null,
        //_downloadBtn: null,
        chooseImgWidget: null,
        _dialog: null,
        _fullyLoaded: null,
        _locHandle: null,
        label: 'Download',
        localizationProvider: null,
        constructor: function(args) {
            lang.mixin(this, args);
            this._fullyLoaded = new Deferred();
        },
        buildRendering: function (){
            var self = this;

            this.inherited(arguments);

            this._dialog = new Dialog({
                onHide: function () {
                    self.chooseImgWidget.reset();
                }
            });

            this.chooseImgWidget = new ChooseDownloadWidget({
                localizationProvider: this.localizationProvider
            });

            this.chooseImgWidget.downloadBtn.onClick = function () {
                self.onDownloadRequest();
            }
        },
        postCreate: function () {
            var self = this;

            this.inherited(arguments);

            when(this._dialog.onLoadDeferred, function(){
                var locManager;

                if (self.localizationProvider) {

                    locManager = new LocalizationManager({localizationProvider: self.localizationProvider});

                    locManager.useLiteral(4740, "Please Select Images to Download", self._dialog.titleNode, false);
                    locManager.useLiteral(4738, "Download", self, true);

                    self._locHandle = locManager.subscribe();

                }
                self._fullyLoaded.resolve();
            });
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
        showChooseImageDialog: function () {
            var self = this;
            when(self._fullyLoaded, function () {
                self._dialog.containerNode.appendChild(self.chooseImgWidget.domNode);
                if(!self.chooseImgWidget.galSysStarted){
                    self.chooseImgWidget.startup();
                }
                self._dialog.show();
            });
        },
        onRequestAltMediaDownload: function () {
            // hook to integrate with other widgets that can handle downloading of non-image resources.
            alert('non image media requested to download!');
        },
        onCreateClick: function () {

        },
        onCancelClick: function () {

        },
        onRequestPackageData: function () {
            //hook to request packageData from the controller/model
        },
        onDownloadRequest: function () {

        },
        closeDialog: function () {
            this._dialog.hide();
            this.chooseImgWidget.reset();
        },
        startup: function () {
            this.inherited(arguments);
            this._dialog.placeAt(win.body());
            this._dialog.startup();
        },
        destroy: function () {
            this._locHandle && this._locHandle.cancel();
            this._dialog.destroy();
            this.chooseImgWidget.destroy();
            this.inherited(arguments);
        }
    });
});
