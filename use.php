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
	
	<style>
		#mysvg {
			position: fixed;
			width: 80%;
			height: 80%;
			top: 10%;
			left: 10%;
			border: 1px solid rgba(0,0,0,0.1);
		}
	</style>
	
</head>

<body>
	<svg id="mysvg"
		 xmlns="http://www.w3.org/2000/svg"
		 viewBox="-100 -50 200 100"></svg>
	
	<script>
		
var α = new vogo.Func("α", {"a": 106, "n": 7});
α.setCommands([
	new vogo.Loop("n", [
			new vogo.Move("a/n"),
			new vogo.Rotate("Math.PI*2/n")])]);

var δ = new vogo.Func("δ", {"a": 10, "b": -0.7, "c": 0.7});
δ.setCommands([
	new vogo.Move("a"),
	new vogo.Rotate("b"),
	new vogo.Move("a"),
	new vogo.FuncCall(δ, {"a": "a*c"}),
	new vogo.Move("-a"),
	new vogo.Rotate("-b*2"),
	new vogo.Move("a"),
	new vogo.FuncCall(δ, {"a": "a*c"}),
	new vogo.Move("-a"),
	new vogo.Rotate("b"),
	new vogo.Move("-a")]);

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
