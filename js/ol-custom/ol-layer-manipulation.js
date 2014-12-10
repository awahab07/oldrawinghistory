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



ol.ManipulationFeatureType = {
	RESIZEBOX: "ResizeBox",
	RESIZEHANDLE: "ResizeHandle",
    ROTATEHANDLE: "RotateHandle"
}

ol.layer.Manipulation = function(opt_options) {
	if(!goog.isDef(opt_options))
		opt_options = {};

	goog.base(this);

    this.rotateHandleSize_ = opt_options.rotateHandleSize_ || 5;
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

	this.resizeHandleSize_ = opt_options.scaleRectangleSize || 5;
    this.handlesStyle_ = opt_options.resizeHandleStyle || new ol.style.Style({
		fill: new ol.style.Fill({color: '#fff'}),
		stroke: new ol.style.Stroke({
		  color: '#000',
		  width: 0.5
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
	this.handlersLayer = new ol.layer.Vector({
		source: new ol.source.Vector(),
		style: this.handlesStyle_
	});
	
	this.handlersLayer.isHandlersLayer = true; // Indicator that this layer is used to display manipulation handlers

    this.createRotateHandleForFeature_ = function(feature, cursorImageUrl) {
        goog.asserts.assertInstanceof(feature.selectBoxRectangle_, ol.Feature);
        var selectBoxCoordinates = feature.selectBoxRectangle_.getGeometry().getCoordinates(),
            rotateHandleCoordinate = selectBoxCoordinates[3];
            rotatePoint = new ol.geom.Point([[rotateHandleCoordinate]], ol.geom.GeometryLayout.XY),
            rotateHandleFeature = new ol.Feature({geometry: rotatePoint});
        
        rotateHandleFeature.setStyle(this.rotateHandleStyle_);

        rotateHandleFeature.isHandleFeature = true;  // Indication that feature is a manipulation handle
        rotateHandleFeature.handleType = ol.ManipulationFeatureType.ROTATEHANDLE;
        rotateHandleFeature.cursorStyle = 'url("'+cursorImageUrl+'") 12 12, auto';
        
        rotateHandleFeature.manipulatingFeature_ = manipulatingFeature;
        rotateHandleFeature.manipulatingFeatureOriginalGeometry_ = manipulatingFeature.getGeometry().clone();
      
        return rotateHandleFeature;
    }

    this.displayRotateHandleForFeature = function(feature) {
        var rotateHandle = this.createRotateHandleForFeature_(feature, "demo/widget/images/rotate.png");
        this.handlersLayer.getSource().addFeature(rotateHandle);
    }

    this.createScaleRectangleForFeature_ = function(manipulatingFeature, coordinate, resizesX, resizesY, cursorStyle, referenceExtentCoordinate, signXChange, signYChange) {
		var scaleRectangeCoordinates = [[
			[ coordinate[0] - this.resizeHandleSize_, coordinate[1] - this.resizeHandleSize_ ],
			[ coordinate[0] - this.resizeHandleSize_, coordinate[1] + this.resizeHandleSize_ ],
			[ coordinate[0] + this.resizeHandleSize_, coordinate[1] + this.resizeHandleSize_ ],
			[ coordinate[0] + this.resizeHandleSize_, coordinate[1] - this.resizeHandleSize_ ]
		]];

		var scaleRactangle = new ol.geom.Polygon(scaleRectangeCoordinates, ol.geom.GeometryLayout.XY),
			scaleRactangeFeature = new ol.Feature({geometry: scaleRactangle});
		
		scaleRactangeFeature.setStyle(this.handlesStyle_);

		scaleRactangeFeature.isHandleFeature = true;  // Indication that feature is a manipulation handle
		scaleRactangeFeature.handleType = ol.ManipulationFeatureType.RESIZEHANDLE;
		scaleRactangeFeature.cursorStyle = cursorStyle;
		
		scaleRactangeFeature.resizesX_ = resizesX;
		scaleRactangeFeature.resizesY_ = resizesY;
		scaleRactangeFeature.signXChange_ = signXChange;
		scaleRactangeFeature.signYChange_ = signYChange;
		scaleRactangeFeature.referenceExtentCoordinate_ = referenceExtentCoordinate;
		scaleRactangeFeature.manipulatingFeature_ = manipulatingFeature;
        scaleRactangeFeature.manipulatingFeatureOriginalGeometry_ = manipulatingFeature.getGeometry().clone();
      
    	return scaleRactangeFeature;
  	}

    this.displayResizeHandlersForFeature = function(feature) {
		goog.asserts.assertInstanceof(feature.selectBoxRectangle_, ol.Feature);
		var selectBoxCoordinates = feature.selectBoxRectangle_.getGeometry().getCoordinates();

		feature.resizeHandleFeatures_ = [
			this.createScaleRectangleForFeature_(feature, selectBoxCoordinates[0][0], true, true, "nesw-resize", [2, 3], 1, -1),

			this.createScaleRectangleForFeature_(feature, 
				[ selectBoxCoordinates[0][1][0], selectBoxCoordinates[0][1][1] - feature.selectBoxRectangle_.manipulationHeight/2 ],
				true, false, "ew-resize", [2, 3], 1, 1),

			this.createScaleRectangleForFeature_(feature, selectBoxCoordinates[0][1], true, true, "nwse-resize", [2, 1], 1, 1),

			this.createScaleRectangleForFeature_(feature, 
				[ selectBoxCoordinates[0][5][0] - feature.selectBoxRectangle_.manipulationWidth/2, selectBoxCoordinates[0][5][1] ],
				false, true, "ns-resize", [0, 1], 1, 1),

			this.createScaleRectangleForFeature_(feature, selectBoxCoordinates[0][5], true, true, "nesw-resize", [0, 1], -1, 1),

			this.createScaleRectangleForFeature_(feature, 
				[ selectBoxCoordinates[0][5][0], selectBoxCoordinates[0][5][1] - feature.selectBoxRectangle_.manipulationHeight/2 ],
				true, false, "ew-resize", [0, 1], -1, 1),

			this.createScaleRectangleForFeature_(feature, selectBoxCoordinates[0][6], true, true, "nwse-resize", [0, 3], -1, -1),

			this.createScaleRectangleForFeature_(feature, 
				[ selectBoxCoordinates[0][6][0] - feature.selectBoxRectangle_.manipulationWidth/2, selectBoxCoordinates[0][6][1] ],
				false, true, "ns-resize", [0, 3], 1, -1)
		];
		
		this.handlersLayer.getSource().addFeatures(feature.resizeHandleFeatures_);
    }

    this.scaleHandleDragged_ = function(map, handleFeature, fromPx, toPx) {
        var shapeFeature = handleFeature.manipulatingFeature_,
            shapeFeatureExtent = handleFeature.manipulatingFeatureOriginalGeometry_.getExtent(),
            shapeFeatureWidth = shapeFeatureExtent[2] - shapeFeatureExtent[0],
            shapeFeatureHeight = shapeFeatureExtent[3] - shapeFeatureExtent[1],
            dragXDistance = handleFeature.signXChange_ * (toPx[0] - fromPx[0]),
            dragYDistance = handleFeature.signYChange_ * (toPx[1] - fromPx[1]),
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
        shapeFeature.getGeometry().setCoordinates(scaledShapeCoordinates);
    }

    this.handleDragged = function(map, handleFeature, fromPx, toPx) {
    	if( goog.isDef(handleFeature.handleType) && handleFeature.handleType === ol.ManipulationFeatureType.RESIZEHANDLE ) {
    		this.scaleHandleDragged_(map, handleFeature, fromPx, toPx);
    	}

        if( goog.isDef(handleFeature.handleType) && handleFeature.handleType === ol.ManipulationFeatureType.ROTATEHANDLE ) {
            this.rotateHandleDragged_(map, handleFeature, fromPx, toPx);
        }
    }

    this.olCoordToMathCoord_ = function(olCoordinate) {
        return new goog.math.Coordinate(olCoordinate[0], olCoordinate[1]);
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

    this.displaySelectBoxForFeature = function(feature) {
    	this.getSource().addFeature(this.createSelectBoxFeature_(feature));
    }
}
goog.inherits(ol.layer.Manipulation, ol.layer.Vector);