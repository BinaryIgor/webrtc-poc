#!bin/bash
set -e
docker build . -t coturn
docker run -d --network=host coturn