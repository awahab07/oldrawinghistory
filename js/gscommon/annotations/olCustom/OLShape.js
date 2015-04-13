define([
    "dojo/_base/lang",
    "dojo/_base/array"
], function (lang, array) {
    /**
     * Extending ol.Feature into ol.ManipulateFeature to allow the feature to handle manipulation behavior
     * Can be used to preserve/observe custom attributes for drawing or styles needed to accomodate behavior required
     * for the application
     * Also can be extended by specific shapes to define custom manipulation behavior
     */


    goog.provide('ol.shape.ShapeType');
    goog.provide('ol.shape.ShapeClass');
    goog.provide('ol.shape.ShapeBaseGeomTypes');
    goog.provide('ol.shape.PreservableProperties');
    goog.provide('ol.shape.ShapeFeature');
    goog.provide('ol.shape.Arrow');
    goog.provide('ol.shape.LineArrow');
    goog.provide('ol.shape.Marker');
    goog.provide('ol.shape.Text');

    goog.require('ol.geom.Ellipse');
    goog.require('ol.geom.TextRectangle');
    goog.require('ol.Feature');
    /**
     * ShapeType string enums
     */
    ol.shape.ShapeType = {
        ARROW: 'Arrow',
        LINEARROW: 'LineArrow',
        RECTANGLE: 'Rectangle',
        FREEHANDLINE: 'FreeHandLine',
        FREEHANDCLOSED: 'FreeHandClosed',
        ELLIPSE: 'Ellipse',
        LINE: 'Line',
        MARKER: 'Marker',
        DOT: 'Dot',
        TEXT: 'Text'
    };

    /**
     * Shapes Foundation Geom Type enum
     */
    ol.shape.ShapeBaseGeomTypes = {
        ARROW: 'Polygon',
        LINEARROW: 'LineString',
        RECTANGLE: 'Polygon',
        FREEHANDLINE: 'LineString',
        FREEHANDCLOSED: 'Polygon',
        ELLIPSE: 'Ellipse',
        LINE: 'LineString',
        MARKER: 'Marker',
        DOT: 'Ellipse',
        TEXT: 'TextRectangle'
    };

    /**
     * Properties subject to be saved/loaded via Web Services
     * @type {{}}
     */
    ol.shape.PreservableProperties = {
        ROTATIONDEGREES: 'rotationDegrees',
        ROTATIONCENTER: 'rotationCenter',
        STYLEOBJECT: 'styleObject',
        TEXT: 'text'
    };

    /***** Base Shape Featuer *****/
    ol.shape.ShapeFeature = function(opt_geometryOrProperties) {
        goog.base(this, opt_geometryOrProperties);

        this.shapeType = null; // Custom shape type: circle, rectangle, line, free line, text
        this.baseShapeType = null; // The foundation base (ol.geom.?) shape type
        this.manipulationConfig = {}; // Stores configuration of Manipulation Behavior/Handlers per shape type

        this.manipulationConfig.showSelectBox = true;
        this.manipulationConfig.showResizeHandles = true;
        this.manipulationConfig.showRotateHandle = true;

        this.manipulationConfig.handlesTranslation = false;
        this.manipulationConfig.handlesRotation = false;

        /** values for application specific needs, subject to be stored and retrieved from services **/
        this.set(ol.shape.PreservableProperties.ROTATIONDEGREES, 0);  // To preserve rotation
        this.set(ol.shape.PreservableProperties.ROTATIONCENTER, [0, 0]);  // Current rotation center
        this.set(ol.shape.PreservableProperties.STYLEOBJECT, {});  // Current style in JSON
    };
    goog.inherits(ol.shape.ShapeFeature, ol.Feature);

    /**
     * Required by ol.interaction.draw while drawing this shape
     * Accepts dragStart and dragEnd coordinates and returns the appropriate geometry calculating
     * Required by ol.interaction.Draw | ol.interaction.DrawWithShapes
     * the shape formation based on these coordinates
     */
    ol.shape.ShapeFeature.prototype.createSketchFeatureGeometry_ = goog.nullFunction;

    /**
     * Used when sketchFeature should be updated
     * @type {Array<ol.Coordinate>}
     */
    ol.shape.ShapeFeature.prototype.getUpdatedSketchFeatureCoordinates_ = goog.nullFunction;

    /**
     * Returns the feature that is shown while sketching the shape
     * Required by ol.interaction.Draw | ol.interaction.DrawWithShapes
     * @type {ol.Feature}
     */
    ol.shape.ShapeFeature.prototype.getSketchPoint_ = goog.nullFunction;

    /**
     * Create the sketch feature - feature with slightly dim styles than the target styles
     * @type {ol.shape.ShapeFeature}
     */
    ol.shape.ShapeFeature.prototype.createNewSketchFeature_ = goog.nullFunction;

    /**
     * Can be called by drawing interaction to call necessary functionality when a new shape drawing is completed
     */
    ol.shape.ShapeFeature.prototype.drawingCompleted = goog.nullFunction;

    /**
     * For shapeFeatures who provide their own translate functionality and can't rely on ol.layer.manipulation manipulations
     */
    ol.shape.ShapeFeature.prototype.getTranslatedCoordinates = goog.nullFunction;

    /**
     * Returns the array of manipulation handles that should be displayed by manipulation managers
     * @type {Array <ol.Feature>}
     */
    ol.shape.ShapeFeature.prototype.getManipulationHandles = function() {
        return [];
    };

    /**
     * defines the handlers when manipulation handles are dragged
     */
    ol.shape.ShapeFeature.prototype.manipulaitonHandleDragged = goog.nullFunction;

    /**
     * Whether draws text in geometry
     * @returns {boolean}
     */
    ol.shape.ShapeFeature.prototype.showsText = function() {
        return false;
    };

    ol.shape.ShapeFeature.prototype.updateStyle = function (/*object*/styleObj) {
        styleObj = lang.clone(styleObj); // work around for common opacity

        var self = this;
        self.set(ol.shape.PreservableProperties.STYLEOBJECT, styleObj);

        var featureStyleFunction = (function(){
            // @TODO account for configurable image style
            var image = new ol.style.Circle({
                radius: 5,
                fill: null,
                stroke: new ol.style.Stroke({color: 'orange', width: 2})
            });

            // For demo
            if(styleObj.stroke && styleObj.stroke.style){
                switch (styleObj.stroke.style) {
                    case 1: // Solid
                        styleObj.stroke.lineDash = [];
                        break;
                    case 2: // Dotted
                        styleObj.stroke.lineDash = [styleObj.stroke.width || 2, 8];
                        break;
                    case 3: // Dashed
                        styleObj.stroke.lineDash = [8, 8];
                        break;
                    case 4: // Dash Dot
                        styleObj.stroke.lineDash = [8, 8, 4, 8];
                        break;
                    default:
                        styleObj.stroke.lineDash = [];
                        break;
                }
            }

            // Applying opacity if present in fill
            if(styleObj.fill && styleObj.fill.opacity) {
                if(styleObj.fill && typeof styleObj.fill.color == "object") {
                    // If not transparent
                    if(styleObj.fill.color.r || styleObj.fill.color.g || styleObj.fill.color.b) {
                        styleObj.fill.color.a = Number(styleObj.fill.opacity) / 100;
                    }
                }
            }

            return function(resolution) {
                var styleResolution = resolution || 1,
                    featureStyle = [
                        new ol.style.Style({
                            stroke: new ol.style.Stroke({
                                color: styleObj.stroke && styleObj.stroke.color && (typeof styleObj.stroke.color == "object" && 'rgba('+styleObj.stroke.color.r+','+styleObj.stroke.color.g+','+styleObj.stroke.color.b+','+styleObj.stroke.color.a+')' || styleObj.stroke.color) || 'red',
                                width: (styleObj.stroke && !isNaN(styleObj.stroke.width) && ( parseFloat(styleObj.stroke.width)  / styleResolution) ) || (2 / styleResolution),
                                lineDash: styleObj.stroke && styleObj.stroke.lineDash || []
                                // @TODO Account for fixedWidth
                            }),
                            fill: new ol.style.Fill({
                                color: styleObj.fill && styleObj.fill.color && (typeof styleObj.fill.color == "object" && 'rgba('+styleObj.fill.color.r+','+styleObj.fill.color.g+','+styleObj.fill.color.b+','+styleObj.fill.color.a+')' || styleObj.fill.color) || 'rgba(255, 0, 0, 0.1)'
                            }),
                            image: image,
                            text: new ol.style.Text({
                                font: 16 / resolution + 'px Calibri,sans-serif',
                                fill: new ol.style.Fill({
                                    color: styleObj.text && styleObj.text.color && (typeof styleObj.text.color == "object" && 'rgba('+styleObj.text.color.r+','+styleObj.text.color.g+','+styleObj.text.color.b+','+styleObj.text.color.a+')' || styleObj.text.color) || 'black'
                                }),
                                text: self.showsText() && self.get('text') && self.get('text') + '' || ''
                            })
                        })
                    ];
                return featureStyle;
            }
        })();

        this.setStyle(featureStyleFunction);

        // Updating styles for DB
        var dbPropertiesObj = this.get('_dbProperties');
        if(!dbPropertiesObj) {
            dbPropertiesObj = {};
        }

        dbPropertiesObj.colorId = styleObj.stroke && styleObj.stroke.color && typeof styleObj.stroke.color == "object" && styleObj.stroke.color.id || 1;
        dbPropertiesObj.linestyleId = 1;
        dbPropertiesObj.fillColorId = styleObj.fill && styleObj.fill.color && typeof styleObj.fill.color == "object" && styleObj.fill.color.id || 1;

        this.set('_dbProperties', dbPropertiesObj);
    };

    ol.shape.ShapeFeature.prototype.getJSONObj = function() {
        var featureJSONObj = {};
        featureJSONObj.shapeType = this.shapeType;
        featureJSONObj.coordinates = [];

        featureJSONObj.coordinates = this.getGeometry().getGeometryCoordinates();

        featureJSONObj.style = this.get(ol.shape.PreservableProperties.STYLEOBJECT);
        featureJSONObj.rotationDegrees = this.get(ol.shape.PreservableProperties.ROTATIONDEGREES);
        featureJSONObj.rotationCenter = this.get(ol.shape.PreservableProperties.ROTATIONCENTER);
        featureJSONObj.text = this.get(ol.shape.PreservableProperties.TEXT);

        return featureJSONObj;
    };

    ol.shape.ShapeFeature.prototype.toJSONString = function (dbShapeObject) {
        var featureJSONObj = this.getJSONObj();

        // returning JSON String while making sure it is parsable within another JSON
        return JSON.stringify(featureJSONObj).replace(/"/g, '\\"');
    };

    ol.shape.ShapeFeature.prototype.updateFromJSONObj = function(jsonObj) {
        this.getGeometry().setGeometryCoordinates(jsonObj.coordinates);

        this.updateStyle(jsonObj.style);
        this.set('rotationDegrees', jsonObj.rotationDegrees);
        this.set('rotationCenter', jsonObj.rotationCenter);
        this.set('text', jsonObj.text || '');
    };

    ol.shape.ShapeFeature.prototype.createFromJSONString = function(jsonString) {
        var jsonObj = JSON.parse(jsonString.replace(/\\"/g, '"'));

        if(jsonObj.shapeType) {
            var shapeFeature = new ol.shape.ShapeClass[jsonObj.shapeType.toUpperCase()]();

            shapeFeature.setGeometry(new shapeFeature.baseShapeType([]));
            shapeFeature.updateFromJSONObj(jsonObj);

            return shapeFeature;
        } else {
            console.warn("Shape JSON is not recognizable", jsonObj);
        }
    };

    ol.shape.ShapeFeature.prototype.getFid = function() {
        if(this.getId && this.getId()) {
            if(!this.fid) {
                this.fid = this.getId();
            }
        } else {
            this.setId(goog.getUid(this));
        }

        return this.getId();
    };

    /***** Polygon Arrow Shape *****/
    ol.shape.Arrow = function(opt_geometryOrProperties) {
        goog.base(this, opt_geometryOrProperties);

        this.shapeType = ol.shape.ShapeType.LINEARROW;
        this.baseShapeType = ol.geom.LineString;
    };
    goog.inherits(ol.shape.Arrow, ol.shape.ShapeFeature);

    ol.shape.Arrow.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        return new ol.geom.Polygon(this.getUpdatedSketchFeatureCoordinates_(coordinates));
    };

    ol.shape.Arrow.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1],
            endX = coordinates[0][coordinates[0].length-1][0],
            endY = coordinates[0][coordinates[0].length-1][1],
            dx = startX - endX,
            dy = startY - endY,
            distance = Math.sqrt(dx * dx + dy * dy) || 0;

        var m = (y2-y1)/(x2-x1)+1, dividerX = 1/Math.sqrt(1+(m*m)), dividerY = m/Math.sqrt(1+(m*m));

        var y3 = startY, y2 = startY - distance/3*dy/Math.abs(dy), y1 = endY,
            x1 = startX - distance/3, x2 = startX - distance/6, x3 = startX, x4 = startX + distance/6, x5 = startX + distance/ 3;

        var shapePolygonCoordinates = [[
            [x3, y3],
            [x5, y2],
            [x4, y2],
            [x4, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2]
        ]];

        return shapePolygonCoordinates;
    };

    ol.shape.Arrow.prototype.getSketchPoint_ = function(coordinate) {
        return new ol.Feature(new ol.geom.Point(coordinate))
    };

    ol.shape.Arrow.prototype.createNewSketchFeature_ = function(styleObj) {
        var sketchFeature = new ol.shape.Arrow();
        if(styleObj) {
            sketchFeature.updateStyle(styleObj);
        }
        return sketchFeature;
    };


    /***** Line Arrow Shape *****/
    ol.shape.LineArrow = function(opt_geometryOrProperties) {
        goog.base(this, opt_geometryOrProperties);

        this.shapeType = ol.shape.ShapeType.LINEARROW;
        this.baseShapeType = ol.geom.LineString;

        this.manipulationConfig.showSelectBox = true;
        this.manipulationConfig.showResizeHandles = false;
        this.manipulationConfig.showRotateHandle = false;

        this.startX_ = null;
        this.startY_ = null;
        this.endX_ = null;
        this.endY_ = null;
        this.earsAngleOffset_ = 0;
        this.earsLength_ = 10;


        this.tipHandleStyle_ = new ol.style.Style({
            image: new ol.style.Circle({
                radius: 3,
                fill: new ol.style.Fill({
                    color: '#fff'
                }),
                stroke: new ol.style.Stroke({
                    color: '#000',
                    width: 1
                })
            })
        });

        this.earHandleStyle_ = new ol.style.Style({
            image: new ol.style.Circle({
                radius: 3,
                fill: new ol.style.Fill({
                    color: '#ffff00'
                }),
                stroke: new ol.style.Stroke({
                    color: '#000',
                    width: 1
                })
            })
        });

        // Instance methods
        this.getManipulationHandles = function() {
            var shapeCoordinates = this.getGeometry().getCoordinates(),
                tailCoordinate = shapeCoordinates[0],
                tipCoordinate = shapeCoordinates[1],
                leftEarCoordinate = shapeCoordinates[2],
                rightEarCoordinate = shapeCoordinates[4];

            // this.tipHandle_
            this.createOrUpdateManipulationHanlde_(this.tipHandle_, "TipHandle", tipCoordinate, "nwse-resize", true);

            // this.tailHandle_
            this.createOrUpdateManipulationHanlde_(this.tailHandle_, "TailHandle", tailCoordinate, "nesw-resize", true);

            // this.leftEarHandle_
            this.createOrUpdateManipulationHanlde_(this.leftEarHandle_, "LeftEarHandle", leftEarCoordinate, "ns-resize", false);

            // this.rightEarHandle_
            this.createOrUpdateManipulationHanlde_(this.rightEarHandle_, "RightEarHandle", rightEarCoordinate, "ns-resize", false);

            return [this.tipHandle_, this.tailHandle_, this.leftEarHandle_, this.rightEarHandle_];
        };

        this.createOrUpdateManipulationHanlde_ = function(handleFeature, type, coordinate, cursorStyle, isIncrementalChange) {
            if(!handleFeature) {
                var handlePointGeometry = new ol.geom.Point(coordinate);
                handleFeature = new ol.Feature({geometry: handlePointGeometry});

                switch(type) {
                    case "TipHandle":
                        this.tipHandle_ = handleFeature;
                        this.tipHandle_.setStyle(this.tipHandleStyle_);
                        this.tipHandle_.shapeHandleType_ = "TipHandle";
                        break;

                    case "TailHandle":
                        this.tailHandle_ = handleFeature;
                        this.tailHandle_.setStyle(this.tipHandleStyle_);
                        this.tailHandle_.shapeHandleType_ = "TailHandle";
                        break;

                    case "LeftEarHandle":
                        this.leftEarHandle_ = handleFeature;
                        this.leftEarHandle_.setStyle(this.earHandleStyle_);
                        this.leftEarHandle_.shapeHandleType_ = "LeftEarHandle";
                        break;

                    case "RightEarHandle":
                        this.rightEarHandle_ = handleFeature;
                        this.rightEarHandle_.setStyle(this.earHandleStyle_);
                        this.rightEarHandle_.shapeHandleType_ = "RightEarHandle";
                        break;
                }

                handleFeature.isHandleFeature = true;
                handleFeature.manipulatingFeature_ = this;
                handleFeature.handleType = "ShapeSpecific";
                handleFeature.cursorStyle = cursorStyle;
                handleFeature.isIncrementalChange = isIncrementalChange;
            } else {
                handleFeature.getGeometry().setCoordinates(coordinate);
            }

            return handleFeature;
        };

        this.manipulaitonHandleDragged = function(map, handle, fromPx, toPx, mapBrowserEvent) {
            switch(handle.shapeHandleType_) {
                case "TipHandle":
                    var endX = mapBrowserEvent.coordinate[0],
                        endY = mapBrowserEvent.coordinate[1],
                        angleDegrees = goog.math.angle(this.startX_, this.startY_, endX, endY) - 90;
                    this.manipulateShape_(this.startX_, this.startY_, endX, endY, angleDegrees, this.earsLength_);
                    this.endX_ = endX;
                    this.endY_ = endY;
                    break;

                case "TailHandle":
                    var startX = mapBrowserEvent.coordinate[0],
                        startY = mapBrowserEvent.coordinate[1],
                        angleDegrees = goog.math.angle(startX, startY, this.endX_, this.endY_) - 90;
                    this.manipulateShape_(startX, startY, this.endX_, this.endY_, angleDegrees, this.earsLength_);
                    this.startX_ = startX;
                    this.startY_ = startY;
                    break;

                case "RightEarHandle":
                case "LeftEarHandle":
                    var distance = Math.sqrt(ol.coordinate.squaredDistance([this.endX_, this.endY_], mapBrowserEvent.coordinate)),
                        angleDegrees = goog.math.angle(this.startX_, this.startY_, this.endX_, this.endY_) - 90;

                    this.earsLength_ = distance;
                    this.manipulateShape_(this.startX_, this.startY_, this.endX_, this.endY_, angleDegrees, this.earsLength_);
                    break;
            }
        }
    };
    goog.inherits(ol.shape.LineArrow, ol.shape.ShapeFeature);

    ol.shape.LineArrow.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        return new ol.geom.LineString(this.getUpdatedSketchFeatureCoordinates_(coordinates));
    };

    ol.shape.LineArrow.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1],
            endX = coordinates[0][coordinates[0].length-1][0],
            endY = coordinates[0][coordinates[0].length-1][1],
            angleDegrees = goog.math.angle(startX, startY, endX, endY) - 90;

        return this.getFormedShapeCoordinates_(startX, startY, endX, endY, angleDegrees, 10);
    };

    ol.shape.LineArrow.prototype.getSketchPoint_ = function(coordinate) {
        var sketchPointFeature = new ol.Feature(new ol.geom.Point(coordinate));
        return sketchPointFeature;
    };

    ol.shape.LineArrow.prototype.createNewSketchFeature_ = function(styleObj) {
        var sketchFeature = new ol.shape.LineArrow();
        if(styleObj) {
            sketchFeature.updateStyle(styleObj);
        }
        return sketchFeature;
    };

    ol.shape.LineArrow.prototype.drawingCompleted = function(createdFeature, coordinates) {
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1],
            endX = coordinates[0][coordinates[0].length-1][0],
            endY = coordinates[0][coordinates[0].length-1][1];

        this.updateFeatureAngle_(startX, startY, endX, endY, createdFeature);

        this.startX_ = startX;
        this.startY_ = startY;
        this.endX_ = endX;
        this.endY_ = endY;
        this.earsAngleOffset_ = 0;
        this.earsLength_ = 10;
    };

    ol.shape.LineArrow.prototype.getFormedShapeCoordinates_ = function(startX, startY, endX, endY, angleDegrees, earsLength) {
        if(!earsLength) {
            earsLength = 10;
        }

        var mathEndPoint = new goog.math.Coordinate(endX, endY),
            arrowTipCoords = [[endX - earsLength, endY - earsLength], [endX, endY], [endX + earsLength, endY - earsLength], [endX, endY]];

        arrowTipCoords = arrowTipCoords.map(function(coordinate) {
            var mathCoordinate = new goog.math.Coordinate(coordinate[0], coordinate[1]);
            mathCoordinate.rotateDegrees(angleDegrees, mathEndPoint);
            return [mathCoordinate.x, mathCoordinate.y];
        });

        var shapeCoordinates = [ [startX, startY], [endX, endY] ];

        shapeCoordinates = shapeCoordinates.concat(arrowTipCoords);

        return shapeCoordinates;
    };

    ol.shape.LineArrow.prototype.updateFeatureAngle_ = function(startX, startY, endX, endY, feature) {
        var feature = feature || this,
            angleDegrees = goog.math.angle(startX, startY, endX, endY);

        feature.set('rotationDegrees', angleDegrees);
        feature.set('rotationCenter', [startX, startY]);
    };

    ol.shape.LineArrow.prototype.manipulateShape_ = function(startX, startY, endX, endY, angleDegreesOffset, earsLength) {
        this.getGeometry().setCoordinates(this.getFormedShapeCoordinates_(startX, startY, endX, endY, angleDegreesOffset, earsLength));
        this.updateFeatureAngle_(startX, startY, endX, endY, this);
    };

    ol.shape.LineArrow.prototype.updateAttributesFromCoordinates = function() {
        var coordinates = this.getGeometry().getCoordinates();
        this.startX_ = coordinates[0][0];
        this.startY_ = coordinates[0][1];
        this.endX_ = coordinates[1][0];
        this.endY_ = coordinates[1][1];
    };

    ol.shape.LineArrow.prototype.manipulated = function() {
        this.updateAttributesFromCoordinates();
    };

    /***** Polygon Rectangle Shape *****/
    ol.shape.Rectangle = function(opt_geometryOrProperties) {
        goog.base(this, opt_geometryOrProperties);

        this.shapeType = ol.shape.ShapeType.RECTANGLE;
        this.baseShapeType = ol.geom.Polygon;
    };
    goog.inherits(ol.shape.Rectangle, ol.shape.ShapeFeature);

    ol.shape.Rectangle.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        return  new ol.geom.Polygon(this.getUpdatedSketchFeatureCoordinates_(coordinates));
    };

    ol.shape.Rectangle.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1],
            endX = coordinates[0][coordinates[0].length-1][0],
            endY = coordinates[0][coordinates[0].length-1][1];

        var shapePolygonCoordinates = [[
            [startX, startY],
            [endX, startY],
            [endX, endY],
            [startX, endY],
            [startX, startY]
        ]];

        return shapePolygonCoordinates;
    };

    ol.shape.Rectangle.prototype.getSketchPoint_ = function(coordinate) {
        return new ol.Feature(new ol.geom.Point(coordinate))
    };

    ol.shape.Rectangle.prototype.createNewSketchFeature_ = function(styleObj) {
        var sketchFeature = new ol.shape.Rectangle();
        if(styleObj) {
            sketchFeature.updateStyle(styleObj);
        }
        return sketchFeature;
    };


    /***** Free Hand Line Shape *****/
    ol.shape.FreeHandLine = function(opt_geometryOrProperties) {
        goog.base(this);

        this.shapeType = ol.shape.ShapeType.FREEHANDLINE;
        this.baseShapeType = ol.geom.LineString;

        this.previousDrawingCoordinates_ = null; // used where a track of old drawing geometry coordinates is necessary
    };
    goog.inherits(ol.shape.FreeHandLine, ol.shape.ShapeFeature);

    ol.shape.FreeHandLine.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        return new ol.geom.LineString(this.getUpdatedSketchFeatureCoordinates_(coordinates));
    };

    ol.shape.FreeHandLine.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1],
            endX = coordinates[0][coordinates[0].length-1][0],
            endY = coordinates[0][coordinates[0].length-1][1];

        if(!this.previousDrawingCoordinates_) {
            this.previousDrawingCoordinates_ = [ [startX, startY], [endX, endY] ];
        } else {
            this.previousDrawingCoordinates_.push([endX, endY]);
        }

        return this.previousDrawingCoordinates_;
    };

    ol.shape.FreeHandLine.prototype.getSketchPoint_ = function(coordinate) {
        return new ol.Feature(new ol.geom.Point(coordinate))
    };

    ol.shape.FreeHandLine.prototype.createNewSketchFeature_ = function(styleObj) {
        this.previousDrawingCoordinates_  = null;
        var freeHandLineFeature = new ol.shape.FreeHandLine();
        if(styleObj) {
            freeHandLineFeature.updateStyle(styleObj);
        }
        return freeHandLineFeature;
    };


    /***** Free Hand Closed Shape *****/
    ol.shape.FreeHandClosed = function(opt_geometryOrProperties) {
        goog.base(this);

        this.shapeType = ol.shape.ShapeType.FREEHANDCLOSED;
        this.baseShapeType = ol.geom.Polygon;

        this.previousDrawingCoordinates_ = null; // used where a track of old drawing geometry coordinates is necessary
    };
    goog.inherits(ol.shape.FreeHandClosed, ol.shape.ShapeFeature);

    ol.shape.FreeHandClosed.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        return new ol.geom.LineString(this.getUpdatedSketchFeatureCoordinates_(coordinates));
    };

    ol.shape.FreeHandClosed.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1],
            endX = coordinates[0][coordinates[0].length-1][0],
            endY = coordinates[0][coordinates[0].length-1][1];

        if(!this.previousDrawingCoordinates_) {
            this.previousDrawingCoordinates_ = [ [startX, startY], [endX, endY] ];
        } else {
            this.previousDrawingCoordinates_.push([endX, endY]);
        }

        return this.previousDrawingCoordinates_;
    };

    ol.shape.FreeHandClosed.prototype.getSketchPoint_ = function(coordinate) {
        return new ol.Feature(new ol.geom.Point(coordinate))
    };

    ol.shape.FreeHandClosed.prototype.createNewSketchFeature_ = function(styleObj) {
        this.previousDrawingCoordinates_  = null;
        var sketchFeature = new ol.shape.FreeHandClosed();
        if(styleObj) {
            sketchFeature.updateStyle(styleObj);
        }
        return sketchFeature;
    };

    ol.shape.FreeHandClosed.prototype.drawingCompleted = function(createdFeature, drawingCoordinates, apiRef) {
        // Forming a closed polygon from sketch feature (LineString) coordinates
        var lineStringCoordinates = this.getGeometry().getGeometryCoordinates();
        lineStringCoordinates.push(lineStringCoordinates[0]); // Closing coordinates

        var polygonCoordinates = [lineStringCoordinates.slice()],
            polygon = new ol.geom.Polygon(polygonCoordinates);

        createdFeature.setGeometry(polygon);
    };


    /***** Ellipse Shape *****/
    ol.shape.Ellipse = function(opt_geometryOrProperties) {
        goog.base(this, opt_geometryOrProperties);

        this.shapeType = ol.shape.ShapeType.ELLIPSE;
        this.baseShapeType = ol.geom.Ellipse;

        // @TODO implement resize and rotation for Ellipse and remove the below lines
        this.manipulationConfig.showResizeHandles = true;
        this.manipulationConfig.showRotateHandle = true;
    };
    goog.inherits(ol.shape.Ellipse, ol.shape.ShapeFeature);

    ol.shape.Ellipse.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        var updatedCoords = this.getUpdatedSketchFeatureCoordinates_(coordinates);
        return new ol.geom.Ellipse(updatedCoords[0], updatedCoords[1], /*rotation*/0, updatedCoords[2]);
    };

    ol.shape.Ellipse.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1],
            endX = coordinates[0][coordinates[0].length-1][0],
            endY = coordinates[0][coordinates[0].length-1][1];

        // To make the startX,startY the topLeft of the circle, rather than the center,
        // find the midpoint of line (startX, startY) - (endX, endY)

        var dragLineMidpoint = [ (startX + endX)/2, (startY + endY)/2 ],
            radiusX = Math.abs(startX - endX) / 2,
            radiusY = Math.abs(startY - endY) / 2;

        // Returning array [circleCenterCoordinate, radius];
        return [dragLineMidpoint, radiusX, radiusY];
    };

    ol.shape.Ellipse.prototype.getSketchPoint_ = function(coordinate) {
        return new ol.Feature(new ol.geom.Point(coordinate))
    };

    ol.shape.Ellipse.prototype.createNewSketchFeature_ = function(styleObj) {
        var sketchFeature = new ol.shape.Ellipse();
        if(styleObj) {
            sketchFeature.updateStyle(styleObj);
        }
        return sketchFeature;
    };

    /***** Marker Shape *****/
    ol.shape.Marker = function(opt_geometryOrProperties) {
        goog.base(this, opt_geometryOrProperties);

        this.shapeType = ol.shape.ShapeType.MARKER;
        this.baseShapeType = ol.geom.Marker;

        // @TODO implement resize and rotation for Ellipse and remove the below lines
        this.manipulationConfig.showResizeHandles = false;
        this.manipulationConfig.showRotateHandle = false;
    };
    goog.inherits(ol.shape.Marker, ol.shape.ShapeFeature);

    ol.shape.Marker.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        var updatedCoords = this.getUpdatedSketchFeatureCoordinates_(coordinates);
        return new ol.geom.Marker(updatedCoords[0], updatedCoords[1], updatedCoords[2]);
    };

    ol.shape.Marker.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw Marker shape");
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1];

        // Returning array [circleCenterCoordinate, radius];
        return [[startX, startY], 12];
    };

    ol.shape.Marker.prototype.getSketchPoint_ = function(coordinate) {
        return new ol.Feature(new ol.geom.Point(coordinate))
    };

    ol.shape.Marker.prototype.createNewSketchFeature_ = function() {
        return new ol.shape.Marker();
    };

    ol.shape.Marker.prototype.drawingCompleted = function(createdFeature, drawingCoordinates, apiRef) {
        createdFeature.set('text', apiRef.getMarkerCountForLayer(apiRef.getActiveDrawingLayer()));
        apiRef.incrementMarkerCountForLayer(apiRef.getActiveDrawingLayer());
    };

    ol.shape.Marker.prototype.showsText = function() {
        return true;
    };

    /**
     * Informs the drawInteraction that it shuld be drawn by single clicking
     * @returns {boolean} Whether this shape is a single click drawing (e.g. Point, Marker)
     */
    ol.shape.Marker.prototype.isSingleClickDrawing = function() {
        return true;
    };

    /***** Dot Shape *****/
    ol.shape.Dot = function(opt_geometryOrProperties) {
        goog.base(this, opt_geometryOrProperties);

        this.shapeType = ol.shape.ShapeType.DOT;
        this.baseShapeType = ol.geom.Ellipse;

        this.manipulationConfig.showResizeHandles = false;
        this.manipulationConfig.showRotateHandle = false;
    };
    goog.inherits(ol.shape.Dot, ol.shape.ShapeFeature);

    ol.shape.Dot.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        var updatedCoords = this.getUpdatedSketchFeatureCoordinates_(coordinates);
        return new ol.geom.Ellipse(updatedCoords[0], updatedCoords[1], updatedCoords[2], 0);
    };

    ol.shape.Dot.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        //goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1];

        // Returning array [circleCenterCoordinate, radius];
        return [[startX, startY], 5, 5];
    };

    ol.shape.Dot.prototype.getSketchPoint_ = function(coordinate) {
        return new ol.Feature(new ol.geom.Point(coordinate))
    };

    ol.shape.Dot.prototype.createNewSketchFeature_ = function() {
        var ellipseFeature = new ol.shape.Dot();
        ellipseFeature.setStyle(ol.style.defaultStyleFunction);
        return ellipseFeature;
    };

    /**
     * Overriding style, as dot will not have a stroke
     */
    ol.shape.Dot.prototype.updateStyle = function (/*object*/styleObj) {
        if(styleObj.stroke && styleObj.stroke.color && styleObj.stroke.color != "transparent") {
            if(typeof styleObj.fill == "object") {
                styleObj.fill.color = styleObj.stroke.color;
                styleObj.stroke.color = "transparent";
            }
        }

        var featureStyleFunction = goog.base(this, 'updateStyle', styleObj);
        return featureStyleFunction;
    }

    /**
     * Informs the drawInteraction that it shuld be drawn by single clicking
     * @returns {boolean} Whether this shape is a single click drawing (e.g. Point, Marker)
     */
    ol.shape.Dot.prototype.isSingleClickDrawing = function() {
        return true;
    };

    /***** Text Shape *****/
    ol.shape.Text = function(opt_geometryOrProperties) {
        goog.base(this, opt_geometryOrProperties);

        this.shapeType = ol.shape.ShapeType.TEXT;
        this.baseShapeType = ol.geom.TextRectangle;

        this.manipulationConfig.showResizeHandles = true;
        this.manipulationConfig.showRotateHandle = false;
        this.manipulationConfig.editsTextOnDBLClick = true;
    };
    goog.inherits(ol.shape.Text, ol.shape.ShapeFeature);

    ol.shape.Text.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        return  new ol.geom.TextRectangle(this.getUpdatedSketchFeatureCoordinates_(coordinates));
    };

    ol.shape.Text.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1],
            endX = coordinates[0][coordinates[0].length-1][0],
            endY = coordinates[0][coordinates[0].length-1][1];

        // Minimum rectangle size for text box
        var boundingExtent = ol.extent.boundingExtent([[startX, startY], [endX, endY]]);
        ol.extent.extendCoordinate(boundingExtent, [startX + 20, startY - 20]); // Ensuring minimum bounding box for text

        var shapePolygonCoordinates = [[
            ol.extent.getTopLeft(boundingExtent),
            ol.extent.getTopRight(boundingExtent),
            ol.extent.getBottomRight(boundingExtent),
            ol.extent.getBottomLeft(boundingExtent),
            ol.extent.getTopLeft(boundingExtent)
        ]];

        return shapePolygonCoordinates;
    };

    ol.shape.Text.prototype.getSketchPoint_ = function(coordinate) {
        var textSketchFeature = new ol.Feature(new ol.geom.Point(coordinate));
        textSketchFeature.setStyle(new ol.style.Style({
            image: null,
            text: new ol.style.Text({
                font: '14px sans-serif',
                fill: new ol.style.Fill({
                    color: 'black'
                }),
                stroke: new ol.style.Stroke({
                    color: '#3399CC',
                    width: 1.25
                }),
                text: 'T'
            })
        }));
        return textSketchFeature;
    };

    ol.shape.Text.prototype.createNewSketchFeature_ = function(styleObj) {
        var sketchFeature = new ol.shape.Text();
        sketchFeature.setStyle(new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(255, 255, 255, 0.2)'
            }),
            stroke: new ol.style.Stroke({
                color: 'black'
            })
        }));
        return sketchFeature;
    };

    /**
     * Overriding style, as Text has a hidden rectangle
     */
    ol.shape.Text.prototype.updateStyle = function (/*object*/styleObj) {
        if(styleObj.stroke && typeof styleObj.stroke == "object") {
            styleObj.stroke.color = "transparent";
        }

        if(styleObj.fill && typeof styleObj.fill == "object") {
            styleObj.fill.color = "transparent";
        }

        var featureStyleFunction = goog.base(this, 'updateStyle', styleObj);
        return featureStyleFunction;
    };

    ol.shape.Text.prototype.isSingleAndPressDragReleaseDrawing = function() {
        return true;
    };

    ol.shape.Text.prototype.showsText = function() {
        return true;
    };

    ol.shape.Text.prototype.getTextExtent = function() {
        return this.getGeometry().getExtent();
    };

    /**
     * Returns the preserved carota text structure
     */
    ol.shape.Text.prototype.getCurrentTextObj = function() {
        return [
            {
                "text": "Welcome!",
                "size": 30,
                "align": "center"
            },
            {
                "text": "\n",
                "size": 30
            },
            {
                "text": "\nYou've found the demo page for "
            },
            {
                "text": "Carota",
                "bold": true,
                "color": "orange",
                "size": 14
            } ];
    };

    /***** Line Shape *****/
    ol.shape.Line = function(opt_geometryOrProperties) {
        goog.base(this, opt_geometryOrProperties);

        this.shapeType = ol.shape.ShapeType.LINE;
        this.baseShapeType = ol.geom.LineString;
    };
    goog.inherits(ol.shape.Line, ol.shape.ShapeFeature);

    ol.shape.Line.prototype.createSketchFeatureGeometry_ = function(coordinates) {
        return new ol.geom.LineString(this.getUpdatedSketchFeatureCoordinates_(coordinates));
    };

    ol.shape.Line.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
        goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
        var startX = coordinates[0][0][0],
            startY = coordinates[0][0][1],
            endX = coordinates[0][coordinates[0].length-1][0],
            endY = coordinates[0][coordinates[0].length-1][1];

        return [ [startX, startY], [endX, endY] ];
    };

    ol.shape.Line.prototype.getSketchPoint_ = function(coordinate) {
        return new ol.Feature(new ol.geom.Point(coordinate))
    };

    ol.shape.Line.prototype.createNewSketchFeature_ = function(styleObj) {
        this.previousDrawingCoordinates_  = null;

        var sketchFeature = new ol.shape.Line();
        if(styleObj) {
            sketchFeature.updateStyle(styleObj);
        }
        return sketchFeature;
    };

    /**
     * ShapeType implementation classes enum
     */
    ol.shape.ShapeClass = {
        ARROW: ol.shape.Arrow,
        LINEARROW: ol.shape.LineArrow,
        RECTANGLE: ol.shape.Rectangle,
        FREEHANDLINE: ol.shape.FreeHandLine,
        FREEHANDCLOSED: ol.shape.FreeHandClosed,
        ELLIPSE: ol.shape.Ellipse,
        LINE: ol.shape.Line,
        MARKER: ol.shape.Marker,
        DOT: ol.shape.Dot,
        TEXT: ol.shape.Text
    };

    return ol.shape;
});