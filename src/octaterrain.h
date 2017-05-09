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
#include "vec2.h"
#include "vec3.h"
#include "vec9.h"
#include "mat4.h"
#include "frustum.h"

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
  std::vector<vec9> addChunksVertices;
  vec3 cameraPosition;
  Frustum frustum;

  float theta = M_PI / 2;
  float phi = M_PI / 2;

public:
  OctaTerrain(float radius, int maxZ, float detail, bool saveVertices = false,
              bool progressive = false, bool enableFrustum = true) {
    if (maxZ <= 0 || maxZ > 24) // need max 20
      maxZ = maxZ <= 0 ? 0 : 24;

    this->radius = radius;
    this->maxZ = maxZ;
    this->detail = detail;
    this->cameraPosition = vec3{2 * radius, 0, 0};
    this->saveVertices = saveVertices;
    this->progressive = progressive;
    this->enableFrustum = enableFrustum;
  }

  vec2 toLatLon(vec3 p) { return vec2{0, 0}; }

  vec3 toPoint(vec2 v) { return toPoint(v[0], v[1]); }

  vec3 toPoint(float lat, float lon) {
    return vec3{radius * (float)cos(lat) * (float)sin(lon),
                radius * (float)sin(lat),
                radius * (float)cos(lat) * (float)cos(lon)};
  }

  std::vector<int64_t> getKeeped() { return keepChunksId; }

  std::vector<int64_t> getAdded() { return addChunksId; }

  std::vector<int64_t> getRemoved() { return removeChunksId; }

  std::vector<vec9> getVertices() { return addChunksVertices; }

private:
  float distance(vec3 &a, vec3 &b) {
    return sqrt(pow(a[0] - b[0], 2) + pow(a[1] - b[1], 2) +
                pow(a[2] - b[2], 2));
  }

  float boundingRadius(vec3 &center, vec3 &p1, vec3 &p2, vec3 &p3) {
    return std::max(distance(center, p1),
                    std::max(distance(center, p2), distance(center, p3)));
  }

  bool needDivide(vec3 &camera, vec3 &p1, vec3 &p2, vec3 &p3, int z) {
    vec3 center = getChunkCenter(p1, p2, p3);
    float boundRadius = boundingRadius(center, p1, p2, p3);

    if (enableFrustum && !frustum.intersectSphere(center, boundRadius))
      return false;

    return distance(camera, center) < boundRadius * detail;
  }

  vec3 getChunkCenter(vec3 &p1, vec3 &p2, vec3 &p3) {
    return (p1 + p2 + p3) / 3;
  }

  int64_t increaseIdLevel(int64_t id) { return id + ((int64_t)0x1 << 7 * 8); }

  int64_t decreaseIdLevel(int64_t id) { return id - ((int64_t)0x1 << 7 * 8); }

  int getIdLevel(int64_t id) { return id >> 7 * 8; }

  int64_t setIdSide(int side) { return (int64_t)side << (6 * 8); }

  int getIdSide(int64_t id) { return (id >> 6 * 8) & 0xff; }

  int64_t setIdIndex(int64_t id, int index) {
    auto level = getIdLevel(id);
    return id | ((int64_t)index << level * 2);
  }

  bool existChunk(int64_t id) {
    return std::find(currentChunksId.begin(), currentChunksId.end(), id) !=
           currentChunksId.end();
  }

  void addChunk(vec3 &p1, vec3 &p2, vec3 &p3, int64_t id, bool divide = true,
                bool positiveOriented = true) {

    p1 = p1.normalize(radius);
    p2 = p2.normalize(radius);
    p3 = p3.normalize(radius);

    if (divide) {
      int z = getIdLevel(id);
      if (z < maxZ && needDivide(cameraPosition, p1, p2, p3, z)) {
        bool continueDivide = !(progressive && existChunk(id));

        // Align the longitude of the right side along the edge for the upper
        // triangles

        vec3 p12 = (p1 + p2) / 2;
        vec3 p23 = (p2 + p3) / 2;
        vec3 p31 = (p3 + p1) / 2;

        id = increaseIdLevel(id);
        if (positiveOriented) {
          addChunk(p1, p12, p31, setIdIndex(id, 0), continueDivide);
          addChunk(p12, p23, p31, setIdIndex(id, 1), continueDivide, false);
          addChunk(p12, p2, p23, setIdIndex(id, 2), continueDivide);
          addChunk(p31, p23, p3, setIdIndex(id, 3), continueDivide);
        } else {
          addChunk(p1, p12, p31, setIdIndex(id, 0), continueDivide, false);
          addChunk(p31, p23, p3, setIdIndex(id, 2), continueDivide, false);
          addChunk(p31, p12, p23, setIdIndex(id, 1), continueDivide);
          addChunk(p12, p2, p23, setIdIndex(id, 3), continueDivide, false);
        }

        return;
      }
    }
    if (existChunk(id))
      keepChunksId.push_back(id);
    else {
      addChunksId.push_back(id);
      if (saveVertices) {

        vec3 a = (p1);
        vec3 b = (p2);
        vec3 c = (p3);

        if (getIdSide(id) >= 4)
          std::swap(b, c);

        addChunksVertices.push_back(
            vec9{a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]});
      }
    }
  }

  void addSide(int id) {
    float latScalar = (id > 3 ? -1 : 1);
    float lonScalar = id % 4;

    vec2 p1{latScalar * theta, lonScalar * phi};
    vec2 p2{0.0, lonScalar * phi};
    vec2 p3{0.0, (lonScalar + 1) * phi};

    vec3 v1 = toPoint(p1);
    vec3 v2 = toPoint(p2);
    vec3 v3 = toPoint(p3);

    addChunk(v1, v2, v3, setIdSide(id));
  }

public:
  void generate(vec3 position, mat4 view, std::vector<int64_t> current) {
    cameraPosition = position;
    frustum = Frustum(view);
    currentChunksId = current;
    addChunksId.clear();
    removeChunksId.clear();
    keepChunksId.clear();
    addChunksVertices.clear();
    // addSide(0);
    for (int i = 0; i < 8; i++)
      addSide(i);

    std::sort(currentChunksId.begin(), currentChunksId.end());
    std::sort(keepChunksId.begin(), keepChunksId.end());

    std::set_difference(currentChunksId.begin(), currentChunksId.end(),
                        keepChunksId.begin(), keepChunksId.end(),
                        std::inserter(removeChunksId, removeChunksId.end()));
  }
};