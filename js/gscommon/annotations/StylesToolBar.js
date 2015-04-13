/**
 * Widget template Created by Jason Hornbuckle
 */
define([
    "dojo/_base/declare",
    "dojo/Deferred",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/on",
    "dojo/when",
    "dojo/query",
    "dojo/store/Memory",
    "dijit/form/Button",
    "dijit/form/Select",
    "dijit/ConfirmDialog",
    "dijit/form/ComboButton",
    "dijit/DropDownMenu",
    "dijit/MenuItem",
    "dojox/widget/ColorPicker",
    "dojox/mvc/sync",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "gscommon/_LocalizeMixin",
    "dijit/form/HorizontalSlider",
    //Replace next line with path to your custom template.
    "dojo/text!gscommon/annotations/StylesToolBar.html",
    "dijit/TooltipDialog",
    "dijit/popup"
], function (declare, Deferred, lang, array, domConstruct, domStyle, domClass, on, when, query, Memory, Button, Select,
             ConfirmDialog, ComboButton, DropDownMenu, MenuItem, ColorPicker, sync, _WidgetBase, _TemplatedMixin,
            _WidgetsInTemplateMixin, _LocalizeMixin, HorizontalSlider, template, TooltipDialog, popup) {

    var GalSysColorPicker = declare([ColorPicker], {
        buildRendering: function () {
            this.inherited(arguments);
            domStyle.set(this.safePreviewNode, 'display', 'none');
            this._dojoxColorPickerPreview = query('.dojoxColorPickerPreview', this.domNode)[0];
            //append two transparent indication options.
            self._transFill = domConstruct.toDom("<div class='galSysTransparentFill'><div></div></div>");
            self._transStroke = domConstruct.toDom("<div class='galSysTransparentStroke'><div></div></div>");
            domStyle.set(self._transFill, 'display', 'none');
            domStyle.set(self._transStroke, 'display', 'none');
            this._dojoxColorPickerPreview.appendChild(self._transFill);
            this._dojoxColorPickerPreview.appendChild(self._transStroke);
        },
        onChange: function () {
            domStyle.set(self._transFill, 'display', 'none');
            domStyle.set(self._transStroke, 'display', 'none');
        },
        setTransparent: function (/* string */ type) {
            //set value to #fff first so that cursor node 'resets' to upper left ( white ) position.
            //then set to 'transparent' so value will be correct.
            this.set('animatePoint', false);
            this.set('value', '#ffffff');
            this.value = 'transparent';
            //clear values;
            this.Rval.value = '';
            this.Gval.value = '';
            this.Bval.value = '';
            this.hexCode.value = '';
            this.set('animatePoint', true);

            if(type === 'stroke'){
                domStyle.set(self._transStroke, 'display', 'block');
                domStyle.set(self._transFill, 'display', 'none');
            }else if(type === 'color'){
                domStyle.set(self._transFill, 'display', 'block');
                domStyle.set(self._transStroke, 'display', 'none');
            }else if(type === 'textFill'){
                domStyle.set(self._transFill, 'display', 'block');
                domStyle.set(self._transStroke, 'display', 'none');
            }
        }
    });

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, _LocalizeMixin], {
        templateString: template,
        textFillPickerBtn: null,
        exportAsPNGBtn: null,
        exportAsJPGBtn: null,
        saveBtn: null,
        zoomSlider: null,
        zoomSliderValue: null,
        opacitySlider: null,
        opacity: null,
        opacitySliderValue: null,
        colorPickerLabelNode: null,
        lineStyleLabelNode: null,
        textPickerLabelNode: null,
        zoomSliderCont: null,
        chooseColorLabel: null,
        chooseStrokeLabel: null,
        chooseTextFillLabel: null,
        exportAsLabel: 'Export As',
        colorPicker: null,
        colorPickerBtn: null,
        color: null,
        stroke: null,
        textFill: null,
        lineStyleSelect: null,
        lineStyleValue: null,
        lineWidth: null,
        lineWidthValue: null,
        strokeSelectLabel: 'value',
        textSelectStore: null,
        textSelectLabel: 'value',
        textValue: null,
        textSizeSelectStore: null,
        textSizeSelectLabel: 'value',
        textSizeValue: null,
        lineWidthAuthStore: null,
        localizationProvider: null,
        _colorPickerDialog: null,
        _transparentColorBtn: null,
        _pickerSettingValue: null,
        _localizeItems: null,

        _mapWidget: null, // For API calls

        constructor: function(args) {
            lang.mixin(this, args);
            this._localizeItems = [];

            this._mapWidget = args.mapWidget;
        },
        buildRendering: function (){
            var self = this;

            this.inherited(arguments);
            //color picker and dialog
            //this._colorPickerDialog = new ConfirmDialog({
            //    "class": 'galSys-modal galSysShapeDrawingColorPicker',
            //    style: 'z-index:10001;'
            //});
            //this.colorPicker = GalSysColorPicker({
            //    showHsv: false
            //});
            this._transparentColorBtn = new Button({
                onClick: function () {
                    self.colorPicker.setTransparent(self._pickerSettingValue);
                }
            });
            this.lineStyleSelect.set('labelAttr', this.strokeSelectLabel);

            //add galSysSwatch picker
            this.swatchPicker = new TooltipDialog({
                //style: "padding:10px;",
                store: null,
                onColorClick: function (colorData) {
                    //if(color === 'rgba(0, 0, 0, 0)'){
                    //    color = 'transparent';
                    //}
                    self.set(self._pickerSettingValue, colorData);
                },
                _setStoreAttr: function (/* Object */ store) {
                    var self = this, i = 0, len, color, btn, rgbaValue, rows, bg;

                    this.store = store;

                    if(this.store && this.store.data){
                        this.colorCount = len = this.store && this.store.data.length;
                        rows = Math.ceil(this.colorCount/2);
                    }else{
                        this.colorCount = len = 0;
                    }

                    domStyle.set(this.containerNode, 'width', '48px');

                    //destroy previously added buttons.
                    this.destroyDescendants();
                    //add button for each color
                    this.containerNode.innerHTML = '';
                    domClass.add(this.containerNode, 'clearfix');
                    this.leftSide = domConstruct.create('div', {
                        style: 'width:20px;float:left;padding-right:8px;'
                    });
                    this.rightSide = domConstruct.create('div', {
                        style: 'width:20px;float:left;'
                    });
                    this.containerNode.appendChild(this.leftSide);
                    this.containerNode.appendChild(this.rightSide);

                    for(i; i < len; i++){
                        color = store.data[i];
                        rgbaValue = color.r + ',' + color.g + ',' + color.b + ',' + color.a;
                        bg = 'background:rgba(' + rgbaValue + ')';
                        btn = new Button({
                            colorData: color,
                            style: 'width:20px;height:20px;margin:0px;' + bg,
                            onClick: function () {
                                //var color = domStyle.get(this.domNode, 'background-color');
                                self.onColorClick(this.colorData);
                            }
                        });

                        if(color.a === 0){
                            domClass.add(btn.domNode, ['galSysColorPickerBtn', 'transparentStyle' ]);
                        }else{
                            domClass.add(btn.domNode, ['galSysSwatchShadow']);
                        }

                        if(i !==  0 && i !== rows){
                            domStyle.set(btn.domNode, 'margin-top', '6px');
                        }

                        if(i < rows){
                            this.leftSide.appendChild(btn.domNode);
                        }else {
                            this.rightSide.appendChild(btn.domNode);
                        }
                    }
                },
                onMouseLeave: function(){
                    popup.close(self.swatchPicker);
                }
            });

            this._localizeItems = this._localizeItems.concat([
                {
                    domNode: this.colorPickerLabelNode,
                    id: 191,
                    method: 'useLiteral'
                },
                {
                    domNode: this.lineStyleLabelNode,
                    id: 4838,
                    method: 'useLiteral'
                },
                {
                    domNode: this.textPickerLabelNode,
                    id: 1535,
                    method: 'useLiteral'
                },
                {
                    domNode: this.opacityLabelNode,
                    id: 4843,
                    method: 'useLiteral'
                }
                //,{
                //    widget: this,
                //    id: 4796,
                //    method: 'useLiteral',
                //    label: 'chooseColorLabel'
                //},
                //{
                //    widget: this,
                //    id: 4797,
                //    method: 'useLiteral',
                //    label: 'chooseStrokeLabel'
                //},
                //{
                //    widget: this,
                //    id: 4798,
                //    method: 'useLiteral',
                //    label: 'chooseTextFillLabel'
                //},
                //{
                //    widget: this.saveBtn,
                //    id: 172,
                //    method: 'useLiteral',
                //    label: 'label'
                //}
            ]);

            this.zoomSlider = new HorizontalSlider({
                name: "slider",
                minimum: 10,
                maximum: 120,
                intermediateChanges: true,
                "class": "galSysZoomSlider",
                showButtons: false,
                onChange: function (value) {
                    self.zoomSliderValue.innerHTML = Math.floor(value) + '%';
                    self.onZoomValueChanged(value);
                }
            });
            this.zoomSlider.set('value', 75);
            this.zoomSliderCont.appendChild(this.zoomSlider.domNode);

            this.opacitySlider = new HorizontalSlider({
                name: "slider",
                minimum: 0,
                maximum: 100,
                intermediateChanges: true,
                "class": "galSysOpacitySlider",
                showButtons: false,
                onChange: function (value) {
                    self.opacitySliderValue.innerHTML = Math.floor(value) + '%';
                    self.set('opacity', value);
                }
            });
            this.opacitySlider.set('value', this.opacity);
            this.opacitySliderCont.appendChild(this.opacitySlider.domNode);

            //when(this._colorPickerDialog.onLoadDeferred, function () {
            //    //win.body().appendChild(self._colorPickerDialog.domNode);
            //    //self._colorPickerDialog.startup();
            //    self._colorPickerDialog.containerNode.appendChild(self._transparentColorBtn.domNode);
            //    self._colorPickerDialog.containerNode.appendChild(self.colorPicker.domNode);
            //    domClass.add(self._colorPickerDialog.titleBar, 'galSys-modal-header');
            //    domClass.add(self._colorPickerDialog.titleNode, 'galSys-headline-2');
            //    domClass.add(self._colorPickerDialog.closeButtonNode, 'fa fa-close');
            //    domClass.add(self._colorPickerDialog.okButton.domNode, 'galSys-mediumBtn galSys-primaryBtnColor');
            //    domClass.add(self._colorPickerDialog.cancelButton.domNode, ['galSys-mediumBtn', 'galSys-cancelBtn']);
            //
            //    //set up localization
            //    self.localize(self.localizationProvider, self._localizeItems);
            //});

            this.saveBtn.set('iconClass', 'fa fa-save');
            this.exportAsBtn.set('iconClass', 'fa fa-mail-forward');
            domClass.add(this.exportAsBtn.focusNode, 'fa fa-caret-down');

            self.localize(self.localizationProvider, self._localizeItems);
        },
        setColorPickerBtnColor: function (/* string */ colorProp, /* object */ value) {
            var buttonNode, rgbaColor, widgetNode, cssProp;

            rgbaColor = 'rgba(' + value.r + ',' + value.g + ',' + value.b + ',' + value.a + ')';

            if(value.id === 1){
                rgbaColor = 'transparent';
            }

            if(colorProp === 'color'){
                widgetNode = this.colorPickerBtn.domNode;
                cssProp = 'backgroundColor';
            }else if(colorProp === 'stroke'){
                widgetNode = this.strokePickerBtn.domNode;
                cssProp = 'border-color';
            }else if(colorProp === 'textFill'){
                widgetNode = this.textFillPickerBtn.domNode;
                cssProp = 'backgroundColor';
            }

            buttonNode = query('.dijitButtonNode', widgetNode)[0];

            if(rgbaColor === 'transparent'){
                domClass.add(widgetNode, 'transparentStyle');
                domStyle.set(widgetNode, cssProp, rgbaColor);
                domClass.remove(widgetNode, 'galSysSwatchShadow');
            }else{
                domClass.remove(widgetNode, 'transparentStyle');
                if(colorProp !== 'stroke'){
                    domStyle.set(widgetNode, cssProp, rgbaColor);
                    domClass.add(widgetNode, 'galSysSwatchShadow');
                }else{
                    domStyle.set(buttonNode, cssProp, rgbaColor);
                }
            }
        },
        handleColorPickerBtnClick: function (/* string */ colorProp) {
            var self = this, label, removeClasses, addClasses;

            if(colorProp === 'color'){
                label = this.chooseColorLabel;
                removeClasses = ['galSysStrokePickerBtn', 'galSysTextFillPickerBtn'];
                addClasses = ['galSysColorPickerBtn', 'transparentStyle'];
            }else if(colorProp === 'stroke'){
                label = this.chooseStrokeLabel;
                removeClasses = ['galSysColorPickerBtn', 'galSysTextFillPickerBtn'];
                addClasses = ['galSysStrokePickerBtn', 'transparentStyle'];
            }else if(colorProp === 'textFill'){
                label = this.chooseTextFillLabel;
                removeClasses = ['galSysStrokePickerBtn', 'galSysColorPickerBtn'];
                addClasses = ['galSysTextFillPickerBtn', 'transparentStyle'];
            }

            //this._colorPickerDialog.titleNode.innerHTML = label;
            domClass.remove(this._transparentColorBtn.domNode, removeClasses);
            domClass.add(this._transparentColorBtn.domNode, addClasses);
            this._pickerSettingValue = colorProp;

            this._colorPickerDialog.show().then(function () {
                if(self[self._pickerSettingValue] === 'transparent'){
                    self.colorPicker.setTransparent(self._pickerSettingValue);
                }else{
                    self.colorPicker.set('value', self[self._pickerSettingValue]);
                    self.colorPicker.onChange(self[self._pickerSettingValue]);
                }
            });
        },
        postCreate: function () {
            var self = this;

            this.inherited(arguments);
            //this.colorPickerBtn.onClick = function () {
            //    self.handleColorPickerBtnClick('color');
            //};
            //
            //this.strokePickerBtn.onClick = function () {
            //    self.handleColorPickerBtnClick('stroke');
            //};
            //
            //this.textFillPickerBtn.onClick = function () {
            //    self.handleColorPickerBtnClick('textFill');
            //};

            //this._colorPickerDialog.onExecute = function () {
            //    self.set(self._pickerSettingValue, self.colorPicker.value);
            //    self._pickerSettingValue = null;
            //    self._colorPickerDialog.hide();
            //};

            this._colorWatch = this.watch('color', function (prop, oldVal, newVal) {
                self.setColorPickerBtnColor(prop, newVal);
            });

            this._strokeWatch = this.watch('stroke', function (prop, oldVal, newVal) {
                self.setColorPickerBtnColor(prop, newVal);
            });

            this._textFillWatch = this.watch('textFill', function (prop, oldVal, newVal) {
                self.setColorPickerBtnColor(prop, newVal);
            });

            this.saveBtn.onClick = function () {
                self.onSaveClick();
            };

            this.exportAsPNGBtn.onClick = function () {
                self._mapWidget.exportCanvasForPaper("PNG");
            };
            this.exportAsJPGBtn.onClick = function () {
                self._mapWidget.exportCanvasForPaper("JPEG");
            };

            self.own(
                on(self.strokePickerBtn.domNode, 'mouseover', function () {
                    self._pickerSettingValue = 'stroke';
                    popup.open({
                        popup: self.swatchPicker,
                        around: self.strokePickerBtn.domNode
                    });
                }),
                on(self.colorPickerBtn.domNode, 'mouseover', function () {
                    self._pickerSettingValue = 'color';
                    popup.open({
                        popup: self.swatchPicker,
                        around: self.colorPickerBtn.domNode
                    });
                }),
                on(self.textFillPickerBtn.domNode, 'mouseover', function () {
                    self._pickerSettingValue = 'textFill';
                    popup.open({
                        popup: self.swatchPicker,
                        around: self.textFillPickerBtn.domNode
                    });
                }),
                this.watch('lineWidth', function (prop, oldVal, newVal) {
                    self.lineWidthSelect.set('value', newVal.id);
                }),
                this.watch('lineStyleValue', function (prop, oldVal, newVal) {
                    self.lineStyleSelect.set('value', newVal.id);
                }),
                this.watch('opacity', function (prop, oldVal, newVal) {
                    self.opacitySlider.set('value', newVal);
                }),
                sync(this, 'lineStyleValue', this.lineStyleSelect, 'value')
            );

            self.lineWidthSelect.onChange = function (idValue) {
                var opt;
                if(self.lineWidthSelect.store){
                    opt = self.lineWidthSelect.store.get(idValue);
                    self.set('lineWidth', opt);
                }
            };
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
        _setTextSelectStoreAttr: function (/* Object */ store) {
            this.textSelectStore = store;
            this.textSelect.set('labelAttr', this.textSelectLabel);
            this.textSelect.set('store', store);
            this.textSelect.set('value', this.textSelect.value);
        },
        _setTextSizeSelectStoreAttr: function (/* Object */ store) {
            this.textSizeSelectStore = store;
            this.textSizeSelect.set('labelAttr', this.textSizeSelectLabel);
            this.textSizeSelect.set('store', store);
            this.textSizeSelect.set('value', this.textSizeSelect.value);
        },
        _setLineWidthAuthStoreAttr: function (/* Object */ store) {
            this.lineWidthAuthStoreStore = store;
            this.lineWidthSelect.set('sortByLabel', false);
            this.lineWidthSelect.set('labelAttr', 'label');
            this.lineWidthSelect.set('queryOptions', {sort: [{attribute: "id", descending: false}]});
            this.lineWidthSelect.set('store', store);
            if(this.lineWidth) {
                this.lineWidthSelect.set('value', this.lineWidth.id);
            }
        },
        onSaveClick: function () {

        },
        onExportAsPNGClick: function () {

        },
        onExportAsJPGClick: function () {

        },
        onZoomValueChanged: function (zoomValue) {

        },
        startup: function () {
            this.inherited(arguments);
            this.zoomSlider.startup();
        },
        destroy: function () {
            this._colorPickerDialog && this._colorPickerDialog.destroy();
            this._colorWatch && this._colorWatch.unwatch();
            this._strokeWatch && this._strokeWatch.unwatch();
            this._textFillWatch && this._textFillWatch.remove();
            this.zoomSlider.destroy();
            this.inherited(arguments);
        }
    });
});
