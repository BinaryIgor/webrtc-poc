#!bin/bash
set -e
docker build . -t webrtc-poc
docker run -d --network=host webrtc-poc
