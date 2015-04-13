/**
 * Created with JetBrains WebStorm.
 * User: olegg
 * Date: 6/6/13
 * Time: 4:03 PM
 * To change this template use File | Settings | File Templates.
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/dom",
    "dojo/query",
    "dojo/store/Memory",
    "dijit/registry",
    "./utilities"
], function(declare, lang, array, dom, query, Memory, registry, utils) {
    var locTypeLiteral = "LOCALIZATION_LITERAL",
        locTypeColumn = "LOCALIZATION_COLUMN",
        locTypeTable = "LOCALIZATION_TABLE",
        locTypeHierarchy = "LOCALIZATION_HIERARCHY";

    var registerLiteral = function(/*Object*/ instance, /*String*/ type, /*Integer*/ id, /*String*/ defaultValue,
                                   /*Optional String|Object*/ uiElement, /*Optional Boolean*/ isWidget,
                                   /*Optional String*/ propertyName) {
        var compositeId = type + "_" + id;
        var literalItem = instance._localizationStore.get(compositeId);
        var label;
        if (uiElement) {
            label = {uiElement: uiElement};
            if (isWidget) {
                label.isWidget = isWidget;
            }
            if (propertyName) {
                label.propertyName = propertyName;
            }
        }
        if (!literalItem) {
            literalItem = {
                compositeId: compositeId,
                type: type,
                id: id,
                "default": defaultValue,
                labels: []
            };
        }
        if (label) {
            literalItem.labels.push(label);
        }
        instance._localizationStore.put(literalItem, {overwrite: true});
    };

    var bindUIElement = function(/*Object*/ instance, /*String*/ type, /*Integer*/ id, /*String|Object*/ uiElement, /*Boolean*/ isWidget,
                                 /*Optional String*/ propertyName) {
        var compositeId = type + "_" + id;
        var literalItem = instance._localizationStore.get(compositeId);
        var label;
        if (literalItem) {
            label = {uiElement: uiElement};
            if (isWidget) {
                label.isWidget = isWidget;
            }
            if (propertyName) {
                label.propertyName = propertyName;
            }
            literalItem.labels.push(label);
        }
    };

    return declare(null, {
        localizationProvider: null,
        constructor: function(args) {
            lang.mixin(this, args);
            this._localizationStore = new Memory({idProperty: "compositeId"});
        },
        useLiteral: function(/*Integer*/ id, /*String*/ defaultValue, /*String|Object?*/ uiElement,
                            /*Boolean?*/ isWidget, /*String?*/ propertyName) {
            registerLiteral(this, locTypeLiteral, id, defaultValue, uiElement, isWidget, propertyName);
        },
        useColumnLabel: function(/*Integer*/ id, /*String*/ defaultValue, /*String|Object?*/ uiElement,
                                 /*Boolean?*/ isWidget, /*String?*/ propertyName) {
            registerLiteral(this, locTypeColumn, id, defaultValue, uiElement, isWidget, propertyName);
        },
        useTableLabel: function(/*Integer*/ id, /*String*/ defaultValue, /*String|Object?*/ uiElement,
                                 /*Boolean?*/ isWidget, /*String?*/ propertyName) {
            registerLiteral(this, locTypeTable, id, defaultValue, uiElement, isWidget, propertyName);
        },
        useHierarchyLabel: function(/*Integer*/ id, /*String*/ defaultValue, /*String|Object?*/ uiElement,
                            /*Boolean?*/ isWidget, /*String?*/ propertyName) {
            registerLiteral(this, locTypeHierarchy, id, defaultValue, uiElement, isWidget, propertyName);
        },
        bindToLiteral: function(/*Integer*/ id, /*String|Object*/ uiElement, /*Boolean?*/ isWidget,
                               /*String?*/ propertyName) {
            bindUIElement(this, locTypeLiteral, id, uiElement, isWidget, propertyName);
        },
        bindToColumnLabel: function(/*Integer*/ id, /*String|Object*/ uiElement, /*Boolean?*/ isWidget,
                                /*String?*/ propertyName) {
            bindUIElement(this, locTypeColumn, id, uiElement, isWidget, propertyName);
        },
        bindToTableLabel: function(/*Integer*/ id, /*String|Object*/ uiElement, /*Boolean?*/ isWidget,
                                /*String?*/ propertyName) {
            bindUIElement(this, locTypeTable, id, uiElement, isWidget, propertyName);
        },
        bindToHierarchyLabel: function(/*Integer*/ id, /*String|Object*/ uiElement, /*Boolean?*/ isWidget,
                                /*String?*/ propertyName) {
            bindUIElement(this, locTypeHierarchy, id, uiElement, isWidget, propertyName);
        },
        subscribe: function(/*Function?*/ postLocalize, /*String?*/ scope, /*String?*/ localizationContext) {
            var localizableLabels,
                localizationStore = this._localizationStore,
                localizableLiterals = localizationStore.data,
                widgetLabelDom;

            var localize = function(/*Array*/ localizedLabels, /*Boolean*/ isCustom) {
                array.forEach(localizedLabels, function(label) {
                    var localizableLabels = localizationStore.query(function(item) {
                        return item.type == label.type && item.id == label.id;
                    });
                    if (localizableLabels && localizableLabels.length) {
                        array.forEach(localizableLabels, function(localizableLabel) {
                            if (localizableLabel.labels && localizableLabel.labels.length) {
                                array.forEach(localizableLabel.labels, function(uiLabel) {
                                    var uiElement, labelProp, textContent;
                                    if (uiLabel.isWidget) {
                                        if (typeof uiLabel.uiElement == "string") {
                                            uiElement = registry.byId(uiLabel.uiElement);
                                        } else {
                                            uiElement = uiLabel.uiElement;
                                        }
                                        if (uiElement) {
                                            labelProp = uiLabel.propertyName ? uiLabel.propertyName : "label";
                                            if (uiElement[labelProp] !== undefined) {
                                                if (uiElement.set) {
                                                    uiElement.set(labelProp, label.label);
                                                } else {
                                                    uiElement[labelProp] = label.label;
                                                }
                                                widgetLabelDom = query('label[for="' + uiLabel.uiElement + '"]', "" + uiLabel.uiElement)[0];
                                                if (widgetLabelDom && !widgetLabelDom.length) {
                                                    widgetLabelDom.innerHTML = label.label;
                                                }
                                            } else {
                                                if (uiElement.id) {
                                                    console.error("Widget with id \"" + uiElement.id + "\" does not have property \"" + labelProp + "\"");
                                                } else {
                                                    console.error("Widget \"" + uiElement + "\" does not have property \"" + labelProp + "\"");
                                                }
                                            }
                                        } else {
                                            if (typeof uiLabel.uiElement == "string") {
                                                console.error("Widget with id \"" + uiLabel.uiElement + "\" not found");
                                            } else {
                                                console.error("Widget \"" + uiLabel.uiElement + "\" not found");
                                            }
                                        }
                                    } else {
                                        if (typeof uiLabel.uiElement == "string") {
                                            uiElement = dom.byId(uiLabel.uiElement);
                                        } else {
                                            uiElement = uiLabel.uiElement;
                                        }
                                        if (uiElement) {
                                            textContent = uiElement.textContent !== undefined ? "textContent" : "innerText";
                                            if (uiLabel.propertyName && uiLabel.propertyName !== "textContent" && uiLabel.propertyName !== "innerText") {
                                                labelProp = uiLabel.propertyName;
                                            } else {
                                                labelProp = textContent;
                                            }
                                            if (uiElement[labelProp] !== undefined) {
                                                uiElement[labelProp] = label.label;
                                            } else {
                                                if (uiElement.id) {
                                                    console.error("DOM node with id \"" + uiElement.id + "\" does not have property \"" + labelProp + "\"");
                                                } else {
                                                    console.error("DOM node \"" + uiElement + "\" does not have property \"" + labelProp + "\"");
                                                }
                                            }
                                        } else {
                                            if (typeof uiLabel.uiElement == "string") {
                                                console.error("DOM node with id \"" + uiLabel.uiElement + "\" not found");
                                            } else {
                                                console.error("DOM node \"" + uiLabel.uiElement + "\" not found");
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
                if (postLocalize) {
                    postLocalize();
                }
            };

            if (this.localizationProvider) {
                localizableLabels = array.map(localizableLiterals, function(literal) {
                    return utils.getLocalizableLabel(literal.type, literal.id, literal["default"]);
                });
                return this.localizationProvider.subscribe(localizableLabels, localize, scope, localizationContext);
            } else {
                return null;
            }
        }

    });
});