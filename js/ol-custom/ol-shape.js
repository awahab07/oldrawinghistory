/**
 * Extending ol.Feature into ol.ManipulateFeature to allow the feature to handle manipulation behavior
 * Can be used to preserve/observe custom attributes for drawing or styles needed to accomodate behavior required
 * for the application
 * Also can be extended by specific shapes to define custom manipulation behavior
 */


goog.provide('ol.shape.ShapeType');
goog.provide('ol.shape.ShapeClass');
goog.provide('ol.shape.ShapeBaseGeomTypes');
goog.provide('ol.shape.ShapeAttributes');
goog.provide('ol.shape.ShapeFeature');
goog.provide('ol.shape.Arrow');
goog.provide('ol.shape.LineArrow');

goog.require('ol.geom.DrawCircle');
goog.require('ol.Feature');
/**
 * ShapeType string enums
 */
ol.shape.ShapeType = {
    ARROW: 'Arrow',
    LINEARROW: 'LineArrow',
    RECTANGLE: 'Rectangle',
    FREEHANDLINE: 'FreeHandLine',
    CIRCLE: 'Circle'
};

/**
 * Shapes Foundation Geom Type enum
 */
ol.shape.ShapeBaseGeomTypes = {
	ARROW: 'Polygon',
    LINEARROW: 'LineString',
    RECTANGLE: 'Polygon',
    FREEHANDLINE: 'LineString',
    CIRCLE: 'DrawCircle'
};

/**
 * List of shape features attributes necessary for application wide functionality
 * @type {string enum object}
 */
ol.shape.ShapeAttributes = {
	ROTATION: 'rotation',
	ROTATIONCENTER: 'rotationCenter',
	MANIPULATIONHANDLES: 'manipulationHandles'
}

/***** Base Shape Featuer *****/
ol.shape.ShapeFeature = function(opt_geometryOrProperties) {
	goog.base(this);

	this.shapeType = null; // What is custom shape type: circle, rectangle, line, free line, text
	this.baseShapeType = null; // The foundation base (ol.geom.?) shape type
	this.manipulationConfig = {}; // Stores configuration of Manipulation Behavior/Handlers per shape type

	this.manipulationConfig.showSelectBox = true;
	this.manipulationConfig.showResizeHandles = true;
	this.manipulationConfig.showRotateHandle = true;

	/** values for application specific needs, subject to be stored and retrieved from services **/
	// rotationDegrees = 0;  // To preserve rotation
	// rotationCenter;		 // Current rotation center
}
goog.inherits(ol.shape.ShapeFeature, ol.Feature);

/**
 * Required by ol.interaction.draw while drawing this shape
 * Accepts dragStart and dragEnd coordinates and returns the appropriate geometry calculating
 * Required by ol.interaction.Draw | ol.interaction.DrawWithShapes
 * the shape formation based on these coordinates
 * @type {ol.geom.*}
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
 * @type {[type]}
 */
ol.shape.ShapeFeature.prototype.drawingCompleted = goog.nullFunction;

/**
 * Returns the array of manipulation handles that should be displayed by manipulation managers
 * @type {Array <ol.Feature>}
 */
ol.shape.ShapeFeature.prototype.getManipulationHandles = function() {
	return [];
}

/**
 * defines the handlers when manipulation handles are dragged
 */
ol.shape.ShapeFeature.prototype.manipulaitonHandleDragged = goog.nullFunction;


/***** Polygon Arrow Shape *****/
ol.shape.Arrow = function(opt_geometryOrProperties) {
	goog.base(this);

	this.shapeType = ol.shape.ShapeType.LINEARROW;
	this.baseShapeType = ol.geom.LineString;
}
goog.inherits(ol.shape.Arrow, ol.shape.ShapeFeature);

ol.shape.Arrow.prototype.createSketchFeatureGeometry_ = function(coordinates) {
	return new ol.geom.Polygon(this.getUpdatedSketchFeatureCoordinates_(coordinates));
}

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
}

ol.shape.Arrow.prototype.getSketchPoint_ = function(coordinate) {
	return new ol.Feature(new ol.geom.Point(coordinate))
}

ol.shape.Arrow.prototype.createNewSketchFeature_ = function() {
	return new ol.shape.Arrow();
}


/***** Line Arrow Shape *****/
ol.shape.LineArrow = function(opt_geometryOrProperties) {
	goog.base(this);

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
	}

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
	}

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
}
goog.inherits(ol.shape.LineArrow, ol.shape.ShapeFeature);

ol.shape.LineArrow.prototype.createSketchFeatureGeometry_ = function(coordinates) {
	return new ol.geom.LineString(this.getUpdatedSketchFeatureCoordinates_(coordinates));
}

ol.shape.LineArrow.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
	goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
    var startX = coordinates[0][0][0],
        startY = coordinates[0][0][1],
        endX = coordinates[0][coordinates[0].length-1][0],
        endY = coordinates[0][coordinates[0].length-1][1],
        angleDegrees = goog.math.angle(startX, startY, endX, endY) - 90;

    return this.getFormedShapeCoordinates_(startX, startY, endX, endY, angleDegrees, 10);
}

ol.shape.LineArrow.prototype.getSketchPoint_ = function(coordinate) {
	return new ol.Feature(new ol.geom.Point(coordinate))
}

ol.shape.LineArrow.prototype.createNewSketchFeature_ = function() {
	return new ol.shape.LineArrow();
}

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
}

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
}

ol.shape.LineArrow.prototype.updateFeatureAngle_ = function(startX, startY, endX, endY, feature) {
	var feature = feature || this,
		angleDegrees = goog.math.angle(startX, startY, endX, endY);
	
	feature.set('rotationDegrees', angleDegrees);
	feature.set('rotationCenter', [startX, startY]);
}

ol.shape.LineArrow.prototype.manipulateShape_ = function(startX, startY, endX, endY, angleDegreesOffset, earsLength) {
	this.getGeometry().setCoordinates(this.getFormedShapeCoordinates_(startX, startY, endX, endY, angleDegreesOffset, earsLength));
	this.updateFeatureAngle_(startX, startY, endX, endY, this);
}



/***** Polygon Rectangle Shape *****/
ol.shape.Rectangle = function(opt_geometryOrProperties) {
	goog.base(this);

	this.shapeType = ol.shape.ShapeType.RECTANGLE;
	this.baseShapeType = ol.geom.Polygon;
}
goog.inherits(ol.shape.Rectangle, ol.shape.ShapeFeature);

ol.shape.Rectangle.prototype.createSketchFeatureGeometry_ = function(coordinates) {
	return new ol.geom.Polygon(this.getUpdatedSketchFeatureCoordinates_(coordinates));
}

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
}

ol.shape.Rectangle.prototype.getSketchPoint_ = function(coordinate) {
	return new ol.Feature(new ol.geom.Point(coordinate))
}

ol.shape.Rectangle.prototype.createNewSketchFeature_ = function() {
	return new ol.shape.Rectangle();
}


/***** Free Hand Line Shape *****/
ol.shape.FreeHandLine = function(opt_geometryOrProperties) {
	goog.base(this);

	this.shapeType = ol.shape.ShapeType.FREEHANDLINE;
	this.baseShapeType = ol.geom.LineString;

	this.previousDrawingCoordinates_ = null; // used where a track of old drawing geometry coordinates is necessary
}
goog.inherits(ol.shape.FreeHandLine, ol.shape.ShapeFeature);

ol.shape.FreeHandLine.prototype.createSketchFeatureGeometry_ = function(coordinates) {
	return new ol.geom.LineString(this.getUpdatedSketchFeatureCoordinates_(coordinates));
}

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
}

ol.shape.FreeHandLine.prototype.getSketchPoint_ = function(coordinate) {
	return new ol.Feature(new ol.geom.Point(coordinate))
}

ol.shape.FreeHandLine.prototype.createNewSketchFeature_ = function() {
	this.previousDrawingCoordinates_  = null;
	return new ol.shape.FreeHandLine();
}


/***** Cricle Shape *****/
ol.shape.Circle = function(opt_geometryOrProperties) {
	goog.base(this);

	this.shapeType = ol.shape.ShapeType.CIRCLE;
	this.baseShapeType = ol.geom.Cricle;
}
goog.inherits(ol.shape.Circle, ol.shape.ShapeFeature);

ol.shape.Circle.prototype.createSketchFeatureGeometry_ = function(coordinates) {
	return new ol.geom.DrawCircle(coordinates);
}

ol.shape.Circle.prototype.getUpdatedSketchFeatureCoordinates_ = function(coordinates) {
	goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
    var startX = coordinates[0][0][0],
        startY = coordinates[0][0][1],
        endX = coordinates[0][coordinates[0].length-1][0],
        endY = coordinates[0][coordinates[0].length-1][1];
    
    // To make the startX,startY the topLeft of the circle, rather than the center, 
    // find the midpoint of line (startX, startY) - (endX, endY)
    
    var dragLineMidpoint = [ (startX + endX)/2, (startY + endY)/2 ],
    	dragLineLength = Math.sqrt( ol.coordinate.squaredDistance([startX, startY], [endX, endY]) ),
    	circleRadius = dragLineLength / 2;

   	// Returning array [circleCenterCoordinate, radius];
    return [dragLineMidpoint, circleRadius];
}

ol.shape.Circle.prototype.getSketchPoint_ = function(coordinate) {
	return new ol.Feature(new ol.geom.Point(coordinate))
}

ol.shape.Circle.prototype.createNewSketchFeature_ = function() {
	return new ol.shape.Circle();
}


/**
 * ShapeType implementation classes enum
 */
ol.shape.ShapeClass = {
    ARROW: ol.shape.Arrow,
    LINEARROW: ol.shape.LineArrow,
    RECTANGLE: ol.shape.Rectangle,
    FREEHANDLINE: ol.shape.FreeHandLine,
    CIRCLE: ol.shape.Circle
};