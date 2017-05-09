#pragma once

struct vec9 {
  float a[9];
  float operator[](size_t i) const { return a[i]; };
  float &operator[](size_t i) { return a[i]; };
};