express = require("express")
path = require("path")
fs = require("fs")
eyes = require("eyes")
xml2js = require("xml2js")
xmlParser = new xml2js.Parser()
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
  # app.use require("stylus").middleware(__dirname + "/public")
  app.use require('connect-assets')()
  app.use express.static(path.join(__dirname, "public"))

app.configure "development", ->
  app.use express.errorHandler()


# configure paths
pathUploads = __dirname + "/maps/uploads/"
pathMaps    = __dirname + "/maps/gpx/"

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
# REST
app.get "/db", (req, res) ->
  db.collectionNames (err, items) ->
    res.json items

app.get "/db/:collection", (req, res) ->
  db.collection(req.params.collection).findItems (err, items) ->
    res.json items

app.del "/db/:collection", (req, res) ->
  db.collection(req.params.collection).removeById req.body._id, (err, result) ->
    console.log 'del ', req.params.collection, req.body
    res.send req.body

# updates if _id is set (one can simply use post>save instead of post>insert and put>update)
app.post "/db/:collection", (req, res) ->
  req.body._id = db.ObjectID.createFromHexString(req.body._id) if req.body._id
  db.collection(req.params.collection).save req.body, (err, result) ->
    console.log 'post', req.params.collection, req.body
    res.json req.body

# offered to remain RESTful
app.put "/db/:collection", (req, res) ->
  req.body._id = db.ObjectID.createFromHexString(req.body._id)
  db.collection(req.params.collection).updateById req.body._id, req.body, (err, result) ->
    console.log 'put ', req.params.collection, req.body
    res.json req.body


# routes
app.get "/", (req, res) ->
  fs.readdir pathMaps, (err, files) ->
    baustellen.findItems {}, sort: "name", (err, items) ->
      res.render "index.jade",
        pageTitle: "GPS-Daten"
        files: files
        baustellen: items

app.get "/maps", (req, res) ->
  fs.readdir pathMaps, (err, files) ->
    res.json files

app.get "/map/:file", (req, res) ->
  file = req.params.file
  console.log file
  file = "test.gpx" unless file
  fs.readFile pathMaps + file, (err, data) ->
    xmlParser.parseString data, (err, result) ->
      # console.dir(result);
      # eyes.inspect(result);
      res.json result.gpx.trk[0].trkseg[0].trkpt.map((x) ->
        lat: x.$.lat
        lon: x.$.lon
        ele: x.ele[0]
        time: x.time[0]
      )

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