struct vec3 {
  float a[3];
  float operator[](size_t i) const { return a[i]; };
  float &operator[](size_t i) { return a[i]; };
  vec3 operator+(vec3 b) { return vec3{a[0] + b[0], a[1] + b[1], a[2] + b[2]}; }
  vec3 operator/(float b) { return vec3{a[0] / b, a[1] / b, a[2] / b}; }
  vec3 normalize(float len = 1) {
    float d = (float)sqrt(pow(a[0], 2) + pow(a[1], 2) + pow(a[2], 2));
    vec3 v = *this;
    return v / (d * len);
  }
};