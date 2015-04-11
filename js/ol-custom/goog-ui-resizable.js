goog.provide('goog.ui.Resizable');
goog.provide('goog.ui.Resizable.EventType');

goog.require('goog.fx.Dragger');
goog.require('goog.fx.Dragger.EventType');
goog.require('goog.math.Size');
goog.require('goog.style');
goog.require('goog.ui.Component');


goog.ui.Resizable = function(element, opt_data, opt_domHelper) {
  goog.ui.Component.call(this, opt_domHelper);

  opt_data = opt_data || {};

  this.element_ = goog.dom.$(element);

  this.minWidth_ = goog.isNumber(opt_data.minWidth) ? opt_data.minWidth : 0;
  this.maxWidth_ = goog.isNumber(opt_data.maxWidth) ? opt_data.maxWidth : 0;
  this.minHeight_ = goog.isNumber(opt_data.minHeight) ? opt_data.minHeight : 0;
  this.maxHeight_ = goog.isNumber(opt_data.maxHeight) ? opt_data.maxHeight : 0;

  this.continuousResize_ = goog.isBoolean(opt_data.continuousResize) ? opt_data.continuousResize : false;
  this.manageGhostElement_();

  this.handles_ = opt_data.handles || goog.ui.Resizable.Position.DEFAULT;

  this.handleDraggers_ = {};
  this.handlers_ = {};

  if (this.handles_ & goog.ui.Resizable.Position.RIGHT) {
    this.addResizableHandler_(goog.ui.Resizable.Position.RIGHT,
        'goog-ui-resizable-right');
  }
  if (this.handles_ & goog.ui.Resizable.Position.BOTTOM) {
    this.addResizableHandler_(goog.ui.Resizable.Position.BOTTOM,
        'goog-ui-resizable-bottom');
  }
  if (this.handles_ & goog.ui.Resizable.Position.BOTTOM_RIGHT) {
    this.addResizableHandler_(goog.ui.Resizable.Position.BOTTOM_RIGHT,
        'goog-ui-resizable-bottom-right');
  }
};
goog.inherits(goog.ui.Resizable, goog.ui.Component);


goog.ui.Resizable.EventType = {
  RESIZE: 'resize',
  START_RESIZE: 'start_resize',
  END_RESIZE: 'end_resize'
};


goog.ui.Resizable.Position = {
//  TOP: 1,
  RIGHT: 2,
  BOTTOM: 4,
//  LEFT: 8,
//  TOP_LEFT: 16,
//  TOP_RIGHT: 32,
  BOTTOM_RIGHT: 64,
//  BOTTOM_LEFT: 128,
  DEFAULT: 70, // RIGHT | BOTTOM | BOTOM_RIGHT
  ALL: 70 // RIGHT | BOTTOM | BOTOM_RIGHT
};


goog.ui.Resizable.prototype.addResizableHandler_ = function(position, className) {
  var dom = this.getDomHelper();
  var handle = dom.createDom('div',
       className + ' goog-ui-resizable-handle');
  this.element_.appendChild(handle);

  var dragger = new goog.fx.Dragger(handle);
  dragger.defaultAction = function() {};

  this.getHandler().
      listen(dragger, goog.fx.Dragger.EventType.START,
          this.handleDragStart_).
      listen(dragger, goog.fx.Dragger.EventType.DRAG,
          this.handleDrag_).
      listen(dragger, goog.fx.Dragger.EventType.END,
          this.handleDragEnd_);

  this.handleDraggers_[position] = dragger;
  this.handlers_[position] = handle;
};


goog.ui.Resizable.prototype.handleDragStart_ = function(e) {
  if (!this.continuousResize_) {
    goog.style.setBorderBoxSize(this.ghostEl_, goog.style.getBorderBoxSize(this.element_));
    goog.style.showElement(this.ghostEl_, true);
  }

  var dragger = e.currentTarget;
  var position = this.getDraggerPosition_(dragger);
  var targetPos = goog.style.getPosition(dragger.target);

  var el = this.continuousResize_ ? this.element_ : this.ghostEl_;
  var size = goog.style.getSize(el);
  this.handlerOffsetSize_ = new goog.math.Size(size.width - targetPos.x, size.height - targetPos.y);

  this.dispatchEvent({
    type: goog.ui.Resizable.EventType.START_RESIZE
  });
};


goog.ui.Resizable.prototype.handleDrag_ = function(e) {
  var dragger = e.currentTarget;
  var position = this.getDraggerPosition_(dragger);

  var el = this.continuousResize_ ? this.element_ : this.ghostEl_;
  var size = goog.style.getSize(el);
  if (position == goog.ui.Resizable.Position.RIGHT) {
    size.width = dragger.deltaX + this.handlerOffsetSize_.width;
  } else if (position == goog.ui.Resizable.Position.BOTTOM) {
    size.height = dragger.deltaY + this.handlerOffsetSize_.height;
  } else if (position == goog.ui.Resizable.Position.BOTTOM_RIGHT) {
    size.width = dragger.deltaX + this.handlerOffsetSize_.width;
    size.height = dragger.deltaY + this.handlerOffsetSize_.height;
  }

  // Now size the containers.
  this.resize_(el, size, this.continuousResize_);

  if (goog.isFunction(el.resize)) {
    el.resize(size);
  }
  return false;
};


goog.ui.Resizable.prototype.handleDragEnd_ = function(e) {
  if (!this.continuousResize_) {
    this.resize_(this.element_, goog.style.getBorderBoxSize(this.ghostEl_), true);
    goog.style.showElement(this.ghostEl_, false);
  }

  this.dispatchEvent({
    type: goog.ui.Resizable.EventType.END_RESIZE
  });
};


goog.ui.Resizable.prototype.resize_ = function(element, size, isDispatch) {
  var newSize = new goog.math.Size(Math.max(size.width, 0), Math.max(size.height, 0));

  if (this.minWidth_ > 0) {
    newSize.width = Math.max(newSize.width, this.minWidth_);
  }
  if (this.maxWidth_ > 0){
    newSize.width = Math.min(newSize.width, this.maxWidth_);
  }
  if (this.minHeight_ > 0) {
    newSize.height = Math.max(newSize.height, this.minHeight_);
  }
  if (this.maxHeight_ > 0) {
    newSize.height = Math.min(newSize.height, this.maxHeight_);
  }

  if (isDispatch) {
    this.dispatchEvent({
      type: goog.ui.Resizable.EventType.RESIZE,
      size: newSize.clone()
    });
  }

  // TODO: Add a goog.math.Size.max call for below.
  goog.style.setBorderBoxSize(element, newSize);
};


goog.ui.Resizable.prototype.getDraggerPosition_ = function(dragger) {
  for (var position in this.handleDraggers_) {
    if (this.handleDraggers_[position] === dragger) {
      return position;
    }
  }
  return null;
};


goog.ui.Resizable.prototype.getMinWidth = function() {
  return this.minWidth_;
};


goog.ui.Resizable.prototype.setMinWidth = function(width) {
  this.minWidth_ = width;
};


goog.ui.Resizable.prototype.getMaxWidth = function() {
  return this.maxWidth_;
};


goog.ui.Resizable.prototype.setMaxWidth = function(width) {
  this.maxWidth_ = width;
};


goog.ui.Resizable.prototype.getMinHeight = function() {
  return this.minHeight_;
};


goog.ui.Resizable.prototype.setMinHeight = function(height) {
  this.minHeight_ = height;
};


goog.ui.Resizable.prototype.getMaxHeight = function() {
  return this.maxHeight_;
};


goog.ui.Resizable.prototype.setMaxHeight = function(height) {
  this.maxHeight_ = height;
};


goog.ui.Resizable.prototype.getContinuousResize = function() {
  return this.continuousResize_;
};


goog.ui.Resizable.prototype.setContinuousResize = function(continuous) {
  this.continuousResize_ = continuous;
  this.manageGhostElement_();
};


goog.ui.Resizable.prototype.manageGhostElement_ = function() {
  if (!this.continuousResize_ && !this.ghostEl_) {
    this.ghostEl_ = this.getDomHelper().createDom('div', 'goog-ui-resizable-ghost');
    this.element_.appendChild(this.ghostEl_);
    goog.style.showElement(this.ghostEl_, false);
  } else if (this.continuousResize_ && this.ghostEl_) {
    goog.dom.removeNode(this.ghostEl_);
    this.ghostEl_ = null;
  }
};


goog.ui.Resizable.prototype.getGhostElement = function() {
  return this.ghostEl_;
};


/** @inheritDoc */
goog.ui.Resizable.prototype.disposeInternal = function() {
  goog.ui.Resizable.superClass_.disposeInternal.call(this);

  for (var position in this.handleDraggers_) {
    this.handleDraggers_[position].dispose();
  }
  this.handleDraggers_ = {};
  for (var position in this.handlers_) {
    goog.dom.removeNode(this.handlers_[position]);
  }
  this.handlers_ = {};

  if (this.ghostEl_) {
    goog.dom.removeNode(this.ghostEl_);
    this.ghostEl_ = null;
  }
};