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
  app.use(express.methodOverride()); // hidden input _method for put/del
  // app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(require('connect-assets')());
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// configure paths
var pathUploads = __dirname + '/maps/uploads/';
var pathMaps    = __dirname + '/maps/gpx/';

// DB
// Environment: appfog or local
if(process.env.VCAP_SERVICES){
    var env = JSON.parse(process.env.VCAP_SERVICES);
    var mongo = env['mongodb-1.8'][0]['credentials'];
} else {
    var mongo = { db: 'idp' }
}
var generate_mongo_url = function(obj){
    obj.hostname = (obj.hostname || 'localhost');
    obj.port = (obj.port || 27017);
    obj.db = (obj.db || 'test');
    return (obj.username && obj.password ?
      obj.username + ":" + obj.password + "@" : '')
    + obj.hostname + ":" + obj.port + "/" + obj.db;
}
var mongourl = generate_mongo_url(mongo);

// mongoskin
var mongo = require('mongoskin');
var db = mongo.db(mongourl + '?auto_reconnect', {safe:true});
db.open(function(err, db){
  if(err) console.log("Couldn't connect to "+mongourl);
  else console.log("Connected to "+mongourl);
});
var baustellen = db.collection('baustellen');


// routes
app.get('/', function(req, res){
  fs.readdir(pathMaps, function(err, files){
    baustellen.findItems({}, {sort: 'name'}, function (err, items) {
      res.render('index.jade', {pageTitle: 'GPS-Daten', files: files, baustellen: items});
    });
  });
});

app.get('/baustellen', function(req, res){
  // res.json(['München', 'Berlin', 'Augsburg']);
  baustellen.findItems(function (err, items) {
    res.json(items.map(function(x){return x.name}));
  });
});

app.post('/baustellen', function(req, res){
  baustellen.insert({name: req.body.baustelle}, function(err, result) {
    res.redirect("back");
  });
});

app.del('/baustellen', function(req, res){
  baustellen.removeById(req.body.id, function(err, result) {
    res.send("ok"); // otherwise jQuery's ajax doesn't execute the success callback
  });
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