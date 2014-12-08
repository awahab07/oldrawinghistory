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
	RESIZEBOX: "ResizeBox"
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

  	this.createScaleRectangleForFeature_ = function(coordinate) {
  		var scaleRectangeCoordinates = [[
  			[ coordinate[0] - this.scaleRectangleSize_, coordinate[1] - this.scaleRectangleSize_ ],
  			[ coordinate[0] - this.scaleRectangleSize_, coordinate[1] + this.scaleRectangleSize_ ],
  			[ coordinate[0] + this.scaleRectangleSize_, coordinate[1] + this.scaleRectangleSize_ ],
  			[ coordinate[0] + this.scaleRectangleSize_, coordinate[1] - this.scaleRectangleSize_ ]
  		]];

      var scaleRactange = new ol.geom.Polygon(scaleRectangeCoordinates, ol.geom.GeometryLayout.XY),
          scaleRactangeFeature = new ol.Feature({geometry: scaleRactange});
      scaleRactangeFeature.setStyle(this.handlesStyle_);

      scaleRactangeFeature.isHandleFeature = true; // Indication that feature is a manipulation handle
      scaleRactangeFeature.cursorStyle = "ew-resize";
      
      return scaleRactangeFeature;
  	}


    this.displayScaleHandlersForFeature = function(feature) {
      goog.asserts.assertInstanceof(feature.selectBoxRectangle_, ol.Feature);
      var selectBoxCoordinates = feature.selectBoxRectangle_.getGeometry().getCoordinates();
      
      feature.bottomLeftScaleHandle = this.createScaleRectangleForFeature_(selectBoxCoordinates[0][0]),
      
      feature.middleLeftScaleHandle = this.createScaleRectangleForFeature_([ selectBoxCoordinates[0][1][0], selectBoxCoordinates[0][1][1] - feature.selectBoxRectangle_.manipulationHeight/2 ]),
      feature.topLeftScaleHandle = this.createScaleRectangleForFeature_(selectBoxCoordinates[0][1]),
      
      feature.middleTopScaleHandle = this.createScaleRectangleForFeature_([ selectBoxCoordinates[0][2][0] - feature.selectBoxRectangle_.manipulationWidth/2, selectBoxCoordinates[0][2][1] ]),
      feature.topRightScaleHandle = this.createScaleRectangleForFeature_(selectBoxCoordinates[0][2]),

      feature.middleRightScaleHandle = this.createScaleRectangleForFeature_([ selectBoxCoordinates[0][2][0], selectBoxCoordinates[0][2][1] - feature.selectBoxRectangle_.manipulationHeight/2 ]),
      feature.bottomRightScaleHandle = this.createScaleRectangleForFeature_(selectBoxCoordinates[0][3]),

      feature.middleBottomScaleHandle = this.createScaleRectangleForFeature_([ selectBoxCoordinates[0][3][0] - feature.selectBoxRectangle_.manipulationWidth/2, selectBoxCoordinates[0][3][1] ]);

      this.handlersLayer.getSource().addFeature(feature.middleLeftScaleHandle);
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