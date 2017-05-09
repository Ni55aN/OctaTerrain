cd tests
set -e
case $1 in
1) 
g++ frustum.cpp -o test -std=c++11
./test
rm test
;;
*)
g++ performance.cpp -o test -std=c++11
echo "Performance test:"
if [ -f test ]; then
    for i in {1..10}
    do
        ./test $i
    done
    rm test
fi
;;
esac