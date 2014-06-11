/*
	Vogo
	Copyright (C) 2014 Matthias Graf
	matthias.graf <a> mgrf.de
	
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

var vogo = function() {// spans everything - not indented
"use strict";
var vogo = {}

// CONSTANTS (const not supported in strict mode)
var turtleHomeStyle = {fill: "none", stroke: "#d07f00", "stroke-width": ".2", "stroke-linecap": "round"}
var turtleStyle = {fill: "#ffba4c", "fill-opacity": 0.6, stroke: "none"}
var lineStyle = {stroke: "#000", "stroke-width": ".25", "stroke-linecap": "round"}
var arcStyle = {fill: "#000", "fill-opacity": 0.1}
var clockStyle = {fill: "#fff", "fill-opacity": 0.01 /*for clickability*/, stroke: "#777", "stroke-width": ".05"}
var clockHandStyle = {fill: "#000", "fill-opacity": 0.2}
var textStyle = {fill: "#666", "font-family": "Open Sans", "font-size": "1.5px", "text-anchor": "middle"}

var zoomFactor = 1.3
var zoomTransitionDuration = 150
var loopClockRadius = 1.3
var rotationArcRadius = 4
var scopeDepthLimit = 30 // for endless loops and recursion
// this determines the default zoom level
var defaultSvgViewboxHeight = 100
var domSvg

var turtleHomeCursorPath = "M1,1 L0,-2 L-1,1 Z"
var keyMap = { 65: "a", 68: "d", 83: "s", 69: "e", 70: "f", 71: "g", 82: "r",
	107: "+", 109: "-", 80: "p", 46: "del", 27: "esc", 76: "l", 17: "ctrl", 16: "shift",
	78: "n", 66: "b"}
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

var functionPanelSizePercentOfBodyWidth = 0.15 /* also change in css */
var lastNotificationUpdateTime
var dragInProgress = false
var mousePos = [0,0]
var mousePosPrevious = [0,0]



var selection = {
	e: [],
	add: function(x) {
		if (!keyPressed.shift) {
			this.deselectAll()
			this.e.push(x)
		} else if (!this.contains(x)) // accumulate multiple
			this.e.push(x)
	},
	contains: function(x) {
		return this.e.indexOf(x) !== -1
	},
	containsAsRoot: function(x) {
		for (var i=0; i<this.e.length; i++)
			if (this.e[i].root === x)
				return true
		return false
	},
	isEmpty: function() {
		return this.e.length === 0
	},
	deselectAll: function() {
		var detach = this.e
		this.e = []
		for (var i=0; i<detach.length; i++)
			detach[i].deselect()
		return detach
	},
	removeAll: function() {
		var detach = this.deselectAll()
		for (var i=0; i<detach.length; i++) {
			detach[i].removeVisible()
			detach[i].removeCommand()
		}
		return detach
	}
}

vogo.init = function() {
	domSvg = document.getElementById("turtleSVG")
	mainSVG = new MainSVG()
	window.onresize = function(event) { updateScreenElemsSize()}
	window.onresize()
	addNewFunctionToUI()
	setupUIEventListeners()
	test()
}

// wraps a function for drawing it multiple times
function Drawing(f, args, paintingG) {
	var func = new Function(f.name, {}, [new FunctionCall(f, args)], paintingG).exec()
	paintingG[0][0].vogo = func
	func.update = function(newArgs) {
		console.assert(this.commands.length == 1)
		var fc = this.commands[0]
		console.assert(fc instanceof FunctionCall)
		if (newArgs !== undefined) {
			// leave old, just overwrite
			for (var a in newArgs)
				fc.customArguments[a] = !(newArgs[a] instanceof Expression)
					? new Expression(newArgs[a]) 
					: newArgs[a]
		}
		this.state.reset()
		return this.exec()
	}
	return func
}

// for d3.call()
vogo.draw = function(f, args) {
	return function(elem) { return new Drawing(f, args, elem) }
}

vogo.update = function(args) {
	return function(elem) { return elem[0][0].vogo.update(args) }
}

function run() {
//	console.log("RUNNING")
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

function setupUIEventListeners() {
	d3.select("#f_addNew").on("click", function() {
		addNewFunctionToUI()
	})
	
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

function Function(name, args, commands, customPaintingG) {
	var self = this
	self.state = new State()
	self.setName(name)
	self.args = {}
	if (args !== undefined) {
		self.args = args
		for (var a in args) // wrap in expressions
			if (!(self.args[a] instanceof Expression) && self.args[a] !== undefined)
				self.args[a] = new Expression(self.args[a])
	}
	self.commands = []
	if (commands !== undefined)
		self.setCommands(commands)
	if (customPaintingG !== undefined)
		self.paintingG = customPaintingG
	return self
}

Function.prototype.initUI = function() {
	var self = this
	self.svgViewboxWidth
	self.svgViewboxHeight = defaultSvgViewboxHeight // fix on startup
	self.svgViewboxX
	self.svgViewboxY
	self.svgWidth
	self.svgHeight
	
	self.li_f = d3.select("#ul_f").append("li")//.attr("id", "f_"+self.name)
	// this complicated wrapping is sadly necessary
	// http://stackoverflow.com/questions/17175038/css-dynamic-length-text-input-field-and-submit-button-in-one-row
	var titleRow = self.li_f.append("div").attr("class", "titleRow")
	
	self.nameInput = titleRow.append("div").attr("class", "titleRowCell")
		.append("input")
		.attr("class", "f_name")
		.property("value", self.name)
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
	var isDragged = false
	self.svg = self.svgContainer.append("svg").attr("class", "fSVG")
		.attr("xmlns", "http://www.w3.org/2000/svg")
		.on("click", function() {
			// dragstart and click are fired at the same time, so I have to check for myself
			if (!isDragged) {
				self.switchTo()
			}
		})
		.call(d3.behavior.drag()
			.on("dragstart", function (d) {
			})
			.on("drag", function (d) {
				isDragged = true
			})
			.on("dragend", function (d) {
				if (isDragged) {
					isDragged = false
//					if (self === F_) {
//						// recursion!
//					} else {
						// TODO respect selection!
						var fc = new FunctionCall(self)
						fc.scope = F_
						F_.commands.push(fc)
						run()
//					}
				}
			})
		)
	
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
	if (self.turtleCursor !== undefined)
		self.turtleCursor.attr("transform", "translate("+self.state.x+", "+self.state.y+") rotate("+(self.state.r/Math.PI*180)+")")
}

function updateViewboxFor(obj, ref, afterZoom) {
	console.assert(ref !== undefined && !isNaN(ref.svgViewboxX) && !isNaN(ref.svgViewboxY)
		&& ref.svgViewboxWidth > 0 && ref.svgViewboxHeight > 0)
	console.assert(isFinite(ref.svgViewboxX) && isFinite(ref.svgViewboxY) && isFinite(ref.svgViewboxWidth) && isFinite(ref.svgViewboxHeight))
	function applyTransition() {
		return afterZoom === undefined ? obj : obj.transition().duration(zoomTransitionDuration)
	}
	applyTransition(obj).attr("viewBox", ref.svgViewboxX+" "+ref.svgViewboxY+" "+ref.svgViewboxWidth+" "+ref.svgViewboxHeight)
}

MainSVG.prototype.updateViewbox = function(afterZoom) {
	if (F_ !== undefined)
		updateViewboxFor(this.svg, F_, afterZoom)
}

Function.prototype.updateViewbox = function(afterZoom) {
	var self = this
		// [0][0] gets the dom element
	// the preview svg aspect ratio is coupled to the main svg
	self.svgWidth = self.svgContainer[0][0].getBoundingClientRect().width
	self.svgHeight = self.svgWidth * mainSVG.svgHeight/mainSVG.svgWidth
	self.svgContainer.style({height: self.svgHeight+"px"})
	
//	console.assert(self.svgWidth > 0 && self.svgViewboxHeight > 0 && mainSVG.svgWidth > 0 && mainSVG.svgHeight > 0)
//	console.log(self.svgWidth+","+self.svgViewboxHeight+","+mainSVG.svgWidth+","+mainSVG.svgHeight)
	console.assert(self.svgWidth > 0)
	console.assert(self.svgViewboxHeight > 0)
	console.assert(mainSVG.svgWidth > 0)
	// there have be instances (occuring when resizing the window), when this failed
	console.assert(mainSVG.svgHeight > 0)
	
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
			if (this.nameInput !== undefined) {
				this.nameInput.classed({"inputInWrongState": true})
				updateNotification("Function name duplication.")
			}
			return false
		}
	}
	if (this.nameInput !== undefined) {
		this.nameInput.classed({"inputInWrongState": false})
		hideNotification()
	}
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
	if (self.nameInput !== undefined) {
		self.nameInput.property("value", self.name)
		self.nameInput.classed({"inputInEditState": false, "inputInWrongState": false})
		hideNotification()
	}
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
	
	console.assert(self.checkArgumentName(argName))
	self.args[argName] = new Expression(defaultValue)
	
	function onChange(value) {
		console.assert(typeof value == "string")
		if (value === "") {
			// TODO check dependencies
			inputField.remove()
			delete self.args[argName]
		}
		var regEx = /^([a-zA-Z][a-zA-Z0-9]*)=(.+)$/
		var match = regEx.exec(value)
		if (match !== null) { // match success
			var newArgName = match[1]
			var newValue = match[2]
			if (argName !== newArgName) {
				// TODO rename all occurences
				self.args[newArgName] = self.args[argName]
				delete self.args[argName] // dereference
				argName = newArgName
			}
			self.args[argName].set(newValue)
			run()
		} else {
			// restore field
		}
	}
	
	var inputField = this.ul_args.append("li")
		.append("input")
		.attr("class", "f_argument")
		.attr("type", "text")
		.on("blur", function() {
			onChange(this.value)
		})
		.on("keypress", function() {
			if (d3.event.keyCode === /*enter*/ 13) {
				onChange(this.value)
			}
		})
		.on("input", function() {
			
		})
		.call(d3.behavior.drag()
			.on("dragstart", function (d) {
				self.args[argName].adjustDragstart(this)
			})
			.on("drag", function (d) {
				self.args[argName].adjustDrag(this, argName+"=")
			})
			.on("dragend", function (d) {
				
			})
		)
		.property("value", argName+"="+self.args[argName].get())
	
	return argName
}

Function.prototype.setCommands = function(commands) {
	console.assert(commands instanceof Array)
	var self = this
	self.commands = commands
	self.commands.forEach(function (e) { e.scope = self })
	return self
}

Function.prototype.exec = function() {
	var self = this
	self.commands.forEach(function(e) { e.exec(self) })
	self.updateTurtle()
	return self
}

Function.prototype.switchTo = function() {
	var self = this
	self.svgContainer.classed("fSVGselected", true)
	if (F_ === self)
		return
	selection.deselectAll()
	if (F_ !== undefined) {
		self.previousF_ = F_
		F_.svgContainer.classed("fSVGselected", false)
		F_.commands.forEach(function(e) { e.removeVisibleFromMainSVG() })
	}
	F_ = self
	F_.updateViewbox()
	mainSVG.updateViewbox()
	run()
	// this sets the active element back to body, which is required for drawing
	document.activeElement.blur()
}

Function.prototype.remove = function() {
	var self = this
	functions.splice(functions.indexOf(self), 1)
	if (F_ === self && functions.length > 0) { // switch to previous or last
		(self.previousF_ !== undefined && functions.indexOf(self.previousF_) !== -1
			? self.previousF_
			: functions[functions.length-1])
				.switchTo()
	}
	
	// TODO kill proxies?
	self.commands.forEach(function(e) { e.removeVisible() })
	self.commands = []
	
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

Function.prototype.toCode = function() {
	var self = this
	var result = "var "+self.name+" = new vogo.Function(\""+self.name+"\", "
		+argsToCode(self.args)+");\n"
		// the extra call will make recursion possible
		+self.name+".setCommands("+commandsToCodeString(self.commands, 0)+");"
	return result
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
		var selectedElem = selection.e[0]
		var sScope = selectedElem.root.scope
//		console.assert(sScope instanceof Function)
		var cmdsRef = sScope.commands
		var cmdSelIdx = cmdsRef.indexOf(selectedElem.root)
		console.assert(cmdSelIdx !== -1)
//		this.savedState = sScope.commands[cmdSelIdx].savedState.clone()
		this.savedState = selectedElem.savedState.clone()
		this.insertedCommand = new cmdType()
		this.insertedCommand.scope = sScope
		cmdsRef.splice(cmdSelIdx, 0, this.insertedCommand)
	}
	this.update(cmdType)
}

manipulation.update = function(cmdType) {
	if (this.isCreating(cmdType)) {
		F_.state = this.savedState.clone()
		if (cmdType === Move)
			this.insertedCommand.setMainParameter(parseFloat(getLineLengthToWithoutChangingDirection(mousePos).toFixed(2)))
		else if (cmdType === Rotate)
			this.insertedCommand.setMainParameter(parseFloat(rotateAngleTo(mousePos).toFixed(3)))
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
	var ic = this.insertedCommand
	this.insertedCommand = false
	updateLabelVisibility(ic)
}

manipulation.remove = function(cmdType) {
	console.assert(this.isCreating(cmdType))
	
	var idx = this.insertedCommand.scope.commands.indexOf(this.insertedCommand)
	this.insertedCommand.scope.commands.splice(idx, 1)
	// TODO removeCommand?
	this.insertedCommand.removeVisible()
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
	var svg = domSvg
	window.open("data:image/svg+xml," + encodeURIComponent(
	// http://stackoverflow.com/questions/1700870/how-do-i-do-outerhtml-in-firefox
		svg.outerHTML || new XMLSerializer().serializeToString(svg)
	))
}

function isRegularNumber(n) {
	// http://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
	// typeof n == "number" not needed
	return !isNaN(parseFloat(n)) && isFinite(n)
}

// this is used to determine the precision of the interactive drag-adjustment for numbers
// this is similar to "get order of magnitude"
// getPrecision(100) === 2
// getPrecision(.01) === -2
// BUT: getPrecision(100.01) === -2 (intended output)
function getPrecision(n) {
	var match = /^-?([0-9]*)\.?([0-9]*)$/.exec(n.toString())
	if (match !== null) {
		// match[0] is original string, [1] is part before comma and [2] after
		var precision = -match[2].length
		if (precision === 0)
			precision = match[1].length-1
		return precision
	} else {
		console.log("getPrecision: warning: value does not match regex for number")
	}
}

function bodyIsSelected() {
	return document.activeElement.nodeName === "BODY"
}

function updateLabelVisibility(self) {
	if (self.label !== undefined)
		self.label.classed("hide", !selection.contains(self)
			&& manipulation.insertedCommand !== self.root
			&& self.root.mainParameter.isStatic())
}

function setTextOfInput(input, containingForeignObject, text) {
	if (text === undefined)
		text = input.property("value")
	else
		input.property("value", text)
	input.attr("size", Math.max(1, text.toString().length))
	if (!containingForeignObject.classed("hide")) {
		var newWidth = input[0][0].offsetWidth
		console.assert(newWidth > 0)
		containingForeignObject.attr("width", newWidth+5)
	}
}

function addNewFunctionToUI() {
	var f = new Function()
	f.initUI()
	functions.push(f)
	f.switchTo()
}

function exportAll() {
	var fDep = determineFunctionDependencies()
	var fProcessed = {}
	var result = ""
	outer: while (Object.keys(fProcessed).length < functions.length) {
		var fProcessedOld = Object.keys(fProcessed).length
		for (var i=0; i<functions.length; i++) {
			if (fDep[i] === undefined || fProcessed[fDep[i]] !== undefined || i === fDep[i] /*allow recursion*/) {
				result += functions[i].toCode()+"\n\n"
				fProcessed[i] = true
				if (Object.keys(fProcessed).length === functions.length)
					break outer
			}
		}
		if (fProcessedOld === Object.keys(fProcessed).length) {
			// TODO
			console.log("exportAll: error: circular dependencies between functions!")
			break
		}
	}
	return result
}

function determineFunctionDependencies() {
	var dependencies = {}
	function searchForFunctionCall(commands) {
		for (var k=0; k<commands.length; k++) {
			if (commands[k] instanceof FunctionCall) {
				dependencies[i] = functions.indexOf(commands[k].root.f)
			}
			if (commands[k] instanceof Loop)
				searchForFunctionCall(commands[k].commands)
			if (commands[k] instanceof Branch) {
				searchForFunctionCall(commands[k].ifTrueBranch)
				searchForFunctionCall(commands[k].ifFalseBranch)
			}
		}
	}
	for (var i=0; k<functions.length; k++)
		searchForFunctionCall(functions[i].commands)
	if (false)
		for (var d in dependencies)
			console.log(functions[d].name+" depends on "+functions[dependencies[d]].name)
	return dependencies
}

function commandsToCodeString(commands, scopeDepth) {
	var result = "["
	for (var i=0; i<commands.length; i++) {
		console.assert(commands[i] instanceof Command)
		result += "\n"
		for (var t=0; t<scopeDepth+1; t++)
			result += "\t"
		result += commands[i].toCode(scopeDepth+1)
		result += i < commands.length-1 ? ",": ""
	}
	result += "]"
	return result
}

function argsToCode(args) {
	var result = "{"
	var argsLength = Object.keys(args).length
	var k = 0
	for (var a in args) {
		result += "\""+a+"\": "+args[a].getWrapped()
			+(++k < argsLength ? ", " : "")
	}
	result += "}"
	return result
}

onKeyDown.n = function() {
	if (bodyIsSelected())
		addNewFunctionToUI()
}

onKeyDown.d = function() {
	if (bodyIsSelected()) {
		if (!manipulation.isCreating()) {
			manipulation.createPreview(Move)
		} else {
			if (manipulation.isCreating(Rotate)) {
				manipulation.finish(Rotate)
				manipulation.createPreview(Move)
			}
		}
	}
}

onKeyDown.r = function() {
	if (bodyIsSelected()) {
		if (!manipulation.isCreating()) {
			manipulation.createPreview(Rotate)
		} else {
			if (manipulation.isCreating(Move)) {
				manipulation.finish(Move)
				manipulation.createPreview(Rotate)
			}
		}
	}
}

onKeyDown.e = function() {
	var result = exportAll()
	console.log(result)
	// TODO make it beautiful
//	window.prompt("Copy to clipboard: Ctrl+C, Enter", result)
}

onKeyDown.s = function() {
	if (bodyIsSelected())
		openSVG()
}

onKeyDown.del = function() {
	if (bodyIsSelected()) {
		selection.removeAll()
		run()
	}
}

onKeyDown.esc = function() {
	if (manipulation.isCreating(Move))
		manipulation.remove(Move)
	if (manipulation.isCreating(Rotate))
		manipulation.remove(Rotate)
}

onKeyDown.a = function() {
	if (!selection.isEmpty()) {
		// TODO if exp isStatic
		var argName = F_.addArgument(selection.e[0].evalMainParameter())
		selection.e[0].setMainParameter(argName)
		run()
	}
}

function wrapSelectionInCommand(cmdName, doWithCmdList) {
	if (selection.isEmpty()) {
		updateNotification("Select something to "+cmdName+".", 5000)
		return
	}
	var selectedElem = selection.e[0].root
	var scope = selectedElem.scope
	var cmdsRef = scope.commands
	var idxArr = []
	for (var i=0; i<selection.e.length; i++) {
		if (i !== 0 && scope !== selection.e[i].root.scope) {
			updateNotification("Can only "+cmdName+" elements from the same scope.", 5000)
			return
		}
		idxArr.push(cmdsRef.indexOf(selection.e[i].root))
	}
	idxArr.sort(function(a,b) {return a - b})
	// check whether idxArr has form [x, x+1, x+2, ... ]
	var first = idxArr[0]
	var cmdList = []
	for (var i=0; i<idxArr.length; i++) {
		if (i !== 0 && idxArr[i] !== first+i && first !== -1) {
			updateNotification("Can only "+cmdName+" connected elements.", 5000)
			return
		}
		// create new connections
		cmdList.push(cmdsRef[idxArr[i]])
	}
	selection.removeAll()
	var cmdThatWrapped = doWithCmdList(cmdList)
	cmdThatWrapped.scope = scope
	cmdsRef.splice(first, 0, cmdThatWrapped)
	run()
}

onKeyDown.l = function() {
	wrapSelectionInCommand("loop", function(cmdList) { return new Loop(2, cmdList) })
}

onKeyDown.b = function() {
	wrapSelectionInCommand("branch", function(cmdList) { return new Branch("true", cmdList, []) })
}

function Expression(exp) {
	// result of expressions that do not depend on arguments (e.g. "Math.PI/2")
	this.cachedEvalFromStaticExp
	this.set(exp)
}

Expression.prototype.set = function(exp) {
	this.cachedEvalFromStaticExp = undefined
	if (isRegularNumber(exp)) {
		// if exp already is a number, parseFloat does just return it
		this.exp = parseFloat(exp)
		return
	}
	
	if (typeof exp == "string") {
		var result
		try {
			result = eval(exp)
			if (this.isNormalResult(result)) {
				this.cachedEvalFromStaticExp = result
				this.exp = exp
				return
			}
		} catch(e) {
			// it may depend on arguments, so it cannot be cached
		}
	} else {
		console.log("Expression: set: warning: exp is irregular: "+exp)
	}
	
	this.exp = exp
}

Expression.prototype.get = function() {
	return this.exp
}

Expression.prototype.getWrapped = function() {
	return (typeof this.exp == "string" ? "\""+this.exp+"\"" : this.exp)
}

Expression.prototype.isConst = function() {
	return typeof this.exp == "number"
}

Expression.prototype.isStatic = function() {
	return this.isConst() || (this.cachedEvalFromStaticExp !== undefined)
}

Expression.prototype.isNormalResult = function(result) {
	return isRegularNumber(result) || result === true || result === false
}

// THIS IS WELL THOUGHT THROUGH. do not mess with it, unless you know what you do
Expression.prototype.eval = function(command) {
	var self = this
	console.assert(self.exp !== undefined, "Expression eval: Warning: exp is undefined!")
	if (self.isConst())
		return self.exp
	
	if (self.isStatic())
		return self.cachedEvalFromStaticExp
	
	function evalWithChecks(toEval) {
//		console.log(toEval+" -- "+self.exp)
		var result
		try {
			result = eval(toEval)
		} catch(e) {
			console.log(e)
			return 1 // be a bit robust
		}
		// TODO if arg is array, it is evaluated each time, but fails
		console.assert(self.isNormalResult(result), "eval result is bullshit: "+result)
		return result
	}
	if (command === undefined) // can this ever be true? -> isStatic
		return evalWithChecks(self.exp)
	
	// check whether this command is inside a function call context (which has its own custom arguments)
	// or, if none, get the calling function
	var sc = command.scope
	var loopIndex // currently, only the innermost loop is considered
	while (sc !== undefined /*should not be false before one of the other two: */
		&& !(sc instanceof FunctionCall) && !(sc instanceof Function)) {
		// also, check whether there is a loop on the way (because it has an index)
		if (loopIndex === undefined && sc.i !== undefined)
			loopIndex = sc.i
		sc = sc.scope // traverse scope chain up
	}
	var fc, mainArgProvider
	if (sc instanceof FunctionCall) {
		// this is important for recusion. each proxy has to take the arguments from the previous level
		// the eval call has to take the fc, not fc.root, but the cargs and f have to come from fc.root
		fc = sc
		mainArgProvider = fc.root.f.args
//			console.log("found function context: "+self.exp+", "+fc.customArguments)
		var shortCut = fc.root.customArguments[self.exp]
		if (shortCut !== undefined) { // exp is just a variable
//				console.log("shortcut fc!: "+shortCut.get())
			return shortCut.eval(fc)
		}
	} else {
		// each command, up its scope chain, has to have a function at its end
		// all functions are in the global scope
		console.assert(sc instanceof Function)
		mainArgProvider = sc.args
	}
	
	var argsCount = Object.keys(mainArgProvider).length
	if (argsCount === 0 && loopIndex === undefined)
		return evalWithChecks(self.exp)

	var shortCut = mainArgProvider[self.exp]
	if (shortCut !== undefined) { // exp is just a variable
	// shortCut here is an argument of the global scope (a function)
	// the global scope does not depend on arguments, because that would create nasty endless loops (eval to eval to eval ...)
//			console.log("shortcut: "+shortCut.get())
		return shortCut.eval()
	}

	// TODO speed up further.
	// construct function that has all the arguments for expression eval
	var toEval = "(function("
	var i = 0
	for (var arg in mainArgProvider)
		toEval += arg+(++i < argsCount ? ", " : "")
	if (loopIndex !== undefined)
		toEval += (argsCount > 0 ? ", " : "")+"l1" // loop 1 index
	toEval +=") { return eval(self.exp) })("
	i = 0
	for (var arg in mainArgProvider) { // arguments itself are Expressions
		toEval += (fc !== undefined && fc.root.customArguments[arg] !== undefined
			? "fc.root.customArguments"+"[\""+arg+"\"].eval(fc)"
			: "mainArgProvider"+"[\""+arg+"\"].eval()")
			+(++i < argsCount ? ", " : "")
	}
	// TODO for simplicity, lets just do the first loop...
	if (loopIndex !== undefined)
		toEval += (argsCount > 0 ? ", " : "")+loopIndex
	toEval +=")"
	return evalWithChecks(toEval)
}

Expression.prototype.adjustDragstart = function(element, dragPrecision) {
	var self = this
	if (self.isConst()) {
//		self.dragStartMouseX = d3.mouse(element)[0]
		self.dragStartMouseX = d3.mouse(domSvg)[0]
		self.originalValue = self.eval()
		self.dragPrecision = dragPrecision !== undefined ? dragPrecision : getPrecision(self.originalValue)
		// TODO does this do anything?
		element.blur()
	} else {
		console.log("cannot drag non-const argument")
	}
}

Expression.prototype.adjustDrag = function(element, prefix) {
	var self = this
	console.assert(element instanceof HTMLInputElement)
	if (self.isConst()) {
		// if element is taken, the mouse jumps around
//		var mouseDiff = d3.mouse(element)[0] - self.dragStartMouseX
		var mouseDiff = d3.mouse(domSvg)[0] - self.dragStartMouseX
		// the number of digits after the comma influences how much the number changes on drag
		// 20.01 will only change slightly, whereas 100 will change rapidly
		mouseDiff *= .6 /*feels good value*/ * Math.pow(10, self.dragPrecision)
		// small Bug: the order of magnitude changes unexpectedly in the next drag,
		// if the value is left of ending with .xy0, because the 0 is forgotten
		mouseDiff = parseFloat(mouseDiff.toFixed(Math.max(0, -self.dragPrecision)))
		// yes, we need to do the rounding twice: mouseDiff, to reduce reruns
		// and newValue to get the precision right (+ can reintroduce rounding errors)
		var newValue = parseFloat((self.originalValue+mouseDiff).toFixed(Math.max(0, -self.dragPrecision)))
		if (self.eval(/*const!*/) !== newValue) {
			self.set(newValue)
			element.value = (prefix !== undefined ? prefix : "") + newValue
			run()
		}
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
	// each shallowCopy is a proxy (child) to the root
	self.proxies
	self.scope
	self.scopeDepth = 0
	self.refDepthOfSameType = 0
	self.myConstructor = constructor
	self.savedState
}

Command.prototype.setMainParameter = function(x) {
	var self = this
	console.assert(x !== undefined)
	if (self.root.mainParameter === undefined)
		self.root.mainParameter = new Expression(x)
	else
		self.root.mainParameter.set(x)
}

Command.prototype.evalMainParameter = function() {
	var self = this
	console.assert(self.root.mainParameter instanceof Expression)
	return self.root.mainParameter.eval(self)
}

Command.prototype.shallowClone = function(scope) {
	var self = this
	// this should be the same, but breaks ... I dont know why
//	var c = Object.create(self)
	var c = new self.myConstructor()
	// it is important to understand that there is a difference between the
	// initiator of the clone (scope) and self (the command that is cloned)
	c.root = self.root
	if (self.root.proxies === undefined)
		self.root.proxies = []
	self.root.proxies.push(c)
	c.scope = scope
	c.scopeDepth = scope.scopeDepth + 1
	if (self.scopeDepth > scopeDepthLimit+1)
		console.log("warning: scope depth to high!")
	c.refDepthOfSameType = scope.refDepthOfSameType + (scope instanceof self.myConstructor ? 1 : 0)
	return c
}

Function.prototype.fromRemove = Command.prototype.fromRemove = function(cmd) {
	var self = this
	// self has to be able to contain commands
	console.assert(self.commands !== undefined)
	console.assert(cmd.scope === self)
	console.assert(cmd.proxies === undefined)
	for (var k=0; k<self.commands.length; k++) {
		if (self.commands[k] === cmd) {
			self.commands.splice(k, 1)
			return // can only exist once
		}
	}
	console.assert(self instanceof Loop)
	for (var k=0; k<self.execCmds.length; k++) {
		if (self.execCmds[k] === cmd) {
			self.execCmds.splice(k, 1)
			// TODO if (self.commands.length === 0) ...
			return // can only exist once
		}
	}
	console.assert(false, "removeFrom is expected to find cmd. "+self.execCmds+", "+cmd)
}

Command.prototype.removeCommand = function() {
	var root = this.root
	if (root.proxies !== undefined) {
		// "self" is in proxies
		root.proxies.forEach(function(p) {
			p.scope.fromRemove(p)
			p.removeVisible()
		})
		root.proxies = undefined
	}
	root.scope.fromRemove(root)
	root.removeVisible()
}

Command.prototype.removeWithProxyConnection = function() {
	var self = this
	if (self.root !== self) {
		console.assert(self.root.proxies.length > 0)
		var idx = self.root.proxies.indexOf(self)
		console.assert(idx !== -1)
		self.root.proxies.splice(idx, 1)
	}
	self.removeVisible()
}

Command.prototype.applyCSSClass = function(elements, cssName, on, prop) {
	if (elements instanceof Array)
		elements.forEach(function(e) {
			if (e !== undefined) {
				if (prop !== undefined) {
					if (e[prop] !== undefined) {
						e[prop].classed(cssName, on)
					}
				} else {
					e.classed(cssName, on)
				}
			}
		})
}

Command.prototype.removeVisibleElements = function(props, fromMainSVG) {
	var self = this
	props.forEach(function(p) {
		// we have 3 cases: self[p] is
		// 1) a simple d3 object
		// 2) an array of simple d3 objects
		// 3) an array of commands
		var isArray = false
		if (self[p] !== undefined) {
			// cannot check for Array directly because any d3 object is also an Array
			isArray = self[p].remove === undefined
			if (isArray) {
				self[p].forEach(function(e) {
					if (e.remove === undefined) // 3
						fromMainSVG
							? e.removeVisibleFromMainSVG()
							: e.removeVisible()
					else // 2
						e.remove()
				})
			} else { // 1
				self[p].remove()
			}
		}
		self[p] = isArray ? [] : undefined
	})
}

Command.prototype.removeVisible = function() {
	this.removeVisibleElements(this.getVisibleElements())
	this.removeVisibleFromMainSVG()
}

Command.prototype.removeVisibleFromMainSVG = function() {
	this.deselect()
	this.removeVisibleElements(this.getVisibleElementsFromMainSVG(), true)
}

Command.prototype.toCode = function(scopeDepth) {
	return "new vogo."+this.myConstructor.name/*JS6*/
		+"("+this.root.mainParameter.getWrapped()+")"
}

function Move(lineLength) {
	var self = this
	self.setUpReferences(Move)
	if (lineLength !== undefined)
		self.setMainParameter(lineLength)
	self.line
	self.lineMainSVG
	self.label
}
Move.prototype = new Command()

Move.prototype.exec = function(callerF) {
	var self = this
	var lineLength = self.evalMainParameter()
	
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
			if (!manipulation.isCreating()) {
				self.select()
				// to prevent click on background
				d3.event.stopPropagation()
			}
		})
	}
	
	if (self.label === undefined && callerF === F_) {
		self.label = mainSVG.paintingG.append("foreignObject")
			.attr("width", 250).attr("height", 25).attr("x", 0).attr("y", 0)
			.on("click", function() {
				d3.event.stopPropagation()
			})
		
		self.labelInput = self.label
			.append("xhtml:body")
			.append("xhtml:input")
			.attr("type", "text")
			.on("blur", function() {
				self.setMainParameter(this.value)
				run()
			})
			.on("keypress", function() {
				if (d3.event.keyCode === /*enter*/ 13) {
					self.setMainParameter(this.value)
					run()
				}
			})
			.on("input", function() {
				// size updating
				setTextOfInput(self.labelInput, self.label)
			})
			.call(d3.behavior.drag()
				.on("dragstart", function (d) {
					self.root.mainParameter.adjustDragstart(this)
					d3.event.sourceEvent.stopPropagation()
				})
				.on("drag", function (d) {
					self.root.mainParameter.adjustDrag(this)
				})
				.on("dragend", function (d) {

				})
			)
	}
	
	
	var lines = [self.line]
	if (callerF === F_) {
		lines.push(self.lineMainSVG)
		updateLabelVisibility(self)
		var dir = correctRadius(callerF.state.r)
		var x = callerF.state.x + Math.sin(dir) * lineLength * -0.5
		var y = callerF.state.y - Math.cos(dir) * lineLength * -0.5
		self.label.attr("transform", "translate("+x+","+y+") scale(0.1)")
		setTextOfInput(self.labelInput, self.label, self.root.mainParameter.get())
	}
	for (var l in lines)
		lines[l]
			.attr("x1", x1).attr("y1", y1)
			.attr("x2", x2).attr("y2", y2)
}

Move.prototype.select = function() {
	var self = this
	selection.add(self)
	self.applyCSSClass([self.lineMainSVG], "selected", true)
	self.applyCSSClass(self.root.proxies, "mark", true, "lineMainSVG")
	if (self.label !== undefined) {
		self.label.classed("hide", false)
		setTextOfInput(self.labelInput, self.label)
	}
}

Move.prototype.deselect = function() {
	var self = this
	updateLabelVisibility(self)
	self.applyCSSClass([self.lineMainSVG], "selected", false)
	self.applyCSSClass(self.root.proxies, "mark", false, "lineMainSVG")
}

Move.prototype.getVisibleElementsFromMainSVG = function() {
	return ["lineMainSVG", "label"]
}

Move.prototype.getVisibleElements = function() {
	return ["line"]
}

//Move.prototype.remove = function() {
//	var self = this
//	if (self.line !== undefined)
//		self.line.remove()
//	self.line = undefined
//	self.removeFromMainSVG()
//}
//
//Move.prototype.removeFromMainSVG = function() {
//	var self = this
//	if (self.lineMainSVG !== undefined)
//		self.lineMainSVG.remove()
//	self.lineMainSVG = undefined
//	if (self.label !== undefined)
//		self.label.remove()
//	self.label = undefined
//}

function Rotate(angle) {
	var self = this
	self.setUpReferences(Rotate)
	if (angle !== undefined)
		self.setMainParameter(angle)
	self.arc
	self.label
}
Rotate.prototype = new Command()

Rotate.prototype.exec = function(callerF) {
	var self = this
	var angle = correctRadius(self.evalMainParameter())
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
			.on("mouseenter", function (d, i) {
				if (!dragInProgress && !manipulation.isCreating(Rotate))
					self.arc.style({fill: "#f00"})
			})
			.on("mouseleave", function (d, i) {
				// TODO self.arc is sometimes undefined
				self.arc.style(arcStyle)
			})
			.on("click", function (d, i) {
				if (!manipulation.isCreating()) {
					self.select()
					// to prevent click on background
					d3.event.stopPropagation()
				}
			})
			.call(d3.behavior.drag()
				.on("dragstart", function (d) {
					dragInProgress = true
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
					self.setMainParameter(parseFloat(angleDelta.toFixed(3)))
					run()
				})
				.on("dragend", function (d) {
					dragInProgress = false
					d3.select(this).classed("dragging", false)
				})
			)
	}
	
	if (self.label === undefined && callerF === F_) {
		// the "xhtml:" is important! http://stackoverflow.com/questions/15148481/html-element-inside-svg-not-displayed
		self.label = mainSVG.paintingG.append("foreignObject")
			.attr("width", 250).attr("height", 25).attr("x", 0).attr("y", 0)
			.on("click", function() {
				d3.event.stopPropagation()
			})
		self.labelInput = self.label
			.append("xhtml:body")
			.append("xhtml:input")
			.attr("type", "text")
			.on("blur", function() {
				self.setMainParameter(this.value)
				run()
			})
			.on("keypress", function() {
				if (d3.event.keyCode === /*enter*/ 13) {
					self.setMainParameter(this.value)
					run()
				}
			})
			.on("input", function() {
				setTextOfInput(self.labelInput, self.label)
			})
	}
	
	if (callerF === F_) {
		updateLabelVisibility(self)
		var dir = correctRadius(callerF.state.r - angle/2)
		var x = callerF.state.x + Math.sin(dir) * rotationArcRadius * 0.6
		var y = callerF.state.y - Math.cos(dir) * rotationArcRadius * 0.6 - 1 // vertical alignment
		self.label.attr("transform", "translate("+x+","+y+") scale(0.1)")
		setTextOfInput(self.labelInput, self.label, self.root.mainParameter.get())
			//+"="+Math.round(angle/Math.PI*180)+"°"
		
		self.arc.attr("d", arc)
			.attr("transform", "translate("+callerF.state.x+","+callerF.state.y+")")
	}
}

Rotate.prototype.select = function() {
	var self = this
	selection.add(self)
	self.applyCSSClass([self.arc], "selected", true)
	self.applyCSSClass(self.root.proxies, "mark", true, "arc")
	if (self.label !== undefined) {
		self.label.classed("hide", false)
		setTextOfInput(self.labelInput, self.label)
	}
}

Rotate.prototype.deselect = function() {
	var self = this
	updateLabelVisibility(self)
	self.applyCSSClass([self.arc], "selected", false)
	self.applyCSSClass(self.root.proxies, "mark", false, "arc")
}

Rotate.prototype.getVisibleElementsFromMainSVG = function() {
	return ["arc", "label"]
}

Rotate.prototype.getVisibleElements = function() {
	return []
}

//Rotate.prototype.remove = function() {
//	var self = this
//	self.removeFromMainSVG()
//}
//
//Rotate.prototype.removeFromMainSVG = function() {
//	var self = this
//	self.deselect()
//	if (self.arc !== undefined)
//		self.arc.remove()
//	self.arc = undefined
//	if (self.label !== undefined)
//		self.label.remove()
//	self.label = undefined
//}




function Loop(numberOfRepetitions, commands) {
	var self = this
	self.setUpReferences(Loop)
	if (numberOfRepetitions !== undefined)
		self.setMainParameter(numberOfRepetitions)
	// TODO scopeDepth is always 0 for root commands
	self.commands = commands === undefined ? [] : commands
	self.commands.forEach(function (e) { e.scope = self })
	// "unfolded" loop
	self.execCmds = []
	// for all repetitions
	self.iconGs = []
}
Loop.prototype = new Command()

Loop.prototype.exec = function(callerF) {
	var self = this
	var numberOfRepetitions = Math.floor(self.evalMainParameter())
	self.savedState = callerF.state.clone()
	// shrink inner loops radius
	var loopClockRadiusUsed = loopClockRadius*Math.pow(0.7, self.refDepthOfSameType+1)
	
	function createIcon() {
		var iconG = mainSVG.paintingG.append("g")
		if (i === 0) {
			iconG.fo = iconG.append("foreignObject")
				.attr("width", 250 /*max-width*/).attr("height", 25).attr("x", 0).attr("y", 0)
				.on("click", function() {
					d3.event.stopPropagation()
				})
			
			iconG.labelInput = iconG.fo.append("xhtml:body").append("xhtml:input")
				.attr("type", "text")
				.on("blur", function() {
					self.setMainParameter(this.value)
					run()
				})
				.on("keypress", function() {
					if (d3.event.keyCode === /*enter*/ 13) {
						self.setMainParameter(this.value)
						run()
					}
				})
				.on("input", function() {
					setTextOfInput(iconG.labelInput, iconG.fo)
				})
				.call(d3.behavior.drag()
					.on("dragstart", function (d) {
						self.root.mainParameter.adjustDragstart(this, 0)
						// drag is not called if this is not done:
						d3.event.sourceEvent.stopPropagation()
					})
					.on("drag", function (d) {
						self.root.mainParameter.adjustDrag(this)
					})
					.on("dragend", function (d) {

					})
				)
		}

		iconG.clockHand = iconG.append("path").style(clockHandStyle)
		iconG.circleF = iconG.append("circle").style(clockStyle)
			.attr("cx", 0).attr("cy", 0)
		iconG.on("click", function () {
			if (!manipulation.isCreating()) {
				self.select()
				// to prevent click on background
				d3.event.stopPropagation()
			}
		})
		return iconG
	}
	
	function updateIcon(iconG) {
		if (i === 0) {
			iconG.fo
				.attr("transform", "translate("+(loopClockRadiusUsed*1.1)+","+(-loopClockRadiusUsed*1.3)+") scale(0.1)")
			setTextOfInput(iconG.labelInput, iconG.fo, self.root.mainParameter.get())
		}
		
		var arc = d3.svg.arc()
			.innerRadius(0)
			.outerRadius(loopClockRadiusUsed)
			.startAngle(0)
			.endAngle(Math.PI*2/numberOfRepetitions*(i+1))
		iconG.clockHand
			.attr("d", arc)
		iconG.circleF
			.attr("r", loopClockRadiusUsed)
			
	}
	
	var rebuild = self.execCmds.length !== numberOfRepetitions * self.root.commands.length
		|| self.iconGs.length !== numberOfRepetitions
	if (rebuild) {
		self.execCmds.forEach(function(e) { e.removeWithProxyConnection() })
		self.execCmds = []
		if (callerF === F_)
			if (0 <= numberOfRepetitions && numberOfRepetitions < self.iconGs.length) { // remove dangling
				for (var k=numberOfRepetitions; k<self.iconGs.length; k++)
					self.iconGs[k].remove()
				self.iconGs.splice(numberOfRepetitions, self.iconGs.length-numberOfRepetitions)
			} else {
				for (var i=self.iconGs.length; i<numberOfRepetitions; i++)
					self.iconGs.push(createIcon())
			}
	}
	
	for (var i=0; i<numberOfRepetitions; i++) {
		self.i = i
		// TODO consider line-in and -out diretion for angle
		// place center away from current position in 90° angle to current heading
		var dir = correctRadius(callerF.state.r + Math.PI/2)
		var cx = callerF.state.x + Math.sin(dir) * loopClockRadius * 1.4
		var cy = callerF.state.y - Math.cos(dir) * loopClockRadius * 1.4
		if (callerF === F_) {
			updateIcon(self.iconGs[i])
			self.iconGs[i].attr("transform", "translate("+cx+","+cy+")")
			self.applyCSSClass([self.iconGs[i].circleF], "selected", selection.contains(self))
			self.applyCSSClass([self.iconGs[i].circleF], "mark", selection.containsAsRoot(self.root))
		}
		
		for (var k=0; k<self.root.commands.length; k++) {
			var pos = i*self.root.commands.length + k
			if (rebuild) {
				self.execCmds[pos] = self.root.commands[k].shallowClone(self)
			}
			self.execCmds[pos].exec(callerF)
		}
	}
}

Loop.prototype.mark = function(on) {
	var self = this
	if (self.root.proxies !== undefined)
		self.root.proxies.forEach(function(e) {
			self.applyCSSClass(e.iconGs, "mark", on, "circleF")
		})
}

Loop.prototype.select = function() {
	var self = this
	selection.add(self)
	self.applyCSSClass(self.iconGs, "selected", true, "circleF")
	self.mark(true)
}

Loop.prototype.deselect = function() {
	var self = this
	self.applyCSSClass(self.iconGs, "selected", false, "circleF")
	self.mark(false)
}

Loop.prototype.getVisibleElementsFromMainSVG = function() {
	return ["iconGs", "execCmds"]
}

Loop.prototype.getVisibleElements = function() {
	return ["execCmds"]
}

//Loop.prototype.remove = function() {
//	var self = this
//	self.execCmds.forEach(function(e) { e.remove() })
//	self.removeFromMainSVG()
//}
//
//Loop.prototype.removeFromMainSVG = function() {
//	var self = this
//	self.execCmds.forEach(function(e) { e.removeFromMainSVG() })
//	self.iconGs.forEach(function(e) { e.remove() })
//	self.iconGs = []
//}

Loop.prototype.toCode = function(scopeDepth) {
	return "new vogo.Loop("+this.root.mainParameter.getWrapped()+", "
		+commandsToCodeString(this.root.commands, scopeDepth+1)+")"
}

function FunctionCall(func, args) {
	var self = this
	self.setUpReferences(FunctionCall)
	// func may be undefined if it is a shallowClone
	self.f = func
	self.customArguments = {}
	if (args !== undefined) {
		self.customArguments = args
		for (var a in self.customArguments)
			if (!(self.customArguments[a] instanceof Expression))
				self.customArguments[a] = new Expression(self.customArguments[a])
	}
	self.execCmds = []
	self.icon
}
FunctionCall.prototype = new Command()

FunctionCall.prototype.exec = function(callerF) {
	var self = this
	var root = self.root
	self.savedState = callerF.state.clone()
	console.assert(root.f !== undefined)
	
	if (self.icon === undefined && callerF === F_) {
		self.icon = mainSVG.paintingG.append("foreignObject")
			// TODO make this relative
			.attr("width", 200).attr("height", 100).attr("x", 0).attr("y", 0)
		self.icon.argF = {}
		self.icon.body = self.icon.append("xhtml:body")
		self.icon.body.text = self.icon.body.append("xhtml:text")
			.text("ƒ"+root.f.name)
			.on("click", function() {
				self.select()
				d3.event.stopPropagation()
			})
		self.icon.argUl = self.icon.body.append("ul")
	}
	
	function createInputField() {
		console.assert(self.icon.argF[a] !== undefined)
		console.assert(self.icon.argF[a].text !== undefined)
		console.assert(self.icon.argF[a].input === undefined)
		self.icon.argF[a].text.text(a+"←")
		var value = root.customArguments[a] === undefined ? root.f.args[a].get() : root.customArguments[a].get()
		if (root.customArguments[a] === undefined)
			root.customArguments[a] = new Expression(value)
		self.icon.argF[a].input = self.icon.argF[a].append("div")
			.attr("class", "titleRowCellLast")
			.append("xhtml:input")
			.attr("type", "text")
			.property("value", value)
			.attr("size", 6)
			.on("blur", function() {
				root.customArguments[a].set(this.value)
				run()
			})
			.on("keypress", function() {
				if (d3.event.keyCode === /*enter*/ 13) {
					root.customArguments[a].set(this.value)
					run()
				}
			})
			.on("input", function() {
				self.icon.argF[a].input.attr("size", Math.max(1, self.icon.argF[a].input.property("value").toString().length))
			})
			.call(d3.behavior.drag()
				.on("dragstart", function (d) {
					root.customArguments[a].adjustDragstart(this)
					// drag is not called if this is not done:
					d3.event.sourceEvent.stopPropagation()
				})
				.on("drag", function (d) {
					root.customArguments[a].adjustDrag(this)
				})
				.on("dragend", function (d) {

				})
			)
	}
	
	function switchInputFieldForArg() {
		if (self.icon.argF[a].input !== undefined) {
			self.icon.argF[a].text.text(a+"↑")
			self.icon.argF[a].input.remove()
			self.icon.argF[a].input = undefined
			delete root.customArguments[a]
			run()
		} else {
			createInputField()
		}
	}
	
	if (callerF === F_) {
		self.icon
			.attr("transform", "translate("+(callerF.state.x+1.5)+","+(callerF.state.y-1)+") scale(0.1)")
		for (var a in root.f.args) {
			if (self.icon.argF[a] === undefined) {
				self.icon.argF[a] = self.icon.argUl.append("li").attr("class", "titleRow")
				self.icon.argF[a].text = self.icon.argF[a].append("div")
					.attr("class", "titleRowCellLast")
					.text(a+"↑")
					.style({cursor: "pointer"})
					.on("click", function() {
						// beware! "a" changed due until click is called.
						// so we need to retrieve the original "a"
						a = this.a
						switchInputFieldForArg()
					})
				self.icon.argF[a].text[0][0].a = a
				
				if (root.customArguments[a] !== undefined)
					createInputField()
			}
		}
		for (var a in root.customArguments) {
			if (root.f.args[a] === undefined) {
				if (self.icon.argF[a] !== undefined) {
					self.icon.argF[a].remove()
					delete self.icon.argF[a]
				}
				// may mess for loop up :/
				delete root.customArguments[a]
			}
		}
	}
	
	if (self.execCmds.length !== root.f.commands.length) {
		self.execCmds.forEach(function(e) { e.removeWithProxyConnection() })
		self.execCmds = []
		root.f.commands.forEach(function(e) {
			self.execCmds.push(e.shallowClone(self))
		})
	}
	
	if (self.scopeDepth > scopeDepthLimit) {
		updateNotification("Execution depth too high (>"+scopeDepthLimit+"). Endless loop/recursion? Stopping here.", 5000)
	} else {
//		console.log("exec fc with scopeDepth: "+self.scopeDepth)
		self.execCmds.forEach(function(e) { e.exec(callerF) })
	}
}

FunctionCall.prototype.mark = function(on) {
	var self = this
	// .icon is undefined ? ... when recursing
//	if (self.root.proxies !== undefined)
//		for (var i=0; i<self.root.proxies.length; i++)
//			self.applyCSSClass([self.root.proxies[i].icon.body.text], "mark", on)
}

FunctionCall.prototype.select = function() {
	var self = this
	selection.add(self)
	self.applyCSSClass([self.icon.body.text], "selected", true)
	self.mark(true)
}

FunctionCall.prototype.deselect = function() {
	var self = this
	self.applyCSSClass([self.icon.body.text], "selected", false)
	self.mark(false)
}

FunctionCall.prototype.getVisibleElementsFromMainSVG = function() {
	return ["icon", "execCmds"]
}

FunctionCall.prototype.getVisibleElements = function() {
	return ["execCmds"]
}

//FunctionCall.prototype.remove = function() {
//	var self = this
//	self.removeFromMainSVG()
//	self.execCmds.forEach(function(e) { e.remove() })
//}
//
//FunctionCall.prototype.removeFromMainSVG = function() {
//	var self = this
//	self.execCmds.forEach(function(e) { e.removeFromMainSVG() })
//	if (self.icon !== undefined)
//		self.icon.remove()
//	self.icon = undefined
//}

FunctionCall.prototype.toCode = function(scopeDepth) {
	var self = this
	console.assert(self === self.root)
	// the f.name is not wrapped. it is assumed to exist as a variable
	var result = "new vogo.FunctionCall("+self.f.name+", "
	+argsToCode(self.customArguments)
	+")"
	return result
}


function Branch(cond, ifTrueCmds, ifFalseCmds) {
	var self = this
	self.setUpReferences(Branch)
	if (cond !== undefined)
		self.setMainParameter(cond)
	self.lastCondEvalResult
	self.ifTrueCmds = ifTrueCmds === undefined ? [] : ifTrueCmds
	self.ifTrueCmds.forEach(function (e) { e.scope = self })
	self.ifFalseCmds = ifFalseCmds === undefined ? [] : ifFalseCmds
	self.ifFalseCmds.forEach(function (e) { e.scope = self })
	self.execCmds = []
	self.iconG
}
Branch.prototype = new Command()

Branch.prototype.exec = function(callerF) {
	var self = this
	var root = self.root
	self.savedState = callerF.state.clone()
	var condEval = self.evalMainParameter()
	var condEvalChanged = self.lastCondEvalResult === undefined || self.lastCondEvalResult !== condEval
	self.lastCondEvalResult = condEval
	var branchCmds = condEval ? root.ifTrueCmds : root.ifFalseCmds
	
	if (self.iconG === undefined && callerF === F_) {
		self.iconG = mainSVG.paintingG.append("g").classed("branch", true)
//		self.iconG.append("text").text("?")
//		callerF.paintingG
		self.iconG.trueL = self.iconG.append("line").attr("x1", 1).attr("y1", 1).attr("x2", 2).attr("y2", 0)
		self.iconG.falseL = self.iconG.append("line").attr("x1", 1).attr("y1", 1).attr("x2", 2).attr("y2", 2)
		self.iconG.append("line").attr("x1", 0).attr("y1", 1).attr("x2", 1).attr("y2", 1)
			.on("click", function() {
				if (!manipulation.isCreating()) {
					self.select()
					d3.event.stopPropagation()
				}
			})
		
		self.iconG.fo = self.iconG.append("foreignObject")
			.attr("width", 250 /*max-width*/).attr("height", 25).attr("x", 0).attr("y", 0)
			.on("click", function() {
				d3.event.stopPropagation()
			})
		
		self.iconG.labelInput = self.iconG.fo.append("xhtml:body").append("xhtml:input")
			.attr("type", "text")
			.on("blur", function() {
				self.setMainParameter(this.value)
				run()
			})
			.on("keypress", function() {
				if (d3.event.keyCode === /*enter*/ 13) {
					self.setMainParameter(this.value)
					run()
				}
			})
			.on("input", function() {
				setTextOfInput(self.iconG.labelInput, self.iconG.fo)
			})
	}
	
	if (callerF === F_) {
		self.iconG.attr("transform", "translate("+(callerF.state.x+1.5)+","+(callerF.state.y-1)+")")
		var takenBranchColor = branchCmds.length === 0 ? /*dead end branch*/ "#b00" : "#0b0"
		self.iconG.trueL.style({stroke: condEval ? takenBranchColor : "#000"})
		self.iconG.falseL.style({stroke: condEval ? "#000" : takenBranchColor})
		self.iconG.fo.attr("transform", "translate("+2.4+","+0+") scale(0.1)")
		self.iconG.labelInput.property("value", root.mainParameter.get())
		setTextOfInput(self.iconG.labelInput, self.iconG.fo)
	}
	
	if (condEvalChanged) {
		self.execCmds.forEach(function(e) { e.removeWithProxyConnection() })
		self.execCmds = []
		branchCmds.forEach(function(e) { self.execCmds.push(e.shallowClone(self)) })
	}
	
	self.execCmds.forEach(function(e) { e.exec(callerF) })
}

Branch.prototype.mark = function(on) {
	var self = this
	self.applyCSSClass([self.iconG], "mark", on)
}

Branch.prototype.select = function() {
	var self = this
	selection.add(self)
	self.applyCSSClass([self.iconG], "selected", true)
	self.mark(true)
}

Branch.prototype.deselect = function() {
	var self = this
	self.applyCSSClass([self.iconG], "selected", false)
	self.mark(false)
}

Branch.prototype.getVisibleElementsFromMainSVG = function() {
	return ["iconG", "execCmds"]
}

Branch.prototype.getVisibleElements = function() {
	return ["execCmds"]
}

//Branch.prototype.remove = function() {
//	var self = this
//	self.execCmds.forEach(function(e) { e.remove() })
//	self.removeFromMainSVG()
//}
//
//Branch.prototype.removeFromMainSVG = function() {
//	var self = this
//	self.execCmds.forEach(function(e) { e.removeFromMainSVG() })
//	if (self.iconG !== undefined)
//		self.iconG.remove()
//	self.iconG = undefined
//}

Branch.prototype.toCode = function(scopeDepth) {
	var self = this
	console.assert(self === self.root)
	var result = "new vogo.Branch("+self.root.mainParameter.getWrapped()+", "
		+commandsToCodeString(self.ifTrueCmds, scopeDepth+1)+", "
		+commandsToCodeString(self.ifFalseCmds, scopeDepth+1)+")"
	return result
}


vogo.Drawing = Drawing
vogo.Function = Function
vogo.Move = Move
vogo.Rotate = Rotate
vogo.Loop = Loop
vogo.FunctionCall = FunctionCall
vogo.Branch = Branch


function test() {
	var assert = console.assert
	// TODO
}

return vogo
}()
