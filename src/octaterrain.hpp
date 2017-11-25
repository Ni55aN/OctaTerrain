#pragma once

#include <inttypes.h>
#include <stdio.h>
#define _USE_MATH_DEFINES
#include <algorithm>
#include <iostream>
#include <iterator>
#include <math.h>
#include <memory>
#include <vector>
#include "frustum.hpp"
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

struct VerticesData{
  glm::vec3 a;
  glm::vec3 b;
  glm::vec3 c;
};

class OctaTerrain {
protected:
  float radius;
  int maxZ;
  float detail;
  bool saveVertices;
  bool progressive;
  bool enableFrustum;
  std::vector<int64_t> currentChunksId;
  std::vector<int64_t> keepChunksId;
  std::vector<int64_t> addChunksId;
  std::vector<int64_t> removeChunksId;
  std::vector<VerticesData> addChunksVertices;
  glm::vec3 cameraPosition;
  Frustum frustum;

  float theta = M_PI / 2;
  float phi = M_PI / 2;

public:
  OctaTerrain(float radius, int maxZ, float detail, bool saveVertices = false,
              bool progressive = false, bool enableFrustum = true);

  glm::vec2 toLatLon(glm::vec3 p);
  glm::vec3 toPoint(glm::vec2 v);
  glm::vec3 toPoint(float lat, float lon);

  std::vector<int64_t> getKeeped();
  std::vector<int64_t> getAdded();
  std::vector<int64_t> getRemoved();
  std::vector<VerticesData> getVertices();

  glm::vec3 getChunkCenter(glm::vec3 &p1, glm::vec3 &p2, glm::vec3 &p3);

  int64_t increaseIdLevel(int64_t id);
  int64_t decreaseIdLevel(int64_t id);
  int getIdLevel(int64_t id);
  int64_t setIdSide(int side);
  int getIdSide(int64_t id);
  int64_t setIdIndex(int64_t id, int index);

private:
  float boundingRadius(glm::vec3 &center, glm::vec3 &p1, glm::vec3 &p2, glm::vec3 &p3);
  bool needDivide(glm::vec3 &camera, glm::vec3 &p1, glm::vec3 &p2, glm::vec3 &p3, int z);

  bool existChunk(int64_t id);

  void addChunk(glm::vec3 &p1, glm::vec3 &p2, glm::vec3 &p3, int64_t id, bool divide = true, bool positiveOriented = true);
  void addSide(int id);
  void clear();

public:
  void generate(glm::vec3 position, glm::mat4 view, std::vector<int64_t> current = std::vector<int64_t>());
};