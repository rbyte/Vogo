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
var fcArgTextStyle = {cursor: "pointer", "font-size": "10px", color: "#666"}

var zoomFactor = 1.3
var zoomTransitionDuration = 150
var loopClockRadius = 1.3
var rotationArcRadius = 3
var scopeDepthLimit = 6 // for endless loops and recursion
// this determines the default zoom level
var defaultSvgViewboxHeight = 70
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
var lastRotateExecuted
var lastRotateScaleFactorCalculated
var mousePos = [0,0]


var selection = {
	e: [],
	isEmpty: function() {
		return this.e.length === 0
	},
	add: function(x) {
		console.assert(x.root !== x) // only proxies can be selected
		if (!keyPressed.shift) {
			this.removeAndDeselectAll()
			this.e.push(x)
		} else { // accumulate multiple
			if (this.contains(x)) {
				this.removeAndDeselect(x)
			} else {
				this.e.push(x)
			}
		}
		run()
	},
	contains: function(x) {
		return this.e.indexOf(x) !== -1
	},
	containsAsRoot: function(x) {
		for (var i=0; i<this.e.length; i++)
			if (this.e[i].root === x.root)
				return true
		return false
	},
	removeAndDeselect: function(x) {
		if (this.contains(x))
			this.e.splice(this.e.indexOf(x), 1)
		x.deselect()
	},
	removeAndDeselectAll: function() {
		var detach = this.e
		this.e = []
		detach.forEach(function(x) { x.deselect() })
		return detach
	},
	// remove means splice from selection
	// deselect means disable highlighting indicating selection
	// delete means structurally remove command from program (root, all proxies, ...)
	removeDeselectAndDeleteAllCompletely: function() {
		var detach = this.removeAndDeselectAll()
		detach.forEach(function(x) { x.deleteCompletely() })
		return detach
	}
}

vogo.init = function() {
	domSvg = document.getElementById("turtleSVG")
	mainSVG = new MainSVG()
	window.onresize = function(event) { updateScreenElemsSize()}
	window.onresize()
	addNewFuncToUI()
	setupUIEventListeners()
	run()
	manualTest()
//	automaticTest()
}

// wraps a function for drawing it multiple times
function Drawing(f, args, paintingG) {
	var func = new Func(f.name, {}, [new FuncCall(f, args)], paintingG).exec()
	paintingG[0][0].vogo = func
	func.update = function(newArgs) {
		console.assert(this.getRootCommandsRef().length == 1)
		// TODO is this right?
		var fc = this.execCmds[0]
		console.assert(fc instanceof FuncCall)
		if (newArgs !== undefined) {
			// leave old, just override
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
	lastRotateExecuted = undefined
	lastRotateScaleFactorCalculated = undefined
	F_.exec()
	F_.updateTurtle()
	mainSVG.updateTurtle()
	
	functions.forEach(function(f) {
		if (f !== F_) {
			f.state.reset()
			lastRotateExecuted = undefined
			lastRotateScaleFactorCalculated = undefined
			f.exec()
		}
	})
}

function updateScreenElemsSize() {
//	var winW = document.body.clientWidth
//	var winH = window.innerHeight
	
	var bb = document.getElementById("turtleSVGcontainer").getBoundingClientRect()
	mainSVG.svgWidth = bb.width
	mainSVG.svgHeight = bb.height
	
	functions.forEach(function(f) { f.updateViewbox() })
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
		addNewFuncToUI()
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
		mousePos = d3.mouse(this)
		if (manipulation.isCreating(Move))
			manipulation.update(Move, fromMousePosToLineLengthWithoutChangingDirectionFUNC(mousePos[0], mousePos[1]))
		if (manipulation.isCreating(Rotate))
			manipulation.update(Rotate, fromMousePosToRotateAngleFUNC(mousePos[0], mousePos[1]))
    })
	
	mainSVG.svg.on("click", function (d, i) {
		mousePos = d3.mouse(this)
		if (manipulation.isCreating(Move)) {
			var newLineLengthFUNC = fromMousePosToLineLengthWithoutChangingDirectionFUNC(mousePos[0], mousePos[1])
			if (keyPressed.d) {
				manipulation.create(Move, newLineLengthFUNC)
			} else {
				manipulation.finish(Move, newLineLengthFUNC)
			}
		} else if (manipulation.isCreating(Rotate)) {
			var newRotateAngleFUNC = fromMousePosToRotateAngleFUNC(mousePos[0], mousePos[1])
			if (keyPressed.r) {
				manipulation.create(Rotate, newRotateAngleFUNC)
			} else {
				manipulation.finish(Rotate, newRotateAngleFUNC)
			}
		} else {
			if (!selection.isEmpty()) {
				selection.removeAndDeselectAll()
				run()
			}
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


function fromMousePosToRotateAngleFUNC(mx, my) {
	return function() { return parseFloat(rotateAngleTo(mx, my).toFixed(3)) }
}

function fromMousePosToLineLengthWithoutChangingDirectionFUNC(mx, my) {
	return function() { return parseFloat(getLineLengthToWithoutChangingDirection(mx, my).toFixed(2)) }
}

function rotateAngleTo(x, y) {
	return getAngleDeltaTo(x - F_.state.x, y - F_.state.y)
}

function getAngleDeltaTo(dx, dy, r) {
	return correctRadius(Math.atan2(dy, dx) + Math.PI/2 - (r === undefined ? F_.state.r : r))
}

function getLineLengthTo(x, y) {
	var dx = x - F_.state.x
	var dy = y - F_.state.y
	return Math.sqrt(dx*dx + dy*dy)
}

function getLineLengthToWithoutChangingDirection(x, y) {
	var ra = rotateAngleTo(x, y)
	return (ra > Math.PI/2 || ra < Math.PI/2 ? 1 : -1) * Math.cos(ra) * getLineLengthTo(x, y)
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
//			&& self.root.mainParameter.isStatic()
			)
}

function setTextOfInput(input, containingForeignObject, text) {
	if (text === undefined)
		text = input.property("value")
	else
		input.property("value", text)
	input.attr("size", Math.max(1, text.toString().length))
	if (!containingForeignObject.classed("hide")) {
		var newWidth = input[0][0].offsetWidth
		if (newWidth > 0)
			containingForeignObject.attr("width", newWidth+5)
	}
}

function addNewFuncToUI(name) {
	var f = new Func(name)
	f.initUI()
	functions.push(f)
	f.switchTo()
}

function exportAll() {
	var fDep = determineFuncDependencies()
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

function determineFuncDependencies() {
	// TODO big bug in here: the dependencies are actually a tree, not just a list!
	// store proxies in function? let fc take care of removing it. shallowClone for function = functionCall ?
	var dependencies = {}
	function searchForFuncCall(commands) {
		for (var k=0; k<commands.length; k++) {
			if (commands[k] instanceof FuncCall) {
				dependencies[i] = functions.indexOf(commands[k].root.f)
			}
			if (commands[k] instanceof Loop)
				searchForFuncCall(commands[k].getRootCommandsRef())
			if (commands[k] instanceof Branch) {
				searchForFuncCall(commands[k].ifTrueBranch)
				searchForFuncCall(commands[k].ifFalseBranch)
			}
		}
	}
	for (var i=0; k<functions.length; k++)
		searchForFuncCall(functions[i].getRootCommandsRef())
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

// call fName on each arr element. it is assumed that fName itself removes the element from the array
function forEachSelfRemovingDoCall(arr, fName) {
	var l = arr.length
	while (l > 0) {
		arr[0][fName]()
		console.assert(l === arr.length+1)
		l = arr.length
	}
}

function insertCmdRespectingSelection(cmd) {
	var stateAtInsertionPoint
	if (selection.isEmpty()) { // append to end
		cmd.scope = F_
		stateAtInsertionPoint = F_.state.clone()
		F_.commands.push(cmd)
	} else {
		var selectedElem = selection.e[0]
		var cmdsRef, cmdSelIdx, rootScope
		if (selectedElem.canContainCommands() && !(selectedElem instanceof FuncCall)) { // append inside
			rootScope = selectedElem.root
			cmdsRef = selectedElem.getRootCommandsRef()
			// cmdsRef may be empty. splicing at length appends.
			cmdSelIdx = cmdsRef.length
			// we append inside the sScope, so the state at the insertion point
			// is the savedState of the element after the scope, or if there
			// is non, F_ current state (final)
			var cmdsRefOuter = selectedElem.scope.execCmds
			var cmdSelIdxOuter = cmdsRefOuter.indexOf(selectedElem)
			console.assert(cmdSelIdxOuter !== -1)
			stateAtInsertionPoint = cmdSelIdxOuter+1 >= cmdsRefOuter.length
				? F_.state.clone()
				: cmdsRefOuter[cmdSelIdxOuter+1].savedState.clone()
		} else {
			// insert before selected command
			rootScope = selectedElem.root.scope
			cmdsRef = selectedElem.scope.getRootCommandsRef()
			cmdSelIdx = cmdsRef.indexOf(selectedElem.root)
			stateAtInsertionPoint = selectedElem.savedState.clone()
			console.assert(cmdSelIdx !== -1)
		}
		cmd.scope = rootScope
		cmdsRef.splice(cmdSelIdx, 0, cmd)
	}
	return stateAtInsertionPoint
}

onKeyDown.n = function() {
	if (bodyIsSelected())
		addNewFuncToUI()
}

onKeyDown.d = function() {
	if (bodyIsSelected()) {
		var newLineLengthFUNC = fromMousePosToLineLengthWithoutChangingDirectionFUNC(mousePos[0], mousePos[1])
		if (!manipulation.isCreating()) {
			manipulation.createPreview(Move, newLineLengthFUNC)
		} else if (manipulation.isCreating(Rotate)) {
			var newRotateAngle = fromMousePosToRotateAngleFUNC(mousePos[0], mousePos[1])
			manipulation.finish(Rotate, newRotateAngle)
			manipulation.createPreview(Move, newLineLengthFUNC)
		}
	}
}

onKeyDown.r = function() {
	if (bodyIsSelected()) {
		var newRotateAngleFUNC = fromMousePosToRotateAngleFUNC(mousePos[0], mousePos[1])
		if (!manipulation.isCreating()) {
			manipulation.createPreview(Rotate, newRotateAngleFUNC)
		} else if (manipulation.isCreating(Move)) {
			var newLineLengthFUNC = fromMousePosToLineLengthWithoutChangingDirectionFUNC(mousePos[0], mousePos[1])
			manipulation.finish(Move, newLineLengthFUNC)
			manipulation.createPreview(Rotate, newRotateAngleFUNC)
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
		selection.removeDeselectAndDeleteAllCompletely()
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
	if (selection.isEmpty()) {
		F_.addArgument("1")
	} else {
		// TODO if exp isStatic
		var argName = F_.addArgument(selection.e[0].evalMainParameter())
		selection.e[0].setMainParameter(argName)
	}
	run()
}

function wrapSelectionInCommand(cmdName, doWithCmdList) {
	if (selection.isEmpty()) {
		updateNotification("Select something to "+cmdName+".", 5000)
		return
	}
	// notice that this is not the root elems scope
	// this is important for determining the right branch (if the scope is a branch)
	var scope = selection.e[0].scope
	var rootScope = selection.e[0].root.scope
	console.assert(scope !== scope.root || scope instanceof Func)
	var cmdsRef = scope.getRootCommandsRef()
	
	console.assert(cmdsRef !== undefined)
	var idxArr = []
	for (var i=0; i<selection.e.length; i++) {
		if (i !== 0 && scope !== selection.e[i].scope) {
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
	var clonedCmdsList = []
	cmdList.forEach(function(e) {
		var r = e.clone(rootScope)
		console.assert(r.proxies === undefined)
		clonedCmdsList.push(r)
	})
	selection.removeDeselectAndDeleteAllCompletely()
	var cmdThatWrapped = doWithCmdList(clonedCmdsList)
	cmdThatWrapped.scope = rootScope
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
	return isRegularNumber(result) || result === true || result === false || result instanceof Array
}

// THIS IS WELL THOUGHT THROUGH. do not mess with it, unless you know what you do
Expression.prototype.eval = function(command) {
	var self = this
	console.assert(self.exp !== undefined, "Expression eval: Warning: exp is undefined!")
	if (self.isConst())
		return self.exp
	
	if (self.isStatic())
		return self.cachedEvalFromStaticExp
	
	console.assert(typeof self.exp === "string")
	
	function evalWithChecks(toEval) {
		var result
		try {
			result = eval(toEval)
		} catch(e) {
			console.log(toEval)
			console.log(e)
			return 1 // be a bit robust
		}
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
		&& !(sc instanceof FuncCall) && !(sc instanceof Func)) {
		// also, check whether there is a loop on the way (because it has an index)
		if (loopIndex === undefined && sc.i !== undefined)
			loopIndex = sc.i
		sc = sc.scope // traverse scope chain up
	}
	var fc, mainArgProvider
	if (sc instanceof FuncCall) {
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
		console.assert(sc instanceof Func)
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
	var argsKeys = Object.keys(mainArgProvider)
	var argsValues = []
	for (var arg in mainArgProvider) { // arguments itself are Expressions
		// TODO args are evaluated in a chain -> this is very slow! it spans a tree
		var argV
		if (fc !== undefined) {
			argV = fc.cachedArguments[arg]
			if (argV === undefined) {
				argV = fc.root.customArguments[arg] !== undefined
					? fc.root.customArguments[arg].eval(fc)
					: mainArgProvider[arg].eval()
				fc.cachedArguments[arg] = argV
			}
		} else {
			argV = mainArgProvider[arg].eval()
		}
//		fc !== undefined && fc.root.customArguments[arg] !== undefined
//			? fc.root.customArguments[arg].eval(fc)
//			: mainArgProvider[arg].eval()
		argsValues.push(argV)
	}
	if (loopIndex !== undefined) {
		argsKeys.push("i")
		argsValues.push(loopIndex)
	}
	
	var result
	function errorMsg(e) {
		console.log("Error in eval. Following: result, keys, values, expression, message:")
		console.log(result)
		console.log(argsKeys)
		console.log(argsValues)
		console.log(self.exp)
		console.log(e)
	}
	try {
		// THIS IS THE CRUCIAL LINE. construct function that has all the arguments for expression eval
		result = new Function(argsKeys, "return "+self.exp).apply(this, argsValues)
	} catch(e) {
		errorMsg(e)
		return 1 // be a bit robust
	}
	if (!self.isNormalResult(result))
		errorMsg("is not a normal result.")
	return result
}

/*
	var toEval = "(function("
	var i = 0
	for (var arg in mainArgProvider)
		toEval += arg+(++i < argsCount ? ", " : "")
	if (loopIndex !== undefined)
		toEval += (argsCount > 0 ? ", " : "")+"l1" // loop 1 index
	toEval +=") { return "+self.exp+"; })("
	i = 0
	for (var arg in mainArgProvider) { // arguments itself are Expressions
		var a = (fc !== undefined && fc.root.customArguments[arg] !== undefined
			? fc.root.customArguments[arg].eval(fc)
			: mainArgProvider[arg].eval())
		if (a instanceof Array)
			a = "["+a+"]"
		toEval += a +(++i < argsCount ? ", " : "")
	}
	// TODO for simplicity, lets just do the first loop...
	if (loopIndex !== undefined)
		toEval += (argsCount > 0 ? ", " : "")+loopIndex
	toEval +=")"
	return evalWithChecks(toEval)

 **/



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


var manipulation = {
	insertedCommand: false
}

manipulation.isCreating = function(cmdType) {
	return cmdType === undefined
		? this.insertedCommand !== false
		: this.insertedCommand instanceof cmdType
}

manipulation.create = function(cmdType, newMainParameterFUNC) {
	if (this.isCreating(cmdType)) {
		this.finish(cmdType, newMainParameterFUNC)
		this.createPreview(cmdType, newMainParameterFUNC)
	} else {
		this.createPreview(cmdType, newMainParameterFUNC)
		this.finish(cmdType, newMainParameterFUNC)
	}
}

manipulation.createPreview = function(cmdType, newMainParameterFUNC) {
	console.assert(!this.isCreating(cmdType))
	this.insertedCommand = new cmdType()
	this.savedState = insertCmdRespectingSelection(this.insertedCommand)
	this.update(cmdType, newMainParameterFUNC)
}

manipulation.update = function(cmdType, newMainParameterFUNC) {
	if (this.isCreating(cmdType)) {
		F_.state = this.savedState.clone()
		// the new main parameter has to be calculated AFTER the state is reset
		this.insertedCommand.setMainParameter(newMainParameterFUNC()/*calc here*/)
		run()
	} else {
		// this happens when update is called before draw, when body is not selected
		// because update is called, but key press is supressed
		this.createPreview(cmdType, newMainParameterFUNC)
		console.log("manipulation.update: warning: no preview exists yet")
	}
}

manipulation.finish = function(cmdType, newMainParameterFUNC) {
	console.assert(this.isCreating(cmdType))
	this.update(cmdType, newMainParameterFUNC)
	var ic = this.insertedCommand
	this.insertedCommand = false
	updateLabelVisibility(ic)
}

manipulation.remove = function(cmdType) {
	console.assert(this.isCreating(cmdType))
	this.insertedCommand.deleteCompletely()
	this.insertedCommand = false
	run()
}














////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// this is only called once for every kind of command
function Command(myConstructor) {
	var self = this
	// myConstructor is what .constructor should be but isnt.
	self.myConstructor = myConstructor
}

// this is called for every instance of command
Command.prototype.commonCommandConstructor = function() {
	var self = this
	self.root = self
	// each shallowClone is a proxy (child) to the root
	self.proxies
	self.scope
	self.mainParameter
	self.scopeDepth = 0
	self.refDepthOfSameType = 0
	self.savedState
}

Command.prototype.setMainParameter = function(x) {
	var self = this
	if (x !== undefined)
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
	// creates a new object of self's type
	// so if self is a Move, c will be a Move
	// note that self.constructor === Command, which is really confusing

	// ok, ok, had several problems with this now!
	// until I dont know exactly what this is doing, I stay the hell away from it
//	var c = Object.create(self)
//	BUMMER: THIS BREAKS
//	console.assert(c.proxies === undefined)
	
	var c = new self.myConstructor()
	console.assert(c instanceof self.myConstructor)
	// root is not self's parent, so there is no chain of references if a clone is cloned
	c.root = self.root
	if (self.root !== self)
		console.assert(self.proxies === undefined)
	if (self.root.proxies === undefined)
		self.root.proxies = []
	self.root.proxies.push(c)
	// scope is the initiator of the clone
	console.assert(scope !== undefined)
	console.assert(scope.canContainCommands())
	console.assert(scope.root !== scope || scope instanceof Func)
	c.scope = scope
	c.scopeDepth = scope.scopeDepth + 1
	if (self.scopeDepth > scopeDepthLimit+1)
		console.log("warning: scope depth too high!")
	c.refDepthOfSameType = scope.refDepthOfSameType + (scope instanceof self.myConstructor ? 1 : 0)
	return c
}

// deletes the root, its proxies, its visible elements, all commands it contains and all references
Command.prototype.deleteCompletely = function() {
	var root = this.root
	if (root === undefined)
		return // is already deleted. happens when a loop and one of its elements is selected and deleted.
		// because deleting the loop already deleted the element
	if (root.canContainCommands()) {
		// roots execCmds is always empty.
		root.deleteCompletelyContainedCommands()
	}
	if (root.proxies !== undefined) {
		// "self" may be in proxies
		forEachSelfRemovingDoCall(root.proxies, "deleteProxyCommand")
		console.assert(root.proxies.length === 0)
	}
	// root is never exec() so it has no visible elements
//	root.removeVisible()
	root.scope.fromRemoveRootCommand(root)
	delete root.root
	delete root.scope
	delete root.mainParameter
}

Command.prototype.deleteCompletelyContainedCommands = function() {
	var root = this.root
	// this also removes all proxies in root.execCmds
	forEachSelfRemovingDoCall(root.getRootCommandsRef(), "deleteCompletely")
	console.assert(root.execCmds.length === 0)
}

Command.prototype.fromRemoveRootCommand = function(cmd) {
	var self = this
	console.assert(cmd.root === cmd)
	console.assert(self === cmd.scope)
	var cmdsRef = self.getRootCommandsRef()
	console.assert(cmdsRef !== undefined)
	var idx = cmdsRef.indexOf(cmd)
	console.assert(idx !== -1)
	cmdsRef.splice(idx, 1)
}

Command.prototype.deleteProxyCommand = function() {
	var self = this
	console.assert(self.root !== self)
	console.assert(self.proxies === undefined) // -> is proxy
	console.assert(self.root.proxies.length > 0)
	self.removeVisible()
	
	var idx = self.root.proxies.indexOf(self)
	console.assert(idx !== -1)
	self.root.proxies.splice(idx, 1)
	
	console.assert(self.scope.canContainCommands())
	console.assert(self.scope.execCmds.length > 0)
	idx = self.scope.execCmds.indexOf(self)
	console.assert(idx !== -1)
	self.scope.execCmds.splice(idx, 1)
	
	delete self.root
	delete self.scope
}

Command.prototype.applyCSSClass = function(elements, cssName, on, prop) {
	if (elements instanceof Array)
		elements.forEach(function(e) {
			if (e !== undefined) {
				// TODO it seems d3.classed does regex which is VERY slow.
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
	console.assert(self !== self.root)
	// props is an array of strings. the strings are properties of self
	props.forEach(function(p) {
		// we have 3 cases: self[p] is
		// 1) a simple d3 object
		// 2) an array of simple d3 objects
		// 3) an array of commands
		if (self[p] !== undefined) {
			// cannot check for Array directly because any d3 object is also an Array
			if (self[p].remove === undefined) { // is Array
				for (var i=0; i<self[p].length; i++) {
					if (self[p][i].remove === undefined) { // 3
						fromMainSVG
							? self[p][i].removeVisibleFromMainSVG()
							: self[p][i].removeVisible()
					} else { // 2
						self[p][i].remove()
						self[p][i] = undefined
					}
				}
			} else { // 1
				self[p].remove()
				self[p] = undefined
			}
		}
	})
}

// does not change the program. may become visible again after reexecution.
// this always deselects without removing from selection!
Command.prototype.removeVisible = function() {
	this.removeVisibleElements(this.getVisibleElements())
	this.removeVisibleFromMainSVG()
}

Command.prototype.removeVisibleFromMainSVG = function() {
	selection.removeAndDeselect(this)
//	this.deselect()
	this.removeVisibleElements(this.getVisibleElementsFromMainSVG(), true)
}

Command.prototype.toCode = function(scopeDepth) {
	return "new vogo."+this.myConstructor.name/*JS6*/
		+"("+this.root.mainParameter.getWrapped()+")"
}

Command.prototype.canContainCommands = function() {
	return this.hasOwnProperty("execCmds")
}

Command.prototype.exec = function(callerF) {
	var self = this
	console.assert(self.root !== self, "root cmds are never exec() directly.")
	self.savedState = callerF.state.clone()
	self.execInner(callerF)
}

Command.prototype.isInsideAnySelectedCommandsScope = function(includingProxies) {
	var self = this
	var scp = self.scope
	// traverse scope up to see if self is somewhere inside the selection
	var checKr = includingProxies === undefined ? "contains" : "containsAsRoot"
	if (!selection.isEmpty())
		while (!(scp instanceof Func) && !selection[checKr](scp))
			scp = scp.scope
	return selection[checKr](scp)
}

function Func(name, args, commands, customPaintingG) {
	var self = this
	self.commonCommandConstructor()
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
	self.execCmds = []
	if (commands !== undefined)
		self.setCommands(commands)
	if (customPaintingG !== undefined)
		self.paintingG = customPaintingG
	return self
}
// actually, Func requires only few things from Command and only some methods work on Func
Func.prototype = new Command(Func)

Func.prototype.initUI = function() {
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
					insertCmdRespectingSelection(new FuncCall(self))
					run()
				}
			})
		)
	
	self.svgInit()
	return self
}

MainSVG.prototype.svgInit = Func.prototype.svgInit = function() {
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

Func.prototype.updateTurtle = function() {
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

Func.prototype.updateViewbox = function(afterZoom) {
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

Func.prototype.checkName = function(newName) {
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

Func.prototype.searchForName = function(charCodeStart, range, checkFunc, s, depth) {
	if (depth === 0)
		return (checkFunc(s) ? s : false)
	for (var i=0; i<range; i++) {
		var r = this.searchForName(charCodeStart, range, checkFunc, s + String.fromCharCode(charCodeStart+i), depth-1)
		if (r !== false)
			return r
	}
	return this.searchForName(charCodeStart, range, checkFunc, s, depth+1)
}

Func.prototype.setName = function(newName) {
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

Func.prototype.checkArgumentName = function(newName) {
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

Func.prototype.addArgument = function(defaultValue, argName) {
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

Func.prototype.setCommands = function(commands) {
	console.assert(commands instanceof Array)
	var self = this
	console.assert(self.commands.length === 0)
	self.commands = commands
	self.commands.forEach(function (e) {
		console.assert(e.root === e)
		e.scope = self
	})
	console.assert(self.execCmds.length === 0)
	return self
}

// @override
Func.prototype.exec = function(/*no caller here*/) {
	var self = this
	if (self.commands.length !== self.execCmds.length) {
		forEachSelfRemovingDoCall(self.execCmds, "deleteProxyCommand")
		console.assert(self.execCmds.length === 0)
		self.commands.forEach(function (e) { self.execCmds.push(e.shallowClone(self)) })
	}
	self.execCmds.forEach(function(e) { e.exec(self) })
	self.updateTurtle()
	return self
}

Func.prototype.switchTo = function() {
	var self = this
	self.svgContainer.classed("fSVGselected", true)
	if (F_ === self)
		return
	selection.removeAndDeselectAll()
	if (F_ !== undefined) {
		self.previousF_ = F_
		F_.svgContainer.classed("fSVGselected", false)
		F_.execCmds.forEach(function(e) { e.removeVisibleFromMainSVG() })
	}
	F_ = self
	F_.updateViewbox()
	mainSVG.updateViewbox()
	run()
	// this sets the active element back to body, which is required for drawing
	document.activeElement.blur()
}

// TODO rename
Func.prototype.remove = function() {
	var self = this
	functions.splice(functions.indexOf(self), 1)
	if (F_ === self && functions.length > 0) { // switch to previous or last
		(self.previousF_ !== undefined && functions.indexOf(self.previousF_) !== -1
			? self.previousF_
			: functions[functions.length-1])
				.switchTo()
	}
	
	self.deleteCompletelyContainedCommands()

	// contains everything
	self.li_f.remove()
	delete self.svg
	delete self.nameInput
	delete self.ul_args
	delete self.svgContainer
	delete self.li_f
	delete self.previousF_
}

Func.prototype.setStateTo = function(idx) {
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

// @override
Func.prototype.toCode = function() {
	var self = this
	var result = "var "+self.name+" = new vogo.Func(\""+self.name+"\", "
		+argsToCode(self.args)+");\n"
		// the extra call will make recursion possible
		+self.name+".setCommands("+commandsToCodeString(self.commands, 0)+");"
	return result
}

Func.prototype.getRootCommandsRef = function() {
	return this.root.commands // .root, but functions can not have proxies anyway
}

function Move(lineLength) {
	var self = this
	self.commonCommandConstructor()
	self.setMainParameter(lineLength)
	self.line
	self.lineMainSVG
	self.label
}
Move.prototype = new Command(Move)

Move.prototype.clone = function(scope) {
	console.assert(this === this.root)
	var r = new Move(this.mainParameter.get())
	r.scope = scope
	return r
}

Move.prototype.execInner = function(callerF) {
	var self = this
	var lineLength = self.evalMainParameter()
	
	// TODO this is a pretty ugly quick fix solution
	if (lastRotateExecuted !== undefined
		&& lastRotateExecuted.arc !== undefined
		&& lastRotateExecuted.scope.root === self.scope.root) {
		lastRotateScaleFactorCalculated = Math.min(rotationArcRadius, Math.abs(lineLength)*0.3)/rotationArcRadius
		// TODO do this more efficiently
		// be aware of the fact that lastRotateExecuted may not be the last command executed or even be in the same function
		var match = /^(translate\([^\)]*\))/.exec(lastRotateExecuted.arc.attr("transform"))
		console.assert(match !== null)
		lastRotateExecuted.arc.attr("transform", match[1]+" scale("+lastRotateScaleFactorCalculated+")")
		// to avoid readjusting angle if (e.g.) two moves are in a row
		lastRotateExecuted = undefined
	}
	
	var x1 = callerF.state.x
	var y1 = callerF.state.y
	callerF.state.x += Math.sin(callerF.state.r) * lineLength
	callerF.state.y -= Math.cos(callerF.state.r) * lineLength
	var x2 = callerF.state.x
	var y2 = callerF.state.y
	if (self.line === undefined) {
		self.line = callerF.paintingG.append("line").style(lineStyle)
	}
	var drawOnMainSVG = callerF === F_
	var drawIcons = drawOnMainSVG && (self.scopeDepth <= 1 || selection.containsAsRoot(self))
	
	if (self.lineMainSVG === undefined && drawOnMainSVG) {
		self.lineMainSVG = mainSVG.paintingG.append("line").style(lineStyle)
		self.lineMainSVG.on("click", function(d, i) {
			if (!manipulation.isCreating()) {
				self.select()
				// to prevent click on background
				d3.event.stopPropagation()
			}
		})
	}
	
	if (self.label === undefined && drawIcons) {
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
	
	if (self.label !== undefined && !drawIcons) {
		self.label.remove()
		self.label = undefined
	}
	
	var lines = [self.line]
	if (drawOnMainSVG) {
		lines.push(self.lineMainSVG)
		self.indicateIfInsideAnySelectedCommandsScope()
	}
	if (drawIcons) {
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

Move.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	self.lineMainSVG.style({"stroke-opacity":
		self.isInsideAnySelectedCommandsScope(true/*including proxies*/)
		? 0.5 //(self.isInsideAnySelectedCommandsScope() ? 0.25 : 0.5)
		: 1.0})
}

Move.prototype.mark = function(on) {
	var self = this
	self.applyCSSClass(self.root.proxies, "mark", on, "lineMainSVG")
}

Move.prototype.select = function() {
	var self = this
	selection.add(self)
	self.applyCSSClass([self.lineMainSVG], "selected", true)
	self.mark(true)
	if (self.label !== undefined) {
		self.label.classed("hide", false)
		setTextOfInput(self.labelInput, self.label)
	}
}

Move.prototype.deselect = function() {
	var self = this
	updateLabelVisibility(self)
	self.applyCSSClass([self.lineMainSVG], "selected", false)
	self.mark(false)
}

Move.prototype.getVisibleElementsFromMainSVG = function() {
	return ["lineMainSVG", "label"]
}

Move.prototype.getVisibleElements = function() {
	return ["line"]
}

function Rotate(angle) {
	var self = this
	self.commonCommandConstructor()
	self.setMainParameter(angle)
	self.arc
	self.label
}
Rotate.prototype = new Command(Rotate)

Rotate.prototype.clone = function(scope) {
	console.assert(this === this.root)
	var r = new Rotate(this.mainParameter.get())
	r.scope = scope
	return r
}

Rotate.prototype.execInner = function(callerF) {
	var self = this
	var angle = correctRadius(self.evalMainParameter())
	var dragStartState
	
	var arc = d3.svg.arc()
		.innerRadius(0)
		.outerRadius(rotationArcRadius)
		.startAngle(callerF.state.r)
		.endAngle(callerF.state.r + angle)
	callerF.state.addRadius(angle)
	var drawIcons = callerF === F_
	var drawLabel = callerF === F_ && (self.scopeDepth <= 1 || selection.containsAsRoot(self))
	
	if (self.arc === undefined && drawIcons) {
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
	
	if (self.label === undefined && drawLabel) {
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
	
	if (drawLabel) {
		updateLabelVisibility(self)
		var dir = correctRadius(callerF.state.r - angle/2)
		var x = callerF.state.x + Math.sin(dir) * rotationArcRadius * 0.6
		var y = callerF.state.y - Math.cos(dir) * rotationArcRadius * 0.6 - 1 // vertical alignment
		self.label.attr("transform", "translate("+x+","+y+") scale(0.1)")
		setTextOfInput(self.labelInput, self.label, self.root.mainParameter.get())
			//+"="+Math.round(angle/Math.PI*180)+"°"
	}
	if (drawIcons) {
		self.arc.attr("d", arc)
			.attr("transform", "translate("+callerF.state.x+","+callerF.state.y+")"
				+(lastRotateScaleFactorCalculated ? " scale("+lastRotateScaleFactorCalculated+")" : ""))
		self.indicateIfInsideAnySelectedCommandsScope()
		lastRotateExecuted = self
	}
}

Rotate.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	self.arc.style({"fill-opacity":
		self.isInsideAnySelectedCommandsScope(true/*including proxies*/)
		? 0.05
		: arcStyle["fill-opacity"]})
}

Rotate.prototype.mark = function(on) {
	var self = this
	self.applyCSSClass(self.root.proxies, "mark", on, "arc")
}

Rotate.prototype.select = function() {
	var self = this
	selection.add(self)
	self.applyCSSClass([self.arc], "selected", true)
	self.mark(true)
	if (self.label !== undefined) {
		self.label.classed("hide", false)
		setTextOfInput(self.labelInput, self.label)
	}
}

Rotate.prototype.deselect = function() {
	var self = this
	updateLabelVisibility(self)
	self.applyCSSClass([self.arc], "selected", false)
	self.mark(false)
}

Rotate.prototype.getVisibleElementsFromMainSVG = function() {
	return ["arc", "label"]
}

Rotate.prototype.getVisibleElements = function() {
	return []
}


function Loop(numberOfRepetitions, commands) {
	var self = this
	self.commonCommandConstructor()
	self.setMainParameter(numberOfRepetitions)
	self.commands = commands === undefined ? [] : commands
	self.commands.forEach(function (e) {
		console.assert(e.proxies === undefined)
		e.scope = self.root
	})
	// "unfolded" loop
	self.execCmds = []
	// for all repetitions
	self.iconGs = []
}
Loop.prototype = new Command(Loop)

Loop.prototype.clone = function(scope) {
	var self = this
	console.assert(self.root === self)
	var cmdsClone = []
	self.commands.forEach(function (e) { cmdsClone.push(e.clone(/*scope set afterwards*/)) })
	var r = new Loop(self.mainParameter.get(), cmdsClone)
	// TODO scopeDepth is always 0 for root commands
	r.scope = scope
	return r
}

Loop.prototype.execInner = function(callerF) {
	var self = this
	// TODO if this is 0 the loop becomes unaccessable
	var numberOfRepetitions = Math.max(1, Math.floor(self.evalMainParameter()))
	// shrink inner loops radius
	var loopClockRadiusUsed = loopClockRadius * Math.pow(0.7, self.refDepthOfSameType+1)
	var drawIcons = callerF === F_
	
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
		forEachSelfRemovingDoCall(self.execCmds, "deleteProxyCommand")
		console.assert(self.execCmds.length === 0)
		if (drawIcons)
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
		if (drawIcons) {
			if (self.iconGs[i] === undefined)
				self.iconGs[i] = createIcon()
			updateIcon(self.iconGs[i])
			self.indicateIfInsideAnySelectedCommandsScope()
			self.iconGs[i].attr("transform", "translate("+cx+","+cy+")")
			self.applyCSSClass([self.iconGs[i].circleF], "selected", selection.contains(self))
			self.applyCSSClass([self.iconGs[i].circleF], "mark", selection.containsAsRoot(self))
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

Loop.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	var on = self.isInsideAnySelectedCommandsScope(true/*including proxies*/)
	self.iconGs.forEach(function(e) {
		e.style({"opacity": on ? 0.4 : 1.0})
	})
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

// @override
Loop.prototype.toCode = function(scopeDepth) {
	return "new vogo.Loop("+this.root.mainParameter.getWrapped()+", "
		+commandsToCodeString(this.root.commands, scopeDepth+1)+")"
}

Loop.prototype.getRootCommandsRef = function() {
	return this.root.commands
}

function FuncCall(func, args) {
	var self = this
	self.commonCommandConstructor()
	// normally, I would use setMainParameter(func), but func is currently not an Expression and not editable
	// func may be undefined if it is a shallowClone
	self.f = func
	self.customArguments = {}
	self.cachedArguments = {}
	if (args !== undefined) {
		self.customArguments = args
		for (var a in self.customArguments)
			if (!(self.customArguments[a] instanceof Expression))
				self.customArguments[a] = new Expression(self.customArguments[a])
	}
	self.execCmds = []
	self.icon
}
FuncCall.prototype = new Command(FuncCall)

FuncCall.prototype.clone = function(scope) {
	var self = this
	console.assert(self.root === self)
	var customArguments = {}
	for (var a in self.customArguments)
		customArguments[a] = new Expression(self.customArguments[a].get())
	var r = new FuncCall(self.f, customArguments)
	r.scope = scope
	return r
}

FuncCall.prototype.execInner = function(callerF) {
	var self = this
	var root = self.root
	console.assert(root.f !== undefined)
	
	var drawIcons = callerF === F_ && (
		self.scopeDepth <= 1
		|| selection.containsAsRoot(self)
		|| root.proxies[0] === self
	)
	
	if (self.icon === undefined && drawIcons) {
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
		self.icon.argUl = self.icon.body.append("xhtml:ul")
	}
	
	if (self.icon !== undefined && !drawIcons) {
		self.icon.remove()
		self.icon = undefined
	}
	
	function createInputField(a) {
		console.assert(self.icon.argF[a] !== undefined)
		console.assert(self.icon.argF[a].text !== undefined)
		console.assert(self.icon.argF[a].input === undefined)
		self.icon.argF[a].text
			.text(a+"←").style({"font-size": "16px"})
		var value = root.customArguments[a] === undefined ? root.f.args[a].get() : root.customArguments[a].get()
		if (root.customArguments[a] === undefined)
			root.customArguments[a] = new Expression(value)
		self.icon.argF[a].inputDiv = self.icon.argF[a].append("xhtml:div")
			.attr("class", "titleRowCellLast")
		self.icon.argF[a].input = self.icon.argF[a].inputDiv.append("xhtml:input")
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
			self.icon.argF[a].text.text(a).style(fcArgTextStyle)
			self.icon.argF[a].inputDiv.remove() // input is inside inputDiv
			self.icon.argF[a].input = undefined
			self.icon.argF[a]
			delete root.customArguments[a]
			run()
		} else {
			createInputField(a)
		}
	}
	
	if (drawIcons) {
		self.icon
			.attr("transform", "translate("+(callerF.state.x+1.5)+","+(callerF.state.y-1)+") scale(0.1)")
		self.indicateIfInsideAnySelectedCommandsScope()
		// TODO select and mark
		for (var a in root.f.args) {
			if (self.icon.argF[a] === undefined) {
				self.icon.argF[a] = self.icon.argUl.append("xhtml:li").attr("class", "titleRow")
				self.icon.argF[a].text = self.icon.argF[a].append("xhtml:div")
					.attr("class", "titleRowCellLast")
					.text(a).style(fcArgTextStyle)
					.on("click", function() {
						// beware! "a" changed until click is called.
						// so we need to retrieve the original "a"
						a = this.a
						switchInputFieldForArg()
					})
				self.icon.argF[a].text[0][0].a = a
				
				if (root.customArguments[a] !== undefined)
					createInputField(a)
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
//		self.execCmds.forEach(function(e) { e.deleteProxyCommand() })
//		self.execCmds = []
		forEachSelfRemovingDoCall(self.execCmds, "deleteProxyCommand")
		console.assert(self.execCmds.length === 0)
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
	// clear cache
	self.cachedArguments = {}
}

FuncCall.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	var on = self.isInsideAnySelectedCommandsScope(true/*including proxies*/)
	self.icon.style({"opacity": on ? 0.5 : 1.0})
}

FuncCall.prototype.mark = function(on) {
	var self = this
	// .icon is undefined ? ... when recursing
//	if (self.root.proxies !== undefined)
//		for (var i=0; i<self.root.proxies.length; i++)
//			self.applyCSSClass([self.root.proxies[i].icon.body.text], "mark", on)
}

FuncCall.prototype.select = function() {
	var self = this
	selection.add(self)
	if (self.icon !== undefined)
		self.applyCSSClass([self.icon.body.text], "selected", true)
	self.mark(true)
}

FuncCall.prototype.deselect = function() {
	var self = this
	if (self.icon !== undefined)
		self.applyCSSClass([self.icon.body.text], "selected", false)
	self.mark(false)
}

FuncCall.prototype.getVisibleElementsFromMainSVG = function() {
	return ["icon", "execCmds"]
}

FuncCall.prototype.getVisibleElements = function() {
	return ["execCmds"]
}

// @override
FuncCall.prototype.toCode = function(scopeDepth) {
	var self = this
	console.assert(self === self.root)
	// the f.name is not wrapped. it is assumed to exist as a variable
	var result = "new vogo.FuncCall("+self.f.name+", "
	+argsToCode(self.customArguments)
	+")"
	return result
}

// @override
FuncCall.prototype.deleteCompletelyContainedCommands = function() {
	// do nothing. FuncCall does not itself contain root commands, only execCmds.
}

FuncCall.prototype.getRootCommandsRef = function() {
	console.log("FuncCall getRootCommandsRef: warning: editing function from referencing call. should be avoided.")
	return this.root.f.commands
}


function Branch(cond, ifTrueCmds, ifFalseCmds) {
	var self = this
	self.commonCommandConstructor()
	self.setMainParameter(cond)
	self.lastCondEvalResult
	self.ifTrueCmds = ifTrueCmds === undefined ? [] : ifTrueCmds
	self.ifTrueCmds.forEach(function (e) { e.scope = self })
	self.ifFalseCmds = ifFalseCmds === undefined ? [] : ifFalseCmds
	self.ifFalseCmds.forEach(function (e) { e.scope = self })
	self.execCmds = []
	self.iconG
}
Branch.prototype = new Command(Branch)

Branch.prototype.clone = function(scope) {
	var self = this
	console.assert(self.root === self)
	console.assert(scope.root === scope)
	var ifTrueCmds = []
	self.ifTrueCmds.forEach(function (e) { ifTrueCmds.push(e.clone()) })
	var ifFalseCmds = []
	self.ifFalseCmds.forEach(function (e) { ifFalseCmds.push(e.clone()) })
	var r = new Branch(self.mainParameter.get(), ifTrueCmds, ifFalseCmds)
	r.scope = scope
	return r
}

Branch.prototype.execInner = function(callerF) {
	var self = this
	var root = self.root
	var condEval = self.evalMainParameter()
	var rebuild = self.lastCondEvalResult === undefined
		|| self.lastCondEvalResult !== condEval
		|| self.execCmds.length === 0
	self.lastCondEvalResult = condEval
	var branchCmds = condEval ? root.ifTrueCmds : root.ifFalseCmds
	rebuild |= branchCmds.length !== self.execCmds.length
	var drawIcons = callerF === F_ && (
		self.scopeDepth <= 1
		|| selection.containsAsRoot(self)
		|| root.proxies[0] === self)
	
	if (self.iconG === undefined && drawIcons) {
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
	
	if (self.iconG !== undefined && !drawIcons) {
		self.iconG.remove()
		self.iconG = undefined
	}
	
	if (drawIcons) {
		self.iconG.attr("transform", "translate("+(callerF.state.x+1.5)+","+(callerF.state.y-1)+")")
		var takenBranchColor = branchCmds.length === 0 ? /*dead end branch*/ "#b00" : "#0b0"
		self.iconG.trueL.style({stroke: condEval ? takenBranchColor : "#000"})
		self.iconG.falseL.style({stroke: condEval ? "#000" : takenBranchColor})
		self.iconG.fo.attr("transform", "translate("+2.4+","+0+") scale(0.1)")
		self.iconG.labelInput.property("value", root.mainParameter.get())
		self.indicateIfInsideAnySelectedCommandsScope()
		setTextOfInput(self.iconG.labelInput, self.iconG.fo)
	}
	
	if (rebuild) {
		forEachSelfRemovingDoCall(self.execCmds, "deleteProxyCommand")
		console.assert(self.execCmds.length === 0)
		branchCmds.forEach(function(e) { self.execCmds.push(e.shallowClone(self)) })
	}
	
	self.execCmds.forEach(function(e) { e.exec(callerF) })
}

Branch.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	var on = self.isInsideAnySelectedCommandsScope(true/*including proxies*/)
	self.iconG.style({"opacity": on ? 0.5 : 1.0})
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
//	self.execCmds.forEach(function(e) { e.mark(true) })
}

Branch.prototype.deselect = function() {
	var self = this
	self.applyCSSClass([self.iconG], "selected", false)
	self.mark(false)
//	self.execCmds.forEach(function(e) { e.mark(false) })
}

Branch.prototype.getVisibleElementsFromMainSVG = function() {
	return ["iconG", "execCmds"]
}

Branch.prototype.getVisibleElements = function() {
	return ["execCmds"]
}

// @override
Branch.prototype.toCode = function(scopeDepth) {
	var self = this
	console.assert(self === self.root)
	var result = "new vogo.Branch("+self.root.mainParameter.getWrapped()+", "
		+commandsToCodeString(self.ifTrueCmds, scopeDepth+1)+", "
		+commandsToCodeString(self.ifFalseCmds, scopeDepth+1)+")"
	return result
}

// @override
Branch.prototype.fromRemoveRootCommand = function(cmd) {
	var self = this
	console.assert(cmd.root === cmd)
	console.assert(self === cmd.scope)
	console.assert(self === self.root)
	var idx1 = self.ifTrueCmds.indexOf(cmd)
	if (idx1 !== -1)
		self.ifTrueCmds.splice(idx1, 1)
	var idx2 = self.ifFalseCmds.indexOf(cmd)
	if (idx2 !== -1)
		self.ifFalseCmds.splice(idx2, 1)
	console.assert(idx1 !== -1 || idx2 !== -1)
}

// @override
Branch.prototype.deleteCompletelyContainedCommands = function() {
	var root = this.root
	forEachSelfRemovingDoCall(root.ifTrueCmds, "deleteCompletely")
	forEachSelfRemovingDoCall(root.ifFalseCmds, "deleteCompletely")
}

Branch.prototype.getRootCommandsRef = function() {
	var self = this
	console.assert(self.root !== self) // because only proxies have a lastCondEvalResult
	return self.lastCondEvalResult ? self.root.ifTrueCmds : self.root.ifFalseCmds
}


// export
vogo.Drawing = Drawing
vogo.Func = Func
vogo.Move = Move
vogo.Rotate = Rotate
vogo.Loop = Loop
vogo.FuncCall = FuncCall
vogo.Branch = Branch

function manualTest() {
	
	if (false) {
		addNewFuncToUI("nEck")
		F_.addArgument(4, "n")
		F_.setCommands([
			new Loop("n", [
				new Rotate("Math.PI*2/n"),
				new Move("100/n")])])
	}
	
	if (false) {
		addNewFuncToUI("multiSquare")
		F_.setCommands([
			new Loop(36, [
				new Loop(4, [
					new Rotate("Math.PI/2"),
					new Move(20)]),
				new Rotate("Math.PI/2/10")])])
	}
	
	// this is a performance bummer!
	if (false) {
		addNewFuncToUI("tree")
		F_.addArgument(150, "size")
		F_.setCommands([
			new Branch("size<5", [
				new Move("size"),
				new Move("-size")],
				[
				new Move("size/3"),
				new Rotate(-30/180*Math.PI),
				new FuncCall(F_, {size: "size*2/3"}),
				new Rotate(30/180*Math.PI),
				new Move("size/6"),
				new Rotate(25/180*Math.PI),
				new FuncCall(F_, {size: "size/2"}),
				new Rotate(-25/180*Math.PI),
				new Move("size/3"),
				new Rotate(25/180*Math.PI),
				new FuncCall(F_, {size: "size/2"}),
				new Rotate(-25/180*Math.PI),
				new Move("size/6"),
				new Move("-size")
			])
		])
	}
	
	if (false) {
		addNewFuncToUI("fern")
		F_.addArgument(10, "size")
		F_.addArgument(1, "sign")
		F_.setCommands([
			new Branch("size>=1", [
				new Move("size"),
				new Rotate("70*sign/180*Math.PI"),
				new FuncCall(F_, {size: "size*0.5", sign: "-sign"}),
				new Rotate("-70*sign/180*Math.PI"),
				new Move("size"),
				new Rotate("-70*sign/180*Math.PI"),
				new FuncCall(F_, {size: "size*0.5", sign: "sign"}),
				new Rotate("77*sign/180*Math.PI"),
				new FuncCall(F_, {size: "size-1", sign: "sign"}),
				new Rotate("-7*sign/180*Math.PI"),
				new Move("-2*size")
			], [])
		])
	}
	
	if (false) {
		addNewFuncToUI("circle")
		F_.setCommands([
			new Loop(360, [
				new Rotate("1/180*Math.PI"),
				new Move(1),
			])
		])
	}
	
	if (false) {
		addNewFuncToUI("spirale")
		F_.addArgument(10, "a")
		F_.setCommands([
			new Move("a"),
			new Rotate("25/180*Math.PI"),
			new Branch("a<40", [
				new FuncCall(F_, {a: "a*1.02"})
			], [])
		])
	}
	
	if (false) {
		addNewFuncToUI("meinBaum")
		F_.addArgument(6, "tiefe")
		F_.addArgument(30, "winkel")
		F_.setCommands([
			new Branch("tiefe>=0", [
				new Move("tiefe*5"),
				new Rotate("winkel"),
				new FuncCall(F_, {tiefe: "tiefe-1"}),
				new Rotate("-winkel*2"),
				new FuncCall(F_, {tiefe: "tiefe-1"}),
				new Rotate("winkel"),
				new Move("-tiefe*5")
			], [])
		])
	}
	
	if (false) {
		addNewFuncToUI("KreisC")
		F_.addArgument(4, "winkel")
		F_.setCommands([
			
		])
	}
	
/*
reset

to KreisC :winkel :nachRechts :groesze
 repeat :winkel [
  forward :groesze
  ifelse :nachRechts <= 0
   [left 1]
   [right 1]
 ]
end

to Welle :n
 if :n > 0 [
  KreisC 180 :n%2 0.5
  Welle :n-1
 ]
end

Welle 5


to zahnrad :anzahlecken :seitenlaenge
repeat :anzahlecken [
  repeat 2 [
    fw :seitenlaenge
    rt 90]
  fw :seitenlaenge
  lt 90 - (180 / :anzahlecken) 
  fw :seitenlaenge / 2
  lt 90 - (180 / :anzahlecken) 
]
end

zahnrad 20 10


to stern :b
 repeat 500
 [
  forward :b 
  right 200
  make "b 1 + :b
 ]
end 

stern 1


to saege :zacken :zackenlaenge
repeat :zacken [
repeat 2 [
fw :zackenlaenge
rt 90
]
lt 90+(180/:zacken)
fw :zackenlaenge/2
lt 90+(180/:zacken)
]
end

saege 25 15

 */
	
	
	
	run()
}

function automaticTest() {
	console.assert(F_.commands.length === 0)
	
	manipulation.createPreview(Move, function() { return 10 })
	console.assert(F_.execCmds.length === 1)
	console.assert(F_.commands.length === 1)
	console.assert(F_.canContainCommands())
	var mv = F_.commands[0]
	// P = Proxy
	var mvP = F_.execCmds[0]
	console.assert(mv instanceof Move)
	console.assert(mvP instanceof Move)
	console.assert(mv.myConstructor === Move)
	console.assert(mvP.myConstructor === Move)
	console.assert(mv.constructor === Command)
	console.assert(mvP.constructor === Command)
	console.assert(mv === mvP.root)
	console.assert(mv === mv.root)
	console.assert(mv !== mvP)
	console.assert(mv.scope === F_)
	console.assert(mvP.scope === F_)
	console.assert(mv.scopeDepth === 0)
	console.assert(mvP.scopeDepth === 1)
	console.assert(mv.proxies.length === 1)
	console.assert(mv.proxies[0] === mvP)
	console.assert(mvP.proxies === undefined)
	console.assert(mvP.evalMainParameter() === 10)
	console.assert(mv.mainParameter.get() === 10)
	console.assert(mv.mainParameter.getWrapped() === 10) // Numbers are not wrapped
	console.assert(mv.mainParameter.isConst())
	console.assert(mv.mainParameter.isStatic())
	console.assert(mv.toCode() === "new vogo.Move(10)")
	console.assert(mvP.savedState.x === 0)
	console.assert(mvP.savedState.y === 0)
	console.assert(mvP.savedState.r === 0)
	console.assert(F_.state.x === 0)
	console.assert(F_.state.y === -10)
	console.assert(F_.state.r === 0)
	
	manipulation.finish(Move, function() { return 10 })
	mvP.select()
	manipulation.createPreview(Rotate, function() { return 1 })
	manipulation.finish(Rotate, function() { return 1 })
	var rtP = F_.execCmds[0]
	mvP = F_.execCmds[1]
	mvP.select()
	rtP.select() // previous is deselected without pressed shift
	console.assert(selection.e.length === 1)
	console.assert(selection.e[0] === rtP)
	keyPressed.shift = true
	mvP.select()
	console.assert(selection.e.length === 2)
	console.assert(selection.e[1] === mvP)
	keyPressed.shift = false
	onKeyDown.l() // loop
	console.assert(selection.e.length === 0)
	console.assert(F_.execCmds.length === 1)
	var lpP = F_.execCmds[0]
	lpP.root.mainParameter.set(3)
	run()
	console.assert(lpP.scope === F_)
	console.assert(lpP.commands.length === 0) // is unused
	console.assert(lpP.root.commands === lpP.getRootCommandsRef())
	console.assert(lpP.root.commands.length === 2)
	console.assert(lpP.root.execCmds.length === 0) // is unused
	console.assert(lpP.execCmds.length === 6)
	rtP = lpP.execCmds[0]
	mvP = lpP.execCmds[1]
	console.assert(rtP.scope === lpP)
	// proxies only reference scopes that are proxies, with the only exception
	// being functions, because functions are always in global scope
	console.assert(rtP.root.scope === lpP.root)
	console.assert(mvP.scope === lpP)
	console.assert(mvP.root.scope === lpP.root)
	console.assert(mvP.root.proxies.length === 3)
	console.assert(mvP.root.proxies[0] === mvP)
	
	lpP.select()
	onKeyDown.a() // abstract over; parameterise loop
	console.assert(Object.keys(F_.args).length === 1)
	// ...
	
	lpP.select()
	selection.removeDeselectAndDeleteAllCompletely()
	run()
	
}


return vogo
}()
