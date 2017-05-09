#pragma once

struct mat4 {
  float a[16];
  float operator[](size_t i) const { return a[i]; };
  float &operator[](size_t i) { return a[i]; };
  vec3 getPosition() { return vec3{a[3], a[7], a[11]}; }
};