//- globals: map, path, anim, file, track
$(document).ready(function() {
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
    loadMap(db_files().first());
  }

  // controls
  // style of accordion but more than one active panel possible
  //- $('#controls').addClass('ui-accordion ui-widget ui-helper-reset');
  $('#controls > h3').addClass('ui-accordion-header ui-helper-reset ui-state-default ui-corner-all')
    .css('padding', '.3em .7em').click(function(){$(this).next().slideToggle()})
    .first().css('margin-top', 0);
  $('#controls > div').addClass('ui-accordion-content ui-helper-reset ui-widget-content ui-corner-bottom')
    .css('padding', '.7em');

  // submit forms on file select
  $(':file').change(function(){
    $(this).parents('form').submit();
  });

  // gates
  $('#btn_gate').click(function(){
    var btn = $(this);
    if(btn.attr('disabled')) return false;
    btn.attr('disabled', true);
    google.maps.event.addListenerOnce(map, 'click', function(event) {
      var a = event.latLng;
      google.maps.event.addListenerOnce(map, 'click', function(event) {
        var b = event.latLng;
        var path = [a, b];
        var line = drawLine(path);

        // TODO hack
        $.getJSON('/db/gates', {query: JSON.stringify({baustelle: baustellenViewModel.baustelle()._id()})}, function(gates){
          // TODO change model to baustelle.gates
          var item = {baustelle: baustellenViewModel.baustelle()._id(), i: gates.length, file: file, path: path.map(function(x){return {lat: x.lat(), lng: x.lng()}})};
          console.log(item);
          $.post('/db/gates', item, function(item){
            console.log("added", item._id);
          });
        });

        btn.attr('disabled', false);
      });
    });
  });
  $('#btn_area').click(function(){
    var btn = $(this);
    if(btn.attr('disabled')) return false;
    btn.attr('disabled', true);
    google.maps.event.addListenerOnce(map, 'click', function(event) {
      var a = event.latLng;
      google.maps.event.addListenerOnce(map, 'click', function(event) {
        var b = event.latLng;
        var bounds = new google.maps.LatLngBounds()
        bounds.extend(a);
        bounds.extend(b);
        var rectangle = new google.maps.Rectangle({
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
          fillOpacity: 0.35,
          map: map,
          bounds: bounds
        });
        btn.attr('disabled', false);
      });
    });
  });

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
  $('#colorSelector').val(strokeColor).addClass('black').hide().miniColors({
    readonly: true, opacity: true, 
    change: function(hex, rgba){
      path.setOptions({strokeColor: hex, strokeOpacity: rgba.a});
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


function drawLine(path){
  return new google.maps.Polyline({
    path: path,
    strokeColor: '#FF00FF',
    strokeOpacity: 0.8,
    strokeWeight: 5,
    map: map
  });
}

function loadGates(){
  console.log(baustellenViewModel.baustelle()._id());
  $.getJSON('/db/gates', {query: JSON.stringify({baustelle: baustellenViewModel.baustelle()._id()})}, function(gates){
    gates.each(function(gate){
      var line = drawLine(gate.path.map(function(x){return new google.maps.LatLng(x.lat,x.lng)}));
      console.log(gate.i);
      var marker = new google.maps.Marker({
          position: new google.maps.LatLng(gate.path.first().lat, gate.path.first().lng),
          map: map,
          title: 'Gate '+gate.i,
          zIndex: parseInt(gate.i)+9
      });
    });
  });
}

function loadMap(file){
  window.file = file;
  anim_stop();
  //- '/map?file=' somehow breaks syntax highlighting for Jade
  $.getJSON('/map/' + file, {}, function(json){
      // track
      var bounds = new google.maps.LatLngBounds();
      var coords = json.track.map(function(x){
        var ll = new google.maps.LatLng(x.lat,x.lng);
        bounds.extend(ll);
        return ll;
      });
      path.setPath(coords);
      map.fitBounds(bounds);
      track = json.track; // needed to show time in animation

      // UI
      $('#time_date').text(Date.create(json.startTime*1000).short('de'));
      $('#time_start').text(Date.create(json.startTime*1000).format('{24hr}:{mm}'));
      $('#time_end').text(Date.create(json.endTime*1000).format('{24hr}:{mm}'));
      $('#time_duration').text((json.endTime-json.startTime).seconds().duration('de'));

      // stats
      ko.mapping.fromJS(json.stats, stats);
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
  var tooltips = $('#tooltips').attr('checked', attr == 'show' ? true : undefined).attr('checked');
  $('#controls a[rel = "tooltip"]').tooltip(attr ? attr : tooltips ? null : 'destroy');
}