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

	this.scaleRectangleSize_ = opt_options.scaleRectangleSize || 5;

	this.selectBoxFeatures_ = new ol.Collection();
	this.isManipulationLayer = true; // Indicator that this layer is used for manipulation

	this.setStyle(new ol.style.Style({
		fill: new ol.style.Fill({color: 'transparent'}),
		stroke: new ol.style.Stroke({
			color: '#0000FF',
			width: 0.5,
			lineDash: [4, 4]
		})
	}));

	this.setSource(new ol.source.Vector());

	this.createteScaleRectangle_(coordinate) {
		var scaleRectangeCoordinates = [[
			[ coordinate[0] - this.scaleRectangleSize_, coordinate[1] - this.scaleRectangleSize_ ],
			[ coordinate[0] - this.scaleRectangleSize_, coordinate[1] + this.scaleRectangleSize_ ],
			[ coordinate[0] + this.scaleRectangleSize_, coordinate[1] + this.scaleRectangleSize_ ],
			[ coordinate[0] + this.scaleRectangleSize_, coordinate[1] - this.scaleRectangleSize_ ]
		]];
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
      resizeBoxFeature.type = ol.ManipulationFeatureType.RESIZEBOX;
      resizeBoxFeature.manipulatingFeature = feature;

      return resizeBoxFeature;
    }

    this.removeSelectBoxForFeature = function(feature) {
    	var manipulationFeatureCollection = new ol.Collection();
    	this.getSource().forEachFeature(function(manipulationFeature) {
    		if (manipulationFeature.type === ol.ManipulationFeatureType.RESIZEBOX &&
    			manipulationFeature.manipulatingFeature === feature) {
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