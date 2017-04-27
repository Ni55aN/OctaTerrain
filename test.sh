cd tests
set -e
g++ performance.cpp -o test -std=c++11
echo "Performance test:"
if [ -f test ]; then
    for i in {1..10}
    do
        ./test $i
    done
    rm test
fi