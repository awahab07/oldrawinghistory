/**
 * Created by Abdul Wahab on 3/25/2015.
 *
 * How to use:
 *      require(["gscommon/annotations/ShapeIconGenerator"], function(ShapeIconGenerator){
 *          var lineIconBase64String = ShapeIconGenerator.getBase64('Line', '', 'rgba(255, 100, 10, 1)', 2, 0, 48, 48);
 *      });
 */

define([
    "dojo/_base/lang",
    "dojo/dom-construct"
], function(lang, domConstruct) {
    var shapeTypes = {
        'Rectangle': 1,
        'Ellipse': 2,
        'Line': 3,
        'Dot': 4,
        'Stamp': 5,
        'FreeHand': 6,
        'Arrow': 7,
        'SequentialNumberPin': 8,
        'Text': 9
    };

    var lineStyles = {
        '1px': {lineWidth: 1},
        '2px': {lineWidth: 2},
        '4px': {lineWidth: 4},
        '6px': {lineWidth: 6},
        '8px': {lineWidth: 8},
        '10px': {lineWidth: 10},
        '14px': {lineWidth: 14},
        '22px': {lineWidth: 22},
        'Dotted 2px': {lineWidth: 2, lineCap: "round", lineDash: [0.5, 8]},
        'Dotted 4px': {lineWidth: 4, lineCap: "round", lineDash: [0.5, 8]},
        'Dotted 8px': {lineWidth: 8, lineCap: "round", lineDash: [0.5, 16]},
        'Dashed 2px': {lineWidth: 2, lineCap: "square", lineDash: [3, 6]},
        'Dashed 6px': {lineWidth: 6, lineCap: "square", lineDash: [3, 8]},
        'Dashed 8px': {lineWidth: 8, lineCap: "square", lineDash: [8, 16]},
        'Dash Dot 2px': {lineWidth: 2, lineCap: "square", lineDash: [1, 6, 3, 6]},
        'Dash Dot 4px': {lineWidth: 4, lineCap: "square", lineDash: [2, 8, 6, 8]}
    };

    return {

        /**
         * Generates icon/image using hidden canvas based on the given parameters and returns PNG encoded base64 string.
         * @param shapeType {string} Any of 'Rectangle' | 'Ellipse' | 'Line' | 'Dot' | 'Stamp' | 'FreeHand' | 'Arrow', default 'Rectangle'
         * @param fillColor {string} Any valid CSS color value (RGB, RGBA, Hex, Color Keyword), default 'yellow'
         * @param strokeColor {string} Any valid CSS color value (RGB, RGBA, Hex, Color Keyword), default 'black'
         * @param lineStyle {string|number} Any of '1px' | '2px' | '4px' | '6px' | '8px' | '10px' | '14px' |
         *                                  '22px' | 'Dotted 2px' | 'Dotted 4px' | 'Dotted 8px' |
         *                                  'Dashed 2px' | 'Dashed 6px' | 'Dashed 8px' | 'Dash Dot 2px' | 'Dash Dot 4px'
         *                                  Or number representing the strokeWidth/lineWidth in pixels for a solid line
         *                                  (Default 1 => solid 1px)
         * @param fillLineAngle {number} (Not sure yet)
         * @param width {number} Width in pixels of the generated image, default 24
         * @param height {number} Height in pixels of the generated image, default 24
         * @returns {string} The PNG encoded Base64 string (Without leading scheme formatter e.g. "data:image/png;base64,..." )
         */
        getBase64: function (shapeType, fillColor, strokeColor, lineStyle, fillLineAngle, width, height) {
            shapeType = shapeTypes[shapeType] && shapeType || 'Rectangle';
            fillColor = fillColor || 'yellow';
            strokeColor = strokeColor || 'black';
            lineStyle = Number(lineStyle) || lineStyles[lineStyle] || 1;
            width = Number(width) || 24;
            height = Number(height) || 24;

            // Creating and placing hidden canvas element
            var hiddenCanvas = domConstruct.toDom('<canvas style="display:none;" width="'+width+'px" height="'+height+'px"></canvas>');
            domConstruct.place(hiddenCanvas, document.body, "last");


            var ctx = hiddenCanvas.getContext("2d");

            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;

            // Setting canvas style
            if(typeof lineStyle == "object") {
                ctx.lineWidth = lineStyle.lineWidth;

                if(lineStyle.lineCap) {
                    ctx.lineCap = lineStyle.lineCap;
                }

                if(lineStyle.lineDash) {
                    ctx.setLineDash(lineStyle.lineDash);
                }
            } else {
                ctx.lineWidth = lineStyle;
            }

            // Drawing
            ctx.beginPath();
            switch (shapeType) {
                case 'Rectangle':
                    ctx.rect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
                    ctx.fill();
                    ctx.stroke();
                    break;
                case 'Ellipse':
                    ctx.arc(width/2, height/2, Math.min(width, height) * 0.4, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                    break;
                case 'Dot':
                    ctx.arc(width/2, height/2, Math.min(width, height) * 0.3, 0, 2 * Math.PI);
                    ctx.fill();
                    break;
                case 'Line':
                    ctx.moveTo(width * 0.1, height * 0.5);
                    ctx.lineTo(width * 0.9, height * 0.5);
                    ctx.stroke();
                    break;
                case 'Stamp':
                    ctx.moveTo(width * 0.1, height * 0.5);
                    ctx.lineTo(width * 0.8, height * 0.5);
                    ctx.textBaseline = "middle";
                    ctx.font = Math.min(width, height)/2 + "px sans-serif";
                    ctx.fillText("1", width * 0.8, height * 0.5);
                    ctx.stroke();
                    break;
                case 'Arrow':
                    ctx.moveTo(width * 0.1, height * 0.5);
                    ctx.lineTo(width * 0.9, height * 0.5);
                    ctx.lineTo(width * 0.7, height * 0.35);
                    ctx.lineTo(width * 0.9, height * 0.5);
                    ctx.lineTo(width * 0.7, height * 0.65);
                    ctx.stroke();
                    break;
                case 'FreeHand':
                    ctx.moveTo(width * 0.3, height * 0.9);
                    ctx.lineTo(width * 0.2, height * 0.8);
                    ctx.lineTo(width * 0.1, height * 0.7);
                    ctx.lineTo(width * 0.1, height * 0.6);
                    ctx.lineTo(width * 0.15, height * 0.5);
                    ctx.lineTo(width * 0.1, height * 0.4);
                    ctx.lineTo(width * 0.1, height * 0.3);
                    ctx.lineTo(width * 0.15, height * 0.2);
                    ctx.lineTo(width * 0.2, height * 0.2);
                    ctx.lineTo(width * 0.3, height * 0.15);
                    ctx.lineTo(width * 0.4, height * 0.2);
                    ctx.lineTo(width * 0.5, height * 0.3);
                    ctx.lineTo(width * 0.6, height * 0.35);
                    ctx.lineTo(width * 0.7, height * 0.4);
                    ctx.lineTo(width * 0.8, height * 0.35);
                    ctx.lineTo(width * 0.9, height * 0.4);
                    ctx.lineTo(width * 0.85, height * 0.5);
                    ctx.lineTo(width * 0.8, height * 0.6);
                    ctx.lineTo(width * 0.75, height * 0.7);
                    ctx.lineTo(width * 0.75, height * 0.8);
                    ctx.lineTo(width * 0.7, height * 0.7);
                    ctx.stroke();
                    break;
                case 'SequentialNumberPin':
                    var r = Math.min(width, height) * 0.3;
                    ctx.translate(width/2, height/2);
                    ctx.scale(0.9, 1.5);
                    ctx.translate(0, 1);
                    ctx.moveTo(0, r);
                    ctx.lineTo(r, 0);
                    ctx.arc(0, 0, r, 0, Math.PI, true);
                    ctx.lineTo(0, r);
                    ctx.fill();
                    //ctx.stroke();
                    ctx.translate(-1 * width/2, -1 * height/2);

                    ctx.fillStyle = strokeColor;
                    ctx.textBaseline = "middle";
                    ctx.textAlign = "center";
                    ctx.font = Math.min(width, height)/3 + "px sans-serif";
                    ctx.fillText("#", width/2, height/2.2);
                    break;
                case 'Text':
                    ctx.fillStyle = strokeColor; // Exception as the widget/web services by shahzad requires this way

                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.font = Math.min(width, height)/2 + "px sans-serif";
                    ctx.fillText("Text", width/2, height/2);
                    break;
            }
            ctx.closePath();

            var base64String = hiddenCanvas.toDataURL("image/png");

            // Removing scheme
            base64String = base64String.replace('data:image/png;base64,', '');
            domConstruct.destroy(hiddenCanvas);

            return base64String;
        }
    }
});
