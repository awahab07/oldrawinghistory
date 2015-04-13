define([
    "dojo/_base/declare",
    "dojo/_base/fx",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/on",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/aspect",
    "dojo/Deferred",
    "dijit/registry",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dojo/store/Memory",
    "dijit/_WidgetBase",
    "dojo/request/script",
    "dojo/when",
    "gscommon/_LocalizeMixin"
], function(declare, baseFx, lang, arrayUtil, on, domConstruct, domStyle, aspect, Deferred, registry,  Toolbar, Button,
            Memory, _WidgetBase, script, when, _LocalizeMixin){

    return declare([_WidgetBase, _LocalizeMixin], {

        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // How to use
        //
        // To use the BasicImageViewer you will also need the BasicImageViewerModel and BasicImageViewerController.
        //
        //            var basicImageViewerModel = new BasicImageViewerModel({
        //              app: self.app
        //            });
        //
        //            var basicImageViewer = new BasicImageViewer({
        //                canvasWidth: "100%",
        //                canvasHeight: "100%",
        //                containerDiv: self.olViewerNode,
        //                baseImageLayer: {}
        //            });
        //
        //            var basicImageViewerCont = new BasicImgViewController(basicImageViewerModel, basicImageViewer);
        //
        //            basicImageViewerModel.load(masterMediaId);
        //
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

        // A class to be applied to the root node in our template
        baseClass: "galsysBasicImageViewer",
        canvasWidth: "500px", // (string) The mapDiv.style.width property visible canvas, the width of dom node/div of OpenLayers map
        canvasHeight: "500px", // (string) The mapDiv.style.height property of visible canvas, the height of dom node/div of OpenLayers map
        baseImageUrl: "", // For watch
        baseImageLayer: null,
        containerDiv: null,
        mapDiv: null,
        zoomFactor: 2, // Factor to multiply or divide the current resolution to, against a single zoom step, when zoomed in/out
        zoomMinPercent: 10, //min percent that viewer should allow.
        zoomMaxPercent: 200, //max percent that viewer should allow.
        _map: null, // ol.Map reference
        _defaultMapControls: null,
        _mapView: null, // ol.View
        _baseOLLayer: null, // ol.layer.Base
        _baseOLLayerProjection: null, // ol.proj.Projection
        _baseImageExtent: null, // ol.extent
        _localizeItems: null,
        imageSize: [],


        _getCenterForLayerType: function() {
            var self = this,
                center = self.baseImageLayer && self.baseImageLayer.baseImageMeta ?
                        (   self.baseImageLayer.baseImageMeta.center ||
                            [ self.baseImageLayer.baseImageMeta.width/2, self.baseImageLayer.baseImageMeta.height/2 ] ):
                        false;

            if(center) {
                if (self.baseImageLayer.baseImageType == 'tile')
                    return [ center[0], -center[1] ];
                else
                    return center;
            }
            return [0, 0];
        },

        /**
         * Method to zoom the map to given steps while animating the view for given duration
         * @param zoomSteps {decimal} +ve or -ve decimal to zoom in or zoom out respectively, default 1
         * @param animationDuration {decimal} duration in ms to animate the zooming for, default 250
         * @private returns the changed zoom level
         */
        _animateZoom: function (zoomSteps, animationDuration) {
            var self = this,
                currentResolution = self._mapView.getResolution(),
                delta = zoomSteps || 1,
                duration = animationDuration || 250;

            if (!isNaN(currentResolution)) {
                self._map.beforeRender(ol.animation.zoom({
                    resolution: currentResolution,
                    duration: duration,
                    easing: ol.easing.easeOut
                }));

                var newResolution = self._mapView.constrainResolution(currentResolution, delta);
                self._mapView.setResolution(newResolution);
            }

            return self._mapView.getZoom();
        },

        _styleMapDiv: function() {
            var self = this;
            domStyle.set(self.mapDiv, "width", self.canvasWidth);
            domStyle.set(self.mapDiv, "height", self.canvasHeight);
            domStyle.set(self.mapDiv, "margin", '0 auto');
        },

        _initializeOLMap: function() {
            var self = this;

            if(self._map && self._map.dispose) {
                self._map.dispose();
            }

            // Instantiating ol map
            self._map = new ol.Map({
                controls: self._defaultMapControls,
                layers: self._olLayers,
                target: self.mapDiv
            });
        },

        _buildView: function(options) {
            if(self._mapView && self._mapView.dispose) {
                self._mapView.dispose();
            }

            self._mapView = new ol.View(options);
            return self._mapView;
        },

        _baseLayerUpdated: function() {
            var self = this;

            if(self._baseOLLayer) {
                self._map.removeLayer(self._baseOLLayer);
            }

            if(self.baseImageLayer && self.baseImageLayer.baseImageMeta) {

                self._baseImageExtent = [0, 0, self.baseImageLayer.baseImageMeta.width, self.baseImageLayer.baseImageMeta.height];
                self.imageSize = [self.baseImageLayer.baseImageMeta.width, self.baseImageLayer.baseImageMeta.height];

                if (!self._baseOLLayerProjection) {
                    self._baseOLLayerProjection = new ol.proj.Projection({
                        code: 'pixels',
                        units: 'pixels',
                        extent: self._baseImageExtent
                    });
                } else {
                    self._baseOLLayerProjection.setExtent(self._baseImageExtent);
                }

                if (self.baseImageLayer.baseImageType == 'tile') {
                    self._baseOLLayer = new ol.layer.Tile({
                        source: new ol.source.Zoomify({
                            url: self.baseImageLayer.baseImageUrl,
                            size: self.imageSize,
                            crossOrigin: 'anonymous'
                        })
                    })
                } else {
                    self._baseOLLayer = new ol.layer.Image({
                        source: new ol.source.ImageStatic({
                            url: self.baseImageLayer.baseImageUrl,
                            imageSize: self.imageSize,
                            projection: self._baseOLLayerProjection,
                            imageExtent: self._baseImageExtent
                        })
                    });
                }

                // creating view
                var viewProperties = {
                    projection: self._baseOLLayerProjection,
                    center: self._getCenterForLayerType(),
                    minZoom: self.baseImageLayer.baseImageMeta.minZoom,
                    maxZoom: self.baseImageLayer.baseImageMeta.maxZoom,
                    zoom: self.baseImageLayer.baseImageMeta.zoom,
                    zoomFactor: self.zoomFactor
                };
                self._mapView = self._buildView(viewProperties);

                self._map.addLayer(self._baseOLLayer);
                self._map.setView(self._mapView);
            }
        },
        isViewerReady: function() {
            //summary:
            // ensures if map and mapView are in initialized state
            return this._map instanceof ol.Map && this._mapView instanceof ol.View;
        },
        zoomToPercent: function (/*number*/percentZoom) {
            //summary:
            //  zooms the map/canvas to the percentage zoom of image
            //  a value of 100 zooms the canvas so that the image renders at its 100% (actual pixel size)
            if(percentZoom < this.zoomMinPercent || percentZoom > this.zoomMaxPercent){
                return;
            }else{
                if(this.isViewerReady()) {
                    var percentValue = parseFloat(percentZoom) || 100,
                        resolutionValueForPercent = 100 / percentValue;

                    this._mapView.setResolution(resolutionValueForPercent);

                    // Forcing the map to redraw for the changed state
                    this._map.renderSync();
                } else {
                    console && console.warn && console.warn("Viewer map or mapView is not initialized.");
                }
            }
        },
        zoomIn: function() {
            var self = this, currentZoom;
            return self._animateZoom(1, 250);
        },
        zoomOut: function() {
            var self = this;
            return self._animateZoom(-1, 250);
        },
        setOpacity: function(/*number*/opacity) {
            //summary:
            //  sets opacity on viewer from 0 to 100.
            var normalizedOpacity = opacity/100;
            domStyle.set(this.domNode, 'opacity', normalizedOpacity);
        },
        updateBaseImageLayer: function(layerObject) {
            var self = this;

            self.set('baseImageLayer', layerObject);
            self._baseLayerUpdated();
        },
        constructor: function(args){
            var self = this, parentPos;
            lang.mixin(self, args);
            self.baseImageLayer = {};
            self._olLayers = [];
            self._defaultMapControls = [];
            this._localizeItems = [];
            //////////////////////////
            //  containerDiv should have a height set on it.  If not it should be set to fill the height of its
            //  parent node.
            /////////////////////////
            if(domStyle.get(this.containerDiv, 'height') === 0){
                parentPos = domStyle.get(this.containerDiv.parentNode, 'position');
                if(parentPos !== 'absolute'){
                    domStyle.set(this.containerDiv.parentNode, 'position', 'relative');
                }
                domStyle.set(this.containerDiv, {
                    position: 'absolute',
                    top:'0px',
                    bottom: '0px',
                    left: '0px',
                    right: '0px'
                });
            }
        },

        postMixInProperties: function() {
            var self = this;

            this.inherited(arguments);
        },

        buildRendering: function () {
            var self = this;

            self.inherited(arguments);

            ///////////////////////
            //set height on domNode
            ///////////////////////
            domStyle.set(this.domNode, 'height', domStyle.get(this.containerDiv, 'height') + 'px');

            self.mapDiv = domConstruct.create('div');
            self._styleMapDiv();

            self.containerDiv.appendChild(self.domNode);
            self.domNode.appendChild(self.mapDiv);

            self._initializeOLMap();
        },

        postCreate: function() {
            var self = this;
            this.inherited(arguments);

            this._basImageLayerWatch = self.watch("baseImageLayer", self._baseLayerUpdated);

            this._onWindowResizeHandler = on(window, 'resize', function () {
                self.resize();
            });

            when(this.onLoadDeferred, function () {
                if(self.localizationProvider){
                    self.localize(self.localizationProvider, self._localizeItems);
                }
            });
        },
        resize: function() {
            var self = this;
            this.inherited(arguments);

            domStyle.set(this.domNode, 'height', domStyle.get(this.containerDiv, 'height') + 'px');

            if(self._map) {
                self._map.updateSize();
            }
        },
        startup: function() {
            this.inherited(arguments);
        },
        destroy: function () {
            this._onWindowResizeHandler && this._onWindowResizeHandler.remove();
            this._basImageLayerWatch && this._basImageLayerWatch.unwatch();
            this.inherited(arguments);
        }
    });
});