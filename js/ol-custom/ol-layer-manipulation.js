/**
 * Layer responsible for displaying guide features to manipulate features
 * Features rendered for hints/guides/handles to manipulate features will have higher zIndex to be displayed on top
 * and will specific styles to distinguish them from other features
 *
 * Features drawn on this layer will have specific listeners representing manipulation behavior
 */

goog.provide('ol.layer.Manipulation');
goog.provide('ol.ManipulationFeatureType');

goog.require('ol.layer.Vector');
goog.require('ol.Collection');
goog.require('ol.extent');
goog.require('goog.math.Coordinate');
goog.require('goog.math');



ol.ManipulationFeatureType = {
	RESIZEBOX: "ResizeBox",
	RESIZEHANDLE: "ResizeHandle",
    ROTATEHANDLE: "RotateHandle"
}

ol.layer.Manipulation = function(opt_options) {
	if(!goog.isDef(opt_options))
		opt_options = {};

	goog.base(this);

    // Check if baseLayer is porvided to accomodate baseImage manipulation (Proportion Scale and Move only)
    this.manipulatableBaseLayer_ = opt_options.manipulatableBaseLayer;

    // @TODO make the url dynamic via proper configuration
    this.iconsBaseUrl_ = opt_options.iconsBaseUrl || "js/demo/widget/images/";

    this.rotateHandleSize_ = opt_options.rotateHandleSize_ || 4;
    this.rotateHandleStyle_ = opt_options.rotateHandleStyle || new ol.style.Style({
        image: new ol.style.Circle({
            radius: this.rotateHandleSize_,
            fill: new ol.style.Fill({
                color: '#00ffff'
            }),
            stroke: new ol.style.Stroke({
                color: '#000',
                width: 2
            })
        })
    });

	this.resizeHandleSize_ = opt_options.scaleRectangleSize || 3;
    this.handlesStyle_ = opt_options.resizeHandleStyle || new ol.style.Style({
        image: new ol.style.Circle({
            radius: this.resizeHandleSize_,
            fill: new ol.style.Fill({
                color: '#00f'
            }),
            stroke: new ol.style.Stroke({
                color: '#fff',
                width: 1
            })
        })
	});

	this.setStyle(new ol.style.Style({
		fill: new ol.style.Fill({color: 'transparent'}),
		stroke: new ol.style.Stroke({
			color: '#0000FF',
			width: 0.5,
			lineDash: [4, 4]
		})
	}));

	this.setSource(new ol.source.Vector());
	this.isManipulationLayer = true; // Indicator that this layer is used for manipulation

	// Separate layer for displaying manipulation handles (scale/resize, rotate)
	this.handlesLayer = new ol.layer.Vector({
		source: new ol.source.Vector(),
		style: this.handlesStyle_
	});
	
	this.handlesLayer.isHandlesLayer = true; // Indicator that this layer is used to display manipulation handles
    
    this.shape_ = null; // Reference to manipulating shape
    this.shapeOriginalGeometry_ = null; // To keep record of geometry of feature before manipulation

    this.shapeSelectedForManipulation = function(shapeFeature) {
        this.shapeUnSelected();
        
        if(goog.isNull(shapeFeature))
            return false;

        this.shape_ = shapeFeature;
        this.shapeOriginalGeometry_ = shapeFeature.getGeometry().clone();
        
        // Initialize state trackers
        if( !shapeFeature.get('rotationDegrees') ) {
            shapeFeature.set('rotationDegrees', 0);
        }

        if( !shapeFeature.get('rotationDegreesCurrentDrag') ) {
            shapeFeature.set('rotationDegreesCurrentDrag', 0);
        }

        this.displaySelectBoxForFeature();
        this.displayResizeHandlesForFeature();
        this.displayRotateHandleForFeature();
    }

    /**
     * Called by ol.layer.manipulate when dragging is done upon Pointer Up event
     * @param  {ol.Feature} shapeOrHandleFeature For "move" refers to shapeFeature, for rotation or scale refers to manipulationFeature
     */
    this.draggingDone = function(shapeOrHandleFeature) {
        var shapeFeature = goog.isDef(shapeOrHandleFeature.isHandleFeature) && shapeOrHandleFeature.isHandleFeature ? shapeOrHandleFeature.manipulatingFeature_ : shapeOrHandleFeature;
        this.shapeOriginalGeometry_ = shapeFeature.getGeometry().clone();

        // Preserving accumulative rotation
        if(shapeOrHandleFeature.handleType && shapeOrHandleFeature.handleType == ol.ManipulationFeatureType.ROTATEHANDLE) {
            shapeFeature.set('rotationDegrees', this.getAccumulativeRotationForFeature_(shapeFeature));
            shapeFeature.set('rotationDegreesCurrentDrag', 0);
        }
    }

    this.shapeManipulated = function(shapeFeature) {
        this.clearManipulationFeatures();
        this.displayManipulationFeatures();
    }

    this.shapeUnSelected = function() {
        this.shape_ = null;
        this.shapeOriginalGeometry_ = null;

        this.clearManipulationFeatures();
    }

    this.displayManipulationFeatures = function() {
        this.displaySelectBoxForFeature();
        this.displayResizeHandlesForFeature();
        this.displayRotateHandleForFeature();
    }

    this.clearManipulationFeatures = function() {
        this.getSource().clear();
        this.handlesLayer.getSource().clear();
    }

    this.createRotateHandleForFeature_ = function(feature, cursorImageUrl) {
        goog.asserts.assertInstanceof(feature.selectBoxRectangle_, ol.Feature);
        var selectBoxCoordinates = feature.selectBoxRectangle_.getGeometry().getCoordinates(),
            //rotateHandleCoordinate = [ selectBoxCoordinates[0][5][0]+20, selectBoxCoordinates[0][5][1] + (selectBoxCoordinates[0][6][1] - selectBoxCoordinates[0][5][1] )/2 ],
            rotateHandleCoordinate = selectBoxCoordinates[0][3],
            rotatePoint = new ol.geom.Point(rotateHandleCoordinate, ol.geom.GeometryLayout.XY),
            rotateHandleFeature = new ol.Feature({geometry: rotatePoint});
        
        rotateHandleFeature.setStyle(this.rotateHandleStyle_);

        rotateHandleFeature.isHandleFeature = true;  // Indication that feature is a manipulation handle
        rotateHandleFeature.handleType = ol.ManipulationFeatureType.ROTATEHANDLE;
        rotateHandleFeature.cursorStyle = 'url("'+cursorImageUrl+'") 12 12, auto';
        
        rotateHandleFeature.manipulatingFeature_ = feature;
        rotateHandleFeature.manipulatingFeatureOriginalGeometry_ = feature.getGeometry().clone();
      
        return rotateHandleFeature;
    }

    this.displayRotateHandleForFeature = function() {
        var rotateHandle = this.createRotateHandleForFeature_(this.shape_, this.iconsBaseUrl_ + "rotate.png");
        this.handlesLayer.getSource().addFeature(rotateHandle);
    }

    this.rotateHandleDragged_ = function(map, handleFeature, fromPx, toPx) {
        var manipulationLayer = this,
            shapeFeatureExtent = this.shapeOriginalGeometry_.getExtent(), // @TODO: check error => Uncaught TypeError: Cannot read property 'getExtent' of null
            shapeFeatureCenter = ol.extent.getCenter(shapeFeatureExtent),
            centerCoordinate = map.getCoordinateFromPixel(shapeFeatureCenter),
            fromCoordinate = map.getCoordinateFromPixel(fromPx),
            toCoordinate = map.getCoordinateFromPixel(toPx),
            mathFromPoint = this.olCoordToMathCoord_(fromCoordinate),
            mathToPoint = this.olCoordToMathCoord_(toCoordinate),
            mathCenter = this.olCoordToMathCoord_(shapeFeatureCenter), // Pixel center should not be converted to map coordinate
            dragStartAngleDegrees = goog.math.angle(mathCenter.x, mathCenter.y, mathFromPoint.x, mathFromPoint.y),
            dragEndAngleDegrees = goog.math.angle(mathCenter.x, mathCenter.y, mathToPoint.x, mathToPoint.y),
            differenceAngleDegrees = goog.math.angleDifference(dragStartAngleDegrees, dragEndAngleDegrees);

        this.shape_.setGeometry( this.rotateGeometryAroundCoordinate_(this.shapeOriginalGeometry_.clone(), shapeFeatureCenter, differenceAngleDegrees) );

        // Updating attribute to preserve rotation
        //var shapeCummulativeAngleDegrees = goog.math.angleDifference( 360, (this.shape_.get('rotationDegrees') || 0) + differenceAngleDegrees );
        //console.log("differenceAngleDegrees:", differenceAngleDegrees, "getRot", this.shape_.get('rotationDegrees'), "shapeCummulativeAngleDegrees", shapeCummulativeAngleDegrees);
        this.shape_.set('rotationDegreesCurrentDrag', differenceAngleDegrees);
        this.shape_.set('rotationCenter', shapeFeatureCenter);
    }

    this.createResizeHandleForFeature_ = function(manipulatingFeature, coordinate, resizesX, resizesY, cursorStyle, referenceExtentCoordinate, signXChange, signYChange) {
		var resizeHandlePoint = new ol.geom.Point(coordinate, ol.geom.GeometryLayout.XY),
			resizeHandleFeature = new ol.Feature({geometry: resizeHandlePoint});
		
		resizeHandleFeature.setStyle(this.handlesStyle_);

		resizeHandleFeature.isHandleFeature = true;  // Indication that feature is a manipulation handle
		resizeHandleFeature.handleType = ol.ManipulationFeatureType.RESIZEHANDLE;
		resizeHandleFeature.cursorStyle = cursorStyle;
		
		resizeHandleFeature.resizesX_ = resizesX;
		resizeHandleFeature.resizesY_ = resizesY;
		resizeHandleFeature.signXChange_ = signXChange;
		resizeHandleFeature.signYChange_ = signYChange;
		resizeHandleFeature.referenceExtentCoordinate_ = referenceExtentCoordinate;
		resizeHandleFeature.manipulatingFeature_ = manipulatingFeature;
        resizeHandleFeature.manipulatingFeatureOriginalGeometry_ = manipulatingFeature.getGeometry().clone();
      
    	return resizeHandleFeature;
  	}

    this.displayResizeHandlesForFeature = function() {
        var feature = this.shape_;
		
        goog.asserts.assertInstanceof(feature.selectBoxRectangle_, ol.Feature);
		
        var selectBoxCoordinates = feature.selectBoxRectangle_.getGeometry().getCoordinates(),
            selectBoxExtentCenter = ol.extent.getCenter(feature.selectBoxRectangle_.getGeometry().getExtent()),
            i;

        // Determining directional resize coodinates taking in account the current rotation.
        var rotatedResizeHandleObjs = [
            { handleCoordinate: selectBoxCoordinates[0][0], resizesX: true, resizesY: true, signXChange: 1, signYChange: 1},
            { handleCoordinate: [ ( selectBoxCoordinates[0][0][0] + selectBoxCoordinates[0][1][0] ) / 2, ( selectBoxCoordinates[0][0][1] + selectBoxCoordinates[0][1][1] ) / 2 ], resizesX: true, resizesY: false, signXChange: 1, signYChange: -1},
            { handleCoordinate: selectBoxCoordinates[0][1], resizesX: true, resizesY: true, signXChange: 1, signYChange: -1},
            { handleCoordinate: [ ( selectBoxCoordinates[0][1][0] + selectBoxCoordinates[0][5][0] ) / 2, ( selectBoxCoordinates[0][1][1] + selectBoxCoordinates[0][5][1] ) / 2 ], resizesX: false, resizesY: true, signXChange: 1, signYChange: -1},
            { handleCoordinate: selectBoxCoordinates[0][5], resizesX: true, resizesY: true, signXChange: -1, signYChange: -1},
            { handleCoordinate: [ ( selectBoxCoordinates[0][5][0] + selectBoxCoordinates[0][6][0] ) / 2, ( selectBoxCoordinates[0][5][1] + selectBoxCoordinates[0][6][1] ) / 2 ], resizesX: true, resizesY: false, signXChange: -1, signYChange: -1},
            { handleCoordinate: selectBoxCoordinates[0][6], resizesX: true, resizesY: true, signXChange: -1, signYChange: 1},
            { handleCoordinate: [ ( selectBoxCoordinates[0][6][0] + selectBoxCoordinates[0][0][0] ) / 2, ( selectBoxCoordinates[0][6][1] + selectBoxCoordinates[0][0][1] ) / 2 ], resizesX: false, resizesY: true, signXChange: 1, signYChange: 1}
        ];

        // Assigning position reference coordinates
        rotatedResizeHandleObjs[0].positionRefCoord = rotatedResizeHandleObjs[4].handleCoordinate;
        rotatedResizeHandleObjs[1].positionRefCoord = rotatedResizeHandleObjs[5].handleCoordinate;
        rotatedResizeHandleObjs[2].positionRefCoord = rotatedResizeHandleObjs[6].handleCoordinate;
        rotatedResizeHandleObjs[3].positionRefCoord = rotatedResizeHandleObjs[7].handleCoordinate;
        rotatedResizeHandleObjs[4].positionRefCoord = rotatedResizeHandleObjs[0].handleCoordinate;
        rotatedResizeHandleObjs[5].positionRefCoord = rotatedResizeHandleObjs[1].handleCoordinate;
        rotatedResizeHandleObjs[6].positionRefCoord = rotatedResizeHandleObjs[2].handleCoordinate;
        rotatedResizeHandleObjs[7].positionRefCoord = rotatedResizeHandleObjs[3].handleCoordinate;
        
        feature.resizeHandleFeatures_ = [];

        for( i=0; i < rotatedResizeHandleObjs.length; i++ ) {
            var handlePropertiesObject = rotatedResizeHandleObjs[i],
                rotatedCoordinate = handlePropertiesObject.handleCoordinate,
                resizeHandleAngle = goog.math.angle(selectBoxExtentCenter[0], selectBoxExtentCenter[1], rotatedCoordinate[0], rotatedCoordinate[1]),
                cursorStyle = "";


            // Around 225 Degrees
            if(resizeHandleAngle <= 247.5 && resizeHandleAngle > 202.4)
                cursorStyle = "nesw-resize";

            // Around 180 Degrees
            if(resizeHandleAngle <= 202.5 && resizeHandleAngle > 157.5)
                cursorStyle = "ew-resize";

            // Around 135 Degrees
            if(resizeHandleAngle <= 157.5 && resizeHandleAngle > 112.5)
                cursorStyle = "nwse-resize";

            // Around 90 Degrees
            if(resizeHandleAngle <= 112.5 && resizeHandleAngle > 67.5)
                cursorStyle = "ns-resize";

            // Around 45 Degrees
            if(resizeHandleAngle <= 67.5 && resizeHandleAngle > 22.5)
                cursorStyle = "nesw-resize";

            // Around 0 Degrees
            if( (resizeHandleAngle <= 22.5 && resizeHandleAngle > 0) || (resizeHandleAngle <= 360 && resizeHandleAngle > 337.5) )
                cursorStyle = "ew-resize";

            // Around 315 Degrees
            if(resizeHandleAngle <= 337.5 && resizeHandleAngle > 292.5)
                cursorStyle = "nwse-resize";

            // Around 270 Degrees
            if(resizeHandleAngle <= 292.5 && resizeHandleAngle > 247.5)
                cursorStyle = "ns-resize";

            feature.resizeHandleFeatures_.push(this.createResizeHandleForFeature_(feature, rotatedCoordinate, handlePropertiesObject.resizesX, handlePropertiesObject.resizesY, cursorStyle, handlePropertiesObject.positionRefCoord, handlePropertiesObject.signXChange, handlePropertiesObject.signYChange));
        }       

		/*feature.resizeHandleFeatures_ = [
			this.createResizeHandleForFeature_(feature, selectBoxCoordinates[0][0], true, true, "nesw-resize", [2, 3], 1, 1),

			this.createResizeHandleForFeature_(feature, 
				[ ( selectBoxCoordinates[0][0][0] + selectBoxCoordinates[0][1][0] ) / 2, ( selectBoxCoordinates[0][0][1] + selectBoxCoordinates[0][1][1] ) / 2 ],
				true, false, "ew-resize", [2, 3], 1, -1),

			this.createResizeHandleForFeature_(feature, selectBoxCoordinates[0][1], true, true, "nwse-resize", [2, 1], 1, -1),

			this.createResizeHandleForFeature_(feature, 
				[ ( selectBoxCoordinates[0][1][0] + selectBoxCoordinates[0][5][0] ) / 2, ( selectBoxCoordinates[0][1][1] + selectBoxCoordinates[0][5][1] ) / 2 ],
				false, true, "ns-resize", [0, 1], 1, -1),

			this.createResizeHandleForFeature_(feature, selectBoxCoordinates[0][5], true, true, "nesw-resize", [0, 1], -1, -1),

			this.createResizeHandleForFeature_(feature, 
				[ ( selectBoxCoordinates[0][5][0] + selectBoxCoordinates[0][6][0] ) / 2, ( selectBoxCoordinates[0][5][1] + selectBoxCoordinates[0][6][1] ) / 2 ],
				true, false, "ew-resize", [0, 1], -1, -1),

			this.createResizeHandleForFeature_(feature, selectBoxCoordinates[0][6], true, true, "nwse-resize", [0, 3], -1, 1),

			this.createResizeHandleForFeature_(feature, 
				[ ( selectBoxCoordinates[0][6][0] + selectBoxCoordinates[0][0][0] ) / 2, ( selectBoxCoordinates[0][6][1] + selectBoxCoordinates[0][0][1] ) / 2 ],
				false, true, "ns-resize", [0, 3], 1, 1)
		];*/
		
		this.handlesLayer.getSource().addFeatures(feature.resizeHandleFeatures_);
    }

    this.resizeHandleDragged_ = function(map, handleFeature, fromPx, toPx) {
        var unRotatedShapeGeometry = this.shapeOriginalGeometry_.clone();
        if(this.shape_.get('rotationCenter')) {
            unRotatedShapeGeometry = this.rotateGeometryAroundCoordinate_( unRotatedShapeGeometry, this.shape_.get('rotationCenter'), -1 * this.shape_.get('rotationDegrees') );
        }
        


        var shapeFeatureExtent = unRotatedShapeGeometry.getExtent(), //this.shapeOriginalGeometry_.getExtent(), // @TODO: check error => TypeError: this.shapeOriginalGeometry_ is null
            shapeFeatureWidth = shapeFeatureExtent[2] - shapeFeatureExtent[0],
            shapeFeatureHeight = shapeFeatureExtent[3] - shapeFeatureExtent[1],
            fromCoordinate = map.getCoordinateFromPixel(fromPx),
            toCoordinate = map.getCoordinateFromPixel(toPx),
            dragXDistance = handleFeature.signXChange_ * (toCoordinate[0] - fromCoordinate[0]),
            dragYDistance = handleFeature.signYChange_ * (toCoordinate[1] - fromCoordinate[1]),
            scaleX = handleFeature.resizesX_ ? (1 - dragXDistance / shapeFeatureWidth): 1,
            scaleY = handleFeature.resizesY_ ? (1 - dragYDistance / shapeFeatureHeight): 1,
            positionReferenceCoordinate = handleFeature.referenceExtentCoordinate_, //[ (shapeFeatureExtent[handleFeature.referenceExtentCoordinate_[0]]), (shapeFeatureExtent[handleFeature.referenceExtentCoordinate_[1]]) ],
            updatedPositionReferenceCoordinate = [(positionReferenceCoordinate[0] * scaleX), (positionReferenceCoordinate[1] * scaleY)],
            displacementX = positionReferenceCoordinate[0] - updatedPositionReferenceCoordinate[0],
            displacementY = positionReferenceCoordinate[1] - updatedPositionReferenceCoordinate[1];
console.log("shapeFeatureWidth", shapeFeatureWidth, "shapeFeatureHeight", shapeFeatureHeight);

        var shapeCoordinates = this.grabCoordinatesArrayFromGeometry_(this.shapeOriginalGeometry_.clone());
        
        // Un Rotating coordinates if shape is rotated
        if(this.shape_.get('rotationDegrees') && this.shape_.get('rotationCenter')) {
            shapeCoordinates = this.rotateCoordinatesArrayAroundCoordinate_(shapeCoordinates, this.shape_.get('rotationCenter'), -1 * this.shape_.get('rotationDegrees'));
        }
        
        // Scaling/Resizing coordinates
        shapeCoordinates = shapeCoordinates.map(function(coordinate) {
            return [coordinate[0] * scaleX + displacementX, coordinate[1] * scaleY + displacementY];
        });

        // Re Rotating coordinates if shape is rotated
        if(this.shape_.get('rotationDegrees') && this.shape_.get('rotationCenter')) {
            shapeCoordinates = this.rotateCoordinatesArrayAroundCoordinate_(shapeCoordinates, this.shape_.get('rotationCenter'), this.shape_.get('rotationDegrees'));
        }

        shapeCoordinates = this.wrapCoordinatesArrayForGeometry_(this.shape_.getGeometry(), shapeCoordinates);

        // Scaling shape feature
        this.shape_.getGeometry().setCoordinates(shapeCoordinates);
    }

    this.handleDragged = function(map, handleFeature, fromPx, toPx) {
    	if( goog.isDef(handleFeature.handleType) && handleFeature.handleType === ol.ManipulationFeatureType.RESIZEHANDLE ) {
    		this.resizeHandleDragged_(map, handleFeature, fromPx, toPx);
    	}

        if( goog.isDef(handleFeature.handleType) && handleFeature.handleType === ol.ManipulationFeatureType.ROTATEHANDLE ) {
            this.rotateHandleDragged_(map, handleFeature, fromPx, toPx);
        }

        this.shapeManipulated();
    }

    this.shapeDragged = function(map, handleFeature, fromPx, toPx) {
        this.translateFeature_(map, handleFeature, fromPx, toPx);

        this.shapeManipulated();
    }

    this.olCoordToMathCoord_ = function(olCoordinate) {
        return new goog.math.Coordinate(olCoordinate[0], olCoordinate[1]);
    }

    this.mathCoordToOLCoord_ = function(mathCoordinate) {
        return [mathCoordinate.x, mathCoordinate.y];
    }

    this.rotateCoordinatesArrayAroundCoordinate_ = function(coordinates, centerCoordinate, angleDegreesToRotate) {
        var manipulationLayer = this,
            mathCenter = manipulationLayer.olCoordToMathCoord_(centerCoordinate);
        
        coordinates = coordinates.map(function(coordinate) {
            var mathCoordinate = manipulationLayer.olCoordToMathCoord_(coordinate);
            mathCoordinate.rotateDegrees(angleDegreesToRotate, mathCenter);
            return manipulationLayer.mathCoordToOLCoord_(mathCoordinate);
        });

        return coordinates;
    }

    this.rotateGeometryAroundCoordinate_ = function(geometry, centerCoordinate, angleDegreesToRotate) {
        var geometryLayout = geometry.getLayout(),
            rotatedGeometryCoordinates = this.rotateCoordinatesArrayAroundCoordinate_(this.grabCoordinatesArrayFromGeometry_(geometry), centerCoordinate, angleDegreesToRotate);

        rotatedGeometryCoordinates = this.wrapCoordinatesArrayForGeometry_(geometry, rotatedGeometryCoordinates);

        geometry.setCoordinates(rotatedGeometryCoordinates, geometryLayout);
        return geometry;
    }

    this.getAccumulativeRotationForFeature_ = function(shapeFeature) {
        if(!isNaN( shapeFeature.get('rotationDegreesCurrentDrag')) ) {
            return goog.math.angleDifference( 360, shapeFeature.get('rotationDegreesCurrentDrag') + shapeFeature.get('rotationDegrees'));
        } else {
            return shapeFeature.get('rotationDegrees');
        }
    }

    this.rotateFeature_ = function(feature, centerCoordinate, angleDegreesToRotate) {
        feature.setGeometry(this.rotateGeometryAroundCoordinate_(feature.getGeometry(), centerCoordinate, angleDegreesToRotate));
        return feature;
    }

    this.translateFeature_ = function(map, feature, fromPx, toPx) {
        var interaction = this,
            fromCoordinate = map.getCoordinateFromPixel(fromPx),
            toCoordinate = map.getCoordinateFromPixel(toPx);
        var differenceMathCoordinate = goog.math.Coordinate.difference(this.olCoordToMathCoord_(toCoordinate), this.olCoordToMathCoord_(fromCoordinate));

        var coordinates = goog.array.map(this.grabCoordinatesArrayFromGeometry_(feature.getGeometry()), function(olCoordinate) {
            var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
            return [translatedMathCoordinate.x, translatedMathCoordinate.y];
        }, this);

        coordinates = this.wrapCoordinatesArrayForGeometry_(feature.getGeometry(), coordinates);
        
        feature.getGeometry().setCoordinates(coordinates);
    }

    /**
     * This is needed because Point, LineString and Polygons have different array structure of coordinates
     * @param  {ol.geom.Geometry} geometry the geometry to grab coordinates from
     * @return {Array<ol.Coordinate>}          A two dimensional array of coordinates
     */
    this.grabCoordinatesArrayFromGeometry_ = function(geometry) {
        var coordinates = geometry.getCoordinates();
        if(goog.isDef(coordinates[0][0])) {
            if(goog.isDef(coordinates[0][0][0])) {
                return coordinates[0];
            } else {
                return coordinates;
            }
            
        } else {
            return [ coordinates ];
        }
        return null;
    }

    /**
     * This is needed because Point, LineString and Polygons have different array structure of coordinates
     * So when assigned manipulated array of coordinates, the must be transformed into proper structure
     * @param  {ol.geom.Geometry} geometry the geometry to determine the array structure
     * @param {Array<ol.Coordinate>} coordinates The coordintes to wrap to
     * @return {Array}          array of ol.Coordinate of appropriate dimensions
     */
    this.wrapCoordinatesArrayForGeometry_ = function(geometry, coordinates) {
        var coordinateStructure = geometry.getCoordinates();
        if(goog.isDef(coordinateStructure[0][0])) {
            if(goog.isDef(coordinateStructure[0][0][0])) {
                return [ coordinates ];
            } else {
                return coordinates;
            }
            
        } else {
            return coordinates[0];
        }
        return null;
    }

	/**
     * createSelectBoxFeature_ returns a feature to display a dashed rectangle around the extent of the selected
     * feature to depict the feature is selected and can be moved by dragging
     * @param  {ol.Feature} feature Feature to use for determining coordinates of SelectBox Polygon (Rectangle)
     * @return {ol.Feature}         new feature that represents the bouding rectangle
     */
    this.createSelectBoxFeature_ = function(feature) {
        var geometry = feature.getGeometry().clone();
        if(feature.get('rotationCenter')) {
            var rotatedAngle = goog.math.angleDifference( 360, feature.get('rotationDegreesCurrentDrag') + feature.get('rotationDegrees'));
            geometry = this.rotateGeometryAroundCoordinate_( geometry, feature.get('rotationCenter'), -1 * rotatedAngle );
        }
        
        var unRotatedFeatureExtent = geometry.getExtent(),
            rotateHandlePointX = unRotatedFeatureExtent[0] + (unRotatedFeatureExtent[2] - unRotatedFeatureExtent[0]) / 2,
        selectPolygonCoordinates = [[
            [ unRotatedFeatureExtent[0], unRotatedFeatureExtent[1] ],
            [ unRotatedFeatureExtent[0], unRotatedFeatureExtent[3] ],
            [ rotateHandlePointX, unRotatedFeatureExtent[3] ], // Rotate Hook
            [ rotateHandlePointX, unRotatedFeatureExtent[3] + 30 ], // Rotate Hook Handle
            [ rotateHandlePointX, unRotatedFeatureExtent[3] ], // Rotate Hook
            [ unRotatedFeatureExtent[2], unRotatedFeatureExtent[3] ],
            [ unRotatedFeatureExtent[2], unRotatedFeatureExtent[1] ]
        ]];
        
        var resizePolygon = new ol.geom.Polygon(selectPolygonCoordinates, ol.geom.GeometryLayout.XY),
          resizeBoxFeature = new ol.Feature({geometry: resizePolygon});

        // Custom identificaiton attributes
        resizeBoxFeature.manipulationType = ol.ManipulationFeatureType.RESIZEBOX;
        resizeBoxFeature.manipulationWidth = unRotatedFeatureExtent[2] - unRotatedFeatureExtent[0];
        resizeBoxFeature.manipulationHeight = unRotatedFeatureExtent[3] - unRotatedFeatureExtent[1];
        resizeBoxFeature.manipulatingFeature_ = feature;
        feature.selectBoxRectangle_ = resizeBoxFeature;

        return resizeBoxFeature;
    }

    this.removeSelectBoxForFeature = function(feature) {
    	var manipulationFeatureCollection = new ol.Collection();
    	this.getSource().forEachFeature(function(manipulationFeature) {
    		if (manipulationFeature.manipulationType === ol.ManipulationFeatureType.RESIZEBOX &&
    			manipulationFeature.manipulatingFeature_ === feature) {
    			this.push(manipulationFeature);
    		}
    	}, manipulationFeatureCollection);

    	manipulationFeatureCollection.forEach(function(manipulationFeature) {
    		this.getSource().removeFeature(manipulationFeature);
    	}, this);

    	manipulationFeatureCollection.dispose();
    }

    this.updateSelectBoxForFeature = function(feature) {
    	this.removeSelectBoxForFeature(feature);
    	this.displaySelectBoxForFeature(feature);
    }

    this.displaySelectBoxForFeature = function() {
        var selectBoxFeature = this.createSelectBoxFeature_(this.shape_);
        if(this.shape_.get('rotationCenter')) {
            this.rotateFeature_(selectBoxFeature, this.shape_.get('rotationCenter'), this.getAccumulativeRotationForFeature_(this.shape_));
        }
    	
        this.getSource().addFeature(selectBoxFeature);
    }

    this.showOrHideBaseLayerManipulationHandles = function(mapBrowserEvent) {
        var baseLayer = this.manipulatableBaseLayer_;
        if(baseLayer) {
            baseLayer.once("precompose", function(evt) {
                var layerObj = evt.frameState.layerRef;
                if(layerObj) {
                    layerObj.modifyImageTransform = function(imageTransform) {
                        
                        if(!baseLayer.transformFactor)
                            baseLayer.transformFactor = 1;
                        

                        if(baseLayer.transformFactor >= 0.5) {
                            imageTransform[0] *= baseLayer.transformFactor;
                            imageTransform[5] *= baseLayer.transformFactor;
                        } else {
                            imageTransform[0] *= 0.5;
                            imageTransform[5] *= 0.5;
                        }

                        baseLayer.transformFactor -= 0.005;

                        return imageTransform;
                    }
                }
            }, this);

            baseLayer.once("postcompose", function(evt) {
                baseLayer.currentExtent_ = evt.frameState.extent;
            }, this);

            /*if(baseLayer.currentExtent_) {
                var baseLayerResizeHandleCoords = [[
                    [baseLayer.currentExtent_[2], baseLayer.currentExtent_[1]], [baseLayer.currentExtent_[2]-5, baseLayer.currentExtent_[1]], [baseLayer.currentExtent_[2], baseLayer.currentExtent_[1] + 5], [baseLayer.currentExtent_[2], baseLayer.currentExtent_[1]]
                    //[50, 50], [100, 100], [200, 50], [50, 50]
                ]];

                var baseLayerResizeHandleFeature = new ol.Feature({
                    geometry: new ol.geom.Polygon(baseLayerResizeHandleCoords)
                });

                baseLayerResizeHandleFeature.setStyle(new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: "rgba(220, 150, 20, 0.8)"
                    })
                }));

                this.getSource().addFeature(baseLayerResizeHandleFeature);
            }*/
        }
    }
}
goog.inherits(ol.layer.Manipulation, ol.layer.Vector);