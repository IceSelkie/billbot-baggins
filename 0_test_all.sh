
rm src/derived_*.json

cd src

TESTNAME="Local Server: one game"
echo "  ${TESTNAME}..."
output=$(node testLocalServer.js)
if [[ "$output" == *"S 41c946"* ]]; then
  echo "    Success."
else
  echo "### FAILED!"
  echo "${output}"
fi

TESTNAME="Seeds generate correct deck"
echo "  ${TESTNAME}..."
output=$(node test_seedsMatch.js)
if [[ "$output" == *", failed: 0, passRatio: 1 }"* ]]; then
  echo "    Success."
else
  echo "### FAILED!"
  echo "${output}"
fi

TESTNAME="RunAll"
echo "  ${TESTNAME}..."
output=$(node 0_run_all.js)
if [[ "$output" == *"0 clues between 0 variants"* ]]; then
  echo "    Success."
else
  echo "### FAILED!"
  echo "${output}"
fi

cd ..
