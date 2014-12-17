var formatCommas = d3.format(",");
var municipalitiesData = [];


//setup Leaflet map
var windowHeight = $(window).height();
$("#map").height(windowHeight);


var HOTAttribution = 'Base map data &copy; <a href="http://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/" target="_blank">CC-BY-SA</a> | Map style by <a href="http://hot.openstreetmap.org" target="_blank">H.O.T.</a> | <a title="Disclaimer" onClick="showDisclaimer();">Disclaimer</a>';
// var hotUrl = 'http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
var hotUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';



var map = new L.Map("map", {
	center: [12.351, 122.893],
	zoom: 6,
	zoomControl: false,
  // scrollWheelZoom: false,
});

// Add our Leaflet zoom control manually where we want it
var zoomControl = L.control.zoom({
    position: 'topleft'
});
map.addControl(zoomControl);

// Add our loading control in the same position and pass the
// zoom control to attach to it
var loadingControl = L.Control.loading({
    position: 'topleft',
    zoomControl: zoomControl
});
map.addControl(loadingControl);

// L.tileLayer(hotUrl, {attribution: HOTAttribution}).addTo(map);




function projectPoint(x, y) {
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}
var transform = d3.geo.transform({point: projectPoint}),
    path = d3.geo.path().projection(transform);

// initialize the SVG layer for D3 drawn survey points
map._initPathRoot()

// pick up the SVG from the map object
var svg = d3.select("#map").select("svg");
var municipalityGroup = svg.append('g').attr("id", "municipalities");
var povertyGroup = svg.append('g').attr("id", "povertyBubbles");



function getGeoData(){
  d3.json("data/municipalities.json", function(data) {
    municipalitiesData = topojson.feature(data, data.objects.municipalities).features;
    var mappedMunicipalities = municipalityGroup.selectAll("path")
      .data(municipalitiesData)
      .enter().append("path")
      .attr("class", "municipality")
      .attr("d",path)
      // .on("click",clickedMunicipality)
      .on("mouseover", function(d){ 
        var tooltipText = "<strong>" + d.properties.m + ", " + d.properties.p + "</strong>";
        $('#tooltip').append(tooltipText);                
      })
      .on("mouseout", function(){ 
         $('#tooltip').empty();        
      });

    function updateMunicipalitiesPaths(){
      mappedMunicipalities.attr("d", path);
    }
    map.on("viewreset", updateMunicipalitiesPaths);

    colorbyPopulation();
  }); 
  
}


function colorbyPopulation(){
  d3.csv("data/MunicipPopulation2010.csv", function(data) {  
    var population2010Lookup = {};
    data.forEach(function(d) { population2010Lookup[d.pcodeph] = +d.pop; });

    var jenks9 = d3.scale.threshold()
        .domain(ss.jenks(data.map(function(d) { return +d.pop; }), 9))
        .range(d3.range(9).map(function(i) { return "q" + i + "-9"; }));

    municipalityGroup.selectAll("path")
      .attr("class", function(d){ return jenks9(population2010Lookup[d.properties.ph]);})
      .attr("data-pop2010", function(d){return population2010Lookup[d.properties.ph];})
      .on("mouseover", function(d){ 
        var tooltipText = "<strong>" + d.properties.m + ", " + d.properties.p +"<br>"+ formatCommas($(this).attr("data-pop2010")) + "</strong>";
        $('#tooltip').append(tooltipText);                
      })
      .on("mouseout", function(){ 
         $('#tooltip').empty()
      })
      .classed("municipality", true);
    // municipalityGroup.selectAll("path").attr("class", "yes");
    povertyBubbles();
  });
}

function povertyBubbles(){
  d3.csv("data/MunicipPoverty2009.csv", function(data) {
    var poverty2009Lookup = {};
    data.forEach(function(d) { poverty2009Lookup[d.pcodeph] = +d.pov; });

    var color = d3.scale.threshold()
      .domain([20, 30, 40, 50, 100])
      .range(["#1a9641", "#a6d96a", "#ffffbf", "#fdae61", "#d7191c"]);

      

    var povertyMarkers = povertyGroup.selectAll("circle").data(municipalitiesData).enter()
      .append("circle").attr("r", 4).attr('stroke','#f5f5f5')
      .attr("data-pov2009", function(d){ return poverty2009Lookup[d.properties.ph];})
      .style("fill", function(d){ 
        if(poverty2009Lookup[d.properties.ph] == undefined){
          return "#6d6e70"; 
        } else {
          return color(poverty2009Lookup[d.properties.ph]); 
        }  
      })
      .style({"fill-opacity": 0.7, "stroke-opacity":0.2})
      .on("mouseover", function(d){ 
        var tooltipText = "<strong>" + d.properties.m + ", " + d.properties.p +"<br>"+ $(this).attr("data-pov2009") + "% poverty incidence</strong>";
        $('#tooltip').append(tooltipText);                
      })
      .on("mouseout", function(){ 
         $('#tooltip').empty()
      });
    function updatemarker(){
      povertyMarkers.attr("cx",function(d) { var thisLatLng = [d3.geo.centroid(d)[1], d3.geo.centroid(d)[0]]; return map.latLngToLayerPoint(thisLatLng).x;});
      povertyMarkers.attr("cy",function(d) { var thisLatLng = [d3.geo.centroid(d)[1], d3.geo.centroid(d)[0]]; return map.latLngToLayerPoint(thisLatLng).y;});
    }
    map.on("viewreset", updatemarker);
    updatemarker();

    $("#loading").fadeOut(300);

  });
}













// tooltip follows cursor
$(document).ready(function() {
    $('#map').mouseover(function(e) {
        //Set the X and Y axis of the tooltip
        $('#tooltip').css('top', e.pageY + 10 );
        $('#tooltip').css('left', e.pageX + 20 );
    }).mousemove(function(e) {
        //Keep changing the X and Y axis for the tooltip, thus, the tooltip move along with the mouse
        $("#tooltip").css({top:(e.pageY+15)+"px",left:(e.pageX+20)+"px"});
    });
});

// show disclaimer text on click of disclaimer link
function showDisclaimer() {
  window.alert("The maps used do not imply the expression of any opinion concerning the legal status of a territory or of its authorities.");
}

// on window resize
$(window).resize(function(){
    windowHeight = $(window).height();
    $("#map").height(windowHeight);
})

getGeoData();