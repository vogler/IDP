//- globals: map, path, anim, track, heatmap, markers, lines, excludedTimes
$(function() {
  if(!("google" in window)) {
    alert("Couldn't load Google Maps API. Online?\nEverything involving the map won't work");
  }else{
    var strokeColor = '#FF0000';
    var strokeWeight = 2;
    var myLatLng = new google.maps.LatLng(0, -180);
    var mapOptions = {
      zoom: 3,
      center: myLatLng,
      mapTypeId: google.maps.MapTypeId.TERRAIN
    };

    map = new google.maps.Map(document.getElementById('map_canvas'), mapOptions);

    var coordinates = [
      new google.maps.LatLng(37.772323, -122.214897),
      new google.maps.LatLng(21.291982, -157.821856),
      new google.maps.LatLng(-18.142599, 178.431),
      new google.maps.LatLng(-27.46758, 153.027892)
    ];
    path = new google.maps.Polyline({
      path: coordinates,
      strokeColor: strokeColor,
      strokeOpacity: 1.0,
      strokeWeight: strokeWeight,
      map: map
    });

    heatmap = new google.maps.visualization.HeatmapLayer({
      // data: path.getPath()
    });

    // create markers with letters from A to J
    // after J, the marker image starts at A again - titles go up to Z
    // hover over marker to see the real title
    markers = (0).upto(25).map(function(i){
      return new google.maps.Marker({
        title: String.fromCharCode(65 + i),
        zIndex: i+9,
        icon: new google.maps.MarkerImage('img/red_markers_A_J2.png',
          new google.maps.Size(20,34),
          new google.maps.Point(0,i%9*34))
      });
    });
    for(var i=0; i<markers.length; i++){
      // https://developer.mozilla.org/en-US/docs/JavaScript/Guide/Closures?redirectlocale=en-US&redirectslug=Core_JavaScript_1.5_Guide%2FClosures#Creating_closures_in_loops.3A_A_common_mistake
      (function(i){ // create new scope for i, otherwise all closures will have the same value (i.e. the last value i takes in the loop)
        google.maps.event.addListener(markers[i], 'click', function(event) {
          // console.log('#gates [i="'+i+'"]', $('#gates [i="'+i+'"]'));
          // do the same stuff as if the gate button on the right was clicked
          $('#gates [i="'+i+'"]').button('toggle');
          drawGates();
          reloadStats();
        });
      })(i);
    }

    // if(db_files().length){
    //   loadMap(db_files().first());
    // }
  }

  // controls
  // style of jquery-ui accordion but more than one active panel possible
  //- $('#controls').addClass('ui-accordion ui-widget ui-helper-reset');
  $('#controls > h3').addClass('ui-accordion-header ui-helper-reset ui-state-default ui-corner-all')
    .click(function(){$(this).next().slideToggle()})
    .first().css('margin-top', 0);
  $('#controls > div').addClass('ui-widget-content ui-corner-bottom');

  // submit forms on file select
  // $(':file').change(function(){
  //   $(this).parents('form').submit();
  // });
  // bootstrap-filestyle
  $(":file").fileupload({
    dataType: 'json', // response
    add: function (e, data) {
      // console.log(data);
      uploads.push({file: data.files[0].name, data: data});
      $('#uploads').modal('show');
    },
    done: function(e, data){
      console.log('uploaded', data.files[0].name, ', response:', data.result);
      uploads.shift(); // assumes sequentialUploads
      sitesViewModel.site().tracks.push(ko.mapping.fromJS(data.result));
      db_files.push(data.result.file);
      routie('map/'+data.result.file);
      if(!uploads().length){
        $('#uploads').modal('hide');
        sitesViewModel.uploading(false);
      }
    },
    sequentialUploads: true
  });

  // gates
  $('#btn_gate').click(function(){
    var btn = $(this);
    if(btn.attr('disabled')) return false;
    btn.attr('disabled', true);
    google.maps.event.addListenerOnce(map, 'click', function(event) {
      var a = event.latLng;
      var line = drawLine();
      var mousemoveListener = google.maps.event.addDomListener(map, 'mousemove', function(event) {
        drawLine([a, event.latLng], line);
      });
      google.maps.event.addListenerOnce(map, 'click', function(event) {
        google.maps.event.removeListener(mousemoveListener);
        var b = event.latLng;
        var path = [a, b];
        drawLine(path, line);

        var gates = sitesViewModel.site().gates;
        // i: gates().length.toString() is not a good idea because e.g. delete B from A,B,C then add new gate -> fail: has same i as C
        // get first free i from server
        $.getJSON('/db/sites/'+sitesViewModel.site()._id(), {}, function(json){
          var is = json.gates ? json.gates.map(function(gate){return gate.i}) : [];
          for(var i in (0).upto(25)){
            if(is.indexOf(i)==-1){
              // console.log("found free i for gate:", i);
              var item = {i: i.toString(), file: loadedMap(),
                path: path.map(function(x){return {lat: x.lat(), lng: x.lng()}})
              };
              $.put('/db/sites/'+sitesViewModel.site()._id(), {$push: {gates: item}}, function(data){
                reloadStats(); // there might be new intersections
                gates.push(ko.mapping.fromJS(item)); // update local site model
                line.setMap(null); // delete line
                drawGates(); // draw all gates including the marker for the new gate
                console.log("added", item.i);
              });
              break;
            }
          }
        });

        btn.attr('disabled', false);
      });
    });
  });
  // $('#btn_area').click(function(){
  //   var btn = $(this);
  //   if(btn.attr('disabled')) return false;
  //   btn.attr('disabled', true);
  //   google.maps.event.addListenerOnce(map, 'click', function(event) {
  //     var a = event.latLng;
  //     google.maps.event.addListenerOnce(map, 'click', function(event) {
  //       var b = event.latLng;
  //       var bounds = new google.maps.LatLngBounds()
  //       bounds.extend(a);
  //       bounds.extend(b);
  //       var rectangle = new google.maps.Rectangle({
  //         strokeColor: '#FF0000',
  //         strokeOpacity: 0.8,
  //         strokeWeight: 2,
  //         fillColor: '#FF0000',
  //         fillOpacity: 0.35,
  //         map: map,
  //         bounds: bounds
  //       });
  //       btn.attr('disabled', false);
  //     });
  //   });
  // });

  // animation
  $('#btn_play').click(function() {
    anim_play();
    var status = anim.playing ? 'pause' : 'play';
    $(this).find('i').attr('class', 'icon-'+status);
  });

  // speed slider
  $( "#speed_slider" ).slider({
    range: "min",
    min: 1,
    max: 100,
    value: anim.speed,
    slide: function( event, ui ) {
      $( "#speed" ).text( ui.value );
      anim.speed = ui.value;
      if(anim.playing){
        anim_pause();
        anim_play();
      }
    }
  });
  $( "#speed" ).text(anim.speed);

  // colorpicker
  $('#colorSelector').minicolors({
    defaultValue: strokeColor, textfield: false, opacity: true, position: 'left',
    change: function(hex, opacity){
      path.setOptions({strokeColor: hex, strokeOpacity: opacity});
    }
  });

  // stroke spinner
  $( "#stroke_spinner" ).val(strokeWeight).spinner({
    min: 0, max: 20, step: 0.1,
    numberFormat: 'n',
    spin: function( event, ui ) {
      path.setOptions({strokeWeight: ui.value});
    }
  });

  tooltips();
});


function drawLine(path, line){
  if(!path) path = [];
  if(!line){
    line = new google.maps.Polyline({
      clickable: false,
      strokeColor: '#FF00FF',
      strokeOpacity: 0.8,
      strokeWeight: 5,
      map: map
    });
  }
  line.setPath(path);
  return line;
}

lines = [];
function drawGates(){
  var site = sitesViewModel.site();
  console.log("drawGates", site.name());
  // hide all markers first
  markers.each(function(marker){marker.setMap(null)});
  // hide all old lines and then remove them
  lines.each(function(line){line.setMap(null)});
  lines = [];
  // draw new gates
  var excluded = getExcludedGates();
  site.gates().each(function(gateKO){
    var gate = ko.mapping.toJS(gateKO);
    var line = drawLine(gate.path.map(function(x){return new google.maps.LatLng(x.lat,x.lng)}));
    if(excluded.indexOf(gate.i) != -1){ // dim excluded gates
      line.setOptions({strokeColor: "grey", strokeOpacity: 0.5});
    }
    lines.push(line);
    var i = parseInt(gate.i);
    markers[i].setOptions({
        position: new google.maps.LatLng(gate.path.first().lat, gate.path.first().lng),
        map: map,
        // flat: true, 
        // clickable: false
    });
    // remove gate upon rightclick on marker
    // remove listener if there is already one from a previous drawGates()
    if(markers[i].listener) google.maps.event.removeListener(markers[i].listener);
    markers[i].listener = google.maps.event.addListenerOnce(markers[i], 'rightclick', function(event) {
      sitesViewModel.removeGate(site, gateKO);
    });
  });
}

function changedSite(){
  if(!sitesViewModel.site()) return; // nothing selected
  routie('site/'+sitesViewModel.site().name()); // set the hashtag (calls loadSite)
  loadedMap(null);
  drawGates();
}

function loadSite(site){
  if(sitesViewModel.site() && sitesViewModel.site().name() == site) return; // site already selected
  console.log("loadSite", site);
  sitesViewModel.sites().filter(function(x){
    if(x.name() == site){ // names must be unique!
      sitesViewModel.site(x);
      changedSite();
      return;
    }
  });
}

function getExcludedGates(){
  // return $('#gates :not(.active)').map(function(){return $(this).attr("i")}); // can't convert to JSON because of jQuery's circular structures
  return $.map($('#gates :not(.active)'), function(x){return $(x).attr("i")});
}

excludedTimes = [];
function timeExcluded(time){
  return excludedTimes.indexOf(time) != -1;
}
function toggleExcludeTime(time){
  if(!timeExcluded(time)){ // not yet in array
    excludedTimes.push(time);
  }else{ // already in array
    excludedTimes.remove(time); // remove from sugarjs is nicer than splice
  }
  reloadStats();
}

function reloadStats(){
  console.log("reloadStats");
  loadMap(false, true);
}

function loadMap(file, onlyStats){ // reloads if file is undefined
  if(!file) file = loadedMap();
  else loadedMap(file);
  if(!file) return;
  anim_stop();
  var excludedGates = getExcludedGates();
  $.getJSON('/map/' + file, {excludedGates: JSON.stringify(excludedGates), excludedTimes: JSON.stringify(excludedTimes)}, function(json){
      // stats
      ko.mapping.fromJS(json.stats, stats);
      if(!excludedGates.length)
        stats.intersectedGatesOrg(stats.intersectedGates());
      if(onlyStats) return; // don't redraw everything (e.g. only added gate or excluded gate or time)

      // track
      console.timeStamp("coords");
      console.time("coords");
      var bounds = new google.maps.LatLngBounds();
      var coords = json.track.map(function(x){
        var ll = new google.maps.LatLng(x.lat,x.lng);
        bounds.extend(ll);
        return ll;
      });
      console.timeEnd("coords");
      console.time("setPath");
      path.setPath(coords);
      map.fitBounds(bounds);
      track = json.track; // needed to show time in animation
      console.timeEnd("setPath");
      console.timeStamp("setPath");

      // UI
      $('#time_date').text(Date.create(json.startTime*1000).short('de'));
      $('#time_start').text(Date.create(json.startTime*1000).format('{24hr}:{mm}'));
      $('#time_end').text(Date.create(json.endTime*1000).format('{24hr}:{mm}'));
      $('#time_duration').text((json.endTime-json.startTime).seconds().duration('de'));

      // weather info
      var date = Date.create(json.startTime*1000);
      var date_yyyymmdd = date.format('{yyyy}{MM}{dd}');
      var loc = json.track.first();
      var wunderground_url = 'http://api.wunderground.com/api/77f326bef53d2911/history_'+date_yyyymmdd+'/q/'+loc.lat+','+loc.lng+'.json';
      $('#wunderground').attr('href', wunderground_url);
      var wetterde_url = 'http://www.wetter.de/wetterarchiv/wetterbericht/'+date.format('{yyyy}-{MM}-{dd}');
      $('#wetterde').attr('href', wetterde_url);
      // display data from wunderground (?callback=? is added to make a JSONP request in order to avoid CORS issues)
      // glossary: http://www.wunderground.com/weather/api/d/docs?d=resources/phrase-glossary&MR=1
      $.getJSON(wunderground_url+'?callback=?', {}, function(x){
        var summary = x.history.dailysummary[0];
        var temp =summary.meantempm+'°C';
        var rain = summary.rain=='1' ? ' Regen' : ' kein Regen';
        $('#weather').text(temp+rain);
      });

      // heatmap
      if(heatmap.getMap())
        heatmap.setData(path.getPath()); // OPT: not necessary if heatmap is deactivated

      // set select if accessed by url (get the site._id from the server since a matching from map to site is done there anyway -> saves us extra _id in url)
      if(!sitesViewModel.site()){
        for(var i=0; i< sitesViewModel.sites().length; i++){ // no foreach with break??
          var site = sitesViewModel.sites()[i];
          if(site._id() == json.site){
            sitesViewModel.site(site);
            drawGates();
            break;
          }
        }
      }
      // for the current site, get the truck for this track (don't get it from server because local model of truck could be edited)
      var truckInst = sitesViewModel.site().tracks().find(function(x){return x.file()==loadedMap()}).truck;
      var truckType = trucksViewModel.trucks().find(function(x){return x._id()==truckInst._id()});
      var truck = ko.toJS(truckType);
      if(truck) truck.driver = truckInst.name();
      // sitesViewModel.truck(truck);
      ko.mapping.fromJS(truck, sitesViewModel.truck);
  });
}

// animation
var anim = {
  playing: false, 
  follow: true,
  speed: 20,
  fullPath: undefined,
  i: 0,
  curPosMarker: new google.maps.Circle({
      strokeColor: '#00FF00',
      strokeWeight: 3,
      fillColor: '#00FF00',
      fillOpacity: 0.5,
      radius: 15,
      zIndex: 3
    })
};
function anim_updateTime(){
  $("#anim_time").text(duration(track[anim.i].time));
}
function anim_play(){
  if(!anim.playing) {
    if(!anim.i){
      anim.fullPath = path.getPath().getArray();
      anim.i = 1;
      anim_step();
    }
    // animation timeline
    $("#anim_timeline").slideDown();
    $("#anim_slider").slider({
      range: "min",
      min: 1,
      max: anim.fullPath.length,
      value: anim.i,
      slide: function( event, ui ) {
        anim.i = ui.value;
        anim_updateTime();
      }
    });
    // current position marker
    anim.curPosMarker.setMap(map);
    anim.playing = setInterval('anim_step()', parseInt(5000/anim.speed)); // TODO not all tracks have 5s steps
  } else {
    anim_pause();
  }
}
function anim_step(){
  if(anim.i >= anim.fullPath.length) {
    anim_stop();
  }
  if(!anim.i) return;
  path.setPath(anim.fullPath.first(anim.i));
  if(anim.follow) map.setCenter(anim.fullPath[anim.i]);
  anim.curPosMarker.setCenter(anim.fullPath[anim.i-1]);
  $("#anim_slider").slider({ value: anim.i });
  anim_updateTime();
  anim.i++;
}
function anim_pause(){
  clearInterval(anim.playing);
  anim.playing = false;
}
function anim_stop(){
  anim_pause();
  anim.i = 0;
  if(anim.fullPath) path.setPath(anim.fullPath);
  // remove current position marker
  anim.curPosMarker.setMap(null);
  $( "#btn_play i" ).attr('class', 'icon-play');
  $("#anim_timeline").slideUp();
}

// geocode
function geocode() {
  var infowindow = new google.maps.InfoWindow();
  var marker;
  var geocoder = new google.maps.Geocoder();
  var latlng = path.getPath().getArray().first();
  geocoder.geocode({'latLng': latlng}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      if (results[1]) {
        map.setZoom(11);
        marker = new google.maps.Marker({
          position: latlng,
          map: map
        });
        infowindow.setContent(results[1].formatted_address);
        infowindow.open(map, marker);
      } else {
        alert('No results found');
      }
    } else {
      alert('Geocoder failed due to: ' + status);
    }
  });
}

function tooltips(attr){
  var tooltips = $('#tooltips').is(':checked');
  $('#controls [rel = "tooltip"]').tooltip(attr ? attr : tooltips ? null : 'destroy');
}

function toggleLine() {
  path.setMap(path.getMap() ? null : map);
}

function toggleMarkers() {
  markers.each(function(marker){
    marker.setMap(marker.getMap() ? null : map);
  });
}

function toggleHeatmap() {
  heatmap.setMap(heatmap.getMap() ? null : map);
  if(heatmap.getMap())
    heatmap.setData(path.getPath()); // OPT: not set in loadMap() if heatmap is deactivated
}

function downloadCSV(){
  var excludedGates = getExcludedGates();
  req = '/map/csv/'+loadedMap();
  if(excludedGates.length || excludedTimes.length)
    req += '?' + $.param({excludedGates: JSON.stringify(excludedGates), excludedTimes: JSON.stringify(excludedTimes)});
  console.log(req);
  location.href = req;
}