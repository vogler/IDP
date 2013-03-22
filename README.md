# About
Web application for GPS data visualization.

__Server:__
[node.js](http://nodejs.org/),
[express](http://expressjs.com/),
[jade](http://jade-lang.com/),
[stylus](http://learnboost.github.com/stylus/),
[connect-assets](https://github.com/TrevorBurnham/connect-assets),
[CoffeeScript](http://coffeescript.org/),
[MongoDB](http://www.mongodb.org/),
[mongoskin](https://github.com/kissjs/node-mongoskin)

__Client:__
[Google Maps JS API V3](https://developers.google.com/maps/documentation/javascript/?hl=de),
[jQuery](http://jquery.com/),
[jQuery UI](http://jqueryui.com/),
[Twitter Bootstrap](http://twitter.github.com/bootstrap/),
[Knockout](http://knockoutjs.com),
~~[Sugar](http://sugarjs.com/)~~,
[ColorPicker](http://www.abeautifulsite.net/blog/2011/02/jquery-minicolors-a-color-selector-for-input-controls/),
[bootstrap-filestyle](http://markusslima.github.com/bootstrap-filestyle/)


#Installation
    git clone https://github.com/vogler/IDP.git
    cd IDP
    npm install

For now all the needed client libraries and the .jar for converting maps are contained in this repo.

TODO: use [yeoman](http://yeoman.io/) or [bower](http://twitter.github.com/bower/)


#Start
    mongod --dbpath data/db
    coffee server

Alternatively (reloads on changes):

    sudo npm install -g nodemon
    nodemon server.coffee

A JS version can be compiled using:

    coffee -c server