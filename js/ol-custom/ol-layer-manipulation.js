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
        
        this.shape_ = shapeFeature;
        this.shapeOriginalGeometry_ = shapeFeature.getGeometry().clone();
        
        this.displaySelectBoxForFeature();
        this.displayResizeHandlesForFeature();
        this.displayRotateHandleForFeature();
    }

    this.shapeUnSelected = function() {
        this.shape_ = null;
        this.shapeOriginalGeometry_ = null;

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
            shapeFeatureExtent = this.shapeOriginalGeometry_.getExtent(),
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

        var rotatedShapeCoordinates = handleFeature.manipulatingFeatureOriginalGeometry_.getCoordinates().map(function(coordinate) {
            var mathCoordinate = manipulationLayer.olCoordToMathCoord_(coordinate);
            mathCoordinate.rotateDegrees(differenceAngleDegrees, mathCenter);
            return manipulationLayer.mathCoordToOLCoord_(mathCoordinate);
        });

        // Rotating shape feature
        this.shape_.getGeometry().setCoordinates(rotatedShapeCoordinates);

        // Updating attribute to preserve rotation
        this.shape_.set('rotation', differenceAngleDegrees);
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
		var selectBoxCoordinates = feature.selectBoxRectangle_.getGeometry().getCoordinates();

		feature.resizeHandleFeatures_ = [
			this.createResizeHandleForFeature_(feature, selectBoxCoordinates[0][0], true, true, "nesw-resize", [2, 3], 1, 1),

			this.createResizeHandleForFeature_(feature, 
				[ selectBoxCoordinates[0][1][0], selectBoxCoordinates[0][1][1] - feature.selectBoxRectangle_.manipulationHeight/2 ],
				true, false, "ew-resize", [2, 3], 1, -1),

			this.createResizeHandleForFeature_(feature, selectBoxCoordinates[0][1], true, true, "nwse-resize", [2, 1], 1, -1),

			this.createResizeHandleForFeature_(feature, 
				[ selectBoxCoordinates[0][5][0] - feature.selectBoxRectangle_.manipulationWidth/2, selectBoxCoordinates[0][5][1] ],
				false, true, "ns-resize", [0, 1], 1, -1),

			this.createResizeHandleForFeature_(feature, selectBoxCoordinates[0][5], true, true, "nesw-resize", [0, 1], -1, -1),

			this.createResizeHandleForFeature_(feature, 
				[ selectBoxCoordinates[0][5][0], selectBoxCoordinates[0][5][1] - feature.selectBoxRectangle_.manipulationHeight/2 ],
				true, false, "ew-resize", [0, 1], -1, -1),

			this.createResizeHandleForFeature_(feature, selectBoxCoordinates[0][6], true, true, "nwse-resize", [0, 3], -1, 1),

			this.createResizeHandleForFeature_(feature, 
				[ selectBoxCoordinates[0][6][0] - feature.selectBoxRectangle_.manipulationWidth/2, selectBoxCoordinates[0][6][1] ],
				false, true, "ns-resize", [0, 3], 1, 1)
		];
		
		this.handlesLayer.getSource().addFeatures(feature.resizeHandleFeatures_);
    }

    this.resizeHandleDragged_ = function(map, handleFeature, fromPx, toPx) {
        var shapeFeatureExtent = this.shapeOriginalGeometry_.getExtent(),
            shapeFeatureWidth = shapeFeatureExtent[2] - shapeFeatureExtent[0],
            shapeFeatureHeight = shapeFeatureExtent[3] - shapeFeatureExtent[1],
            fromCoordinate = map.getCoordinateFromPixel(fromPx),
            toCoordinate = map.getCoordinateFromPixel(toPx),
            dragXDistance = handleFeature.signXChange_ * (toCoordinate[0] - fromCoordinate[0]),
            dragYDistance = handleFeature.signYChange_ * (toCoordinate[1] - fromCoordinate[1]),
            scaleX = handleFeature.resizesX_ ? (1 - dragXDistance / shapeFeatureWidth): 1,
            scaleY = handleFeature.resizesY_ ? (1 - dragYDistance / shapeFeatureHeight): 1,
            positionReferenceCoordinate = [ (shapeFeatureExtent[handleFeature.referenceExtentCoordinate_[0]]), (shapeFeatureExtent[handleFeature.referenceExtentCoordinate_[1]]) ],
            updatedPositionReferenceCoordinate = [(positionReferenceCoordinate[0] * scaleX), (positionReferenceCoordinate[1] * scaleY)],
            displacementX = positionReferenceCoordinate[0] - updatedPositionReferenceCoordinate[0],
            displacementY = positionReferenceCoordinate[1] - updatedPositionReferenceCoordinate[1];

        var scaledShapeCoordinates = handleFeature.manipulatingFeatureOriginalGeometry_.getCoordinates().map(function(coordinate) {
            return [coordinate[0] * scaleX + displacementX, coordinate[1] * scaleY + displacementY];
        });

        // Scaling shape feature
        this.shape_.getGeometry().setCoordinates(scaledShapeCoordinates);
    }

    this.handleDragged = function(map, handleFeature, fromPx, toPx) {
    	if( goog.isDef(handleFeature.handleType) && handleFeature.handleType === ol.ManipulationFeatureType.RESIZEHANDLE ) {
    		this.resizeHandleDragged_(map, handleFeature, fromPx, toPx);
    	}

        if( goog.isDef(handleFeature.handleType) && handleFeature.handleType === ol.ManipulationFeatureType.ROTATEHANDLE ) {
            this.rotateHandleDragged_(map, handleFeature, fromPx, toPx);
        }
    }

    this.shapeDragged = function(map, handleFeature, fromPx, toPx) {
        this.translateFeature_(map, handleFeature, fromPx, toPx);
    }

    this.olCoordToMathCoord_ = function(olCoordinate) {
        return new goog.math.Coordinate(olCoordinate[0], olCoordinate[1]);
    }

    this.mathCoordToOLCoord_ = function(mathCoordinate) {
        return [mathCoordinate.x, mathCoordinate.y];
    }    

    this.translateFeature_ = function(map, feature, fromPx, toPx) {
        var interaction = this,
            fromCoordinate = map.getCoordinateFromPixel(fromPx),
            toCoordinate = map.getCoordinateFromPixel(toPx);
        var differenceMathCoordinate = goog.math.Coordinate.difference(this.olCoordToMathCoord_(toCoordinate), this.olCoordToMathCoord_(fromCoordinate));

        var coordinates = feature.getGeometry().getCoordinates();
        if(goog.isDef(coordinates[0][0])) {
            if(goog.isDef(coordinates[0][0][0])) {
                coordinates = [ goog.array.map(coordinates[0], function(olCoordinate) {
                    var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                    return [translatedMathCoordinate.x, translatedMathCoordinate.y];
                }, this) ];
            } else {
                coordinates = goog.array.map(coordinates, function(olCoordinate) {
                    var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                    return [translatedMathCoordinate.x, translatedMathCoordinate.y];
                }, this);
            }
            
        } else {
            coordinates = goog.array.map([coordinates], function(olCoordinate) {
                var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                return [translatedMathCoordinate.x, translatedMathCoordinate.y];
            }, this)[0];
        }
        
        feature.getGeometry().setCoordinates(coordinates);
    }

	/**
     * getSelectBoxFeature_ returns a feature to display a dashed rectangle around the extent of the selected
     * feature to depict the feature is selected and can be moved by dragging
     * @param  {ol.Feature} feature Fature to use for determining coordinates of SelectBox Polygon (Rectangle)
     * @return {ol.Feature}         new feature that represents the bouding rectangle
     */
    this.createSelectBoxFeature_ = function(feature) {
        var extentCoordinates = feature.getGeometry().getExtent(),
            rotateHandlePointX = extentCoordinates[0] + (extentCoordinates[2] - extentCoordinates[0]) / 2,
        selectPolygonCoordinates = [[
            [ extentCoordinates[0], extentCoordinates[1] ],
            [ extentCoordinates[0], extentCoordinates[3] ],
            [ rotateHandlePointX, extentCoordinates[3] ], // Rotate Hook
            [ rotateHandlePointX, extentCoordinates[3] + 30 ], // Rotate Hook Handle
            [ rotateHandlePointX, extentCoordinates[3] ], // Rotate Hook
            [ extentCoordinates[2], extentCoordinates[3] ],
            [ extentCoordinates[2], extentCoordinates[1] ]
        ]];
        
        var resizePolygon = new ol.geom.Polygon(selectPolygonCoordinates, ol.geom.GeometryLayout.XY),
          resizeBoxFeature = new ol.Feature({geometry: resizePolygon});

        // Custom identificaiton attributes
        resizeBoxFeature.manipulationType = ol.ManipulationFeatureType.RESIZEBOX;
        resizeBoxFeature.manipulationWidth = extentCoordinates[2] - extentCoordinates[0];
        resizeBoxFeature.manipulationHeight = extentCoordinates[3] - extentCoordinates[1];
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
    	this.getSource().addFeature(this.createSelectBoxFeature_(this.shape_));
    }
}
goog.inherits(ol.layer.Manipulation, ol.layer.Vector);