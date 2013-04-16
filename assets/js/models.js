stats = ko.mapping.fromJS({info: [], table: [], allGates: [], intersectedGates: [], intersectedGatesOrg: []});
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

  // Operations
  self.addItem = function() {
    var name = this.newItem();
    $.post(url, {name: name}, function(item){
      item.editing = ko.observable(false);
      self.baustellen.push(item);
      // update mapping (makes fields of new item observable too)
      ko.mapping.fromJS(ko.mapping.toJS(self.baustellen), self.baustellen);
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
}
$(function() {
  baustellenViewModel = new BaustellenViewModel();
  ko.applyBindings(baustellenViewModel);
});

function formatRowContent(data, index, row){
  if(!index || row == 'Anzahl') return data;
  if(data instanceof Array)
    return data.map(function(x){return duration(x)}).join('<br>');
  else
    return duration(data);
}