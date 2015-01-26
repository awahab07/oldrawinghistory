/**
 * Override of ol.renderer.canvas.Layer to allow modification of baseLayer (Apply scale and translate)
 */


/**
 * @param {olx.FrameState} frameState Frame state.
 * @param {ol.layer.LayerState} layerState Layer state.
 * @param {CanvasRenderingContext2D} context Context.
 */
ol.renderer.canvas.Layer.prototype.composeFrame =
    function(frameState, layerState, context) {
/*patch*/ frameState.layerRef = this;
  this.dispatchPreComposeEvent(context, frameState);

  var image = this.getImage();
  if (!goog.isNull(image)) {
    var imageTransform = this.getImageTransform();

    /** Patch **/
    this.isPatched_ = true;
    if(typeof this.modifyImageTransform == 'function') {
    	imageTransform = this.modifyImageTransform(imageTransform);
    }
    /** Patch **/

    // for performance reasons, context.save / context.restore is not used
    // to save and restore the transformation matrix and the opacity.
    // see http://jsperf.com/context-save-restore-versus-variable
    var alpha = context.globalAlpha;
    context.globalAlpha = layerState.opacity;

    // for performance reasons, context.setTransform is only used
    // when the view is rotated. see http://jsperf.com/canvas-transform
    if (frameState.viewState.rotation === 0) {
      var dx = goog.vec.Mat4.getElement(imageTransform, 0, 3);
      var dy = goog.vec.Mat4.getElement(imageTransform, 1, 3);
      var dw = image.width * goog.vec.Mat4.getElement(imageTransform, 0, 0);
      var dh = image.height * goog.vec.Mat4.getElement(imageTransform, 1, 1);
      context.drawImage(image, 0, 0, +image.width, +image.height,
          Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
    } else {
      context.setTransform(
          goog.vec.Mat4.getElement(imageTransform, 0, 0),
          goog.vec.Mat4.getElement(imageTransform, 1, 0),
          goog.vec.Mat4.getElement(imageTransform, 0, 1),
          goog.vec.Mat4.getElement(imageTransform, 1, 1),
          goog.vec.Mat4.getElement(imageTransform, 0, 3),
          goog.vec.Mat4.getElement(imageTransform, 1, 3));
      context.drawImage(image, 0, 0);
      context.setTransform(1, 0, 0, 1, 0, 0);
    }
    context.globalAlpha = alpha;
  }

  this.dispatchPostComposeEvent(context, frameState);

};

