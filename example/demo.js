//var Worker = require('webworker-threads').Worker;


var EmWorker = function (url, onmessage) {


    var ready = false;
    var busy = false;
    this.pause = false;
    var w = new Worker(url);
    w.addEventListener("message", function (e) {

        if (e.data.event == 'ready') {
            ready = true;
            return;
        }
        busy = false;
        onmessage(e.data);
    })

    this.update = function (cameraPosition, current) {
        if (!this.pause && ready && !busy) {
            busy = true;
            w.postMessage({
                cmd: 'generate',
                camera: cameraPosition,
                current: current
            });
        }
    }
}


var scene, camera, controls, renderer, worker;
var terrainMeshes = new THREE.Object3D(),
    terrainMaterial = new THREE.MeshLambertMaterial({
        color: 0xff6633,
        wireframe: true
    });
var currentChunks = [];


function render() {
    renderer.render(scene, camera);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    worker.update(camera.position.toArray(), currentChunks);
    document.getElementById("log").innerText =
        'Geometries: ' + renderer.info.memory.geometries +
        ', calls' + renderer.info.render.calls +
        ', camera ' + camera.position.x.toFixed(3) +
        '; ' + camera.position.y.toFixed(3) +
        '; ' + camera.position.z.toFixed(3);
    render();
}

function render() {
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    render();
}

function onTerrainUpdate(data) {

    for (var i in data.added) {
        currentChunks.push(data.added[i]);
    }
    console.log(data.vertices.length);

    for (var i in data.vertices) {

        var geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(data.vertices[i]), 3));
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();
        var chunk = new THREE.Mesh(geometry, terrainMaterial);
        chunk.chunkId = data.added[i];
        terrainMeshes.add(chunk);
    }

    for (var i in data.removed) {
        var d = data.removed[i];
        var findedId = currentChunks.find((e) => e.low == d.low && e.high == d.high);
        var findedMesh = terrainMeshes.children.find((e) => e.chunkId.low == d.low && e.chunkId.high == d.high);
        if (findedMesh) {
            findedMesh.geometry.dispose();
            terrainMeshes.remove(findedMesh);
        }
        var index = currentChunks.indexOf(findedId);
        if (index != -1)
            currentChunks.splice(index, 1);

    }
}

window.onload = function () {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.00001, 1000);
    scene.add(terrainMeshes);
    worker = new EmWorker("worker.js", onTerrainUpdate);

    controls = new THREE.OrbitControls(camera);
    controls.addEventListener('change', render);
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setClearColor(0x444444, 1);
    document.body.appendChild(renderer.domElement);

    var spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(3, 7, 3);

    scene.add(spotLight);

    var hemi = new THREE.HemisphereLight(0xbbbbbb, 0x808080, 0.6);
    scene.add(hemi);

    var spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(7, 7, 3);

    scene.add(spotLight);

    var hemi = new THREE.HemisphereLight(0xffffbb, 0x808080, 1);
    scene.add(hemi);

    camera.position.z = 2;

    window.addEventListener('resize', onWindowResize, false);

    onWindowResize();
    animate();
}