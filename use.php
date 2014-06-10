<?php

?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Vogo Use</title>
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
		
var α = new vogo.Function("α", {"a": 16.66});
α.setCommands([
	new vogo.Branch("a>1", [
			new vogo.Rotate(0.203),
			new vogo.Move("a")], []),
	new vogo.FunctionCall(α, {"a": "a*0.7"})]);

new vogo.Drawing(α, {}, d3.select("#mysvg"))

if (false) {
	var fd = new vogo.Drawing(α, {n: 10}, d3.select("#mysvg"))
	fd.update({n: 5})
}

if (false)
	d3.select("#mysvg").append("g")
		.call(vogo.draw(α, {n: 10}))
		.call(vogo.update({n: 5}))

if (false) {
	var data = [3, 5, 7]
	data.forEach(function(e) {
		new vogo.Drawing(α, {n: e}, d3.select("#mysvg").append("g"))
	})
}
		
	</script>
</body>
</html>
