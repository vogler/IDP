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
  // extend model by empty lists :(
  ko.utils.arrayForEach(self.sites(), function(item){
    if(!item.tracks){
      item.tracks = ko.observableArray();
    }
    if(!item.gates){
      item.gates = ko.observableArray();
    }
  });
  self.site = ko.observable();
  var emptyCurrentTruck = {name: "", volume: "", speed: "", driver: ""};
  self.truck = ko.mapping.fromJS(emptyCurrentTruck);
  self.emptyTruck = function(){
    ko.mapping.fromJS(emptyCurrentTruck, self.truck);
  };
  self.emptyTruck();
  self.track = ko.mapping.fromJS({site: null, truck: {_id: null, name: null}});
  self.newItem = ko.observable();
  self.uploading = ko.observable(false);

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
      item.tracks = [];
      item.gates = [];
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
      drawGates();
      reloadStats();
    });
  };
  self.removeTrack = function(site, track) {
    // delete from db
    console.log('removing track', ko.mapping.toJS(track));
    $.put(url+'/'+site._id(), {$pull: {tracks: ko.mapping.toJS(track)}}, function(data){
      // delete from disk
      $.del('/map/'+track.file(), {}, function(data){
        console.log("removed track", track.file());
      });
      site.tracks.remove(track); // destroy marks for deletion
    });
  };
  self.editTrack = function(){
    console.log('editing track', loadedMap(), self.track);
    // if(self.site()._id() != self.track.site()._id()){
      var trackOld   = self.site().tracks().find(function(x){return x.file()==loadedMap()});
      var track    = ko.mapping.toJS(trackOld);
      track.truck  = ko.mapping.toJS(self.track.truck);
      var trackNew = ko.mapping.fromJS(track);
      // console.log('changing site of track', track, 'from', self.site().name(), 'to', self.track.site().name());
      $.put(url+'/'+self.site()._id(), {$pull: {tracks: ko.mapping.toJS(trackOld)}}, function(data){
        $.put(url+'/'+self.track.site()._id(), {$push: {tracks: track}}, function(data){
          self.site().tracks.remove(trackOld); // destroy marks for deletion
          self.site(self.track.site());
          self.site().tracks.push(trackNew);
          drawGates();    // different gates
          // reloadStats();  // different stats
          loadMap();      // different truck
          $('#track').modal('hide');
        });
      });
    // }
  }

  trucksViewModel = new function(){
    var self = this;
    var url = '/db/trucks';
    self.trucks = db_trucks;
    var emptyTruckType = {name: "", volume: "", speed: "", list: []};
    var emptyTruck = {name: "", truckType: ""};
    self.newTruckType = ko.mapping.fromJS(emptyTruckType);
    self.newTruck     = ko.mapping.fromJS(emptyTruck);
    self.editing      = ko.observable(false);
    self.orgTruckType  = null;
    self.editTruckType = function(item) {
      ko.mapping.fromJS(ko.mapping.toJS(item), self.newTruckType);
      self.orgTruckType = item;
      self.editing(true);
    }
    self.saveTruckType = function() {
      $.post(url, ko.mapping.toJS(self.newTruckType), function(data){
        if(self.editing()){
          ko.mapping.fromJS(data, {}, self.orgTruckType);
          console.log("edited truckType", data._id);
          self.editing(false);
        }else{
          data.list = [];
          self.trucks.push(ko.mapping.fromJS(data)); // has _id from db
          console.log("added truckType", data._id);
        }
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
    if(self.uploading()) return;
    self.uploading(true);
    // var tracks = flatMap(self.sites(), function(site){return "tracks" in site ? site.tracks().map(function(track){return track.file()}) : []});
    var tracks = {};
    self.sites().forEach(function(site){
      site.tracks().forEach(function(track){
        tracks[track.file()] = site.name();
      });
    });
    var error = undefined;
    ko.utils.arrayForEach(uploads(), function(item){
      if(!item.truck) error = "Wählen Sie einen LKW für "+item.file;
      var key = item.file+".gpx";
      if(key in tracks) error = "Die Datei \""+item.file+"\" ist bereits der Baustelle \""+tracks[key]+"\" zugeordnet!\nEntfernen Sie sie in der Baustellenverwaltung oder benennen Sie die Datei um.";
    });
    if(error){
      self.uploading(false);
      return alert(error);
    }
    // console.log(uploads());
    ko.utils.arrayForEach(uploads(), function(item){
      item.data.formData = {site: sitesViewModel.site()._id(), truck: JSON.stringify(item.truck)};
      console.log("upload",item.data.formData);
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
  if(!index || row == 'Anzahl' || row == 'Menge') return data; // just return the row name or number
  if(data instanceof Array){ // Zeiten
    // var mean = stats.table()[2][index];
    var info = stats.info()[index-1]; // -1 because of row name
    if(info){ // no infos availabe (e.g. when there are no gates)
      var mean = info.mean(); var max = info.max();
    }
    return data.map(function(x){ // x[0] is the time, x[1] the duration
      if(info){
        var red = parseInt(Math.max(0, x[1]-mean)/(max-mean)*255);
        var style_duration = ' style="color: rgb('+red+' , 0, 0)"';
      }
      var html_time = '<span class="muted">'+Date.create(x[0]*1000).format('{24hr}:{mm}')+': </span>';
      var html_duration = '<span'+style_duration+'>'+duration(x[1])+'</span>';
      var style_excluded = timeExcluded(x[0]) ? ' style="text-decoration: line-through"' : '';
      return '<span'+style_excluded+' onclick="toggleExcludeTime('+x[0]+')">'+html_time+html_duration+'</span>';
    }).join('<br>');
  }else{
    return duration(data); // everything else is just a single duration
  }
}