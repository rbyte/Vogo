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
<!--			<li id="f_main"><div>Main</div>
				<ul id="ul_args">
					<li>arg1:default</li>
					<li>arg2:default</li>
				</ul>
				<div class="fSVGcontainer">
					<svg id="mainSVG"></svg>
				</div>
			</li>-->
		</ul>
	</div>
	<div id="border"></div>
	<div id="turtleSVGcontainer">
		<svg id="turtleSVG"></svg>
	</div>
	
	<script>ma.init()</script>
</body>
</html>
