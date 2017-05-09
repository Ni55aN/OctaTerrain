#pragma once
#include <math.h>

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
  Frustum(mat4 m) {

    planes[0] = {m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]};
    planes[1] = {m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]};
    planes[2] = {m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]};
    planes[3] = {m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]};
    planes[4] = {m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]};
    planes[5] = {m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]};

    planes[0].normalize();
    planes[1].normalize();
    planes[2].normalize();
    planes[3].normalize();
    planes[4].normalize();
    planes[5].normalize();
  }

  bool intersectSphere(vec3 center, float radius) {

    for (int i = 0; i < 6; i++)
      if (planes[i].a * center[0] + planes[i].b * center[1] +
              planes[i].c * center[2] + planes[i].d <=
          -radius)
        return false;

    return true;
  }
};