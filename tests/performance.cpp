#include "../src/octaterrain.hpp"
#include "../src/octaterrain.cpp"
#include <glm/gtc/type_ptr.hpp>
#include <ctime>
#include <stdio.h>

int main(int argc, char *argv[]) {

  float detail = atof(argv[1]);
  auto terrain = new OctaTerrain(1, 20, detail, true, true);

  const clock_t begin_time = clock();

  std::vector<int64_t> current;
  float v[] = {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1};
  glm::mat4 view = glm::make_mat4(v);

  terrain->generate(glm::vec3(0, 1, 0), view, current);

  auto added = terrain->getAdded().size();
  printf("----\nChunks: %lu with detail = %f\n", added, detail);

  printf("Elapsed time: \e[1m%lf\e[0m ms\n",
         float(clock() - begin_time) / CLOCKS_PER_SEC);
  return 0;
}