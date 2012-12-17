express = require("express")
path = require("path")
fs = require("fs")
eyes = require("eyes")
xml2js = require("xml2js")
parser = new xml2js.Parser()
sys = require("sys")
exec = require("child_process").exec
app = express()

# configure server
app.configure ->
  # app.use(express.logger());
  app.set "port", process.env.PORT or 3000
  app.set "views", __dirname + ""
  app.use express.bodyParser() # needed for req.files
  app.use express.methodOverride() # hidden input _method for put/del
  app.use require("stylus").middleware(__dirname + "/public")
  app.use express.static(path.join(__dirname, "public"))

app.configure "development", ->
  app.use express.errorHandler()


# configure paths
pathUploads = __dirname + "/maps/uploads/"
pathMaps = __dirname + "/maps/gpx/"

# DB
# Environment: appfog or local
if process.env.VCAP_SERVICES
  env = JSON.parse(process.env.VCAP_SERVICES)
  mongo = env["mongodb-1.8"][0]["credentials"]
else
  mongo = db: "idp"
generate_mongo_url = (obj) ->
  obj.hostname = (obj.hostname or "localhost")
  obj.port = (obj.port or 27017)
  obj.db = (obj.db or "test")
  (if obj.username and obj.password then obj.username + ":" + obj.password + "@" else "") + obj.hostname + ":" + obj.port + "/" + obj.db
mongourl = generate_mongo_url(mongo)

# mongoskin
mongo = require("mongoskin")
db = mongo.db(mongourl + "?auto_reconnect", safe: true)
db.open (err, db) ->
  if err
    console.log "Couldn't connect to " + mongourl
  else
    console.log "Connected to " + mongourl
# collections
baustellen = db.collection("baustellen")


# routes
app.get "/", (req, res) ->
  fs.readdir pathMaps, (err, files) ->
    baustellen.findItems {}, sort: "name", (err, items) ->
      res.render "index.jade",
        pageTitle: "GPS-Daten"
        files: files
        baustellen: items

app.get "/baustellen", (req, res) ->
  # res.json(['München', 'Berlin', 'Augsburg']);
  baustellen.findItems (err, items) ->
    res.json items.map((x) -> x.name)

app.post "/baustellen", (req, res) ->
  baustellen.insert
    name: req.body.baustelle, (err, result) ->
    res.redirect "back"

app.del "/baustellen", (req, res) ->
  baustellen.removeById req.body.id, (err, result) ->
    res.send "ok" # otherwise jQuery's ajax doesn't execute the success callback

app.get "/map/:file", (req, res) ->
  file = req.params.file
  console.log file
  file = "test.gpx"  unless file
  fs.readFile pathMaps + file, (err, data) ->
    parser.parseString data, (err, result) ->
      # console.dir(result);
      # eyes.inspect(result);
      res.json result.gpx.trk[0].trkseg[0].trkpt.map((x) ->
        lat: x.$.lat
        lon: x.$.lon
        ele: x.ele[0]
        time: x.time[0]
      )

app.get "/maps", (req, res) ->
  fs.readdir pathMaps, (err, files) ->
    res.json files

app.post "/upload", (req, res) ->
  file = req.files.map
  eyes.inspect file
  pathFrom = pathUploads + file.name
  pathTo = pathMaps + file.name + ".gpx"
  # ?? fs.rename(from, to);
  fs.readFile file.path, (err, data) ->
    fs.writeFile pathFrom, data, (err) ->
      cmd = "java -jar RouteConverterCmdLine.jar \"" + pathFrom + "\" Gpx11Format \"" + pathTo + "\""
      console.log cmd
      exec cmd, (error, stdout, stderr) ->
        sys.print "stdout: " + stdout
      res.redirect "back"


app.listen app.get("port")