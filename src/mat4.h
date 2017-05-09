#pragma once

struct mat4 {
  float a[16];
  float operator[](size_t i) const { return a[i]; };
  float &operator[](size_t i) { return a[i]; };
  vec3 getPosition() { return vec3{a[12], a[13], a[14]}; }
};