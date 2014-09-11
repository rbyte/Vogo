/*
	Vogo is free software.
	License: GNU Affero General Public License 3
	Copyright (C) 2014 Matthias Graf
	matthias.graf <a> mgrf.de
*/

var vogo = function() {// spans everything - not indented
"use strict";
var vogo = {}

// CONSTANTS
var version = 0.1
//var urlToSelf = "http://mgrf.de/vogo/js/vogo.js"
var urlToSelf = "http://localhost/dev/vogo/js/vogo.js"

var turtleHomeStyle = {fill: "none", stroke: "#d07f00", "stroke-width": .2}
var turtleStyle = {fill: "#ffba4c", "fill-opacity": 0.6, stroke: "none"}
// this is used inside every svg <style>. eases the DOM and is compatible with svg export.
var lineDefaultStyle = "stroke: #000; stroke-opacity: 0.8; stroke-width: .25; stroke-linecap: round;"
var lineStyle = {stroke: "#000", "stroke-opacity": 0.8, "stroke-width": .25}
var lineStyleInScope = {stroke: "#500", "stroke-opacity": 0.4}
var arcStyle = {fill: "#000", "fill-opacity": 0.1}
var arcStyleInScope = {fill: "#500", "fill-opacity": 0.05}
var clockStyle = {fill: "#fff", "fill-opacity": 0.01 /*for clickability*/, stroke: "#777", "stroke-width": .05}
var clockHandStyle = {fill: "#000", "fill-opacity": 0.2}
var fcArgTextStyle = {cursor: "pointer", "font-size": "10px", color: "#666"}
var fcTextStyle = {cursor: "pointer"}
var selectionRectStyle = {"stroke-width": 0.05, stroke: "#000", "stroke-opacity": 1, "fill-opacity": 0}
var defaultSvgDrawingStyle = {position: "fixed", width: "80%", height: "80%",
	top: "10%", left: "10%", border: "1px solid rgba(0,0,0,0.1)"}

var zoomFactor = 1.15 // macs tend to have finer grain mouse wheel ticks
var zoomTransitionDuration = 150
var loopClockRadius = 1.3
var maximumNumberOfIterationsForLoopClocksToBeDrawn = 50 // performance improvement
var rotationArcRadiusMax = 3
var rotationArcRadiusMin = 1
var scopeDepthLimit = 30 // for endless loops and recursion
var runDurationLimitMS = 5000
// this determines the default zoom level
var defaultSvgViewboxHeight = 70
var defaultViewBox = (-defaultSvgViewboxHeight/2)
	+" "+(-defaultSvgViewboxHeight/2)
	+" "+defaultSvgViewboxHeight
	+" "+defaultSvgViewboxHeight
var domSvg
var radiusInDegrees = true
var showKeyStrokesInToolbar = true
var turtleHomeCursorPath = "M1,1 L0,-2 L-1,1 Z"

// String.fromCharCode() ought to be a better way
var keyMap = { 65: "a", 68: "d", 83: "s", 69: "e", 70: "f", 71: "g", 82: "r",
	107: "+", 109: "-", 80: "p", 46: "del", 27: "esc", 76: "l", 17: "ctrl", 16: "shift",
	78: "n", 66: "b", 18: "alt", 67: "c", 86: "v", 88: "x", 90: "z", 112: "f1", 113: "f2",
	114: "f2", 115: "f4" }
var mouseMap = { 0: "left", 1: "middle", 2: "right" }

// VARIABLES
var keyPressed = {}
for (var k in keyMap)
	keyPressed[keyMap[k]] = false
var mousePressed = {}
for (var m in mouseMap)
	mousePressed[mouseMap[m]] = false

var mainSVG
var functions = []
// the function that is currently selected
var F_

var functionPanelSizePercentOfBodyWidth = 0.15 /* also change in css */
var toolbarPanelSizePercentOfBodyWidth = 0.05 /* also change in css */
var lastNotificationUpdateTime
var dragInProgress = false
var lastRotateExecuted
var lastRotateScaleFactorCalculated
var mousePos = [0,0]
var lastCopiedElements
var lastRunStartTime
var enforceRunDurationLimitMS = true


vogo.init = function() {
	domSvg = document.getElementById("turtleSVG")
	mainSVG = new MainSVG()
	addKeysToToolbar()
	window.onresize = function(event) { updateScreenElemsSize() }
	window.onresize()
	new Func().addToUI()
	setupUIEventListeners()
	automaticTest()
//	addExampleToUI(examples[26]())

	benchmark(15)
//	examples.forEach(function(t) {
//		addExampleToUI(t())
//		run()
//	})
}

function run(f) {
//	console.log("RUNNING")
	if (f === undefined || !(f instanceof Func))
		f = F_
	lastRunStartTime = Date.now()
	f.exec()
	mainSVG.updateTurtle()
	
	determineDeepFuncDependenciesFor(f, true/*reverse search*/)
		.forEach(function(g) {
			if (g !== f)
				g.exec()
		})
}

function MainSVG() {
	var self = this
	self.svgWidth
	self.svgHeight
	self.svg = d3.select("#turtleSVG").call(setupSVG)
	self.svgInit()
}

function updateScreenElemsSize() {
	var bb = document.getElementById("turtleSVGcontainer").getBoundingClientRect()
	if (bb.width <= 0 || bb.height <= 0)
		return
	mainSVG.svgWidth = bb.width
	mainSVG.svgHeight = bb.height
	
	functions.forEach(function(f) { f.updateViewbox() })
	mainSVG.updateViewbox()
}

function addKeysToToolbar() {
	var xhr = new XMLHttpRequest()
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4 && xhr.status === 200) {
			var svgText = xhr.responseText
			// sadly, doing all this wrapping is necessary because chrome is too stupid to scale
			// embedded svgs correctly according to its viewBox aspect ratio
			// http://stackoverflow.com/questions/22015867/scale-embedded-svg-without-white-space-in-chrome
			// the vertical white space would fill the page. in order to prevent this, the svg is boxed
			// with a fixed aspect ratio set (1:1), as in the svg viewBox
			d3.selectAll("#ul_toolbar li")
				.append("div").classed("container-box", true)
				.append("div").classed("aspect-box", true)
				.append("div").classed("content-box", true)
				.call(function() { // is called once
					this[0].forEach(function(node) {
						var li = node.parentNode.parentNode.parentNode
						var key = li.getAttribute("key")
						li.onclick = onKeyDown[key]
						var svgTextNew = svgText.replace(">A</tspan>", ">"+key+"</tspan>")
						var doc = new DOMParser().parseFromString(svgTextNew, "application/xml")
						node.appendChild(node.ownerDocument.importNode(doc.documentElement, true))
					})
				})
		}
	}
	xhr.open("GET", "images/keyStripped.svg")
	xhr.send()
}

function setupUIEventListeners() {
	d3.select("#f_addNew").on("click", function() {
		new Func().addToUI()
	})
	
	d3.selectAll("#borderL, #borderR").call(d3.behavior.drag()
		.on("dragstart", function (d) {
			d3.selectAll("#functions, #turtleSVGcontainer, #toolbar").style({cursor: "col-resize"})
		})
		.on("drag", function (d) {
			var id = d3.select(this).attr("id")
			if (id === "borderL")
				functionPanelSizePercentOfBodyWidth = Math.max(0.05, Math.min(0.4,
					d3.event.x / document.body.clientWidth))
			if (id === "borderR")
				toolbarPanelSizePercentOfBodyWidth = Math.max(0.0001, Math.min(0.18,
					(1 - d3.event.x / document.body.clientWidth)))
			d3.select("#borderL").style("left", functionPanelSizePercentOfBodyWidth*100+"%")
			d3.select("#functions").style("width", functionPanelSizePercentOfBodyWidth*100+"%")
			d3.select("#borderR").style("right", toolbarPanelSizePercentOfBodyWidth*100+"%")
			d3.select("#toolbar").style("width", toolbarPanelSizePercentOfBodyWidth*100+"%")
			d3.select("#turtleSVGcontainer").style({
				"right": toolbarPanelSizePercentOfBodyWidth*100+"%", 
				"width": (1-functionPanelSizePercentOfBodyWidth-toolbarPanelSizePercentOfBodyWidth)*100+"%"})
			window.onresize()
		})
		.on("dragend", function (d) {
			d3.selectAll("#functions, #turtleSVGcontainer, #toolbar").style({cursor: null /*remove style prop*/})
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
	
	var dragStart
	var selectionRect
	
	mainSVG.svg
		.on("mousemove", function (d, i) {
			mousePos = d3.mouse(this)
			manipulation.update()
		})
		.on("click", function (d, i) {
			// prevent click triggered after dragend
			if (d3.event.defaultPrevented)
				return
			mousePos = d3.mouse(this)
			if (manipulation.isCreating(Move)) {
				if (keyPressed.d) {
					manipulation.create(Move)
				} else {
					manipulation.finish()
				}
			} else if (manipulation.isCreating(Rotate)) {
				if (keyPressed.r) {
					manipulation.create(Rotate)
				} else {
					manipulation.finish()
				}
			} else {
				if (!selection.isEmpty()) {
					selection.removeAndDeselectAll()
					run()
				}
			}
		})
		.call(d3.behavior.drag()
			.on("dragstart", function (d) {
				dragStart = mousePos
				// mousePressed.middle press it not yet registered here
			})
			.on("drag", function (d) {
				if (mousePressed.middle) {
					if (!dragInProgress)
						mainSVG.svg.style({cursor: "move"})
					dragInProgress = true
					F_.svgViewboxX -= d3.event.dx*(F_.svgViewboxWidth/mainSVG.svgWidth)
					F_.svgViewboxY -= d3.event.dy*(F_.svgViewboxHeight/mainSVG.svgHeight)
					F_.updateViewbox()
					mainSVG.updateViewbox()
				} else {
					if (!dragInProgress) {
						manipulation.finish()
						selectionRect = mainSVG.paintingG.append("rect")
							.attr({
								x: dragStart[0],
								y: dragStart[1],
								width: 0,
								height: 0})
							.style(selectionRectStyle)
					}
					dragInProgress = true
					var w = mousePos[0]-dragStart[0]
					var h = mousePos[1]-dragStart[1]
					selectionRect // rect is not displayed if w || h < 0
						.attr({
							width: Math.abs(w),
							height: Math.abs(h),
							x: w < 0 ? dragStart[0]+w : dragStart[0],
							y: h < 0 ? dragStart[1]+h : dragStart[1]})
				}
			})
			.on("dragend", function (d) {
				// mousePressed.middle is already released here
				if (dragInProgress) {
					dragInProgress = false
					mainSVG.svg.style({cursor: null})
					if (selectionRect !== undefined) {
						var x = parseFloat(selectionRect.attr("x"))
						var y = parseFloat(selectionRect.attr("y"))
						var w = parseFloat(selectionRect.attr("width"))
						var h = parseFloat(selectionRect.attr("height"))
						var list = resolveSelectionRect(F_, [], x, y, w, h)
						if (!keyPressed.shift)
							selection.removeAndDeselectAll()
						/* Inkscapes Shift-Selection works differently: if the
						 * rect-selection contains elements already selected,
						 * those are not deselected, but vogo does so. I think
						 * this behaviour is more consistent, but may be
						 * unexpected.
						 * 
						 * Also, adding multiple with the same root will let
						 * the last added proxy be the lucky one.
						 **/
						list.forEach(function(le) {
							selection.addAccumulate(le)
						})
						selectionRect.remove()
						selectionRect = undefined
						run()
					}
				}
				// prevent click triggered after dragend
				d3.event.sourceEvent.stopPropagation()
			})
		)
	
	function updateKeyDownAndUp(keyCode, down) {
		if (document.activeElement.nodeName !== "INPUT") {
			var key = keyMap[keyCode]
			if (key) {
				var currentDown = keyPressed[key]
				keyPressed[key] = down
				if (down && !currentDown && onKeyDown[key]) {
					onKeyDown[key]()
					if (showKeyStrokesInToolbar)
						d3.select("#ul_toolbar [key='"+key+"']")
							.style("background-color", "rgba(60,200,255,0.25")
							.transition().duration(1000)
							.style("background-color", "rgba(60,200,255,0.01")
				}
				if (!down && currentDown && onKeyUp[key])
					onKeyUp[key]()
			} else {
				console.log(keyCode+" not in keymap.")
			}
		}
	}
	
	d3.select("body")
		.on("keydown", function() { updateKeyDownAndUp(d3.event.keyCode, true) })
		.on("keyup", function() { updateKeyDownAndUp(d3.event.keyCode, false) })
}


function convertToRadian(angle) {
	return radiusInDegrees && isRegularNumber(angle) ? angle/180*Math.PI : angle
}

function convertToDegrees(angle) {
	return radiusInDegrees && isRegularNumber(angle) ? angle/Math.PI *180: angle
}

function fromMousePosToRotateAngle(mx, my, state) {
	return angleToString(rotateAngleTo(mx, my, state))
}

function angleToString(angle) {
	return parseFloat(convertToDegrees(angle).toFixed(radiusInDegrees ? 1 : 3 /*decimal places*/))
}

function fromMousePosToLineLengthWithoutChangingDirection(mx, my, state) {
	return parseFloat(getLineLengthToWithoutChangingDirection(mx, my, state).toFixed(2))
}

function rotateAngleTo(x, y, state) {
	if (state === undefined)
		state = F_.state
	return getAngleDeltaTo(x - state.x, y - state.y, state.r)
}

function getAngleDeltaTo(dx, dy, r) {
	return correctRadius(Math.atan2(dy, dx) + Math.PI/2 - r)
}

function getLineLengthTo(x, y, state) {
	if (state === undefined)
		state = F_.state
	var dx = x - state.x
	var dy = y - state.y
	return Math.sqrt(dx*dx + dy*dy)
}

function getLineLengthToWithoutChangingDirection(x, y, state) {
	var ra = rotateAngleTo(x, y, state)
	return (ra > Math.PI/2 || ra < Math.PI/2 ? 1 : -1) * Math.cos(ra) * getLineLengthTo(x, y, state)
}

function isRegularNumber(n) {
	// http://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
	// typeof n == "number" not needed
	return !isNaN(parseFloat(n)) && isFinite(n)
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
	d3.select("#notification").classed({opacity0: true})
}

function updateNotification(text, displayTime) {
	lastNotificationUpdateTime = new Date().getTime()
	if (displayTime > 0) // && !== undefined
		setTimeout(function() {
			var tDeltaMS = new Date().getTime() - lastNotificationUpdateTime
			if (tDeltaMS >= displayTime)
				hideNotification()
		}, displayTime)
	
	d3.select("#notification").classed({opacity0: false})
	d3.select("#notification").text(text)
}

function openSVG() {
//	var svg = domSvg
	var svg = F_.svg.node()
	// hide cursors in output
	F_.turtleHomeCursor.style({display: "none"})
	F_.turtleCursor.style({display: "none"})
	window.open("data:image/svg+xml," + encodeURIComponent(
	// http://stackoverflow.com/questions/1700870/how-do-i-do-outerhtml-in-firefox
		svg.outerHTML || new XMLSerializer().serializeToString(svg)
	))
	F_.turtleHomeCursor.style({display: null})
	F_.turtleCursor.style({display: null})
}

function updateLabelVisibility(self) {
	if (self.label !== undefined)
		self.label.classed("hide", !selection.contains(self)
			&& manipulation.insertedCommand !== self.root)
}

function setTextOfInput(input, text) {
	if (text === undefined)
		text = input.property("value")
	else
		input.property("value", text)
	input.attr("size", Math.max(1, text.toString().length))
}

function resetUI() {
	// remoFe splices from functions, so I have to have a local copy of it
	var fs = []
	functions.forEach(function(f) { fs.push(f) })
	// also, remoFe adds a fresh new Func once functions is empty
	fs.forEach(function(f) { f.remoFe() })
}

// "export" current project
function generateJScodeForExternalInvocation() {
	var fDep = determineFuncDependencies()
	var fProcessed = {}
	var result = ""
	function numberOfProcessedFunctions() { return Object.keys(fProcessed).length }
	
	outer: while (numberOfProcessedFunctions() < functions.length) {
		var fPlOld = numberOfProcessedFunctions()
		for (var i=0; i<functions.length; i++) {
			var doesOnlyDependOnAlreadyExportedFunctions = true
			for (var k=0; k<fDep[i].length; k++) {
				if (fDep[i][k] !== i /*allow recursion*/ && fProcessed[fDep[i][k]] === undefined)
					doesOnlyDependOnAlreadyExportedFunctions = false
			}
			if (doesOnlyDependOnAlreadyExportedFunctions) {
				result += functions[i].toCode()+"\n\n"
				fProcessed[i] = true
				if (numberOfProcessedFunctions() === functions.length)
					break outer
			}
		}
		if (fPlOld === numberOfProcessedFunctions()) {
			// TODO
			console.log("exportAll: error: circular dependencies between functions!")
			break
		}
	}
	result += "new vogo.Drawing("+F_.name+");\n"
	return result
}

// TODO functions proxies should be its dependencies. function shallowClone = funcCall !?
function determineFuncDependencies(reverse) {
	// those are direct. if a -> b -> c, a -> c is not inside the list
	var dependencies = [] // x depends on dependencies[x]
	var reverseDependencies = [] // reverseDependencies[x] depend on x
	for (var f in functions) {
		dependencies.push([])
		reverseDependencies.push([])
	}
	function searchForFuncCall(commands) {
		for (var k=0; k<commands.length; k++) {
			if (commands[k] instanceof FuncCall) {
				var f = functions.indexOf(commands[k].root.f)
				if (dependencies[i].indexOf(f) === -1)
					dependencies[i].push(f)
				if (reverseDependencies[f].indexOf(i) === -1)
					reverseDependencies[f].push(i)
			}
			if (commands[k] instanceof Loop) {
				searchForFuncCall(commands[k].getRootCommandsRef())
			}
			if (commands[k] instanceof Branch) {
				searchForFuncCall(commands[k].ifTrueCmds)
				searchForFuncCall(commands[k].ifFalseCmds)
			}
		}
	}
	for (var i=0; i<functions.length; i++)
		searchForFuncCall(functions[i].getRootCommandsRef())
	if (false) {
		printFuncDependencies(dependencies, " depends on:")
		printFuncDependencies(reverseDependencies, " is a dependency of:")
	}
	return reverse !== undefined ? reverseDependencies : dependencies
}

function printFuncDependencies(dd, str) {
	for (var d in dd) {
		console.log(functions[d].name+str)
		var fd = dd[d]
		for (var f in fd)
			console.log("\t"+functions[fd[f]].name)
	}
}

// also considers indirect (transitiv) dependencies:
// reachability search from f in dependency graph
function determineDeepFuncDependenciesFor(f, reverse) {
	var ds = determineFuncDependencies(reverse)
	var fIdxList = []
	function gather(i) { // depth first search
		ds[i].forEach(function(e) {
			if (fIdxList.indexOf(e) === -1) {
				fIdxList.push(e)
				gather(e)
			}
		})
	}
	gather(functions.indexOf(f))
	var fList = []
	fIdxList.forEach(function(e) {
		fList.push(functions[e])
	})
	return fList
}

function commandsToCodeString(commands, scopeDepth) {
	var result = "["
	for (var i=0; i<commands.length; i++) {
		console.assert(commands[i] instanceof Command)
		result += "\n"
		for (var t=0; t<scopeDepth+1; t++)
			result += "\t"
		result += commands[i].toCode(scopeDepth)
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

function resolveSelectionRect(e, selectionList, x, y, w, h) {
	var allIn = true // all contained commands where selected flag
	if (e.canContainCommands()) {
		var tempList = []
		e.execCmds.forEach(function(c) {
			var list = resolveSelectionRect(c, [], x, y, w, h)
			list.forEach(function(le) { tempList.push(le) })
			allIn &= list.length === 1 && list[0] === c
		})
		if (!allIn || e === F_)
			tempList.forEach(function(le) { selectionList.push(le) })
	} else {
		if (e.getPointsRequiredForSelection !== undefined) {
			e.getPointsRequiredForSelection().forEach(function(p) {
				allIn = allIn && x <= p[0] && p[0] <= x+w
				allIn = allIn && y <= p[1] && p[1] <= y+h
			})
		}
	}
	if (allIn && e !== F_)
		selectionList.push(e)
	// makes sure that no commands inside a funcCall can be selected
	if (e instanceof FuncCall && !allIn)
		selectionList = []
//	console.log(selectionList)
	return selectionList
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

function forAllExecCmdsOfTypeDo(cmds, func, type) {
	cmds.forEach(function(c) {
		if (c.canContainCommands()) {
			forAllExecCmdsOfTypeDo(c.execCmds, func, type)
		} else if (type === undefined || c instanceof type) {
			func(c)
		}
	})
}

function addExampleToUI(fs) {
	// each example may contain one or more functions
	if (fs instanceof Array)
		fs.forEach(function(f) { f.addToUI() })
	else
		fs.addToUI()
}

function benchmark(numberOfRuns) {
	var benchmarkResults = []
	examples.forEach(function(t) {
		addExampleToUI(t())
		benchmarkResults.push(runBenchmarkBasedOnRepetitions(numberOfRuns))
		resetUI()
	})
	console.log("Benchmark Result:\n"+Math.round(d3.sum(benchmarkResults)/numberOfRuns)
		+"\n\tDetails: "+benchmarkResults.join("; ")+"\n")
	loopDragPerformanceBenchmark()
}

function loopDragPerformanceBenchmark() {
	var fs = examples[7]()
	addExampleToUI(fs)
	var mnEck = fs[1]
	var result = runBenchmarkBasedOnRepetitions(50, function(ticks) {
		mnEck.setArgument(ticks < 25 ? ticks : ticks - ticks%25, "ne")
	})
	console.log("Loop Drag Performance:\n"+result+"\n")
	resetUI()
}

function runBenchmarkBasedOnRepetitions(numberOfRepetitions, beforeEachRun) {
	var startTime = Date.now()
	var ticks = 0
	var enforceRunDurationLimitMSpre = enforceRunDurationLimitMS
	enforceRunDurationLimitMS = false
	while (ticks++ <= numberOfRepetitions) {
		if (beforeEachRun !== undefined)
			beforeEachRun(ticks)
		run()
	}
	enforceRunDurationLimitMS = enforceRunDurationLimitMSpre
	return Date.now() - startTime
}

function createForeignObject(parent) {
	// note that width and height are relative to the svg viewbox, not the document body!
	// and that body and viewbox have, when you zoom in far, a very different ratio
	// that means that the foreignObject will eventually crop its content
	// but since the foreignObject has disabled click events and its own body scales relative
	// to its content, the size can just be huge
	return parent.append("foreignObject")
		.attr("x", 0).attr("y", 0).attr("width", "9000%").attr("height", "9000%")
		.on("click", function(d, i) { // chrome wants this
			d3.event.stopPropagation()
		})
}

function setupSVG(svg) {
	svg.attr("xmlns", "http://www.w3.org/2000/svg")
	// the line is the most used element, so I default it here in order not to crowd the DOM
	svg.append("style").text("svg line { "+lineDefaultStyle+" }")
	return svg
}

function setLinePosition(line, x1, y1, x2, y2) {
	var ll = line.node()
	ll.setAttribute("x1", x1.toFixed(3))
	ll.setAttribute("y1", y1.toFixed(3))
	ll.setAttribute("x2", x2.toFixed(3))
	ll.setAttribute("y2", y2.toFixed(3))
}

// singletons
var onKeyUp = {}
var onKeyDown = {
	"+": function() {
		new Func().addToUI()
	},
	"-": function() {
		F_.remoFe()
	},
	d: function() { // draw/move
		if (!manipulation.isCreating()) {
			manipulation.createPreview(Move)
		} else if (manipulation.isCreating(Rotate)) {
			manipulation.finish()
			manipulation.createPreview(Move)
		}
	},
	r: function() { // rotate
		if (!manipulation.isCreating()) {
			manipulation.createPreview(Rotate)
		} else if (manipulation.isCreating(Move)) {
			manipulation.finish()
			manipulation.createPreview(Rotate)
		}
	},
	e: function() { // export for usage in code/web
		var jsCodeForExternalInvocation = generateJScodeForExternalInvocation()
		console.log(jsCodeForExternalInvocation)
		var html = [
			"<!DOCTYPE html>"
			,"<html>"
			,"<head>"
			,"	<meta charset='utf-8'>"
			,"	<title>Vogo Export</title>"
			,"	<script src='http://d3js.org/d3.v3.min.js'></script>"
			,"	<script src='"+urlToSelf+"'></script>"
			,"</head>"
			,"<body>"
			,"<script>"
			,jsCodeForExternalInvocation
			,"</script>"
			,"</body>"
			,"</html>"]
		// text/plain
		window.open("data:text/html;charset=utf-8," + encodeURIComponent(html.join("\n")))
	},
	s: function() {
		openSVG()
	},
	del: function() {
		selection.removeDeselectAndDeleteAllCompletely()
		run()
	},
	esc: function() {
		manipulation.remove()
	},
	a: function() { // abstract
		if (selection.isEmpty()) {
			F_.addArgument("1")
		} else {
			// TODO if exp isStatic
			var argName = F_.addArgument(selection.e[0].evalMainParameter())
			selection.e.forEach(function(el) {
				el.setMainParameter(argName)
			})
		}
		run()
	},
	l: function() {
		wrapSelectionInCommand("loop", function(cmdList) {
			return new Loop(2, cmdList) })
	},
	b: function() {
		wrapSelectionInCommand("branch", function(cmdList) {
			return new Branch("true", cmdList, []) })
	},
	c: function() { // copy
		if (keyPressed.ctrl && !selection.isEmpty()) {
			// the overwritten have no scope links, 
			// so no need to explicitly delete them (for garbage collection)
			lastCopiedElements = []
			selection.e.forEach(function(e) {
				lastCopiedElements.push(e.root.clone())
			})
		}
	},
	x: function() { // cut
		if (keyPressed.ctrl && !selection.isEmpty()) {
			onKeyDown.c()
			selection.removeDeselectAndDeleteAllCompletely()
			run()
		}
	},
	v: function() { // paste
		if (keyPressed.ctrl && lastCopiedElements !== undefined) {
			// the order of selection is honored while inserting
			// this makes cutting "x" be well suited for reording commands
			lastCopiedElements.forEach(function(e) {
				insertCmdRespectingSelection(e.clone())
			})
			run()
		}
	},
	f: function() { // fill/close path
		if (true) return
		// TODO
		var path = ["M0,0"]
		var withoutFirst = []
		for (var i=1; i<F_.execCmds.length; i++)
			withoutFirst.push(F_.execCmds[i])
		forAllExecCmdsOfTypeDo(withoutFirst, function(m) {
			path.push("L"+m.savedState.x+","+m.savedState.y)
		}, Move)
		path.push("L"+F_.state.x+","+F_.state.y)
		path.push("Z")
		path = path.join(" ")
		console.log(path)
		F_.paintingG.append("path").attr("d", path)
	},
	z: function() { // undo
		if (keyPressed.ctrl) {
			updateNotification("Undo is not supported yet. Sorry about that.", 5000)
		}
	},
	f2: function() {
		function addOne(i) {
			if (i < examples.length) {
				addExampleToUI(examples[i]())
				run()
				// force redraw; to make progression visible
				setTimeout(function() {
					addOne(i+1)
				}, 10)
			}
		}
		addOne(0)

//		examples.forEach(function(t) {
//			addExampleToUI(t())
//			run()
//		})
	},
	f3: function() {

	}
}


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
			x.updateMarkAndSelect()
		} else {
			this.addAccumulate(x)
		}
	},
	addAccumulate: function(x) {
		console.assert(x.root !== x) // only proxies can be selected
		if (this.contains(x)) {
			this.removeAndDeselect(x)
		} else {
			// do not allow selection of multiple with same root
			if (this.containsAsRoot(x))
				this.removeAndDeselect(this.e[this.indexOfSelectedProxyOf(x)])
			this.e.push(x)
			x.updateMarkAndSelect()
		}
	},
	contains: function(x) {
		return this.e.indexOf(x) !== -1
	},
    indexOfSelectedProxyOf: function(x) {
		for (var i=0; i<this.e.length; i++)
			if (this.e[i].root === x.root)
				return i
		return -1
	},
	containsAsRoot: function(x) {
		return this.indexOfSelectedProxyOf(x) !== -1
	},
	removeAndDeselect: function(x) {
		if (this.contains(x))
			this.e.splice(this.e.indexOf(x), 1)
		x.updateMarkAndSelect()
	},
	removeAndDeselectAll: function() {
		var detach = this.e
		this.e = []
		detach.forEach(function(x) { x.updateMarkAndSelect() })
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

var manipulation = {
	insertedCommand: false,
	savedState: undefined,
	isCreating: function(cmdType) {
		return cmdType === undefined
			? this.insertedCommand !== false
			: this.insertedCommand instanceof cmdType
	},
	create: function(cmdType, newMainParameter) {
		if (this.isCreating(cmdType)) {
			this.finish(cmdType, newMainParameter)
			this.createPreview(cmdType, newMainParameter)
		} else {
			this.createPreview(cmdType, newMainParameter)
			this.finish(cmdType, newMainParameter)
		}
	},
	createPreview: function(cmdType, newMainParameter) {
		console.assert(!this.isCreating(cmdType))
		this.insertedCommand = new cmdType()
		this.savedState = insertCmdRespectingSelection(this.insertedCommand)
		this.update(newMainParameter)
	},
	update: function(newMainParameter) {
		if (this.isCreating()) {
			if (newMainParameter === undefined) {
				if (this.insertedCommand instanceof Move)
					newMainParameter = fromMousePosToLineLengthWithoutChangingDirection(mousePos[0], mousePos[1], this.savedState)
				else if (this.insertedCommand instanceof Rotate)
					newMainParameter = fromMousePosToRotateAngle(mousePos[0], mousePos[1], this.savedState)
				else
					console.assert(false, "manipulation.update: error: only Move and Rotate are supported")
			}
			this.insertedCommand.setMainParameter(newMainParameter)
			run()
		}
	},
	finish: function(newMainParameter) {
		if (this.isCreating()) {
			this.update(newMainParameter)
			var ic = this.insertedCommand
			this.insertedCommand = false
			if (ic.proxies !== undefined && ic.proxies.length === 1)
				updateLabelVisibility(ic.proxies[0])
		}
	},
	remove: function() {
		if (this.isCreating()) {
			this.insertedCommand.deleteCompletely()
			this.insertedCommand = false
			run()
		}
	}
}


function State() {
	this.reset()
}

State.prototype.addRadius = function(angle) {
	this.r += angle
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
	
	if (typeof exp === "string") {
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
	return (typeof this.exp === "string" ? "\""+this.exp+"\"" : this.exp)
}

Expression.prototype.isConst = function() {
	return typeof this.exp === "number"
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

Expression.prototype.adjustDragstart = function(dragPrecision) {
	var self = this
	if (self.isConst()) {
		self.dragStartMouseX = d3.mouse(domSvg)[0]
		self.originalValue = self.eval()
		self.dragPrecision = dragPrecision !== undefined ? dragPrecision : getPrecision(self.originalValue)
	}
}

Expression.prototype.getNewValueFromDrag = function() {
	var self = this
	if (self.isConst()) {
		var mouseDiff = d3.mouse(domSvg)[0] - self.dragStartMouseX
		// the number of digits after the comma influences how much the number changes on drag
		// 20.01 will only change slightly, whereas 100 will change rapidly
		// the factors change the FEEL of the drag and are really important: I found those to work well.
		mouseDiff *= Math.pow(10, self.dragPrecision*0.6)*0.6
		// small Bug: the order of magnitude changes unexpectedly in the next drag,
		// when the value is left of ending with .xy0, because the 0 is forgotten
		mouseDiff = parseFloat(mouseDiff.toFixed(Math.max(0, -self.dragPrecision)))
		// yes, we need to do the rounding twice: mouseDiff, to reduce reruns
		// and newValue to get the precision right (+ can reintroduce rounding errors)
		var newValue = parseFloat((self.originalValue+mouseDiff).toFixed(Math.max(0, -self.dragPrecision)))
		if (self.eval(/*const!*/) !== newValue)
			return newValue
	}
	return undefined
}


// this is only called once for every kind of command
function Command(myConstructor) {
	var self = this
	// myConstructor is what .constructor should be but isnt.
	self.myConstructor = myConstructor
}

// this is called for every instance of command
// another important aspect is that this increases hidden class performance
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
	// for reducing the amount of DOM styling required
	self.isInsideAnySelectedCommandsScopeCache = false
	self.isMarkedCache = false
	self.isSelectedCache = false
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
		return // is already deleted. happens when a loop AND one of its elements is selected and deleted.
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

Command.prototype.updateMarkAndSelect = function(force) {
	var self = this
	var selectOn = selection.contains(self)
	// selectOn always implies markOn & selection.contains always implies containsAsRoot
	var markOn = selectOn ? true : selection.containsAsRoot(self)
	// default is Off, so I only need to force if it is On
	var selectChanged = selectOn !== self.isSelectedCache || (force !== undefined && selectOn)
	var markChanged = markOn !== self.root.isMarkedCache || (force !== undefined && markOn)
	self.isSelectedCache = selectOn
	self.root.isMarkedCache = markOn
	
	if (markChanged) {
		console.assert(self.root.proxies !== undefined)
		self.root.proxies.forEach(function(p) {
			// from the proxies, only one can be selected
			var cssClass = p.isSelectedCache ? "selected mark" : (markOn ? "mark" : "")
			p.updateCssClass(cssClass, selectOn)
		})
	} else if (selectChanged) {
		var cssClass = selectOn ? "selected mark" : (markOn ? "mark" : "")
		self.updateCssClass(cssClass, selectOn)
	}
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
//					console.assert(self[p][i] !== undefined)
					if (self[p][i] === undefined) {
						// TODO unfixed bug: repeated removal. happens when removing fc for f that contains a loop
						//console.log(":( "+(fromMainSVG ? "fromMainSVG" : "")+self.myConstructor.name+" "+p+" ")
					} else {
						if (self[p][i].remove === undefined) { // 3
							fromMainSVG
								? self[p][i].removeVisibleFromMainSVG()
								: self[p][i].removeVisible()
						} else { // 2
							self[p][i].remove()
							self[p][i] = undefined
						}
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
	var self = this
	self.removeVisibleElements(self.getVisibleElements())
	self.removeVisibleFromMainSVG()
}

Command.prototype.removeVisibleFromMainSVG = function() {
	var self = this
	selection.removeAndDeselect(self)
	self.removeVisibleElements(self.getVisibleElementsFromMainSVG(), true)
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
	if (enforceRunDurationLimitMS && Date.now() - lastRunStartTime > runDurationLimitMS) {
		updateNotification("Execution takes too long (>"+runDurationLimitMS+"ms). Stopping.", 8000)
		return
	}
	self.execInner(callerF)
}

Command.prototype.isInsideAnySelectedCommandsScope = function(includingProxies, thenDoFunc) {
	var self = this
	var scp = self.scope
	// traverse scope up to see if self is somewhere inside the selection
	var checKr = includingProxies === undefined ? "contains" : "containsAsRoot"
	if (!selection.isEmpty())
		while (!(scp instanceof Func) && !selection[checKr](scp))
			scp = scp.scope
	var on = selection[checKr](scp)
	// d3.style is VERY time consuming, so lets check whether it is necessary
	if (on !== self.isInsideAnySelectedCommandsScopeCache) {
		self.isInsideAnySelectedCommandsScopeCache = on
		thenDoFunc(on)
	}
}

// traverses the scope chain up, looking for the first FuncCall, and if none, returns Func
// where inner = high scope depth
Command.prototype.getInnermostFuncCallOrFunc = function() {
	var self = this
	var sc = self.scope
	while (!(sc instanceof Func) && !(sc instanceof FuncCall)) {
		sc = sc.scope
		console.assert(sc !== undefined)
	}
	return sc
}

// where outer = low scope depth
Command.prototype.getOutermostFuncCallOrFunc = function() {
	var self = this
	var lastFC = undefined
	var sc = self
	// this may take long if self is inside a recursive call
	while (!(sc instanceof Func)) {
		if (sc instanceof FuncCall)
			lastFC = sc
		sc = sc.scope
		console.assert(sc !== undefined)
	}
	return lastFC === undefined ? sc : lastFC
}

Command.prototype.isInsideFuncCall = function() {
	return this.getInnermostFuncCallOrFunc() instanceof FuncCall
}

Command.prototype.isInsideFuncCallButNotSelfRecursing = function() {
	var f = this.getInnermostFuncCallOrFunc()
	return f instanceof FuncCall && f.root.f !== F_
}

Command.prototype.isNotInsideFuncCallOrSelfRecursing = function() {
	return !this.isInsideFuncCallButNotSelfRecursing()
}

Command.prototype.changeSelectedInSync = function(newValue) {
	var self = this
	selection.e.forEach(function(e) {
		if (e instanceof self.myConstructor
			&& e.root !== self.root
			&& e.root.mainParameter.isConst())
				e.setMainParameter(newValue)
	})
}

Command.prototype.updateMainParameter = function(newValue) {
	var self = this
	if (newValue !== undefined) {
		var c = self.myConstructor
		console.assert(c === Move || c === Rotate || c === Loop)
		self.setMainParameter(newValue)
		self.changeSelectedInSync(newValue)
		run()
	}
}

Command.prototype.createDragBehavior = function(element) {
	var self = this
	var firstDragTick = true
	var dragStartState
	var isNotInsideFuncCallOrSelfRecursing
	return d3.behavior.drag()
		.on("dragstart", function(d) {
			firstDragTick = true
			isNotInsideFuncCallOrSelfRecursing = self.isNotInsideFuncCallOrSelfRecursing()
			// to prevent drag on background
			d3.event.sourceEvent.stopPropagation()
		})
		.on("drag", function (d) {
			if (firstDragTick) {
				// this can not be done in dragstart because a click triggers it
				if (self.root.mainParameter.isConst() && isNotInsideFuncCallOrSelfRecursing) {
					dragInProgress = true
					mainSVG.svg.style({cursor: "move"})
					dragStartState = self.savedState.clone()
					d3.select(this).classed("dragging", true)
				} else {
					if (!isNotInsideFuncCallOrSelfRecursing) {
						updateNotification("Functions can only be edited in their own defintion.", 5000)
					} else {
						updateNotification("Drag only works on constants.", 5000)
					}
				}
				firstDragTick = false
			}
			if (self.root.mainParameter.isConst() && isNotInsideFuncCallOrSelfRecursing) {
				self.updateMainParameter(self.getNewMainParameterFromDrag(dragStartState, element))
			}
		})
		.on("dragend", function(d) {
			if (self.root.mainParameter.isConst() && isNotInsideFuncCallOrSelfRecursing) {
				dragInProgress = false
				mainSVG.svg.style({cursor: "default"})
				d3.select(this).classed("dragging", false)
			}
		})
}

// aobj is an object that contains the argument (all optional):
// name
// args = {a1,a2,...}
// commands = [cmd1,cmd2,...]
// customSvgPaintingG = an svg or svg <g> element
// viewBox = {x,y,w,h}
function Func(aobj) {
	var self = this
	if (aobj === undefined)
		aobj = {}
	if (typeof aobj === "string")
		aobj = {name: aobj}
	self.commonCommandConstructor()
	self.state = new State()
	
	self.setName(aobj.name)
	self.args = {}
	if (aobj.args !== undefined) {
		self.args = aobj.args
		for (var a in aobj.args) // wrap in expressions
			if (!(self.args[a] instanceof Expression) && self.args[a] !== undefined)
				self.args[a] = new Expression(self.args[a])
	}
	self.commands = []
	self.execCmds = []
	if (aobj.commands !== undefined)
		self.setCommands(aobj.commands)
	if (aobj.customSvgPaintingG !== undefined)
		self.paintingG = aobj.customSvgPaintingG
	
	if (aobj.viewBox !== undefined) {
		self.svgViewboxX = aobj.viewBox.x
		self.svgViewboxY = aobj.viewBox.y
		self.svgViewboxWidth = aobj.viewBox.w
		self.svgViewboxHeight = aobj.viewBox.h
	}
	return self
}
// actually, Func requires only few things from Command and only some methods work on Func
Func.prototype = new Command(Func)

Func.prototype.addToUI = function() {
	var self = this
	self.initUI()
	functions.push(self)
	self.switchTo()
	// scroll down functions panel
	var objDiv = document.getElementById("functions")
	objDiv.scrollTop = objDiv.scrollHeight
	return self
}

Func.prototype.initUI = function() {
	var self = this
//	self.svgViewboxX
//	self.svgViewboxY
//	self.svgViewboxWidth
	if (self.svgViewboxHeight === undefined)
		self.svgViewboxHeight = defaultSvgViewboxHeight // fix on startup
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
			self.remoFe()
		})
	self.ul_args = self.li_f.append("ul").attr("class", "ul_args")
	self.argLi = {}
	for (var arg in self.args)
		self.addExistingArgumentToUI(arg)
	
	self.svgContainer = self.li_f.append("div").attr("class", "fSVGcontainer")
	var isDragged = false
	self.svg = self.svgContainer.append("svg").attr("class", "fSVG")
		.call(setupSVG)
		.on("click", function() {
			// dragstart and click are fired at the same time, so I have to check for myself
			if (!isDragged) {
				self.switchTo()
			}
		})
		.call(d3.behavior.drag()
			.on("drag", function (d) {
				if (!isDragged)
					mainSVG.svg.style({cursor: "move"})
				isDragged = true
			})
			.on("dragend", function (d) {
				if (isDragged) {
					isDragged = false
					mainSVG.svg.style({cursor: "default"})
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
	console.assert(
		ref !== undefined
		&& !isNaN(ref.svgViewboxX)
		&& !isNaN(ref.svgViewboxY)
		&& ref.svgViewboxWidth > 0
		&& ref.svgViewboxHeight > 0)
	console.assert(
		isFinite(ref.svgViewboxX)
		&& isFinite(ref.svgViewboxY)
		&& isFinite(ref.svgViewboxWidth)
		&& isFinite(ref.svgViewboxHeight))
	;(afterZoom === undefined
		? obj
		: obj.transition().duration(zoomTransitionDuration))
		.attr("viewBox", ref.svgViewboxX+" "+ref.svgViewboxY+" "+ref.svgViewboxWidth+" "+ref.svgViewboxHeight)
}

MainSVG.prototype.updateViewbox = function(afterZoom) {
	if (F_ !== undefined)
		updateViewboxFor(this.svg, F_, afterZoom)
}

Func.prototype.updateViewbox = function(afterZoom) {
	var self = this
	// the preview svg aspect ratio is coupled to the main svg
	var svgWidth = self.svgContainer.node().getBoundingClientRect().width
	if (svgWidth <= 0)
		return
	
	self.svgWidth = svgWidth
	self.svgHeight = self.svgWidth * mainSVG.svgHeight/mainSVG.svgWidth
	self.svgContainer.style({height: self.svgHeight+"px"})
	
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

Func.prototype.setArgument = function(value, argName, newArgName) {
	var self = this
	console.assert(self.args[argName] !== undefined)
	if (newArgName !== undefined && argName !== newArgName) { // rename
		// TODO rename all occurences
		self.args[newArgName] = self.args[argName]
		if (self.argLi !== undefined) {
			console.assert(self.argLi[argName] !== undefined)
			self.argLi[newArgName] = self.argLi[argName]
			delete self.argLi[argName]
		}
		delete self.args[argName] // dereference
		argName = newArgName
	}
	// this is necessary only if setArgument is called "manually" and the function was added to the UI
	if (self.argLi !== undefined) {
		console.assert(self.argLi[argName] !== undefined)
		self.argLi[argName].select("input").property("value", argName+"="+value)
	}
		
	self.args[argName].set(value)
}

Func.prototype.removeArgument = function(argName) {
	var self = this
	console.assert(self.args[argName] !== undefined)
	// TODO check dependencies
	if (self.argLi !== undefined) {
		console.assert(self.argLi[argName] !== undefined)
		self.argLi[argName].remove()
		delete self.argLi[argName]
	}
	delete self.args[argName]
}

Func.prototype.addArgument = function(defaultValue, argName) {
	var self = this
	if (argName === undefined)
		argName = self.searchForName(97/*=a*/, 26/*=z*/, function (s) { return self.checkArgumentName(s) }, "", 1)
	
	console.assert(self.checkArgumentName(argName))
	self.args[argName] = new Expression(defaultValue)
	
	if (self.argLi !== undefined)
		self.addExistingArgumentToUI(argName)
	
	return argName
}

Func.prototype.addExistingArgumentToUI = function(argName) {
	var self = this
	console.assert(self.argLi !== undefined)
	console.assert(self.argLi[argName] === undefined)
	
	function onChange(value) {
		if (value === "") {
			self.removeArgument(argName)
			return
		}
		console.assert(typeof value === "string")
		var regEx = /^([a-zA-Z][a-zA-Z0-9]*) *= *(.+)$/
		var match = regEx.exec(value)
		if (match !== null) { // match success
			var newArgName = match[1]
			var newValue = match[2]
			self.setArgument(newValue, argName, newArgName)
			// because argName is the crucial closured variable
			if (argName !== newArgName)
				argName = newArgName
			run(self)
		} else {
			// TODO restore field
		}
	}
	
	self.argLi[argName] = this.ul_args.append("li")
	self.argLi[argName].append("input")
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
				self.args[argName].adjustDragstart()
			})
			.on("drag", function (d) {
				var newValue = self.args[argName].getNewValueFromDrag()
				if (newValue !== undefined) {
					self.args[argName].set(newValue)
					this.value = argName+"="+newValue
					run(self) // because self may be !== F_
				}
			})
		)
		.property("value", argName+"="+self.args[argName].get())
//		.node().focus()
}

Func.prototype.setCommands = function(commands) {
	var self = this
	console.assert(commands instanceof Array)
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
	self.state.reset()
	lastRotateExecuted = undefined
	lastRotateScaleFactorCalculated = undefined
	
	if (self.commands.length !== self.execCmds.length) {
//		self.execCmds.forEach(function (e) { e.deleteProxyCommand() })
//		self.execCmds = []
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

// not to be confused with d3.remove
// TODO dependency check
Func.prototype.remoFe = function() {
	var self = this
	console.assert(functions.length > 0)
	functions.splice(functions.indexOf(self), 1)
	// there has to be one function in the UI at all times
	if (functions.length === 0)
		new Func().addToUI()
	if (F_ === self) { // switch to previous or last
		(self.previousF_ !== undefined && functions.indexOf(self.previousF_) !== -1
			? self.previousF_
			: functions[functions.length-1]).switchTo()
	}
	
	self.deleteCompletelyContainedCommands()
	
	// contains everything
	self.li_f.remove()
	delete self.svg
	delete self.nameInput
	delete self.ul_args
	delete self.argsLi
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
	var result = "var "+self.name+" = new vogo.Func({"
		+"\n\t"+"name: \""+self.name+"\""+
		(Object.keys(self.args).length > 0
			? ",\n\t"+"args: "+argsToCode(self.args)
			: "")
		+",\n\t"+"viewBox: {"
			+"x:"+self.svgViewboxX.toFixed(3)
			+", y:"+self.svgViewboxY.toFixed(3)
			+", w:"+self.svgViewboxWidth.toFixed(3)
			+", h:"+self.svgViewboxHeight.toFixed(3)
			+"}"
		+"});\n"
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

Move.prototype.getNewMainParameterFromDrag = function(dragStartState, element) {
	return fromMousePosToLineLengthWithoutChangingDirection(mousePos[0], mousePos[1], dragStartState)
}

Move.prototype.execInner = function(callerF) {
	var self = this
	var root = self.root
	var lineLength = self.evalMainParameter()
	
	// TODO this is a pretty ugly quick fix solution
	if (lastRotateExecuted !== undefined
	&& lastRotateExecuted.arc !== undefined
	&& lastRotateExecuted.scope.root === self.scope.root) {
		lastRotateScaleFactorCalculated = Math.min(rotationArcRadiusMax, Math.max(rotationArcRadiusMin,
			Math.abs(lineLength)*0.3))/rotationArcRadiusMax
		// TODO do this more efficiently
		// be aware of the fact that lastRotateExecuted may not be the last command executed or even be in the same function
		var match = /^(translate\([^\)]*\))/.exec(lastRotateExecuted.arc.attr("transform"))
		console.assert(match !== null)
		lastRotateExecuted.radiusScaleFactorCalculated = lastRotateScaleFactorCalculated
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
		self.line = callerF.paintingG.append("line")
//			.style(lineStyle) // === css defaults. better performance
	}
	var drawOnMainSVG = callerF === F_
	var drawIcons = drawOnMainSVG
		&& (self.scopeDepth <= 1
			|| selection.containsAsRoot(self))
		&& self.isNotInsideFuncCallOrSelfRecursing()
	if (self.lineMainSVG === undefined && drawOnMainSVG) {
		self.lineMainSVG = mainSVG.paintingG.append("line")
//			.style(lineStyle)
		self.lineMainSVG
			.on("click", function(d, i) {
				if (!manipulation.isCreating()) {
					if (self.isInsideFuncCallButNotSelfRecursing()) {
						// this is the FuncCall that is visible (a direct child) in F_
						selection.add(self.getOutermostFuncCallOrFunc())
					} else {
						selection.add(self)
					}
					run()
					// to prevent click on background
					d3.event.stopPropagation()
				}
			})
			.call(self.createDragBehavior(self.lineMainSVG))
		self.updateMarkAndSelect(true)
	}
	
	if (self.label === undefined && drawIcons) {
		self.label = createForeignObject(mainSVG.paintingG)
		self.labelInput = self.label
			.append("xhtml:body")
			.append("xhtml:input")
			.attr("type", "text")
			.on("click", function() {
				this.select() // selects all text
			})
			.on("blur", function() {
				self.updateMainParameter(this.value)
			})
			.on("keypress", function() {
				if (d3.event.keyCode === /*enter*/ 13)
					self.updateMainParameter(this.value)
			})
			.on("input", function() {
				// size updating
				setTextOfInput(self.labelInput)
			})
			.call(d3.behavior.drag()
				.on("dragstart", function (d) {
					root.mainParameter.adjustDragstart()
					d3.event.sourceEvent.stopPropagation()
				})
				.on("drag", function (d) {
					self.updateMainParameter(root.mainParameter.getNewValueFromDrag())
				})
			)
	}
	
	if (self.label !== undefined && !drawIcons) {
		self.label.remove()
		self.label = undefined
	}
	if (drawIcons) {
		updateLabelVisibility(self)
		var dir = correctRadius(callerF.state.r)
		var x = callerF.state.x + Math.sin(dir) * lineLength * -0.5
		var y = callerF.state.y - Math.cos(dir) * lineLength * -0.5
		self.label.attr("transform", "translate("+x+","+y+") scale(0.1)")
		setTextOfInput(self.labelInput, root.mainParameter.get())
	}

	if (drawOnMainSVG) {
		self.indicateIfInsideAnySelectedCommandsScope()
		setLinePosition(self.lineMainSVG, x1, y1, x2, y2)
	}
	setLinePosition(self.line, x1, y1, x2, y2)
}

Move.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	self.isInsideAnySelectedCommandsScope(true/*including proxies*/, function(on) {
		self.lineMainSVG.style(on ? lineStyleInScope : lineStyle)
	})
}

Move.prototype.updateCssClass = function(cssClass, selectOn) {
	var self = this
	if (self.lineMainSVG !== undefined)
		self.lineMainSVG.node().setAttribute("class", cssClass)
	if (selectOn) {
		if (self.label !== undefined) {
			self.label.classed("hide", false)
			setTextOfInput(self.labelInput)
		}
	} else {
		updateLabelVisibility(self)
	}
}

Move.prototype.getVisibleElementsFromMainSVG = function() {
	return ["lineMainSVG", "label"]
}

Move.prototype.getVisibleElements = function() {
	return ["line"]
}

Move.prototype.getPointsRequiredForSelection = function() {
	var self = this
	return [[parseFloat(self.line.attr("x1")), parseFloat(self.line.attr("y1"))]
		,[parseFloat(self.line.attr("x2")), parseFloat(self.line.attr("y2"))]]
}


function Rotate(angle) {
	var self = this
	self.commonCommandConstructor()
	self.setMainParameter(angle)
	self.arc
	self.label
	self.title
	self.radiusScaleFactorCalculated
}
Rotate.prototype = new Command(Rotate)

Rotate.prototype.clone = function(scope) {
	console.assert(this === this.root)
	var r = new Rotate(this.mainParameter.get())
	r.scope = scope
	return r
}

Rotate.prototype.getNewMainParameterFromDrag = function(dragStartState, element) {
	var dx = d3.event.x - dragStartState.x
	var dy = d3.event.y - dragStartState.y
	var angleDelta = getAngleDeltaTo(dx, dy, dragStartState.r)
	return angleToString(angleDelta)
}

Rotate.prototype.addDegreeSymbol = function(v) { return v+"°"}
Rotate.prototype.removeDegreeSymbol = function(v) { return v.replace("°", "")}

Rotate.prototype.execInner = function(callerF) {
	var self = this
	var root = self.root
	var angle = correctRadius(convertToRadian(self.evalMainParameter()))
	
	var arc = d3.svg.arc()
		.innerRadius(0)
		.outerRadius(rotationArcRadiusMax)
		.startAngle(callerF.state.r)
		.endAngle(callerF.state.r + angle)
	callerF.state.addRadius(angle)
	var drawIcons = callerF === F_ && self.isNotInsideFuncCallOrSelfRecursing()
	var drawLabel = drawIcons
		&&  (self.scopeDepth <= 1
			|| selection.containsAsRoot(self))
	
	if (self.arc === undefined && drawIcons) {
		self.arc = mainSVG.paintingG.append("path").style(arcStyle)
			.on("mouseenter", function(d, i) {
				if (!dragInProgress && !manipulation.isCreating(Rotate))
					self.arc.style({fill: "#f00"})
			})
			.on("mouseleave", function(d, i) {
				self.arc.style(arcStyle)
			})
			.on("click", function(d, i) {
				if (!manipulation.isCreating()) {
					selection.add(self)
					run()
					// to prevent click on background
					d3.event.stopPropagation()
				}
			})
			.call(self.createDragBehavior(self.arc))
		self.title = self.arc.append("title")
		self.updateMarkAndSelect(true)
	}
	
	if (self.label === undefined && drawLabel) {
		self.label = createForeignObject(mainSVG.paintingG)
		self.labelInput = self.label
		// the "xhtml:" is important! http://stackoverflow.com/questions/15148481/html-element-inside-svg-not-displayed
			.append("xhtml:body")
			.append("xhtml:input")
			.attr("type", "text")
			.on("click", function() {
				self.labelInput.property("value", self.removeDegreeSymbol(this.value))
				this.select() // selects all text
			})
			.on("blur", function() {
				self.updateMainParameter(self.removeDegreeSymbol(this.value))
			})
			.on("keypress", function() {
				if (d3.event.keyCode === /*enter*/ 13) {
					self.updateMainParameter(this.value)
				}
			})
			.on("input", function() {
				setTextOfInput(self.labelInput)
			})
			.call(d3.behavior.drag()
				.on("dragstart", function (d) {
					root.mainParameter.adjustDragstart()
					d3.event.sourceEvent.stopPropagation()
				})
				.on("drag", function (d) {
					self.updateMainParameter(root.mainParameter.getNewValueFromDrag())
				})
			)
	}
	
	if (drawLabel) {
		updateLabelVisibility(self)
		var dir = correctRadius(callerF.state.r - angle/2)
		var x = callerF.state.x + Math.sin(dir) * rotationArcRadiusMax * 0.6
		var y = callerF.state.y - Math.cos(dir) * rotationArcRadiusMax * 0.6 - 1 // vertical alignment
		self.label.attr("transform", "translate("+x+","+y+") scale(0.1)")
		var text = root.mainParameter.isConst()
			? self.addDegreeSymbol(root.mainParameter.get())
			: root.mainParameter.get()
		setTextOfInput(self.labelInput, text)
	}
	if (drawIcons) {
		self.arc.attr("d", arc)
			.attr("transform", "translate("+callerF.state.x+","+callerF.state.y+")"
				+(lastRotateScaleFactorCalculated ? " scale("+lastRotateScaleFactorCalculated+")" : ""))
		self.title.text(self.addDegreeSymbol(angleToString(angle)))
		self.indicateIfInsideAnySelectedCommandsScope()
		lastRotateExecuted = self
	}
}

Rotate.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	self.isInsideAnySelectedCommandsScope(true/*including proxies*/, function(on) {
		self.arc.style(on ? arcStyleInScope : arcStyle)
	})
}

Rotate.prototype.updateCssClass = function(cssClass, selectOn) {
	var self = this
	if (self.arc !== undefined)
		self.arc.node().setAttribute("class", cssClass)
	if (selectOn) {
		if (self.label !== undefined) {
			self.label.classed("hide", false)
			setTextOfInput(self.labelInput)
		}
	} else {
		updateLabelVisibility(self)
	}
}

Rotate.prototype.getVisibleElementsFromMainSVG = function() {
	return ["arc", "label"]
}

Rotate.prototype.getVisibleElements = function() {
	return []
}

Rotate.prototype.getPointsRequiredForSelection = function() {
	var self = this
	// TODO eval in creating problems!
	var angle = correctRadius(convertToRadian(self.evalMainParameter()))
//	var angle = 90
	// the actual rotationArcRadiusMax may be smaller due to scaling
	var radius = rotationArcRadiusMax * (self.radiusScaleFactorCalculated !== undefined ? self.radiusScaleFactorCalculated : 1)
	// the 3 corners that the rotate arc spans
	return [[self.savedState.x, self.savedState.y],
		[self.savedState.x + Math.sin(self.savedState.r) * radius,
		self.savedState.y - Math.cos(self.savedState.r) * radius],
		[self.savedState.x + Math.sin(correctRadius(self.savedState.r + angle)) * radius,
		self.savedState.y - Math.cos(correctRadius(self.savedState.r + angle)) * radius]]
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
	self.i
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

Loop.prototype.getNewMainParameterFromDrag = function(dragStartState, element) {
	var self = this
	// cx, cy is center of loop clock
	var dx = d3.event.x - parseFloat(element.attr("cx"))
	var dy = d3.event.y - parseFloat(element.attr("cy"))
	var angle = convertToDegrees(Math.atan2(dy, dx) + Math.PI/2)
	if (angle < 0) // in [-90, 0]
		angle = 360 + angle
	// angle is now in [0, 360]; 0 is North, 90 is East, 180 is South, 270 is West
	// iteration starts from 0
	var iteration = parseFloat(element.attr("i"))
	// x can not get lower then iteration, because that would destroy the dragged "loop clock"
	var x = iteration
	var test
	do {
		x++
		// pie division: for x, each is 360°/x big. get angle between pies, then multiply by current piece.
		// for iteration = 0: 270, 150, 104, 81, 66, ...
		test = ( 360/x + 360/(x+1) )/2*(iteration+1)
	} while (angle < test)
	return x
}

Loop.prototype.execInner = function(callerF) {
	var self = this
	var root = self.root
	// TODO if this is 0 the loop becomes inaccessible
	var numberOfRepetitions = Math.max(1, Math.floor(self.evalMainParameter()))
	// shrink inner loops radius
	var loopClockRadiusUsed = loopClockRadius * Math.pow(0.7, self.refDepthOfSameType+1)
	var drawIcons = callerF === F_ && self.isNotInsideFuncCallOrSelfRecursing()

	function createIcon() {
		var iconG = mainSVG.paintingG.append("g")
		if (i === 0) {
			iconG.fo = createForeignObject(iconG)
			iconG.labelInput = iconG.fo.append("xhtml:body").append("xhtml:input")
				.attr("type", "text")
				.on("blur", function() {
					self.updateMainParameter(this.value)
				})
				.on("keypress", function() {
					if (d3.event.keyCode === /*enter*/ 13)
						self.updateMainParameter(this.value)
				})
				.on("input", function() {
					setTextOfInput(iconG.labelInput)
				})
				.call(d3.behavior.drag()
					.on("dragstart", function (d) {
						root.mainParameter.adjustDragstart(0)
						// drag is not called if this is not done:
						d3.event.sourceEvent.stopPropagation()
					})
					.on("drag", function (d) {
						self.updateMainParameter(root.mainParameter.getNewValueFromDrag())
					})
				)
		}

		iconG.clockHand = iconG.append("path").style(clockHandStyle)
		iconG.circleF = iconG.append("circle").style(clockStyle)
		iconG.on("click", function () {
			if (!manipulation.isCreating()) {
				selection.add(self)
				run()
				// to prevent click on background
				d3.event.stopPropagation()
			}
		})
		if (i < maximumNumberOfIterationsForLoopClocksToBeDrawn)
			iconG.call(self.createDragBehavior(iconG))

		iconG.title = iconG.circleF.append("title")
		return iconG
	}

	var rebuild = self.execCmds.length !== numberOfRepetitions * root.commands.length
	if (rebuild) {
//		forEachSelfRemovingDoCall(self.execCmds, "deleteProxyCommand")
//		console.assert(self.execCmds.length === 0)
		// remove dangling
		// deleteProxyCommand splices j from execCmds! -> execCmds.length changes in loop
		for (var j=self.execCmds.length-1; j>=numberOfRepetitions * root.commands.length; j--)
			self.execCmds[j].deleteProxyCommand()
		for (var i=0; i<numberOfRepetitions; i++) {
			for (var k=0; k<root.commands.length; k++) {
				var pos = i*root.commands.length + k
				if (pos < self.execCmds.length) {
					// update existing
					// this check improves loop performance significantly, if its numberOfRepetitions is dragged
					if (self.execCmds[pos].root !== root.commands[k]) {
						self.execCmds[pos].deleteProxyCommand()
						// deleteProxyCommand spliced pos, so we need to splice back in to retain order (do not push!)
						self.execCmds.splice(pos, 0, root.commands[k].shallowClone(self))
//						self.execCmds[pos] = root.commands[k].shallowClone(self)
					}
				} else {
					// add new
					self.execCmds.push(root.commands[k].shallowClone(self))
				}
			}
		}
	}
	
	if (drawIcons) {
		if (0 <= numberOfRepetitions && numberOfRepetitions < self.iconGs.length) {
			// remove dangling
			for (var k=numberOfRepetitions; k<self.iconGs.length; k++)
				self.iconGs[k].remove()
			self.iconGs.splice(numberOfRepetitions, self.iconGs.length-numberOfRepetitions)
		} else {
			// add new
			for (var i=self.iconGs.length; i<numberOfRepetitions; i++)
				self.iconGs.push(createIcon())
		}
	}
	
	for (var i=0; i<numberOfRepetitions; i++) {
		self.i = i
		if (drawIcons) {
			// TODO consider line-in and -out diretion for angle
			// place center away from current position in 90° angle to current heading
			var dir = correctRadius(callerF.state.r + Math.PI/2)
			var cx = callerF.state.x + Math.sin(dir) * loopClockRadius * 1.4
			var cy = callerF.state.y - Math.cos(dir) * loopClockRadius * 1.4
			
			// happens when the function switched back and forth
			var recreateItem = self.iconGs[i] === undefined
			if (recreateItem)
				self.iconGs[i] = createIcon()
			
			if (rebuild || recreateItem) {
				// above 20, the bigger the loop, the smaller the icons
				var rFactor = 1/Math.pow(Math.max(1, numberOfRepetitions-20), 0.3)
				// also, decrease the relative size
				rFactor *= 1-i/(numberOfRepetitions+40)
				if (i < maximumNumberOfIterationsForLoopClocksToBeDrawn) {
					var arc = d3.svg.arc()
						.innerRadius(0)
						.outerRadius(loopClockRadiusUsed * rFactor)
						.startAngle(0)
						.endAngle(Math.PI*2/numberOfRepetitions*(i+1))
					self.iconGs[i].clockHand.attr("d", arc)
				}
				self.iconGs[i].circleF
					.node().setAttribute("r", loopClockRadiusUsed * rFactor)

				// cannot do this with: .attr("title".. see https://code.google.com/p/chromium/issues/detail?id=170780
				self.iconGs[i].title
					.text((i+1)+"/"+numberOfRepetitions)
				self.iconGs[i].node().setAttribute("i", i)
			}
			
			if (i === 0) {
				self.iconGs[i].fo
					.node().setAttribute("transform", "translate("+(loopClockRadiusUsed*1.1)+","+(-loopClockRadiusUsed*1.3)+") scale(0.1)")
				setTextOfInput(self.iconGs[i].labelInput, root.mainParameter.get())
			}
			
			self.indicateIfInsideAnySelectedCommandsScope()
			var elem = self.iconGs[i].node()
			elem.setAttribute("transform", "translate("+cx+","+cy+")")
			elem.setAttribute("cx", cx)
			elem.setAttribute("cy", cy)
		}
		
		for (var k=0; k<root.commands.length; k++)
			self.execCmds[i*root.commands.length + k].exec(callerF)
	}
	if (rebuild)
		self.updateMarkAndSelect(true) // force reapply because new iconGs may not be painted yet
}

Loop.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	self.isInsideAnySelectedCommandsScope(true/*including proxies*/, function(on) {
		self.iconGs.forEach(function(e) {
			if (e !== undefined)
				e.style({opacity: on ? 0.4 : 1.0})
		})
	})
}

Loop.prototype.updateCssClass = function(cssClass, selectOn) {
	var self = this
	if (self.iconGs !== undefined)
		self.iconGs.forEach(function(i) {
			if (i !== undefined)
				i.circleF.node().setAttribute("class", cssClass)
		})
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
	// TODO allow func to be a string then resolve it to a function
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
		self.icon = createForeignObject(mainSVG.paintingG)
		self.icon.argF = {}
		self.icon.body = self.icon.append("xhtml:body")
		self.icon.body.text = self.icon.body.append("xhtml:text")
			.text("ƒ"+root.f.name)
			.style(fcTextStyle)
			.on("click", function() {
				selection.add(self)
				run()
				d3.event.stopPropagation()
			})
		self.updateMarkAndSelect(true)
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
		self.icon.argF[a].inputDiv = self.icon.argF[a]
			.append("xhtml:div")
			.attr("class", "titleRowCellLast")
		self.icon.argF[a].input = self.icon.argF[a].inputDiv
			.append("xhtml:input")
			.attr("type", "text")
			.property("value", value)
			.attr("size", value.toString().length)
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
				self.icon.argF[a].input.attr("size", Math.max(1,
					self.icon.argF[a].input.property("value").toString().length))
			})
			.call(d3.behavior.drag()
				.on("dragstart", function (d) {
					root.customArguments[a].adjustDragstart()
					d3.event.sourceEvent.stopPropagation()
				})
				.on("drag", function (d) {
					var newValue = root.customArguments[a].getNewValueFromDrag()
					if (newValue !== undefined) {
						root.customArguments[a].set(newValue)
						this.value = newValue
						run()
					}
				})
			)
	}
	
	function switchInputFieldForArg(a) {
		if (self.icon.argF[a].input !== undefined) {
			self.icon.argF[a].text.text(a).style(fcArgTextStyle)
			self.icon.argF[a].inputDiv.remove() // input is inside inputDiv
			self.icon.argF[a].input = undefined
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
					// need to closure in "a" because when click is called, "a" changed
					.on("click", (function(a) {
						return function() { switchInputFieldForArg(a) }
					})(a))
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
	
	if (self.scopeDepth > scopeDepthLimit) {
		updateNotification("Execution depth too high (>"+scopeDepthLimit+"). Endless loop/recursion? Stopping here.", 5000)
	} else {
		if (self.execCmds.length !== root.f.commands.length) {
//			self.execCmds.forEach(function(e) { e.deleteProxyCommand() })
//			self.execCmds = []
			forEachSelfRemovingDoCall(self.execCmds, "deleteProxyCommand")
			console.assert(self.execCmds.length === 0)
			root.f.commands.forEach(function(e) {
				self.execCmds.push(e.shallowClone(self))
			})
		}
		// clear cache. this is necessary because expression evalutation is
		// not only done during runs but yet eval may created cached args
		self.cachedArguments = {}
//		console.log("exec fc with scopeDepth: "+self.scopeDepth)
		self.execCmds.forEach(function(e) { e.exec(callerF) })
	}
	self.cachedArguments = {}
}

FuncCall.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	self.isInsideAnySelectedCommandsScope(true/*including proxies*/, function(on) {
		self.icon.style({opacity: on ? 0.3 : 1.0})
	})
}

FuncCall.prototype.updateCssClass = function(cssClass, selectOn) {
	var self = this
	if (self.icon !== undefined)
		self.icon.body.text.node().setAttribute("class", cssClass)
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
	// do nothing. FuncCall does not itself contain root commands.
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
		self.iconG.trueL = self.iconG.append("line").attr({x1: 1, y1: 1, x2: 2, y2: 0})
		self.iconG.falseL = self.iconG.append("line").attr({x1: 1, y1: 1, x2: 2, y2: 2})
		self.iconG.baseL = self.iconG.append("line").attr({x1: 0, y1: 1, x2: 1, y2: 1})
			.on("click", function() {
				if (!manipulation.isCreating()) {
					selection.add(self)
					run()
					d3.event.stopPropagation()
				}
			})
		
		self.iconG.fo = createForeignObject(self.iconG)
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
				setTextOfInput(self.iconG.labelInput)
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
		setTextOfInput(self.iconG.labelInput)
	}
	
	if (rebuild) {
//		self.execCmds.forEach(function (e) { e.deleteProxyCommand() })
//		self.execCmds = []
		forEachSelfRemovingDoCall(self.execCmds, "deleteProxyCommand")
		console.assert(self.execCmds.length === 0)
		branchCmds.forEach(function(e) { self.execCmds.push(e.shallowClone(self)) })
	}
	
	self.execCmds.forEach(function(e) { e.exec(callerF) })
}

Branch.prototype.indicateIfInsideAnySelectedCommandsScope = function() {
	var self = this
	self.isInsideAnySelectedCommandsScope(true/*including proxies*/, function(on) {
		self.iconG.style({opacity: on ? 0.5 : 1.0})
	})
}

Branch.prototype.updateCssClass = function(cssClass, selectOn) {
	var self = this
	if (self.iconG !== undefined)
		self.iconG.baseL.node().setAttribute("class", cssClass)
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


// wraps a function for drawing it multiple times
// opt is an object containing optional arguments
// TODO "new" is not required for invoking
function Drawing(f, opt) {
	if (opt === undefined)
		opt = {}
	var fHasViewBox = f.svgViewboxX !== undefined
		&& f.svgViewboxY !== undefined
		&& f.svgViewboxWidth !== undefined
		&& f.svgViewboxHeight !== undefined
	if (opt.container === undefined) {
		var svg = d3.select("body").append("svg")
			.call(setupSVG)
			.attr("viewBox", ( fHasViewBox
				? f.svgViewboxX+" "+f.svgViewboxY+" "+f.svgViewboxWidth+" "+f.svgViewboxHeight
				: defaultViewBox))
			.style(defaultSvgDrawingStyle)
		opt.container = svg.append("g")
	}
	if (opt.arguments === undefined) {
		opt.arguments = {}
	}
	
	var wrapperF = new Func({
		name: f.name,
		commands: [new FuncCall(f, opt.arguments)],
		customSvgPaintingG: opt.container})
	wrapperF.exec()
	opt.container.node().vogo = wrapperF
	wrapperF.update = function(newArgs) {
		console.assert(this.getRootCommandsRef().length === 1)
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
	return wrapperF
}

// for d3.call()
vogo.draw = function(f, args) {
	return function(elem) { return new Drawing(f, {arguments: args, container: elem})}
}
// for d3.call()
vogo.update = function(args) {
	return function(elem) { return elem.node().vogo.update(args) }
}

// export
vogo.version = version
vogo.onKeyDown = onKeyDown
vogo.Func = Func
vogo.Move = Move
vogo.Rotate = Rotate
vogo.Loop = Loop
vogo.FuncCall = FuncCall
vogo.Branch = Branch
vogo.Drawing = Drawing

// for use in UI
vogo.pi = Math.PI
vogo.sin = function(x) { return Math.sin(convertToRadian(x)) }
vogo.cos = function(x) { return Math.cos(convertToRadian(x)) }
vogo.tan = function(x) { return Math.tan(convertToRadian(x)) }
vogo.asin = function(x) { return convertToDegrees(Math.asin(x)) }
vogo.acos = function(x) { return convertToDegrees(Math.acos(x)) }
vogo.atan = function(x) { return convertToDegrees(Math.atan(x)) }

function automaticTest() {
	if (false)
		return
	
	function arrayTypesEqual(arr, types) {
		if (arr.length !== types.length)
			return false
		for (var i=0; i<arr.length; i++)
			if(!(arr[i] instanceof types[i]))
				return false
		return true
	}
	
	console.assert(F_.commands.length === 0)
	
	manipulation.createPreview(Move, 10)
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
	
	manipulation.finish(10)
	selection.add(mvP)
	manipulation.createPreview(Rotate, 90)
	manipulation.finish(90)
	var rtP = F_.execCmds[0]
	mvP = F_.execCmds[1]
	selection.add(mvP)
	// previous is deselected without pressed shift
	selection.add(rtP)
	console.assert(!selection.contains(mvP))
	console.assert(selection.contains(rtP))
	console.assert(selection.e.length === 1)
	console.assert(selection.e[0] === rtP)
	keyPressed.shift = true
	selection.add(mvP)
	keyPressed.shift = false
	console.assert(selection.e.length === 2)
	console.assert(selection.e[1] === mvP)
	console.assert(rtP.evalMainParameter() === 90)
	console.assert(rtP.mainParameter === undefined)
	console.assert(rtP.root.mainParameter.isConst())
	console.assert(rtP.root.mainParameter.isStatic())
	
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
	console.assert(arrayTypesEqual(lpP.execCmds, [Rotate, Move, Rotate, Move, Rotate, Move]))
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
	
	var prevF = F_
	var nf = new Func().addToUI()
	console.assert(F_ === nf)
	console.assert(nf.previousF_ === prevF)
	insertCmdRespectingSelection(new FuncCall(prevF))
	run()
	console.assert(arrayTypesEqual(nf.execCmds, [FuncCall]))
	var fcP = nf.execCmds[0]
	console.assert(arrayTypesEqual(fcP.execCmds, [Loop]))
	console.assert(fcP.execCmds[0].execCmds.length === 6)
	selection.add(fcP)
	console.assert(selection.contains(fcP))
	// triggers minor bug in removeVisibleElements
	selection.removeDeselectAndDeleteAllCompletely()
	nf.remoFe()
	console.assert(functions.length === 1)
//	run()
	console.assert(F_ === prevF)
	
	selection.add(lpP)
	onKeyDown.a()
	console.assert(Object.keys(F_.args).length === 1)
	var varName = Object.keys(F_.args)[0]
	console.assert(varName === "a") // default for first
	console.assert(F_.args[varName].eval() === 3)
	// TODO setArgumentValue
	F_.setArgument(4, varName)
	rtP.root.mainParameter.set("360/a")
	mvP.root.mainParameter.set("100/a")
	run()
	console.assert(arrayTypesEqual(lpP.execCmds, [Rotate, Move, Rotate, Move, Rotate, Move, Rotate, Move]))
	selection.add(lpP.execCmds[1])
	selection.addAccumulate(lpP.execCmds[0])
	keyPressed.ctrl = true
	onKeyDown.x() // cut
	console.assert(arrayTypesEqual(lpP.execCmds, []))
	selection.add(lpP)
	onKeyDown.v() // paste
	keyPressed.ctrl = false
	// order changed
	console.assert(arrayTypesEqual(lpP.execCmds, [Move, Rotate, Move, Rotate, Move, Rotate, Move, Rotate]))
	onKeyDown.del()
	console.assert(arrayTypesEqual(F_.execCmds, []))
	F_.removeArgument(varName)
}

var examples = []

examples.push(function() {
	var f = new Func({name: "nEck", args: {n: 4}})
	f.setCommands([
		new Loop("n", [
			new Rotate("360/n"),
			new Move("100/n")])
	])
	return f
})

examples.push(function() {
	var f = new Func({name: "multiSquare", args: {n: 36, ecken: 4}})
	f.setCommands([
		new Loop("n", [
			new Loop("ecken", [
				new Rotate("360/ecken"),
				new Move("100/ecken")]),
			new Rotate("360/n")])
	])
	return f
})

// this is a performance bummer!
examples.push(function() {
	var f = new Func({name: "tree", args: {size: 18}})
	f.setCommands([
		new Branch("size<5", [
			new Move("size"),
			new Move("-size")],
			[
			new Move("size*0.3"),
			new Rotate(-40),
			new FuncCall(f, {size: "size*0.7"}),
			new Rotate(40),
			new Move("size*0.4"),
			new Rotate(35),
			new FuncCall(f, {size: "size*0.7"}),
			new Rotate(-35),
			new Move("size*0.3"),
			new Rotate(35),
			new FuncCall(f, {size: "size*0.7"}),
			new Rotate(-35),
			new Move("-size")
		])
	])
	return f
})

// 3
examples.push(function() {
	var f = new Func({name: "fern", args: {size: 7, sign: 1, shrink: 0.5, length: 0.7}})
	f.setCommands([
		new Branch("size>=1", [
			new Move("size"),
			new Rotate("70*sign"),
			new FuncCall(f, {size: "size*shrink", sign: "-sign"}),
			new Rotate("-70*sign"),
			new Move("size"),
			new Rotate("-70*sign"),
			new FuncCall(f, {size: "size*shrink", sign: "sign"}),
			new Rotate("77*sign"),
			new FuncCall(f, {size: "size*length", sign: "sign"}),
			new Rotate("-7*sign"),
			new Move("-2*size")
		], [])
	])
	return f
})

examples.push(function() {
	var f = new Func({name: "circle", viewBox: {x:-33.397, y:-74.088, w:176.746, h:153.790}})
	f.setCommands([
		new Loop(360, [
			new Rotate(1),
			new Move(1)
		])
	])
	return f
})

examples.push(function() {
	var f = new Func({name: "spirale", args: {step: 2, angle: 25}})
	f.setCommands([
		new Move("step"),
		new Rotate("angle"),
		new Branch("step<40", [
			new FuncCall(f, {step: "step*1.02"})
		], [])
	])
	return f
})

examples.push(function() {
	var f = new Func({
		name: "meinBaum",
		args: {"tiefe": 6, "winkel": 30},
		viewBox: {x:-39.046, y:-56.526, w:80.449, h:70.000}
	})
	f.setCommands([
		new Branch("tiefe>=0", [
			new Move("tiefe*2"),
			new Rotate("winkel"),
			new FuncCall(f, {tiefe: "tiefe-1"}),
			new Rotate("-winkel*2"),
			new FuncCall(f, {tiefe: "tiefe-1"}),
			new Rotate("winkel"),
			new Move("-tiefe*2")
		], [])
	])
	return f
})

// 7
examples.push(function() {
	var nEck = new Func({name: "nEck2", args: {ne: 36, sz: 5}})
	nEck.setCommands([
		new Loop("ne", [
			new Rotate("360/ne"),
			new Move("sz")])
	])
	var mnEck = new Func({name: "mnEck", args: {ne: 25, sz: 7}})
	mnEck.setCommands([
		new Loop("ne", [
			new Rotate("360/ne"),
			new FuncCall(nEck, {ne: "ne", sz: "sz"})])
	])
	return [nEck, mnEck]
})

examples.push(function() {
	var KreisC = new Func({name: "KreisC", args: {winkel: 180, rotate: 1, groesze: 0.1}})
	KreisC.setCommands([
		new Loop("winkel", [
			new Move("groesze"),
			new Rotate("rotate")])
	])
	var Welle = new Func({name: "Welle", args: {n: 4}})
	Welle.setCommands([
		new Branch("n>0", [
			new FuncCall(KreisC, {rotate: "(n%2-0.5)*2"}),
			new FuncCall(Welle, {n: "n-1"})
		], [])
	])
	return [KreisC, Welle]
})

examples.push(function() {
	var f = new Func({
		name: "zahnrad",
		args: {anzahlecken: 20, seitenlaenge: 7},
		viewBox: {x:-55.356, y:-12.091, w:104.584, h:91.000}
	})
	f.setCommands([
		new Loop("anzahlecken", [
			new Loop(2, [
				new Move("seitenlaenge"),
				new Rotate(-90)
			]),
			new Move("seitenlaenge"),
			new Rotate("90 - (180 / anzahlecken)"),
			new Move("seitenlaenge/2"),
			new Rotate("90 - (180 / anzahlecken)")
		])
	])
	return f
})

examples.push(function() {
	var f = new Func({
		name: "saege",
		args: {"zacken": 9, "zackenlaenge": 9},
		viewBox: {x:-30.875, y:-57.548, w:80.449, h:70.000}
	})
	f.setCommands([
		new Loop("zacken", [
			new Loop(2, [
				new Move("zackenlaenge"),
				new Rotate(-90)
			]),
			new Rotate("90 + (180 / zacken)"),
			new Move("zackenlaenge/2"),
			new Rotate("90 + (180 / zacken)")
		])
	])
	return f
})

// 11
examples.push(function() {
	var f = new Func({name: "tunnel", args: {a: 60, c: 2.04, n: 40}})
	f.setCommands([
		new Loop("n", [
			new Move("a"),
			new Move("-a*c"),
			new Move("a"),
			new Rotate("360/n")])
	])
	return f
})

examples.push(function() {
	var f = new Func({name: "swirlPyramid", args: {a: 40}})
	f.setCommands([
		new Loop("a", [
			new Move("60*(i+1)/a"),
			new Rotate("90+90/a")])
	])
	return f
})

examples.push(function() {
	var f = new Func({name: "swirlPyramidRecursive", args: {step: 20, x: 0.94, r: -94.1}})
	f.setCommands([
		new Move("step"),
		new Rotate("r"),
		new FuncCall(f, {step: "step*x"})
	])
	return f
})

examples.push(function() {
	var f = new Func({
		name: "coincidentalSpiral",
		args: {n: 360, angle: 153.951},
		viewBox: {x:-554.877, y:-457.912, w:1149.034, h:965.009}
	})
	f.setCommands([
		new Loop("n", [
			new Move("10*i"),
			new Rotate("angle")])
	])
	return f
})

// 15
examples.push(function() {
	var f = new Func({
		name: "tunnel2",
		viewBox: {x:-36.173, y:-275.308, w:176.746, h:153.790}
	})
	f.setCommands([
		new Loop("360", [
			new Move("400"),
			new Rotate("151")])
	])
	return f
})

examples.push(function() {
	var f = new Func({
		name: "roses",
		args: {stepSize: 2, count: 5, order: 3}
	})
	f.setCommands([
		new Loop("360*count", [
			new Move("stepSize"),
			new Rotate("i + (2 * order - count) / (2 * count)")])
	])
	return f
})

examples.push(function() {
	var f = new Func({
		name: "dahlia",
		args: {kind: 3}
	})
	f.setCommands([
		new Loop(8, [
			new Rotate(45),
			new Loop("kind", [
				new Loop(45, [
					new Move(0.5),
					new Rotate(4)]),
				new Rotate(90)])])
	])
	return f
})

// 18
examples.push(function() {
	var f = new Func({
		name: "simpleFlower",
		args: {"outer": 10, "inner": 28, "angle": 240.12, "step": 5},
		viewBox: {x:-70.534, y:-91.840, w:174.720, h:118.300}});
	f.setCommands([
		new Loop("outer", [
			new Loop("inner", [
				new Move("step"),
				new Rotate("Math.sin(i/360)*angle")])])]);
	return f
})

examples.push(function() {
	var bar = new vogo.Func({
		name: "bar",
		args: {"a": 18},
		viewBox: {x:-16.091, y:-28.853, w:47.603, h:41.420}});
	bar.setCommands([
		new vogo.Move("a"),
		new vogo.Rotate(90),
		new vogo.Move(9.94),
		new vogo.Rotate(90),
		new vogo.Move("a")]);

	var barChart = new vogo.Func({
		name: "barChart",
		args: {"data": "[10,5,15,25]"},
		viewBox: {x:-20.855, y:-46.965, w:80.449, h:70.000}});
	barChart.setCommands([
		new vogo.Loop("data.length", [
			new vogo.FuncCall(bar, {"a": "data[i]"}),
			new vogo.Rotate(180)])]);
	return [bar, barChart]
})

examples.push(function() {
	var f = new vogo.Func({
		name: "snapExample",
		args: {"a": 56},
		viewBox: {x:-30.173, y:-30.310, w:50.572, h:41.420}});
	f.setCommands([
		new vogo.Loop("a", [
			new vogo.Move("21.96*(1-i/a)"),
			new vogo.Rotate(-122.5)])]);
	return f
})

examples.push(function() {
	var circleSeg = new vogo.Func({
		name: "circleSeg",
		args: {"angle": 29, "step": 0.5},
		viewBox: {x:-21.162, y:-33.392, w:52.845, h:46.026}});
	circleSeg.setCommands([
		new vogo.Loop("angle", [
			new vogo.Move("step"),
			new vogo.Rotate(1)])]);

	var pie = new vogo.Func({
		name: "pie",
		args: {"angle": 135, "r": 8},
		viewBox: {x:-13.018, y:-12.988, w:30.214, h:26.316}});
	pie.setCommands([
		new vogo.Move("r"),
		new vogo.Rotate(90),
		new vogo.FuncCall(circleSeg, {"step": "Math.tan(0.5/180*Math.PI)*r*2", "angle": "angle"}),
		new vogo.Rotate(90),
		new vogo.Move("r"),
		new vogo.Rotate(180)]);
	
	var pieChart = new vogo.Func({
		name: "pieChart",
		args: {"data": "[3,4,6,2]", "r": 9},
		viewBox: {x:-16.763, y:-14.205, w:39.958, h:34.802}});
	pieChart.setCommands([
		new vogo.Loop("data.length", [
			new vogo.FuncCall(pie, {"angle": "data[i]/d3.sum(data)*360", "r": "r"})])]);
	return [circleSeg, pie, pieChart]
})

// 22
examples.push(function() {
	var bar = new vogo.Func({
		name: "zig",
		args: {"a": 20, "b": 3},
		viewBox: {x:-23.520, y:-49.398, w:80.449, h:70.000}});
	bar.setCommands([
		new vogo.Move("a"),
		new vogo.Rotate(90),
		new vogo.Move("b"),
		new vogo.Rotate(90),
		new vogo.Move("a"),
		new vogo.Rotate(-90),
		new vogo.Move("b"),
		new vogo.Rotate(-90)]);

	var grid = new vogo.Func({
		name: "grid",
		args: {"cols": 3, "rows": 4, "size": 3},
		viewBox: {x:-22.064, y:-34.486, w:60.831, h:52.930}});
	grid.setCommands([
		new vogo.Loop("cols", [
			new vogo.FuncCall(bar, {"a": "rows*size*2", "b": "size"})]),
		new vogo.Move("rows*size*2"),
		new vogo.Move("-rows*size*2"),
		new vogo.Rotate(-90),
		new vogo.Loop("rows", [
			new vogo.FuncCall(bar, {"a": "cols*size*2", "b": "size"})]),
		new vogo.Move("cols*size*2")]);

	return [bar, grid]
})

examples.push(function() {
	var step = new vogo.Func({
		name: "lcStep",
		args: {"start": 11, "end": 7, "width": 6},
		viewBox: {x:-26.118, y:-21.001, w:45.997, h:40.023}});
	step.setCommands([
		new vogo.Rotate("-Math.atan((end-start)/width)/Math.PI*180"),
		new vogo.Move("Math.sqrt(width*width+(end-start)*(end-start))"),
		new vogo.Rotate("Math.atan((end-start)/width)/Math.PI*180")]);

	var lineChart = new vogo.Func({
		name: "lineChart",
		args: {"data": "[7,12,7,5,8]", "width": 21},
		viewBox: {x:-9.863, y:-19.838, w:39.998, h:34.803}});
	lineChart.setCommands([
		new vogo.Move("data[0]"),
		new vogo.Rotate(90),
		new vogo.Loop("data.length-1", [
			new vogo.FuncCall(step, {"start": "data[i]", "end": "data[i+1]", "width": "width/(data.length-1)"})]),
		new vogo.Rotate(90),
		new vogo.Move("data[data.length-1]"),
		new vogo.Rotate(90),
		new vogo.Move("width")]);

	return [step, lineChart]
})

examples.push(function() {
	var nikolausHaus = new vogo.Func({
		name: "nikolausHaus",
		viewBox: {x:-13.572, y:-25.251, w:39.997, h:34.802}});
	nikolausHaus.setCommands([
		new vogo.Move(10),
		new vogo.Rotate(90),
		new vogo.Move(10),
		new vogo.Rotate(90),
		new vogo.Move(10),
		new vogo.Rotate(90),
		new vogo.Move(10),
		new vogo.Rotate("90+45"),
		new vogo.Move(14.15),
		new vogo.Rotate(-72),
		new vogo.Move(11),
		new vogo.Rotate(-126.1),
		new vogo.Move(11),
		new vogo.Rotate(-71.7),
		new vogo.Move(14.14)]);

	return nikolausHaus
})

examples.push(function() {
	var αrrowhead = new vogo.Func({
		name: "αrrowhead",
		args: {"sharpness": 19, "cut": 34},
		viewBox: {x:-14.391, y:-19.769, w:32.712, h:34.802}});
	αrrowhead.setCommands([
		new vogo.Move(14),
		new vogo.Rotate("-(180-sharpness)"),
		new vogo.Move(25),
		new vogo.Rotate("-(90+sharpness+cut)"),
		new vogo.Move("vogo.sin(sharpness)*25/vogo.cos(cut)"),
		new vogo.Rotate("cut*2"),
		new vogo.Move("vogo.sin(sharpness)*25/vogo.cos(cut)"),
		new vogo.Rotate("-(90+sharpness+cut)"),
		new vogo.Move(25)]);

	return αrrowhead
})

// 26
examples.push(function() {
	var square4Clam = new vogo.Func({
		name: "square4Clam",
		args: {"a": 11.01},
		viewBox: {x:-18.571, y:-24.039, w:45.997, h:40.023}});
	square4Clam.setCommands([
		new vogo.Loop(4, [
			new vogo.Move("a"),
			new vogo.Rotate(90)])]);

	var clam = new vogo.Func({
		name: "clam",
		args: {"a": 7.5, "b": 49},
		viewBox: {x:-39.608, y:-39.427, w:80.449, h:70.000}});
	clam.setCommands([
		new vogo.Loop("b", [
			new vogo.FuncCall(square4Clam, {"a": "3+i*0.4"}),
			new vogo.Rotate("a")])]);

	return [square4Clam, clam]
})

return vogo
}()
