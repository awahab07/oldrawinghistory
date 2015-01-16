define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/on",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/Deferred",
    "dijit/registry",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dijit/form/DropDownButton",
    "dijit/form/HorizontalSlider",
    "dijit/form/NumberSpinner",
    "dijit/form/CheckBox",
    "dijit/form/TextBox",
    "dijit/MenuItem",
    "dijit/TooltipDialog",
    "dijit/_WidgetBase"
], function(declare, lang, array, on, domConstruct, domStyle, Deferred, registry, Toolbar, Button, DropDownButton,
            HorizontalSlider, NumberSpinner, CheckBox, TextBox, MenuItem, TooltipDialog, _WidgetBase){

    return declare([_WidgetBase], {
        // A class to be applied to the root node in our template
        baseClass: "mapControlsToolbarWidget",
        zoomValue: 100,
        mapZoomValue: 1,
        margin: 0,
        shouldGrayOut: true,
        shouldConstrainPanning: true,
        margins: null,

        getMargins: function() {
            var self = this;
            return self.margins;
        },

        _marginChanged: function(value, spinner, spinnerIndex) {
            var self = this;
            if(!self.margins) {
                self.margins = [0, 0, 0, 0];
            }

            self.margins[spinnerIndex] = value;

            self.set('margin', value);

        },

        _zoomValueChanged: function(value) {
            var self = this,
                changedValue = Math.floor(value);

            self._updateControlsZoomValue(changedValue);

            self.set('zoomValue', changedValue);
        },

        _updateControlsZoomValue: function(changedValue) {
            var self = this;

            if(!isNaN(changedValue) && changedValue >= 1) {
                self._mapSlider.set('value', changedValue);
                self._mapSliderValueSpinner.set('value', changedValue);
            }
        },

        constructor: function(args){

        },
        buildRendering: function () {
            var self = this;
            self.inherited(arguments);

            // Margin Controls
            self.leftMarginSpinner = new NumberSpinner({
                value: 0,
                intermediateChanges: true,
                onChange: function(value){
                    self._marginChanged(value, "left", 3);
                },
                style: "width: 60px; height: 20px"
            });

            self.topMarginSpinner = new NumberSpinner({
                value: 0,
                intermediateChanges: true,
                onChange: function(value){
                    self._marginChanged(value, "top", 0);
                },
                style: "width: 60px"
            });

            self.rightMarginSpinner = new NumberSpinner({
                value: 0,
                intermediateChanges: true,
                onChange: function(value){
                    self._marginChanged(value, "right", 1);
                },
                style: "width: 60px"
            });

            self.bottomMarginSpinner = new NumberSpinner({
                value: 0,
                intermediateChanges: true,
                onChange: function(value){
                    self._marginChanged(value, "bottom", 2);
                },
                style: "width: 60px"
            });

            self._marginDiv = domConstruct.create("div", {
                style: {
                    float: 'left',
                    marginRight: '100px'
                }
            });
            domConstruct.place(
                    '<table>' +
                        '<tr><td>Margins px</td><td></td><td id="topMarginContainerId"></td><td></td></tr>'+
                        '<tr><td></td><td id="leftMarginContainerId"></td><td></td><td id="rightMarginContainerId"></td></tr>'+
                        '<tr><td></td><td></td><td id="bottomMarginContainerId"></td><td></td></tr>'+
                    '</table>',
                self._marginDiv,
                0
            );

            self.domNode.appendChild(self._marginDiv);


            // Flags
            self.grayOutCheckBox = new CheckBox({
                name: "checkBox",
                value: true,
                checked: true,
                onChange: function (isChecked) {
                    self.set('shouldGrayOut', isChecked);
                }
            });

            self.constrainPanningCheckBox = new CheckBox({
                name: "checkBox",
                value: true,
                checked: true,
                disabled: true,
                onChange: function (isChecked) {
                    self.set('shouldConstrainPanning', isChecked);
                }
            });

            self._flagsDiv = domConstruct.create("div", {
                style: {
                    marginLeft: '100px'
                }
            });
            domConstruct.place(
                    '<table>' +
                        '<tr><td>Gray Out</td><td id="grayOutContainerId"></td></tr>'+
                        '<tr><td>Constrain Panning</td><td id="constrainPanningContainerId"></td></tr>'+
                    '</table>',
                self._flagsDiv,
                0
            );

            self.domNode.appendChild(self._flagsDiv);
            // END Flags

            // Stts Div
            self._statsDiv = domConstruct.create("div", {
                style: {
                    marginLeft: '50px'
                }
            });
            domConstruct.place(
                    '<table>' +
                    '<tr><td></td><td id="mousePositionContainerId"></td></tr>' +
                    '</table>',
                self._statsDiv,
                0
            );

            self.domNode.appendChild(self._statsDiv);
            // END Stats Div

            self._mapSlider = new HorizontalSlider({
                name: "zoom",
                value: 100,
                minimum: 1,
                maximum: 1000,
                showButtons: false,
                intermediateChanges: true,
                onChange: function(value){
                    self._zoomValueChanged(value);
                },
                style: "width:200px;"
            });

            self._mapSliderValueSpinner = new NumberSpinner({
                value: 100,
                constraints: { min:1, max:1000},
                smallDelta: 25,
                largeDelta: 50,
                intermediateChanges: true,
                onChange: function(value){
                    self._zoomValueChanged(value);
                },
                style: "width: 60px"
            });

            self._sliderDiv = domConstruct.create("div", {
                style: {
                    float: 'right'
                }
            });
            domConstruct.place(
                '<table>' +
                    '<tr>' +
                        '<td id="sliderTDId"></td>' +
                        '<td id="spinnerTDId"></td>' +
                        '<td>%</td>' +
                    '</tr>' +
                '</table>',
                self._sliderDiv,
                0
            );

            self.domNode.appendChild(self._sliderDiv)
        },
        postCreate: function() {
            var self = this;
            this.inherited(arguments);

            domConstruct.place(self.topMarginSpinner.domNode, "topMarginContainerId", 0);
            domConstruct.place(self.rightMarginSpinner.domNode, "rightMarginContainerId", 0);
            domConstruct.place(self.bottomMarginSpinner.domNode, "bottomMarginContainerId", 0);
            domConstruct.place(self.leftMarginSpinner.domNode, "leftMarginContainerId", 0);

            domConstruct.place(self._mapSlider.domNode, "sliderTDId", 0);
            domConstruct.place(self._mapSliderValueSpinner.domNode, "spinnerTDId", 0);

            // Flags
            domConstruct.place(self.grayOutCheckBox.domNode, "grayOutContainerId", 0);
            domConstruct.place(self.constrainPanningCheckBox.domNode, "constrainPanningContainerId", 0);
            // END Flags

            self.watch('mapZoomValue', function(attr, oldVal, newVal) {
                //if(!isNaN(newVal) && newVal > 0)
                    self._updateControlsZoomValue(newVal * 100);
            });
        },
        startup: function() {
            this.inherited(arguments);
            //////////////////
            //startup on toolbar will also call startup on all children widgets that were
            //added with addChild.
            //////////////////
            //self._mapSlider.startup();
            //self._mapSliderValueSpinner.startup();
        },
        destroy: function () {
            var self = this;
            self._mapSlider.destroy();
            self._mapSliderValueSpinner.destroy();
            self.inherited(arguments);
        }
    });
});