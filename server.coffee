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
stylus = require("stylus")
# force recompile of x.styl every time x.css is requested
compileStyl = (req, res, next) ->
  # console.log "compileStyl", req.url
  stylFile = "assets/css/"+path.basename(req.path, ".css")+".styl"
  if not fs.existsSync stylFile
    next()
  else
    # console.log "recompiling", stylFile
    res.type "css"
    res.send stylus(fs.readFileSync(stylFile).toString()).set("filename", stylFile).render()
app.configure ->
  # app.use(express.logger());
  app.set "port", process.env.PORT or 3000
  app.set "views", __dirname + ""
  app.use express.bodyParser() # needed for req.files
  app.use express.methodOverride() # hidden input _method for put/del
  # called before caching of connect-assets (only recompiles if css() is called (i.e. whole page is reloaded) -> breaks livereload for css)
  app.use "/css/", compileStyl
  app.use require('connect-assets')()
  # app.use require("stylus").middleware(__dirname + "/public")
  app.use express.static(__dirname + "/public")

app.configure "development", -> # default, if NODE_ENV is not set
  app.use express.errorHandler()

# console.log app.stack


# configure paths
paths =
  maps:    "maps"
  uploads: "maps/uploads"
  gpx:     "maps/gpx"
  json:    "maps/json"
# prepend __dirname, append /, check if all exist
for k,v of paths
  paths[k] = path.join(__dirname, v+"/")
  if not fs.existsSync(paths[k])
    fs.mkdirSync(paths[k]) # no mkdir -p -> paths must be tree-ordered!


# configure database (mongodb)
# environment: appfog, heroku (using mongolab or mongohq) or local
generate_mongo_url = (obj) ->
  obj.hostname = (obj.hostname or "localhost")
  obj.port = (obj.port or 27017)
  obj.db = (obj.db or "test")
  (if obj.username and obj.password then obj.username + ":" + obj.password + "@" else "") + obj.hostname + ":" + obj.port + "/" + obj.db
# appfog
if process.env.VCAP_SERVICES
  env = JSON.parse(process.env.VCAP_SERVICES)
  mongo = env["mongodb-1.8"][0]["credentials"]
  mongo_appfog = generate_mongo_url(mongo)
# heroku:
#   to avoid credit card verification for add-ons simply create an account and set the variable yourself:
#     heroku config:set MONGOHQ_URL="mongodb://<user>:<password>@dharma.mongohq.com:10003/idp"
#   connect using:
#     mongo dharma.mongohq.com:10003/idp -u <user> -p<password>
mongoUri = mongo_appfog || process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/idp'

# connect using mongoskin (future layer for node-mongodb-native)
mongo = require("mongoskin")
db = mongo.db(mongoUri + "?auto_reconnect", safe: true)
db.open (err, db) ->
  if err
    console.log "couldn't connect to " + mongoUri
    process.exit 1
  else
    console.log "connected to " + mongoUri

# collections
baustellen = db.collection("baustellen")

# REST access to database
app.get "/db", (req, res) ->
  db.collectionNames (err, items) ->
    res.json items

app.get "/db/:collection/:id?", (req, res) ->
  query = if req.params.id then _id: db.ObjectID.createFromHexString(req.params.id) else
          if req.query.query then JSON.parse(req.query.query) else {}
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
  fs.readdir paths.json, (err, files) ->
    files ?= []
    baustellen.findItems {}, sort: "name", (err, items) ->
      res.render "index.jade",
        pageTitle: "GPS-Daten"
        files: files
        baustellen: items
        node_env: process.env.NODE_ENV ? "development"

app.get "/maps", (req, res) ->
  fs.readdir paths.json, (err, files) ->
    res.json files

app.get "/map/:format?/:file", (req, res) ->
  excluded = if req.query.excluded then JSON.parse(req.query.excluded) else []
  file = req.params.file
  console.log file, req.params.format
  pathJson = paths.json + file
  # readStream = fs.createReadStream pathJson
  # util.pump readStream, res # fast, streaming, no whitespaces
  fs.readFile pathJson, (err, data) ->
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
      if map.intersections.length>1
        map.intersections.reduce (a, b) ->
          stats[a.gate] ?= {}
          stats[a.gate][b.gate] ?= times: []
          stats[a.gate][b.gate].times.push b.time-a.time
          b
      map.stats = info: [], table: []
      for g1,v1 of stats
        for g2,v2 of v1
          v2.times.sort (a,b) -> a-b # standard sort compares strings -> 10 before 2
          sum = v2.times.reduce ((a,b) -> a+b), 0
          n = v2.times.length
          mean = sum/n
          ssd = if v2.times.length<2 then 0 else v2.times.reduce (a,b) -> a + Math.pow(b-mean, 2)
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
      map.stats.intersectedGates = map.stats.info.reduce (a,b) ->
        f = (x,y) -> if x in y then y else y.concat(x) # unique append
        f b.from, (f b.to, a)
      , []
      map.meanDuration = Math.round(time/map.track.length)
      if req.params.format=='csv'
        # res.header('content-type','text/csv'); 
        # res.header('content-disposition', 'attachment; filename='+file+'.csv'); 
        res.attachment(file+'.csv') # sets content-type and -disposition
        header = [['Gates'].concat(map.stats.info.map (col) -> col.from+' zu '+col.to)]
        for row in header.concat(map.stats.table)
          row = row.map (x) -> if x instanceof Array then JSON.stringify x.toString() else x
          res.write row.join("; \t")+"\r\n"
        res.end()
      else
        res.json map

moveFile = (src, dst, callback) ->
  fs.rename src, dst, (err) -> # renameSync doesn't work on Linux if the file is moved between volumes (e.g. from /tmp...)
    if err
      console.log "mv ", src, dst, "failed, copy instead"
      rs = fs.createReadStream src
      ws = fs.createWriteStream dst
      rs.pipe ws
      rs.on "end", () ->
        fs.unlink src, callback # delete src
    else callback()

app.post "/upload", (req, res) ->
  file = req.files.map
  eyes.inspect file
  pathUpload  = paths.uploads + file.name
  pathGpx     = paths.gpx     + file.name + ".gpx"
  pathJson    = paths.json    + file.name + ".gpx"
  moveFile file.path, pathUpload, (err) ->
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


app.listen app.get("port"), () ->
  console.log "server listening on port", app.get("port")