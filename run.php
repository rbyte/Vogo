<?php

?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Vogo</title>
	<link rel="icon" type="image/png" href="images/favicon.png"/>
	<link rel="stylesheet" type="text/css" href="css/main.css"/>
	<script src='js/d3.js'></script>
	<script src='js/vogo.js'></script>
</head>

<body>
	<noscript>Javascript is required for Vogo to run.</noscript>
	
	<div id="functions">
		<ul id="ul_f"></ul>
		<div class="centerDiv">
			<div class="container-box"><div class="aspect-box"><div class="content-box">
				<img id="f_addNew" class="roundButton" src="images/NewFunction.svg" title="Add new function"></a>
			</div></div></div>
		</div>
	</div>
	<div id="borderL" class="border"><div></div></div>
	<div id="turtleSVGcontainer">
		<svg id="turtleSVG"></svg>
		<p id="notification" class="opacity0"></p>
	</div>
	<div id="borderR" class="border"><div></div></div>
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
		<div class="centerDiv">
			<div class="container-box helpSVGcontainer"><div class="aspect-box"><div class="content-box">
				<a href="."><img class="roundButton" src="images/Help.svg" title="Help"></a>
			</div></div></div>
		</div>
	</div>
	
	<script>
		// functions and variables set here can be used inside vogo
		vogo.init()
	</script>
</body>
</html>
