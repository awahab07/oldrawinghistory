define([
    "dojo/_base/declare",
    "dojo/_base/fx",
    "dojo/_base/lang",
    "dojo/_base/array",
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
], function(declare, baseFx, lang, arrayUtil, on, domStyle, aspect, registry,  Toolbar, Button,  Memory, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, template){
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
        activeLayer: null,
        layerStore: null,
        olLayers: [],

        _featureGeometryChanged: null,


        postMixInProperties: function() {
            this.inherited(arguments);

            this.processLayerStore = function(layerStore) {
                this.layerStore = layerStore;

                // Building OL Layers
                var storeLayers = layerStore.query({});
                storeLayers.forEach(lang.hitch(this, this.buildOLLayerFromStoreLayer));
                storeLayers.observe(this.layerStoreChanged, true);

                this.activeLayer = this.olLayers[0];
            }

            this.buildOLLayerFromStoreLayer = function(layer) {
                var olLayer = this.layerStore.getOLLayer(layer);
                this.map.addLayer(olLayer);

                olLayer.map = this.map;
                olLayer.selectInteraction = this.selectInteraction;
                this.initializeLayerForCommandHistory(olLayer);

                this.olLayers.push(olLayer);
            }

            this.layerStoreChanged = function(object, removedFrom, insertedInto) {
                var olLayer = this.layerStore.getOLLayerReference(object);
                olLayer.setVisible(object.visible);
            }

            this.layerRowClicked = function(rowIndex) {
                this.activeLayer = this.layerStore.getOLLayerReference(this.layerStore.data[rowIndex]);
            }

            /**
             * Attaches history functionality to layer by initializing memory store
             * The expected format for history stack record is as:
             * {
             *      id:     (The step identifier, int),
             *      fid: (The feature identifier, must be unique across layers, can be acquired form goog.getUid, int),
             *      command: (The command type CREATE|DELETE|MODIFY, string),
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
            this.initializeLayerForCommandHistory = function(layer) {
                googAssertInstanceOf(layer.map, ol.Map, "Layer's map not valid");
                googAssertInstanceOf(layer.selectInteraction, ol.interaction.Select, "Layer's Select Interaction not valid");

                layer.undoStep = 0;
                layer.commandsHistoryStore = new Memory();
                layer.commandsHistoryStore.removeInvalidCommandRecords = function() {
                    var removeIfInvalid = function(item) {
                        if(item.id > layer.undoStep) {
                            layer.commandsHistoryStore.remove(item.id);
                        }
                    }
                    this.query({}).forEach(removeIfInvalid);
                }

                /**
                 * Will help to retrieve Unique feature ids recognized by the application
                 * @param feature ol.Feature that is modified
                 */
                layer.getFeatureId_ = function(feature) {
                    googGetFeatureId(feature);
                    
                    if(!feature.getId()) {
                        console.error("A valid feature.getId() in not present.");
                    }
                    
                    return feature.getId();
                }

                /**
                 * Returns the layers source ol.source.Vector
                 */
                layer.getSource_ = function() {
                    return this.getSource();
                }

                /**
                 * Grabs the features desired current state and returns the object meant to be assigned to
                 * "from" or "to" properties of geometryHistoryStore
                 * Will take care of necessary cloning of objects
                 * @param feature ol.Feature that is modified
                 */
                layer.getFeatureState_ = function(feature) {
                    return {
                        geometry: feature.getGeometry().clone(),
                        fid: feature.fid,
                        //style: feature.getStyle().clone(),
                        properties: feature.properties // @TODO: implement clone
                    }    
                }
                
                /**
                 * Inserts a new command, the drawing events may call this function to keep track of the changes
                 * @param type possible values are "CREATE" | "MODIFY" | "REMOVE"
                 * @param fid the fid of feature added, removed or modified
                 * @param from feature definition object before change
                 * @param to feature definition object after change
                 */
                layer.insertCommand_ = function(command, fid, feature, from, to) {
                    // Removing records from stack having id > layer.undoStep
                    this.commandsHistoryStore.removeInvalidCommandRecords();

                    this.commandsHistoryStore.add({id: ++this.undoStep, fid:fid, command:command, feature:feature, from:from, to:to});
                }                

                /**
                 * Will take care that the features pre operation (DELETE or MODIFY) state is tracked
                 * @param type string = "DELETE"|"MODIFY"
                 * @param feature ol.Feature that is modified
                 */
                 layer.ensureStateTrackedBeforeOperation_ = function(feature) {
                    // Retrieving a from reference
                    var fromRef = null;
                    var queryResults = this.commandsHistoryStore.query(function(item){
                        return item.id <= this.undoStep && item.fid == this.getFeatureId_(feature) && item.to != null;
                    }, {
                        count: 1,
                        sort: [{attribute: "id", descending: true}]
                    });

                    if(queryResults.length)
                        fromRef = queryResults[0].to;

                    // If "from" is not retrieved, it will indicate that the feature is retrieved form the source
                    // So insert a MODIFY command with "from" holding the current state of feature whereas "to" with
                    // the string "PENDING" informing the following modified event to fill in
                    if(!fromRef) {
                        fromRef = this.getFeatureState_(feature);
                    }

                    return fromRef;
                 }

                /**
                 * Will retrieve the record tracking the state of feature before operations DELETE|MODIFY
                 * @param feature ol.Feature that is modified
                 */
                layer.retrieveTrackedStateRecord_ = function(command, feature) {
                    // Retrieving a latest record with same fid and to="PENDING"
                    var toRecord = null;
                    var queryResults = this.commandsHistoryStore.query(function(item){
                        return item.fid == feature.getId() && item.to === "PENDING" && item.command == command;
                    }, {
                        count: 1,
                        sort: [{attribute: "id", descending: true}]
                    });

                    if(queryResults.length) {
                        toRecord = queryResults[0];
                    }

                    return toRecord;
                }

                layer.unCreateFeature_ = function(commandRecord) {
                    this.getSource_().removeFeature(commandRecord.feature);
                }

                layer.reCreateFeature_ = function(commandRecord) {
                    this.getSource_().addFeature(commandRecord.feature);
                }

                layer.unModifyFeature_ = function(commandRecord) {
                    commandRecord.feature.setGeometry(commandRecord.from.geometry);
                }

                layer.reModifyFeature_ = function(commandRecord) {
                    commandRecord.feature.setGeometry(commandRecord.to.geometry);
                }

                layer.unDeleteFeature_ = function(commandRecord) {
                    var feature = new ol.Feature({
                        fid: commandRecord.fid,
                        geometry: commandRecord.from.geometry,
                        style: commandRecord.from.style,
                        properties: commandRecord.from.properties
                    });
                    commandRecord.feature = feature;
                    this.getSource_().addFeature(commandRecord.feature);
                }

                layer.reDeleteFeature_ = function(commandRecord) {
                    this.getSource_().removeFeature(commandRecord.feature);
                }

                /**
                 * Undo a single command
                 */
                layer.undo = function() {
                    if(this.undoStep) {
                        var commandRecord = this.commandsHistoryStore.get(this.undoStep);
                        switch(commandRecord.command) {
                            case "CREATE":
                                this.unCreateFeature_(commandRecord);
                                break;
                            case "MODIFY":
                                this.unModifyFeature_(commandRecord);
                                break;
                            case "DELETE":
                                this.unDeleteFeature_(commandRecord);
                                break;
                        }
                        this.undoStep--;
                    }
                }

                /**
                 * Redo a single command
                 */
                layer.redo = function() {
                    if(this.undoStep < this.commandsHistoryStore.data.length) {
                        this.undoStep++;
                        var commandRecord = this.commandsHistoryStore.get(this.undoStep);
                        switch(commandRecord.command) {
                            case "CREATE":
                                this.reCreateFeature_(commandRecord);
                                break;
                            case "MODIFY":
                                this.reModifyFeature_(commandRecord);
                                break;
                            case "DELETE":
                                this.reDeleteFeature_(commandRecord);
                                break;
                        }
                    }
                }

                /**
                 * Delete featues selected by ol.interaction.Select
                 */
                layer.deleteSelectedFeatures = function() {
                    this.selectInteraction.getFeatures().forEach(function(feature){
                        layer.beforeFeatureDeleted(feature);
                        layer.getSource_().removeFeature(feature);
                        layer.selectInteraction.getFeatures().remove(feature);
                        layer.featureDeleted(feature);
                    });
                }

                /**
                 * Called by interaction handlers passing the feature that has been created
                 * @param feature ol.Feature that is created
                 */
                layer.featureCreated = function(feature) {
                    this.insertCommand_("CREATE", this.getFeatureId_(feature), feature, null, this.getFeatureState_(feature));
                }

                /**
                 * Called by interaction handlers passing the feature that is going to be deleted
                 * @param feature ol.Feature that is modified
                 */
                layer.beforeFeatureDeleted = function(feature) {
                    var fromRef = this.ensureStateTrackedBeforeOperation_(feature);
                    this.insertCommand_("DELETE", this.getFeatureId_(feature), feature, fromRef, "PENDING");
                }

                /**
                 * Called by interaction handlers passing the feature that is going to be modified
                 * @param feature ol.Feature that is modified
                 */
                layer.beforeFeatureModified = function(feature) {
                    var fromRef = this.ensureStateTrackedBeforeOperation_(feature);
                    this.insertCommand_("MODIFY", this.getFeatureId_(feature), feature, fromRef, "PENDING");
                }

                /**
                 * Called by interaction handlers passing the feature that has been deleted
                 * @param feature ol.Feature that is modified
                 */
                layer.featureDeleted = function(feature) {
                    var trackedRecord = this.retrieveTrackedStateRecord_("DELETE", feature);
                    if(trackedRecord) {
                        trackedRecord.to = null; // Feature has been deleted
                        this.commandsHistoryStore.put(trackedRecord, {overwrite: true});
                    } else {
                        console.error("Record of fid: " + feature.getId() + " couldn't be found in stack with \"PENDING\" status.");
                    }
                }

                /**
                 * Called by interaction handlers passing the feature that has been modified
                 * @param feature ol.Feature that is modified
                 */
                layer.featureModified = function(feature) {
                    var trackedRecord = this.retrieveTrackedStateRecord_("MODIFY", feature);
                    if(trackedRecord) {
                        trackedRecord.to = this.getFeatureState_(feature);
                        this.commandsHistoryStore.put(trackedRecord, {overwrite: true});
                    } else {
                        console.error("Record of fid: " + feature.getId() + " couldn't be found in stack with \"PENDING\" status.");
                    }
                }
            }

            this.featureStyleFunction = (function() {
                return function(feature, resolution) {
                    return new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: feature.style.stroke.color,
                            width: feature.style.stroke.width
                        }),
                        fill: new ol.style.Fill({
                            color: feature.style.fill.color
                        })
                    });
                };
            })();

            this.undo = function() {
                this.activeLayer.undo();
            }

            this.redo = function() {
                this.activeLayer.redo();
            }

            this.deleteSelectedFeatures = function() {
                this.activeLayer.deleteSelectedFeatures();
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

            this.selectInteraction = new ol.interaction.SelectWithMove({
                style: this.overlayStyle
            });

            
            this.activateArrowDrawing = function() {
                var featureOverlay = new ol.FeatureOverlay({
                    style: new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: 'rgba(255, 200, 150, 0.2)'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#eeff33',
                            width: 1
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
                //featureOverlay.setMap(this.map);

                var draw = new ol.interaction.DrawWithShapes({
                    features: this.activeLayer.getSource_().getFeatures(),
                    type: 'Polygon',
                    shapeType: 'Arrow'
                });
                this.map.addInteraction(draw);

                draw.on("drawend",
                    function(evt){
                        this.getSource_().addFeature(evt.feature);
                        //this.map.removeInteraction(draw);
                        //featureOverlay.removeFeature(evt.feature);
                        this.featureCreated(evt.feature);
                    }, this.activeLayer);
            }

            this.exportCanvas = function(encoding) {
                this.map.once('postcompose', function(event) {
                    var canvas = event.context.canvas;
                    this.exportLink.href = canvas.toDataURL(encoding || 'image/png');
                    this.exportLink.click();
                }, this);
                this.map.renderSync();
            }

            this.manipulateInteraction = new ol.interaction.Manipulate({
                features: this.selectInteraction.getFeatures(),
                style: this.overlayStyle
            });


            this.manipulateInteraction.on("manipulatestart",
                function(evt){
                    var feature = evt.featureCollection.getArray()[0];

                    this.activeLayer.beforeFeatureModified(feature);
                }, this);

            this.manipulateInteraction.on("manipulateend",
                function(evt){
                    var feature = evt.featureCollection.getArray()[0];
                    this.activeLayer.featureModified(feature);
                }, this);


            this.selectInteraction.on("movestart",
                function(evt){
                    console.log("movestart");
                    var feature = evt.featureCollection.getArray()[0];

                    this.activeLayer.beforeFeatureModified(feature);
                }, this);

            this.selectInteraction.on("moveend",
                function(evt){
                    var feature = evt.featureCollection.getArray()[0];
                    this.activeLayer.featureModified(feature);
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
                interactions: ol.interaction.defaults().extend([this.manipulateInteraction]),
                layers: [this.baseImageLayer],
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