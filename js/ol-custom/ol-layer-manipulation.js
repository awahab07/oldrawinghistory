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
	RESIZEHANDLE: "ResizeHandle"
}

ol.layer.Manipulation = function(opt_options) {
	if(!goog.isDef(opt_options))
		opt_options = {};

	goog.base(this);

	this.scaleRectangleSize_ = opt_options.scaleRectangleSize || 5,
	this.handlesStyle_ = opt_options.scaleRectangleStyle || new ol.style.Style({
		fill: new ol.style.Fill({color: '#FFF'}),
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

  	this.createScaleRectangleForFeature_ = function(manipulatingFeature, coordinate, resizesX, resizesY, cursorStyle, referenceExtentCoordinate, signXChange, signYChange) {
		var scaleRectangeCoordinates = [[
			[ coordinate[0] - this.scaleRectangleSize_, coordinate[1] - this.scaleRectangleSize_ ],
			[ coordinate[0] - this.scaleRectangleSize_, coordinate[1] + this.scaleRectangleSize_ ],
			[ coordinate[0] + this.scaleRectangleSize_, coordinate[1] + this.scaleRectangleSize_ ],
			[ coordinate[0] + this.scaleRectangleSize_, coordinate[1] - this.scaleRectangleSize_ ]
		]];

		var scaleRactange = new ol.geom.Polygon(scaleRectangeCoordinates, ol.geom.GeometryLayout.XY),
			scaleRactangeFeature = new ol.Feature({geometry: scaleRactange});
		
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
      
    	return scaleRactangeFeature;
  	}


    this.displayScaleHandlersForFeature = function(feature) {
		goog.asserts.assertInstanceof(feature.selectBoxRectangle_, ol.Feature);
		var selectBoxCoordinates = feature.selectBoxRectangle_.getGeometry().getCoordinates();

		feature.resizeHandleFeatures_ = [
			this.createScaleRectangleForFeature_(feature, selectBoxCoordinates[0][0], true, true, "nesw-resize", [2, 3], 1, -1),

			this.createScaleRectangleForFeature_(feature, 
				[ selectBoxCoordinates[0][1][0], selectBoxCoordinates[0][1][1] - feature.selectBoxRectangle_.manipulationHeight/2 ],
				true, false, "ew-resize", [2, 3], 1, 1),

			this.createScaleRectangleForFeature_(feature, selectBoxCoordinates[0][1], true, true, "nwse-resize", [2, 1], 1, 1),

			this.createScaleRectangleForFeature_(feature, 
				[ selectBoxCoordinates[0][2][0] - feature.selectBoxRectangle_.manipulationWidth/2, selectBoxCoordinates[0][2][1] ],
				false, true, "ns-resize", [0, 1], 1, 1),

			this.createScaleRectangleForFeature_(feature, selectBoxCoordinates[0][2], true, true, "nesw-resize", [0, 1], -1, 1),

			this.createScaleRectangleForFeature_(feature, 
				[ selectBoxCoordinates[0][2][0], selectBoxCoordinates[0][2][1] - feature.selectBoxRectangle_.manipulationHeight/2 ],
				true, false, "ew-resize", [0, 1], -1, 1),

			this.createScaleRectangleForFeature_(feature, selectBoxCoordinates[0][3], true, true, "nwse-resize", [0, 3], -1, -1),

			this.createScaleRectangleForFeature_(feature, 
				[ selectBoxCoordinates[0][3][0] - feature.selectBoxRectangle_.manipulationWidth/2, selectBoxCoordinates[0][3][1] ],
				false, true, "ns-resize", [0, 3], 1, -1)
		];
		
		this.handlersLayer.getSource().addFeatures(feature.resizeHandleFeatures_);
    }

    this.handleDragged = function(map, handleFeature, fromPx, toPx) {
    	if( goog.isDef(handleFeature.handleType) && handleFeature.handleType === ol.ManipulationFeatureType.RESIZEHANDLE ) {
    		var shapeFeature = handleFeature.manipulatingFeature_,
    			shapeFeatureExtent = shapeFeature.getGeometry().getExtent(),
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
console.log("scaleX", scaleX, "scaleY", scaleY, "pos", positionReferenceCoordinate, "upd", updatedPositionReferenceCoordinate, "disX", displacementX, "disY", displacementY);
    		var scaledShapeCoordinates = shapeFeature.getGeometry().getCoordinates().map(function(coordinate) {
    			return [coordinate[0] * scaleX + displacementX, coordinate[1] * scaleY + displacementY];
    		});

    		// Scaling shape feature
    		shapeFeature.getGeometry().setCoordinates(scaledShapeCoordinates);

    		// Translating shape feature to Reference Position
    		// var updatedSahpeFeatureExtent = shapeFeature.getGeometry().getExtent();
    		// var updatedPositionReferenceCoordinate = [ updatedSahpeFeatureExtent[handleFeature.referenceExtentCoordinate_[0]], updatedSahpeFeatureExtent[handleFeature.referenceExtentCoordinate_[1]] ];
    		// this.translateFeature_(map, shapeFeature, updatedPositionReferenceCoordinate, positionReferenceCoordinate);
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
          selectPolygonCoordinates = [[
            [ extentCoordinates[0], extentCoordinates[1] ],
            [ extentCoordinates[0], extentCoordinates[3] ],
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