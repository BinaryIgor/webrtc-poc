* Ideally STUN (Session Traversal Utilities for NAT)
* when symmetric NAT is blocking -> TURN (Traversal Using Relays around NAT)
* How peers established type of connection? -> ICE (Interactive Connectivity Establishment)
* Safety?
  "All data transmitted via WebRTC are mandatorily encrypted using standard AES (Advanced Encryption Standard) encryption which is the default cipher via SRTP (Secure Real-Time Transport Protocol), which is the secure extension for network protocol designed for multimedia telephony along with DTLS (Datagram Transport Layer Security), which provides a secure communication protocol to prevent eavesdropping, modification, replaying and other such security attacks on datagrams."
* ICE 
    * collects candidates (local ip addresses, reflexive addresseses - STUN and relayed ones - TURN)
    * candidates -> all collected are sent to the remote peer via SDP
    * trickle -> send independently, after offer
* SDP (Session Description Protocol)
    * format that describes ice candidates, networking options (udp (default) /tcp ?!), media options, security and other (?) stuff
    * format, not protocol really (veryy open, you can at almost anything there)
    * goal - take user SDP and send it, somehow, to remote peer
 * Signaling
    * SDP signaling
    * It can be done by ANY means, SDP information just needs to go to another peer


## Shortcut
1. A wants speak to B
2. A creates and offer. It finds all ICE candidates, security, audio/video and all other options.
    It then generates SDP string that contains all of this information. This information is SDP, basically
3. A signals this information (setting Local SDP) to B (hence need for signaling server)
4. B generates its SDP answer (setting its as Local SDP, setting A offer as Remote SDP), after receing A offer
5. B signals answer to A
6. Connection is created, A and B can exchange data directly


## Features need
* every participant - on/off stream

## Experiment
* reconnect after going offline

komputer prywatny, 4 userow, wlacznie, od kazdego video i od jednego audio receiving 350-400kib/s sending 350-400kib/s
video kompa firmowego 640x480 przesyła 220kib/s 

video z komorki 480x640 przesyla 220kib/s

peak - 800kib/s wysylanego na 6 uzytkownikach

ustawic preferowana jakosc obrazu, najlepiej ustawic zeby nie maksowalo jakosci obrazu jak jest dobre polaczenie