stats = ko.mapping.fromJS({info: [], table: [], allGates: [], intersectedGates: [], intersectedGatesOrg: []});
loadedMap = ko.observable("");
uploads = ko.observableArray();
function SitesViewModel() {
  // Data
  var self = this;
  var url = '/db/sites';
  // self.sites = ko.observable([]);
  // $.getJSON(url, function(data) {
  //   self.sites(data);
  // });
  self.sites = db_sites;
  self.site = ko.observable();
  self.newItem = ko.observable();

  // extend model by an editing field
  ko.utils.arrayForEach(self.sites(), function(item){
    item.editing = ko.observable(false);
  });

  // self.sites.subscribe(function(updated){
  //   console.log(updated);
  //   if(updated.length == 0){
  //     $('#sites').modal('show');
  //   }
  // });

  // Operations
  self.addItem = function() {
    var name = this.newItem();
    $.post(url, {name: name}, function(item){
      item.editing = false;
      self.sites.push(ko.mapping.fromJS(item));
      self.newItem("");
      console.log("added", item._id);
    });
  };
  self.removeItem = function(item) {
    if(!confirm("Mit der Baustelle werden auch alle Gates und Tracks gelöscht!")) return;
    console.log(item);
    $.del(url, item, function(data){
      // delete tracks from disk
      if(item.tracks){
        $.del('/map', {tracks: item.tracks()}, function(){
          console.log("deleted track files", item.tracks());
        });
      }
      self.sites.remove(item); // destroy marks for deletion
      console.log("removed site", data._id);
    });
  };
  self.editItem = function(item) {
    self.oldItem = ko.toJSON(item); // store old state
    item.editing(true);
  };
  self.stopEditing = function(item) {
    if(!item.editing()) return; // ignore blur after enter
    item.editing(false);
    // remove the item, if it is now empty
    if(!item.name().trim()) {
      self.removeItem(item);
    } else if(ko.toJSON(item) != self.oldItem) { // only update on change
      var send = ko.mapping.toJS(item); // send without ko-stuff
      delete send.editing; // don't save this helper field
      $.put(url+'/'+item._id(), {$set: send}, function(data){
        console.log("updated", send._id);
      });
    }
  };

  self.removeGate = function(site, gate) {
    $.put(url+'/'+site._id(), {$pull: {gates: ko.mapping.toJS(gate)}}, function(data){
      site.gates.remove(gate); // destroy marks for deletion
      console.log("removed gate", gate.i());
    });
  };
  self.removeTrack = function(site, track) {
    // delete from db
    $.put(url+'/'+site._id(), {$pull: {tracks: ko.mapping.toJS(track)}}, function(data){
      // delete from disk
      $.del('/map/'+track.file(), {}, function(data){
        site.tracks.remove(track); // destroy marks for deletion
        console.log("removed track", track.file());
      });
    });
  };

  trucksViewModel = new function(){
    var self = this;
    var url = '/db/trucks';
    self.trucks = db_trucks;
    var emptyTruckType = {name: "", volume: "", speed: "", list: []};
    var emptyTruck = {name: "", truckType: ""};
    self.newTruckType = ko.mapping.fromJS(emptyTruckType);
    self.newTruck     = ko.mapping.fromJS(emptyTruck);
    self.addTruckType = function() {
      $.post(url, ko.mapping.toJS(self.newTruckType), function(data){
        data.list = [];
        self.trucks.push(ko.mapping.fromJS(data)); // has _id from db
        console.log("added truckType", data._id);
        ko.mapping.fromJS(emptyTruckType, self.newTruckType);
      });
    };
    // extend model by empty list field :(
    ko.utils.arrayForEach(self.trucks(), function(item){
      if(!item.list){
        item.list = ko.observableArray();
      }
    });
    self.addTruck = function() {
      if(!self.newTruck.truckType()){
        return alert("Sie müssen erst einen Typ auswählen!");
      }
      var send = ko.mapping.toJS(self.newTruck);
      var id = send.truckType._id;
      delete send.truckType; // not needed since truck is child of type
      $.put(url+'/'+id, {$push: {list: send}}, function(data){
        self.newTruck.truckType().list.push(ko.mapping.fromJS(send));
        console.log("added truck", send.name);
        ko.mapping.fromJS(emptyTruck, self.newTruck);
      });
    };
    self.removeTruckType = function(item) {
      $.del(url, item, function(data){
        self.trucks.remove(item);
        console.log("removed truckType", item.name());
      });
    };
    self.removeTruck = function(truckType, truck) {
      $.put(url+'/'+truckType._id(), {$pull: {list: ko.mapping.toJS(truck)}}, function(data){
        truckType.list.remove(truck);
        console.log("removed truck", truck.name());
      });
    };
  }

  self.upload = function(){
    ko.utils.arrayForEach(uploads(), function(item){
      if(!item.truck) return alert("Wählen Sie einen LKW für "+item.file);
    });
    // console.log(uploads());
    ko.utils.arrayForEach(uploads(), function(item){
      item.data.submit();
    });
  }

  self.fadeIn = function(element, index, data) {
    // console.log(element, index, data);
    // $(element).animate({ backgroundColor: 'yellow' }, 200)
    //           .animate({ backgroundColor: 'white' }, 800);
    $(element).hide().fadeIn();
  };
}
$(function() {
  sitesViewModel = new SitesViewModel();
  ko.applyBindings(sitesViewModel);
  if(sitesViewModel.sites().length == 0){
    $('#sites').modal('show');
  }
});

function formatRowContent(data, index, row){
  if(!index && row == 'Zeiten') return data+'<br/><span class="muted">(Uhrzeit:<br/>Dauer)</span>';
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