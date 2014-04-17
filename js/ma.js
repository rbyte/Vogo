/*
	??name??
	Copyright (C) 2014 Matthias Graf
	matthias.graf <a> eclasca.de
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

ma = function() { // spans everything - not indented
var ma = {}

var svgViewboxWidth = 100
var svgViewboxHeight = 100
var svgViewboxX = -svgViewboxWidth/2
var svgViewboxY = -svgViewboxHeight/2
var svgWidth = 800
var svgHeight = 800

var keyPressed = { w:false, a:false, s:false, d:false }
const keyMap = { d:68, s:83, e:69, f:70, g:71, "+":107, "-":109 }

var svg
// r: 0 is North, -Math.PI/2 is West, ...
var turtleContext = {x: 0, y:0, r:0}
var turtleHomeStyle = {fill: "none", stroke: "#d07f00", "stroke-width": ".2", "stroke-linecap": "round"}
var turtleStyle = {fill: "#ffba4c", "fill-opacity": 0.6, stroke: "none"}
var paintingG
var previewLine
var previewArc
var tPath = []

ma.init = function() {
	svg = d3.select("#turtleSVG")
	svg.attr("viewBox", svgViewboxX+" "+svgViewboxY+" "+svgViewboxWidth+" "+svgViewboxHeight)
		.attr("width", svgWidth).attr("height", svgHeight)
	
	paintingG = svg.append("g").attr("id", "paintingG")
	
	var turtleHomeCursor = svg.append("g").attr("id", "turtleHomeCursor")
	turtleHomeCursor.append("path").attr("d", "M1,1 L0,-2 L-1,1 Z").style(turtleHomeStyle)
		
	var turtleCursor = svg.append("g").attr("id", "turtleCursor")
		.attr("transform", "translate("+turtleContext.x+", "+turtleContext.y+") rotate("+(turtleContext.r/Math.PI*180)+")")
	turtleCursor.append("path").attr("d", "M1,1 L0,-2 L-1,1 Z").style(turtleStyle)
	
	svg.call(d3.behavior.drag().on("drag", function (d) {
		if (false) {
			var x = toCanvasCoordsX(d3.event.x)
			var y = toCanvasCoordsY(d3.event.y)
			var oldX = x-toCanvasCoordsDX(d3.event.dx)
			var oldY = y-toCanvasCoordsDY(d3.event.dy)
			svg.append("line").attr("x1", x).attr("y1", y).attr("x2", oldX).attr("y2", oldY)
				.style({stroke: "#000", "stroke-width": ".25", "stroke-linecap": "round"})
		}
		svgViewboxX -= toCanvasCoordsDX(d3.event.dx)
		svgViewboxY -= toCanvasCoordsDY(d3.event.dy)
		svg.attr("viewBox", svgViewboxX+" "+svgViewboxY+" "+svgViewboxWidth+" "+svgViewboxHeight)
		
	}))
	
	svg.on("mousemove", function (d, i) {
		var mouse = d3.mouse(this)
		var x = mouse[0]
		var y = mouse[1]
		if (keyPressed.d) {
			previewLine.attr("x2", x).attr("y2", y)
			var dx = x-turtleContext.x
			var dy = y-turtleContext.y
			var lineLength = Math.sqrt(dx*dx+dy*dy)
			var alpha = Math.atan2(dy, dx)
			if (alpha > Math.PI/2)
				alpha -= Math.PI/2*3
			else
				alpha += Math.PI/2
			
			var arc = d3.svg.arc()
				.innerRadius(0)
				.outerRadius(Math.min(10, lineLength/2))
				.startAngle(turtleContext.r)
				.endAngle(alpha)
			
			previewArc.attr("d", arc)
		}
    })
	
	svg.on("click", function (d, i) {
		
    })
	
	d3.select("body")
		.on("keydown", function() { updateKeyDownAndUp(d3.event.keyCode, true) })
		.on("keyup", function() { updateKeyDownAndUp(d3.event.keyCode, false) })
}

function updateKeyDownAndUp(keyCode, down) {
	switch (keyCode) {
		case keyMap.d:
			if (down && !keyPressed.d) {
				var arc = d3.svg.arc()
					.innerRadius(0)
					.outerRadius(10)
					.startAngle(turtleContext.r)
					.endAngle(1)
				
				previewArc = paintingG.append("path")
					.attr("d", arc)
					.attr("transform", "translate(0,0)")
					.style({fill: "#000", "fill-opacity": 0.2})
				
				previewLine = paintingG.append("line")
					.attr("x1", turtleContext.x).attr("y1", turtleContext.y)
					.attr("x2", 0).attr("y2", 0)
					.style({stroke: "#000", "stroke-width": ".25", "stroke-linecap": "round"})
			}
			if (!down && keyPressed.d) {
				previewLine.remove()
				previewArc.remove()
			}
			keyPressed.d = down
			break
		case keyMap.s: keyPressed.s = down; break
		case keyMap.e: keyPressed.e = down; break
		case keyMap.f: keyPressed.f = down; break
		case keyMap.g: keyPressed.g = down; break
		default: break
	}
}

function toCanvasCoordsX(x) { return svgViewboxX+x*(svgViewboxWidth/svgWidth) }
function toCanvasCoordsY(y) { return svgViewboxY+y*(svgViewboxHeight/svgHeight) }
function toCanvasCoordsDX(x) { return x*(svgViewboxWidth/svgWidth) }
function toCanvasCoordsDY(y) { return y*(svgViewboxHeight/svgHeight) }

return ma
}()