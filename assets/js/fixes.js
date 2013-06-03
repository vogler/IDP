// jQuery
// alert on ajax errors
$(function() {
  $.ajaxSetup({
    error: function(jqXHR, exception) {
      if (jqXHR.status === 0) {
        alert('Not connected.\nVerify Network.');
      } else if (jqXHR.status == 404) {
        alert('Requested page not found [404].');
      } else if (jqXHR.status == 500) {
        alert('Internal Server Error [500].');
      } else if (exception === 'parsererror') {
        alert('Requested JSON parse failed.');
      } else if (exception === 'timeout') {
        alert('Time out error.');
      } else if (exception === 'abort') {
        alert('Ajax request aborted.');
      } else {
        alert('Uncaught Error.\n' + jqXHR.responseText);
      }
    }
  });
});
// missing shortcuts
$.put = function(url, data, fun){$.ajax({url: url, type: 'PUT'    , data: data, success: fun});};
$.del = function(url, data, fun){$.ajax({url: url, type: 'DELETE' , data: data, success: fun});};

// Knockout
var ENTER_KEY = 13;
ko.bindingHandlers.enterKey = {
  init: function( element, valueAccessor, allBindingsAccessor, data ) {
    var wrappedHandler, newValueAccessor;
    wrappedHandler = function( data, event ) {
      if ( event.keyCode === ENTER_KEY ) {
        valueAccessor().call( this, data, event );
      }
    };
    newValueAccessor = function() {
      return {
        keyup: wrappedHandler
      };
    };
    ko.bindingHandlers.event.init( element, newValueAccessor, allBindingsAccessor, data );
  }
};

// Sugar
function duration(seconds){
  // var seconds = Math.round(seconds);
  var hours = Math.floor(seconds/60/60);
  var seconds = seconds || 0
  return (hours >= 1 ? hours+':' : '') + Date.create(seconds.seconds()).format('{mm}:{ss}');
}

// functional
// >10x faster than map+filter (see http://jsperf.com/map-filter-vs-filtermap)
function filterMap(r, f) {
  var n = [ ];
  for (var i = 0, L = r.length, v; i < L; i++)
    if ((v = f(r[i])) !== undefined)
      n.push(v);
  return n;
}