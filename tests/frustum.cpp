#include "../src/octaterrain.h"
#include <stdio.h>

int main(int argc, char *argv[]) {

  std::vector<int64_t> current;
  mat4 view = {
      0.7998778498872755,   0.014632720527157262,   -0.018685112156551765,
      -0.01868511178284953, 2.7758276596274867e-18, 0.9959666850834269,
      0.5491629867195611,   0.5491629757363016,     -0.017888322090524256,
      0.6543033479626332,   -0.8355063857331966,    -0.8355063690230691,
      0.00398424737250847,  -1.1039001338073182,    0.7676088257849532,
      0.7676288104325768};

  Frustum frustum(view);

  printf(">> %s\n",
         frustum.intersectSphere(vec3{0, 1, 0}, 0.9) ? "true" : "false");

  printf(">> %s\n",
         frustum.intersectSphere(vec3{0, -1, 0}, 0.9) ? "true" : "false");

  return 0;
}