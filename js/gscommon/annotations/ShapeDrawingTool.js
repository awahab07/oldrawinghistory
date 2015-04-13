define([
    "dojo/parser",
    "dojo/_base/declare",
    "dojo/Deferred",
    "dojo/when",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/query",
    "dojo/on",
    "dojo/dom-attr",
    "dijit/registry",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dijit/form/DropDownButton",
    "dijit/MenuItem",
    "dijit/TooltipDialog",
    "dijit/Tooltip",
    "dijit/ConfirmDialog",
    "dojox/mvc/sync",
    "gscommon/BasicImageViewer",
    "gscommon/annotations/ShapeDrawingMixin",
    "gscommon/annotations/AnnotationsToolBar",
    "gscommon/annotations/StylesToolBar",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!gscommon/annotations/ShapeDrawingTool.html",
    "dojo/_base/window",
    "conservation/controllers/BorderLayout",
    "dijit/layout/ContentPane"
], function(parser, declare, Deferred, when, lang, array, domConstruct, domStyle, domClass, query, on, domAttr, registry,
            Toolbar, Button, DropDownButton, MenuItem, TooltipDialog, Tooltip, ConfirmDialog, sync, BasicImageViewer,
            ShapeDrawingMixin, AnnotationsToolBar, StylesToolBar, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
            template, win, BorderLayout, ContentPane){

    var DrawingToolLayout = declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: template,
        startup: function () {
            this.inherited(arguments);
        }
    });

    return declare([BasicImageViewer], {
        // Needed for ShapeDrawingMixin to access OL components in API functions
        _drawingWidget: null,
        _olDrawInteraction: null,
        _olManipulateInteraction: null,
        _shapeDrawingContainerNode: null,
        _windowResizeHandler: null,
        _fullyLoaded: null,
        layout: null,
        headerLabel:null,
        okLabel: null,
        cancelLabel: null,
        annotationRecordNumber: null,
        containerDiv: null,
        compareBtn: null,
        showCloseBtn: false,
        //color: null,
        //stroke: null,
        //strokeValue: null,
        colorPicker: null,
        localizationProvider: null,
        percentZoom: 100, // property to track/represent current zoom value as percent, can be watched to update zoom sliders

        // Paper Config
        paperDpi: 72, // Dots per inch for Exported Image
        paperMargin: 0.5, // Margin in inches to leave along all dimensions
        paperSize: null,    // Array representing [width, height] in inches of expected paper size for export/print.
                            // If null, the bounding box enclosing base image+shapes+margin will be used
        _documentExtent: null, // The resultant extent to simulate paper (Array [xMin, yMin, xMax, yMax])

        _watchHandles: [],

        constructor: function () {
            lang.mixin(this, arguments);
            lang.mixin(this, ShapeDrawingMixin);
            this._drawingWidget = self;
            this.layout = new DrawingToolLayout();
            this._fullyLoaded = new Deferred();
        },
        /**
         * Zooms the map by converting slider value to appropriate resolution
         * @param value number The current slider value, 100 represents a 100% and equivalent to Resolution value 1
         */
        zoomForSliderValue: function(value) {
            var sliderValue = parseFloat(value) || 100;

            this.zoomToPercent(value);  // From BasicImageViewer
        },
        _viewResolutionChanged: function() {
            var self = this;

            if(self._mapView) {
                var currentResolution = self._mapView.getResolution(),
                    percentZoom = 100 / currentResolution;

                self.set('percentZoom', percentZoom);
            }
        },
        _buildView: function(options) {
            if(self._mapView && self._mapView.dispose) {
                self._mapView.dispose();
            }

            options.resolution = 1;
            options.resolutions = [100, 75, 50, 37.5, 25, 17.5, 10, 7.5, 5, 4, 2, 1.5, 1, 0.75, 0.625, 0.5, 0.25, 0.125, 0.1];

            self._mapView = new ol.View(options);
            return self._mapView;
        },
        _initializeOLMap: function() {
            var self = this;
            this.inherited(arguments);

            // Registering event to update zoomSliderValue
            self._map.on("change:resolution", function() {
                var currentResolution = self._mapView.getResolution(),
                    percentZoomValue = 100 / currentResolution;

                self.set('zoomSliderValue', percentZoomValue);
            }, self);

            // PaperSize and Gray Area functionality
            // Registering event handler for postcompose on map to draw gray area
            self._map.on('postcompose', function(event) {
                var self = this,
                    MAXDIM = 100000; // @Experimental

                var ctx = event.context,
                    currentGlobalCompositeOperation = ctx.globalCompositeOperation;

                ctx.globalCompositeOperation = "destination-over";

                if(self.imageSize && self._documentExtent) {
                    // Graying out area outside document extent while leaving 1px room for border rectangle
                    var drawingBottomLeft = self._map.getPixelFromCoordinate([self._documentExtent[0], self._documentExtent[1]]),
                        drawingTopRight = self._map.getPixelFromCoordinate([self._documentExtent[2], self._documentExtent[3]]);

                    ctx.beginPath();
                    ctx.strokeStyle = "grey";
                    ctx.lineWidth = 1;
                    ctx.rect(drawingBottomLeft[0] - 1, drawingBottomLeft[1] + 1, drawingTopRight[0] - drawingBottomLeft[0] + 2, drawingTopRight[1] - drawingBottomLeft[1] - 2);
                    ctx.stroke();

                    ctx.beginPath();

                    ctx.rect(0, 0, drawingBottomLeft[0], MAXDIM);
                    ctx.rect(0, 0, MAXDIM, drawingTopRight[1]);
                    ctx.rect(drawingTopRight[0], 0, MAXDIM, MAXDIM);
                    ctx.rect(0, drawingBottomLeft[1], MAXDIM, MAXDIM);

                    ctx.fillStyle = "#EEE";
                    ctx.fill();

                    // Painting white background
                    ctx.fillStyle = "white";
                    ctx.fillRect(drawingBottomLeft[0] - 1, drawingTopRight[1] - 1, drawingTopRight[0] - drawingBottomLeft[0], drawingBottomLeft[1] - drawingTopRight[1]);
                } else {
                    // Painting entire background with white as there's no paper delimitation
                    ctx.fillStyle = "white";
                    ctx.fillRect(-1 * MAXDIM, -1 * MAXDIM, MAXDIM * 2, MAXDIM * 2);
                }

                ctx.globalCompositeOperation = currentGlobalCompositeOperation;

            }, self);
            self._map.renderSync();
        },
        _paperConfigUpdated: function() {
            var self = this;

            // Calculating document extent (self._documentExtent), accounting for paper size if provided
            if(self.paperSize && self.paperSize.length == 2) {
                var paperSizeInPixels = [self.paperSize[0] * self.paperDpi, self.paperSize[1] * self.paperDpi]; // Letter Size
                var marginSizeInPixels = self.paperMargin * self.paperDpi;
                self.paperSizeWithoutMargins = [paperSizeInPixels[0] - marginSizeInPixels * 2, paperSizeInPixels[1] - marginSizeInPixels * 2];
                self.imageToDocumentPixelRatio = [self.imageSize[0] / self.paperSizeWithoutMargins[0], self.imageSize[1] / self.paperSizeWithoutMargins[1]];

                if (self.imageToDocumentPixelRatio[0] >= self.imageToDocumentPixelRatio[1]) {
                    self.marginInImagePixels = marginSizeInPixels * self.imageToDocumentPixelRatio[0];
                    var bottomPadding = ( paperSizeInPixels[1] * self.imageToDocumentPixelRatio[0] - self.imageSize[1] ) / 2;
                    self._documentExtent = [-1 * self.marginInImagePixels, -1 * bottomPadding, self.imageSize[0] + self.marginInImagePixels, self.imageSize[1] + bottomPadding];
                } else {
                    self.marginInImagePixels = marginSizeInPixels * self.imageToDocumentPixelRatio[1];
                    var leftPadding = ( paperSizeInPixels[0] * self.imageToDocumentPixelRatio[1] - self.imageSize[0] ) / 2;
                    self._documentExtent = [-1 * leftPadding, -1 * self.marginInImagePixels, self.imageSize[0] + leftPadding, self.imageSize[1] + self.marginInImagePixels];
                }
            } else {
                self._documentExtent = null;
            }
        },
        _baseLayerUpdated: function() {
            var self = this;
            this.inherited(arguments);

            // Watching zoom/resolution change
            if(self._mapView) {
                self._mapView.on("change:resolution", self._viewResolutionChanged, self);
            }

            // Shifting baseImageLayer to bottom of drawingLayers if any
            self.shiftLayerToIndex(self._baseOLLayer, 0);

            // Set up paper and margins
            self._paperConfigUpdated();
        },
        _initializeDrawing: function() {
            var self = this;

            // From Mixin
            // self.addNewDrawingLayer(); // Adding a single drawing layer
            self.addManipulateInteraction();
            self.addDrawInteraction();

            self.addColorProvider(self.stylesToolBar);

            window.shapeDrawingTool = self; // For debugging
        },
        buildRendering: function () {
            var self = this;
            
            //this.layout = new DrawingToolLayout();
            ////////////////////
            // swap containerDiv for this._layout.viewer b/c viewer will be inserted into larger drawing app.
            ///////////////////
            this._shapeDrawingContainerNode = this.containerDiv;
            this.containerDiv = this.layout.viewer;
            this._shapeDrawingContainerNode.appendChild(this.layout.domNode);
            /////////////////////
            //call this.inherited after above swap so that viewer is built with correct containerDiv
            ////////////////////
            this.inherited(arguments);

            //if this._shapeDrawingContainerNode was not set to position absolute, then it means it had a height set on
            // it in which case the ShapeDrawingTool domNode will need it to have position relative so that it fills
            // its height and width.
            if(domStyle.get(this._shapeDrawingContainerNode, 'position') !== 'absolute'){
                domStyle.set(this._shapeDrawingContainerNode, 'position', 'relative');
            }

            this.annotToolbar = new AnnotationsToolBar({
                drawingMixin :ShapeDrawingMixin,
                mapWidget: self
            });

            domStyle.set(this.annotToolbar.domNode, {
                position: 'absolute',
                left: 0,
                top: '40px'
            });

            this.layout.viewer.appendChild(self.annotToolbar.domNode);

            this._infoToolTip = new Tooltip({
                connectId: [this.layout.annotationInfoNode],
                label: ""
            });

            if(this.showCloseBtn){
                self._closeBtn = new Button({
                    "class": 'fa fa-close',
                    showLabel: false,
                    onClick: function () {
                        self.onCloseClick();
                    }
                });
                this.layout.closeBtnCont.appendChild(self._closeBtn.domNode);
            }

            this.stylesToolBar = new StylesToolBar({
                mapWidget: self,
                localizationProvider: self.localizationProvider
            });

            this.layout.stylesToolBarCont.appendChild(this.stylesToolBar.domNode);

            // Watching paper changes
            this._watchHandles.push(this.watch('paperSize', this._paperConfigUpdated));
            this._watchHandles.push(this.watch('paperDpi', this._paperConfigUpdated));
            this._watchHandles.push(this.watch('paperMargin', this._paperConfigUpdated));

        },
        postCreate: function() {
            var self = this;
            this.inherited(arguments);
            this.layout.compareBtn.onClick = function (){
                self.onComparisonModeClick();
            };

            //self._colorSync = sync(this, 'color', this.stylesToolBar, 'color');
            //self._strokeSync = sync(this, 'stroke', this.stylesToolBar, 'stroke');
            //self._strokeValueSync = sync(this, 'strokeValue', this.stylesToolBar, 'strokeValue');


            /*this.annotToolbar.onArrowClick = function () {
                self.activateArrowDrawing();
            };*/

            self._initializeDrawing(); // Adds drawing layer and interactions

            this.resize();
        },
        resize: function () {
            this.inherited(arguments);
            this.annotToolbar.resize();
        },
        startup: function() {
            this.inherited(arguments);
            this._infoToolTip.startup();
            this.annotToolbar.startup();
            this.stylesToolBar.startup();
            this.layout.startup();
        },
        destroy: function () {
            this._windowResizeHandler && this._windowResizeHandler.remove();
            this._infoToolTip.destroy();
            this.annotToolbar.destroy();
            this._closeBtn && this._closeBtn.destroy();
            //this._colorWatch && this._colorWatch.unwatch();
            //this._strokeWatch && this._strokeWatch.unwatch();
            //this._colorSync && this._colorSync.remove();
            //this._strokeSync && this._strokeSync.remove();
            //self._strokeValueSync && self._strokeValueSync.remove();
            this.stylesToolBar.destroy();

            array.forEach(this._watchHandles, function (handle) {
                handle.unwatch();
            });

            this.inherited(arguments);
        },
        _setHeaderLabelAttr: function (/* string */ value) {
            this.layout.annotationsToolLabel.innerHTML = value;
            this.headerLabel = value;
        },
        _setAnnotationRecordNumberAttr: function (/* string */ value) {
            this.layout.annotationRecordNumberNode.innerHTML = value;
            this.annotationRecordNumber = value;
        },
        _setInfoToolTipLabelAttr: function (/* string */ value) {
            this._infoToolTip.set('label', value);
            this.infoToolTipLabel = value;
        },
        _setOkLabelAttr: function (/* string */ value) {
            var self = this;
            //when(this._colorPickerDialog.onLoadDeferred, function () {
            //    self._colorPickerDialog.set('buttonOk', value);
            //});
        },
        _setCancelLabelAttr: function (/* string */ value) {
            var self = this;
            //when(this._colorPickerDialog.onLoadDeferred, function () {
            //    self._colorPickerDialog.set('buttonCancel', value);
            //});
        },
        onComparisonModeClick: function () {
            //alert('need to integrate with kevin compare widget');
        },
        onCloseClick: function () {

        }
    });
});