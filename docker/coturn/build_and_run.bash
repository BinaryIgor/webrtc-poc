#!bin/bash
set -e
exec docker run --network=host -v coturn.conf:/etc/coturn/turnserver.conf coturn/coturn:4.5.2-debian