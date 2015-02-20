/**
 * Extending ol.Feature into ol.ManipulateFeature to allow the feature to handle manipulation behavior
 * Can be used to preserve/observe custom attributes for drawing or styles needed to accomodate behavior required
 * for the application
 * Also can be extended by specific shapes to define custom manipulation behavior
 */


goog.provide('ol.shape.ShapeType');
goog.provide('ol.shape.ShapeClass');
goog.provide('ol.shape.ShapeBaseGeomTypes');
goog.provide('ol.shape.ShapeFeature');
goog.provide('ol.shape.Arrow');
goog.provide('ol.shape.LineArrow');

goog.require('ol.Feature');

/**
 * ShapeType string enums
 */
ol.shape.ShapeType = {
    ARROW: 'Arrow',
    LINEARROW: 'LineArrow'
};

/**
 * Shapes Foundation Geom Type enum
 */
ol.shape.ShapeBaseGeomTypes = {
	ARROW: 'Polygon',
    LINEARROW: 'LineString'
};


ol.shape.ShapeFeature = function(opt_geometryOrProperties) {
	goog.base(this);

	this.shapeType = null; // What is custom shape type: circle, rectangle, line, free line, text
	this.baseShapeType = null; // The foundation base (ol.geom.?) shape type

	this.rotation = 0;  // To preserve rotation
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




ol.shape.Arrow = function(opt_geometryOrProperties) {
	goog.base(this);

	this.shapeType = ol.shape.ShapeType.ARROW;
	this.baseShapeType = ol.geom.Polygon;
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


ol.shape.LineArrow = function(opt_geometryOrProperties) {
	goog.base(this);

	this.shapeType = ol.shape.ShapeType.LINEARROW;
	this.baseShapeType = ol.geom.LineString;
}
goog.inherits(ol.shape.LineArrow, ol.shape.ShapeFeature);


/**
 * ShapeType implementation classes enum
 */
ol.shape.ShapeClass = {
    ARROW: ol.shape.Arrow,
    LINEARROW: ol.shape.LineArrow
};