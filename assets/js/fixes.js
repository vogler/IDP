// jQuery
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