var widgetDebug = null; // For Debugging
define([
    "dojo/_base/declare",
    "dojo/_base/fx",
    "dojo/_base/lang",
    "dojo/on",
    "dojo/dom-style",
    "dojo/aspect",
    "dijit/registry",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dojo/store/Memory",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!./templates/MapWidget.html"
], function(declare, baseFx, lang, on, domStyle, aspect, registry,  Toolbar, Button,  Memory, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, template){
    return declare([_WidgetBase, _TemplatedMixin], {
 
        // Our template - important!
        templateString: template,
 
        // A class to be applied to the root node in our template
        baseClass: "openlayersMapWidget",

        width: '90%',
        height: '90%',

        imageWidth: 200,
        imageHeight: 200,
        imageUrl: require.toUrl('demo/widget/images/no-image.png'),
        pixelProjection: null,
        baseImageLayer: null,
        mapView: null,
        minZoom:0,
        maxZoom:28,
        zoomFactor:2,
        zoom: 1,
        map: null,
        overlayStyle: null,
        selectInteraction: null,
        modifyInteraction: null,
        geometryHistoryStore: null,
        testVectorLayer: null,

        _featureGeometryChanged: null,


        postMixInProperties: function() {
            this.inherited(arguments);

            // Setting up store for feature geometry changes i.e. for Undo/Redo functionality
            this.geometryHistoryStore = new Memory();
            this.undoSteps = 0;
            this.currentUndoStep = -1;

            this.undoEdit = function() {
                console.log("undoSteps", this.undoSteps, "currentUndoStep", this.currentUndoStep, "historyLength", this.geometryHistoryStore.data.length);
                if(this.undoSteps) {
                    if(this.currentUndoStep == -1)
                        this.currentUndoStep = this.undoSteps;

                    if(this.currentUndoStep) {
                        var undoFeature = this.geometryHistoryStore.get(this.currentUndoStep);
                        undoFeature.feature.setGeometry(undoFeature.geometry);
                        this.currentUndoStep -= 1;
                    }

                }
            }

            this.redoEdit = function() {
                if(this.currentUndoStep > -1 && this.currentUndoStep < this.undoSteps) {
                    this.currentUndoStep += 1;
                    var undoFeature = this.geometryHistoryStore.get(this.currentUndoStep);
                    undoFeature.feature.setGeometry(undoFeature.geometry);
                }
            }

            // Style function, source and vector layer
            var styleFunction = (function() {
                /* jshint -W069 */
                var styles = {};
                var image = new ol.style.Circle({
                    radius: 5,
                    fill: null,
                    stroke: new ol.style.Stroke({color: 'orange', width: 2})
                });
                styles['Point'] = [new ol.style.Style({image: image})];
                styles['Polygon'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'blue',
                        width: 3
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(0, 0, 255, 0.1)'
                    })
                })];
                styles['MultiLinestring'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'green',
                        width: 3
                    })
                })];
                styles['MultiPolygon'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'yellow',
                        width: 1
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 0, 0.1)'
                    })
                })];
                styles['default'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'red',
                        width: 3
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 0, 0, 0.1)'
                    }),
                    image: image
                })];
                return function(feature, resolution) {
                    return styles[feature.getGeometry().getType()] || styles['default'];
                };
                /* jshint +W069 */
            })();

            var source = new ol.source.GeoJSON(
                /** @type {olx.source.GeoJSONOptions} */ ({
                    object: {
                        'type': 'FeatureCollection',
                        'crs': {
                            'type': 'name',
                            'properties': {
                                'name': 'EPSG:3857'
                            }
                        },
                        'features': [
                            {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'Point',
                                    'coordinates': [700, 300]
                                }
                            },
                            {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'MultiPoint',
                                    'coordinates': [[1000, 555], [1200, 555]]
                                }
                            },
                            {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'LineString',
                                    'coordinates': [[400, 100], [800, 200], [900, 200]]
                                }
                            }
                        ]
                    }
                }));

            // Vector Layer
            this.testVectorLayer = new ol.layer.Vector({
                source: source,
                style: styleFunction
            });

            this._featureGeometryChanged = function(event) {
                var currentTarget = event.currentTarget;
                var target = event.target;
                var debugIt = true;
            }

            // Map OverlayStyle
            this.overlayStyle = (function() {
                /* jshint -W069 */
                var styles = {};
                styles['Polygon'] = [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.5]
                        })
                    }),
                    new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: [255, 255, 255, 1],
                            width: 5
                        })
                    }),
                    new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: [0, 153, 255, 1],
                            width: 3
                        })
                    })
                ];
                styles['MultiPolygon'] = styles['Polygon'];

                styles['LineString'] = [
                    new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: [255, 255, 255, 1],
                            width: 5
                        })
                    }),
                    new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: [0, 153, 255, 1],
                            width: 3
                        })
                    })
                ];
                styles['MultiLineString'] = styles['LineString'];

                styles['Point'] = [
                    new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 7,
                            fill: new ol.style.Fill({
                                color: [0, 153, 255, 1]
                            }),
                            stroke: new ol.style.Stroke({
                                color: [255, 255, 255, 0.75],
                                width: 1.5
                            })
                        }),
                        zIndex: 100000
                    })
                ];
                styles['MultiPoint'] = styles['Point'];

                styles['GeometryCollection'] = styles['Polygon'].concat(styles['Point']);

                return function(feature, resolution) {
                    return styles[feature.getGeometry().getType()];
                };
                /* jshint +W069 */
            })();

            this.selectInteraction = new ol.interaction.Select({
                style: this.overlayStyle
            });

            this.modifyInteraction = new ol.interaction.ModifyWithEvents({
                features: this.selectInteraction.getFeatures(),
                style: this.overlayStyle
            });

            this.modifyInteraction.on("modifystart",
                function(evt){
                    var feature = evt.featureCollection.getArray()[0];
                    this.geometryHistoryStore.add({id: ++this.undoSteps, fid: feature.fid, feature: feature, geometry: feature.getGeometry().clone()});
                    this.currentUndoStep = this.undoSteps;
                }, this);
            this.modifyInteraction.on("modifyend",
                function(evt){
                    var feature = evt.featureCollection.getArray()[0];
                    this.geometryHistoryStore.add({id: ++this.undoSteps, fid: feature.fid, feature: feature, geometry: feature.getGeometry().clone()});
                    this.currentUndoStep = this.undoSteps;
                }, this);



            // Setting up widget projection
            this.pixelProjection = new ol.proj.Projection({
                code: 'pixel',
                units: 'pixels',
                extent: [0, 0, this.imageWidth, this.imageHeight] // width and height of used image
            });

            // Setting up base image layer
            this.baseImageLayer = new ol.layer.Image({
                source: new ol.source.ImageStatic({
                    url: this.imageUrl,
                    imageSize: [this.imageWidth, this.imageHeight],
                    projection: this.pixelProjection,
                    imageExtent: this.pixelProjection.getExtent()
                })
            });

            // Setting up map view based on pixel project and image size
            this.mapView = new ol.View({
                projection: this.pixelProjection,
                minZoom: this.minZoom,
                maxZoom: this.maxZoom,
                center: ol.extent.getCenter(this.pixelProjection.getExtent()),
                zoom: this.zoom
            })
        },

        postCreate: function() {

            this.inherited(arguments);

            domStyle.set(this.mapDiv, "width", this.width);
            domStyle.set(this.mapDiv, "height", this.height);
            domStyle.set(this.mapDiv, "margin", '0 auto');

            // Instantiating ol map
            this.map = new ol.Map({
                interactions: ol.interaction.defaults().extend([this.selectInteraction, this.modifyInteraction]),
                layers: [this.baseImageLayer, this.testVectorLayer],
                target: this.mapDiv,
                view: this.mapView
            });

            //this.map.on("drawend", function(event){console.log(event.target);});
            this.modifyInteraction.on("POINTERDRAG", function(event){console.log("modify", event);});

            // Features geometry change event
            this.testVectorLayer.getSource().forEachFeature(function(feature) {
                feature.on("DRAGEND", function(event){
                    var currentTarget = event.currentTarget;
                    var target = event.target;
                    console.log("currentTarget", currentTarget.getCoordinates());
                    console.log("target", target.getCoordinates());
                    var debugIt = true;
                }, this);
            });

            widgetDebug = this; // For dev purposes only
        },

        startup: function() {
            this.inherited(arguments);
        }
    });
});