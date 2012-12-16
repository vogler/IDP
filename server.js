var express = require('express')
  , path = require('path')
  , fs = require('fs')
  , eyes = require('eyes')
  , xml2js = require('xml2js')
  , sys = require('sys')
  , exec = require('child_process').exec;
var app = express();

// configure server
app.configure(function(){
  // app.use(express.logger());
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '');
  app.use(express.bodyParser()); // needed for req.files
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// configure paths
var pathUploads = __dirname + '/maps/uploads/';
var pathMaps    = __dirname + '/maps/gpx/';

// DB
// var mongo = require('mongodb');
// mongo.MongoClient.connect("mongodb://localhost:27017/idp", function(err, db) {
//   if(err) { return console.dir(err); }
//   var collection = db.collection('baustellen');
//   var docs = [{mykey:1}, {mykey:2}, {mykey:3}];
//   collection.insert(docs, function(err, result) {
//     collection.remove({mykey:1}, function(err, numberOfRemovedDocs) {});
//     collection.remove({mykey:2}, function(err, numberOfRemovedDocs) {});
//     collection.remove({},        function(err, numberOfRemovedDocs) {});
//   });
// });

// var mongoose = require('mongoose');
// mongoose.connect('localhost', 'idp');
// collection = mongoose.noSchema('baustellen'); // doesn't exist anymore -> Schema mandatory :(
// var docs = [{mykey:1}, {mykey:2}, {mykey:3}];
// collection.insert(docs, function(err, result) {
//   collection.remove({mykey:1}, function(err, numberOfRemovedDocs) {});
//   collection.remove({mykey:2}, function(err, numberOfRemovedDocs) {});
//   collection.remove({},        function(err, numberOfRemovedDocs) {});
// });

var mongo = require('mongoskin');
var db = mongo.db('localhost:27017/idp?auto_reconnect', {safe:true});
var collection = db.collection('baustellen');
var docs = [{mykey:1}, {mykey:2}, {mykey:3}];
collection.insert(docs, function(err, result) {
  collection.remove({mykey:1}, function(err, numberOfRemovedDocs) {});
  collection.remove({mykey:2}, function(err, numberOfRemovedDocs) {});
  // collection.remove({},        function(err, numberOfRemovedDocs) {});
});


// routes
app.get('/', function(req, res){
  fs.readdir(pathMaps, function(err, files){
    res.render('index.jade', {pageTitle: 'GPS-Daten', files: files});
  });
});

app.get('/baustellen', function(req, res){
  res.json(['München', 'Berlin', 'Augsburg']);
});

var parser = new xml2js.Parser();
app.get('/map/:file', function(req, res){
  var file = req.params.file;
  console.log(file);
  if(!file) file = 'test.gpx';
  fs.readFile(pathMaps + file, function (err, data) {
    parser.parseString(data, function (err, result) {
        // console.dir(result);
        // eyes.inspect(result);
        res.json(result.gpx.trk[0].trkseg[0].trkpt.map(function(x){
          return {lat: x.$.lat, lon: x.$.lon, ele: x.ele[0], time: x.time[0]};
        }));
    });
  });
});

app.get('/maps', function(req, res){
  fs.readdir(pathMaps, function(err, files){
    res.json(files);
  });
});

app.post('/upload', function(req, res){
  var file = req.files.map;
  eyes.inspect(file);
  var pathFrom  = pathUploads + file.name;
  var pathTo    = pathMaps + file.name + '.gpx';
  // ?? fs.rename(from, to);
  fs.readFile(file.path, function (err, data) {
    fs.writeFile(pathFrom, data, function (err) {
      var cmd = 'java -jar RouteConverterCmdLine.jar "'+ pathFrom +'" Gpx11Format "'+ pathTo +'"';
      console.log(cmd);
      exec(cmd, function(error, stdout, stderr){
          sys.print('stdout: ' + stdout);
      });
      res.redirect("back");
    });
  });
});


app.listen(app.get('port'));