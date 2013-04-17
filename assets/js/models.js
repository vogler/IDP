stats = ko.mapping.fromJS({info: [], table: [], allGates: [], intersectedGates: [], intersectedGatesOrg: []});
loadedMap = ko.observable("");
function BaustellenViewModel() {
  // Data
  var self = this;
  var url = '/db/baustellen';
  // self.baustellen = ko.observable([]);
  // $.getJSON(url, function(data) {
  //   self.baustellen(data);
  // });
  self.baustellen = db_baustellen;
  self.baustelle = ko.observable();
  self.newItem = ko.observable();

  // extend model by an editing field
  ko.utils.arrayForEach(self.baustellen(), function(item){
    item.editing = ko.observable(false);
  });

  // self.baustellen.subscribe(function(updated){
  //   console.log(updated);
  //   if(updated.length == 0){
  //     $('#baustellen').modal('show');
  //   }
  // });

  // Operations
  self.addItem = function() {
    var name = this.newItem();
    $.post(url, {name: name}, function(item){
      item.editing = false;
      self.baustellen.push(ko.mapping.fromJS(item));
      self.newItem("");
      console.log("added", item._id);
    });
  };
  self.removeItem = function(item) {
    $.del(url, item, function(data){
      self.baustellen.remove(item); // destroy marks for deletion
      console.log("removed", data._id);
    });
  };
  self.editItem = function(item, event) {
    self.oldItem = ko.toJSON(item); // store old state
    item.editing(true);
  };
  self.stopEditing = function(item, event) {
    if(!item.editing()) return; // ignore blur after enter
    item.editing(false);
    // remove the item, if it is now empty
    if(!item.name().trim()) {
      self.removeItem(item);
    } else if(ko.toJSON(item) != self.oldItem) { // only update on change
      var tmp = item.editing;
      delete item.editing; // don't save this helper field
      $.put(url, item, function(data){
        item.editing = tmp; // restore field
        console.log("saved", data._id);
      });
    }
  };

  self.fadeIn = function(element, index, data) {
    // console.log(element, index, data);
    // $(element).animate({ backgroundColor: 'yellow' }, 200)
    //           .animate({ backgroundColor: 'white' }, 800);
    $(element).hide().fadeIn();
  };
}
$(function() {
  baustellenViewModel = new BaustellenViewModel();
  ko.applyBindings(baustellenViewModel);
  if(baustellenViewModel.baustellen().length == 0){
    $('#baustellen').modal('show');
  }
});

function formatRowContent(data, index, row){
  if(!index && row == 'Zeiten') return data+'<br/><span class="muted">(Uhrzeit: Dauer)</span>';
  if(!index || row == 'Anzahl') return data;
  if(data instanceof Array){ // Zeiten
    // var mean = stats.table()[2][index];
    var info = stats.info()[index-1];
    if(info){
      var mean = info.mean(); var max = info.max();
    }
    return data.map(function(x){
      if(info){
        var red = parseInt(Math.max(0, x[1]-mean)/(max-mean)*255);
        var style = ' style="color: rgb('+red+' , 0, 0)"';
      }
      return '<span class="muted">'+Date.create(x[0]*1000).format('{24hr}:{mm}')+': </span><span'+style+'>'+duration(x[1])+'</span>';
    }).join('<br>');
  }else{
    return duration(data);
  }
}