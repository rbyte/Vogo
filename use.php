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
	<svg id="mysvg"
		 xmlns="http://www.w3.org/2000/svg"
		 viewBox="-100 -50 200 100"
		 width="80%"
		 height="80%"
		 style="border: 1px solid grey;"></svg>
	
	<script>
		var f = new vogo.Function("myf", {a: undefined}, [new vogo.Rotate(1), new vogo.Move("a")])
		d3.select("#mysvg").call(vogo.draw(f, {a: 20}))
		
	</script>
</body>
</html>
