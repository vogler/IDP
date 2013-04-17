$ -> # wait until DOM is loaded
  routie 'map/:file', (file) ->
    console.log 'routie: map/:file', file
    loadMap(file)