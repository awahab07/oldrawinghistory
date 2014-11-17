/**
 * This file is meant to contain scripts that use goog used in ol (Google Closure)
 */

 goog.require('goog.object');
 goog.require('goog.asserts');
 goog.require('goog.functions');
 goog.require('ol.Feature');

 function googGetFeatureId(feature) {
 	goog.asserts.assertInstanceof(feature, ol.Feature, "feature is not an instance of ol.Feature");
 	if(feature && feature.getId && feature.getId()) {
 		if(!feature.fid) {
 			feature.fid = feature.getId();
 		}
 	} else {
 		feature.setId(goog.getUid(feature));
 	}
    
    return feature.getId();
 }

function googAssertInstanceOf(value, type, opt_message, var_args) {
    goog.asserts.assertInstanceof(value, type, opt_message, var_args);
}