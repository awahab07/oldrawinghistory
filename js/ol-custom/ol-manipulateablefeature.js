/**
 * Extending ol.Feature into ol.ManipulateFeature to allow the feature to handle manipulation behavior
 */

goog.provide('ol.ManipulateFeature');

goog.require('ol.Feature');

ol.ManipulateFeature = function(opt_geometryOrProperties) {
	goog.base(this);

	this.rotation = 0;  // To preserve rotation
}
goog.inherits(ol.ManipulateFeature, ol.Feature);
