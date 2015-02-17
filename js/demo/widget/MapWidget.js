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

        mapResolution: 1,
        sliderResolution: 1,
        minResolution: 0.1,
        maxResolution: 10,
        resolutionStep: 0.25,

        marginTop: 0,
        marginRight: 0,
        marginBottom: 0,
        marginLeft: 0,

        shouldGrayOut: true,
        shouldConstrainPanning: true,

        imageExtent: null,

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

        _fixedMarkerCount: 0,
        _scalableMarkerCount: 0,

        olResolution: 1,

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
                this.manipulateInteraction.setLayerToManipulateOn(this.activeLayer);
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
                this.drawInteraction.activateShapeDrawingOnLayer("Arrow", this.activeLayer);
            }

            this.activateLineArrowDrawing = function() {
                this.drawInteraction.activateShapeDrawingOnLayer("LineArrow", this.activeLayer);
            }

            this.activatePolygonDrawing = function() {
                this.drawInteraction.activateShapeDrawingOnLayer("Polygon", this.activeLayer);
            }

            this.zoomToDocumentExtent = function() {
                var map = this.map,
                    documentExtent = this.documentExtent,
                    mapSize = map.getSize(),
                    mapSizeWithPadding = [mapSize[0] * 0.98, mapSize[1] * 0.98],
                    fitViewportResolution = map.getView().getResolutionForExtent(documentExtent, mapSizeWithPadding),
                    currentResolution = map.getView().getResolution(),
                    perResolutionChange = Math.abs( (fitViewportResolution - currentResolution) / currentResolution),
                    fitViewportCenter = ol.extent.getCenter(documentExtent),
                    currentCenter = map.getView().getCenter(),
                    perPositionChange = Math.abs((((fitViewportCenter[0] - currentCenter[0]) / currentCenter[0]) + ((fitViewportCenter[1] - currentCenter[1]) / currentCenter[1])) / 2);

                // Applying pan animation
                map.beforeRender(ol.animation.pan({
                    source: currentCenter,
                    duration: perResolutionChange >= perPositionChange ? 100 : 200,
                    easing: ol.easing.linear
                }));

                // Applying zoom animation
                map.beforeRender(ol.animation.zoom({
                    resolution: currentResolution,
                    duration: perResolutionChange >= perPositionChange ? 200 : 100,
                    easing: ol.easing.easeOut
                }));

                map.getView().setResolution(fitViewportResolution);
                map.getView().setCenter(fitViewportCenter);
            }

            this.paperWidthChanged = function(width) {
                if(!isNaN(width) && width > 0 && width < 20000)
                    this.baseImageLayer.documentExtent[2] = width;
            }

            this.paperHeightChanged = function(height) {
                if(!isNaN(height) && height > 0 && height < 20000)
                    this.baseImageLayer.documentExtent[3] = height;
            }

            // Markers
            this.placeFixedMarker = function() {
                var markerNumber = '' + ++this._fixedMarkerCount,
                    iconFeature = new ol.Feature({
                        geometry: new ol.geom.Point(this.mapView.getCenter())
                    });

                var iconStyle = new ol.style.Style({
                    image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
                        anchor: [16, 10],
                        anchorXUnits: 'pixels',
                        anchorYUnits: 'pixels',
                        opacity: 0.9,
                        src: 'img/red-marker.png'
                    })),
                    text: new ol.style.Text({
                        font: '42px Calibri,sans-serif',
                        text: markerNumber,
                        fill: new ol.style.Fill({
                            color: '#000'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#fff',
                            width: 2
                        })
                    })
                });

                iconFeature.setStyle(iconStyle);

                this.activeLayer.getSource().addFeature(iconFeature);
            }

            this.placeScalableMarker = function() {
                var center = this.mapView.getCenter(),
                    x = center[0],
                    y = center[1],
                    markerRadius = 20 * this.mapView.getResolution(),
                    step = markerRadius * 0.2,
                    markerPolygonCoords = [[
                        [x, y-markerRadius],
                        [x-step*3, y+markerRadius-step*3], [x-step*2, y+markerRadius-step*2], [x-step, y+markerRadius-step],
                        [x, y+markerRadius],
                        [x+step, y+markerRadius-step],[x+step*2, y+markerRadius-step*2], [x+step*3, y+markerRadius-step*3],
                        [x, y-markerRadius]
                    ]],
                    markerPolygon = new ol.geom.Polygon(markerPolygonCoords),
                    markerNumber = '' + ++this._scalableMarkerCount,
                    markerFeature = new ol.Feature({
                        geometry: markerPolygon,
                        markerNumber: markerNumber
                    });

                var fixedMarkerStyle = (function() {
                    var fill = new ol.style.Fill({
                        color: 'rgba(0, 255, 0, 0.6)'
                    });
                    var stroke = new ol.style.Stroke({
                        color: 'black',
                        width: 2
                    });
                    var textStroke = new ol.style.Stroke({
                        color: '#fff',
                        width: 1
                    });
                    var textFill = new ol.style.Fill({
                        color: '#000'
                    });
                    return function(feature, resolution) {;
                        return [new ol.style.Style({
                            fill: fill,
                            stroke: stroke,
                            text: new ol.style.Text({
                                font: '12px Calibri,sans-serif',
                                text: markerNumber,
                                fill: textFill,
                                stroke: textStroke
                            })
                        })];
                    };
                })();

                markerFeature.setStyle(fixedMarkerStyle);

                this.activeLayer.getSource().addFeature(markerFeature);
            }


            this.drawInteraction = new ol.interaction.DrawWithShapes({});

            this.exportCanvas = function(encoding) {
                // Determining blocks of document that will be used iteratively to capture canvas image data
                var documentExtent = this.documentExtent,
                    paperSizeInPixels = this.paperSizeInPixels,
                    map = this.map,
                    mapView = this.mapView,
                    currentResolution = mapView.getResolution(),
                    mapSize = map.getSize(),
                    documentBottomLeftPixels = map.getPixelFromCoordinate(ol.extent.getBottomLeft(documentExtent)),
                    documentTopRightPixels = map.getPixelFromCoordinate(ol.extent.getTopRight(documentExtent)),
                    documentWidthPixels = Math.abs(documentTopRightPixels[0] - documentBottomLeftPixels[0]),
                    resolutionForOutputPaperSize = currentResolution * documentWidthPixels / paperSizeInPixels[0];

                mapView.setResolution(resolutionForOutputPaperSize);
                map.renderSync();

                var documentBottomLeftPixels = map.getPixelFromCoordinate(ol.extent.getBottomLeft(documentExtent)),
                    documentTopRightPixels = map.getPixelFromCoordinate(ol.extent.getTopRight(documentExtent)),
                    documentWidthPixels = Math.round(Math.abs(documentTopRightPixels[0] - documentBottomLeftPixels[0])),
                    documentHeightPixels = Math.round(Math.abs(documentTopRightPixels[1] - documentBottomLeftPixels[1])),
                    widthPieces = Math.ceil( documentWidthPixels / mapSize[0] ),
                    widthPieceCoordinateDistance = ol.extent.getWidth(documentExtent) / widthPieces,
                    widthPiecePixelDistance = documentWidthPixels / widthPieces,
                    heightPieces = Math.ceil( documentHeightPixels / mapSize[1] ),
                    heightPieceCoordinateDistance = ol.extent.getHeight(documentExtent) / heightPieces,
                    heightPiecePixelDistance = documentHeightPixels / heightPieces,
                    i, j;

                var hiddenCanvas = document.getElementById("hiddenExportCanvasId");
                hiddenCanvas.style.width = documentWidthPixels + 'px'; //this.baseImageLayer.documentExtent[2] + "px";
                hiddenCanvas.style.height = documentHeightPixels + 'px'; //this.baseImageLayer.documentExtent[3] + "px";
                hiddenCanvas.width = documentWidthPixels;
                hiddenCanvas.height = documentHeightPixels;

                    
                var mapContext = map.getRenderer().context_,
                    hiddenContext = hiddenCanvas.getContext("2d");

                // Painting white background to export canvas
                hiddenContext.fillStyle = 'white';
                hiddenContext.fillRect(0, 0, documentWidthPixels, documentHeightPixels);

                if(mapContext) {
                    // Captures from bottom left to top right
                    for(i=0; i<widthPieces; i++) {
                        for(j=0; j<heightPieces; j++) {
                            var pieceExtent = [ documentExtent[0] + i * widthPieceCoordinateDistance, documentExtent[1] + j * heightPieceCoordinateDistance,
                                                documentExtent[0] + ( (i + 1) * widthPieceCoordinateDistance ), documentExtent[1] + ( (j + 1) * heightPieceCoordinateDistance ) ];

                            mapView.setCenter(ol.extent.getCenter(pieceExtent));

                            map.renderSync();
                            
                            var topLeftPixel = map.getPixelFromCoordinate(ol.extent.getTopLeft(pieceExtent)),
                                pieceImageData = mapContext.getImageData(topLeftPixel[0], topLeftPixel[1], widthPiecePixelDistance, heightPiecePixelDistance);

                            hiddenContext.putImageData(pieceImageData, i * widthPiecePixelDistance, (heightPieces-j-1) * heightPiecePixelDistance);

                            map.renderSync();
                        }
                    }

                    this.exportLink.href = hiddenCanvas.toDataURL('image/png');
                    this.exportLink.click();
                    this.zoomToDocumentExtent();
                } else {
                    // @TODO implement invalid renderer prompt
                }
                
                return;
            }

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


            this.imageUrl = '/galsys/zommableImages/chess-400x400.jpg';
            this.imageSize = [400, 400];
            this.imageCenter = [200, 200];
            this.imageExtent = [0, 0, 400, 400];

            // Setting up widget projection
            this.pixelProjection = new ol.proj.Projection({
                code: 'pixel',
                units: 'pixels',
                extent: this.imageExtent // width and height of used image
            });


            // For document size
            this.paperDpi = 72;
            this.paperSizeInPixels = [8.5 * this.paperDpi, 11 * this.paperDpi]; // Letter Size
            this.marginSizeInPixels = 0.5 * this.paperDpi;
            this.paperSizeWithoutMargins = [this.paperSizeInPixels[0] - this.marginSizeInPixels * 2, this.paperSizeInPixels[1] - this.marginSizeInPixels * 2];
            this.imageToDocumentPixelRatio = [this.imageSize[0] / this.paperSizeWithoutMargins[0], this.imageSize[1] / this.paperSizeWithoutMargins[1]];
            
            if(this.imageToDocumentPixelRatio[0] >= this.imageToDocumentPixelRatio[1]) {
                this.marginInImagePixels = this.marginSizeInPixels * this.imageToDocumentPixelRatio[0];
                var bottomPadding = ( this.paperSizeInPixels[1] * this.imageToDocumentPixelRatio[0] - this.imageSize[1] ) / 2;
                this.documentExtent = [-1 * this.marginInImagePixels, -1 * bottomPadding, this.imageSize[0] + this.marginInImagePixels, this.imageSize[1] + bottomPadding];
            } else {
                this.marginInImagePixels = this.marginSizeInPixels * this.imageToDocumentPixelRatio[1];
                var leftPadding = ( this.paperSizeInPixels[0] * this.imageToDocumentPixelRatio[1] - this.imageSize[0] ) / 2;
                this.documentExtent = [-1 * leftPadding, -1 * this.marginInImagePixels, this.imageSize[0] + leftPadding, this.imageSize[1] + this.marginInImagePixels];
            }

            // Setting up base image layer
            this.baseImageLayer = new ol.layer.Image({
                source: new ol.source.ImageStatic({
                    url: this.imageUrl,
                    imageSize: this.imageSize,
                    imageExtent: this.imageExtent
                })
            });

            this.baseImageLayer.documentExtent = this.documentExtent;
            this.baseImageLayer.documentResolutionFactor = 0;

            // Manipulate Interaction, taking account baseImage manipulation
            this.manipulateInteraction = new ol.interaction.Manipulate({
                iconsBaseUrl: "js/demo/widget/images/",
                manipulatableBaseLayer: this.baseImageLayer,
                layerToManipulateOn: this.activeLayer
                /*features: this.selectInteraction.getFeatures(),
                style: this.overlayStyle*/
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


            this.buildViewResolutions = function() {
                return [100, 75, 50, 37.5, 25, 17.5, 10, 7.5, 5, 4, 2, 1.5, 1, 0.75, 0.625, 0.5, 0.25, 0.125, 0.1];
            }

            // Setting up map view based on pixel project and image size
            this.mapView = new ol.View({
                projection: this.pixelProjection,
                /*minZoom: 0,
                 maxZoom: 7,*/
                //extent: [250, 300, 250, 300],
                center: this.imageCenter,
                resolution: 1,
                resolutions: this.buildViewResolutions()
            });

            this.viewResolutionChanged = function() {
                if(!isNaN(this.mapView.get('resolution')))
                    this.set('mapResolution', this.baseImageLayer.documentResolutionFactor + this.mapView.get('resolution'));
            }

            this.mapView.on("change:resolution", this.viewResolutionChanged, this);

            this.watch('sliderResolution', function(attr, oldVal, newVal) {
                if(!isNaN(newVal) && newVal > 0 /* @TODO and if within appropriate range*/) {
                    this.mapView.setResolution(newVal - this.baseImageLayer.documentResolutionFactor);
                }
            });
            
            this.initializeOLMap = function() {
                var self = this;

                domStyle.set(this.mapDiv, "width", this.width);
                domStyle.set(this.mapDiv, "height", this.height);
                domStyle.set(this.mapDiv, "margin", '0 auto');

                // Instantiating ol map
                this.map = new ol.Map({
                    controls: [
                        new ol.control.MousePosition({
                            undefinedHTML: 'outside',
                            target: "mousePositionContainerId",
                            /*projection: this.pixelProjection,*/
                            coordinateFormat: function(coordinate) {
                                return ol.coordinate.format(coordinate, '{x}, {y} px', 1);
                            }
                        })
                    ],
                    interactions: ol.interaction.defaults().extend([this.manipulateInteraction, this.drawInteraction]),
                    layers: [this.baseImageLayer],
                    target: this.mapDiv,
                    view: this.mapView
                });

                this.watch("shouldGrayOut", function(){
                    this.map.renderSync();
                });

                this.map.on('postcompose', function(event) {
                    // Graying out area outside document extent while leaving 1px room for border rectangle
                    var drawingBottomLeft = self.map.getPixelFromCoordinate([self.baseImageLayer.documentExtent[0], self.baseImageLayer.documentExtent[1]]),
                        drawingTopRight = self.map.getPixelFromCoordinate([self.baseImageLayer.documentExtent[2], self.baseImageLayer.documentExtent[3]]);

                    var ctx = event.context,
                        currentGlobalCompositeOperation = ctx.globalCompositeOperation;

                    ctx.globalCompositeOperation = "destination-over";

                    if(self.shouldGrayOut) {
                        ctx.beginPath();
                        ctx.strokeStyle = "grey";
                        ctx.lineWidth = 1;
                        ctx.rect(drawingBottomLeft[0] - 1, drawingBottomLeft[1] + 1, drawingTopRight[0] - drawingBottomLeft[0] + 2, drawingTopRight[1] - drawingBottomLeft[1] - 2);
                        ctx.stroke();

                        ctx.beginPath();

                        ctx.rect(0, 0, drawingBottomLeft[0], 100000);
                        ctx.rect(0, 0, 100000, drawingTopRight[1] );
                        ctx.rect(drawingTopRight[0], 0, 100000, 100000 );
                        ctx.rect(0, drawingBottomLeft[1], 100000, 100000 );

                        ctx.fillStyle = "#EEE";
                        ctx.fill();
                    }

                    // Painting white background
                    ctx.fillStyle = "white";
                    ctx.fillRect(drawingBottomLeft[0] - 1, drawingTopRight[1] - 1, drawingTopRight[0] - drawingBottomLeft[0], drawingBottomLeft[1] - drawingTopRight[1]);

                    ctx.globalCompositeOperation = currentGlobalCompositeOperation;

                }, this);
                this.map.renderSync();
            }
        },

        postCreate: function() {

            this.inherited(arguments);

            widgetDebug = this; // For dev purposes only
        },

        resize: function() {
            this.inherited(arguments);

            if(!this.map) {
                this.initializeOLMap();
            }
        },

        startup: function() {
            this.inherited(arguments);
        }
    });
});