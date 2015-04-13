/**
 * Widget template Created by Jason Hornbuckle
 */
define([
    "dojo/_base/declare",
    "dojo/dom-construct",
    "dojo/dom-class",
    "gscommon/annotations/ShapeDrawingTool",
    "gscommon/annotations/AnnotationsLayers",
    "dijit/layout/BorderContainer",
    "dijit/layout/ContentPane",
    "gscommon/flexViews/widgets/ContextView",
    "dijit/form/Select"
], function (declare, domConstruct, domClass, ShapeDrawingTool, AnnotationsLayers, BorderContainer,
             ContentPane, ContextView, Select) {

    return declare([ShapeDrawingTool], {
        localizationProvider: null,
        annotationsLayers : null,
        layersStore: null,
        reportSelect: null,
        buildRendering: function (){
            //this.inherited(arguments);
            domClass.add(this.layout.domNode, 'galSysAnnotationsTool');
            //add annotationsArea domNode where the annotations UI will show up.
            this.annotationsLayers = new AnnotationsLayers();
            this.annotationsArea = domConstruct.create('div', {
                "class": 'galSysAnnotationsArea'
            });

            this.bc = new BorderContainer({
                style: "height: 100%; width: 100%;",
                liveSplitters: true,
                design: 'sidebar'
            });

            // create a ContentPane as the left pane in the BorderContainer
            this.leftPane = new ContentPane({
                region: "center",
                liveSplitters: true,
                //style: "width: 300px",
                splitter: true
            });

            this.rightPane = new ContentPane({
                region: "trailing",
                style: 'width:80%;',
                splitter: true
            });

            this.leftBottomPane = new ContentPane({
                style: "width: 300px;height:300px;",
                region:"bottom",
                splitter: true
            });

            domConstruct.place(this.bc.domNode, this.layout.shapeDrawingArea, 'before');

            this.bc.addChild(this.leftPane);
            this.bc.addChild(this.rightPane);
            this.bc.addChild(this.leftBottomPane);

            this.leftPane.containerNode.appendChild(this.annotationsArea);
            this.rightPane.containerNode.appendChild(this.layout.shapeDrawingArea);

            //add reports select area.
            this._reportSelectArea = domConstruct.create('div', {
                style: 'background-color:#ccc;padding:10px 20px;height:23px;min-width:270px;'
            });
            this._reportLabel = domConstruct.create('label', {
                style: 'float:left;font-weight:bold;height:25px;line-height:23px;'
            });
            this.reportSelect = new Select({
                style: 'width:150px;margin-left:20px;'
            });

            //add flex views to left pane
            this._contextViewOne = new ContextView({ widgetType: "ImportedView", widgetTypeId: 29 });
            this._contextViewTwo = new ContextView({ widgetType: "ImportedView", widgetTypeId: 29 });

            this._reportSelectArea.appendChild(this._reportLabel);
            this._reportSelectArea.appendChild(this.reportSelect.domNode);

            this.leftPane.containerNode.appendChild(this._reportSelectArea);
            this.leftPane.containerNode.appendChild(this._contextViewOne.domNode);
            this.leftBottomPane.containerNode.appendChild(this._contextViewTwo.domNode);

            //add localization
            this._localizeItems =  this._localizeItems.concat([
                {
                    domNode: this._reportLabel,
                    id: 2103,
                    method: 'useLiteral'
                }
            ]);

            this.inherited(arguments);

        },
        startup: function () {
            this.inherited(arguments);
            this.annotationsLayers.startup();
            this.bc.startup();
        },
        destroy: function () {
            this.annotationsLayers.destroy();
            this.inherited(arguments);
        }
    });
});
