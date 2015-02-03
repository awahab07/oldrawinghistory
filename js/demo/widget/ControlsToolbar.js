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
        mapResolution: 1,
        mapViewResolution: 1,
        margin: 0,
        shouldGrayOut: true,
        shouldConstrainPanning: true,
        margins: null,

        widthToHeightRatio: 500 / 600,

        getMargins: function() {
            var self = this;
            return self.margins;
        },

        /**
         * Event Handler of Slider or Text/Number Widgets on user interaction
         * @param value
         * @private
         */
        _zoomValueChanged: function(changedZoomValue) {
            var self = this,
                resolutionValue = 100 / changedZoomValue;

            self._updateControlsZoomValue(changedZoomValue);

            self.set('zoomValue', changedZoomValue);
            self.set('mapResolution', resolutionValue);
        },

        _updateControlsZoomValue: function(zoomValue) {
            var self = this;

            if(!isNaN(zoomValue) && zoomValue >= 1) {
                self._mapSlider.set('value', zoomValue);
                self._mapSliderValueSpinner.set('value', zoomValue);
            }
        },

        constructor: function(args){

        },
        buildRendering: function () {
            var self = this;
            self.inherited(arguments);


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

            domConstruct.place(self._mapSlider.domNode, "sliderTDId", 0);
            domConstruct.place(self._mapSliderValueSpinner.domNode, "spinnerTDId", 0);

            // Flags
            domConstruct.place(self.grayOutCheckBox.domNode, "grayOutContainerId", 0);
            domConstruct.place(self.constrainPanningCheckBox.domNode, "constrainPanningContainerId", 0);
            // END Flags

            self.watch('mapViewResolution', function(attr, oldVal, newVal) {
                if(!isNaN(newVal) && newVal > 0) {
                    var zoomValue = Math.floor(100 / newVal);
                    self._updateControlsZoomValue(zoomValue);
                }
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