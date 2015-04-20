#!/bin/bash

files=`find views servers apis shared bridge -not -path '*/\.*' -not -path '*@*' -type f`

echo '"use strict";'
echo 'var kCacheFiles = [';

for f in $files
do
  echo "  \"$f\","
done

echo "  \"configuration.json\""
echo '];'
