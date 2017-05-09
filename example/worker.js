//var module = require('./main');
var terrain;

var Module = {
  preRun: [],
  onRuntimeInitialized: function load_done_callback() {

    terrain = new Module.OctaTerrain(1, 20, 3, true);
    self.postMessage({
      event: 'ready'
    });
  },
};
importScripts('octaterrain.js');

function vector2array(vector) {
  var arr = [];
  for (var i = 0; i < vector.size(); i++)
    arr.push(vector.get(i));

  return arr;
}

function array2vector(arr) {
  var vector = new Module.ChunkIdVector();
  for (var i = 0; i < arr.length; i++)
    vector.push_back(arr[i]);

  return vector;
}

self.addEventListener("message", function (e) {


  switch (e.data.cmd) {
    case 'generate':
      //console.time("ongenerate");

      var current = array2vector(e.data.current);

      terrain.generate(e.data.view, current);

      var added = terrain.getAdded();
      var removed = terrain.getRemoved();
      var vertices = terrain.getVertices();

      self.postMessage({
        event: 'generate',
        added: vector2array(added),
        removed: vector2array(removed),
        vertices: vector2array(vertices)
      });

      //console.timeEnd("ongenerate");
      break;
  }

})