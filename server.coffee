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
  app.use express.static(__dirname + "/public")

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
    files ?= []
    baustellen.findItems {}, sort: "name", (err, items) ->
      res.render "index.jade",
        pageTitle: "GPS-Daten"
        files: files
        baustellen: items

app.get "/maps", (req, res) ->
  fs.readdir pathMaps + 'json/', (err, files) ->
    res.json files

app.get "/map/:file", (req, res) ->
  excluded = if req.query.excluded then JSON.parse(req.query.excluded) else []
  console.log excluded, req.query
  file = req.params.file
  console.log file
  path = pathMaps + 'json/' + file
  # readStream = fs.createReadStream path
  # util.pump readStream, res # fast, streaming, no whitespaces
  fs.readFile path, (err, data) ->
    if err
      res.send 404
      return
    map = JSON.parse data
    # calculate intersections
    db.collection('gates').findItems (err, gates) -> # file: file, 
      map.intersections = []
      time = 0
      map.track.reduce (a, b, i, arr) -> # TODO parallel, perpendicular lines?
        # m1 = (b.lat-a.lat) / (b.lng-a.lng)
        # t1 = a.lat - m1*a.lng
        duration = b.time - a.time
        time += duration
        for gate in gates # TODO optimization: check bounds to skip calculations?
          # gate.i = parseInt(gate.i)
          if gate.i in excluded
            continue
          gate.path.reduce (c, d, i, arr) ->
            # m2 = (d.lat-c.lat) / (d.lng-c.lng)
            # t2 = c.lat - m2*c.lng
            N = (b.lng-a.lng) * (d.lat-c.lat) - (b.lat-a.lat) * (d.lng-c.lng)
            s = ((c.lng-a.lng) * (d.lat-c.lat) - (c.lat-a.lat) * (d.lng-c.lng)) / N
            t = (a.lng-c.lng + s*(b.lng-a.lng)) / (d.lng-c.lng)
            # check if the intersection is on the line segment
            if 0 <= s <= 1 and 0 <= t <= 1
              point =
                lng: a.lng + s*(b.lng-a.lng)
                lat: a.lat + s*(b.lat-a.lat)
              # console.log 'intersection at', point
              # console.log 'intersection at', time, 's for', duration, 's'
              map.intersections.push time: time, gate: gate.i # chronological
            d
        b
      # aggregate stats
      stats = {}
      map.intersections.reduce (a, b, i, arr) ->
        stats[a.gate] ?= {}
        stats[a.gate][b.gate] ?= times: []
        stats[a.gate][b.gate].times.push b.time-a.time
        b
      map.stats = info: [], table: []
      for g1,v1 of stats
        for g2,v2 of v1
          v2.times.sort (a,b) -> a-b # standard sort compares strings -> 10 before 2
          sum = v2.times.reduce (a,b) -> a+b
          n = v2.times.length
          mean = sum/n
          ssd = v2.times.reduce ((a,b) -> a + Math.pow(b-mean, 2)), 0
          stdev = Math.sqrt(1/(n-1)*ssd)
          map.stats.info.push from: g1, to: g2, times: v2.times, sum: sum, mean: Math.round(mean), stdev: Math.round(stdev)
      # map.gates = gates
      # need to gather data in rows for Knockout-template :(
      map.stats.table = [['Anzahl'].concat(map.stats.info.map (x) -> x.times.length),
                   ['Summe'].concat(map.stats.info.map (x) -> x.sum),
                   ['Mittel'].concat(map.stats.info.map (x) -> x.mean),
                   ['Sigma'].concat(map.stats.info.map (x) -> x.stdev),
                   ['Zeiten'].concat(map.stats.info.map (x) -> x.times),]
      map.stats.allGates = gates.map (x) -> x.i
      map.stats.intersectedGates = map.stats.info.reduce ((a,b) ->
        f = (x,y) -> if x in y then y else y.concat(x) # unique append
        f b.from, (f b.to, a)), []
      map.meanDuration = Math.round(time/map.track.length)
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