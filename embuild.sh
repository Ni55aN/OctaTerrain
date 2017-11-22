sudo docker exec cab9e6c5cee6 em++ src/bindings/em.cpp src/octaterrain.cpp src/octaterrain.hpp src/frustum.hpp -o build/em/octaterrain.js -O3 --memory-init-file 0 --std=c++14 -Wall --bind -Wno-missing-braces -s EXPORT_NAME="'OctaTerrain'"
cd build/em
cp ./octaterrain.js ../../example