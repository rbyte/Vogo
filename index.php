<?php

?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Vogo</title>
	<link rel="icon" href="images/favicon.png" type="image/png"/>
	<link rel="stylesheet" type="text/css" href="css/main.css"/>
	<script type='text/javascript' src='js/d3.v3.min.js'></script>
	<script type='text/javascript' src='js/vogo.js'></script>
</head>

<body>
	<div id="functions">
		<ul id="ul_f"></ul>
		<div class="centerDiv">
			<button id="f_addNew">+</button>
		</div>
	</div>
	<div id="border"></div>
	<div id="turtleSVGcontainer">
		<svg id="turtleSVG"></svg>
		<p id="notification" class="opacity0"></p>
	</div>
	
	<script>
		vogo.init()
		var f = new vogo.Function("myf", {a: undefined}, [new vogo.Rotate(1), new vogo.Move("a")])
		d3.select("#turtleSVG").call(vogo.draw(f, {a: 20}))
		
//		d3.select("#turtleSVG").call(function(elem) {
//			new vogo.Drawing(f, {a: 20}, elem)
//		})
		
		
//		new vogo.Drawing(f, {a: 20}, d3.select("#turtleSVG").append("g"))
</script>
</body>
</html>
