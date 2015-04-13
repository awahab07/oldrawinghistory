define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/on",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/Deferred",
    "dojo/aspect",
    "dijit/registry",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dijit/form/ToggleButton",
    "dijit/form/DropDownButton",
    "dijit/MenuItem",
    "dijit/TooltipDialog",
    "dijit/_WidgetBase"
], function(declare, lang, array, on, domConstruct, domStyle, Deferred, aspect, registry, Toolbar, Button, ToggleButton,
            DropDownButton, MenuItem, TooltipDialog, _WidgetBase){

    return declare([_WidgetBase], {
        // A class to be applied to the root node in our template
        baseClass: "annotationsToolBar",
        currentHeight: null,
        widthFactor: 42,
        activeTool: null,
        // widget reference containing map and drawing layers, needed for the API
        _widthMultiplier: 1,
        _drawingWidget: null,
        _selectionBtn: null,
        _moveBtn: null,
        _freeDrawBtn: null,
        _polygonBtn: null,
        _circleBtn: null,
        _lineBtn: null,
        _arrowBtn: null,
        _markerBtn: null,
        _dotBtn: null,
        _textBtn: null,
        _compositeBtn: null,
        _delSelectedBtn: null,
        _undoBtn: null,
        _redoBtn: null,
        // widget reference containing map and drawing layers, needed to call drawing API methods
        _mapWidget: null,
        constructor: function(args){
            var self = this;
            self.inherited(arguments);

            self._mapWidget = args.mapWidget;

            aspect.after(self._mapWidget, "drawingDeactivated", function(method, args){
                self.onDrawingDeactivateAspect(self);
            }, true);
        },
        buildRendering: function () {
            var self = this;
            self.inherited(arguments);

            self._toolbar = new Toolbar();

            self._selectionBtn = new ToggleButton({
                //iconClass: 'fa fa-binoculars',
                "class": 'galSysAnnSelectTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);
                    self.onSelectionClick(value);
                }
            });

            self._moveBtn = new ToggleButton({
                //iconClass: 'fa fa-paw',
                "class": 'galSysAnnMoveTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);
                    self.onMoveClick(value);
                }
            });

            self._freeDrawBtn = new ToggleButton({
                //iconClass: 'fa fa-pencil',
                "class": 'galSysAnnFreeHandTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);

                    if(value)
                        self.onFreeDrawClick();
                }
            });

            self._polygonBtn = new ToggleButton({
                //iconClass: 'fa fa-square-o',
                "class": 'galSysAnnRectTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);

                    if(value)
                        self.onPolygonClick();
                }
            });

            self._circleBtn = new ToggleButton({
                //iconClass: 'fa fa-circle-o',
                "class": 'galSysAnnEllipseTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);

                    if(value)
                        self.onCircleClick();
                }
            });

            self._lineBtn = new ToggleButton({
                //iconClass: 'fa fa-wheelchair',
                "class": 'galSysAnnLineTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);

                    if(value)
                        self.onLineClick();
                }
            });

            self._arrowBtn = new ToggleButton({
                //iconClass: 'fa fa-arrow-up',
                "class": 'galSysAnnArrowTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);

                    if(value)
                        self.onArrowClick();
                }
            });

            self._markerBtn = new ToggleButton({
                //iconClass: 'fa fa-map-marker',
                "class": 'galSysAnnMarkerTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);

                    if(value)
                        self.onMarkerClick();
                }
            });

            self._dotBtn = new ToggleButton({
                //iconClass: 'fa fa-circle',
                "class": 'galSysAnnDotTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);

                    if(value)
                        self.onDotClick();
                }
            });

            self._textBtn = new ToggleButton({
                //iconClass: 'fa fa-text-width',
                "class": 'galSysAnnTextTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);

                    if(value)
                        self.onTextClick();
                }
            });

            //self._compositeBtn = new ToggleButton({
            //    iconClass: 'fa fa-archive',
            //    showLabel: false,
            //    onChange: function(value){
            //        self.updateToolState(this, value);
            //
            //        if(value)
            //            self.onCompositeClick();
            //    }
            //});

            self._freeHandCloseBtn = new ToggleButton({
                iconClass: 'fa fa-circle-o',
                "class": 'galSysAnnFreeHandCloseTool',
                showLabel: false,
                onChange: function(value){
                    self.updateToolState(this, value);

                    if(value)
                        self.onFreeHandCloseClick();
                }
            });

            self._delSelectedBtn = new Button({
                //iconClass: 'fa fa-close',
                "class": 'galSysAnnDeleteTool',
                showLabel: false,
                onClick: function(){
                    self.onDeleteSelectedFeatures();
                }
            });

            self._undoBtn = new Button({
                //iconClass: 'fa fa-undo',
                "class": 'galSysAnnUndoTool',
                showLabel: false,
                onClick: function(){
                    self.onUndo();
                }
            });

            self._redoBtn = new Button({
                //iconClass: 'fa fa-repeat',
                "class": 'galSysAnnRedoTool',
                showLabel: false,
                onClick: function(){
                    self.onRedo();
                }
            });

            self._toolbar.addChild(self._selectionBtn);
            self._toolbar.addChild(self._moveBtn);
            self._toolbar.addChild(self._freeDrawBtn);
            self._toolbar.addChild(self._polygonBtn);
            self._toolbar.addChild(self._circleBtn);
            self._toolbar.addChild(self._lineBtn);
            self._toolbar.addChild(self._arrowBtn);
            self._toolbar.addChild(self._markerBtn);
            self._toolbar.addChild(self._dotBtn);
            self._toolbar.addChild(self._textBtn);
            //self._toolbar.addChild(self._compositeBtn);
            self._toolbar.addChild(self._freeHandCloseBtn);
            self._toolbar.addChild(self._delSelectedBtn);
            self._toolbar.addChild(self._undoBtn);
            self._toolbar.addChild(self._redoBtn);
            //self._toolbar.addChild(self._exportDropDown);

            self.domNode.appendChild(self._toolbar.domNode);
        },
        postCreate: function() {
            var self = this;
            this.inherited(arguments);
        },
        selectTool: function (toolName) {
            switch(toolName){
                case 'Rectangle':
                    this._polygonBtn.set('checked', true);
                    break;
                case 'Arrow':
                    this._arrowBtn.set('checked', true);
                    break;
                case 'Ellipse':
                    this._circleBtn.set('checked', true);
                    break;
                case 'Free hand line':
                    this._freeDrawBtn.set('checked', true);
                    break;
                case 'Line':
                    this._lineBtn.set('checked', true);
                    break;
                case 'Point':
                    this._dotBtn.set('checked', true);
                    break;
                case 'Sequential Number Pin':
                    this._MarkerBtn.set('checked', true);
                    break;
                case 'Stamp':
                    //this._stampBtn.set('checked', true);
                    break;
                case 'Text':
                    this._textBtn.set('checked', true);
                    break;
                default:
            }
        },
        startup: function() {
            this.inherited(arguments);
            //////////////////
            //startup on toolbar will also call startup on all children widgets that were
            //added with addChild.
            //////////////////
            this._toolbar.startup();
            this._undoBtn.startup();
            this._redoBtn.startup();
            this._delSelectedBtn.startup();
            this._polygonBtn.startup();
            this._arrowBtn.startup();
            //this._exportPngBtn.startup();
            //this._exportJpgBtn.startup();
        },
        destroy: function () {
            var self = this;
            self._toolbar.destroy();
            this._undoBtn.destroy();
            this._redoBtn.destroy();
            this._delSelectedBtn.destroy();
            this._polygonBtn.destroy();
            this._arrowBtn.destroy();
            //self._exportPngBtn.destroy();
            //self._exportJpgBtn.destroy();
            self.inherited(arguments);
        },
        updateToolState: function (/* Object */ tool, /* boolean */ selected) {
            if(selected){
                //deselect any currently active.
                this.activeTool && this.activeTool.set('checked', false);
                this.activeTool = tool;
            }else{
                if(this.activeTool.id === tool.id){
                    this.activeTool = false;
                }
            }
        },
        resize: function () {
            var self, availableHeight, topOffset, topMargin, topPos, containerNode, newHeight, resizeCallback, halve;

            self = this;
            containerNode = this.domNode.parentNode;
            availableHeight = domStyle.get(containerNode, 'height');
            topMargin = domStyle.get(this.domNode, 'margin-top');
            topPos = domStyle.get(this.domNode, 'top');
            topOffset = topMargin + topPos;
            availableHeight -= ( topOffset * 2 );
            resizeCallback = function () {
                /*console.log('------------ AnnotationsResize: ');
                console.log({
                    widthMultiplier: self._widthMultiplier,
                    currentHeight: self.currentHeight
                });*/
                domStyle.set(self._toolbar.domNode, 'width', (self.widthFactor * self._widthMultiplier) + 'px');
                self._resizeTimer = null;
            };

            this.currentHeight = domStyle.get(this.domNode, 'height');
            newHeight = this.currentHeight;

            halve = (self._widthMultiplier - 1);

            while(halve > 0){
                newHeight /= 2;
                halve--;
            }

            while(availableHeight < newHeight){
                self._widthMultiplier++;
                newHeight /= 2;
            }

            if(!self._resizeTimer){
                this._resizeTimer = setTimeout(resizeCallback, 300);
            }else{
                clearTimeout(this._resizeTimer);
                this._resizeTimer = setTimeout(resizeCallback, 300);
            }
        },
        onRedo: function () {
            var self = this;
            self._mapWidget.redo();
        },
        onUndo: function () {
            var self = this;
            self._mapWidget.undo();
        },
        onDeleteSelectedFeatures: function () {
            //hook for delete annotation action
            var self = this;
            self._mapWidget.deleteSelectedFeatures();
        },
        onPolygonClick: function () {
            //hook for polypgon action
            var self = this;
            self._mapWidget.activateRectangleDrawing();
        },
        onArrowClick: function () {
            var self = this;
            self._mapWidget.activateArrowDrawing();
        },
        onExport: function (/*string*/exportType) {
            //hook for exporting image.
            var self = this;

            self._mapWidget.activateArrowDrawing();
        },
        onMarkerClick: function() {
            var self = this;
            self._mapWidget.activateMarkerDrawing();
        },
        onDotClick: function() {
            var self = this;
            self._mapWidget.activateDotDrawing();
        },
        onSelectionClick: function (value) {
            var self = this;

            if(value) {
                self._mapWidget.disableCanvasPanning();
                self._mapWidget.enableSelectionAndDrawing();
                self._mapWidget.deactivateDrawing();
            }
        },
        onFreeHandCloseClick: function () {
            var self = this;
            self._mapWidget.activateFreeHandClosedDrawing();
        },
        onCircleClick: function () {
            var self = this;
            self._mapWidget.activateEllipseDrawing();
        },
        onMoveClick: function (value) {
            var self = this;

            if(value) {
                self._mapWidget.enableCanvasPanning();
                self._mapWidget.disableSelectionAndDrawing();
            } else {
                self._mapWidget.disableCanvasPanning();
                self._mapWidget.enableSelectionAndDrawing();
            }
        },
        onFreeDrawClick: function () {
            var self = this;
            self._mapWidget.activateFreeHandLineDrawing();
        },
        onLineClick: function () {
            var self = this;
            self._mapWidget.activateLineDrawing();
        },
        onTextClick: function () {
            var self = this;
            self._mapWidget.activateTextDrawing();
        },
        onCompositeClick: function () {

        },
        onDrawingDeactivateAspect: function(self, args) {
            self._selectionBtn.set('checked', true);
        }
    });
});