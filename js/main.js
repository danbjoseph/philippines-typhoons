var formatCommas = d3.format(",");
var formatNoDecimal = d3.format("g0");

var municipalitiesData = [];

var loadedYears = [];
var loadedData = [];
var filteredData = [];

// IBTrACS reports 10-min maximum sustained winds, 
// so the traditional Saffir-Simpson categories were 
// converted to 10-min using a scaling factor of 0.88.
// Wind speeds listed in the drop-down menu are the 
// 10-min equivalents of the Saffir Simpson Hurricane Scale

// depression < 30 kt
// tropical storm 30 < wind < 56
// 1- 56 < wind < 72
// 2- 72 < wind < 86 
// 3- 86 < wind < 100
// 4- 100 < wind < 120
// 5- wind > 120

function saffirsimpsonCategory(wind){
  if (wind == -999){
    return "stormpath intensityMissing"
  } else if(wind < 30){
    return "stormpath td";
  } else if (wind < 56){
    return "stormpath ts";
  } else if (wind < 72){
    return "stormpath c1";
  } else if (wind < 86){
    return "stormpath c2";
  } else if (wind < 100){
    return "stormpath c3";
  } else if (wind < 120){
    return "stormpath c4";
  } else{
    return "stormpath c5";
  }
}




//setup Leaflet map
var windowH = $(window).height();
$("#map").height(windowH);
$("#infoWrapper").height(windowH);

var HOTAttribution = 'Base map data &copy; <a href="http://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/" target="_blank">CC-BY-SA</a> | Map style by <a href="http://hot.openstreetmap.org" target="_blank">H.O.T.</a> | <a title="Disclaimer" onClick="showDisclaimer();">Disclaimer</a>';
var hotUrl = 'http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
// var hotUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';



var map = new L.Map("map", {
	center: [12.351, 122.893],
	zoom: 6,
  minZoom: 3,
  // maxZoom: 12,
	zoomControl: false,
  attributionControl: false,
  // maxBounds: [[3.98,114.96],[21.70,139.23]]
});

var attributionControl = L.control.attribution({
    position: 'bottomleft'
});
map.addControl(attributionControl);

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

var hotLayer = L.tileLayer(hotUrl, {attribution: HOTAttribution});
hotLayer.addTo(map);
map.removeLayer(hotLayer);



function toggleOSM(toggle) {  
  if($(toggle).hasClass("glyphicon-eye-close")){    
    d3.select(toggle).classed({
      'glyphicon-eye-close': false,
      'glyphicon-eye-open': true
    });
    hotLayer.addTo(map);
    municipalityGroup.selectAll("path").classed("overOSM", true);
    worldGroup.selectAll("path").classed("overOSM", true);

  } else {
    d3.select(toggle).classed({
      'glyphicon-eye-close': true,
      'glyphicon-eye-open': false
    });
    map.removeLayer(hotLayer);
    municipalityGroup.selectAll("path").classed("overOSM", false);
    worldGroup.selectAll("path").classed("overOSM", false);
  }

}




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
var worldGroup = svg.append('g').attr("id", "worldclip");
var municipalityGroup = svg.append('g').attr("id", "municipalities");
var povertyGroup = svg.append('g').attr("id", "povertyBubbles");
var stormGroup = svg.append('g').attr("id", "stormTracks");


function getWorld(){
  d3.json("data/ne_110m.json", function(data){
    var worldData = topojson.feature(data, data.objects.ne_110m).features;
    var mappedWorld = worldGroup.selectAll("path")
      .data(worldData)
      .enter().append("path")
      .attr("class", "otherCountry")
      .attr("d",path)
      .on("mouseover", function(d){
        var tooltipText = "<strong>" + d.properties.name + "</strong>";
        $('#tooltip').append(tooltipText);             
      })
      .on("mouseout", function(d){ 
        $('#tooltip').empty();
      })
    function updateWorldPaths(){
      mappedWorld.attr("d", path);
    }
    map.on("viewreset", updateWorldPaths);
    getGeoData();
  });
}

function getGeoData(){
  d3.json("data/municipalities.json", function(data) {
    municipalitiesData = topojson.feature(data, data.objects.municipalities).features;
    var mappedMunicipalities = municipalityGroup.selectAll("path")
      .data(municipalitiesData)
      .enter().append("path")
      .attr("class", "municipality")
      .attr("d",path)
      .on("click",clickedMunicipality)
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

    loadPopulationData();
  }); 
  
}

var population2010Lookup = {};

function loadPopulationData(){
  d3.csv("data/MunicipPopulation2010.csv", function(data) {
    var populationLogArray = [];
    var populationArray = [];
    data.forEach(function(d) { 
      population2010Lookup[d.pcodeph] = d.pop;
      populationLogArray.push(Math.log(d.pop));
      populationArray.push(d.pop);
    });

    var minPop = Math.min.apply(Math,populationArray);
    var maxPop = Math.max.apply(Math,populationArray);
    $("#label-popmin").html(formatCommas(minPop));
    $("#label-popmax").html(formatCommas(maxPop));

    var minLogPop = Math.min.apply(Math,populationLogArray);
    var maxLogPop = Math.max.apply(Math,populationLogArray);
    var quantize = d3.scale.quantize()
      .domain([minLogPop, maxLogPop])
      .range(d3.range(9).map(function(i) { return "q" + i + "-9"; }));

    municipalityGroup.selectAll("path")
      .attr("data-pop2010", function(d){return population2010Lookup[d.properties.ph];})
      .attr("data-popcolorclass", function(d){ return quantize(Math.log(population2010Lookup[d.properties.ph]));}) 
    loadPovertyData();
  });
}

function loadPovertyData(){
  d3.csv("data/MunicipPoverty2009.csv", function(data) {
    var poverty2009Lookup = {};
    data.forEach(function(d) { poverty2009Lookup[d.pcodeph] = +d.pov; });

    var color = d3.scale.threshold()
      .domain([20, 30, 40, 50, 100])
      .range(["#1a9641", "#a6d96a", "#ffffbf", "#fdae61", "#d7191c"]);

    municipalityGroup.selectAll("path")
      .attr("data-pov2009", function(d){ return poverty2009Lookup[d.properties.ph];})
      .on("mouseover", function(d){ 
        $("#infoAdmin-name").html(d.properties.m + ", " + d.properties.p);
        $("#infoAdmin-pop").html($(this).attr("data-pov2009") + "% poverty incidence");
        $("#infoAdmin-pov").html(formatCommas($(this).attr("data-pop2010")) + " people");           
      })
      .on("mouseout", function(){ 
        $("#infoAdmin-name").html("<i>Hover over a municipality</i>");
        $("#infoAdmin-pop").empty();
        $("#infoAdmin-pov").empty();
      });


    var povertyMarkers = povertyGroup.selectAll("circle").data(municipalitiesData).enter()
      .append("circle").attr("r", 5)
      .attr("data-pov2009", function(d){ return poverty2009Lookup[d.properties.ph];})
      .attr("data-pop2010", function(d){return population2010Lookup[d.properties.ph];})
      .style("fill", function(d){ 
        if(poverty2009Lookup[d.properties.ph] == undefined){
          return "#6d6e70"; 
        } else {
          return color(poverty2009Lookup[d.properties.ph]); 
        }  
      }) 
      .on("mouseover", function(d){ 
        $("#infoAdmin-name").html(d.properties.m + ", " + d.properties.p);
        $("#infoAdmin-pop").html($(this).attr("data-pov2009") + "% poverty incidence");
        $("#infoAdmin-pov").html(formatCommas($(this).attr("data-pop2010")) + " people");           
      })
      .on("mouseout", function(){ 
        $("#infoAdmin-name").html("<i>Hover over a municipality</i>");
        $("#infoAdmin-pop").empty();
        $("#infoAdmin-pov").empty();
      });
    function updatemarker(){
      povertyMarkers.attr("cx",function(d) { var thisLatLng = [d3.geo.centroid(d)[1], d3.geo.centroid(d)[0]]; return map.latLngToLayerPoint(thisLatLng).x;});
      povertyMarkers.attr("cy",function(d) { var thisLatLng = [d3.geo.centroid(d)[1], d3.geo.centroid(d)[0]]; return map.latLngToLayerPoint(thisLatLng).y;});
    }
    map.on("viewreset", updatemarker);
    updatemarker();
    $("#povertyBubbles").toggle();

    setupSliderSingle();

  });
}

function setupSliderSingle(){
  $("#year-range").noUiSlider({
    start: 2013,
    step: 1,
    range: {
      'min': [ 1884 ],
      'max': [ 2013 ]
    }
  });

  $("#year-range").on({
    slide: function(){
      $("#year-lower").html(formatNoDecimal($("#year-range").val()));
    },
    change: function(){
      getStormData();
    }
  });

  $("#year-lower").html(formatNoDecimal($("#year-range").val()));
  getStormData();

}

// $("#year-range").noUiSlider({
//   start: [ 2010, 2013 ],
//   step: 1,
//   range: {
//     'min': [ 1884 ],
//     'max': [ 2013 ]
//   },
//   connect: true
// });

// $("#year-range").on({
//   slide: function(){
//     $("#year-lower").html(formatNoDecimal($("#year-range").val()[0]));
//     $("#year-upper").html(formatNoDecimal($("#year-range").val()[1]));
//   },
//   change: function(){
//     getStormData();
//   }
// });
//
// $("#year-lower").html(formatNoDecimal($("#year-range").val()[0]));
// $("#year-upper").html(formatNoDecimal($("#year-range").val()[1]));

function getStormData(){
  // disable slider and re-enable after load is complete
  var thisYear = parseInt($("#year-range").val(), 10);
  if($.inArray(thisYear, loadedYears) == -1){
    loadedYears.push(thisYear);
    $("#loading-wrapper").show();
    var accountName = "danbjoseph";
    var tableName = "wp_ibtracs_v03r06";
    var cartodbURL = "http://" + accountName + ".cartodb.com/api/v2/sql?q=SELECT * FROM " + tableName +
      " WHERE the_geom IS NOT NULL AND season=" + formatNoDecimal(thisYear) + "&format=geojson&dp=5";
    var xhr = d3.json(cartodbURL)
      .on("progress", function() { console.log("progress", d3.event); })
      .on("load", function(collection) {
        $(collection.features).each(function(index, feature){
          loadedData.push(feature);
        });
        mapStormData();
      })
      .get();
  } else {
    mapStormData();
  }
  // var lower = parseInt($("#year-range").val()[0], 10);
  // var upper = parseInt($("#year-range").val()[1], 10);
  // var queriedSeasons = 0;
  // var seasonQuery = "(";
  // for(i = lower; i <= upper; i++) {
  //   if($.inArray(i, loadedYears) == -1){
  //     queriedSeasons ++;
  //     if(queriedSeasons > 1){
  //       seasonQuery += " OR "
  //     }
  //     loadedYears.push(i);
  //     seasonQuery += "season=" + i;
  //   }
  // }
  // seasonQuery += ")";
  // if(queriedSeasons > 0){
  //   $("#loading-wrapper").show();
  //   var accountName = "danbjoseph";
  //   var tableName = "wp_ibtracs_v03r06";
  //   var cartodbURL = "http://" + accountName + ".cartodb.com/api/v2/sql?q=SELECT * FROM " + tableName +
  //     " WHERE the_geom IS NOT NULL AND " + seasonQuery + "&format=geojson&dp=5";
  //   var xhr = d3.json(cartodbURL)
  //     .on("progress", function() { console.log("progress", d3.event); })
  //     .on("load", function(collection) {
  //       $(collection.features).each(function(index, feature){
  //         loadedData.push(feature);
  //       });
  //       $("#loading-wrapper").fadeOut(500);
  //     })
  //     .get();
}


function mapStormData(){
  // var lower = parseInt($("#year-range").val()[0], 10);
  // var upper = parseInt($("#year-range").val()[1], 10);
  var thisYear = parseInt($("#year-range").val(), 10);
  $("#stormTracks").empty();

  var mappedPaths = stormGroup.selectAll("path")
    .data((loadedData).filter(function(d){return d.properties.season == thisYear})).enter()
    .append("path")
    .attr("class", function(d){ return saffirsimpsonCategory(d.properties["jtw_wind"]);})
    .attr("d", path)
    .on("mouseover", function(d){
      var tooltipText = "<strong>" + d.properties.name + "</strong>";
      $('#tooltip').append(tooltipText); 
      var thisSerial = d.properties.serial_num;
      stormGroup.selectAll("path")
        .filter(function(d) { return d.properties.serial_num == thisSerial })
        .each(function(d){ d3.select(this).classed("active", true); })               
    })
    .on("mouseout", function(d){ 
       $('#tooltip').empty();
       var thisSerial = d.properties.serial_num;
       stormGroup.selectAll("path").classed("active", false);

     
    });
  function updateStormPaths(){
    mappedPaths.attr("d", path);
  }
  map.on("viewreset", updateStormPaths);
    
  $("#loading-wrapper").fadeOut(500);
}








function togglePoverty(toggle){
  $("#legend-poverty").toggle();
  $("#povertyBubbles").toggle();
  if($(toggle).hasClass("glyphicon-eye-close")){
    d3.select(toggle).classed({
      'glyphicon-eye-close': false,
      'glyphicon-eye-open': true
    });
  } else {
    d3.select(toggle).classed({
      'glyphicon-eye-close': true,
      'glyphicon-eye-open': false
    });
  }
}

function togglePopulation(toggle){
  $("#legend-population").toggle();
  if($(toggle).hasClass("legend-off")){
    d3.select(toggle).classed({
      'legend-off': false,
      'glyphicon-eye-close': false,
      'legend-on': true,
      'glyphicon-eye-open': true
    });
    municipalityGroup.selectAll("path").each(function(d){
      var popcolorclass = d3.select(this).attr("data-popcolorclass");
      d3.select(this).classed(popcolorclass, true).classed("popcolor", true);
    }); 
  } else {
    d3.select(toggle).classed({
      'legend-off': true,
      'glyphicon-eye-close': true,
      'legend-on': false,
      'glyphicon-eye-open': false
    });
    municipalityGroup.selectAll("path").each(function(d){
      var popcolorclass = d3.select(this).attr("data-popcolorclass");
      d3.select(this).classed(popcolorclass, false).classed("popcolor", false);
    });

  }
}


function clickedMunicipality(e){
  // -d- is the data object
  // -this- is the svg  element
  console.log(e);

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
    windowH = $(window).height();
    $("#map").height(windowH);
    $("#infoWrapper").height(windowH);

    
})

getWorld();