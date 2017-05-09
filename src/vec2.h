struct vec2 {
  float a[2];
  float operator[](size_t i) const { return a[i]; };
  float &operator[](size_t i) { return a[i]; };
};