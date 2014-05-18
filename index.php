<?php

?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>ma</title>
	<!--<link rel="icon" href="images/favicon.png" type="image/png"/>-->
	<!-- needs to be the first css! see getCustomStyleCSSRule() -->
	<link rel="stylesheet" type="text/css" href="css/main.css"/>
	<script type='text/javascript' src='js/d3.v3.min.js'></script>
	<script type='text/javascript' src='js/ma.js'></script>
</head>

<body>
	<div id="functions">
		<ul id="ul_f">
			
		</ul>
		<div class="centerDiv">
			<button id="f_addNew">+</button>
		</div>
	</div>
	<div id="border"></div>
	<div id="turtleSVGcontainer">
		<svg id="turtleSVG">
<!--		    <foreignObject x="0" y="0" width="100" height="50" transform="translate(-5,-5) scale(0.1)">
				<body xmlns="http://www.w3.org/1999/xhtml">
					<input type="text"/>
				</body>
			</foreignObject>-->
		</svg>
		<p id="notification" class="opacity0"></p>
	</div>
	
	
	<script>ma.init()</script>
</body>
</html>
