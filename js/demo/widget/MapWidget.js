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
        drawInteraction: null,
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

                    if(this.currentUndoStep == 0) {
                        this.currentUndoStep = 1;
                    }
                }
            }

            this.redoEdit = function() {
                if(this.currentUndoStep > -1 && this.currentUndoStep < this.undoSteps) {
                    this.currentUndoStep += 1;
                    var undoFeature = this.geometryHistoryStore.get(this.currentUndoStep);
                    undoFeature.feature.setGeometry(undoFeature.geometry);

                    if(this.currentUndoStep == this.undoSteps) {
                        this.currentUndoStep -= 1;
                    }
                }
            }

            /**
             * Attaches history functionality to layer by initializing memory store
             * The expected format for history stack record is as:
             * {
             *      id:     (The step identifier, int),
             *      fid: (The feature identifier, must be unique across layers, can be acquired form goog.getUid, int),
             *      feature: (ref to the feature created, deleted or modified, ol.Feature)
             *      from:   {   geometry: (feature.getGeometry().clone(), ol.geom.Geometry),
             *                  style:  (style consisting of fill, stroke, opacity etc., ol.style.Style),
             *                  properties: (literal properties, JSON object) }
             *              | null for CREATE command
             *              | ref to previous record.to with same fid if present for MODIFY command.
             *
             *      to:   {   geometry: (feature.getGeometry().clone(), ol.geom.Geometry),
             *                  style:  (style consisting of fill, stroke, opacity etc., ol.style.Style),
             *                  properties: (literal properties, JSON object) }
             *              | null for DELETE command
             * }
             * @param layer ol.layer.Vector
             */
            this.initializeLayerForHistory = function(layer) {
                layer.commandsHistoryStore = new Memory();
                layer.undoStep = 0;

                layer.afterFeatureCreate = function(feature) {
                    this.insertCommand("CREATE", feature.getId(), null, {
                        geometry: feature.getGeometry().clone(),
                        style: feature.getStyle().clone(),
                        properties: feature.properties // @TODO: implement clone
                    });
                }


                /**
                 * Called by interaction handlers passing the feature that is going to be modified
                 * @param feature ol.Feature that is modified
                 */
                layer.beforeFeatureModified = function(feature) {
                    // Retrieving a from reference
                    var fromRef = null;
                    var queryResults = this.commandsHistoryStore.query(function(item){
                        return item.id <= this.undoStep && item.fid == feature.getId() && item.to != null;
                    }, {
                        count: 1,
                        sort: [{attribute: "id", descending: true}]
                    });

                    if(queryResults.length)
                        fromRef = queryResults[0].to;

                    this.insertCommand("MODIFY", feature.getId(), fromRef, {
                        geometry: feature.getGeometry().clone(),
                        style: feature.getStyle().clone(),
                        properties: feature.properties // @TODO: implement clone
                    });
                }


                /**
                 * Called by interaction handlers passing the feature that has been modified
                 * @param feature ol.Feature that is modified
                 */
                layer.featureModified = function(feature) {
                    // Retrieving a from reference
                    var fromRef = null;
                    var queryResults = this.commandsHistoryStore.query(function(item){
                        return item.id <= this.undoStep && item.fid == feature.getId() && item.to != null;
                    }, {
                        count: 1,
                        sort: [{attribute: "id", descending: true}]
                    });

                    if(queryResults.length)
                        fromRef = queryResults[0].to;

                    this.insertCommand("MODIFY", feature.getId(), fromRef, {
                        geometry: feature.getGeometry().clone(),
                        style: feature.getStyle().clone(),
                        properties: feature.properties // @TODO: implement clone
                    });
                }

                /**
                 * Inserts a new command, the drawing events may call this function to keep track of the changes
                 * @param type possible values are "CREATE" | "MODIFY" | "REMOVE"
                 * @param fid the fid of feature added, removed or modified
                 * @param from feature definition object before change
                 * @param to feature definition object after change
                 */
                layer.insertCommand = function(type, fid, from, to) {
                    // Removing records from stack having id > layer.undoStep
                    var queryObject = {test: function(record){return record.id > this.undoStep}};
                    var invalidRecords = this.commandsHistoryStore.queryEngine(queryObject);
                    if(invalidRecords != undefined) {
                        invalidRecords.forEach(function(record){
                            this.commandsHistoryStore.remove(record.id);
                        }, this);
                    }

                }
            }

            /**
             * Ensures initial geometry is present in history store
             * @param feature the feature to track history
             */
            /*this.trackGeometryHistory = function(feature) {
                if(this.geometryHistoryStore.get(feature.fid) == undefined) {
                    this.geometryHistoryStore.add({id: feature.fid, action: "initial"})
                }
            }*/

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

            this.activateDrawing = function() {
                var featureOverlay = new ol.FeatureOverlay({
                    style: new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: 'rgba(255, 200, 150, 0.2)'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#ccff33',
                            width: 0.5
                        }),
                        image: new ol.style.Icon({
                            src: require.toUrl('demo/widget/images/polygon-draw-icon.png'),
                            width: 18,
                            height: 18,
                            opacity: 0.8,
                            rotation: Math.PI,
                            xOffset: -3,
                            yOffset: -2
                        })

                    })
                });
                featureOverlay.setMap(this.map);

                var draw = new ol.interaction.Draw({
                        features: featureOverlay.getFeatures(),
                        type: 'Point'
                    });
                    this.map.addInteraction(draw);
            }

            this.modifyInteraction = new ol.interaction.ModifyWithEvents({
                features: this.selectInteraction.getFeatures(),
                style: this.overlayStyle
            });

            this.modifyInteraction.on("modifystart",
                function(evt){
                    var feature = evt.featureCollection.getArray()[0];
                    var queryResult = this.geometryHistoryStore.query({fid: feature.fid});
                    if(!queryResult.total) {
                        this.geometryHistoryStore.add({id: ++this.undoSteps, fid: feature.fid, feature: feature, geometry: feature.getGeometry().clone()});
                    }
                }, this);

            this.modifyInteraction.on("modifyend",
                function(evt){
                    var feature = evt.featureCollection.getArray()[0];
                    this.geometryHistoryStore.add({id: ++this.undoSteps, fid: feature.fid, feature: feature, geometry: feature.getGeometry().clone()});
                    this.currentUndoStep = this.undoSteps - 1;
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

            widgetDebug = this; // For dev purposes only
        },

        startup: function() {
            this.inherited(arguments);
        }
    });
});