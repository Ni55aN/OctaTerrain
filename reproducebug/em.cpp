#include <emscripten/bind.h>
using namespace emscripten;
#include <stdio.h>
#include <vector>

struct vec9 {
  float a[9];
  float x, y, z, k, l, m, n, o, p;
  float operator[](size_t i) const { return a[i]; };
};

std::vector<val> vec2valVector(std::vector<vec9> vector) {
  std::vector<val> v;
  v.push_back(val(typed_memory_view<float>(9, vector[0].a)));
  return v;
}

std::vector<val> vec2valVector(std::vector<vec9 *> vector) {
  std::vector<val> v;
  v.push_back(val(typed_memory_view<float>(9, vector[0]->a)));
  return v;
}

std::vector<vec9> v;
std::vector<val> test() {
  printf("%d\n", v.size());
  v.push_back(vec9{1, 0, 0, 0, 0.7, 0, 0.2, 0.7, 0});
  return vec2valVector(v);
}

std::vector<val> test_ptr() {
  std::vector<vec9 *> v;
  v.push_back(new vec9{1, 0, 0, 0, 0.7, 0, 0.2, 0.7, 0});
  return vec2valVector(v);
}

std::vector<vec9> getvec() {
  std::vector<vec9> v;
  v.push_back(vec9{1, 0, 0, 0, 0.7, 0, 0.2, 0.7, 0});
  return v;
}

vec9 getvec9() { return vec9{1, 0, 0, 0, 0.7, 0, 0.2, 0.7, 0}; }
struct Point2f {
  float x;
  float y;
};

EMSCRIPTEN_BINDINGS(my_module) {
  function("test", &test);
  function("test_ptr", &test_ptr);
  function("getvec", &getvec);
  function("getvec9", &getvec9);

  value_array<vec9>("vec9").element(&vec9::x);

  register_vector<val>("ValVector");
  register_vector<vec9>("Vector");
}
