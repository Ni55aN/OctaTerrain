#include "octaterrain.hpp"

OctaTerrain::OctaTerrain(float radius, int maxZ, float detail, bool saveVertices,
  bool progressive, bool enableFrustum) {
  if (maxZ <= 0 || maxZ > 24) // need max 20
    maxZ = maxZ <= 0 ? 0 : 24;

  this->radius = radius;
  this->maxZ = maxZ;
  this->detail = detail;
  this->saveVertices = saveVertices;
  this->progressive = progressive;
  this->enableFrustum = enableFrustum;
}

glm::vec2 OctaTerrain::toLatLon(glm::vec3 p) {
  return glm::vec2(0, 0);
}

glm::vec3 OctaTerrain::toPoint(glm::vec2 v) {
  return toPoint(v[0], v[1]);
}

glm::vec3 OctaTerrain::toPoint(float lat, float lon) {
  return glm::vec3(
    radius * (float) cos(lat) * (float) sin(lon),
    radius * (float) sin(lat),
    radius * (float) cos(lat) * (float) cos(lon)
  );
}

std::vector <int64_t> OctaTerrain::getKeeped() {
  return keepChunksId;
}

std::vector <int64_t> OctaTerrain::getAdded() {
  return addChunksId;
}

std::vector <int64_t> OctaTerrain::getRemoved() {
  return removeChunksId;
}

std::vector <VerticesData> OctaTerrain::getVertices() {
  return addChunksVertices;
}

float OctaTerrain::boundingRadius(glm::vec3 & center, glm::vec3 & p1, glm::vec3 & p2, glm::vec3 & p3) {
  return std::max(glm::distance(center, p1),
    std::max(glm::distance(center, p2), glm::distance(center, p3)));
}

bool OctaTerrain::needDivide(glm::vec3 & camera, glm::vec3 & p1, glm::vec3 & p2, glm::vec3 & p3, int z) {
  glm::vec3 center = getChunkCenter(p1, p2, p3);
  float boundRadius = boundingRadius(center, p1, p2, p3);

  if (enableFrustum && !frustum.intersectSphere(center, boundRadius))
    return false;

  return glm::distance(camera, center) < boundRadius * detail;
}

glm::vec3 OctaTerrain::getChunkCenter(glm::vec3 & p1, glm::vec3 & p2, glm::vec3 & p3) {
  return (p1 + p2 + p3) / 3.0f;
}

int64_t OctaTerrain::increaseIdLevel(int64_t id) {
  return id + ((int64_t) 0x1 << 7 * 8);
}

int64_t OctaTerrain::decreaseIdLevel(int64_t id) {
  return id - ((int64_t) 0x1 << 7 * 8);
}

int OctaTerrain::getIdLevel(int64_t id) {
  return id >> 7 * 8;
}

int64_t OctaTerrain::setIdSide(int side) {
  return (int64_t) side << (6 * 8);
}

int OctaTerrain::getIdSide(int64_t id) {
  return (id >> 6 * 8) & 0xff;
}

int64_t OctaTerrain::setIdIndex(int64_t id, int index) {
  auto level = getIdLevel(id);
  return id | ((int64_t) index << level * 2);
}

bool OctaTerrain::existChunk(int64_t id) {
  return std::find(currentChunksId.begin(), currentChunksId.end(), id) !=
    currentChunksId.end();
}

void OctaTerrain::addChunk(glm::vec3 & p1, glm::vec3 & p2, glm::vec3 & p3, int64_t id, bool divide, bool positiveOriented) {

  p1 /= glm::length(p1) * radius;
  p2 /= glm::length(p2) * radius;
  p3 /= glm::length(p3) * radius;

  if (divide) {
    int z = getIdLevel(id);
    if (z < maxZ && needDivide(cameraPosition, p1, p2, p3, z)) {
      bool continueDivide = !(progressive && existChunk(id));

      // Align the longitude of the right side along the edge for the upper
      // triangles

      glm::vec3 p12 = (p1 + p2) / 2.0f;
      glm::vec3 p23 = (p2 + p3) / 2.0f;
      glm::vec3 p31 = (p3 + p1) / 2.0f;

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

      glm::vec3 a = p1;
      glm::vec3 b = p2;
      glm::vec3 c = p3;

      if (getIdSide(id) >= 4)
        std::swap(b, c);

      addChunksVertices.push_back(VerticesData {
        a,
        b,
        c
      });
    }
  }
}


void OctaTerrain::addSide(int id) {
  float latScalar = (id > 3 ? -1 : 1);
  float lonScalar = id % 4;

  glm::vec2 p1 {
    latScalar * theta, lonScalar * phi
  };
  glm::vec2 p2 {
    0.0,
    lonScalar * phi
  };
  glm::vec2 p3 {
    0.0,
    (lonScalar + 1) * phi
  };

  glm::vec3 v1 = toPoint(p1);
  glm::vec3 v2 = toPoint(p2);
  glm::vec3 v3 = toPoint(p3);

  addChunk(v1, v2, v3, setIdSide(id));
}

void OctaTerrain::clear(){
  addChunksId.clear();
  removeChunksId.clear();
  keepChunksId.clear();
  addChunksVertices.clear();
  currentChunksId.clear();
}

void OctaTerrain::generate(glm::vec3 position, glm::mat4 view, std::vector < int64_t > current) {
  cameraPosition = position;
  frustum = Frustum(view);
  clear();
  currentChunksId = current;

  for (int i = 0; i < 8; i++)
    addSide(i);

  std::sort(currentChunksId.begin(), currentChunksId.end());
  std::sort(keepChunksId.begin(), keepChunksId.end());

  std::set_difference(currentChunksId.begin(), currentChunksId.end(),
    keepChunksId.begin(), keepChunksId.end(),
    std::inserter(removeChunksId, removeChunksId.end()));
}