sudo docker exec cab9e6c5cee6 em++ src/bindings/em.cpp -o build/em/octaterrain.js -O3 --std=c++14 -Wall --bind -s EXPORT_NAME="'OctaTerrain'"
cd build/em
cp ./octaterrain.js ../../example
cp ./octaterrain.js.mem ../../example