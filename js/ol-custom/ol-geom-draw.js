/**
 * Implementation of geometries needed for drawing (ol.interaction.Draw) functionality
 * Provides geometries compatible with routines used to get/set coordinates inside ol.interaction.draw
 */

goog.provide('ol.geom.draw');
goog.provide('ol.geom.DrawCircle');

ol.geom.DrawCircle = function(coordinates, opt_layout) {
	if(!coordinates) {
		coordinates = [];
	}
	
	var center = coordinates[0],
		opt_radius = coordinates[1];
	
	goog.base(this, center, opt_radius, opt_layout);
}
goog.inherits(ol.geom.DrawCircle, ol.geom.Circle);

/**
 * Method to provide interface for setCoordinate as Polygon, LineString provides
 * Needed to have a Circle geometry that is drawable by ol.interaction.Draw
 * @param  {[ol.Coordinate, radius]} coordinates Custom structure that contains center coordinate and radius
 */
ol.geom.DrawCircle.prototype.setCoordinates = function(coordinates) {
	var center = coordinates[0],
		radius = coordinates[1];

	this.setCenter(center);
	this.setRadius(radius);
}

/**
 * Method to provide interface for getCoordinate as Polygon, LineString provides needed for ol.interaction.Draw
 * @return {[ol.Coordinate, radius]} coordinates Custom structure that contains center coordinate and radius
 */
ol.geom.DrawCircle.prototype.getCoordinates = function() {
	return [this.getCenter(), this.getRadius()];
}