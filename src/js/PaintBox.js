MD.PaintBox = function(container, type){

  var colorPicker = function(elem) {
  var picker = elem[0].id == 'stroke_color' ? 'stroke' : 'fill';
  var is_background = elem[0].id == "canvas_color"
  if (is_background) picker = 'canvas'
  var paint = editor.paintBox[picker].paint;
  
  var title = (picker == 'stroke' ? 'Pick a Stroke Paint and Opacity' : 'Pick a Fill Paint and Opacity');
  var was_none = false;
  var pos = is_background ? {'right': 175, 'top': 50} : {'left': 50, 'bottom': 50}
  
  $("#color_picker")
    .draggable({cancel:'.jGraduate_tabs, .jGraduate_colPick, .jGraduate_gradPick, .jPicker', containment: 'window'})
    .removeAttr("style")
    .css(pos)
    .jGraduate(
    { 
      paint: paint,
      window: { pickerTitle: title },
      images: { clientPath: 'images/' },
      newstop: 'inverse'
    },
    function(p) {
      paint = new $.jGraduate.Paint(p);
      
      editor.paintBox[picker].setPaint(paint, true);
      svgCanvas.setPaint(picker, paint);
      
      $('#color_picker').hide();
    },
    function(p) {
      $('#color_picker').hide();
    });
  };
  

  $('#tool_fill').click(function(){
      if ($('#tool_fill').hasClass('active')) {
        colorPicker($('#fill_color'));
      }
      else {
        $('#tool_fill').addClass('active');
        $("#tool_stroke").removeClass('active');
      }
    });
    
  $('#tool_stroke').on("click", function(){
    if ($('#tool_stroke').hasClass('active')) {
      colorPicker($('#stroke_color'));
    }
    else {
      $('#tool_stroke').addClass('active');
      $("#tool_fill").removeClass('active');
    }
  });
  
  $('#tool_canvas').on("click touchstart", function(){
      colorPicker($('#canvas_color'));
  });

  function createBackground(fill) {
    const res = svgCanvas.getResolution();
    svgCanvas.createLayer("background");
    cur_shape = svgCanvas.addSvgElementFromJson({
      "element": "rect",
      "attr": {
        "x": -1,
        "y": -1,
        "width": res.w+2,
        "height": res.h+2,
        "stroke": "none",
        "id": "canvas_background",
        "opacity": 1,
        "fill": fill || "#fff",
        "style": "pointer-events:none"
      }
    });
    svgCanvas.setCurrentLayer("Layer 1")
    svgCanvas.setCurrentLayerPosition("1")
  }

  var background = document.getElementById("canvas_background");
  
  // create a new layer background if it doesn't exist
  if (!document.getElementById('canvas_background')) createBackground();
  var fill = document.getElementById('canvas_background').getAttribute("fill");

  
  var cur = {color: "fff", opacity: 1}
  if (type === "stroke") cur = {color: '000', opacity: 1};
  if (type === "fill") cur = {color: 'fff', opacity: 1};
  if (type === "canvas") cur = {color: 'fff', opacity: 1};

  // set up gradients to be used for the buttons
  var svgdocbox = new DOMParser().parseFromString(
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%"\
    fill="#' + cur.color + '" opacity="' + cur.opacity + '"/>\
    <defs><linearGradient id="gradbox_"/></defs></svg>', 'text/xml');
  var docElem = svgdocbox.documentElement;
  docElem = $(container)[0].appendChild(document.importNode(docElem, true));
  if (type === 'canvas') docElem.setAttribute('width',60.5);
  else docElem.setAttribute('width',"100%");
  
  this.rect = docElem.firstChild;
  this.defs = docElem.getElementsByTagName('defs')[0];
  this.grad = this.defs.firstChild;
  this.paint = new $.jGraduate.Paint({solidColor: cur.color});
  this.type = type;

  this.setPaint = function(paint, apply, noUndo) {
    this.paint = paint;
    var fillAttr = "none";
    var ptype = paint.type;
    var opac = paint.alpha / 100;
    switch ( ptype ) {
      case 'solidColor':
        fillAttr = (paint[ptype] == 'none' || paint[ptype] == 'one') ? 'none' : "#" + paint[ptype];
        break;
      case 'linearGradient':
      case 'radialGradient':
        this.defs.removeChild(this.grad);
        this.grad = this.defs.appendChild(paint[ptype]);
        var id = this.grad.id = 'gradbox_' + this.type;
        fillAttr = "url(#" + id + ')';
    }
    this.rect.setAttribute('fill', fillAttr);
    this.rect.setAttribute('opacity', opac);

    if (this.type === "canvas") {
      //recache background in case it changed
      var background = document.getElementById("canvas_background");
      if (background) {
        res = svgCanvas.getResolution()
        background.setAttribute("x", -1);
        background.setAttribute("y", -1);
        background.setAttribute("width", res.w+2);
        background.setAttribute("height", res.h+2);
        if (fillAttr.indexOf("url") == -1) background.setAttribute('fill', fillAttr)
      }
      else createBackground(fillAttr)
    }

    if(apply) {
      svgCanvas.setColor(this.type, fillAttr, true);
      svgCanvas.setPaintOpacity(this.type, opac, true);
    }
    
  }

  this.getPaint = function(color, opac, type) {
    // update the editor's fill paint
    var opts = null;
    if (color.indexOf("url(#") === 0) {
      var refElem = svgCanvas.getRefElem(color);
      if(refElem) {
        refElem = refElem.cloneNode(true);
      } else {
        refElem =  $("#" + type + "_color defs *")[0];
      }
      
      opts = { alpha: opac };
      opts[refElem.tagName] = refElem;
    } 
    else if (color.indexOf("#") === 0) {
      opts = {
        alpha: opac,
        solidColor: color.substr(1)
      };
    }
    else {
      opts = {
        alpha: opac,
        solidColor: 'none'
      };
    }
    return new $.jGraduate.Paint(opts);
  };  
  
  this.update = function(apply) {
    const selectedElement = editor.selected[0];
    if(!selectedElement) return;
    var type = this.type;
    switch ( selectedElement.tagName ) {
    case 'use':
    case 'image':
    case 'foreignObject':
      // These elements don't have fill or stroke, so don't change 
      // the current value
      return;
    case 'g':
    case 'a':
      var gPaint = null;
    
      var childs = selectedElement.getElementsByTagName('*');
      for(var i = 0, len = childs.length; i < len; i++) {
        var elem = childs[i];
        var p = elem.getAttribute(type);
        if(i === 0) {
          gPaint = p;
        } else if(gPaint !== p) {
          gPaint = null;
          break;
        }
      }
      if(gPaint === null) {
        // No common color, don't update anything
        var paintColor = null;
        return;
      }
      var paintColor = gPaint;
      
      var paintOpacity = 1;
      break;
    default:
      var paintOpacity = parseFloat(selectedElement.getAttribute(type + "-opacity"));
      if (isNaN(paintOpacity)) {
        paintOpacity = 1.0;
      }
      
      var defColor = type === "fill" ? "black" : "none";
      var paintColor = selectedElement.getAttribute(type) || defColor;
    }
    if(apply) {
      svgCanvas.setColor(type, paintColor, true);
      svgCanvas.setPaintOpacity(type, paintOpacity, true);
    }

    paintOpacity *= 100;          
    
    var paint = this.getPaint(paintColor, paintOpacity, type);
    // update the rect inside #fill_color/#stroke_color
    this.setPaint(paint);
  }
  
  this.prep = function() {
    var ptype = this.paint.type;
  
    switch ( ptype ) {
      case 'linearGradient':
      case 'radialGradient':
        var paint = new $.jGraduate.Paint({copy: this.paint});
        svgCanvas.setPaint(type, paint);
    }
  }
};
