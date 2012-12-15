var express = require('express')
  , path = require('path')
  , fs = require('fs')
  , eyes = require('eyes')
  , xml2js = require('xml2js')
  , sys = require('sys');
var exec = require('child_process').exec;
var MongoClient = require('mongodb').MongoClient;
var app = express();

// app.use(express.logger());
app.use(express.static(path.join(__dirname, '')));
app.set('views', __dirname + '');
app.use(express.bodyParser()); // needed for req.files

// configure paths
var pathUploads = __dirname + '/maps/uploads/';
var pathMaps    = __dirname + '/maps/gpx/';

// DB
MongoClient.connect("mongodb://localhost:27017/idp", function(err, db) {
  if(err) { return console.dir(err); }

  var collection = db.collection('baustellen');
  var docs = [{mykey:1}, {mykey:2}, {mykey:3}];

  collection.insert(docs, {safe: true}, function(err, result) {
    collection.remove({mykey:1}, {w:1}, function(err, numberOfRemovedDocs) {});
    collection.remove({mykey:2}, {w:1}, function(err, numberOfRemovedDocs) {});
    collection.remove({}, {w:1}, function(err, numberOfRemovedDocs) {});
  });
});


app.get('/hw', function(req, res){
  res.send('Hello World');
});

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

app.listen(3000);