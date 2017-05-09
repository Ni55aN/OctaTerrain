#include "../src/octaterrain.h"
#include <ctime>
#include <stdio.h>

int main(int argc, char *argv[]) {

  float detail = atof(argv[1]);
  auto terrain = new OctaTerrain(1, 20, detail, true);

  const clock_t begin_time = clock();

  std::vector<int64_t> current;
  mat4 view = {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1};

  terrain->generate(view, current);

  auto added = terrain->getAdded().size();
  printf("----\nChunks: %lu with detail = %f\n", added, detail);

  printf("Elapsed time: \e[1m%lf\e[0m ms\n",
         float(clock() - begin_time) / CLOCKS_PER_SEC);
  return 0;
}