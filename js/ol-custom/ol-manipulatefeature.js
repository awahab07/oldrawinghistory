/**
 * Extending ol.Feature into ol.ManipulateFeature to allow the feature to handle manipulation behavior
 */

goog.provide('ol.ManipulateFeature');

goog.require('ol.Feature');

ol.ManipulateFeature = function(opt_geometryOrProperties) {
	goog.base(this);
}
goog.inherits(ol.ManipulateFeature, ol.Feature);
