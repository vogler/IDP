$ -> # wait until DOM is loaded
  routie 'map/:file', (file) ->
    console.log 'routie: map/:file', file
    loadMap(file)

  routie 'site/:site', (site) ->
    console.log 'routie: site/:site', site
    loadSite(site)