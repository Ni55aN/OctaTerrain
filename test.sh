cd tests

echo "Performance test:"
g++ performance.cpp -o test -std=c++11
if [ -f test ]; then
    for i in {1..10}
    do
        ./test $i
    done
    rm test
fi