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
var clockStyle = {fill: "none", stroke: "#777", "stroke-width": ".15"}
var clockHandStyle = {fill: "#000", "fill-opacity": 0.2}
var textStyle = {fill: "#666", "font-family": "Open Sans", "font-size": "1.5px", "text-anchor": "middle"}
const loopClockRadius = 1.3
const rotationArcRadius = 6

var paintingG
var previewLine
var previewArc

var functions = []
var commands = [
	new Rotate(1), new Move(10), new Loop(3, [new Loop(3, [new Rotate(-0.5), new Move(7)])])
]

var dragInProgress = false
var turtleHomeCursor
var turtleCursor
// r: 0 is North, -Math.PI/2 is West. r is in [-Pi, Pi].
const homeX = 0, homeY = 0, homeR = 0
var state = {x: homeX, y:homeY, r:homeR, addRadius: function(rr) {
		if (rr > Math.PI || rr < -Math.PI)
			console.log("Warning: addRadius: rr out of [-Pi, Pi]")
		this.r += rr
		this.r = correctRadius(this.r)
	},
	reset: function() { this.x = homeX; this.y = homeY; this.r = homeR }
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
	run()
}

function run() {
	state.reset()
	for (var i=0; i<commands.length; i++) {
		commands[i].savedState = undefined
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
			
			var r = new Rotate(getAngleDeltaTo(dx, dy))
			commands.push(r)
			r.exec()
			var m = new Move(lineLength)
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

function Move(length) {
	var self = this
	self.length = length
	self.parent
	self.line
	self.label
}

Move.prototype.shallowClone = function() {
	var c = new Move(this.length)
	c.parent = this
	return c
}

Move.prototype.exec = function() {
	var self = this
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




function Rotate(angle) {
	var self = this
	self.angle = angle
	self.parent
	self.savedState
	self.arc
	self.label
}
// TODO "Command" Prototype
Rotate.prototype.shallowClone = function() {
	var c = new Rotate(this.angle)
	c.parent = this
	return c
}

Rotate.prototype.getAngle = function() {
	var c = new Rotate(this.angle)
	c.parent = this
	return c
}

Rotate.prototype.exec = function() {
	var self = this
	var root = self
	while (root.parent !== undefined)
		root = root.parent
	if (self.savedState === undefined) { // clone state
		self.savedState = cloneS(state)
	}
	var dragStartState
	
	var arc = d3.svg.arc()
		.innerRadius(0)
		.outerRadius(rotationArcRadius)
		.startAngle(state.r)
		.endAngle(state.r + root.angle)
	state.addRadius(root.angle)
	
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
				dragStartState = cloneS(self.savedState)
				d3.select(this).classed("dragging", true)
				// to prevent drag on background
				d3.event.sourceEvent.stopPropagation()
			})
			.on("drag", function (d) {
//				state = cloneS(self.savedState)
				
				var x = d3.event.x
				var y = d3.event.y
				var dx = x-dragStartState.x
				var dy = y-dragStartState.y
				var angleDelta = getAngleDeltaTo(dx, dy, dragStartState.r)
				root.angle = angleDelta
				run()
			})
			.on("dragend", function (d) {
				dragInProgress = false
				d3.select(this).classed("dragging", false)
			})
		)
	}
	
	if (self.label === undefined) {
		self.label = paintingG.append("text").style(textStyle)
	}
	
	var dir = correctRadius(state.r - root.angle/2)
	var x = state.x + Math.sin(dir) * rotationArcRadius * .6
	var y = state.y - Math.cos(dir) * rotationArcRadius * .6 + .5 // vertical alignment
	
	self.label
		.text(Math.round(root.angle/Math.PI*180))
		.attr("transform", "translate("+x+","+y+")")
	self.arc
		.attr("d", arc)
		.attr("transform", "translate("+state.x+","+state.y+")")
}

Rotate.prototype.select = function() {
	selection.add(this)
	this.arc.classed("selected", true)
}

Rotate.prototype.deselect = function() {
	this.arc.classed("selected", false)
}

Rotate.prototype.remove = function() {
	this.deselect()
	// TODO
}





function Loop(numberOfRepetitions, commands) {
	var self = this
	self.numberOfRepetitions = numberOfRepetitions
	self.commandsInsideLoop = commands
	self.parent
	// "unfolded" loop
	self.commandsAll = []
	self.savedState
	// for all repetitions
	self.iconGs = []
}

Loop.prototype.shallowClone = function() {
	var c = new Loop(this.numberOfRepetitions, this.commandsInsideLoop)
	c.parent = this
	return c
}

Loop.prototype.exec = function() {
	var self = this
	var root = self
	var numberOfLoopParents = 0
	while (root.parent !== undefined) {
		root = root.parent
		numberOfLoopParents++
	}
	// shrink inner loops radius
	var loopClockRadiusUsed = loopClockRadius/(numberOfLoopParents+1)
	
	if (self.savedState === undefined) {
		self.savedState = cloneS(state)
	}
	
	for (var i=0; i<self.numberOfRepetitions; i++) {
		if (self.iconGs.length <= i) {
			var iconG = paintingG.append("g")
			self.iconGs.push(iconG)
			
			var arc = d3.svg.arc()
				.innerRadius(0)
				.outerRadius(loopClockRadiusUsed)
				.startAngle(0)
				.endAngle(Math.PI*2/self.numberOfRepetitions*(i+1))
			iconG.append("path")
				.attr("d", arc)
				.style(clockHandStyle)
				
			iconG.append("circle")
				.attr("cx", 0).attr("cy", 0).attr("r", loopClockRadiusUsed)
				.style(clockStyle)
				
			iconG.append("text").style(textStyle)
		}
		
		// TODO consider line-in and -out diretion for angle
		// place center away from current position in 90° angle to current heading
		var dir = correctRadius(state.r + Math.PI/2)
		var cx = state.x + Math.sin(dir) * loopClockRadius * 1.4
		var cy = state.y - Math.cos(dir) * loopClockRadius * 1.4
		self.iconGs[i].attr("transform", "translate("+cx+","+cy+")")
		
		for (var k=0; k<self.commandsInsideLoop.length; k++) {
			var pos = i*self.commandsInsideLoop.length + k
			if (self.commandsAll.length <= pos) {
//				self.commandsInsideLoop[k].parent = self
				self.commandsAll.push(self.commandsInsideLoop[k].shallowClone())
			}
			self.commandsAll[pos].exec()
		}
	}
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