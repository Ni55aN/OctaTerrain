#include <emscripten/bind.h>
using namespace emscripten;

#include "../octaterrain.h"

struct ChunkId {
  unsigned int high;
  unsigned int low;
};

class emOctaTerrain : public OctaTerrain {
  ChunkId Int64toChunkId(int64_t bits) {
    return {(unsigned int)(bits >> 32), (unsigned int)(bits & 0xffffffff)};
  }

  int64_t ChunkIdtoInt(ChunkId chunk) {
    return ((int64_t)chunk.high << 32) | chunk.low;
  }

  std::vector<ChunkId> int2chunkVector(std::vector<int64_t> vector) {
    std::vector<ChunkId> v;
    for (const auto &i : vector)
      v.push_back(Int64toChunkId(i));
    return v;
  }

  std::vector<int64_t> chunk2intVector(std::vector<ChunkId> vector) {
    std::vector<int64_t> v;
    for (const auto &i : vector)
      v.push_back(ChunkIdtoInt(i));
    return v;
  }

public:
  emOctaTerrain(float radius, int maxZ, float detail, bool saveVertices = false,
                bool progressive = false)
      : OctaTerrain(radius, maxZ, detail, saveVertices, progressive) {}

  std::vector<ChunkId> getKeeped() { return int2chunkVector(keepChunksId); }

  std::vector<ChunkId> getAdded() { return int2chunkVector(addChunksId); }

  std::vector<ChunkId> getRemoved() { return int2chunkVector(removeChunksId); }

  std::vector<vec9> getVertices() { return OctaTerrain::getVertices(); }

  void generate(mat4 view, std::vector<ChunkId> current) {
    OctaTerrain::generate(view, chunk2intVector(current));
  }
};

EMSCRIPTEN_BINDINGS(my_module) {
  class_<emOctaTerrain>("OctaTerrain")
      .constructor<float, int, float>()
      .constructor<float, int, float, bool>()
      .constructor<float, int, float, bool, bool>()
      .function("generate", &emOctaTerrain::generate)
      .function("getAdded", &emOctaTerrain::getAdded)
      .function("getRemoved", &emOctaTerrain::getRemoved)
      .function("getKeeped", &emOctaTerrain::getKeeped)
      .function("getVertices", &emOctaTerrain::getVertices);

  value_array<ChunkId>("ChunkId")
      .element(&ChunkId::high)
      .element(&ChunkId::low);

  value_array<vec9>("vec9")
      .element(index<0>())
      .element(index<1>())
      .element(index<2>())
      .element(index<3>())
      .element(index<4>())
      .element(index<5>())
      .element(index<6>())
      .element(index<7>())
      .element(index<8>());

  value_array<mat4>("mat4")
      .element(index<0>())
      .element(index<1>())
      .element(index<2>())
      .element(index<3>())
      .element(index<4>())
      .element(index<5>())
      .element(index<6>())
      .element(index<7>())
      .element(index<8>())
      .element(index<9>())
      .element(index<10>())
      .element(index<11>())
      .element(index<12>())
      .element(index<13>())
      .element(index<14>())
      .element(index<15>());

  register_vector<ChunkId>("ChunkIdVector");
  register_vector<vec9>("vec9Vector");
}
