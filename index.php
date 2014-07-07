<?php

?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Vogo</title>
	<link rel="icon" href="images/favicon.png" type="image/png"/>
	<link rel="stylesheet" type="text/css" href="css/main.css"/>
	<script type='text/javascript' src='js/d3.js'></script>
	<script type='text/javascript' src='js/vogo.js'></script>
</head>

<body>
	<div id="functions">
		<ul id="ul_f"></ul>
		<div class="centerDiv">
			<button id="f_addNew" title="Add new function">+</button>
		</div>
	</div>
	<div id="borderL" class="border"></div>
	<div id="turtleSVGcontainer">
		<svg id="turtleSVG"></svg>
		<p id="notification" class="opacity0"></p>
	</div>
	<div id="borderR" class="border"></div>
	<div id="toolbar">
		<ul id="ul_toolbar">
			<li key="d" title="Draw straight line"><img src="images/Move.svg"></li>
			<li key="r" title="Rotate/add angle"><img src="images/Rotate.svg"></li>
			<li key="l" title="Loop/iterate current selection"><img src="images/Loop.svg"></li>
			<li key="b" title="Branch/condition current selection"><img src="images/Branch.svg"></li>
			<li key="a" title="Abstract/create new function parameter"><img src="images/Abstract.svg"></li>
			<li key="e" title="Export to code"><img src="images/Export.svg"></li>
			<li key="s" title="SVG output"><img src="images/Svg.svg"></li>
		</ul>
	</div>
	
	<script>
		// functions and variables set here can be used inside vogo
		vogo.init()
	</script>
</body>
</html>
