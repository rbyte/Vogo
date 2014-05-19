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

var ma = function() {// spans everything - not indented
"use strict";
var ma = {}

// CONSTANTS (const not supported in strict mode)
var turtleHomeStyle = {fill: "none", stroke: "#d07f00", "stroke-width": ".2", "stroke-linecap": "round"}
var turtleStyle = {fill: "#ffba4c", "fill-opacity": 0.6, stroke: "none"}
var lineStyle = {stroke: "#000", "stroke-width": ".25", "stroke-linecap": "round"}
var arcStyle = {fill: "#000", "fill-opacity": 0.1}
var clockStyle = {fill: "none", stroke: "#777", "stroke-width": ".05"}
var clockHandStyle = {fill: "#000", "fill-opacity": 0.2}
var textStyle = {fill: "#666", "font-family": "Open Sans", "font-size": "1.5px", "text-anchor": "middle"}

var zoomFactor = 1.3
var zoomTransitionDuration = 150
var loopClockRadius = 1.3
var rotationArcRadius = 6
// TODO delete
var drawLoopInPreview = false

var turtleHomeCursorPath = "M1,1 L0,-2 L-1,1 Z"
// http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
var keyMap = { 65: "a", 68: "d", 83: "s", 69: "e", 70: "f", 71: "g", 82: "r", 107: "+", 109: "-", 80: "p", 46: "del", 27: "esc" }
var mouseMap = { 0: "left", 1: "middle", 2: "right" }

// VARIABLES
var onKeyDown = {}
var onKeyUp = {}
var keyPressed = {}
for (var k in keyMap)
	keyPressed[keyMap[k]] = false
var mousePressed = {}
for (var m in mouseMap)
	mousePressed[mouseMap[m]] = false
function updateKeyDownAndUp(keyCode, down) {
	if (document.activeElement.nodeName !== "INPUT") {
		var key = keyMap[keyCode]
		if (key) {
			var currentDown = keyPressed[key]
			keyPressed[key] = down
			if (down && !currentDown && onKeyDown[key])
				onKeyDown[key]()
			if (!down && currentDown && onKeyUp[key])
				onKeyUp[key]()
		} else {
			console.log(keyCode+" not in keymap.")
		}
	}
}

var mainSVG
var functions = []
// the function that is currently selected
var F_

var functionPanelSizePercentOfBodyWidth = 0.2
var lastNotificationUpdateTime
var dragInProgress = false
var mousePos = [0,0]
var mousePosPrevious = [0,0]



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
			// TODO splice from commands (what is its f?)
			selection.e.removeFromMainSVG()
			selection.e = undefined
		}
	}
}

ma.init = function() {
	mainSVG = new MainSVG()
	
	F_ = new Function()
	functions.push(F_)
	F_.svgContainer.classed("fSVGselected", true)
	F_.addArgument(5)
	
//	F_.setCommands([])
	
//	F_.setCommands([
//		new Rotate(1),
//		new Move(10),
//		new Loop(2, [
//			new Loop(2, [
//				new Loop(2, [
//					new Rotate(-0.5),
//					new Move(7)
//				])
//			])
//		])
//	])
	F_.setCommands([
		new Rotate(1),
		new Move("a*2"),
		new Loop(3, [
			new Rotate(-0.5),
			new Move(7)
		])
	])
	
	d3.select("#f_addNew").on("click", function() {
		var f = new Function()
		functions.push(f)
		f.switchTo()
	})
	
	setup()
	run()
	
//	var f = new Function()
//	functions.push(f)
//	f.setCommands([
//		new Rotate(1),
//		new Move(10),
//		new FunctionCall(functions[0])
//	])
//	f.switchTo()
	
}

function run() {
	F_.state.reset()
	for (var i=0; i<F_.commands.length; i++) {
		F_.commands[i].savedState = undefined
		F_.commands[i].exec(F_)
	}
	F_.updateTurtle()
	mainSVG.updateTurtle()
	
	for (var fi=0; fi<functions.length; fi++) {
		if (functions[fi] !== F_) {
			functions[fi].state.reset()
			functions[fi].exec()
		}
	}
}

function updateScreenElemsSize() {
//	var winW = document.body.clientWidth
//	var winH = window.innerHeight
	
	var bb = document.getElementById("turtleSVGcontainer").getBoundingClientRect()
	mainSVG.svgWidth = bb.width
	mainSVG.svgHeight = bb.height
	
	for (var i=0; i<functions.length; i++)
		functions[i].updateViewbox()
	mainSVG.updateViewbox()
}

function updatePanelSize() {
	d3.select("#border").style("left", functionPanelSizePercentOfBodyWidth*100+"%", "important")
	d3.select("#functions").style("width", functionPanelSizePercentOfBodyWidth*100+"%", "important")
	d3.select("#turtleSVGcontainer").style("width", (1-functionPanelSizePercentOfBodyWidth)*100+"%", "important")
	window.onresize()
}




function MainSVG() {
	var self = this
	self.svgWidth
	self.svgHeight
	self.svg = d3.select("#turtleSVG").attr("xmlns", "http://www.w3.org/2000/svg")
	self.svgInit()
}

function setup() {
	var domSvg = document.getElementById("turtleSVG")
	
	window.onresize = function(event) {
		updateScreenElemsSize()
	}
//	updatePanelSize()
	window.onresize()
	
	d3.select("#border").call(d3.behavior.drag()
		.on("drag", function (d) {
			functionPanelSizePercentOfBodyWidth = Math.max(0.1, Math.min(0.4,
				d3.event.x / document.body.clientWidth))
			updatePanelSize()
		})
	)
	
	function zoom(event) {
		var wheelMovement = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail)))
		// ok, I cheated a bit ...
		d3.event = event
		var mouse = d3.mouse(domSvg)
		
		var xDelta = F_.svgViewboxWidth * (wheelMovement < 0 ? zoomFactor-1 : -(1-1/zoomFactor))
		var yDelta = F_.svgViewboxHeight * (wheelMovement < 0 ? zoomFactor-1 : -(1-1/zoomFactor))
		// zoom towards the current mouse position
		var relX = (mouse[0]-F_.svgViewboxX)/F_.svgViewboxWidth // in [0,1]
		var relY = (mouse[1]-F_.svgViewboxY)/F_.svgViewboxHeight // in [0,1]
		F_.svgViewboxX -= xDelta * relX
		F_.svgViewboxY -= yDelta * relY
		F_.svgViewboxWidth += xDelta
		F_.svgViewboxHeight += yDelta
		
		F_.updateViewbox("afterZoom")
		mainSVG.updateViewbox("afterZoom")
		d3.event = null
	}
	
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
	
	mainSVG.svg.call(d3.behavior.drag()
		.on("drag", function (d) {
			if (mousePressed.middle) {
				F_.svgViewboxX -= d3.event.dx*(F_.svgViewboxWidth/mainSVG.svgWidth)
				F_.svgViewboxY -= d3.event.dy*(F_.svgViewboxHeight/mainSVG.svgHeight)
				F_.updateViewbox()
				mainSVG.updateViewbox()
			}
		})
	)
	
	mainSVG.svg.on("mousemove", function (d, i) {
		// TODO needed?
		mousePosPrevious = mousePos
		mousePos = d3.mouse(this)
		if (manipulation.isCreating(Move))
			manipulation.update(Move)
		if (manipulation.isCreating(Rotate))
			manipulation.update(Rotate)
    })
	
	mainSVG.svg.on("click", function (d, i) {
//		mousePos = d3.mouse(this)
		console.assert(d3.mouse(this)[0]-mousePos[0] === 0)
		if (manipulation.isCreating(Move)) {
			if (keyPressed.d) {
				manipulation.create(Move)
			} else {
				manipulation.finish(Move)
			}
		} else if (manipulation.isCreating(Rotate)) {
			if (keyPressed.r) {
				manipulation.create(Rotate)
			} else {
				manipulation.finish(Rotate)
			}
		} else {
			selection.deselectAll()
		}
    })
	
	d3.select("body")
		.on("keydown", function() { updateKeyDownAndUp(d3.event.keyCode, true) })
		.on("keyup", function() { updateKeyDownAndUp(d3.event.keyCode, false) })
}

function State() {
	this.reset()
}

State.prototype.addRadius = function(rr) {
	if (rr > Math.PI || rr < -Math.PI)
		console.log("Warning: addRadius: rr out of [-Pi, Pi]")
	this.r += rr
	this.r = correctRadius(this.r)
}

State.prototype.reset = function() {
	this.x = 0
	this.y = 0
	// r: 0 is North, -Math.PI/2 is West. r is in [-Pi, Pi].
	this.r = 0
}

State.prototype.clone = function() {
	var s = new State()
	s.x = this.x
	s.y = this.y
	s.r = this.r
	return s
}

function Function(name) {
	var self = this
	self.state = new State()
	
	self.svgViewboxWidth
	self.svgViewboxHeight = 100 // fix on startup
	self.svgViewboxX
	self.svgViewboxY
	self.svgWidth
	self.svgHeight
	
	self.commands = []
	self.args = {}
	
	self.li_f = d3.select("#ul_f").append("li")//.attr("id", "f_"+self.name)
	// this complicated wrapping is sadly necessary
	// http://stackoverflow.com/questions/17175038/css-dynamic-length-text-input-field-and-submit-button-in-one-row
	var titleRow = self.li_f.append("div").attr("class", "titleRow")
	
	self.nameInput = titleRow.append("div").attr("class", "titleRowCell")
		.append("input")
		.attr("class", "f_name")
		.attr("type", "text")
		.on("blur", function() {
			self.setName(this.value)
		})
		.on("keypress", function() {
			if (d3.event.keyCode === /*enter*/ 13)
				self.setName(this.value)
		})
		.on("input", function() {
			self.nameInput.classed({"inputInEditState": true})
			self.checkName(this.value)
		})
	self.setName(name)
	
	titleRow.append("div").attr("class", "titleRowCell")
		.append("button").attr("class", "f_remove").text("x")
		.on("click", function() {
			// TODO dependency check
			if (functions.length > 1) {
				self.remove()
			} else {
				updateNotification("There has to be at least one function.")
			}
		})
	self.ul_args = self.li_f.append("ul").attr("class", "ul_args")
	
	self.svgContainer = self.li_f.append("div").attr("class", "fSVGcontainer")
	self.svg = self.svgContainer.append("svg").attr("class", "fSVG")
		.attr("xmlns", "http://www.w3.org/2000/svg")
	self.svg.on("click", function() {
		self.switchTo()
	})
	
	self.svgInit()
	return self
}

MainSVG.prototype.svgInit = Function.prototype.svgInit = function() {
	var self = this
	self.paintingG = self.svg.append("g").attr("class", "paintingG")
	
	self.turtleHomeCursor = self.svg.append("g").attr("class", "turtleHome")
	self.turtleHomeCursor.append("path").attr("d", turtleHomeCursorPath).style(turtleHomeStyle)
	
	self.turtleCursor = self.svg.append("g").attr("class", "turtle")
	self.turtleCursor.append("path").attr("d", turtleHomeCursorPath).style(turtleStyle)
}

MainSVG.prototype.updateTurtle = function() {
	var self = this
	self.turtleCursor.attr("transform", "translate("+F_.state.x+", "+F_.state.y+") rotate("+(F_.state.r/Math.PI*180)+")")
}

Function.prototype.updateTurtle = function() {
	var self = this
	self.turtleCursor.attr("transform", "translate("+self.state.x+", "+self.state.y+") rotate("+(self.state.r/Math.PI*180)+")")
}

function updateViewboxFor(obj, ref, afterZoom) {
	console.assert(ref !== undefined && !isNaN(ref.svgViewboxX) && !isNaN(ref.svgViewboxY)
		&& ref.svgViewboxWidth > 0 && ref.svgViewboxHeight > 0)
	function applyTransition() {
		return afterZoom === undefined ? obj : obj.transition().duration(zoomTransitionDuration)
	}
	applyTransition(obj).attr("viewBox", ref.svgViewboxX+" "+ref.svgViewboxY+" "+ref.svgViewboxWidth+" "+ref.svgViewboxHeight)
}

MainSVG.prototype.updateViewbox = function(afterZoom) {
	updateViewboxFor(this.svg, F_, afterZoom)
}

Function.prototype.updateViewbox = function(afterZoom) {
	var self = this
		// [0][0] gets the dom element
	// the preview svg aspect ratio is coupled to the main svg
	self.svgWidth = self.svgContainer[0][0].getBoundingClientRect().width
	self.svgHeight = self.svgWidth * mainSVG.svgHeight/mainSVG.svgWidth
	self.svgContainer.style({height: self.svgHeight+"px"})
	
	console.assert(self.svgWidth > 0 && self.svgViewboxHeight > 0 && mainSVG.svgWidth > 0 && mainSVG.svgHeight > 0)
	// keep height stable and center (on startup to 0,0)
	var svgViewboxWidthPrevious = self.svgViewboxWidth
	self.svgViewboxWidth = self.svgViewboxHeight * mainSVG.svgWidth/mainSVG.svgHeight
	if (svgViewboxWidthPrevious !== undefined)
		self.svgViewboxX -= (self.svgViewboxWidth - svgViewboxWidthPrevious)/2
	if (self.svgViewboxX === undefined)
		self.svgViewboxX = -self.svgViewboxWidth/2
	if (self.svgViewboxY === undefined)
		self.svgViewboxY = -self.svgViewboxHeight/2
	
	updateViewboxFor(self.svg, self, afterZoom)
}

Function.prototype.checkName = function(newName) {
	var regEx = /^[a-zA-Zα-ω][a-zA-Zα-ω0-9]*$/
	if (!newName.match(regEx)) {
		this.nameInput.classed({"inputInWrongState": true})
		updateNotification("The function name has to be alphanumeric and start with a letter: "+regEx)
		return false
	}
	// check for duplicates
	for (var i=0; i<functions.length; i++) {
		if (functions[i] !== this && functions[i].name === newName) {
			this.nameInput.classed({"inputInWrongState": true})
			updateNotification("Function name duplication.")
			return false
		}
	}
	this.nameInput.classed({"inputInWrongState": false})
	hideNotification()
	return true
}

Function.prototype.searchForName = function(charCodeStart, range, checkFunction, s, depth) {
	if (depth === 0)
		return (checkFunction(s) ? s : false)
	for (var i=0; i<range; i++) {
		var r = this.searchForName(charCodeStart, range, checkFunction, s + String.fromCharCode(charCodeStart+i), depth-1)
		if (r !== false)
			return r
	}
	return this.searchForName(charCodeStart, range, checkFunction, s, depth+1)
}

Function.prototype.setName = function(newName) {
	var self = this
	if (newName === undefined) {
		newName = self.searchForName(945/*=α*/, 26/*=ω*/, function (s) { return self.checkName(s) }, "", 1)
	}
	
	var r = self.checkName(newName)
	if (r)
		self.name = newName
	self.nameInput.property("value", self.name)
	self.nameInput.classed({"inputInEditState": false, "inputInWrongState": false})
	hideNotification()
	return r
}

Function.prototype.checkArgumentName = function(newName) {
	var regEx = /^[a-zA-Z][a-zA-Z0-9]*$/
	if (!newName.match(regEx)) {
		updateNotification("The argument name has to be alphanumeric and start with a letter: "+regEx)
		return false
	}
	// check for duplicates
	for (var name in this.args) {
		if (name === newName) {
			updateNotification("Argument name duplication.")
			return false
		}
	}
	hideNotification()
	return true
}

Function.prototype.addArgument = function(defaultValue, argName) {
	var self = this
	if (argName === undefined)
		argName = self.searchForName(97/*=a*/, 26/*=z*/, function (s) { return self.checkArgumentName(s) }, "", 1)
	
	var r = self.checkArgumentName(argName)
	if (r)
		this.args[argName] = defaultValue
	this.ul_args.append("li").text(argName+"=")//.append("span").text("="+defaultValue)
		.append("input")
		.attr("class", "f_name")
		.attr("type", "text")
		.on("blur", function() {
			self.args[argName] = this.value
			run()
		})
		.on("keypress", function() {
			if (d3.event.keyCode === /*enter*/ 13) {
				self.args[argName] = this.value
				run()
			}
		})
		.on("input", function() {
			
		})
		.property("value", defaultValue)
	
	
	return r ? argName : false
}

Function.prototype.setCommands = function(commands) {
	console.assert(commands instanceof Array)
	var self = this
	self.commands = commands
	for (var i=0; i<self.commands.length; i++)
		self.commands[i].scope = self
	return self
}

Function.prototype.exec = function() {
	var self = this
	for (var i=0; i<self.commands.length; i++)
		self.commands[i].exec(self)
	self.updateTurtle()
}

Function.prototype.switchTo = function() {
	var self = this
	if (F_ !== undefined) {
		self.previousF_ = F_
		F_.svgContainer.classed("fSVGselected", false)
		for (var i=0; i<F_.commands.length; i++)
			F_.commands[i].removeFromMainSVG()
	}
	F_ = self
	F_.svgContainer.classed("fSVGselected", true)
	F_.updateViewbox()
	mainSVG.updateViewbox()
	run()
}

Function.prototype.remove = function() {
	var self = this
	
	functions.splice(functions.indexOf(self), 1)
	if (F_ === self) {
		if (self.previousF_ !== undefined && functions.indexOf(self.previousF_) !== -1)
			F_ = self.previousF_
		else
			F_ = functions[functions.length-1]
		F_.switchTo()
	}
	
	for (var i=0; i<self.commands.length; i++)
		self.commands[i].remove()
	for (var i=self.commands.length-1; i>=0; i--)
		delete self.commands[i]
	
	// contains everything
	self.li_f.remove()
	delete self.svg
	delete self.nameInput
	delete self.ul_args
	delete self.svgContainer
	delete self.li_f
	delete self.previousF_
}

Function.prototype.setStateTo = function(idx) {
	var self = this
	// if idx is negative, counts backwards from last element
	// idx = 0 -> first element
	// idx = -1 -> last element
	if ((idx >= 0 && idx >= self.commands.length) || (idx < 0 && -idx > self.commands.length)) {
		self.state.reset()
	} else {
		var s = self.commands[(idx < 0 ? self.commands.length + idx : idx)].savedState
		if (s)
			self.state = s.clone()
		else
			console.log("setStateTo: savedState not set. doing nothing.")
	}
}


var manipulation = {
	insertedCommand: false
}

manipulation.isCreating = function(cmdType) {
	return cmdType === undefined
		? this.insertedCommand !== false
		: this.insertedCommand instanceof cmdType
}

manipulation.create = function(cmdType) {
	if (this.isCreating(cmdType)) {
		this.finish(cmdType)
		this.createPreview(cmdType)
	} else {
		this.createPreview(cmdType)
		this.finish(cmdType)
	}
}

manipulation.createPreview = function(cmdType) {
	console.assert(!this.isCreating(cmdType))
	if (selection.isEmpty()) {
		this.insertedCommand = new cmdType()
		this.insertedCommand.scope = F_
		this.savedState = F_.state.clone()
		F_.commands.push(this.insertedCommand)
	} else {
		var sScope = selection.e.root.scope
//		console.assert(sScope === F_)
		var cmdSelIdx = sScope.commands.indexOf(selection.e.root)
		console.assert(cmdSelIdx != -1)
//		this.savedState = sScope.commands[cmdSelIdx].savedState.clone()
		this.savedState = selection.e.savedState.clone()
		this.insertedCommand = new cmdType()
		this.insertedCommand.scope = sScope
		console.assert(sScope instanceof Loop)
		sScope.commands.splice(cmdSelIdx, 0, this.insertedCommand)
	}
	this.update(cmdType)
}

manipulation.update = function(cmdType) {
	if (this.isCreating(cmdType)) {
		F_.state = this.savedState.clone()
		if (cmdType === Move)
			this.insertedCommand.setMainParameter(getLineLengthToWithoutChangingDirection(mousePos))
		else if (cmdType === Rotate)
			this.insertedCommand.setMainParameter(rotateAngleTo(mousePos))
		else
			console.assert(false)
		
		if (selection.isEmpty()) {
			this.insertedCommand.exec(F_)
			F_.updateTurtle()
			mainSVG.updateTurtle()
		} else {
			run()
		}
	} else {
		// this happens when update is called before draw, when body is not selected
		// because update is called, but key press is supressed
		this.createPreview(cmdType)
		console.log("manipulation.update: warning: no preview exists yet")
	}
}

manipulation.finish = function(cmdType) {
	console.assert(this.isCreating(cmdType))
	this.update(cmdType)
	this.insertedCommand = false
}

manipulation.remove = function(cmdType) {
	console.assert(this.isCreating(cmdType))
	
	var idx = this.insertedCommand.scope.commands.indexOf(this.insertedCommand)
	this.insertedCommand.scope.commands.splice(idx, 1)
	this.insertedCommand.remove()
	this.insertedCommand = false
	if (selection.isEmpty()) {
		F_.state = this.savedState.clone()
		F_.updateTurtle()
		mainSVG.updateTurtle()
	} else {
		run()
	}
}



function rotateAngleTo(mousePos) {
	var dx = mousePos[0] - F_.state.x
	var dy = mousePos[1] - F_.state.y
	return getAngleDeltaTo(dx, dy)
}

function getAngleDeltaTo(dx, dy, r) {
	return correctRadius(Math.atan2(dy, dx) + Math.PI/2 - (r === undefined ? F_.state.r : r))
}

function getLineLengthTo(mousePos) {
	var dx = mousePos[0] - F_.state.x
	var dy = mousePos[1] - F_.state.y
	return Math.sqrt(dx*dx + dy*dy)
}

function getLineLengthToWithoutChangingDirection(mousePos) {
	var ra = rotateAngleTo(mousePos)
	return (ra > Math.PI/2 || ra < Math.PI/2 ? 1 : -1) * Math.cos(ra) * getLineLengthTo(mousePos)
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

function hideNotification() {
	d3.select("#notification").classed({"opacity0": true})
}

function updateNotification(text, displayTime) {
	lastNotificationUpdateTime = new Date().getTime()
	if (displayTime > 0) // && !== undefined
		setTimeout(function() {
			var tDeltaMS = new Date().getTime() - lastNotificationUpdateTime
			if (tDeltaMS >= displayTime)
				hideNotification()
		}, displayTime)
	
	d3.select("#notification").classed({"opacity0": false})
	d3.select("#notification").text(text)
}

function openSVG() {
	var svg = document.getElementById("turtleSVG")
	window.open("data:image/svg+xml," + encodeURIComponent(
	// http://stackoverflow.com/questions/1700870/how-do-i-do-outerhtml-in-firefox
		svg.outerHTML || new XMLSerializer().serializeToString(svg)
	))
}

function isRegularNumber(n) {
	// typeof n == "number" not needed
	return !isNaN(n) && isFinite(n)
}

function bodyIsSelected() {
	return document.activeElement.nodeName === "BODY"
}

onKeyDown.d = function() {
	if (bodyIsSelected() && !manipulation.isCreating())
		manipulation.createPreview(Move)
}

onKeyDown.r = function() {
	if (bodyIsSelected() && !manipulation.isCreating())
		manipulation.createPreview(Rotate)
}

onKeyDown.s = function() {
	if (bodyIsSelected())
		openSVG()
}

onKeyDown.del = function() {
	if (bodyIsSelected())
		selection.removeAll()
}

onKeyDown.esc = function() {
	if (manipulation.isCreating(Move))
		manipulation.remove(Move)
	if (manipulation.isCreating(Rotate))
		manipulation.remove(Rotate)
}

onKeyDown.a = function() {
	if (!selection.isEmpty()) {
		var argName = F_.addArgument(selection.e.getMainParameter())
		selection.e.setMainParameter(argName)
		run()
	}
}

function ArithmeticExpression(exp) {
	this.set(exp)
}

ArithmeticExpression.prototype.set = function(exp) {
	this.exp = exp
}

ArithmeticExpression.prototype.get = function() {
	return this.exp
}

ArithmeticExpression.prototype.eval = function(functionContext) {
	var self = this
	// TODO speed up further. caching? but what if the fContext changes?
	if (typeof self.exp == "number")
		return self.exp
	console.assert(self.exp !== undefined, "ArithmeticExpression eval: Warning: exp is undefined!")
	console.assert(functionContext !== undefined, "ArithmeticExpression eval: Warning: functionContext is undefined!")
	var shortCut = functionContext.args[self.exp]
	if (shortCut !== undefined) // if exp is just a variable
		return shortCut
	
	// construct function that has all the arguments for expression eval
	var selfXuwforgjd6 = self
	var func = "(function("
	var argsCount = 0
	for (var arg in functionContext.args)
		argsCount++
	var i = 0
	for (var arg in functionContext.args)
		func += arg+(++i < argsCount ? ", " : "")
	func +=") { return eval(selfXuwforgjd6.exp) })("
	i = 0
	for (var arg in functionContext.args)
		func += "functionContext.args[\""+arg+"\"]"+(++i < argsCount ? ", " : "")
	func +=")"
	
//	console.log(func)
	
	try {
		return eval(func)
	} catch(e) {
		console.log(e)
		return 1
	}
}





















////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

function Command() {}

Command.prototype.setUpReferences = function(constructor) {
	var self = this
	self.root = self
	self.scope
	self.scopeDepth = 0
	self.refDepthOfSameType = 0
	self.myConstructor = constructor
	self.savedState
}

Command.prototype.setMainParameter = function(x) {
	var self = this
	self.root.mainParameter = new ArithmeticExpression(x)
}

Command.prototype.getMainParameter = function(callerF) {
	var self = this
	if (callerF === undefined)
		callerF = self.scope
	console.assert(self.root.mainParameter instanceof ArithmeticExpression)
	var mainParameter = self.root.mainParameter.eval(callerF)
	console.assert(isRegularNumber(mainParameter))
	return mainParameter
}

Command.prototype.shallowClone = function(scope) {
	var self = this
	// this should be the same, but breaks ... I dont know why
//	var c = Object.create(self)
	var c = new self.myConstructor()
	// it is important to understand that there is a difference between the
	// initiator of the clone (scope) and self (the context that called)
	c.root = self.root
	c.scope = scope
	c.scopeDepth = scope.scopeDepth + 1
	c.refDepthOfSameType = scope.refDepthOfSameType + (scope instanceof self.myConstructor ? 1 : 0)
	if (c.scopeDepth > 100) {
		console.error("shallowClone scopeDepth to high. endless loop? aborting exec.")
		c.exec = function() {}
	}
	
	return c
}

function Move(lineLength) {
	var self = this
	self.setUpReferences(Move)
	self.setMainParameter(lineLength)
	self.line
	self.lineMainSVG
}
Move.prototype = new Command()

Move.prototype.exec = function(callerF) {
	var self = this
	var lineLength = self.getMainParameter(callerF)
	
	self.savedState = callerF.state.clone()
	var x1 = callerF.state.x
	var y1 = callerF.state.y
	callerF.state.x += Math.sin(callerF.state.r) * lineLength
	callerF.state.y -= Math.cos(callerF.state.r) * lineLength
	var x2 = callerF.state.x
	var y2 = callerF.state.y
	if (self.line === undefined) {
		self.line = callerF.paintingG.append("line").style(lineStyle)
	}
	if (self.lineMainSVG === undefined && callerF === F_) {
		self.lineMainSVG = mainSVG.paintingG.append("line").style(lineStyle)
		self.lineMainSVG.on("click", function(d, i) {
			self.select()
			// to prevent click on background
			d3.event.stopPropagation()
		})
	}
	var lines = [self.line]
	if (callerF === F_)
		lines.push(self.lineMainSVG)
	for (var l in lines)
		lines[l]
			.attr("x1", x1).attr("y1", y1)
			.attr("x2", x2).attr("y2", y2)
}

Move.prototype.select = function() {
	var self = this
	selection.add(self)
	if (self.lineMainSVG !== undefined)
		self.lineMainSVG.classed("lineSelected", true)
}

Move.prototype.deselect = function() {
	var self = this
	if (self.lineMainSVG !== undefined)
		self.lineMainSVG.classed("lineSelected", false)
}

Move.prototype.remove = function() {
	var self = this
	if (self.line !== undefined)
		self.line.remove()
	self.line = undefined
	self.removeFromMainSVG()
}

Move.prototype.removeFromMainSVG = function() {
	var self = this
	if (self.lineMainSVG !== undefined)
		self.lineMainSVG.remove()
	self.lineMainSVG = undefined
}



function Rotate(angle) {
	var self = this
	self.setUpReferences(Rotate)
	self.setMainParameter(angle)
	// both are just in the mainSVG
	// -> Rotate is not explicitly visualised in the preview
	self.arc
	self.label
}
Rotate.prototype = new Command()

Rotate.prototype.exec = function(callerF) {
	var self = this
	var angle = self.getMainParameter(callerF)
	self.savedState = callerF.state.clone()
	var dragStartState
	
	var arc = d3.svg.arc()
		.innerRadius(0)
		.outerRadius(rotationArcRadius)
		.startAngle(callerF.state.r)
		.endAngle(callerF.state.r + angle)
	callerF.state.addRadius(angle)
	
	if (self.arc === undefined && callerF === F_) {
		self.arc = mainSVG.paintingG.append("path").style(arcStyle)
		self.arc.on("mouseenter", function (d, i) {
			if (!dragInProgress && !manipulation.isCreating(Rotate))
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
				dragStartState = self.savedState.clone()
				d3.select(this).classed("dragging", true)
				// to prevent drag on background
				d3.event.sourceEvent.stopPropagation()
			})
			.on("drag", function (d) {
				var x = d3.event.x
				var y = d3.event.y
				var dx = x-dragStartState.x
				var dy = y-dragStartState.y
				var angleDelta = getAngleDeltaTo(dx, dy, dragStartState.r)
				self.setMainParameter(angleDelta)
				run()
			})
			.on("dragend", function (d) {
				dragInProgress = false
				d3.select(this).classed("dragging", false)
			})
		)
	}
	
	if (self.label === undefined) {
		// the "xhtml:" is important! http://stackoverflow.com/questions/15148481/html-element-inside-svg-not-displayed
		self.label = mainSVG.paintingG.append("foreignObject")
			.attr("width", 200).attr("height", 25).attr("x", 0).attr("y", 0)
		self.labelInput = self.label
			.append("xhtml:body")
			.append("xhtml:input").attr("type", "text").attr("value", "text")
		self.label.on("click", function() {
			d3.event.stopPropagation()
		})
//		self.labelInput.on("blur", function() {
//			self.setName(this.value)
//		})
		self.labelInput.on("keypress", function() {
			if (d3.event.keyCode === /*enter*/ 13) {
				// TODO
				self.setMainParameter(this.value)
				run()
			}
		})
//		self.labelInput.on("input", function() {
//			self.nameInput.classed({"inputInEditState": true})
//			self.checkName(this.value)
//		})
		
	}
	
	self.label.classed("hide", selection.e !== self
		&& manipulation.insertedCommand !== self.root)
	
	if (callerF === F_) {
		var dir = correctRadius(callerF.state.r - angle/2)
		var x = callerF.state.x + Math.sin(dir) * rotationArcRadius * 0.6
		var y = callerF.state.y - Math.cos(dir) * rotationArcRadius * 0.6 + .5 // vertical alignment
		var labelText = self.root.mainParameter.get()+"="+Math.round(angle/Math.PI*180)+"°"
		// .text(labelText)
		self.label
			.attr("transform", "translate("+x+","+y+") scale(0.1)")
		self.labelInput.property("value", labelText)

		self.arc.attr("d", arc)
			.attr("transform", "translate("+callerF.state.x+","+callerF.state.y+")")
	}
}

Rotate.prototype.select = function() {
	var self = this
	selection.add(self)
	if (self.label !== undefined)
		self.label.classed("hide", false)
	if (self.arc !== undefined)
		self.arc.classed("selected", true)
}

Rotate.prototype.deselect = function() {
	var self = this
	if (self.label !== undefined)
		self.label.classed("hide", true)
	if (self.arc !== undefined)
		self.arc.classed("selected", false)
}

Rotate.prototype.remove = function() {
	var self = this
	self.removeFromMainSVG()
}

Rotate.prototype.removeFromMainSVG = function() {
	var self = this
	self.deselect()
	if (self.arc !== undefined)
		self.arc.remove()
	self.arc = undefined
	if (self.label !== undefined)
		self.label.remove()
	self.label = undefined
}




function Loop(numberOfRepetitions, commands) {
	var self = this
	self.setUpReferences(Loop)
	self.setMainParameter(numberOfRepetitions)
	self.commands = commands
	for (var i=0; i<self.commands.length; i++)
		self.commands[i].scope = self
	// "unfolded" loop
	self.commandsAll = []
	// for all repetitions
	self.iconGs = []
	self.iconGsMainSVG = []
}
Loop.prototype = new Command()

Loop.prototype.exec = function(callerF) {
	var self = this
	var numberOfRepetitions = self.getMainParameter(callerF)
	self.savedState = callerF.state.clone()
	// shrink inner loops radius
	var loopClockRadiusUsed = loopClockRadius*Math.pow(0.7, self.refDepthOfSameType+1)
	
	function createIcon(iconG) {
		if (i === 0) {
			iconG.append("text").style(textStyle).text(numberOfRepetitions)
				.attr("transform", "translate("+0+","+(-loopClockRadiusUsed*1.3)+")")
		}
		
		var arc = d3.svg.arc()
			.innerRadius(0)
			.outerRadius(loopClockRadiusUsed)
			.startAngle(0)
			.endAngle(Math.PI*2/numberOfRepetitions*(i+1))
		iconG.append("path")
			.attr("d", arc)
			.style(clockHandStyle)

		iconG.append("circle")
			.attr("cx", 0).attr("cy", 0).attr("r", loopClockRadiusUsed)
			.style(clockStyle)
	}
	
	var rebuild = self.commandsAll.length !== numberOfRepetitions * self.root.commands.length
	if (rebuild) {
		for (var k=0; k<self.commandsAll.length; k++)
			self.commandsAll[k].remove()
		self.commandsAll = []
	}
	
	for (var i=0; i<numberOfRepetitions; i++) {
		if (self.iconGs.length <= i && drawLoopInPreview) {
			var iconG = callerF.paintingG.append("g")
			self.iconGs.push(iconG)
			createIcon(iconG)
		}
		
		if (self.iconGsMainSVG.length <= i && callerF === F_) {
			var iconG = mainSVG.paintingG.append("g")
			self.iconGsMainSVG.push(iconG)
			createIcon(iconG)
		}
		
		// TODO consider line-in and -out diretion for angle
		// place center away from current position in 90° angle to current heading
		var dir = correctRadius(callerF.state.r + Math.PI/2)
		var cx = callerF.state.x + Math.sin(dir) * loopClockRadius * 1.4
		var cy = callerF.state.y - Math.cos(dir) * loopClockRadius * 1.4
		var iconGsL = []
		if (drawLoopInPreview)
			iconGsL.push(self.iconGs[i])
		if (callerF === F_)
			iconGsL.push(self.iconGsMainSVG[i])
		for (var iL in iconGsL)
			iconGsL[iL].attr("transform", "translate("+cx+","+cy+")")
		
		for (var k=0; k<self.root.commands.length; k++) {
			var pos = i*self.root.commands.length + k
			if (rebuild)
				self.commandsAll[pos] = self.root.commands[k].shallowClone(self)
			self.commandsAll[pos].exec(callerF)
		}
	}
}

Loop.prototype.select = function() {
}

Loop.prototype.deselect = function() {
}

Loop.prototype.remove = function() {
	var self = this
//	self.deselect()
	for (var i=0; i<self.commandsAll.length; i++)
		self.commandsAll[i].remove()
	for (var i=0; i<self.iconGs.length; i++)
		self.iconGs[i].remove()
	self.iconGs = []
	self.removeFromMainSVG()
}

Loop.prototype.removeFromMainSVG = function() {
	var self = this
	for (var i=0; i<self.commandsAll.length; i++)
		self.commandsAll[i].removeFromMainSVG()
	for (var i=0; i<self.iconGsMainSVG.length; i++)
		self.iconGsMainSVG[i].remove()
	self.iconGsMainSVG = []
}



function FunctionCall(func) {
	var self = this
	self.setUpReferences(FunctionCall)
	self.f = func
	console.assert(self.f !== undefined)
	self.commands = []
	self.icon
	self.iconMainSVG
}
FunctionCall.prototype = new Command()

FunctionCall.prototype.exec = function(callerF) {
	var self = this
	self.savedState = callerF.state.clone()
	console.assert(self.root.f !== undefined && functions.indexOf(self.root.f) !== -1)
	if (self.commands.length === 0) {
		for (var i=0; i<self.root.f.commands.length; i++) {
			self.commands.push(self.root.f.commands[i].shallowClone(self))
		}
	}
	if (self.icon === undefined) {
		// is not displayed in the preview
	}
	if (self.iconMainSVG === undefined && callerF === F_) {
		self.iconMainSVG = mainSVG.paintingG.append("text")
			.style(textStyle).text("ƒ"+self.root.f.name)
			.attr("transform", "translate("+callerF.state.x+","+callerF.state.y+")")
	}
	
	for (var i=0; i<self.commands.length; i++) {
		self.commands[i].exec(callerF)
	}
}

FunctionCall.prototype.select = function() {
}

FunctionCall.prototype.deselect = function() {
}

FunctionCall.prototype.remove = function() {
	var self = this
	for (var i=0; i<self.commands.length; i++)
		self.commands[i].remove()
	if (self.icon !== undefined)
		self.icon.remove()
	self.icon = undefined
	self.removeFromMainSVG()
}

FunctionCall.prototype.removeFromMainSVG = function() {
	var self = this
	for (var i=0; i<self.commands.length; i++)
		self.commands[i].removeFromMainSVG()
	if (self.iconMainSVG !== undefined)
		self.iconMainSVG.remove()
	self.iconMainSVG = undefined
}





return ma
}()
