#pragma once
#include <math.h>
#include <glm/glm.hpp>

struct Plane {
  float a, b, c, d;

  void normalize() {
    float len = sqrt(a * a + b * b + c * c);
    a /= len;
    b /= len;
    c /= len;
    d /= len;
  }
};

struct Frustum {
  Plane planes[6];
  Frustum() {}
  Frustum(glm::mat4 m) {

    planes[0] = {m[0][3] - m[0][0], m[1][3] - m[1][0], m[2][3] - m[2][0], m[3][3] - m[3][0]};
    planes[1] = {m[0][3] + m[0][0], m[1][3] + m[1][0], m[2][3] + m[2][0], m[3][3] + m[3][0]};
    planes[2] = {m[0][3] + m[0][1], m[1][3] + m[1][1], m[2][3] + m[2][1], m[3][3] + m[3][1]};
    planes[3] = {m[0][3] - m[0][1], m[1][3] - m[1][1], m[2][3] - m[2][1], m[3][3] - m[3][1]};
    planes[4] = {m[0][3] - m[0][2], m[1][3] - m[1][2], m[2][3] - m[2][2], m[3][3] - m[3][2]};
    planes[5] = {m[0][3] + m[0][2], m[1][3] + m[1][2], m[2][3] + m[2][2], m[3][3] + m[3][2]};

    planes[0].normalize();
    planes[1].normalize();
    planes[2].normalize();
    planes[3].normalize();
    planes[4].normalize();
    planes[5].normalize();
  }

  bool intersectSphere(glm::vec3 center, float radius) {

    for (int i = 0; i < 6; i++)
      if (planes[i].a * center[0] + planes[i].b * center[1] +
              planes[i].c * center[2] + planes[i].d <=
          -radius)
        return false;

    return true;
  }
};