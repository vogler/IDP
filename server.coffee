express = require("express")
path = require("path")
fs = require("fs")
eyes = require("eyes")
xml2js = require("xml2js")
xmlParser = new xml2js.Parser()
sys = require("sys")
exec = require("child_process").exec
util = require("util")
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
pathMaps    = __dirname + "/maps/"

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

app.get "/db/:collection/:id?", (req, res) ->
  query = if req.query.query then JSON.parse(req.query.query) else {}
  query = _id: db.ObjectID.createFromHexString(req.params.id) if req.params.id
  db.collection(req.params.collection).findItems query, (err, items) ->
    if req.params.id
      if items.length > 0
        res.json items[0]
      else
        res.send 404
    else
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
  fs.readdir pathMaps + 'json/', (err, files) ->
    baustellen.findItems {}, sort: "name", (err, items) ->
      res.render "index.jade",
        pageTitle: "GPS-Daten"
        files: files
        baustellen: items

app.get "/maps", (req, res) ->
  fs.readdir pathMaps + 'json/', (err, files) ->
    res.json files

app.get "/map/:file", (req, res) ->
  file = req.params.file
  console.log file
  path = pathMaps + 'json/' + file
  # readStream = fs.createReadStream path
  # util.pump readStream, res
  fs.readFile path, (err, data) -> # slower than above (streaming and no whitespace) but nicer output
    if err
      res.send 404
      return
    # res.json JSON.parse data
    map = JSON.parse data
    track = map.track
    db.collection('gates').findItems (err, items) -> # file: file, 
      # gates = items.map (x) -> x.path
      # better automatically generate gate names in order in which they are reached
      # bad: order changes per track
      gates = items
      # calculate intersections
      gate_i = 0
      time = 0
      track.reduce (a, b, i, arr) -> # TODO parallel, perpendicular lines?
        # m1 = (b.lat-a.lat) / (b.lng-a.lng)
        # t1 = a.lat - m1*a.lng
        duration = b.time - a.time
        time += duration
        gates.forEach (gate) -> # TODO optimization: check bounds to skip calculations?
          gate.path.reduce (c, d, i, arr) ->
            # m2 = (d.lat-c.lat) / (d.lng-c.lng)
            # t2 = c.lat - m2*c.lng
            N = (b.lng-a.lng) * (d.lat-c.lat) - (b.lat-a.lat) * (d.lng-c.lng)
            s = ((c.lng-a.lng) * (d.lat-c.lat) - (c.lat-a.lat) * (d.lng-c.lng)) / N
            t = (a.lng-c.lng + s*(b.lng-a.lng)) / (d.lng-c.lng)
            # check if the intersection is on the line segments
            if 0 <= s <= 1 and 0 <= t <= 1
              point =
                lng: a.lng + s*(b.lng-a.lng)
                lat: a.lat + s*(b.lat-a.lat)
              # console.log 'found intersection:', point
              console.log 'intersection at', time, 's for', duration, 's'
              if gate.i == undefined
                gate_i++
                gate.i = gate_i
            d
        b
      res.json map

app.post "/upload", (req, res) ->
  file = req.files.map
  eyes.inspect file
  pathUpload  = pathMaps + 'uploads/' + file.name
  pathGpx     = pathMaps + 'gpx/'     + file.name + ".gpx"
  pathJson    = pathMaps + 'json/'    + file.name + ".gpx"
  fs.renameSync file.path, pathUpload
  cmd = 'java -jar RouteConverterCmdLine.jar "' + pathUpload + '" Gpx11Format "' + pathGpx + '"'
  console.log cmd
  exec cmd, (error, stdout, stderr) ->
    sys.print "stdout: " + stdout
    fs.readFile pathGpx, (err, data) ->
      xmlParser.parseString data, (err, result) ->
        # console.dir(result);
        # eyes.inspect(result);
        startTime = 0
        track = result.gpx.trk[0].trkseg[0].trkpt.map((x) ->
          startTime = Date.parse(x.time[0])/1000 if !startTime
          lat: x.$.lat
          lng: x.$.lon
          ele: x.ele[0]
          time: Date.parse(x.time[0])/1000-startTime
        )
        map =
          startTime: startTime
          endTime: startTime + track[track.length-1].time
          track: track
        fs.writeFile pathJson, JSON.stringify(map), (err) ->
          res.redirect "back"


app.listen app.get("port")