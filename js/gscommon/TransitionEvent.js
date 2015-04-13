define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojox/mobile/TransitionEvent",
    "gscommon/utilities"
], function(declare, lang, array, TransitionEvent, utilities){

    //return declare(null, {
    //    // summary:
    //    //		A class used to trigger view transitions.
    //
    //    constructor: function(/*DomNode*/target, /*Object*/transitionOptions, /*Event?*/triggerEvent){
    //        // summary:
    //        //		Creates a transition event.
    //        // target:
    //        //		The DOM node that initiates the transition (for example a ListItem).
    //        // transitionOptions:
    //        //		Contains the transition options.
    //        // triggerEvent:
    //        //		The event that triggered the transition (for example a touch event on a ListItem).
    //        this.transitionOptions = transitionOptions;
    //        this.target = target;
    //        this.triggerEvent = triggerEvent||null;
    //    },
    //
    //    dispatch: function(){
    //        // summary:
    //        //		Dispatches this transition event. Emits a "startTransition" event on the target.
    //        var opts = {bubbles:true, cancelable:true, detail: this.transitionOptions, triggerEvent: this.triggerEvent};
    //        var evt = on.emit(this.target,"startViewTransition", opts);
    //    }
    //});

    return declare(TransitionEvent, {
        constructor: function(args) {
            var self = this;
            lang.mixin(self, args);
            self.triggerEvent = self.triggerEvent || null;
        },
        dispatch: function() {
            var self = this,
                targetParts = utilities.parseTransitionTarget(self.transitionOptions.target);
            var region, selView, viewToAdd, oldPartsToAdd = [], target, targetToAppend, viewsToAdd, viewsToRemove,
                regionsToRemove;

            if (targetParts.length > 0) {
                if(!!self.transitionOptions["includeActiveViews"]) {
                    for (region in self.app.selectedChildren) {
                        selView = self.app.selectedChildren[region];
                        if (selView) {
                            if (!array.some(targetParts, function(targetPart) {
                                    var partRegion;
                                    if (targetPart.remove) {
                                        return true;
                                    }
                                    partRegion = self.app.views[targetPart.viewId[0]].constraint
                                    return partRegion == region;
                                })) {
                                // add views occupying regions, which none of the views we are transitioning to belong to
                                viewToAdd = [selView.name];
                                if (selView.selectedChildren && selView.selectedChildren["center"]) {
                                    viewToAdd.push(selView.selectedChildren["center"].name);
                                }
                                oldPartsToAdd.push({viewId: viewToAdd, remove: false});
                            }
                        }
                    }
                }
                viewsToAdd = array.filter(targetParts, function(addPart) {
                    return !addPart.remove;
                });
                regionsToRemove = array.filter(targetParts, function(removePart) {
                    return removePart.remove;
                });
                if (viewsToAdd && viewsToAdd.length > 0) {
                    target = array.map(viewsToAdd, function(newPart) {
                        return "+" + newPart.viewId[0] +
                            (newPart.viewId.length > 1 ? "," + newPart.viewId[1] : "");
                    }).join("");
                }
                if (oldPartsToAdd.length > 0) {
                    targetToAppend = array.map(oldPartsToAdd, function(oldPart) {
                        return "+" + oldPart.viewId[0] +
                            (oldPart.viewId.length > 1 ? "," + oldPart.viewId[1] : "");
                    }).join("");
                    target = target.concat("", targetToAppend);
                }
                if (regionsToRemove && regionsToRemove.length > 0) {
                    viewsToRemove = [];
                    array.forEach(regionsToRemove, function(region) {
                        var childView, loadedViews = self.app.children;

                        for (childView in self.app.children) {
                            if (loadedViews.hasOwnProperty(childView) && loadedViews[childView].constraint == region.viewId[0]) {
                                viewsToRemove.push("-" + loadedViews[childView].name);
                            }
                        }
                    });
                    if (viewsToRemove.length > 0) {
                        targetToAppend = viewsToRemove.join("");
                        target = target.concat("", targetToAppend);
                    }
                }
                if (target.length > 0) {
                    if (target.charAt(0) == "+") {
                        target = target.slice(1);
                    }
                    self.transitionOptions.target = target;
                    self.transitionOptions.url = "#" + target;
                }
            }

            this.inherited(arguments);
        }
    });
});
