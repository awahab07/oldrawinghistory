/**
 * Created by muhammad.shahzad on 12/23/2014.
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dijit/_WidgetBase",
    "gscommon/flexViews/models/ConsReportNumberModel",
    "gscommon/flexViews/controllers/ConsReportNumberController",
    "gscommon/flexViews/widgets/TextBoxWithAction"
], function (declare, lang, _WidgetBase, ConsReportNumberModel, ConsReportNumberController, TextBoxWithAction) {
    return declare([_WidgetBase], {
        _widget: null,
        _widgetWatch: null,
        value: null,
        constructor: function (args) {
            lang.mixin(this, args);
        },
        buildRendering: function () {
            this.inherited(arguments);
        },
        onChange: function () {
        },
        _setValueAttr: function (value) {
            var self = this, editorArgs = {};
            self.value = value;
            editorArgs["disabled"] = self.get("disabled");
            editorArgs["readOnly"] = self.get("readOnly");
            if (self.id) {
                editorArgs["id"] = self.id + "_editor";
            }
            if (self.domNode) {
                if (!self._widget) {
                    self._widget = new TextBoxWithAction(editorArgs);
                }
                if(self._widget.domNode) {
                    self._model = new ConsReportNumberModel({
                        app: self.grid.app,
                        hierarchyId: self.grid.model.hierarchyId,
                        DepartmentID: self.grid.model.securityContextId
                    });
                    self._widget.set("value", value);
                    self._widgetWatch = self._widget.watch("value", function (propName, oldValue, newValue) {
                        self.value = newValue;
                        self.onChange(self.value);
                    });
                    self.domNode.appendChild(self._widget.domNode);
                    self._widget.startup();
                    self._controller = new ConsReportNumberController(self._model, self._widget);
                    self._model.load({5994: value});
                    self._widget.set("value", self.value);
                    if(self._widget.labelNode)
                    self._widget.labelNode.style.display="none";
                    if(self.showInRed){
                        self._widget._inputBox.textbox.style.color="red";
                    }

                }
            }
        },
        _getValueAttr: function () {
            return this.value;
        },
        destroy: function () {
            var self = this;
            self._controller.destroy();
            self._model = null;
            if (self._widget) {
                if (self._widgetWatch && self._widgetWatch.remove) {
                    self._widgetWatch.remove();
                }
                self._widget.destroy();
                self._widget = null;
            }
            self.inherited(arguments);
        }
    });
});

