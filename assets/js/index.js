$(document).ready(function() {
  //- TODO: offline: ReferenceError: google is not defined
  //- if(!google) alert("Couldn't load Google Maps API. Online?");
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
  });

  path.setMap(map);

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

  // baustellen
  $( "#baustellen" ).dialog({autoOpen: false, modal: true});
  $( "#btn_baustellen" ).click(function(){
    $('#baustellen').dialog('open');
  });
  $('#baustellen .icon-trash').click(function(){
    var li = $(this).parent();
    var id = li.attr('id');
    $.ajax({
      url: '/baustellen',
      type: 'DELETE',
      data: {id: id},
      success: function(result){
        li.slideUp();
      }
    });
  });
  $('#baustellen form').submit(function(){
    //- console.log($(this).serializeArray());
    $.post('/baustellen', $(this).serialize(), function(data){
      $('#baustellen').load('/ #baustellen');
    });
    return false;
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
      });
      btn.attr('disabled', false);
    });
  });
  
  // animation
  $('#btn_play').click(function() {
    anim_play();
    var status = anim_playing ? 'pause' : 'play';
    $(this).find('i').attr('class', 'icon-'+status);
  });

  // speed slider
  anim_speed = 20;
  $( "#speed_slider" ).slider({
    range: "min",
    min: 1,
    max: 100,
    value: anim_speed,
    slide: function( event, ui ) {
      $( "#speed" ).text( ui.value );
      anim_speed = ui.value;
      if(anim_playing){
        anim_pause();
        anim_play();
      }
    }
  });
  $( "#speed" ).text(anim_speed);

  // colorpicker
  $('#colorSelector').val(strokeColor).addClass('black').hide().miniColors({
    readonly: true, opacity: true, 
    change: function(hex, rgba){
      path.setOptions({strokeColor: hex, strokeOpacity: rgba.a});
    }
  });

  // stroke spinner
  $( "#stroke_spinner" ).val(strokeWeight).spinner({
    min: 0,
    max: 20,
    step: 0.1,
    numberFormat: 'n',
    spin: function( event, ui ) {
      path.setOptions({strokeWeight: ui.value});
    }
  });

});





function loadMap(file){
  anim_stop();
  //- '/map?file=' somehow breaks syntax highlighting for Jade
  $.getJSON('/map/' + file,
      {},
      function(json){
        var bounds = new google.maps.LatLngBounds();
        var coords = json.map(function(x){
          var ll = new google.maps.LatLng(x.lat,x.lon);
          bounds.extend(ll);
          return ll;
        });
        path.setPath(coords);
        map.fitBounds(bounds);
        $('#time_start').text(Date.create(json.first().time).long('de'));
        $('#time_end').text(Date.create(json.last().time).long('de'));
        $('#time_duration').text(
          Date.create(
            Date.range(json.first().time, json.last().time).duration()
          ).addHours(-1).format('{24hr}:{mm}')
        );
      });
}

// animation
var anim_playing = false;
var anim_follow = true;
var anim_fullPath, anim_i;
function anim_play(){
  if(!anim_playing) {
    if(!anim_i){
      anim_fullPath = path.getPath().getArray();
      anim_i = 1;
      anim_step();
    }
    anim_playing = setInterval('anim_step()', parseInt(5000/anim_speed));
  } else {
    anim_pause();
  }
}
function anim_step(){
  if(anim_i >= anim_fullPath.length) {
    anim_stop();
  }
  if(!anim_i) return;
  path.setPath(anim_fullPath.first(anim_i));
  if(anim_follow) map.setCenter(anim_fullPath[anim_i]);
  anim_i++;
}
function anim_pause(){
  clearInterval(anim_playing);
  anim_playing = false;
}
function anim_stop(){
  anim_pause();
  anim_i = 0;
  if(anim_fullPath) path.setPath(anim_fullPath);
  $( "#btn_play i" ).attr('class', 'icon-play');
}

// geocode
var infowindow = new google.maps.InfoWindow();
var marker;
var geocoder = new google.maps.Geocoder();
function geocode() {
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