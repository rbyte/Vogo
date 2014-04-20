/*
	Drawing Turtle Graphics
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
const zoomFactor = 1.3

// http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
const keyMap = { d:68, s:83, e:69, f:70, g:71, "+":107, "-":109, p:80, del: 46 }
var keyPressed = { d:false, s:false, e:false, f:false, g:false, "+":false, "-":false, p:false, del: false }
const mouseMap = { 0: "left", 1: "middle", 2: "right" }
var mousePressed = { left: false, middle: false, right: false }

var svg
var turtleHomeStyle = {fill: "none", stroke: "#d07f00", "stroke-width": ".2", "stroke-linecap": "round"}
var turtleStyle = {fill: "#ffba4c", "fill-opacity": 0.6, stroke: "none"}
var lineStyle = {stroke: "#000", "stroke-width": ".25", "stroke-linecap": "round"}
var arcStyle = {fill: "#000", "fill-opacity": 0.1}

var paintingG
var previewLine
var previewArc

var functions = []
var commands = [
	rotate(1), move(10), loop(3, [rotate(-1), move(10)])
]

var dragInProgress = false
var turtleHomeCursor
var turtleCursor
// r: 0 is North, -Math.PI/2 is West. r is in [-Pi, Pi].
var state = {x: 0, y:0, r:0, addRadius: function(rr) {
		if (rr > Math.PI || rr < -Math.PI)
			console.log("Warning: addRadius: rr out of [-Pi, Pi]")
		this.r += rr
		this.r = correctRadius(this.r)
	}
}

function cloneS(state) {
	return {x: state.x, y: state.y, r: state.r, addRadius: state.addRadius}
}

var selection = {
	e: undefined,
	add: function(elem) {
		if (!selection.isEmpty()) {
			selection.e.deselect()
		}
		selection.e = elem
	},
	isEmpty: function() {
		return selection.e === undefined
	},
	deselectAll: function() {
		if (!selection.isEmpty()) {
			selection.e.deselect()
			selection.e = undefined
		}
	},
	removeAll: function() {
		if (!selection.isEmpty()) {
			selection.e.deselect()
			selection.e.remove()
			selection.e = undefined
		}
	}
}

ma.init = function() {
	setUpSVG()
	
	for (var i=0; i<commands.length; i++) {
		commands[i].exec()
	}
	updateTurtle()
}

function setUpSVG() {
	svg = d3.select("#turtleSVG")
	svg.attr("viewBox", svgViewboxX+" "+svgViewboxY+" "+svgViewboxWidth+" "+svgViewboxHeight)
		.attr("width", svgWidth).attr("height", svgHeight)
	
	paintingG = svg.append("g").attr("id", "paintingG")
	
	turtleHomeCursor = svg.append("g").attr("id", "turtleHomeCursor")
	turtleHomeCursor.append("path").attr("d", "M1,1 L0,-2 L-1,1 Z").style(turtleHomeStyle)
		
	turtleCursor = svg.append("g").attr("id", "turtleCursor")
	updateTurtle()
	turtleCursor.append("path").attr("d", "M1,1 L0,-2 L-1,1 Z").style(turtleStyle)
	
	function zoom(event) {
		var wheelMovement = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail)))
		// ok, I cheated a bit ...
		d3.event = event
		var mouse = d3.mouse(document.getElementById("turtleSVG"))
		
		var xDelta = svgViewboxWidth * (wheelMovement < 0 ? zoomFactor-1 : -(1-1/zoomFactor))
		var yDelta = svgViewboxHeight * (wheelMovement < 0 ? zoomFactor-1 : -(1-1/zoomFactor))
		// zoom towards the current mouse position
		var relX = (mouse[0]-svgViewboxX)/svgViewboxWidth // in [0,1]
		var relY = (mouse[1]-svgViewboxY)/svgViewboxHeight // in [0,1]
		svgViewboxX -= xDelta * relX
		svgViewboxY -= yDelta * relY
		svgViewboxWidth += xDelta
		svgViewboxHeight += yDelta
		
		svg.attr("viewBox", svgViewboxX+" "+svgViewboxY+" "+svgViewboxWidth+" "+svgViewboxHeight)
		d3.event = null
	}
	
	var domSvg = document.getElementById("turtleSVG")
	// IE9, Chrome, Safari, Opera
	domSvg.addEventListener("mousewheel", zoom, false)
	// Firefox
	domSvg.addEventListener("DOMMouseScroll", zoom, false)
	
	function switchMouseButton(evt, on) {
		if (mouseMap[evt.button] !== undefined)
			mousePressed[mouseMap[evt.button]] = on
	}
	document.body.onmousedown = function(evt) { switchMouseButton(evt, true) }
	document.body.onmouseup = function(evt) { switchMouseButton(evt, false) }
	
	svg.call(d3.behavior.drag()
		.on("drag", function (d) {
			if (mousePressed.middle) {
				svgViewboxX -= toCanvasCoordsDX(d3.event.dx)
				svgViewboxY -= toCanvasCoordsDY(d3.event.dy)
				svg.attr("viewBox", svgViewboxX+" "+svgViewboxY+" "+svgViewboxWidth+" "+svgViewboxHeight)
			}
		})
	)
	
	svg.on("mousemove", function (d, i) {
		if (keyPressed.d) {
			var mouse = d3.mouse(this)
			var x = mouse[0]
			var y = mouse[1]
			var dx = x-state.x
			var dy = y-state.y
			previewLine.attr("x2", x).attr("y2", y)
			var lineLength = Math.sqrt(dx*dx+dy*dy)
			updatePreviewAngle(dx, dy, lineLength)
		}
    })
	
	svg.on("click", function (d, i) {
		if (keyPressed.d) {
			var mouse = d3.mouse(this)
			var x = mouse[0]
			var y = mouse[1]
			var dx = x-state.x
			var dy = y-state.y
			var lineLength = Math.sqrt(dx*dx+dy*dy)
			
			var r = rotate(getAngleDeltaTo(dx, dy))
			commands.push(r)
			r.exec()
			var m = move(lineLength)
			commands.push(m)
			m.exec()
			
			updatePreviewAngle(dx, dy, lineLength)
			previewLine.attr("x1", state.x).attr("y1", state.y)
			updateTurtle()
		} else {
			selection.deselectAll()
		}
    })
	
	d3.select("body")
		.on("keydown", function() { updateKeyDownAndUp(d3.event.keyCode, true) })
		.on("keyup", function() { updateKeyDownAndUp(d3.event.keyCode, false) })
}

function updatePreviewAngle(dx, dy, lineLength) {
	var arc = d3.svg.arc()
		.innerRadius(0)
		.outerRadius(Math.min(7, lineLength/2))
		.startAngle(state.r)
		.endAngle(state.r + getAngleDeltaTo(dx, dy))

	previewArc.attr("d", arc).attr("transform", "translate("+state.x+", "+state.y+")")
}

function getAngleDeltaTo(dx, dy, r) {
	return correctRadius(Math.atan2(dy, dx) + Math.PI/2 - (r === undefined ? state.r : r))
}

function updateTurtle() {
	turtleCursor.attr("transform", "translate("+state.x+", "+state.y+") rotate("+(state.r/Math.PI*180)+")")
}

function move(length) {
	var self = {}
	self.length = length
	self.line = undefined
	self.label = undefined
	self.shallowClone = function() {
		return move(length)
	}
	self.exec = function() {
		var x1 = state.x
		var y1 = state.y
		state.x += Math.sin(state.r) * self.length
		state.y -= Math.cos(state.r) * self.length
		var x2 = state.x
		var y2 = state.y
		if (self.line === undefined) {
			self.line = paintingG.append("line").style(lineStyle)
		}
		self.line
			.attr("x1", x1).attr("y1", y1)
			.attr("x2", x2).attr("y2", y2)
	}
	return self
}

function rotate(angle) {
	var self = {}
	self.angle = angle
	self.arc = undefined
	self.label = undefined
	self.savedState = undefined
	self.shallowClone = function() {
		return rotate(angle)
	}
	self.exec = function() {
		if (self.savedState === undefined) { // clone state
			self.savedState = cloneS(state)
		}
		var arc = d3.svg.arc()
			.innerRadius(0)
			.outerRadius(7)
			.startAngle(state.r)
			.endAngle(state.r + angle)
		state.addRadius(angle)
		
		if (self.arc === undefined) {
			self.arc = paintingG.append("path").style(arcStyle)
			self.arc.on("mouseenter", function (d, i) {
				if (!dragInProgress)
					self.arc.style({fill: "#f00"})
			})
			self.arc.on("mouseleave", function (d, i) {
				self.arc.style(arcStyle)
			})
			self.arc.on("click", function (d, i) {
				self.select()
				// to prevent click on background
				d3.event.stopPropagation()
			})
			self.arc.call(d3.behavior.drag()
				.on("dragstart", function (d) {
					dragInProgress = true
					self.select()
					d3.select(this).classed("dragging", true)
					// to prevent drag on background
					d3.event.sourceEvent.stopPropagation()
				})
				.on("drag", function (d) {
					state = cloneS(self.savedState)
					
					var x = d3.event.x
					var y = d3.event.y
					var dx = x-state.x
					var dy = y-state.y
					var angleDelta = getAngleDeltaTo(dx, dy)
					var arc = d3.svg.arc()
						.innerRadius(0)
						.outerRadius(7)
						.startAngle(state.r)
						.endAngle(state.r + angleDelta)
					state.addRadius(angleDelta)
					
					self.arc.attr("d", arc)
					// propagate change
					for (var i=commands.indexOf(self)+1; i<commands.length; i++) {
						commands[i].savedState = undefined
						commands[i].exec()
					}
					updateTurtle()
				})
				.on("dragend", function (d) {
					dragInProgress = false
					d3.select(this).classed("dragging", false)
				})
			)
		}
		
		self.arc
			.attr("d", arc)
			.attr("transform", "translate("+state.x+","+state.y+")")
	}
	self.select = function() {
		selection.add(self)
		self.arc.classed("selected", true)
	}
	self.deselect = function() {
		self.arc.classed("selected", false)
	}
	self.remove = function() {
		self.deselect()
		// TODO
	}
	return self
}

function loop(numberOfRepetions, commands) {
	var loop = {}
	loop.numberOfRepetions = numberOfRepetions
	loop.commandsInsideLoop = commands
	loop.commandsAll = []
	loop.savedState = undefined
	loop.exec = function() {
		if (loop.savedState === undefined) {
			loop.savedState = cloneS(state)
		}
		for (var i=0; i<loop.numberOfRepetions; i++) {
			for (var k=0; k<loop.commandsInsideLoop.length; k++) {
				if (loop.commandsAll.length <= i*loop.commandsInsideLoop.length + k)
					loop.commandsAll.push(loop.commandsInsideLoop[k].shallowClone())
			}
		}
		for (var i=0; i<loop.commandsAll.length; i++) {
			loop.commandsAll[i].exec()
		}
	}
	return loop
}

function correctRadius(r) {
	var isPositive = r > 0
	var divIsUneven = Math.floor(Math.abs(r / Math.PI)) % 2 === 1
	// into bounds
	r = r % Math.PI
	
	// it overshot into the opposite 180°
	if (divIsUneven)
		r = (isPositive ? -1 : 1)* Math.PI + r
	console.assert(r >= -Math.PI && r <= Math.PI)
	return r
}

function toCanvasCoordsX(x) { return svgViewboxX+x*(svgViewboxWidth/svgWidth) }
function toCanvasCoordsY(y) { return svgViewboxY+y*(svgViewboxHeight/svgHeight) }
function toCanvasCoordsDX(x) { return x*(svgViewboxWidth/svgWidth) }
function toCanvasCoordsDY(y) { return y*(svgViewboxHeight/svgHeight) }

function updateKeyDownAndUp(keyCode, down) {
	switch (keyCode) {
		case keyMap.d:
			if (down && !keyPressed.d) {
				previewArc = paintingG.append("path")
					//.attr("d", arc) // TODO where do I get dy and dx from?
					.attr("transform", "translate("+state.x+","+state.y+")")
					.style(arcStyle)
				
				previewLine = paintingG.append("line")
					.attr("x1", state.x).attr("y1", state.y)
					.style(lineStyle)
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
		case keyMap["+"]: keyPressed["+"] = down; break
		case keyMap["-"]: keyPressed["-"] = down; break
		case keyMap.p: keyPressed.p = down; break
		case keyMap.del:
			if (down && !keyPressed.del) {
				selection.removeAll()
			}
			keyPressed.del = down
			break
		default: console.log("key fell through: "+keyCode); break
	}
}

return ma
}()